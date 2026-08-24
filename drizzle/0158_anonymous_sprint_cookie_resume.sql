CREATE TABLE smartlingo_guest_sprint_runs (
  id TEXT PRIMARY KEY NOT NULL,
  guest_key_hash TEXT NOT NULL CHECK(length(guest_key_hash)=64),
  class_id TEXT NOT NULL REFERENCES smartlingo_language_classes(id) ON DELETE RESTRICT,
  target_language TEXT NOT NULL,
  level TEXT NOT NULL CHECK(level IN ('beginner','intermediate','advanced')),
  duration_minutes INTEGER NOT NULL CHECK(duration_minutes IN (5,10,15,20)),
  round_count INTEGER NOT NULL CHECK(round_count BETWEEN 1 AND 4),
  plan_json TEXT NOT NULL CHECK(json_valid(plan_json)),
  progress_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(progress_json)),
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK(status IN ('in_progress','completed','abandoned')),
  started_at INTEGER NOT NULL,
  checkpointed_at INTEGER,
  completed_at INTEGER
);
CREATE INDEX smartlingo_guest_sprint_resume_idx ON smartlingo_guest_sprint_runs(guest_key_hash,class_id,duration_minutes,status,started_at DESC);
