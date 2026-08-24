CREATE TABLE IF NOT EXISTS smartlingo_learning_content_releases (
  content_key TEXT PRIMARY KEY,
  release_id TEXT NOT NULL,
  released_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

INSERT INTO smartlingo_learning_content_releases(content_key,release_id,released_at,updated_at)
VALUES('adaptive-sentences','bootstrap-2026-08-23',unixepoch(),unixepoch())
ON CONFLICT(content_key) DO NOTHING;

CREATE TABLE IF NOT EXISTS smartlingo_adaptive_sentence_sets (
  cache_key TEXT PRIMARY KEY,
  release_id TEXT NOT NULL,
  target_language TEXT NOT NULL,
  level TEXT NOT NULL CHECK(level IN ('beginner','intermediate','advanced')),
  ui_language TEXT NOT NULL CHECK(ui_language IN ('zh','en')),
  vocabulary_ids_json TEXT NOT NULL CHECK(json_valid(vocabulary_ids_json)),
  payload_json TEXT NOT NULL CHECK(json_valid(payload_json)),
  source_type TEXT NOT NULL CHECK(source_type IN ('gpt-5.6-luna','safe-fallback')),
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS smartlingo_adaptive_sentence_release_idx
ON smartlingo_adaptive_sentence_sets(release_id,target_language,level,ui_language,created_at DESC);

CREATE TABLE IF NOT EXISTS smartlingo_learning_media_assets (
  asset_key TEXT PRIMARY KEY,
  asset_path TEXT NOT NULL,
  media_kind TEXT NOT NULL CHECK(media_kind IN ('image-sprite','scene-image','short-video')),
  generation_source TEXT NOT NULL CHECK(generation_source IN ('openai-image-generation','curated','future-video-provider')),
  release_id TEXT NOT NULL,
  subject_manifest_json TEXT NOT NULL CHECK(json_valid(subject_manifest_json)),
  prompt_summary TEXT NOT NULL,
  reviewed_at INTEGER,
  created_at INTEGER NOT NULL
);

INSERT INTO smartlingo_learning_media_assets(asset_key,asset_path,media_kind,generation_source,release_id,subject_manifest_json,prompt_summary,reviewed_at,created_at)
VALUES(
  'beginner-vocabulary-sprite-2026-08-23',
  '/images/smartcards/beginner-vocabulary-sprite-2026-08-23.png',
  'image-sprite',
  'openai-image-generation',
  'bootstrap-2026-08-23',
  '["coffee","water","bread","egg","milk","rice","apple","banana","meat","vegetables","bus","train","hotel","hospital","book","school"]',
  'Original SmartLingo 4x4 educational picture-choice sprite; isolated concrete objects, no words, letters, logos, or third-party characters.',
  unixepoch(),
  unixepoch()
)
ON CONFLICT(asset_key) DO UPDATE SET asset_path=excluded.asset_path,release_id=excluded.release_id,reviewed_at=excluded.reviewed_at;

PRAGMA optimize;
