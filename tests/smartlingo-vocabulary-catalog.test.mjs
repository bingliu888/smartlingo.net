import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { applyTrackedMigrations, readMigrationManifest } from "../scripts/validate-d1-migrations.mjs";

const supportedLanguages = ["zh", "en", "es", "ja", "ko", "fr", "de", "ru", "it", "pt", "ar", "hi"];
const catalogFiles = readdirSync(new URL("../drizzle/", import.meta.url))
  .filter(name => /^01(?:3[2-9]|4[0-3])_.+_vocabulary_catalog\.sql$/.test(name))
  .sort();
const correctionFiles = readdirSync(new URL("../drizzle/", import.meta.url))
  .filter(name => /^014[4-7]_english_vocabulary_common_senses\.sql$/.test(name))
  .sort();
const japaneseCorrectionFile = "0148_japanese_beginner_common_senses.sql";

test("the release contains one deterministic 4,000-item catalog migration per language", () => {
  assert.equal(catalogFiles.length, 12);
  for (const [index, file] of catalogFiles.entries()) {
    const sql = readFileSync(new URL(`../drizzle/${file}`, import.meta.url), "utf8");
    assert.equal((sql.match(/INSERT INTO smartlingo_vocabulary_items /g) || []).length, 3972, file);
    assert.equal((sql.match(/UPDATE smartlingo_vocabulary_items SET pronunciation_guides=/g) || []).length, 28, file);
    assert.match(sql, new RegExp(`target_language='${supportedLanguages[index]}'`));
    assert.match(sql, /lexical_source_license/);
    assert.match(sql, /automated-linguistic-validation/);
  }
});

test("the English sense correction is form-keyed across legacy and fresh catalogs", () => {
  assert.equal(correctionFiles.length, 4);
  const sql = correctionFiles.map(file => readFileSync(new URL(`../drizzle/${file}`, import.meta.url), "utf8")).join("\n");
  assert.equal((sql.match(/UPDATE smartlingo_vocabulary_items SET meaning_en=/g) || []).length, 4879);
  assert.match(sql, /WHERE target_language='en' AND lower\(form\)=/);
  assert.doesNotMatch(sql, /WHERE id=/);
  assert.match(sql, /form='in' AND target_language='en' AND meaning_zh='在……里面；在……期间'/);
});

test("all 48,000 published rows pass level, phonetic, aid, and provenance gates", () => {
  const database = new DatabaseSync(":memory:");
  database.exec("PRAGMA foreign_keys=ON");
  applyTrackedMigrations(database, readMigrationManifest());
  for (const file of [
    "0125_vocabulary_pronunciation_guides.sql",
    "0126_vocabulary_21_day_memory.sql",
    "0127_clean_vocabulary_meanings.sql",
    "0131_multilingual_pronunciation_guides.sql",
    ...catalogFiles,
    ...correctionFiles,
    japaneseCorrectionFile,
    "0043_beginner_gloss_quality.sql",
  ]) database.exec(readFileSync(new URL(`../drizzle/${file}`, import.meta.url), "utf8"));

  const totals = database.prepare(`SELECT COUNT(*) AS total,COUNT(DISTINCT target_language) AS languages,
    SUM(level='beginner') AS beginner,SUM(level='intermediate') AS intermediate,SUM(level='advanced') AS advanced,
    COUNT(DISTINCT stable_key || ':' || version) AS identities
    FROM smartlingo_vocabulary_items WHERE review_status='published'`).get();
  assert.deepEqual({ ...totals }, { total: 48000, languages: 12, beginner: 12000, intermediate: 18000, advanced: 18000, identities: 48000 });

  const perLanguage = database.prepare(`SELECT target_language AS language,
    SUM(level='beginner') AS beginner,SUM(level='intermediate') AS intermediate,SUM(level='advanced') AS advanced,
    COUNT(*) AS total FROM smartlingo_vocabulary_items WHERE review_status='published'
    GROUP BY target_language ORDER BY target_language`).all();
  assert.ok(perLanguage.every(row => row.beginner === 1000 && row.intermediate === 1500 && row.advanced === 1500 && row.total === 4000));

  const incomplete = database.prepare(`SELECT COUNT(*) AS count FROM smartlingo_vocabulary_items
    WHERE review_status='published' AND (
      trim(form)='' OR trim(meaning_en)='' OR trim(meaning_zh)='' OR trim(target_phonetic)=''
      OR trim(lexical_source_url)='' OR trim(lexical_source_license)='' OR trim(lexical_source_revision)='' OR trim(review_method)=''
      OR json_valid(pronunciation_guides)=0 OR json_type(pronunciation_guides)<>'object'
      OR trim(COALESCE(json_extract(pronunciation_guides,'$.zh'),''))=''
      OR trim(COALESCE(json_extract(pronunciation_guides,'$.en'),''))=''
      OR trim(COALESCE(json_extract(pronunciation_guides,'$.es'),''))=''
      OR trim(COALESCE(json_extract(pronunciation_guides,'$.ja'),''))=''
      OR trim(COALESCE(json_extract(pronunciation_guides,'$.ko'),''))=''
      OR trim(COALESCE(json_extract(pronunciation_guides,'$.fr'),''))=''
      OR trim(COALESCE(json_extract(pronunciation_guides,'$.de'),''))=''
      OR trim(COALESCE(json_extract(pronunciation_guides,'$.ru'),''))=''
      OR trim(COALESCE(json_extract(pronunciation_guides,'$.it'),''))=''
      OR trim(COALESCE(json_extract(pronunciation_guides,'$.pt'),''))=''
      OR trim(COALESCE(json_extract(pronunciation_guides,'$.ar'),''))=''
      OR trim(COALESCE(json_extract(pronunciation_guides,'$.hi'),''))=''
    )`).get();
  assert.equal(incomplete.count, 0);

  const generated = database.prepare(`SELECT COUNT(*) AS total,
    SUM(review_method LIKE '%automated-linguistic-validation' OR review_method LIKE 'jmdict-applicable-common-sense%') AS truthfullyLabeled,
    SUM(lexical_source_license NOT IN ('CC BY 4.0','CC BY-SA 4.0','WordNet 3.0 license; OMW 1.4 data license')) AS invalidLicense
    FROM smartlingo_vocabulary_items WHERE sequence>=29`).get();
  assert.deepEqual({ ...generated }, { total: 47664, truthfullyLabeled: 47664, invalidLicense: 0 });

  const everydayEnglish = database.prepare(`SELECT form,meaning_en AS meaningEn,meaning_zh AS meaningZh
    FROM smartlingo_vocabulary_items WHERE target_language='en' AND form IN ('in','be','can','see','day','come') ORDER BY form`).all();
  assert.deepEqual(everydayEnglish.map(row => [row.form, row.meaningZh]), [
    ["be", "是；存在；成为"], ["can", "能；可以"], ["come", "来；来到"],
    ["day", "一天；白天"], ["in", "在……里面；在……期间"], ["see", "看见；看到；明白"],
  ]);
  assert.equal(database.prepare(`SELECT COUNT(*) AS count FROM smartlingo_vocabulary_items
    WHERE target_language='en' AND review_status='published' AND (length(meaning_zh)>100 OR meaning_zh GLOB '*\\\\*')`).get().count, 0);

  const japaneseBeginner = database.prepare(`SELECT COUNT(*) AS total,
    SUM(length(meaning_zh)>50 OR meaning_zh LIKE '%QQ%' OR trim(meaning_zh)='') AS unsafe,
    SUM(lexical_source_url='https://www.edrdg.org/wiki/index.php/JMdict-EDICT_Dictionary_Project') AS jmdict
    FROM smartlingo_vocabulary_items WHERE target_language='ja' AND level='beginner' AND review_status='published'`).get();
  assert.deepEqual({ ...japaneseBeginner }, { total: 1000, unsafe: 0, jmdict: 972 });
  const japaneseExamples = database.prepare(`SELECT form,meaning_en AS meaningEn,meaning_zh AS meaningZh
    FROM smartlingo_vocabulary_items WHERE target_language='ja' AND level='beginner'
    AND form IN ('家','ここ','紹介','せ','たち') ORDER BY form`).all();
  assert.deepEqual(japaneseExamples.map(row => [row.form, row.meaningEn, row.meaningZh]), [
    ["ここ", "here; this place, area, or part (near the speaker) (Can be juxtaposed with a phrase with で (de) or に (ni).)", "这里"],
    ["せ", "causative verb stem (make; let)", "让；使（动词变化的一部分）"],
    ["たち", "plural suffix for people", "……们（复数后缀）"],
    ["家", "a house", "家；房屋"],
    ["紹介", "introduction; introducing someone", "介绍；引见"],
  ]);
  const excludedJapaneseForms = ["M", "S", "L", "CM", "V", "G", "U", "OK", "PC", "DVD"];
  const placeholders = excludedJapaneseForms.map(() => "?").join(",");
  assert.equal(database.prepare(`SELECT COUNT(*) AS count FROM smartlingo_vocabulary_items
    WHERE target_language='ja' AND level='beginner' AND form IN (${placeholders})`).get(...excludedJapaneseForms).count, 0);
  assert.equal(database.prepare(`SELECT COUNT(*) AS count FROM smartlingo_vocabulary_items
    WHERE target_language='ja' AND level='beginner' AND review_status='published'
    AND (meaning_zh GLOB '*思维；思维*' OR meaning_zh GLOB '*感觉；感觉*')`).get().count, 0);

  const curatedBeginnerGlosses = database.prepare(`SELECT target_language AS language,form,meaning_en AS meaningEn,meaning_zh AS meaningZh
    FROM smartlingo_vocabulary_items
    WHERE (target_language='es' AND form='presidente')
       OR (target_language='it' AND form IN ('davvero','nessuno','nuova'))
    ORDER BY target_language,form`).all();
  assert.deepEqual(curatedBeginnerGlosses.map(row => [row.language, row.form, row.meaningEn, row.meaningZh]), [
    ["es", "presidente", "president; chairperson; leader", "总统；主席；负责人"],
    ["it", "davvero", "really; truly; in fact", "真的；确实；事实上"],
    ["it", "nessuno", "no one; nobody; none", "没有人；没有任何一个"],
    ["it", "nuova", "new (feminine singular); news", "新的（阴性单数）；消息"],
  ]);
  database.close();
});

test("the Japanese correction is forward-only, reproducible, and source-attributed", () => {
  const sql = readFileSync(new URL(`../drizzle/${japaneseCorrectionFile}`, import.meta.url), "utf8");
  const builder = readFileSync(new URL("../scripts/build-japanese-gloss-correction.py", import.meta.url), "utf8");
  assert.equal((sql.match(/UPDATE smartlingo_vocabulary_items SET /g) || []).length, 972);
  assert.match(sql, /EDRDG JMdict_e, CC BY-SA 4\.0/);
  assert.match(builder, /build_jmdict_index/);
  assert.match(builder, /applicable_gloss/);
  assert.doesNotMatch(builder, /write_text\([^)]*0135/);
});
