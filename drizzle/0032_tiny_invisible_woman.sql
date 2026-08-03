CREATE TABLE `smartlingo_daily_answer_feedback` (
	`id` text PRIMARY KEY NOT NULL,
	`checkpoint_id` text NOT NULL,
	`user_id` text NOT NULL,
	`class_id` text NOT NULL,
	`task_id` text NOT NULL,
	`skill` text NOT NULL,
	`client_operation_id` text NOT NULL,
	`answer_text` text DEFAULT '' NOT NULL,
	`score` integer,
	`correct` integer DEFAULT false NOT NULL,
	`skipped` integer DEFAULT false NOT NULL,
	`explanation_zh` text NOT NULL,
	`explanation_en` text NOT NULL,
	`hint_zh` text NOT NULL,
	`hint_en` text NOT NULL,
	`content_version` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`checkpoint_id`) REFERENCES `smartlingo_daily_session_checkpoints`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`class_id`) REFERENCES `smartlingo_language_classes`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "smartlingo_daily_feedback_skill_ck" CHECK("smartlingo_daily_answer_feedback"."skill" IN ('vocabulary', 'reading', 'writing', 'listening', 'dialogue', 'quiz')),
	CONSTRAINT "smartlingo_daily_feedback_score_ck" CHECK("smartlingo_daily_answer_feedback"."score" IS NULL OR "smartlingo_daily_answer_feedback"."score" BETWEEN 0 AND 100),
	CONSTRAINT "smartlingo_daily_feedback_flags_ck" CHECK("smartlingo_daily_answer_feedback"."correct" IN (0, 1) AND "smartlingo_daily_answer_feedback"."skipped" IN (0, 1)),
	CONSTRAINT "smartlingo_daily_feedback_skip_ck" CHECK(("smartlingo_daily_answer_feedback"."skipped" = 1 AND "smartlingo_daily_answer_feedback"."score" IS NULL AND "smartlingo_daily_answer_feedback"."correct" = 0) OR ("smartlingo_daily_answer_feedback"."skipped" = 0 AND "smartlingo_daily_answer_feedback"."score" IS NOT NULL)),
	CONSTRAINT "smartlingo_daily_feedback_answer_ck" CHECK(length("smartlingo_daily_answer_feedback"."answer_text") <= 1200),
	CONSTRAINT "smartlingo_daily_feedback_copy_ck" CHECK(length(trim("smartlingo_daily_answer_feedback"."explanation_zh")) BETWEEN 1 AND 1200 AND length(trim("smartlingo_daily_answer_feedback"."explanation_en")) BETWEEN 1 AND 1200 AND length(trim("smartlingo_daily_answer_feedback"."hint_zh")) BETWEEN 1 AND 600 AND length(trim("smartlingo_daily_answer_feedback"."hint_en")) BETWEEN 1 AND 600),
	CONSTRAINT "smartlingo_daily_feedback_version_ck" CHECK(length(trim("smartlingo_daily_answer_feedback"."content_version")) BETWEEN 1 AND 48)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `smartlingo_daily_answer_feedback_client_operation_id_unique` ON `smartlingo_daily_answer_feedback` (`client_operation_id`);--> statement-breakpoint
CREATE INDEX `smartlingo_daily_feedback_checkpoint_task_idx` ON `smartlingo_daily_answer_feedback` (`checkpoint_id`,`task_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `smartlingo_daily_feedback_user_created_idx` ON `smartlingo_daily_answer_feedback` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `smartlingo_daily_session_checkpoints` (
	`id` text PRIMARY KEY NOT NULL,
	`enrollment_id` text NOT NULL,
	`user_id` text NOT NULL,
	`class_id` text NOT NULL,
	`course_day` integer NOT NULL,
	`local_date` text NOT NULL,
	`time_zone` text NOT NULL,
	`content_version` text NOT NULL,
	`plan_json` text DEFAULT '{}' NOT NULL,
	`draft_json` text DEFAULT '{}' NOT NULL,
	`active_step` text DEFAULT 'vocabulary' NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`enrollment_id`) REFERENCES `smartlingo_course_enrollments_v3`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`class_id`) REFERENCES `smartlingo_language_classes`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "smartlingo_daily_checkpoint_day_ck" CHECK("smartlingo_daily_session_checkpoints"."course_day" BETWEEN 1 AND 365),
	CONSTRAINT "smartlingo_daily_checkpoint_date_ck" CHECK(length("smartlingo_daily_session_checkpoints"."local_date") = 10),
	CONSTRAINT "smartlingo_daily_checkpoint_timezone_ck" CHECK(length(trim("smartlingo_daily_session_checkpoints"."time_zone")) BETWEEN 1 AND 64),
	CONSTRAINT "smartlingo_daily_checkpoint_version_ck" CHECK(length(trim("smartlingo_daily_session_checkpoints"."content_version")) BETWEEN 1 AND 48),
	CONSTRAINT "smartlingo_daily_checkpoint_plan_ck" CHECK(json_valid("smartlingo_daily_session_checkpoints"."plan_json") AND json_type("smartlingo_daily_session_checkpoints"."plan_json") = 'object' AND length("smartlingo_daily_session_checkpoints"."plan_json") <= 24000),
	CONSTRAINT "smartlingo_daily_checkpoint_draft_ck" CHECK(json_valid("smartlingo_daily_session_checkpoints"."draft_json") AND json_type("smartlingo_daily_session_checkpoints"."draft_json") = 'object' AND length("smartlingo_daily_session_checkpoints"."draft_json") <= 12000),
	CONSTRAINT "smartlingo_daily_checkpoint_step_ck" CHECK("smartlingo_daily_session_checkpoints"."active_step" IN ('vocabulary', 'reading', 'writing', 'listening', 'dialogue', 'exam', 'recap')),
	CONSTRAINT "smartlingo_daily_checkpoint_revision_ck" CHECK("smartlingo_daily_session_checkpoints"."revision" >= 1)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `smartlingo_daily_checkpoint_enrollment_day_uq` ON `smartlingo_daily_session_checkpoints` (`enrollment_id`,`course_day`);--> statement-breakpoint
CREATE INDEX `smartlingo_daily_checkpoint_user_date_idx` ON `smartlingo_daily_session_checkpoints` (`user_id`,`local_date`,`updated_at`);--> statement-breakpoint
CREATE INDEX `smartlingo_daily_checkpoint_class_date_idx` ON `smartlingo_daily_session_checkpoints` (`class_id`,`local_date`,`updated_at`);--> statement-breakpoint
CREATE TABLE `smartlingo_daily_sync_operations` (
	`id` text PRIMARY KEY NOT NULL,
	`checkpoint_id` text NOT NULL,
	`user_id` text NOT NULL,
	`operation` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`checkpoint_id`) REFERENCES `smartlingo_daily_session_checkpoints`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "smartlingo_daily_sync_operation_ck" CHECK("smartlingo_daily_sync_operations"."operation" IN ('save_draft', 'select_step'))
);
--> statement-breakpoint
CREATE INDEX `smartlingo_daily_sync_checkpoint_idx` ON `smartlingo_daily_sync_operations` (`checkpoint_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `smartlingo_daily_sync_user_idx` ON `smartlingo_daily_sync_operations` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `smartlingo_learning_streaks` (
	`user_id` text PRIMARY KEY NOT NULL,
	`time_zone` text NOT NULL,
	`current_streak` integer DEFAULT 0 NOT NULL,
	`longest_streak` integer DEFAULT 0 NOT NULL,
	`last_qualified_date` text,
	`repaired_date` text,
	`repair_window_started_date` text,
	`repair_credits` integer DEFAULT 1 NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "smartlingo_learning_streak_timezone_ck" CHECK(length(trim("smartlingo_learning_streaks"."time_zone")) BETWEEN 1 AND 64),
	CONSTRAINT "smartlingo_learning_streak_counts_ck" CHECK("smartlingo_learning_streaks"."current_streak" >= 0 AND "smartlingo_learning_streaks"."longest_streak" >= "smartlingo_learning_streaks"."current_streak"),
	CONSTRAINT "smartlingo_learning_streak_date_ck" CHECK(("smartlingo_learning_streaks"."last_qualified_date" IS NULL OR length("smartlingo_learning_streaks"."last_qualified_date") = 10) AND ("smartlingo_learning_streaks"."repaired_date" IS NULL OR length("smartlingo_learning_streaks"."repaired_date") = 10) AND ("smartlingo_learning_streaks"."repair_window_started_date" IS NULL OR length("smartlingo_learning_streaks"."repair_window_started_date") = 10)),
	CONSTRAINT "smartlingo_learning_streak_credit_ck" CHECK("smartlingo_learning_streaks"."repair_credits" IN (0, 1))
);
--> statement-breakpoint
CREATE INDEX `smartlingo_learning_streak_last_date_idx` ON `smartlingo_learning_streaks` (`last_qualified_date`,`updated_at`);--> statement-breakpoint
CREATE TABLE `smartlingo_learning_xp_ledger` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`class_id` text NOT NULL,
	`activity_event_id` text NOT NULL,
	`xp` integer NOT NULL,
	`reason` text NOT NULL,
	`local_date` text NOT NULL,
	`time_zone` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`class_id`) REFERENCES `smartlingo_language_classes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`activity_event_id`) REFERENCES `smartlingo_learning_activity_events`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "smartlingo_learning_xp_amount_ck" CHECK("smartlingo_learning_xp_ledger"."xp" BETWEEN 1 AND 100),
	CONSTRAINT "smartlingo_learning_xp_reason_ck" CHECK("smartlingo_learning_xp_ledger"."reason" IN ('daily_practice', 'vocabulary_review', 'daily_quiz', 'pronunciation_review')),
	CONSTRAINT "smartlingo_learning_xp_date_ck" CHECK(length("smartlingo_learning_xp_ledger"."local_date") = 10),
	CONSTRAINT "smartlingo_learning_xp_timezone_ck" CHECK(length(trim("smartlingo_learning_xp_ledger"."time_zone")) BETWEEN 1 AND 64)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `smartlingo_learning_xp_ledger_activity_event_id_unique` ON `smartlingo_learning_xp_ledger` (`activity_event_id`);--> statement-breakpoint
CREATE INDEX `smartlingo_learning_xp_user_date_idx` ON `smartlingo_learning_xp_ledger` (`user_id`,`local_date`,`created_at`);--> statement-breakpoint
CREATE INDEX `smartlingo_learning_xp_class_date_idx` ON `smartlingo_learning_xp_ledger` (`class_id`,`local_date`,`created_at`);