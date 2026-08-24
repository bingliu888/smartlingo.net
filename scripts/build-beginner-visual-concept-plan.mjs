import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { baseBeginnerVocabularyImageKey } from "../lib/smartlingo-vocabulary-images.ts";
import { applyTrackedMigrations, readMigrationManifest } from "./validate-d1-migrations.mjs";

const database = new DatabaseSync(":memory:");
database.exec("PRAGMA foreign_keys=ON");
applyTrackedMigrations(database, readMigrationManifest());
const drizzleDirectory = new URL("../drizzle/", import.meta.url);
const catalogFiles = readdirSync(drizzleDirectory).filter(name => /^01(?:3[2-9]|4[0-3])_.+_vocabulary_catalog\.sql$/.test(name)).sort();
const correctionFiles = readdirSync(drizzleDirectory).filter(name => /^014[4-7]_english_vocabulary_common_senses\.sql$/.test(name)).sort();
for (const file of [
  "0125_vocabulary_pronunciation_guides.sql", "0126_vocabulary_21_day_memory.sql", "0127_clean_vocabulary_meanings.sql",
  "0131_multilingual_pronunciation_guides.sql", ...catalogFiles, "0043_beginner_gloss_quality.sql", ...correctionFiles,
  "0148_japanese_beginner_common_senses.sql", "0153_english_beginner_away_gloss.sql", "0154_vocabulary_learner_quality_sweep.sql",
  "0155_vocabulary_frequency_degree.sql",
]) database.exec(readFileSync(new URL(file, drizzleDirectory), "utf8"));

const rows = database.prepare(`SELECT target_language AS language,form,meaning_en AS meaningEn,meaning_zh AS meaningZh,difficulty,frequency_degree AS frequency
  FROM smartlingo_vocabulary_items WHERE level='beginner' AND review_status='published' ORDER BY difficulty,frequency_degree DESC,sequence`).all();

const grammarForms = new Set(`a an the and or but if so because as at by for from in into of on out over than to up with
i me my we our us you your he him his she her hers it its they them their this that these those who whom whose which what when where why how
am is are was were be been being have has had do does did can could may might must shall should will would not no nor
ain't aren't can't couldn't didn't doesn't don't hadn't hasn't haven't he'd he'll he's here's how's i'd i'll i'm i've isn't it'd it'll it's let's
mustn't she'd she'll she's shouldn't that's there's they'd they'll they're they've wasn't we'd we'll we're we've weren't what's when's where's who's
won't wouldn't`.split(/\s+/));
const grammarMeaning = /\b(?:article|pronoun|preposition|conjunction|auxiliary|modal|possessive|plural form|singular form|past form|past participle|present participle|comparative form|superlative form|used to form|used before|used in a comparison|used to introduce|the speaker|person or people being addressed)\b/i;

function normalize(value) {
  return String(value || "").normalize("NFKC").toLocaleLowerCase().replace(/[“”‘’]/g, "'").replace(/\s+/g, " ").trim();
}

function conceptLabel(row) {
  let value = normalize(row.meaningEn)
    .split(/\s*[;；]\s*/)[0]
    .split(/\s+\bor\b\s+/i)[0]
    .replace(/^the act of\s+/, "")
    .replace(/^the state of\s+/, "")
    .replace(/^(?:a|an|the)\s+/, "")
    .replace(/^to\s+/, "")
    .replace(/\s*\([^)]*\)\s*/g, " ")
    .replace(/[^\p{L}\p{N}' -]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!value || value.length > 62 || value.split(" ").length > 8) value = normalize(row.form);
  return value;
}

function isEligible(row) {
  const form = normalize(row.form);
  const meaning = normalize(row.meaningEn);
  const label = conceptLabel(row);
  if (grammarForms.has(form) || grammarForms.has(label)) return false;
  if (grammarMeaning.test(meaning)) return false;
  if (/^(?:letter|sound|syllable|abbreviation|contraction|prefix|suffix)\b/i.test(meaning)) return false;
  return Boolean(label);
}

const groups = new Map();
for (const row of rows) {
  if (baseBeginnerVocabularyImageKey(row.form, row.meaningEn, row.meaningZh) || !isEligible(row)) continue;
  const label = conceptLabel(row);
  const key = normalize(label).replace(/[^\p{L}\p{N}]+/gu, "_").replace(/^_+|_+$/g, "").slice(0, 44) || "concept";
  const current = groups.get(label) || { key, label, meaningsEn: new Set(), meaningsZh: new Set(), forms: new Set(), languages: new Set(), lexemeCount: 0, priority: 0 };
  current.meaningsEn.add(normalize(row.meaningEn));
  current.meaningsZh.add(String(row.meaningZh || "").trim());
  current.forms.add(normalize(row.form));
  current.languages.add(row.language);
  current.lexemeCount += 1;
  current.priority += (7 - Number(row.difficulty || 1)) * 10 + Number(row.frequency || 1);
  groups.set(label, current);
}

const duplicateKeys = new Map();
const concepts = [...groups.values()]
  .sort((left, right) => right.languages.size - left.languages.size || right.lexemeCount - left.lexemeCount || right.priority - left.priority || left.label.localeCompare(right.label))
  .map((group, index) => {
    const base = group.key;
    const occurrence = (duplicateKeys.get(base) || 0) + 1;
    duplicateKeys.set(base, occurrence);
    return {
      key: `v${String(index + 1).padStart(4, "0")}_${base}${occurrence > 1 ? `_${occurrence}` : ""}`,
      label: group.label,
      lexemeCount: group.lexemeCount,
      languageCount: group.languages.size,
      languages: [...group.languages].sort(),
      terms: [...new Set([group.label, ...group.forms, ...group.meaningsEn])].filter(Boolean).slice(0, 24),
      meaningsZh: [...group.meaningsZh].filter(Boolean).slice(0, 12),
    };
  });

const output = {
  version: "2026-08-23.1",
  totalBeginnerLexemes: rows.length,
  eligibleUncoveredLexemes: concepts.reduce((sum, concept) => sum + concept.lexemeCount, 0),
  distinctEligibleConcepts: concepts.length,
  selectedAiConcepts: Math.min(1000, concepts.length),
  sheetSize: 36,
  concepts,
};
const destination = new URL("../media-source/beginner-visual-concept-plan.json", import.meta.url);
mkdirSync(new URL("../media-source/", import.meta.url), { recursive: true });
writeFileSync(destination, `${JSON.stringify(output, null, 2)}\n`);
console.log(JSON.stringify({ ...output, concepts: undefined, sheets: Math.ceil(output.selectedAiConcepts / output.sheetSize) }, null, 2));
database.close();
