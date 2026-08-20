import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { applyTrackedMigrations, readMigrationManifest } from "../scripts/validate-d1-migrations.mjs";

const supportedLanguages = ["zh", "en", "es", "ja", "ko", "fr", "de", "ru", "it", "pt", "ar", "hi"];
const catalogFiles = readdirSync(new URL("../drizzle/", import.meta.url))
  .filter(name => /^01(?:3[2-9]|4[0-3])_.+_vocabulary_catalog\.sql$/.test(name))
  .sort();

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
    SUM(review_method LIKE '%automated-linguistic-validation') AS truthfullyLabeled,
    SUM(lexical_source_license NOT IN ('CC BY 4.0','CC BY-SA 4.0')) AS invalidLicense
    FROM smartlingo_vocabulary_items WHERE sequence>=29`).get();
  assert.deepEqual({ ...generated }, { total: 47664, truthfullyLabeled: 47664, invalidLicense: 0 });
  database.close();
});
