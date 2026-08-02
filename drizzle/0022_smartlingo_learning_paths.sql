CREATE TABLE `smartlingo_learning_path_units` (
	`id` text PRIMARY KEY NOT NULL,
	`path_id` text NOT NULL,
	`target_language` text NOT NULL,
	`stage_id` text NOT NULL,
	`sequence` integer NOT NULL,
	`unit_key` text NOT NULL,
	`prerequisite_unit_id` text,
	`availability` text NOT NULL,
	`content_version` text NOT NULL,
	`source_type` text DEFAULT 'smartlingo_original' NOT NULL,
	FOREIGN KEY (`path_id`) REFERENCES `smartlingo_language_paths`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`prerequisite_unit_id`) REFERENCES `smartlingo_learning_path_units`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT `smartlingo_path_unit_language_ck` CHECK(`target_language` IN ('zh', 'en', 'es', 'ja', 'ko', 'fr', 'de', 'ru', 'it', 'pt', 'ar', 'hi')),
	CONSTRAINT `smartlingo_path_unit_stage_ck` CHECK(`stage_id` IN ('foundation', 'everyday', 'independent')),
	CONSTRAINT `smartlingo_path_unit_sequence_ck` CHECK(`sequence` BETWEEN 1 AND 9),
	CONSTRAINT `smartlingo_path_unit_stage_sequence_ck` CHECK((`stage_id` = 'foundation' AND `sequence` BETWEEN 1 AND 3) OR (`stage_id` = 'everyday' AND `sequence` BETWEEN 4 AND 6) OR (`stage_id` = 'independent' AND `sequence` BETWEEN 7 AND 9)),
	CONSTRAINT `smartlingo_path_unit_key_ck` CHECK(length(trim(`unit_key`)) BETWEEN 1 AND 80),
	CONSTRAINT `smartlingo_path_unit_prerequisite_ck` CHECK((`sequence` = 1 AND `prerequisite_unit_id` IS NULL) OR (`sequence` > 1 AND `prerequisite_unit_id` IS NOT NULL)),
	CONSTRAINT `smartlingo_path_unit_availability_ck` CHECK(`availability` IN ('available', 'preview')),
	CONSTRAINT `smartlingo_path_unit_version_ck` CHECK(length(trim(`content_version`)) BETWEEN 1 AND 48),
	CONSTRAINT `smartlingo_path_unit_source_ck` CHECK(`source_type` = 'smartlingo_original')
);--> statement-breakpoint
CREATE UNIQUE INDEX `smartlingo_path_unit_path_key_uq` ON `smartlingo_learning_path_units` (`path_id`,`unit_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `smartlingo_path_unit_path_sequence_uq` ON `smartlingo_learning_path_units` (`path_id`,`sequence`);--> statement-breakpoint
CREATE INDEX `smartlingo_path_unit_path_stage_idx` ON `smartlingo_learning_path_units` (`path_id`,`target_language`,`stage_id`,`sequence`);--> statement-breakpoint

CREATE TRIGGER `smartlingo_path_unit_scope_insert_trg`
BEFORE INSERT ON `smartlingo_learning_path_units`
FOR EACH ROW
WHEN NEW.`id` <> 'sl-unit-' || NEW.`target_language` || '-' || NEW.`unit_key`
  OR NOT EXISTS (
    SELECT 1 FROM `smartlingo_language_paths` AS `path`
    WHERE `path`.`id` = NEW.`path_id`
      AND `path`.`target_language` = NEW.`target_language`
      AND `path`.`status` = 'published'
  )
BEGIN
  SELECT RAISE(ABORT, 'smartlingo path unit requires an exact ID and matching published language path');
END;--> statement-breakpoint
CREATE TRIGGER `smartlingo_path_unit_scope_update_trg`
BEFORE UPDATE OF `id`, `path_id`, `target_language`, `unit_key` ON `smartlingo_learning_path_units`
FOR EACH ROW
WHEN NEW.`id` <> 'sl-unit-' || NEW.`target_language` || '-' || NEW.`unit_key`
  OR NOT EXISTS (
    SELECT 1 FROM `smartlingo_language_paths` AS `path`
    WHERE `path`.`id` = NEW.`path_id`
      AND `path`.`target_language` = NEW.`target_language`
      AND `path`.`status` = 'published'
  )
BEGIN
  SELECT RAISE(ABORT, 'smartlingo path unit requires an exact ID and matching published language path');
END;--> statement-breakpoint

WITH `languages` (`target_language`, `path_id`) AS (
  VALUES
    ('zh', 'path_zh_a1'), ('en', 'path_en_a1'), ('es', 'path_es_a1'),
    ('ja', 'path_ja_a1'), ('ko', 'path_ko_a1'), ('fr', 'path_fr_a1'),
    ('de', 'path_de_a1'), ('ru', 'path_ru_a1'), ('it', 'path_it_a1'),
    ('pt', 'path_pt_a1'), ('ar', 'path_ar_a1'), ('hi', 'path_hi_a1')
),
`units` (`sequence`, `stage_id`, `unit_key`, `prerequisite_key`, `availability`) AS (
  VALUES
    (1, 'foundation', 'first-contact', NULL, 'available'),
    (2, 'foundation', 'personal-details', 'first-contact', 'available'),
    (3, 'foundation', 'everyday-needs', 'personal-details', 'available'),
    (4, 'everyday', 'directions-and-services', 'everyday-needs', 'preview'),
    (5, 'everyday', 'plans-and-time', 'directions-and-services', 'preview'),
    (6, 'everyday', 'solve-a-problem', 'plans-and-time', 'preview'),
    (7, 'independent', 'explain-a-choice', 'solve-a-problem', 'preview'),
    (8, 'independent', 'collaborate-on-a-plan', 'explain-a-choice', 'preview'),
    (9, 'independent', 'complete-a-real-task', 'collaborate-on-a-plan', 'preview')
)
INSERT INTO `smartlingo_learning_path_units`
  (`id`, `path_id`, `target_language`, `stage_id`, `sequence`, `unit_key`,
   `prerequisite_unit_id`, `availability`, `content_version`, `source_type`)
SELECT
  'sl-unit-' || `languages`.`target_language` || '-' || `units`.`unit_key`,
  `languages`.`path_id`,
  `languages`.`target_language`,
  `units`.`stage_id`,
  `units`.`sequence`,
  `units`.`unit_key`,
  CASE WHEN `units`.`prerequisite_key` IS NULL THEN NULL
    ELSE 'sl-unit-' || `languages`.`target_language` || '-' || `units`.`prerequisite_key` END,
  `units`.`availability`,
  '2026-08-02.1',
  'smartlingo_original'
FROM `languages` CROSS JOIN `units`;--> statement-breakpoint

CREATE TRIGGER `smartlingo_path_unit_prerequisite_insert_trg`
BEFORE INSERT ON `smartlingo_learning_path_units`
FOR EACH ROW
WHEN NEW.`prerequisite_unit_id` IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM `smartlingo_learning_path_units` AS `prerequisite`
    WHERE `prerequisite`.`id` = NEW.`prerequisite_unit_id`
      AND `prerequisite`.`path_id` = NEW.`path_id`
      AND `prerequisite`.`target_language` = NEW.`target_language`
      AND `prerequisite`.`sequence` = NEW.`sequence` - 1
  )
BEGIN
  SELECT RAISE(ABORT, 'smartlingo path unit prerequisite must be the preceding unit in the same path');
END;--> statement-breakpoint
CREATE TRIGGER `smartlingo_path_unit_prerequisite_update_trg`
BEFORE UPDATE OF `path_id`, `target_language`, `sequence`, `prerequisite_unit_id` ON `smartlingo_learning_path_units`
FOR EACH ROW
WHEN NEW.`prerequisite_unit_id` IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM `smartlingo_learning_path_units` AS `prerequisite`
    WHERE `prerequisite`.`id` = NEW.`prerequisite_unit_id`
      AND `prerequisite`.`path_id` = NEW.`path_id`
      AND `prerequisite`.`target_language` = NEW.`target_language`
      AND `prerequisite`.`sequence` = NEW.`sequence` - 1
  )
BEGIN
  SELECT RAISE(ABORT, 'smartlingo path unit prerequisite must be the preceding unit in the same path');
END;--> statement-breakpoint

CREATE TABLE `smartlingo_learning_plans` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`path_id` text NOT NULL,
	`target_language` text NOT NULL,
	`use_case` text NOT NULL,
	`daily_minutes` integer NOT NULL,
	`self_reported_level` text NOT NULL,
	`entry_mode` text NOT NULL,
	`content_version` text NOT NULL,
	`current_stage_id` text,
	`current_unit_id` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`path_id`) REFERENCES `smartlingo_language_paths`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`current_unit_id`) REFERENCES `smartlingo_learning_path_units`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT `smartlingo_learning_plan_language_ck` CHECK(`target_language` IN ('zh', 'en', 'es', 'ja', 'ko', 'fr', 'de', 'ru', 'it', 'pt', 'ar', 'hi')),
	CONSTRAINT `smartlingo_learning_plan_use_case_ck` CHECK(`use_case` IN ('daily_life', 'travel', 'work', 'study', 'community')),
	CONSTRAINT `smartlingo_learning_plan_daily_minutes_ck` CHECK(`daily_minutes` IN (5, 10, 15, 20)),
	CONSTRAINT `smartlingo_learning_plan_level_ck` CHECK(`self_reported_level` IN ('beginner', 'intermediate', 'advanced')),
	CONSTRAINT `smartlingo_learning_plan_entry_mode_ck` CHECK(`entry_mode` IN ('adaptive', 'self_selected', 'fundamentals')),
	CONSTRAINT `smartlingo_learning_plan_version_ck` CHECK(length(trim(`content_version`)) BETWEEN 1 AND 48),
	CONSTRAINT `smartlingo_learning_plan_stage_ck` CHECK(`current_stage_id` IS NULL OR `current_stage_id` IN ('foundation', 'everyday', 'independent')),
	CONSTRAINT `smartlingo_learning_plan_unit_ck` CHECK(`current_unit_id` IS NULL OR length(trim(`current_unit_id`)) BETWEEN 1 AND 120),
	CONSTRAINT `smartlingo_learning_plan_position_ck` CHECK((`current_stage_id` IS NULL) = (`current_unit_id` IS NULL)),
	CONSTRAINT `smartlingo_learning_plan_active_ck` CHECK(`is_active` IN (0, 1))
);--> statement-breakpoint
CREATE UNIQUE INDEX `smartlingo_learning_plan_user_path_uq` ON `smartlingo_learning_plans` (`user_id`,`path_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `smartlingo_learning_plan_active_user_uq` ON `smartlingo_learning_plans` (`user_id`) WHERE `is_active` = 1;--> statement-breakpoint
CREATE INDEX `smartlingo_learning_plan_user_updated_idx` ON `smartlingo_learning_plans` (`user_id`,`updated_at`);--> statement-breakpoint
CREATE INDEX `smartlingo_learning_plan_path_idx` ON `smartlingo_learning_plans` (`path_id`,`target_language`);--> statement-breakpoint

CREATE TRIGGER `smartlingo_learning_plan_scope_insert_trg`
BEFORE INSERT ON `smartlingo_learning_plans`
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1 FROM `smartlingo_language_paths` AS `path`
  WHERE `path`.`id` = NEW.`path_id`
    AND `path`.`target_language` = NEW.`target_language`
    AND `path`.`status` = 'published'
)
BEGIN
  SELECT RAISE(ABORT, 'smartlingo learning plan requires its matching published language path');
END;--> statement-breakpoint
CREATE TRIGGER `smartlingo_learning_plan_scope_update_trg`
BEFORE UPDATE OF `path_id`, `target_language` ON `smartlingo_learning_plans`
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1 FROM `smartlingo_language_paths` AS `path`
  WHERE `path`.`id` = NEW.`path_id`
    AND `path`.`target_language` = NEW.`target_language`
    AND `path`.`status` = 'published'
)
BEGIN
  SELECT RAISE(ABORT, 'smartlingo learning plan requires its matching published language path');
END;--> statement-breakpoint

CREATE TRIGGER `smartlingo_learning_plan_unit_insert_trg`
BEFORE INSERT ON `smartlingo_learning_plans`
FOR EACH ROW
WHEN NEW.`current_unit_id` IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM `smartlingo_learning_path_units` AS `unit`
    WHERE `unit`.`id` = NEW.`current_unit_id`
      AND `unit`.`path_id` = NEW.`path_id`
      AND `unit`.`target_language` = NEW.`target_language`
      AND `unit`.`stage_id` = NEW.`current_stage_id`
  )
BEGIN
  SELECT RAISE(ABORT, 'smartlingo learning plan unit must exist in its matching path, language, and stage');
END;--> statement-breakpoint
CREATE TRIGGER `smartlingo_learning_plan_unit_update_trg`
BEFORE UPDATE OF `path_id`, `target_language`, `current_stage_id`, `current_unit_id` ON `smartlingo_learning_plans`
FOR EACH ROW
WHEN NEW.`current_unit_id` IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM `smartlingo_learning_path_units` AS `unit`
    WHERE `unit`.`id` = NEW.`current_unit_id`
      AND `unit`.`path_id` = NEW.`path_id`
      AND `unit`.`target_language` = NEW.`target_language`
      AND `unit`.`stage_id` = NEW.`current_stage_id`
  )
BEGIN
  SELECT RAISE(ABORT, 'smartlingo learning plan unit must exist in its matching path, language, and stage');
END;
