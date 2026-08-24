import {
  BEGINNER_OBJECT_IMAGE_KEYS,
  BEGINNER_CONCEPT_IMAGE_KEYS,
  BEGINNER_CONCEPT_VOCABULARY_SPRITE,
  BEGINNER_GRAMMAR_IMAGE_KEYS,
  BEGINNER_GRAMMAR_VOCABULARY_SPRITE,
  BEGINNER_PRACTICAL_IMAGE_KEYS,
  BEGINNER_PRACTICAL_VOCABULARY_SPRITE,
  BEGINNER_RELATIONSHIP_IMAGE_KEYS,
  BEGINNER_RELATIONSHIP_VOCABULARY_SPRITE,
  BEGINNER_SOCIAL_IMAGE_KEYS,
  BEGINNER_SOCIAL_VOCABULARY_SPRITE,
  BEGINNER_VOCABULARY_SPRITE,
} from "./smartlingo-vocabulary-images.ts";
import { BEGINNER_SEMANTIC_CONCEPTS } from "./smartlingo-semantic-media-catalog.ts";

export const SMARTLINGO_GENERATED_LEARNING_MEDIA = [{
  assetKey: "beginner-vocabulary-sprite-2026-08-23",
  assetPath: BEGINNER_VOCABULARY_SPRITE,
  mediaKind: "image-sprite",
  generationSource: "openai-image-generation",
  generatedAt: "2026-08-23",
  releaseId: "bootstrap-2026-08-23",
  subjects: BEGINNER_OBJECT_IMAGE_KEYS,
  promptSummary: "Original SmartLingo 4x4 educational picture-choice sprite with isolated concrete objects, consistent polished 3D-flat visual language, no text, logos, or third-party characters.",
  humanReview: "approved",
}, {
  assetKey: "beginner-social-vocabulary-sprite-2026-08-23",
  assetPath: BEGINNER_SOCIAL_VOCABULARY_SPRITE,
  mediaKind: "image-sprite",
  generationSource: "openai-image-generation",
  generatedAt: "2026-08-23",
  releaseId: "bootstrap-2026-08-23",
  subjects: BEGINNER_SOCIAL_IMAGE_KEYS,
  promptSummary: "Original SmartLingo 4x4 educational picture-choice sprite for greetings, polite actions, people, family, and daily essentials; expressive human scenes, no text, logos, or third-party characters.",
  humanReview: "approved",
}, {
  assetKey: "beginner-practical-vocabulary-sprite-2026-08-23",
  assetPath: BEGINNER_PRACTICAL_VOCABULARY_SPRITE,
  mediaKind: "image-sprite",
  generationSource: "openai-image-generation",
  generatedAt: "2026-08-23",
  releaseId: "bootstrap-2026-08-23",
  subjects: BEGINNER_PRACTICAL_IMAGE_KEYS,
  promptSummary: "Original SmartLingo 4x4 practical beginner sprite for introductions, travel, directions, food choices, and payment tasks; no text, logos, or third-party characters.",
  humanReview: "approved",
}, {
  assetKey: "beginner-grammar-vocabulary-sprite-2026-08-23",
  assetPath: BEGINNER_GRAMMAR_VOCABULARY_SPRITE,
  mediaKind: "image-sprite",
  generationSource: "openai-image-generation",
  generatedAt: "2026-08-23",
  releaseId: "bootstrap-2026-08-23",
  subjects: BEGINNER_GRAMMAR_IMAGE_KEYS,
  promptSummary: "Original SmartLingo 4x4 semantic micro-scene sprite for urgent real-life roles, spatial relations, pronouns, and essential grammar support.",
  humanReview: "approved",
}, {
  assetKey: "beginner-relationship-vocabulary-sprite-2026-08-23",
  assetPath: BEGINNER_RELATIONSHIP_VOCABULARY_SPRITE,
  mediaKind: "image-sprite",
  generationSource: "openai-image-generation",
  generatedAt: "2026-08-23",
  releaseId: "bootstrap-2026-08-23",
  subjects: BEGINNER_RELATIONSHIP_IMAGE_KEYS,
  promptSummary: "Original SmartLingo 4x4 relationship and contrast micro-scene sprite; concrete ownership, grouping, direction, time, and choice cues.",
  humanReview: "approved",
}, {
  assetKey: "beginner-concept-vocabulary-sprite-2026-08-23",
  assetPath: BEGINNER_CONCEPT_VOCABULARY_SPRITE,
  mediaKind: "image-sprite",
  generationSource: "openai-image-generation",
  generatedAt: "2026-08-23",
  releaseId: "bootstrap-2026-08-23",
  subjects: BEGINNER_CONCEPT_IMAGE_KEYS,
  promptSummary: "Original SmartLingo 4x4 concept and action micro-scene sprite for quantity, ability, condition, preference, topic, and movement.",
  humanReview: "approved",
}] as const;

export const SMARTLINGO_SEMANTIC_LEARNING_MEDIA = Array.from({ length: 28 }, (_, sheetIndex) => {
  const sheet = sheetIndex + 1;
  const subjects = BEGINNER_SEMANTIC_CONCEPTS
    .filter(concept => concept.mediaTier === "ai" && concept.sheet === sheet)
    .map(concept => concept.key);
  return {
    assetKey: `beginner-semantic-vocabulary-sprite-${String(sheet).padStart(2, "0")}-2026-08-23`,
    assetPath: `/images/smartcards/beginner-semantic-vocabulary-sprite-${String(sheet).padStart(2, "0")}-2026-08-23.png`,
    mediaKind: "image-sprite" as const,
    generationSource: "openai-image-generation" as const,
    generatedAt: "2026-08-23",
    releaseId: "semantic-expansion-2026-08-23",
    subjects,
    promptSummary: "Original SmartLingo 6x6 language-neutral beginner semantic picture sprite, ordered by shared cross-language frequency and difficulty priority.",
    humanReview: "approved" as const,
  };
});

export const SMARTLINGO_SEMANTIC_FALLBACK_MEDIA = Array.from({ length: 158 }, (_, sheetIndex) => {
  const sheet = sheetIndex + 1;
  const subjects = BEGINNER_SEMANTIC_CONCEPTS
    .filter(concept => concept.mediaTier === "semantic-svg" && concept.sheet === sheet)
    .map(concept => concept.key);
  return {
    assetKey: `beginner-semantic-fallback-sprite-${String(sheet).padStart(3, "0")}-2026-08-23`,
    assetPath: `/images/smartcards/beginner-semantic-fallback-sprite-${String(sheet).padStart(3, "0")}-2026-08-23.svg`,
    mediaKind: "image-sprite" as const,
    generationSource: "curated" as const,
    generatedAt: "2026-08-23",
    releaseId: "semantic-expansion-2026-08-23",
    subjects,
    promptSummary: "Original language-neutral SmartLingo semantic SVG micro-scenes for rare beginner concepts, with deterministic category iconography and no text.",
    humanReview: "approved" as const,
  };
});

export const SMARTLINGO_SCENE_MEDIA_POLICY = {
  currentExperience: "openai-generated-real-people-paired-keyframe-gifs",
  futureUpgrade: "short-video-provider",
  requirements: [
    "The people, location, and learning task must match the selected scenario.",
    "Media must not contain third-party characters, logos, or deceptive provenance.",
    "A still-image and transcript fallback must remain available for accessibility and weak networks.",
    "Dialogue content remains usable when media generation or playback is unavailable.",
  ],
} as const;

export const SMARTLINGO_EVERYDAY_MOTION_MEDIA = ["airport", "hotel", "restaurant", "hospital", "cafe", "school", "library", "grocery", "transit", "pharmacy", "bank", "police"].map(scene => ({
  scene,
  generationSource: "openai-image-generation" as const,
  generatedAt: "2026-08-23",
  humanReview: "approved" as const,
  paths: Array.from({ length: 10 }, (_, index) => `/everyday-speaking/${scene}/conversation-${String(index + 1).padStart(2, "0")}.gif`),
}));
