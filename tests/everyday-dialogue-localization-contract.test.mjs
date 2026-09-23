import assert from "node:assert/strict";
import test from "node:test";
import { SMARTLINGO_EVERYDAY_DIALOGUE_BRIEFS, everydayDialogueLines, prebuiltEverydayDialogueLines, validatedDialogueLines } from "../lib/smartlingo-everyday-dialogues.ts";

function fakeDatabase(initialCache = null) {
  let cache = initialCache;
  let writes = 0;
  return {
    get writes() { return writes; },
    prepare(sql) {
      let values = [];
      return {
        bind(...next) { values = next; return this; },
        async first() {
          if (sql.includes("smartlingo_learning_content_releases")) return { releaseId: "test-release" };
          if (sql.includes("smartlingo_everyday_dialogue_sets")) return cache;
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

test("prebuilt non-English/Chinese dialogue is unavailable instead of teaching unrelated navigation", () => {
  assert.equal(prebuiltEverydayDialogueLines("cafe", "ja", "beginner").length, 0);
  assert.equal(prebuiltEverydayDialogueLines("grocery", "es", "intermediate").length, 0);
  assert.equal(prebuiltEverydayDialogueLines("cafe", "zh", "beginner").length, 20);
  assert.equal(prebuiltEverydayDialogueLines("cafe", "en", "advanced").length, 20);
});

test("localization failure and stale fallback cache never create or serve mismatched lessons", async () => {
  const database = fakeDatabase({ payloadJson: JSON.stringify(prebuiltEverydayDialogueLines("cafe", "en", "beginner")), sourceType: "safe-fallback" });
  await assert.rejects(() => everydayDialogueLines({ database, sceneId: "cafe", language: "ja", level: "beginner", localize: async () => "" }), /localization is unavailable/);
  assert.equal(database.writes, 0);
  await assert.rejects(() => everydayDialogueLines({ database, sceneId: "cafe", language: "ja", level: "beginner", localize: async () => JSON.stringify([{ pair: 2, question: "こんにちは", answer: "はい" }]) }), /localization is unavailable/);
  assert.equal(database.writes, 0);
});

test("validated target-language pairs are cached and reused without a second AI call", async () => {
  const database = fakeDatabase();
  const first = await everydayDialogueLines({ database, sceneId: "cafe", language: "ja", level: "beginner", localize: async () => localizedPairs() });
  assert.equal(first.lines.length, 20);
  assert.equal(first.lines[0].meaningEn, SMARTLINGO_EVERYDAY_DIALOGUE_BRIEFS.cafe[0][0]);
  assert.equal(database.writes, 1);
  const second = await everydayDialogueLines({ database, sceneId: "cafe", language: "ja", level: "beginner", localize: async () => { throw new Error("AI must not be called"); } });
  assert.deepEqual(second.lines, first.lines);
  assert.equal(database.writes, 1);
});
