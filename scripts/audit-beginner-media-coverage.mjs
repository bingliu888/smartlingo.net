import { DatabaseSync } from "node:sqlite";
import { readdirSync, readFileSync } from "node:fs";
import { beginnerVocabularyImageKey } from "../lib/smartlingo-vocabulary-images.ts";
import { applyTrackedMigrations, readMigrationManifest } from "./validate-d1-migrations.mjs";

const database = new DatabaseSync(":memory:");
database.exec("PRAGMA foreign_keys=ON");
applyTrackedMigrations(database, readMigrationManifest());

const drizzleDirectory = new URL("../drizzle/", import.meta.url);
const catalogFiles = readdirSync(drizzleDirectory)
  .filter(name => /^01(?:3[2-9]|4[0-3])_.+_vocabulary_catalog\.sql$/.test(name))
  .sort();
const correctionFiles = readdirSync(drizzleDirectory)
  .filter(name => /^014[4-7]_english_vocabulary_common_senses\.sql$/.test(name))
  .sort();
for (const file of [
  "0125_vocabulary_pronunciation_guides.sql",
  "0126_vocabulary_21_day_memory.sql",
  "0127_clean_vocabulary_meanings.sql",
  "0131_multilingual_pronunciation_guides.sql",
  ...catalogFiles,
  "0043_beginner_gloss_quality.sql",
  ...correctionFiles,
  "0148_japanese_beginner_common_senses.sql",
  "0153_english_beginner_away_gloss.sql",
  "0154_vocabulary_learner_quality_sweep.sql",
  "0155_vocabulary_frequency_degree.sql",
]) database.exec(readFileSync(new URL(file, drizzleDirectory), "utf8"));

const rows = database.prepare(`SELECT target_language AS language,form,meaning_en AS meaningEn,meaning_zh AS meaningZh
  FROM smartlingo_vocabulary_items
  WHERE level='beginner' AND review_status='published'
  ORDER BY target_language,sequence`).all();

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

function isImageable(row) {
  const form = normalize(row.form);
  const meaning = normalize(row.meaningEn);
  const label = conceptLabel(row);
  if (grammarForms.has(form) || grammarForms.has(label)) return false;
  if (grammarMeaning.test(meaning)) return false;
  if (/^(?:letter|sound|syllable|abbreviation|contraction|prefix|suffix)\b/i.test(meaning)) return false;
  return Boolean(label);
}

const perLanguage = new Map();
const coveredConcepts = new Map();
for (const row of rows) {
  const imageKey = beginnerVocabularyImageKey(row.form, row.meaningEn, row.meaningZh);
  const summary = perLanguage.get(row.language) || { total: 0, covered: 0, imageable: 0, imageableCovered: 0 };
  summary.total += 1;
  if (isImageable(row)) summary.imageable += 1;
  if (imageKey) {
    summary.covered += 1;
    if (isImageable(row)) summary.imageableCovered += 1;
    coveredConcepts.set(imageKey, (coveredConcepts.get(imageKey) || 0) + 1);
  }
  perLanguage.set(row.language, summary);
}

const output = {
  totalBeginnerLexemes: rows.length,
  distinctEnglishSenses: new Set(rows.map(row => row.meaningEn.trim().toLocaleLowerCase())).size,
  distinctChineseSenses: new Set(rows.map(row => row.meaningZh.trim())).size,
  coveredLexemes: [...perLanguage.values()].reduce((sum, row) => sum + row.covered, 0),
  uncoveredLexemes: rows.length - [...perLanguage.values()].reduce((sum, row) => sum + row.covered, 0),
  imageableLexemes: [...perLanguage.values()].reduce((sum, row) => sum + row.imageable, 0),
  coveredImageableLexemes: [...perLanguage.values()].reduce((sum, row) => sum + row.imageableCovered, 0),
  reusableMediaConcepts: coveredConcepts.size,
  perLanguage: Object.fromEntries([...perLanguage].map(([language, value]) => [language, {
    ...value,
    percent: Number((value.covered * 100 / value.total).toFixed(1)),
    imageablePercent: Number((value.imageableCovered * 100 / value.imageable).toFixed(1)),
  }])),
  topConceptReuse: Object.fromEntries([...coveredConcepts].sort((left, right) => right[1] - left[1]).slice(0, 30)),
  functionalExemptions: rows.filter(row => !isImageable(row) && !beginnerVocabularyImageKey(row.form, row.meaningEn, row.meaningZh)).slice(0, 32)
    .map(row => ({ language: row.language, form: row.form, meaningEn: row.meaningEn })),
  nextEnglishMediaQueue: rows
    .filter(row => row.language === "en" && isImageable(row) && !beginnerVocabularyImageKey(row.form, row.meaningEn, row.meaningZh))
    .slice(0, 64)
    .map(row => ({ form: row.form, meaningEn: row.meaningEn, meaningZh: row.meaningZh })),
};

console.log(JSON.stringify(output, null, 2));
database.close();
