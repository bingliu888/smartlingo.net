ALTER TABLE smartlingo_daily_sprint_runs ADD COLUMN progress_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(progress_json));
ALTER TABLE smartlingo_daily_sprint_runs ADD COLUMN checkpointed_at INTEGER;
CREATE INDEX smartlingo_daily_sprint_resume_idx ON smartlingo_daily_sprint_runs(user_id,class_id,status,started_at DESC);
--> statement-breakpoint
PRAGMA optimize;
