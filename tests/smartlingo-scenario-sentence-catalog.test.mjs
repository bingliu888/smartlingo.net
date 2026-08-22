import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import {
  SMARTLINGO_SENTENCE_CONTENT_VERSION,
  buildCourseSentenceBank,
  tokenizeSentence,
} from "../lib/smartlingo-sentence-exercises.ts";

const languages = ["zh", "en", "es", "ja", "ko", "fr", "de", "ru", "it", "pt", "ar", "hi"];
const levels = ["beginner", "intermediate", "advanced"];
const sql = readFileSync(new URL("../drizzle/0156_graded_scenario_sentence_catalog.sql", import.meta.url), "utf8");

function catalog() {
  const database = new DatabaseSync(":memory:");
  database.exec(sql);
  return database;
}

test("graded scenario catalog contains 4,320 published rows with complete course coverage", () => {
  const database = catalog();
  const totals = database.prepare(`SELECT COUNT(*) AS total,COUNT(DISTINCT target_language) AS languages,
    COUNT(DISTINCT target_language || ':' || level) AS courses,COUNT(DISTINCT scenario_key) AS scenarios,
    COUNT(DISTINCT function_key) AS functions,SUM(review_status='published') AS published,
    SUM(json_array_length(answer_tokens)>=2) AS tokenized
    FROM smartlingo_scenario_sentences WHERE content_version=?`).get(SMARTLINGO_SENTENCE_CONTENT_VERSION);
  assert.deepEqual({ ...totals }, { total: 4320, languages: 12, courses: 36, scenarios: 12, functions: 10, published: 4320, tokenized: 4320 });

  const courses = database.prepare(`SELECT target_language AS language,level,COUNT(*) AS count,
    COUNT(DISTINCT scenario_key) AS scenarios,MIN(sequence) AS firstSequence,MAX(sequence) AS lastSequence
    FROM smartlingo_scenario_sentences GROUP BY target_language,level ORDER BY target_language,level`).all();
  assert.equal(courses.length, 36);
  assert.ok(courses.every(row => row.count === 120 && row.scenarios === 12 && row.firstSequence === 1 && row.lastSequence === 120));
});

test("each level is a genuinely distinct progression rather than a courtesy-prefix duplicate", () => {
  const database = catalog();
  for (const language of languages) {
    const rows = database.prepare(`SELECT level,AVG(json_array_length(answer_tokens)) AS averageTokens,
      COUNT(DISTINCT target_sentence) AS uniqueSentences FROM smartlingo_scenario_sentences
      WHERE target_language=? GROUP BY level`).all(language);
    const byLevel = Object.fromEntries(rows.map(row => [row.level, row]));
    assert.equal(byLevel.beginner.uniqueSentences, 120, language);
    assert.equal(byLevel.intermediate.uniqueSentences, 120, language);
    assert.equal(byLevel.advanced.uniqueSentences, 120, language);
    assert.ok(byLevel.intermediate.averageTokens > byLevel.beginner.averageTokens, `${language}: intermediate must add discourse work`);
    assert.ok(byLevel.advanced.averageTokens > byLevel.intermediate.averageTokens, `${language}: advanced must add complex constraints`);
  }
  assert.equal(database.prepare(`SELECT COUNT(*) AS count FROM smartlingo_scenario_sentences a
    JOIN smartlingo_scenario_sentences b ON b.target_language=a.target_language AND b.sequence=a.sequence AND b.level<>a.level
    WHERE a.target_sentence=b.target_sentence`).get().count, 0);
});

test("database rows exactly mirror the runtime sentence builder used by listening and writing UI", () => {
  const database = catalog();
  for (const language of languages) for (const level of levels) {
    const runtime = buildCourseSentenceBank(language, level);
    const stored = database.prepare(`SELECT id,target_sentence AS targetSentence,translation_zh AS translationZh,
      translation_en AS translationEn,answer_tokens AS answerTokens,difficulty,frequency_degree AS frequencyDegree,
      sequence,scenario_key AS scenario,function_key AS functionId,cefr_band AS cefrBand
      FROM smartlingo_scenario_sentences WHERE target_language=? AND level=? ORDER BY sequence`).all(language, level);
    assert.equal(stored.length, runtime.length);
    runtime.forEach((item, index) => assert.deepEqual({ ...stored[index], answerTokens: JSON.parse(stored[index].answerTokens) }, {
      id: item.id,
      targetSentence: item.targetSentence,
      translationZh: item.translation.zh,
      translationEn: item.translation.en,
      answerTokens: tokenizeSentence(item.targetSentence, language),
      difficulty: item.difficulty,
      frequencyDegree: item.frequencyDegree,
      sequence: item.sequence,
      scenario: item.scenario,
      functionId: item.functionId,
      cefrBand: item.cefrBand,
    }));
  }
});

test("sentence-builder UI supports both heard-sentence and translated-prompt word matching", () => {
  const source = readFileSync(new URL("../components/SentenceBuilderRound.tsx", import.meta.url), "utf8");
  assert.match(source, /mode: "listening" \| "writing"/);
  assert.match(source, /Build what you hear/);
  assert.match(source, /Build this sentence in the language you are learning/);
  assert.match(source, /setSelected\(current => \[\.\.\.current, tile\.id\]\)/);
  assert.match(source, /Correct answer:/);
});
