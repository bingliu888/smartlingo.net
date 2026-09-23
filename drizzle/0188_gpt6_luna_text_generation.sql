-- Keep the original cache rows for audit while allowing newly generated GPT-6 Luna media.
CREATE TABLE smartlingo_adaptive_sentence_sets_gpt6 (
  cache_key TEXT PRIMARY KEY,
  release_id TEXT NOT NULL,
  target_language TEXT NOT NULL,
  level TEXT NOT NULL CHECK(level IN ('beginner','intermediate','advanced')),
  ui_language TEXT NOT NULL CHECK(ui_language IN ('zh','en')),
  vocabulary_ids_json TEXT NOT NULL CHECK(json_valid(vocabulary_ids_json)),
  payload_json TEXT NOT NULL CHECK(json_valid(payload_json)),
  source_type TEXT NOT NULL CHECK(source_type IN ('gpt-5.6-luna','gpt-6-luna','safe-fallback')),
  created_at INTEGER NOT NULL
);

INSERT INTO smartlingo_adaptive_sentence_sets_gpt6
SELECT * FROM smartlingo_adaptive_sentence_sets;
DROP TABLE smartlingo_adaptive_sentence_sets;
ALTER TABLE smartlingo_adaptive_sentence_sets_gpt6 RENAME TO smartlingo_adaptive_sentence_sets;
CREATE INDEX smartlingo_adaptive_sentence_release_idx
ON smartlingo_adaptive_sentence_sets(release_id,target_language,level,ui_language,created_at DESC);

CREATE TABLE smartlingo_everyday_dialogue_sets_gpt6 (
  cache_key TEXT PRIMARY KEY,
  release_id TEXT NOT NULL,
  target_language TEXT NOT NULL,
  level TEXT NOT NULL CHECK(level IN ('beginner','intermediate','advanced')),
  scenario TEXT NOT NULL,
  payload_json TEXT NOT NULL CHECK(json_valid(payload_json)),
  source_type TEXT NOT NULL CHECK(source_type IN ('gpt-5.6-luna','gpt-6-luna','safe-fallback')),
  created_at INTEGER NOT NULL
);

INSERT INTO smartlingo_everyday_dialogue_sets_gpt6
SELECT * FROM smartlingo_everyday_dialogue_sets;
DROP TABLE smartlingo_everyday_dialogue_sets;
ALTER TABLE smartlingo_everyday_dialogue_sets_gpt6 RENAME TO smartlingo_everyday_dialogue_sets;
CREATE INDEX smartlingo_everyday_dialogue_release_idx
ON smartlingo_everyday_dialogue_sets(release_id,target_language,level,scenario,created_at DESC);

-- A new release ID prevents previous-model content from being served as new content.
INSERT INTO smartlingo_learning_content_releases(content_key,release_id,released_at,updated_at)
VALUES('adaptive-sentences','gpt-6-luna-2026-09-22',unixepoch(),unixepoch())
ON CONFLICT(content_key) DO UPDATE SET
  release_id=excluded.release_id,released_at=excluded.released_at,updated_at=excluded.updated_at;
INSERT INTO smartlingo_learning_content_releases(content_key,release_id,released_at,updated_at)
VALUES('everyday-dialogues','gpt-6-luna-2026-09-22',unixepoch(),unixepoch())
ON CONFLICT(content_key) DO UPDATE SET
  release_id=excluded.release_id,released_at=excluded.released_at,updated_at=excluded.updated_at;

PRAGMA optimize;
