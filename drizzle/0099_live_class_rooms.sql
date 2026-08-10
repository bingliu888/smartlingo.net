PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS live_class_rooms (
  id TEXT PRIMARY KEY NOT NULL,
  code TEXT NOT NULL UNIQUE CHECK(length(code) = 6),
  host_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  host_email TEXT NOT NULL,
  host_name TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  subject TEXT NOT NULL DEFAULT '',
  class_type TEXT NOT NULL DEFAULT 'public' CHECK(class_type IN ('public','trial','private')),
  streaming_mode TEXT NOT NULL DEFAULT 'video' CHECK(streaming_mode IN ('audio','video')),
  starts_at INTEGER NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 60 CHECK(duration_minutes BETWEEN 15 AND 480),
  trial_minutes INTEGER NOT NULL DEFAULT 30 CHECK(trial_minutes BETWEEN 0 AND 1440),
  tuition_cents INTEGER NOT NULL DEFAULT 0 CHECK(tuition_cents >= 0),
  password_hash TEXT,
  provider_meeting_id TEXT,
  stream_active INTEGER NOT NULL DEFAULT 0 CHECK(stream_active IN (0,1)),
  mute_all INTEGER NOT NULL DEFAULT 1 CHECK(mute_all IN (0,1)),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','archived')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS live_class_rooms_type_start_idx ON live_class_rooms(class_type,status,starts_at);
CREATE INDEX IF NOT EXISTS live_class_rooms_host_updated_idx ON live_class_rooms(host_user_id,updated_at DESC);

CREATE TABLE IF NOT EXISTS live_class_invites (
  id TEXT PRIMARY KEY NOT NULL,
  room_id TEXT NOT NULL REFERENCES live_class_rooms(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE(room_id,email)
);
CREATE INDEX IF NOT EXISTS live_class_invites_email_idx ON live_class_invites(email,created_at DESC);

CREATE TABLE IF NOT EXISTS live_class_chat_messages (
  id TEXT PRIMARY KEY NOT NULL,
  room_id TEXT NOT NULL REFERENCES live_class_rooms(id) ON DELETE CASCADE,
  sender_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  sender_name TEXT NOT NULL,
  body TEXT NOT NULL CHECK(length(body) BETWEEN 1 AND 2000),
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS live_class_chat_room_created_idx ON live_class_chat_messages(room_id,created_at);

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
CREATE INDEX IF NOT EXISTS live_class_presence_active_idx ON live_class_media_presence(room_id,active,last_seen_at);

CREATE TABLE IF NOT EXISTS live_class_materials (
  id TEXT PRIMARY KEY NOT NULL,
  room_id TEXT NOT NULL REFERENCES live_class_rooms(id) ON DELETE CASCADE,
  uploader_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  content_type TEXT NOT NULL,
  object_key TEXT NOT NULL UNIQUE,
  byte_size INTEGER NOT NULL CHECK(byte_size BETWEEN 1 AND 15728640),
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS live_class_materials_room_created_idx ON live_class_materials(room_id,created_at DESC);
