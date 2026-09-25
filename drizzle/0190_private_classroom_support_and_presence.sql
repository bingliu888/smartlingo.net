-- SmartMeeting v2 room contract, adapted to SmartLingo's independent classroom data.
ALTER TABLE live_class_chat_messages ADD COLUMN recipient_user_id TEXT REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS live_class_chat_viewer_idx ON live_class_chat_messages(room_id,sender_user_id,recipient_user_id,created_at DESC);

CREATE TABLE IF NOT EXISTS class_member_room_presence (
  room_id TEXT NOT NULL REFERENCES live_class_rooms(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tab_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  entered_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  PRIMARY KEY(room_id,user_id)
);
CREATE INDEX IF NOT EXISTS class_member_room_presence_live_idx ON class_member_room_presence(room_id,last_seen_at);

CREATE TABLE IF NOT EXISTS class_room_audio_notes (
  id TEXT PRIMARY KEY NOT NULL,
  room_id TEXT NOT NULL REFERENCES live_class_rooms(id) ON DELETE CASCADE,
  uploader_user_id TEXT NOT NULL REFERENCES users(id),
  object_key TEXT NOT NULL UNIQUE,
  content_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL CHECK(byte_size>0 AND byte_size<=104857600),
  recording_seconds INTEGER NOT NULL CHECK(recording_seconds>0 AND recording_seconds<=1800),
  source TEXT NOT NULL CHECK(source IN ('browser','file')),
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS class_room_audio_notes_room_idx ON class_room_audio_notes(room_id,created_at DESC,id DESC);

CREATE TRIGGER smartlingo_private_classroom_users_clerk_id_rekey
AFTER UPDATE OF id ON users
FOR EACH ROW WHEN OLD.id<>NEW.id
BEGIN
  UPDATE live_class_chat_messages SET recipient_user_id=NEW.id WHERE recipient_user_id=OLD.id;
  UPDATE class_member_room_presence SET user_id=NEW.id WHERE user_id=OLD.id;
  UPDATE class_room_audio_notes SET uploader_user_id=NEW.id WHERE uploader_user_id=OLD.id;
END;
