CREATE TABLE `smartlingo_quick_course_offerings_v2` (
  `id` text PRIMARY KEY NOT NULL,
  `path_id` text NOT NULL,
  `target_language` text NOT NULL,
  `duration_days` integer NOT NULL,
  `level` text DEFAULT 'beginner' NOT NULL,
  `curriculum_version` text NOT NULL,
  `is_free` integer DEFAULT false NOT NULL,
  `status` text DEFAULT 'published' NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  FOREIGN KEY (`path_id`) REFERENCES `smartlingo_language_paths`(`id`) ON DELETE restrict,
  CONSTRAINT `smartlingo_quick_course_language_v2_ck` CHECK(`target_language` IN ('zh','en','es','ja','ko','fr','de','ru','it','pt','ar','hi')),
  CONSTRAINT `smartlingo_quick_course_duration_v2_ck` CHECK(`duration_days` IN (7,14,28)),
  CONSTRAINT `smartlingo_quick_course_level_v2_ck` CHECK(`level` = 'beginner'),
  CONSTRAINT `smartlingo_quick_course_free_v2_ck` CHECK(`is_free` IN (0,1)),
  CONSTRAINT `smartlingo_quick_course_status_v2_ck` CHECK(`status` IN ('published','paused','retired'))
);--> statement-breakpoint
CREATE UNIQUE INDEX `smartlingo_quick_course_path_duration_v2_uq` ON `smartlingo_quick_course_offerings_v2` (`path_id`,`duration_days`);--> statement-breakpoint
CREATE INDEX `smartlingo_quick_course_catalog_v2_idx` ON `smartlingo_quick_course_offerings_v2` (`status`,`target_language`,`duration_days`);--> statement-breakpoint

CREATE TRIGGER `smartlingo_quick_course_scope_v2_insert_trg`
BEFORE INSERT ON `smartlingo_quick_course_offerings_v2`
FOR EACH ROW WHEN NOT EXISTS (
  SELECT 1 FROM `smartlingo_language_paths` p
  WHERE p.`id` = NEW.`path_id` AND p.`target_language` = NEW.`target_language` AND p.`status` = 'published'
) OR NEW.`id` <> 'sl-quick-' || NEW.`target_language` || '-beginner-' || NEW.`duration_days` || 'd-v1'
BEGIN
  SELECT RAISE(ABORT, 'quick course requires a matching published path and stable ID');
END;--> statement-breakpoint

WITH `languages` (`target_language`,`path_id`) AS (
  VALUES ('zh','path_zh_a1'),('en','path_en_a1'),('es','path_es_a1'),('ja','path_ja_a1'),
  ('ko','path_ko_a1'),('fr','path_fr_a1'),('de','path_de_a1'),('ru','path_ru_a1'),
  ('it','path_it_a1'),('pt','path_pt_a1'),('ar','path_ar_a1'),('hi','path_hi_a1')
), `durations` (`duration_days`) AS (VALUES (7),(14),(28))
INSERT INTO `smartlingo_quick_course_offerings_v2`
  (`id`,`path_id`,`target_language`,`duration_days`,`level`,`curriculum_version`,`is_free`,`status`,`created_at`,`updated_at`)
SELECT 'sl-quick-' || l.`target_language` || '-beginner-' || d.`duration_days` || 'd-v1',
  l.`path_id`,l.`target_language`,d.`duration_days`,'beginner','2026-08-02.2',
  CASE WHEN d.`duration_days` = 7 THEN 1 ELSE 0 END,'published',1785686400,1785686400
FROM `languages` l CROSS JOIN `durations` d;--> statement-breakpoint

CREATE TABLE `smartlingo_quick_course_enrollments_v2` (
  `id` text PRIMARY KEY NOT NULL,
  `offering_id` text NOT NULL,
  `user_id` text NOT NULL,
  `class_id` text NOT NULL,
  `access_type` text NOT NULL,
  `status` text DEFAULT 'active' NOT NULL,
  `current_day` integer DEFAULT 1 NOT NULL,
  `started_at` integer NOT NULL,
  `completed_at` integer,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  FOREIGN KEY (`offering_id`) REFERENCES `smartlingo_quick_course_offerings_v2`(`id`) ON DELETE restrict,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade,
  FOREIGN KEY (`class_id`) REFERENCES `smartlingo_language_classes`(`id`) ON DELETE cascade,
  CONSTRAINT `smartlingo_quick_enrollment_access_v2_ck` CHECK(`access_type` IN ('free','entitled','payment_required')),
  CONSTRAINT `smartlingo_quick_enrollment_status_v2_ck` CHECK(`status` IN ('active','paused','completed','withdrawn','pending_payment')),
  CONSTRAINT `smartlingo_quick_enrollment_day_v2_ck` CHECK(`current_day` BETWEEN 1 AND 28)
);--> statement-breakpoint
CREATE UNIQUE INDEX `smartlingo_quick_enrollment_user_offering_v2_uq` ON `smartlingo_quick_course_enrollments_v2` (`user_id`,`offering_id`);--> statement-breakpoint
CREATE INDEX `smartlingo_quick_enrollment_user_status_v2_idx` ON `smartlingo_quick_course_enrollments_v2` (`user_id`,`status`,`updated_at`);--> statement-breakpoint

INSERT INTO `smartlingo_quick_course_enrollments_v2`
  (`id`,`offering_id`,`user_id`,`class_id`,`access_type`,`status`,`current_day`,`started_at`,`completed_at`,`created_at`,`updated_at`)
SELECT e.`id`,
  'sl-quick-' || o.`target_language` || '-beginner-' || CASE WHEN o.`duration_days` = 30 THEN 28 ELSE o.`duration_days` END || 'd-v1',
  e.`user_id`,e.`class_id`,e.`access_type`,e.`status`,MIN(e.`current_day`,28),e.`started_at`,e.`completed_at`,e.`created_at`,e.`updated_at`
FROM `smartlingo_quick_course_enrollments` e
JOIN `smartlingo_quick_course_offerings` o ON o.`id` = e.`offering_id`;
