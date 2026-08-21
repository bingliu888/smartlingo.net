import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { applyTrackedMigrations, readMigrationManifest } from "./validate-d1-migrations.mjs";

const drizzle = new URL("../drizzle/", import.meta.url);
const catalogFiles = readdirSync(drizzle)
  .filter(name => /^01(?:3[2-9]|4[0-3])_.+_vocabulary_catalog\.sql$/.test(name))
  .sort();
const englishCorrections = readdirSync(drizzle)
  .filter(name => /^014[4-7]_english_vocabulary_common_senses\.sql$/.test(name))
  .sort();
const afterCatalog = [
  ...englishCorrections,
  "0148_japanese_beginner_common_senses.sql",
  "0043_beginner_gloss_quality.sql",
];
const qualityCorrections = readdirSync(drizzle)
  .filter(name => /^00(?:4[4-9]|5[0-5])_vocabulary_quality_.+\.sql$/.test(name))
  .sort();
const commonOverrides = JSON.parse(readFileSync(new URL("../data/smartlingo-vocabulary-common-overrides.json", import.meta.url), "utf8"));
const commonOverrideByKey = new Map(commonOverrides.map(item => [`${item.language}:${compact(item.form).toLocaleLowerCase()}`, item]));

function migration(name) {
  return readFileSync(new URL(`../drizzle/${name}`, import.meta.url), "utf8");
}

function compact(value) {
  return String(value ?? "").normalize("NFKC").replace(/\s+/g, " ").trim();
}

function clauses(value) {
  return compact(value)
    .split(/[;,，；、/]+/u)
    .map(part => part.trim().replace(/^[（(]|[）)]$/g, ""))
    .filter(Boolean);
}

function hasRepeatedClause(value) {
  const parts = clauses(value).map(part => part.toLocaleLowerCase());
  return parts.some((part, index) => parts.indexOf(part) !== index);
}

function issueCodes(row) {
  const zh = compact(row.meaningZh);
  const en = compact(row.meaningEn);
  const phonetic = compact(row.targetPhonetic);
  const issues = [];
  const commonOverride = commonOverrideByKey.get(`${row.language}:${compact(row.form).toLocaleLowerCase()}`);
  if (commonOverride && (en !== compact(commonOverride.meaningEn) || zh !== compact(commonOverride.meaningZh))) issues.push("common-semantic-mismatch");
  if (!/[\p{Script=Han}]/u.test(zh)) issues.push("zh-no-han");
  if (zh.length > 80) issues.push("zh-too-long");
  if (clauses(zh).length > 8) issues.push("zh-too-many-clauses");
  if (hasRepeatedClause(zh)) issues.push("zh-repeated-clause");
  if (/(.{2,12})(?:[，,；;、]\s*\1){2,}/u.test(zh)) issues.push("zh-repeated-run");
  if (/[\\<>\uE000-\uF8FF]|�|QQ|XXX|\b(?:Classifier|English|Chinese)\b/i.test(zh)) issues.push("zh-corrupt-token");
  if (/[A-Za-z]{4,}/.test(zh)) issues.push("zh-english-leak");
  if (en.length > 180) issues.push("en-too-long");
  if (hasRepeatedClause(en)) issues.push("en-repeated-clause");
  if (row.language !== "en" && /\b(?:(?:elative degree|comparative|superlative|plural|singular|inflection|conjugation|participle|alternative form|alternative spelling|romanization|transliteration|synonym|diminutive|noun of place) of|(?:attributive|non-reduplicated) form[^;,.]* of)\b/i.test(en)) issues.push("en-form-definition");
  if (/[(（]\s*(?:obsolete|archaic|historical|vulgar|offensive|derogatory)\s*[)）]/i.test(en)) issues.push("en-disallowed-sense");
  if (/[\\<>]|�|QQ|XXX/.test(en)) issues.push("en-corrupt-token");
  if (/\b(?:Classifier|English|Chinese|letter)\b/i.test(phonetic) || /[<>\\]|�/.test(phonetic)) issues.push("phonetic-corrupt-token");
  return [...new Set(issues)];
}

const database = new DatabaseSync(":memory:");
database.exec("PRAGMA foreign_keys=ON");
applyTrackedMigrations(database, readMigrationManifest());
for (const name of [
  "0125_vocabulary_pronunciation_guides.sql",
  "0126_vocabulary_21_day_memory.sql",
  "0127_clean_vocabulary_meanings.sql",
  "0131_multilingual_pronunciation_guides.sql",
  ...catalogFiles,
  ...afterCatalog,
  ...(process.argv.includes("--before-quality") ? [] : qualityCorrections),
]) database.exec(migration(name));

const rows = database.prepare(`SELECT id,target_language AS language,level,sequence,form,
  meaning_en AS meaningEn,meaning_zh AS meaningZh,target_phonetic AS targetPhonetic
  FROM smartlingo_vocabulary_items WHERE review_status='published'
  ORDER BY target_language,sequence`).all();
const findings = [];
const auditedRows = [];
for (const row of rows) {
  const issues = issueCodes(row);
  auditedRows.push({ ...row, issues });
  for (const code of issues) findings.push({ code, ...row });
}

if (process.argv.includes("--rows")) {
  writeFileSync(1, JSON.stringify(auditedRows));
  database.close();
  process.exit(0);
}

const counts = {};
const byLanguage = {};
for (const finding of findings) {
  counts[finding.code] = (counts[finding.code] ?? 0) + 1;
  byLanguage[finding.language] ??= {};
  byLanguage[finding.language][finding.code] = (byLanguage[finding.language][finding.code] ?? 0) + 1;
}
const samples = Object.fromEntries(Object.keys(counts).sort().map(code => [
  code,
  findings.filter(finding => finding.code === code).slice(0, 12).map(({ id, language, level, sequence, form, meaningEn, meaningZh, targetPhonetic }) => (
    { id, language, level, sequence, form, meaningEn, meaningZh, targetPhonetic }
  )),
]));
console.log(JSON.stringify({ totalRows: rows.length, findingCount: findings.length, counts, byLanguage, samples }, null, 2));
database.close();
