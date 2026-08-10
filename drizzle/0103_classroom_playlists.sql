CREATE TABLE class_playlist_items (
  id TEXT PRIMARY KEY NOT NULL,
  room_id TEXT NOT NULL REFERENCES live_class_rooms(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'upload' CHECK(source_type='upload'),
  source_url TEXT,
  r2_key TEXT,
  content_type TEXT NOT NULL DEFAULT 'video/mp4',
  file_size_bytes INTEGER NOT NULL DEFAULT 0 CHECK(file_size_bytes >= 0),
  position INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  CHECK(source_type='upload' AND r2_key IS NOT NULL AND source_url IS NULL)
);
CREATE INDEX class_playlist_items_order_idx ON class_playlist_items(room_id,position,created_at);

CREATE TABLE class_playlist_state (
  room_id TEXT PRIMARY KEY NOT NULL REFERENCES live_class_rooms(id) ON DELETE CASCADE,
  active INTEGER NOT NULL DEFAULT 0 CHECK(active IN (0,1)),
  current_item_id TEXT REFERENCES class_playlist_items(id) ON DELETE SET NULL,
  started_at INTEGER,
  offset_seconds INTEGER NOT NULL DEFAULT 0 CHECK(offset_seconds >= 0),
  updated_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  updated_at INTEGER NOT NULL
);
