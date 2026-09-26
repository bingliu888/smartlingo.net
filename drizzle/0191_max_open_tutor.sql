-- One private, short-lived Max tutor conversation per member. The server
-- accounts active time against a UTC-day allowance; the five-minute worker
-- removes yesterday's conversation after a brief recovery window.
CREATE TABLE smartlingo_max_tutor_sessions (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE,
  target_language TEXT NOT NULL CHECK(target_language IN ('zh','en','es','ja','ko','fr','de','ru','it','pt','ar','hi')),
  ui_language TEXT NOT NULL CHECK(ui_language IN ('zh','en')),
  usage_day INTEGER NOT NULL,
  used_seconds INTEGER NOT NULL DEFAULT 0 CHECK(used_seconds BETWEEN 0 AND 1800),
  last_active_at INTEGER NOT NULL,
  turn_count INTEGER NOT NULL DEFAULT 0 CHECK(turn_count BETWEEN 0 AND 180),
  pending_until INTEGER NOT NULL DEFAULT 0,
  opening_text TEXT NOT NULL,
  transcript_json TEXT NOT NULL DEFAULT '[]',
  profile_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX smartlingo_max_tutor_user_idx ON smartlingo_max_tutor_sessions(user_id);
--> statement-breakpoint
CREATE INDEX smartlingo_max_tutor_day_idx ON smartlingo_max_tutor_sessions(usage_day);
--> statement-breakpoint
CREATE TRIGGER smartlingo_max_tutor_users_clerk_id_rekey
AFTER UPDATE OF id ON users
FOR EACH ROW WHEN OLD.id<>NEW.id
BEGIN
  UPDATE smartlingo_max_tutor_sessions SET user_id=NEW.id WHERE user_id=OLD.id;
END;
