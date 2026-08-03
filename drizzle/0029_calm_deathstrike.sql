CREATE TABLE `smartlingo_course_certificates` (
	`id` text PRIMARY KEY NOT NULL,
	`certificate_number` text NOT NULL,
	`verification_code` text NOT NULL,
	`enrollment_id` text NOT NULL,
	`offering_id` text NOT NULL,
	`user_id` text NOT NULL,
	`class_id` text NOT NULL,
	`member_name` text NOT NULL,
	`course_title_zh` text NOT NULL,
	`course_title_en` text NOT NULL,
	`target_language` text NOT NULL,
	`level` text DEFAULT 'beginner' NOT NULL,
	`duration_days` integer NOT NULL,
	`completed_days` integer NOT NULL,
	`final_score` integer NOT NULL,
	`pass_score` integer DEFAULT 60 NOT NULL,
	`completion_reason` text NOT NULL,
	`curriculum_version` text NOT NULL,
	`issued_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`enrollment_id`) REFERENCES `smartlingo_quick_course_enrollments_v2`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`offering_id`) REFERENCES `smartlingo_quick_course_offerings_v2`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`class_id`) REFERENCES `smartlingo_language_classes`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "smartlingo_certificate_member_ck" CHECK(length(trim("smartlingo_course_certificates"."member_name")) BETWEEN 1 AND 120),
	CONSTRAINT "smartlingo_certificate_language_ck" CHECK("smartlingo_course_certificates"."target_language" IN ('zh', 'en', 'es', 'ja', 'ko', 'fr', 'de', 'ru', 'it', 'pt', 'ar', 'hi')),
	CONSTRAINT "smartlingo_certificate_level_ck" CHECK("smartlingo_course_certificates"."level" = 'beginner'),
	CONSTRAINT "smartlingo_certificate_duration_ck" CHECK("smartlingo_course_certificates"."duration_days" IN (7, 14, 28)),
	CONSTRAINT "smartlingo_certificate_days_ck" CHECK("smartlingo_course_certificates"."completed_days" BETWEEN 1 AND "smartlingo_course_certificates"."duration_days"),
	CONSTRAINT "smartlingo_certificate_score_ck" CHECK("smartlingo_course_certificates"."final_score" BETWEEN 60 AND 100 AND "smartlingo_course_certificates"."pass_score" = 60),
	CONSTRAINT "smartlingo_certificate_reason_ck" CHECK("smartlingo_course_certificates"."completion_reason" IN ('course_complete', 'early_mastery'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `smartlingo_course_certificates_certificate_number_unique` ON `smartlingo_course_certificates` (`certificate_number`);--> statement-breakpoint
CREATE UNIQUE INDEX `smartlingo_course_certificates_verification_code_unique` ON `smartlingo_course_certificates` (`verification_code`);--> statement-breakpoint
CREATE UNIQUE INDEX `smartlingo_course_certificates_enrollment_id_unique` ON `smartlingo_course_certificates` (`enrollment_id`);--> statement-breakpoint
CREATE INDEX `smartlingo_certificate_user_issued_idx` ON `smartlingo_course_certificates` (`user_id`,`issued_at`);--> statement-breakpoint
CREATE INDEX `smartlingo_certificate_class_score_idx` ON `smartlingo_course_certificates` (`class_id`,`final_score`,`issued_at`);--> statement-breakpoint
CREATE INDEX `smartlingo_certificate_rank_idx` ON `smartlingo_course_certificates` (`final_score`,`issued_at`);--> statement-breakpoint
CREATE TABLE `smartlingo_quick_course_daily_scores` (
	`id` text PRIMARY KEY NOT NULL,
	`enrollment_id` text NOT NULL,
	`user_id` text NOT NULL,
	`class_id` text NOT NULL,
	`course_day` integer NOT NULL,
	`local_date` text NOT NULL,
	`score` integer NOT NULL,
	`skill_scores` text DEFAULT '{}' NOT NULL,
	`quiz_score` integer,
	`is_complete` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`enrollment_id`) REFERENCES `smartlingo_quick_course_enrollments_v2`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`class_id`) REFERENCES `smartlingo_language_classes`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "smartlingo_quick_daily_day_ck" CHECK("smartlingo_quick_course_daily_scores"."course_day" BETWEEN 1 AND 28),
	CONSTRAINT "smartlingo_quick_daily_date_ck" CHECK(length("smartlingo_quick_course_daily_scores"."local_date") = 10),
	CONSTRAINT "smartlingo_quick_daily_score_ck" CHECK("smartlingo_quick_course_daily_scores"."score" BETWEEN 1 AND 100),
	CONSTRAINT "smartlingo_quick_daily_skills_ck" CHECK(json_valid("smartlingo_quick_course_daily_scores"."skill_scores") AND json_type("smartlingo_quick_course_daily_scores"."skill_scores") = 'object' AND length("smartlingo_quick_course_daily_scores"."skill_scores") <= 1000),
	CONSTRAINT "smartlingo_quick_daily_quiz_ck" CHECK("smartlingo_quick_course_daily_scores"."quiz_score" IS NULL OR "smartlingo_quick_course_daily_scores"."quiz_score" BETWEEN 0 AND 100),
	CONSTRAINT "smartlingo_quick_daily_complete_ck" CHECK("smartlingo_quick_course_daily_scores"."is_complete" IN (0, 1))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `smartlingo_quick_daily_enrollment_date_uq` ON `smartlingo_quick_course_daily_scores` (`enrollment_id`,`local_date`);--> statement-breakpoint
CREATE UNIQUE INDEX `smartlingo_quick_daily_enrollment_day_uq` ON `smartlingo_quick_course_daily_scores` (`enrollment_id`,`course_day`);--> statement-breakpoint
CREATE INDEX `smartlingo_quick_daily_user_date_idx` ON `smartlingo_quick_course_daily_scores` (`user_id`,`local_date`);--> statement-breakpoint
CREATE INDEX `smartlingo_quick_daily_class_date_idx` ON `smartlingo_quick_course_daily_scores` (`class_id`,`local_date`);