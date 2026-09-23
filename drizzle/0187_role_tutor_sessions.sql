-- Text-only, mission-bound Max tutor. Session content is bounded and pruned
-- opportunistically; no raw tutor transcript is written to AI audit logs.
CREATE TABLE smartlingo_role_tutor_sessions (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE,
  scene_id TEXT NOT NULL,
  role_id TEXT NOT NULL,
  language TEXT NOT NULL,
  level TEXT NOT NULL CHECK(level IN ('beginner','intermediate','advanced')),
  ui_language TEXT NOT NULL CHECK(ui_language IN ('zh','en')),
  started_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  turn_count INTEGER NOT NULL DEFAULT 0 CHECK(turn_count BETWEEN 0 AND 12),
  pending_until INTEGER NOT NULL DEFAULT 0,
  transcript_json TEXT NOT NULL DEFAULT '[]',
  updated_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX smartlingo_role_tutor_user_expiry_idx ON smartlingo_role_tutor_sessions(user_id,expires_at);
--> statement-breakpoint
CREATE INDEX smartlingo_role_tutor_expiry_idx ON smartlingo_role_tutor_sessions(expires_at);
--> statement-breakpoint
CREATE UNIQUE INDEX smartlingo_role_tutor_user_idx ON smartlingo_role_tutor_sessions(user_id);
--> statement-breakpoint
CREATE TRIGGER smartlingo_role_tutor_users_clerk_id_rekey
AFTER UPDATE OF id ON users
FOR EACH ROW WHEN OLD.id<>NEW.id
BEGIN
  UPDATE smartlingo_role_tutor_sessions SET user_id=NEW.id WHERE user_id=OLD.id;
END;
