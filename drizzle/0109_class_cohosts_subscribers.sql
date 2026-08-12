CREATE TABLE IF NOT EXISTS live_class_cohosts (
  room_id TEXT NOT NULL, user_id TEXT NOT NULL, added_by_user_id TEXT NOT NULL, created_at INTEGER NOT NULL,
  PRIMARY KEY(room_id,user_id), FOREIGN KEY(room_id) REFERENCES live_class_rooms(id) ON DELETE CASCADE, FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS live_class_subscriptions (
  room_id TEXT NOT NULL, user_id TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('trial','active','cancelled','expired')),
  trial_started_at INTEGER, trial_ends_at INTEGER, added_by_user_id TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
  PRIMARY KEY(room_id,user_id), FOREIGN KEY(room_id) REFERENCES live_class_rooms(id) ON DELETE CASCADE, FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS live_class_cohosts_user_idx ON live_class_cohosts(user_id);
CREATE INDEX IF NOT EXISTS live_class_subscriptions_user_idx ON live_class_subscriptions(user_id,status);