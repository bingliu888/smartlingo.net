CREATE TABLE `smartlingo_course_certificates_v2` (
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
	`level` text NOT NULL,
	`duration_days` integer NOT NULL,
	`start_day` integer DEFAULT 1 NOT NULL,
	`completed_days` integer NOT NULL,
	`final_score` integer NOT NULL,
	`pass_score` integer DEFAULT 60 NOT NULL,
	`completion_reason` text NOT NULL,
	`curriculum_version` text NOT NULL,
	`issued_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`enrollment_id`) REFERENCES `smartlingo_course_enrollments_v3`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`offering_id`) REFERENCES `smartlingo_course_offerings_v3`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`class_id`) REFERENCES `smartlingo_language_classes`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "smartlingo_certificate_v2_member_ck" CHECK(length(trim("smartlingo_course_certificates_v2"."member_name")) BETWEEN 1 AND 120),
	CONSTRAINT "smartlingo_certificate_v2_language_ck" CHECK("smartlingo_course_certificates_v2"."target_language" IN ('zh', 'en', 'es', 'ja', 'ko', 'fr', 'de', 'ru', 'it', 'pt', 'ar', 'hi')),
	CONSTRAINT "smartlingo_certificate_v2_level_ck" CHECK("smartlingo_course_certificates_v2"."level" IN ('beginner', 'intermediate', 'advanced')),
	CONSTRAINT "smartlingo_certificate_v2_duration_ck" CHECK("smartlingo_course_certificates_v2"."duration_days" IN (7, 14, 30, 60, 90, 180, 365)),
	CONSTRAINT "smartlingo_certificate_v2_score_ck" CHECK("smartlingo_course_certificates_v2"."final_score" BETWEEN 60 AND 100 AND "smartlingo_course_certificates_v2"."pass_score" = 60),
	CONSTRAINT "smartlingo_certificate_v2_reason_ck" CHECK("smartlingo_course_certificates_v2"."completion_reason" IN ('course_complete', 'early_mastery', 'exam_pass'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `smartlingo_course_certificates_v2_certificate_number_unique` ON `smartlingo_course_certificates_v2` (`certificate_number`);--> statement-breakpoint
CREATE UNIQUE INDEX `smartlingo_course_certificates_v2_verification_code_unique` ON `smartlingo_course_certificates_v2` (`verification_code`);--> statement-breakpoint
CREATE UNIQUE INDEX `smartlingo_course_certificates_v2_enrollment_id_unique` ON `smartlingo_course_certificates_v2` (`enrollment_id`);--> statement-breakpoint
CREATE INDEX `smartlingo_certificate_v2_user_issued_idx` ON `smartlingo_course_certificates_v2` (`user_id`,`issued_at`);--> statement-breakpoint
CREATE INDEX `smartlingo_certificate_v2_class_score_idx` ON `smartlingo_course_certificates_v2` (`class_id`,`final_score`,`issued_at`);--> statement-breakpoint
CREATE INDEX `smartlingo_certificate_v2_rank_idx` ON `smartlingo_course_certificates_v2` (`final_score`,`issued_at`);--> statement-breakpoint
CREATE TABLE `smartlingo_course_day_progress_v2` (
	`id` text PRIMARY KEY NOT NULL,
	`enrollment_id` text NOT NULL,
	`user_id` text NOT NULL,
	`class_id` text NOT NULL,
	`course_day` integer NOT NULL,
	`started_date` text NOT NULL,
	`last_activity_date` text NOT NULL,
	`score` integer DEFAULT 1 NOT NULL,
	`skill_scores` text DEFAULT '{}' NOT NULL,
	`quiz_score` integer,
	`is_complete` integer DEFAULT false NOT NULL,
	`started_at` integer NOT NULL,
	`completed_at` integer,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`enrollment_id`) REFERENCES `smartlingo_course_enrollments_v3`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`class_id`) REFERENCES `smartlingo_language_classes`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "smartlingo_course_day_v2_day_ck" CHECK("smartlingo_course_day_progress_v2"."course_day" BETWEEN 1 AND 365),
	CONSTRAINT "smartlingo_course_day_v2_date_ck" CHECK(length("smartlingo_course_day_progress_v2"."started_date") = 10 AND length("smartlingo_course_day_progress_v2"."last_activity_date") = 10),
	CONSTRAINT "smartlingo_course_day_v2_score_ck" CHECK("smartlingo_course_day_progress_v2"."score" BETWEEN 1 AND 100),
	CONSTRAINT "smartlingo_course_day_v2_skills_ck" CHECK(json_valid("smartlingo_course_day_progress_v2"."skill_scores") AND json_type("smartlingo_course_day_progress_v2"."skill_scores") = 'object' AND length("smartlingo_course_day_progress_v2"."skill_scores") <= 1000),
	CONSTRAINT "smartlingo_course_day_v2_quiz_ck" CHECK("smartlingo_course_day_progress_v2"."quiz_score" IS NULL OR "smartlingo_course_day_progress_v2"."quiz_score" BETWEEN 0 AND 100),
	CONSTRAINT "smartlingo_course_day_v2_complete_ck" CHECK("smartlingo_course_day_progress_v2"."is_complete" IN (0, 1))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `smartlingo_course_day_v2_enrollment_day_uq` ON `smartlingo_course_day_progress_v2` (`enrollment_id`,`course_day`);--> statement-breakpoint
CREATE INDEX `smartlingo_course_day_v2_user_date_idx` ON `smartlingo_course_day_progress_v2` (`user_id`,`last_activity_date`);--> statement-breakpoint
CREATE TABLE `smartlingo_course_enrollments_v3` (
	`id` text PRIMARY KEY NOT NULL,
	`offering_id` text NOT NULL,
	`user_id` text NOT NULL,
	`class_id` text NOT NULL,
	`access_type` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`start_day` integer DEFAULT 1 NOT NULL,
	`current_day` integer DEFAULT 1 NOT NULL,
	`daily_seconds` integer DEFAULT 3600 NOT NULL,
	`started_at` integer NOT NULL,
	`completed_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`offering_id`) REFERENCES `smartlingo_course_offerings_v3`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`class_id`) REFERENCES `smartlingo_language_classes`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "smartlingo_course_enrollment_v3_access_ck" CHECK("smartlingo_course_enrollments_v3"."access_type" IN ('free', 'entitled', 'payment_required')),
	CONSTRAINT "smartlingo_course_enrollment_v3_status_ck" CHECK("smartlingo_course_enrollments_v3"."status" IN ('active', 'paused', 'completed', 'withdrawn', 'pending_payment')),
	CONSTRAINT "smartlingo_course_enrollment_v3_start_ck" CHECK("smartlingo_course_enrollments_v3"."start_day" BETWEEN 1 AND 365),
	CONSTRAINT "smartlingo_course_enrollment_v3_day_ck" CHECK("smartlingo_course_enrollments_v3"."current_day" BETWEEN "smartlingo_course_enrollments_v3"."start_day" AND 365),
	CONSTRAINT "smartlingo_course_enrollment_v3_timer_ck" CHECK("smartlingo_course_enrollments_v3"."daily_seconds" = 3600)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `smartlingo_course_enrollment_v3_user_offering_uq` ON `smartlingo_course_enrollments_v3` (`user_id`,`offering_id`);--> statement-breakpoint
CREATE INDEX `smartlingo_course_enrollment_v3_user_status_idx` ON `smartlingo_course_enrollments_v3` (`user_id`,`status`,`updated_at`);--> statement-breakpoint
CREATE TABLE `smartlingo_course_offerings_v3` (
	`id` text PRIMARY KEY NOT NULL,
	`path_id` text NOT NULL,
	`target_language` text NOT NULL,
	`level` text NOT NULL,
	`duration_days` integer NOT NULL,
	`sequence` integer NOT NULL,
	`curriculum_version` text NOT NULL,
	`is_free` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'published' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`path_id`) REFERENCES `smartlingo_language_paths`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "smartlingo_course_v3_language_ck" CHECK("smartlingo_course_offerings_v3"."target_language" IN ('zh', 'en', 'es', 'ja', 'ko', 'fr', 'de', 'ru', 'it', 'pt', 'ar', 'hi')),
	CONSTRAINT "smartlingo_course_v3_level_ck" CHECK("smartlingo_course_offerings_v3"."level" IN ('beginner', 'intermediate', 'advanced')),
	CONSTRAINT "smartlingo_course_v3_duration_ck" CHECK("smartlingo_course_offerings_v3"."duration_days" IN (7, 14, 30, 60, 90, 180, 365)),
	CONSTRAINT "smartlingo_course_v3_sequence_ck" CHECK("smartlingo_course_offerings_v3"."sequence" BETWEEN 1 AND 3),
	CONSTRAINT "smartlingo_course_v3_free_ck" CHECK("smartlingo_course_offerings_v3"."is_free" IN (0, 1)),
	CONSTRAINT "smartlingo_course_v3_status_ck" CHECK("smartlingo_course_offerings_v3"."status" IN ('published', 'paused', 'retired'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `smartlingo_course_v3_path_level_duration_uq` ON `smartlingo_course_offerings_v3` (`path_id`,`level`,`duration_days`);--> statement-breakpoint
CREATE INDEX `smartlingo_course_v3_catalog_idx` ON `smartlingo_course_offerings_v3` (`status`,`target_language`,`level`,`sequence`);--> statement-breakpoint
CREATE TABLE `smartlingo_course_session_state` (
	`enrollment_id` text PRIMARY KEY NOT NULL,
	`course_day` integer NOT NULL,
	`duration_seconds` integer DEFAULT 3600 NOT NULL,
	`remaining_seconds` integer DEFAULT 3600 NOT NULL,
	`status` text DEFAULT 'ready' NOT NULL,
	`last_started_at` integer,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`enrollment_id`) REFERENCES `smartlingo_course_enrollments_v3`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "smartlingo_course_session_day_ck" CHECK("smartlingo_course_session_state"."course_day" BETWEEN 1 AND 365),
	CONSTRAINT "smartlingo_course_session_duration_ck" CHECK("smartlingo_course_session_state"."duration_seconds" = 3600),
	CONSTRAINT "smartlingo_course_session_remaining_ck" CHECK("smartlingo_course_session_state"."remaining_seconds" BETWEEN 0 AND 3600),
	CONSTRAINT "smartlingo_course_session_status_ck" CHECK("smartlingo_course_session_state"."status" IN ('ready', 'running', 'paused', 'completed'))
);--> statement-breakpoint

WITH `languages` (`target_language`,`path_id`) AS (
  VALUES ('zh','path_zh_a1'),('en','path_en_a1'),('es','path_es_a1'),('ja','path_ja_a1'),
  ('ko','path_ko_a1'),('fr','path_fr_a1'),('de','path_de_a1'),('ru','path_ru_a1'),
  ('it','path_it_a1'),('pt','path_pt_a1'),('ar','path_ar_a1'),('hi','path_hi_a1')
), `durations` (`level`,`duration_days`,`sequence`) AS (
  VALUES ('beginner',7,1),('beginner',14,2),('beginner',30,3),
         ('intermediate',30,1),('intermediate',60,2),('intermediate',90,3),
         ('advanced',90,1),('advanced',180,2),('advanced',365,3)
)
INSERT INTO `smartlingo_course_offerings_v3`
  (`id`,`path_id`,`target_language`,`level`,`duration_days`,`sequence`,`curriculum_version`,`is_free`,`status`,`created_at`,`updated_at`)
SELECT 'sl-course-' || l.`target_language` || '-' || d.`level` || '-' || d.`duration_days` || 'd-v1',
  l.`path_id`,l.`target_language`,d.`level`,d.`duration_days`,d.`sequence`,'2026-08-02.3',
  CASE WHEN d.`level` = 'beginner' AND d.`duration_days` = 7 THEN 1 ELSE 0 END,
  'published',1785772800,1785772800
FROM `languages` l CROSS JOIN `durations` d;--> statement-breakpoint

INSERT INTO `smartlingo_course_enrollments_v3`
  (`id`,`offering_id`,`user_id`,`class_id`,`access_type`,`status`,`start_day`,`current_day`,`daily_seconds`,`started_at`,`completed_at`,`created_at`,`updated_at`)
SELECT e.`id`,
  'sl-course-' || o.`target_language` || '-beginner-' || CASE WHEN o.`duration_days` = 28 THEN 30 ELSE o.`duration_days` END || 'd-v1',
  e.`user_id`,e.`class_id`,e.`access_type`,e.`status`,1,e.`current_day`,3600,e.`started_at`,e.`completed_at`,e.`created_at`,e.`updated_at`
FROM `smartlingo_quick_course_enrollments_v2` e
JOIN `smartlingo_quick_course_offerings_v2` o ON o.`id` = e.`offering_id`;--> statement-breakpoint

INSERT INTO `smartlingo_course_day_progress_v2`
  (`id`,`enrollment_id`,`user_id`,`class_id`,`course_day`,`started_date`,`last_activity_date`,`score`,`skill_scores`,`quiz_score`,`is_complete`,`started_at`,`completed_at`,`updated_at`)
SELECT s.`id`,s.`enrollment_id`,s.`user_id`,s.`class_id`,s.`course_day`,s.`local_date`,s.`local_date`,s.`score`,s.`skill_scores`,s.`quiz_score`,s.`is_complete`,s.`created_at`,
  CASE WHEN s.`is_complete` = 1 THEN s.`updated_at` ELSE NULL END,s.`updated_at`
FROM `smartlingo_quick_course_daily_scores` s;--> statement-breakpoint

INSERT INTO `smartlingo_course_certificates_v2`
  (`id`,`certificate_number`,`verification_code`,`enrollment_id`,`offering_id`,`user_id`,`class_id`,`member_name`,`course_title_zh`,`course_title_en`,`target_language`,`level`,`duration_days`,`start_day`,`completed_days`,`final_score`,`pass_score`,`completion_reason`,`curriculum_version`,`issued_at`,`created_at`)
SELECT c.`id`,c.`certificate_number`,c.`verification_code`,c.`enrollment_id`,
  'sl-course-' || c.`target_language` || '-beginner-' || CASE WHEN c.`duration_days` = 28 THEN 30 ELSE c.`duration_days` END || 'd-v1',
  c.`user_id`,c.`class_id`,c.`member_name`,c.`course_title_zh`,c.`course_title_en`,c.`target_language`,c.`level`,
  CASE WHEN c.`duration_days` = 28 THEN 30 ELSE c.`duration_days` END,1,c.`completed_days`,c.`final_score`,c.`pass_score`,c.`completion_reason`,'2026-08-02.3',c.`issued_at`,c.`created_at`
FROM `smartlingo_course_certificates` c;--> statement-breakpoint

INSERT INTO `smartlingo_course_session_state`
  (`enrollment_id`,`course_day`,`duration_seconds`,`remaining_seconds`,`status`,`last_started_at`,`updated_at`)
SELECT e.`id`,e.`current_day`,3600,3600,
  CASE WHEN e.`status` = 'completed' THEN 'completed' ELSE 'ready' END,NULL,e.`updated_at`
FROM `smartlingo_course_enrollments_v3` e;
