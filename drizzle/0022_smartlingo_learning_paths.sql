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
  AND NEW.`current_unit_id` NOT LIKE 'sl-unit-' || NEW.`target_language` || '-%'
BEGIN
  SELECT RAISE(ABORT, 'smartlingo learning plan unit must belong to its target language');
END;--> statement-breakpoint
CREATE TRIGGER `smartlingo_learning_plan_unit_update_trg`
BEFORE UPDATE OF `target_language`, `current_unit_id` ON `smartlingo_learning_plans`
FOR EACH ROW
WHEN NEW.`current_unit_id` IS NOT NULL
  AND NEW.`current_unit_id` NOT LIKE 'sl-unit-' || NEW.`target_language` || '-%'
BEGIN
  SELECT RAISE(ABORT, 'smartlingo learning plan unit must belong to its target language');
END;
