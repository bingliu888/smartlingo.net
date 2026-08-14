CREATE TABLE IF NOT EXISTS live_class_join_history (
  user_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  first_joined_at INTEGER NOT NULL,
  last_joined_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, room_id),
  FOREIGN KEY (room_id) REFERENCES live_class_rooms(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_live_class_join_history_user
  ON live_class_join_history(user_id, last_joined_at DESC);

INSERT OR IGNORE INTO live_class_join_history(user_id,room_id,first_joined_at,last_joined_at)
SELECT user_id,room_id,MIN(last_seen_at),MAX(last_seen_at)
FROM live_class_media_presence
WHERE user_id IS NOT NULL
GROUP BY user_id,room_id;
