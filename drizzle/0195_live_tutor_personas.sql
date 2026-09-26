-- Preserve each member's selected fictional AI portrait and GPT-Live voice
-- across daily tutor-session refreshes and learning-language changes.
ALTER TABLE smartlingo_max_tutor_sessions
  ADD COLUMN portrait_key TEXT NOT NULL DEFAULT 'mei'
  CHECK(portrait_key IN ('mei','leo','sofia'));
--> statement-breakpoint
ALTER TABLE smartlingo_max_tutor_sessions
  ADD COLUMN voice_key TEXT NOT NULL DEFAULT 'marin'
  CHECK(voice_key IN ('marin','gleam','meridian','willow'));
