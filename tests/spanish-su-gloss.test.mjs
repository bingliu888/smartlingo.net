import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

test("Spanish su correction is language-scoped and idempotent", () => {
  const db = new DatabaseSync(":memory:");
  db.exec(`CREATE TABLE smartlingo_vocabulary_items(id TEXT, target_language TEXT, form TEXT, meaning_en TEXT, meaning_zh TEXT, updated_at INTEGER);
    INSERT INTO smartlingo_vocabulary_items VALUES ('es-su','es','su','apocopic form of suyo','incorrect gloss',1),('it-su','it','su','on','在上面',1);`);
  const migration = readFileSync(new URL("../drizzle/0183_spanish_su_possessive_gloss.sql", import.meta.url), "utf8");
  db.exec(migration);
  const select = () => db.prepare("SELECT id, meaning_en, meaning_zh, updated_at FROM smartlingo_vocabulary_items WHERE target_language='es' AND lower(form)='su'").all();
  const before = select();
  assert.ok(before.length > 0);
  for (const row of before) {
    assert.equal(row.meaning_en, "his; her; its; their; your (formal, before a noun)");
    assert.equal(row.meaning_zh, "他的；她的；它的；他们的；您的（用于名词前）");
  }
  assert.equal(db.prepare("SELECT meaning_zh FROM smartlingo_vocabulary_items WHERE id='it-su'").get().meaning_zh, "在上面");
  db.exec(migration);
  assert.deepEqual(select(), before);
  db.close();
});
