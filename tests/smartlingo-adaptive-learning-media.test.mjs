import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import { SMARTLINGO_GENERATED_LEARNING_MEDIA, SMARTLINGO_SCENE_MEDIA_POLICY } from "../lib/smartlingo-learning-media.ts";
import { BEGINNER_VOCABULARY_IMAGE_KEYS, beginnerVocabularyImageKey } from "../lib/smartlingo-vocabulary-images.ts";

const read = path => readFile(new URL(path, import.meta.url), "utf8");

test("beginner picture choices use a reviewed original AI asset with multilingual matching", async () => {
  const asset = SMARTLINGO_GENERATED_LEARNING_MEDIA[0];
  assert.equal(asset.generationSource, "openai-image-generation");
  assert.equal(asset.humanReview, "approved");
  assert.deepEqual([...asset.subjects], [...BEGINNER_VOCABULARY_IMAGE_KEYS]);
  await access(new URL(`../public${asset.assetPath}`, import.meta.url));
  assert.equal(beginnerVocabularyImageKey("卵", "鸡蛋"), "egg");
  assert.equal(beginnerVocabularyImageKey("acqua", "water"), "water");
  assert.equal(beginnerVocabularyImageKey("蔬菜"), "vegetables");
  assert.ok(SMARTLINGO_SCENE_MEDIA_POLICY.requirements.some(item => item.includes("fallback")));
});

test("adaptive sentences are Luna-governed, cumulative, cached in D1, and release-stamped after deployment", async () => {
  const [service, migration, workflow, sprintRoute, vocabularyRoute] = await Promise.all([
    read("../lib/smartlingo-adaptive-sentences.ts"),
    read("../drizzle/0161_adaptive_learning_content.sql"),
    read("../.github/workflows/deploy-cloudflare.yml"),
    read("../app/api/classes/[classId]/sprint/route.ts"),
    read("../app/api/classes/[classId]/vocabulary/route.ts"),
  ]);
  assert.match(service, /feature: "content_help"/);
  assert.match(service, /input\.roundVocabulary\.slice\(0, index \+ 1\)\.flat\(\)/);
  assert.match(service, /only content words from that round's allowedWords/);
  assert.match(service, /safe-fallback/);
  assert.match(migration, /smartlingo_learning_content_releases/);
  assert.match(migration, /smartlingo_adaptive_sentence_sets/);
  assert.match(migration, /smartlingo_learning_media_assets/);
  assert.match(workflow, /Stamp adaptive learning release/);
  assert.match(workflow, /GITHUB_SHA/);
  assert.ok(workflow.indexOf("Deploy Worker") < workflow.indexOf("Stamp adaptive learning release"));
  assert.match(sprintRoute, /adaptiveSentenceRounds/);
  assert.match(vocabularyRoute, /adaptiveSentenceRounds/);
  assert.match(vocabularyRoute, /learningReleaseId/);
  assert.match(vocabularyRoute, /sentenceSource/);
});

test("all unified learning players auto-score choices and reserve Continue for feedback", async () => {
  const [sprint, smartCard, vocabulary, sentenceBuilder] = await Promise.all([
    read("../components/DailySprint.tsx"),
    read("../components/PublicSmartCardChallenge.tsx"),
    read("../components/VocabularyMemoryWorkspace.tsx"),
    read("../components/SentenceBuilderRound.tsx"),
  ]);
  assert.match(sprint, /onClick=\{\(\) => chooseVocabulary\(option\.id\)\}/);
  assert.doesNotMatch(sprint, /onClick=\{checkVocabulary\}/);
  assert.doesNotMatch(sprint, /onClick=\{checkReading\}/);
  assert.match(smartCard, /selectedAnswerId&&!answerChecked&&!busy/);
  assert.match(smartCard, /6000/);
  assert.match(vocabulary, /selectedOptionId && phase === "answer"/);
  assert.match(sentenceBuilder, /answerTokens/);
});
