-- Gold 3 v1 r1: legacy email-address classroom grants start unbound and gain
-- authority only after the matching member returns with a verified Clerk
-- session. This migration is additive so the production r0 Worker remains
-- compatible while D1 migrations run before the r1 build and deployment.

-- The original classroom tables were shipped before SmartLingo's tracked D1
-- journal. Recreate their production shape on a fresh disaster-recovery D1 so
-- the additive Gold 3 columns and rekey trigger below have the same
-- prerequisites as an upgraded production database.
CREATE TABLE IF NOT EXISTS live_class_invites (
  id TEXT PRIMARY KEY NOT NULL,
  room_id TEXT NOT NULL REFERENCES live_class_rooms(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE(room_id,email)
);
CREATE INDEX IF NOT EXISTS live_class_invites_email_idx
  ON live_class_invites(email,created_at DESC);

CREATE TABLE IF NOT EXISTS live_class_chat_messages (
  id TEXT PRIMARY KEY NOT NULL,
  room_id TEXT NOT NULL REFERENCES live_class_rooms(id) ON DELETE CASCADE,
  sender_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  sender_name TEXT NOT NULL,
  body TEXT NOT NULL CHECK(length(body) BETWEEN 1 AND 2000),
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS live_class_chat_room_created_idx
  ON live_class_chat_messages(room_id,created_at);

CREATE TABLE IF NOT EXISTS live_class_media_presence (
  id TEXT PRIMARY KEY NOT NULL,
  room_id TEXT NOT NULL REFERENCES live_class_rooms(id) ON DELETE CASCADE,
  identity TEXT NOT NULL,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  display_name TEXT NOT NULL,
  is_member INTEGER NOT NULL DEFAULT 0 CHECK(is_member IN (0,1)),
  mic_on INTEGER NOT NULL DEFAULT 0 CHECK(mic_on IN (0,1)),
  camera_on INTEGER NOT NULL DEFAULT 0 CHECK(camera_on IN (0,1)),
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  last_seen_at INTEGER NOT NULL,
  UNIQUE(room_id,identity)
);
CREATE INDEX IF NOT EXISTS live_class_presence_active_idx
  ON live_class_media_presence(room_id,active,last_seen_at);

CREATE TABLE IF NOT EXISTS live_class_stage_requests (
  id TEXT PRIMARY KEY NOT NULL,
  room_id TEXT NOT NULL REFERENCES live_class_rooms(id) ON DELETE CASCADE,
  identity TEXT NOT NULL,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  display_name TEXT NOT NULL,
  media_kind TEXT NOT NULL CHECK(media_kind IN ('audio','video')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK(status IN ('pending','approved','denied')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(room_id,identity,media_kind)
);
CREATE INDEX IF NOT EXISTS live_class_stage_requests_room_status_idx
  ON live_class_stage_requests(room_id,status,updated_at DESC);

CREATE TABLE IF NOT EXISTS live_class_stage_speakers (
  id TEXT PRIMARY KEY NOT NULL,
  room_id TEXT NOT NULL REFERENCES live_class_rooms(id) ON DELETE CASCADE,
  member_email TEXT NOT NULL,
  added_by_user_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE(room_id,member_email)
);
CREATE INDEX IF NOT EXISTS live_class_stage_speakers_room_idx
  ON live_class_stage_speakers(room_id,created_at DESC);

CREATE TABLE IF NOT EXISTS class_playlist_state (
  room_id TEXT PRIMARY KEY NOT NULL REFERENCES live_class_rooms(id) ON DELETE CASCADE,
  active INTEGER NOT NULL DEFAULT 0 CHECK(active IN (0,1)),
  current_item_id TEXT REFERENCES class_playlist_items(id) ON DELETE SET NULL,
  started_at INTEGER,
  offset_seconds INTEGER NOT NULL DEFAULT 0 CHECK(offset_seconds >= 0),
  updated_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS live_class_cohosts (
  room_id TEXT NOT NULL REFERENCES live_class_rooms(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  added_by_user_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY(room_id,user_id)
);
CREATE INDEX IF NOT EXISTS live_class_cohosts_user_idx
  ON live_class_cohosts(user_id);

CREATE TABLE IF NOT EXISTS live_class_subscriptions (
  room_id TEXT NOT NULL REFERENCES live_class_rooms(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK(status IN ('trial','active','cancelled','expired')),
  trial_started_at INTEGER,
  trial_ends_at INTEGER,
  added_by_user_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY(room_id,user_id)
);
CREATE INDEX IF NOT EXISTS live_class_subscriptions_user_idx
  ON live_class_subscriptions(user_id,status);

CREATE TABLE IF NOT EXISTS live_class_join_history (
  user_id TEXT NOT NULL,
  room_id TEXT NOT NULL REFERENCES live_class_rooms(id) ON DELETE CASCADE,
  first_joined_at INTEGER NOT NULL,
  last_joined_at INTEGER NOT NULL,
  PRIMARY KEY(user_id,room_id)
);
CREATE INDEX IF NOT EXISTS idx_live_class_join_history_user
  ON live_class_join_history(user_id,last_joined_at DESC);

ALTER TABLE live_class_invites ADD COLUMN user_id TEXT REFERENCES users(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX live_class_invites_room_user_idx
  ON live_class_invites(room_id,user_id) WHERE user_id IS NOT NULL;

ALTER TABLE live_class_stage_speakers ADD COLUMN user_id TEXT REFERENCES users(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX live_class_stage_speakers_room_user_idx
  ON live_class_stage_speakers(room_id,user_id) WHERE user_id IS NOT NULL;

ALTER TABLE live_class_cohosts ADD COLUMN granted_email TEXT;
UPDATE live_class_cohosts SET granted_email=(
  SELECT users.email FROM users WHERE users.id=live_class_cohosts.user_id LIMIT 1
);
ALTER TABLE live_class_cohosts ADD COLUMN identity_bound_at INTEGER NOT NULL DEFAULT 0
  CHECK(identity_bound_at>=0);
CREATE INDEX live_class_cohosts_identity_bound_idx
  ON live_class_cohosts(user_id,identity_bound_at,room_id);

ALTER TABLE live_class_subscriptions ADD COLUMN email TEXT;
UPDATE live_class_subscriptions SET email=(
  SELECT users.email FROM users WHERE users.id=live_class_subscriptions.user_id LIMIT 1
);
ALTER TABLE live_class_subscriptions ADD COLUMN identity_bound_at INTEGER NOT NULL DEFAULT 0
  CHECK(identity_bound_at>=0);
CREATE INDEX live_class_subscriptions_identity_bound_idx
  ON live_class_subscriptions(user_id,identity_bound_at,room_id,status);

-- D1 is migrated before the r1 Worker is deployed. During that bounded
-- compatibility window the r0 Worker can still insert rows without the new
-- snapshot columns. Capture the current registered email, but deliberately
-- leave identity_bound_at=0 until a current verified Clerk session binds it.
CREATE TRIGGER live_class_cohosts_legacy_email_snapshot
AFTER INSERT ON live_class_cohosts
FOR EACH ROW WHEN NULLIF(trim(NEW.granted_email),'') IS NULL
BEGIN
  UPDATE live_class_cohosts SET granted_email=(
    SELECT users.email FROM users WHERE users.id=NEW.user_id LIMIT 1
  ) WHERE room_id=NEW.room_id AND user_id=NEW.user_id
    AND NULLIF(trim(granted_email),'') IS NULL;
END;

CREATE TRIGGER live_class_subscriptions_legacy_email_snapshot
AFTER INSERT ON live_class_subscriptions
FOR EACH ROW WHEN NULLIF(trim(NEW.email),'') IS NULL
BEGIN
  UPDATE live_class_subscriptions SET email=(
    SELECT users.email FROM users WHERE users.id=NEW.user_id LIMIT 1
  ) WHERE room_id=NEW.room_id AND user_id=NEW.user_id
    AND NULLIF(trim(email),'') IS NULL;
END;

-- The main 0180 rekey trigger covers schema-declared product references. The
-- classroom subsystem also has manual-SQL tables, including the two canonical
-- user bindings added above. Keep those references in a separate trigger so
-- the r2 legacy-session cleanup can recreate the main trigger independently.
CREATE TRIGGER smartlingo_classroom_users_clerk_id_rekey
AFTER UPDATE OF id ON users
FOR EACH ROW WHEN OLD.id<>NEW.id
BEGIN
  UPDATE live_class_chat_messages SET sender_user_id=NEW.id WHERE sender_user_id=OLD.id;
  UPDATE live_class_cohosts SET added_by_user_id=NEW.id WHERE added_by_user_id=OLD.id;
  UPDATE live_class_cohosts SET user_id=NEW.id WHERE user_id=OLD.id;
  UPDATE live_class_invites SET user_id=NEW.id WHERE user_id=OLD.id;
  UPDATE live_class_join_history SET user_id=NEW.id WHERE user_id=OLD.id;
  UPDATE live_class_media_presence SET user_id=NEW.id WHERE user_id=OLD.id;
  UPDATE class_playlist_state SET updated_by_user_id=NEW.id WHERE updated_by_user_id=OLD.id;
  UPDATE live_class_stage_requests SET user_id=NEW.id WHERE user_id=OLD.id;
  UPDATE live_class_stage_speakers SET added_by_user_id=NEW.id WHERE added_by_user_id=OLD.id;
  UPDATE live_class_stage_speakers SET user_id=NEW.id WHERE user_id=OLD.id;
  UPDATE live_class_subscriptions SET added_by_user_id=NEW.id WHERE added_by_user_id=OLD.id;
  UPDATE live_class_subscriptions SET user_id=NEW.id WHERE user_id=OLD.id;
END;
