ALTER TABLE live_class_rooms ADD COLUMN realtime_mode TEXT NOT NULL DEFAULT 'group_call' CHECK(realtime_mode IN ('group_call','webinar','livestream'));

CREATE TABLE IF NOT EXISTS live_class_stage_requests (
  id TEXT PRIMARY KEY NOT NULL,
  room_id TEXT NOT NULL REFERENCES live_class_rooms(id) ON DELETE CASCADE,
  identity TEXT NOT NULL,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  display_name TEXT NOT NULL,
  media_kind TEXT NOT NULL CHECK(media_kind IN ('audio','video')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','denied')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(room_id,identity,media_kind)
);
CREATE INDEX IF NOT EXISTS live_class_stage_requests_room_status_idx ON live_class_stage_requests(room_id,status,updated_at DESC);

CREATE TABLE IF NOT EXISTS live_class_stage_speakers (
  id TEXT PRIMARY KEY NOT NULL,
  room_id TEXT NOT NULL REFERENCES live_class_rooms(id) ON DELETE CASCADE,
  member_email TEXT NOT NULL,
  added_by_user_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE(room_id,member_email)
);
CREATE INDEX IF NOT EXISTS live_class_stage_speakers_room_idx ON live_class_stage_speakers(room_id,created_at DESC);
