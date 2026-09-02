import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import { SMARTLINGO_EVERYDAY_MOTION_MEDIA, SMARTLINGO_GENERATED_LEARNING_MEDIA, SMARTLINGO_SCENE_MEDIA_POLICY, SMARTLINGO_SEMANTIC_FALLBACK_MEDIA, SMARTLINGO_SEMANTIC_LEARNING_MEDIA } from "../lib/smartlingo-learning-media.ts";
import { BEGINNER_SEMANTIC_CONCEPTS } from "../lib/smartlingo-semantic-media-catalog.ts";
import { BEGINNER_VOCABULARY_IMAGE_KEYS, beginnerVocabularyImageKey, beginnerVocabularySpriteSize, beginnerVocabularySpriteSource } from "../lib/smartlingo-vocabulary-images.ts";

const read = path => readFile(new URL(path, import.meta.url), "utf8");

test("beginner picture choices use a reviewed original AI asset with multilingual matching", async () => {
  assert.equal(SMARTLINGO_GENERATED_LEARNING_MEDIA.length, 6);
  for (const asset of SMARTLINGO_GENERATED_LEARNING_MEDIA) {
    assert.equal(asset.generationSource, "openai-image-generation");
    assert.equal(asset.humanReview, "approved");
    await access(new URL(`../public${asset.assetPath}`, import.meta.url));
  }
  assert.deepEqual(SMARTLINGO_GENERATED_LEARNING_MEDIA.flatMap(asset => [...asset.subjects]), [...BEGINNER_VOCABULARY_IMAGE_KEYS]);
  assert.equal(beginnerVocabularyImageKey("卵", "鸡蛋"), "egg");
  assert.equal(beginnerVocabularyImageKey("acqua", "water"), "water");
  assert.equal(beginnerVocabularyImageKey("蔬菜"), "vegetables");
  assert.equal(beginnerVocabularyImageKey("こんにちは", "你好"), "hello");
  assert.equal(beginnerVocabularyImageKey("すみません", "对不起"), "sorry");
  assert.equal(beginnerVocabularyImageKey("woman", "女人"), "woman");
  assert.equal(beginnerVocabularyImageKey("this", "this thing"), null);
  assert.equal(beginnerVocabularyImageKey("notebookish", "a notebookish color"), null);
  assert.ok(beginnerVocabularyImageKey("作家", "writer"));
  assert.equal(beginnerVocabularyImageKey("no", "不"), "no");
  assert.equal(beginnerVocabularyImageKey("airport", "机场"), "airport");
  assert.equal(beginnerVocabularyImageKey("receipt", "收据"), "receipt");
  assert.equal(beginnerVocabularyImageKey("the", "the definite article"), "the");
  assert.equal(SMARTLINGO_SEMANTIC_LEARNING_MEDIA.length, 28);
  assert.equal(SMARTLINGO_SEMANTIC_FALLBACK_MEDIA.length, 158);
  assert.equal(BEGINNER_SEMANTIC_CONCEPTS.length, 6677);
  assert.equal(SMARTLINGO_SEMANTIC_LEARNING_MEDIA.flatMap(asset => asset.subjects).length, 1000);
  assert.equal(SMARTLINGO_SEMANTIC_FALLBACK_MEDIA.flatMap(asset => asset.subjects).length, 5677);
  for (const asset of [...SMARTLINGO_SEMANTIC_LEARNING_MEDIA, ...SMARTLINGO_SEMANTIC_FALLBACK_MEDIA]) {
    assert.equal(asset.humanReview, "approved");
    await access(new URL(`../public${asset.assetPath}`, import.meta.url));
  }
  const sharedTime = beginnerVocabularyImageKey("Zeit", "time", "时间");
  const rareWriter = beginnerVocabularyImageKey("作家", "writer", "作家");
  assert.ok(sharedTime);
  assert.ok(rareWriter);
  assert.equal(beginnerVocabularySpriteSize(sharedTime), "600% 600%");
  assert.equal(beginnerVocabularySpriteSize(rareWriter), "600% 600%");
  assert.match(beginnerVocabularySpriteSource(sharedTime), /beginner-semantic-vocabulary-sprite-/);
  assert.match(beginnerVocabularySpriteSource(rareWriter), /beginner-semantic-fallback-sprite-|beginner-semantic-vocabulary-sprite-/);
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
  assert.match(service, /timeoutMs: 6_000/);
  assert.match(vocabularyRoute, /cachedAdaptiveSentenceRounds[\s\S]*\.catch\(\(\) => null\)/);
  assert.doesNotMatch(vocabularyRoute, /await adaptiveSentenceRounds/);
  assert.match(vocabularyRoute, /missing AI-generated cache must never hold the interactive vocabulary/);
  assert.match(migration, /smartlingo_learning_content_releases/);
  assert.match(migration, /smartlingo_adaptive_sentence_sets/);
  assert.match(migration, /smartlingo_learning_media_assets/);
  assert.match(workflow, /Stamp adaptive learning and everyday dialogue releases/);
  assert.match(workflow, /GITHUB_SHA/);
  assert.ok(workflow.indexOf("Deploy Worker") < workflow.indexOf("Stamp adaptive learning and everyday dialogue releases"));
  assert.match(sprintRoute, /adaptiveSentenceRounds/);
  assert.match(vocabularyRoute, /cachedAdaptiveSentenceRounds/);
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

test("everyday speaking supports ten dynamic conversation media per place with a static fallback", async () => {
  const [catalog, player] = await Promise.all([
    read("../lib/smartlingo-everyday-speaking.ts"),
    read("../components/EverydaySpeakingPlayer.tsx"),
  ]);
  assert.match(catalog, /motionMedia: Array\.from\(\{ length: 10 \}/);
  assert.match(player, /scene\.motionMedia/);
  assert.match(player, /Math\.floor\(Math\.max\(0, sentenceIndex\) \/ 2\)/);
  assert.match(player, /: scene\.image/);
  assert.equal(SMARTLINGO_EVERYDAY_MOTION_MEDIA.length, 12);
  for (const media of SMARTLINGO_EVERYDAY_MOTION_MEDIA) {
    assert.equal(media.paths.length, 10);
    assert.equal(media.humanReview, "approved");
    for (const path of media.paths) await access(new URL(`../public${path}`, import.meta.url));
  }
});
