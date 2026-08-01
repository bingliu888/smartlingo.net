CREATE TABLE `cohort_replies` (
	`id` text PRIMARY KEY NOT NULL,
	`topic_id` text NOT NULL,
	`user_id` text NOT NULL,
	`body` text NOT NULL,
	`created_at` integer NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`topic_id`) REFERENCES `cohort_topics`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `smartcert_cohort_reply_topic_created_idx` ON `cohort_replies` (`topic_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `smartcert_cohort_reply_user_idx` ON `cohort_replies` (`user_id`);--> statement-breakpoint
CREATE TABLE `cohort_stats_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`cohort_id` text NOT NULL,
	`minimum_group_size` integer DEFAULT 5 NOT NULL,
	`suppressed` integer DEFAULT true NOT NULL,
	`learning_count` integer,
	`passed_count` integer,
	`total_count` integer,
	`average_pass_days_tenths` integer,
	`median_pass_days_tenths` integer,
	`country_stats` text DEFAULT '[]' NOT NULL,
	`region_stats` text DEFAULT '[]' NOT NULL,
	`has_suppressed_location_groups` integer DEFAULT false NOT NULL,
	`captured_at` integer NOT NULL,
	FOREIGN KEY (`cohort_id`) REFERENCES `learning_cohorts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `smartcert_cohort_stats_capture_uq` ON `cohort_stats_snapshots` (`cohort_id`,`captured_at`);--> statement-breakpoint
CREATE INDEX `smartcert_cohort_stats_latest_idx` ON `cohort_stats_snapshots` (`cohort_id`,`captured_at`);--> statement-breakpoint
CREATE TABLE `cohort_topics` (
	`id` text PRIMARY KEY NOT NULL,
	`cohort_id` text NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`cohort_id`) REFERENCES `learning_cohorts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `smartcert_cohort_topic_cohort_updated_idx` ON `cohort_topics` (`cohort_id`,`updated_at`);--> statement-breakpoint
CREATE INDEX `smartcert_cohort_topic_user_idx` ON `cohort_topics` (`user_id`);--> statement-breakpoint
CREATE TABLE `learning_cohort_memberships` (
	`id` text PRIMARY KEY NOT NULL,
	`cohort_id` text NOT NULL,
	`enrollment_id` text NOT NULL,
	`user_id` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`share_stage` integer DEFAULT false NOT NULL,
	`share_location` integer DEFAULT false NOT NULL,
	`share_days_in_stage` integer DEFAULT false NOT NULL,
	`allow_same_cohort_messages` integer DEFAULT false NOT NULL,
	`joined_at` integer NOT NULL,
	`completed_at` integer,
	`left_at` integer,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`cohort_id`) REFERENCES `learning_cohorts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`enrollment_id`) REFERENCES `stage_enrollments`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `smartcert_cohort_membership_enrollment_uq` ON `learning_cohort_memberships` (`enrollment_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `smartcert_cohort_membership_cohort_user_uq` ON `learning_cohort_memberships` (`cohort_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `smartcert_cohort_membership_user_status_idx` ON `learning_cohort_memberships` (`user_id`,`status`);--> statement-breakpoint
CREATE INDEX `smartcert_cohort_membership_cohort_status_idx` ON `learning_cohort_memberships` (`cohort_id`,`status`);--> statement-breakpoint
CREATE TABLE `learning_cohorts` (
	`id` text PRIMARY KEY NOT NULL,
	`cohort_key` text NOT NULL,
	`stage` integer NOT NULL,
	`track_id` text,
	`jurisdiction` text,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `learning_cohorts_cohort_key_unique` ON `learning_cohorts` (`cohort_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `smartcert_learning_cohort_scope_uq` ON `learning_cohorts` (`stage`,`track_id`,`jurisdiction`);--> statement-breakpoint
CREATE INDEX `smartcert_learning_cohort_status_idx` ON `learning_cohorts` (`status`);