PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS smartlingo_course_classrooms (
  course_id TEXT PRIMARY KEY NOT NULL REFERENCES smartlingo_language_classes(id) ON DELETE CASCADE,
  room_id TEXT NOT NULL UNIQUE REFERENCES live_class_rooms(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL
);
