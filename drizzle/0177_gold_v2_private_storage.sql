-- SmartLingo Gold v2 private R2 reservations and recoverable upload state.
-- Quota rows intentionally retain room ids without a foreign key so deletion
-- can release usage only after its R2 cleanup saga observes an empty prefix.

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

CREATE TABLE IF NOT EXISTS class_playlist_items (
  id TEXT PRIMARY KEY NOT NULL,
  room_id TEXT NOT NULL REFERENCES live_class_rooms(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'upload' CHECK(source_type='upload'),
  source_url TEXT,
  r2_key TEXT,
  content_type TEXT NOT NULL DEFAULT 'video/mp4',
  file_size_bytes INTEGER NOT NULL DEFAULT 0 CHECK(file_size_bytes>=0),
  position INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  CHECK(source_type='upload' AND r2_key IS NOT NULL AND source_url IS NULL)
);

CREATE TABLE member_storage_quota_reservations (
  id TEXT PRIMARY KEY NOT NULL,
  host_user_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  resource_kind TEXT NOT NULL CHECK(resource_kind IN (
    'material','playlist','recording_audio','recording_transcript','recording_summary'
  )),
  resource_id TEXT NOT NULL,
  reserved_bytes INTEGER NOT NULL DEFAULT 0 CHECK(reserved_bytes >= 0),
  reserved_objects INTEGER NOT NULL DEFAULT 1 CHECK(reserved_objects >= 0),
  state TEXT NOT NULL CHECK(state IN ('reserved','used','released')),
  expires_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(resource_kind,resource_id)
);
CREATE INDEX member_storage_quota_host_state_idx
  ON member_storage_quota_reservations(host_user_id,state,expires_at);
CREATE INDEX member_storage_quota_room_idx
  ON member_storage_quota_reservations(room_id,state);

CREATE TABLE class_material_uploads (
  id TEXT PRIMARY KEY NOT NULL,
  room_id TEXT NOT NULL REFERENCES live_class_rooms(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  object_key TEXT NOT NULL UNIQUE,
  quota_reservation_id TEXT NOT NULL UNIQUE,
  file_name TEXT NOT NULL,
  content_type TEXT NOT NULL,
  file_size_bytes INTEGER NOT NULL CHECK(file_size_bytes BETWEEN 1 AND 15728640),
  finalizing INTEGER NOT NULL DEFAULT 0 CHECK(finalizing IN (0,1)),
  cleanup_next_at INTEGER,
  cleanup_attempts INTEGER NOT NULL DEFAULT 0,
  cleanup_last_error TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX class_material_upload_cleanup_idx
  ON class_material_uploads(cleanup_next_at,updated_at,id);

CREATE TABLE class_playlist_uploads (
  id TEXT PRIMARY KEY NOT NULL,
  room_id TEXT NOT NULL REFERENCES live_class_rooms(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  r2_key TEXT NOT NULL UNIQUE,
  r2_upload_id TEXT NOT NULL,
  quota_reservation_id TEXT NOT NULL UNIQUE,
  file_name TEXT NOT NULL,
  content_type TEXT NOT NULL,
  file_size_bytes INTEGER NOT NULL CHECK(file_size_bytes BETWEEN 1 AND 524288000),
  finalizing INTEGER NOT NULL DEFAULT 0 CHECK(finalizing IN (0,1)),
  cleanup_next_at INTEGER,
  cleanup_attempts INTEGER NOT NULL DEFAULT 0,
  cleanup_last_error TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX class_playlist_upload_cleanup_idx
  ON class_playlist_uploads(cleanup_next_at,updated_at,id);

CREATE TABLE class_playlist_upload_parts (
  upload_id TEXT NOT NULL REFERENCES class_playlist_uploads(id) ON DELETE CASCADE,
  part_number INTEGER NOT NULL CHECK(part_number BETWEEN 1 AND 100),
  size_bytes INTEGER NOT NULL CHECK(size_bytes BETWEEN 1 AND 8388608),
  etag TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY(upload_id,part_number)
);

CREATE TABLE class_file_tombstones (
  object_key TEXT PRIMARY KEY NOT NULL,
  room_id TEXT NOT NULL,
  resource_kind TEXT NOT NULL CHECK(resource_kind IN ('material','playlist','recording')),
  resource_id TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts >= 0),
  next_attempt_at INTEGER NOT NULL,
  last_error TEXT,
  requested_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX class_file_tombstones_retry_idx
  ON class_file_tombstones(next_attempt_at,updated_at,object_key);

CREATE TABLE class_recording_quota_reservations (
  id TEXT PRIMARY KEY NOT NULL,
  host_user_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  artifact_id TEXT NOT NULL UNIQUE,
  provider_recording_id TEXT UNIQUE,
  month_start INTEGER NOT NULL,
  reserved_seconds INTEGER NOT NULL DEFAULT 0 CHECK(reserved_seconds >= 0),
  settled_seconds INTEGER NOT NULL DEFAULT 0 CHECK(settled_seconds >= 0),
  state TEXT NOT NULL CHECK(state IN ('reserved','settled','released')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX class_recording_quota_host_month_idx
  ON class_recording_quota_reservations(host_user_id,month_start,state);

INSERT OR IGNORE INTO member_storage_quota_reservations(
  id,host_user_id,room_id,resource_kind,resource_id,reserved_bytes,
  reserved_objects,state,expires_at,created_at,updated_at
)
SELECT 'material:'||material.id,room.host_user_id,material.room_id,'material',
  material.id,material.byte_size,1,'used',NULL,material.created_at,material.created_at
FROM live_class_materials material JOIN live_class_rooms room ON room.id=material.room_id;

INSERT OR IGNORE INTO member_storage_quota_reservations(
  id,host_user_id,room_id,resource_kind,resource_id,reserved_bytes,
  reserved_objects,state,expires_at,created_at,updated_at
)
SELECT 'playlist:'||item.id,room.host_user_id,item.room_id,'playlist',
  item.id,item.file_size_bytes,1,'used',NULL,item.created_at,item.updated_at
FROM class_playlist_items item JOIN live_class_rooms room ON room.id=item.room_id
WHERE item.r2_key IS NOT NULL AND item.r2_key NOT LIKE 'demo:%';
