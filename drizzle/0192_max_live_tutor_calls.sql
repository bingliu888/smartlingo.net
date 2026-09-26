-- Keep existing tutor sessions while allowing any supported site language as
-- the learner's independent support language. SQLite CHECK constraints require
-- a table rebuild; the user rekey trigger and indexes are recreated below.
CREATE TABLE smartlingo_max_tutor_sessions_next (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE,
  target_language TEXT NOT NULL CHECK(target_language IN ('zh','en','es','ja','ko','fr','de','ru','it','pt','ar','hi')),
  ui_language TEXT NOT NULL CHECK(ui_language IN ('zh','en','es','ja','ko','fr','de','ru','it','pt','ar','hi')),
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
INSERT INTO smartlingo_max_tutor_sessions_next
  (id,user_id,target_language,ui_language,usage_day,used_seconds,last_active_at,
   turn_count,pending_until,opening_text,transcript_json,profile_json,created_at,updated_at)
SELECT id,user_id,target_language,ui_language,usage_day,used_seconds,last_active_at,
  turn_count,pending_until,opening_text,transcript_json,profile_json,created_at,updated_at
FROM smartlingo_max_tutor_sessions;
--> statement-breakpoint
DROP TRIGGER smartlingo_max_tutor_users_clerk_id_rekey;
--> statement-breakpoint
DROP TABLE smartlingo_max_tutor_sessions;
--> statement-breakpoint
ALTER TABLE smartlingo_max_tutor_sessions_next RENAME TO smartlingo_max_tutor_sessions;
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
--> statement-breakpoint
-- An active WebRTC call reserves the remaining daily Max-tutor allowance.
-- Only a confirmed provider hangup releases unused seconds. The minute cron
-- closes expired or abandoned calls even if the browser disappears.
CREATE TABLE smartlingo_max_live_tutor_calls (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE,
  tutor_session_id TEXT NOT NULL,
  usage_day INTEGER NOT NULL,
  language TEXT NOT NULL,
  provider_call_id TEXT,
  started_at INTEGER NOT NULL,
  last_heartbeat_at INTEGER NOT NULL,
  deadline_at INTEGER NOT NULL,
  reserved_seconds INTEGER NOT NULL CHECK(reserved_seconds BETWEEN 1 AND 1800),
  ended_at INTEGER,
  used_seconds INTEGER,
  status TEXT NOT NULL CHECK(status IN ('connecting','active','closing','closed'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX smartlingo_max_live_tutor_active_user_idx
  ON smartlingo_max_live_tutor_calls(user_id)
  WHERE status IN ('connecting','active','closing');
--> statement-breakpoint
CREATE INDEX smartlingo_max_live_tutor_cleanup_idx
  ON smartlingo_max_live_tutor_calls(status,deadline_at,last_heartbeat_at);
--> statement-breakpoint
CREATE TRIGGER smartlingo_max_live_tutor_refund
AFTER UPDATE OF status ON smartlingo_max_live_tutor_calls
FOR EACH ROW WHEN NEW.status='closed' AND OLD.status<>'closed'
BEGIN
  UPDATE smartlingo_max_tutor_sessions
    SET used_seconds=MAX(0,used_seconds-(NEW.reserved_seconds-NEW.used_seconds)),
      last_active_at=NEW.ended_at,updated_at=NEW.ended_at
    WHERE id=NEW.tutor_session_id AND user_id=NEW.user_id
      AND usage_day=NEW.usage_day;
END;
--> statement-breakpoint
CREATE TRIGGER smartlingo_max_live_tutor_users_clerk_id_rekey
AFTER UPDATE OF id ON users
FOR EACH ROW WHEN OLD.id<>NEW.id
BEGIN
  UPDATE smartlingo_max_live_tutor_calls SET user_id=NEW.id WHERE user_id=OLD.id;
END;
