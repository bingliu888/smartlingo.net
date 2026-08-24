import { BEGINNER_VOCABULARY_IMAGE_KEYS, BEGINNER_VOCABULARY_SPRITE } from "./smartlingo-vocabulary-images.ts";

export const SMARTLINGO_GENERATED_LEARNING_MEDIA = [{
  assetKey: "beginner-vocabulary-sprite-2026-08-23",
  assetPath: BEGINNER_VOCABULARY_SPRITE,
  mediaKind: "image-sprite",
  generationSource: "openai-image-generation",
  generatedAt: "2026-08-23",
  releaseId: "bootstrap-2026-08-23",
  subjects: BEGINNER_VOCABULARY_IMAGE_KEYS,
  promptSummary: "Original SmartLingo 4x4 educational picture-choice sprite with isolated concrete objects, consistent polished 3D-flat visual language, no text, logos, or third-party characters.",
  humanReview: "approved",
}] as const;

export const SMARTLINGO_SCENE_MEDIA_POLICY = {
  currentExperience: "curated-real-people-scene-with-code-driven-camera-motion",
  futureUpgrade: "short-video-provider",
  requirements: [
    "The people, location, and learning task must match the selected scenario.",
    "Media must not contain third-party characters, logos, or deceptive provenance.",
    "A still-image and transcript fallback must remain available for accessibility and weak networks.",
    "Dialogue content remains usable when media generation or playback is unavailable.",
  ],
} as const;
