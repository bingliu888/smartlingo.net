import assert from "node:assert/strict";
import test from "node:test";
import { SMARTLINGO_EVERYDAY_DIALOGUE_BRIEFS, SMARTLINGO_EVERYDAY_SCENE_LEVEL_BRIEFS, everydayDialogueLines, prebuiltEverydayDialogueLines, validatedDialogueLines } from "../lib/smartlingo-everyday-dialogues.ts";
import { buildEverydaySpeakingDeckFromDatabase } from "../lib/smartlingo-everyday-speaking.ts";

function fakeDatabase(initialCache = null) {
  let cache = initialCache;
  let writes = 0;
  let cacheReads = 0;
  return {
    get writes() { return writes; },
    get cacheReads() { return cacheReads; },
    prepare(sql) {
      let values = [];
      return {
        bind(...next) { values = next; return this; },
        async first() {
          if (sql.includes("smartlingo_learning_content_releases")) return { releaseId: "test-release" };
          if (sql.includes("smartlingo_everyday_dialogue_sets")) { cacheReads += 1; return cache; }
          throw new Error(`Unexpected query: ${sql}`);
        },
        async run() {
          if (!sql.includes("smartlingo_everyday_dialogue_sets") || values.length !== 8) throw new Error("Unexpected write");
          cache = { payloadJson: values[5], sourceType: values[6] };
          writes += 1;
          return { success: true };
        },
      };
    },
  };
}

const localizedPairs = () => JSON.stringify(Array.from({ length: 10 }, (_, index) => ({
  pair: index + 1,
  question: `ご注文は何ですか${index}。`,
  answer: `コーヒーをお願いします${index}。`,
})));

test("authored scene meaning and pair order form the localization contract", () => {
  const source = SMARTLINGO_EVERYDAY_DIALOGUE_BRIEFS.cafe;
  const localized = source.flatMap((pair, pairIndex) => [
    { role: "staff", target: `ご注文は何ですか${pairIndex}。`, meaningEn: pair[0], meaningZh: pair[2], pairIndex },
    { role: "learner", target: `コーヒーをお願いします${pairIndex}。`, meaningEn: pair[1], meaningZh: pair[3], pairIndex },
  ]);
  assert.equal(validatedDialogueLines(localized, source, "ja"), true);
  assert.equal(validatedDialogueLines(localized, source, "es"), false);
  assert.equal(validatedDialogueLines(localized.map((line, index) => index === 1 ? { ...line, pairIndex: 4 } : line), source, "ja"), false);
  assert.equal(validatedDialogueLines(localized.map((line, index) => index === 1 ? { ...line, meaningEn: "Where is the café?" } : line), source, "ja"), false);
  assert.equal(validatedDialogueLines(localized.map((line, index) => index === 0 ? { ...line, target: "Where is the café?" } : line), source, "ja"), false);
  assert.equal(validatedDialogueLines(localized.map((line, index) => index === 1 ? { ...line, target: localized[3].target } : line), source, "ja"), false);
});

test("only the authored Japanese beginner cafe and grocery are prebuilt beyond English and Chinese", () => {
  assert.equal(prebuiltEverydayDialogueLines("cafe", "ja", "beginner").length, 20);
  assert.equal(prebuiltEverydayDialogueLines("grocery", "ja", "beginner").length, 20);
  assert.equal(prebuiltEverydayDialogueLines("cafe", "ja", "intermediate").length, 0);
  assert.equal(prebuiltEverydayDialogueLines("grocery", "ja", "intermediate").length, 0);
  assert.equal(prebuiltEverydayDialogueLines("grocery", "es", "intermediate").length, 0);
  assert.equal(prebuiltEverydayDialogueLines("cafe", "zh", "beginner").length, 20);
  assert.equal(prebuiltEverydayDialogueLines("cafe", "en", "advanced").length, 20);
});

test("Japanese beginner cafe retains task semantics and loads without AI or localization cache", async () => {
  const source = SMARTLINGO_EVERYDAY_DIALOGUE_BRIEFS.cafe;
  const lines = prebuiltEverydayDialogueLines("cafe", "ja", "beginner");
  assert.equal(validatedDialogueLines(lines, source, "ja"), true);
  assert.deepEqual(lines.map(line => line.role), Array.from({ length: 10 }, () => ["staff", "learner"]).flat());
  assert.deepEqual(lines.map(line => line.pairIndex), Array.from({ length: 10 }, (_, index) => [index, index]).flat());
  assert.deepEqual(lines.map(line => line.meaningEn), source.flatMap(pair => [pair[0], pair[1]]));
  assert.deepEqual(lines.map(line => line.meaningZh), source.flatMap(pair => [pair[2], pair[3]]));
  const taskTerms = [/コーヒー/, /ホット/, /牛乳/, /砂糖/, /サンドイッチ/, /店内/, /アンナ/, /カード/, /合って/, /よい一日/];
  for (const [index, term] of taskTerms.entries()) {
    assert.match(lines[index * 2 + 1].target, term, `learner response ${index + 1} must answer its cafe task`);
  }
  assert.ok(lines.every(line => !/カフェはどこ|喫茶店はどこ/.test(line.target)), "do not ask where the cafe is while ordering inside it");
  const database = fakeDatabase({ payloadJson: "not JSON", sourceType: "safe-fallback" });
  const result = await everydayDialogueLines({ database, sceneId: "cafe", language: "ja", level: "beginner", localize: async () => { throw new Error("AI must not be used"); } });
  assert.equal(result.sourceType, "prebuilt");
  assert.deepEqual(result.lines, lines);
  assert.equal(database.cacheReads, 0);
  assert.equal(database.writes, 0);
  const deck = await buildEverydaySpeakingDeckFromDatabase({ database, sceneId: "cafe", language: "ja", level: "beginner" });
  assert.equal(deck.filter(item => item.kind === "sentence").length, 20);
  assert.deepEqual(deck.filter(item => item.kind === "sentence").map(item => item.form), lines.map(line => line.target));
  assert.ok(deck.some(item => item.kind === "word" && item.form === "コーヒー"));
});

test("Japanese beginner grocery completes ten actual shopping exchanges offline", async () => {
  const source = SMARTLINGO_EVERYDAY_DIALOGUE_BRIEFS.grocery;
  const lines = prebuiltEverydayDialogueLines("grocery", "ja", "beginner");
  assert.equal(validatedDialogueLines(lines, source, "ja"), true);
  assert.deepEqual(lines.map(line => line.role), Array.from({ length: 10 }, () => ["staff", "learner"]).flat());
  assert.deepEqual(lines.map(line => line.pairIndex), Array.from({ length: 10 }, (_, index) => [index, index]).flat());
  assert.deepEqual(lines.map(line => line.meaningEn), source.flatMap(pair => [pair[0], pair[1]]));
  assert.deepEqual(lines.map(line => line.meaningZh), source.flatMap(pair => [pair[2], pair[3]]));
  const shoppingAnswers = [/卵/, /茶色い卵/, /半キロ/, /新鮮な野菜/, /四個/, /エコバッグ/, /持っていません/, /クーポン/, /カード/, /袋に入れて/];
  for (const [index, expected] of shoppingAnswers.entries()) {
    assert.match(lines[index * 2 + 1].target, expected, `shopping answer ${index + 1} must address its staff question`);
  }
  assert.ok(lines.every(line => !/食料品店はどこ|スーパーはどこ/.test(line.target)), "do not ask where the grocery store is after entering it");
  const database = fakeDatabase({ payloadJson: "invalid JSON", sourceType: "safe-fallback" });
  const localized = await everydayDialogueLines({ database, sceneId: "grocery", language: "ja", level: "beginner", localize: async () => { throw new Error("AI must not be called"); } });
  assert.equal(localized.sourceType, "prebuilt");
  assert.deepEqual(localized.lines, lines);
  assert.equal(database.cacheReads, 0);
  assert.equal(database.writes, 0);
  const deck = await buildEverydaySpeakingDeckFromDatabase({ database, sceneId: "grocery", language: "ja", level: "beginner" });
  assert.equal(deck.filter(item => item.kind === "sentence").length, 20);
  assert.deepEqual(deck.filter(item => item.kind === "sentence").map(item => item.form), lines.map(line => line.target));
  for (const word of ["卵", "肉", "野菜"]) assert.ok(deck.some(item => item.kind === "word" && item.form === word));
});

test("localization failure and stale fallback cache never create or serve mismatched lessons", async () => {
  const database = fakeDatabase({ payloadJson: JSON.stringify(prebuiltEverydayDialogueLines("cafe", "en", "beginner")), sourceType: "safe-fallback" });
  await assert.rejects(() => everydayDialogueLines({ database, sceneId: "cafe", language: "ja", level: "intermediate", localize: async () => "" }), /localization is unavailable/);
  assert.equal(database.writes, 0);
  await assert.rejects(() => everydayDialogueLines({ database, sceneId: "cafe", language: "ja", level: "intermediate", localize: async () => JSON.stringify([{ pair: 2, question: "こんにちは", answer: "はい" }]) }), /localization is unavailable/);
  assert.equal(database.writes, 0);
});

test("validated target-language pairs are cached and reused without a second AI call", async () => {
  const database = fakeDatabase();
  const first = await everydayDialogueLines({ database, sceneId: "cafe", language: "ja", level: "intermediate", localize: async () => localizedPairs() });
  assert.equal(first.lines.length, 20);
  assert.equal(first.lines[0].meaningEn, SMARTLINGO_EVERYDAY_SCENE_LEVEL_BRIEFS.cafe.intermediate[0][0]);
  assert.equal(database.writes, 1);
  const second = await everydayDialogueLines({ database, sceneId: "cafe", language: "ja", level: "intermediate", localize: async () => { throw new Error("AI must not be called"); } });
  assert.deepEqual(second.lines, first.lines);
  assert.equal(database.writes, 1);
});
