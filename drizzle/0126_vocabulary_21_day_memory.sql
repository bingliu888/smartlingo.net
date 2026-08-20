-- Additive 21-day vocabulary evidence and immutable daily progress snapshots.
ALTER TABLE smartlingo_vocabulary_progress ADD COLUMN successful_dates TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(successful_dates) AND json_type(successful_dates)='array' AND length(successful_dates)<=512);
ALTER TABLE smartlingo_vocabulary_progress ADD COLUMN first_learned_at INTEGER;
ALTER TABLE smartlingo_vocabulary_progress ADD COLUMN mastered_at INTEGER;

-- The former review_box represented same-session streaks. Preserve lifetime
-- counts and chosen modes, but require every existing word to earn the new
-- cross-day evidence before it is called permanently mastered.
UPDATE smartlingo_vocabulary_progress
SET status=CASE WHEN status='suspended' THEN 'suspended' WHEN review_count>0 THEN 'review' ELSE 'new' END,
    review_box=0,
    interval_days=0,
    due_at=CASE WHEN status='suspended' THEN NULL ELSE unixepoch() END;

CREATE TABLE smartlingo_vocabulary_daily_reports (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  path_id TEXT NOT NULL REFERENCES smartlingo_language_paths(id) ON DELETE RESTRICT,
  class_id TEXT REFERENCES smartlingo_language_classes(id) ON DELETE SET NULL,
  local_date TEXT NOT NULL,
  total_count INTEGER NOT NULL,
  mastered_count INTEGER NOT NULL,
  learning_count INTEGER NOT NULL,
  unlearned_count INTEGER NOT NULL,
  mastery_percent INTEGER NOT NULL CHECK(mastery_percent BETWEEN 0 AND 100),
  stars INTEGER NOT NULL CHECK(stars BETWEEN 0 AND 5),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  CHECK(total_count>=0 AND mastered_count>=0 AND learning_count>=0 AND unlearned_count>=0),
  CHECK(mastered_count+learning_count+unlearned_count=total_count)
);
CREATE UNIQUE INDEX smartlingo_vocabulary_daily_report_uq ON smartlingo_vocabulary_daily_reports(user_id,path_id,local_date);
CREATE INDEX smartlingo_vocabulary_daily_report_history_idx ON smartlingo_vocabulary_daily_reports(user_id,path_id,local_date);
