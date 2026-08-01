CREATE TABLE `career_profiles` (
	`user_id` text PRIMARY KEY NOT NULL,
	`account_type` text DEFAULT 'learner' NOT NULL,
	`headline` text DEFAULT '' NOT NULL,
	`location` text DEFAULT '' NOT NULL,
	`target_role` text DEFAULT '' NOT NULL,
	`industry` text DEFAULT '' NOT NULL,
	`stage` integer DEFAULT 0 NOT NULL,
	`skills` text DEFAULT '[]' NOT NULL,
	`work_preference` text DEFAULT 'not_specified' NOT NULL,
	`open_to_work` integer DEFAULT false NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `smartcert_career_open_idx` ON `career_profiles` (`open_to_work`);--> statement-breakpoint
CREATE INDEX `smartcert_career_industry_idx` ON `career_profiles` (`industry`);--> statement-breakpoint
CREATE INDEX `smartcert_career_stage_idx` ON `career_profiles` (`stage`);