CREATE TABLE smartlingo_vocabulary_practice_sessions (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  path_id TEXT NOT NULL REFERENCES smartlingo_language_paths(id) ON DELETE RESTRICT,
  class_id TEXT NOT NULL REFERENCES smartlingo_language_classes(id) ON DELETE RESTRICT,
  local_date TEXT NOT NULL CHECK(length(local_date)=10),
  deck_ids_json TEXT NOT NULL CHECK(json_valid(deck_ids_json) AND json_type(deck_ids_json)='array' AND length(deck_ids_json)<=8192),
  current_index INTEGER NOT NULL DEFAULT 0 CHECK(current_index BETWEEN 0 AND 20),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(user_id,path_id,local_date)
);
CREATE INDEX smartlingo_vocabulary_practice_resume_idx
  ON smartlingo_vocabulary_practice_sessions(user_id,path_id,local_date,updated_at DESC);
