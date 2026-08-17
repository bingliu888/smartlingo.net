ALTER TABLE `smartlingo_vocabulary_progress` ADD COLUMN `is_focused` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX `smartlingo_vocabulary_progress_focus_idx` ON `smartlingo_vocabulary_progress` (`user_id`,`path_id`,`is_focused`,`updated_at`);--> statement-breakpoint
