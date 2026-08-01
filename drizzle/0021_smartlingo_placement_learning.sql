DROP TRIGGER IF EXISTS `smartlingo_language_path_integrity_insert_trg`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `smartlingo_language_path_integrity_update_trg`;--> statement-breakpoint
CREATE TRIGGER `smartlingo_language_path_integrity_insert_trg`
BEFORE INSERT ON `smartlingo_language_paths`
FOR EACH ROW
WHEN NEW.`target_language` NOT IN ('zh', 'en', 'es', 'ja', 'ko', 'fr', 'de', 'ru', 'it', 'pt', 'ar', 'hi')
  OR length(trim(NEW.`version`)) = 0
BEGIN
  SELECT RAISE(ABORT, 'smartlingo language path requires a supported language and version');
END;--> statement-breakpoint
CREATE TRIGGER `smartlingo_language_path_integrity_update_trg`
BEFORE UPDATE OF `target_language`, `version` ON `smartlingo_language_paths`
FOR EACH ROW
WHEN NEW.`target_language` NOT IN ('zh', 'en', 'es', 'ja', 'ko', 'fr', 'de', 'ru', 'it', 'pt', 'ar', 'hi')
  OR length(trim(NEW.`version`)) = 0
BEGIN
  SELECT RAISE(ABORT, 'smartlingo language path requires a supported language and version');
END;--> statement-breakpoint

INSERT OR IGNORE INTO `smartlingo_language_paths`
  (`id`,`slug`,`target_language`,`level`,`title_en`,`title_zh`,`status`,`version`,`created_at`,`updated_at`)
VALUES
  ('path_ar_a1','arabic-a1','ar','A1','Arabic from day one','阿拉伯语从第一天开口','published','2026.08.01',1785610588,1785610588),
  ('path_hi_a1','hindi-a1','hi','A1','Hindi from day one','印地语从第一天开口','published','2026.08.01',1785610588,1785610588);--> statement-breakpoint

INSERT OR IGNORE INTO `smartlingo_language_classes`
  (`id`,`owner_user_id`,`path_id`,`class_kind`,`owner_role`,`title`,`summary`,`target_language`,`level`,`schedule`,`status`,`visibility`,`price_cents`,`currency`,`capacity`,`created_at`,`updated_at`)
VALUES
  ('class_official_ar','smartlingo-official-community','path_ar_a1','official_language','coordinator','阿拉伯语学习社区 / Arabic Community','面向所有阿拉伯语学习者与母语成员的日常学习、交流与互助社区。','ar','A1','Self-paced','open','public',0,'USD',1000,1785610588,1785610588),
  ('class_official_hi','smartlingo-official-community','path_hi_a1','official_language','coordinator','印地语学习社区 / Hindi Community','面向所有印地语学习者与母语成员的日常学习、交流与互助社区。','hi','A1','Self-paced','open','public',0,'USD',1000,1785610588,1785610588);--> statement-breakpoint

INSERT OR IGNORE INTO `smartlingo_language_class_members`
  (`id`,`class_id`,`user_id`,`role`,`status`,`joined_at`,`updated_at`)
VALUES
  ('owner_class_official_ar','class_official_ar','smartlingo-official-community','owner','active',1785610588,1785610588),
  ('owner_class_official_hi','class_official_hi','smartlingo-official-community','owner','active',1785610588,1785610588);--> statement-breakpoint

CREATE TABLE `smartlingo_placement_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`class_id` text NOT NULL,
	`path_id` text NOT NULL,
	`entry_mode` text NOT NULL,
	`status` text DEFAULT 'in_progress' NOT NULL,
	`current_difficulty` integer DEFAULT 3 NOT NULL,
	`active_seconds` integer DEFAULT 0 NOT NULL,
	`last_resumed_at` integer,
	`vocabulary_score` integer,
	`reading_score` integer,
	`writing_score` integer,
	`listening_score` integer,
	`dialogue_score` integer,
	`overall_score` integer,
	`recommended_level` text,
	`started_at` integer NOT NULL,
	`paused_at` integer,
	`completed_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`class_id`) REFERENCES `smartlingo_language_classes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`path_id`) REFERENCES `smartlingo_language_paths`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT `smartlingo_placement_attempt_entry_mode_ck` CHECK(`entry_mode` IN ('beginner', 'intermediate', 'advanced', 'adaptive')),
	CONSTRAINT `smartlingo_placement_attempt_status_ck` CHECK(`status` IN ('in_progress', 'paused', 'completed', 'abandoned')),
	CONSTRAINT `smartlingo_placement_attempt_difficulty_ck` CHECK(`current_difficulty` BETWEEN 1 AND 5),
	CONSTRAINT `smartlingo_placement_attempt_active_time_ck` CHECK(`active_seconds` BETWEEN 0 AND 14400),
	CONSTRAINT `smartlingo_placement_attempt_scores_ck` CHECK(
		(`vocabulary_score` IS NULL OR `vocabulary_score` BETWEEN 0 AND 100)
		AND (`reading_score` IS NULL OR `reading_score` BETWEEN 0 AND 100)
		AND (`writing_score` IS NULL OR `writing_score` BETWEEN 0 AND 100)
		AND (`listening_score` IS NULL OR `listening_score` BETWEEN 0 AND 100)
		AND (`dialogue_score` IS NULL OR `dialogue_score` BETWEEN 0 AND 100)
		AND (`overall_score` IS NULL OR `overall_score` BETWEEN 0 AND 100)
	),
	CONSTRAINT `smartlingo_placement_attempt_level_ck` CHECK(`recommended_level` IS NULL OR `recommended_level` IN ('beginner', 'intermediate', 'advanced'))
);--> statement-breakpoint
CREATE UNIQUE INDEX `smartlingo_placement_attempt_active_uq` ON `smartlingo_placement_attempts` (`user_id`,`class_id`) WHERE `status` IN ('in_progress', 'paused');--> statement-breakpoint
CREATE INDEX `smartlingo_placement_attempt_user_class_idx` ON `smartlingo_placement_attempts` (`user_id`,`class_id`,`updated_at`);--> statement-breakpoint
CREATE INDEX `smartlingo_placement_attempt_class_status_idx` ON `smartlingo_placement_attempts` (`class_id`,`status`,`updated_at`);--> statement-breakpoint

CREATE TRIGGER `smartlingo_placement_attempt_scope_insert_trg`
BEFORE INSERT ON `smartlingo_placement_attempts`
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1
  FROM `smartlingo_language_classes` AS `language_class`
  JOIN `smartlingo_language_class_members` AS `membership`
    ON `membership`.`class_id` = `language_class`.`id`
  WHERE `language_class`.`id` = NEW.`class_id`
    AND `language_class`.`path_id` = NEW.`path_id`
    AND `language_class`.`class_kind` = 'official_language'
    AND `membership`.`user_id` = NEW.`user_id`
    AND `membership`.`status` = 'active'
)
BEGIN
  SELECT RAISE(ABORT, 'smartlingo placement requires an active official language class membership');
END;--> statement-breakpoint
CREATE TRIGGER `smartlingo_placement_attempt_scope_update_trg`
BEFORE UPDATE OF `user_id`, `class_id`, `path_id` ON `smartlingo_placement_attempts`
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1
  FROM `smartlingo_language_classes` AS `language_class`
  JOIN `smartlingo_language_class_members` AS `membership`
    ON `membership`.`class_id` = `language_class`.`id`
  WHERE `language_class`.`id` = NEW.`class_id`
    AND `language_class`.`path_id` = NEW.`path_id`
    AND `language_class`.`class_kind` = 'official_language'
    AND `membership`.`user_id` = NEW.`user_id`
    AND `membership`.`status` = 'active'
)
BEGIN
  SELECT RAISE(ABORT, 'smartlingo placement requires an active official language class membership');
END;--> statement-breakpoint

CREATE TABLE `smartlingo_placement_responses` (
	`id` text PRIMARY KEY NOT NULL,
	`attempt_id` text NOT NULL,
	`item_key` text NOT NULL,
	`item_version` text NOT NULL,
	`skill` text NOT NULL,
	`difficulty` integer NOT NULL,
	`answer_text` text DEFAULT '' NOT NULL,
	`skipped` integer DEFAULT false NOT NULL,
	`score` integer,
	`ai_feedback` text DEFAULT '' NOT NULL,
	`duration_seconds` integer DEFAULT 0 NOT NULL,
	`answered_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`attempt_id`) REFERENCES `smartlingo_placement_attempts`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT `smartlingo_placement_response_identity_ck` CHECK(length(trim(`item_key`)) > 0 AND length(trim(`item_version`)) > 0),
	CONSTRAINT `smartlingo_placement_response_skill_ck` CHECK(`skill` IN ('vocabulary', 'reading', 'writing', 'listening', 'dialogue')),
	CONSTRAINT `smartlingo_placement_response_difficulty_ck` CHECK(`difficulty` BETWEEN 1 AND 5),
	CONSTRAINT `smartlingo_placement_response_skipped_ck` CHECK(`skipped` IN (0, 1)),
	CONSTRAINT `smartlingo_placement_response_score_ck` CHECK(`score` IS NULL OR `score` BETWEEN 0 AND 100),
	CONSTRAINT `smartlingo_placement_response_skip_score_ck` CHECK(`skipped` = 0 OR `score` IS NULL),
	CONSTRAINT `smartlingo_placement_response_text_ck` CHECK(length(`answer_text`) <= 6000 AND length(`ai_feedback`) <= 6000),
	CONSTRAINT `smartlingo_placement_response_duration_ck` CHECK(`duration_seconds` BETWEEN 0 AND 3600)
);--> statement-breakpoint
CREATE UNIQUE INDEX `smartlingo_placement_response_item_uq` ON `smartlingo_placement_responses` (`attempt_id`,`item_key`,`item_version`);--> statement-breakpoint
CREATE INDEX `smartlingo_placement_response_attempt_skill_idx` ON `smartlingo_placement_responses` (`attempt_id`,`skill`,`answered_at`);--> statement-breakpoint

CREATE TABLE `smartlingo_learning_activity_events` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`class_id` text,
	`attempt_id` text,
	`domain` text NOT NULL,
	`activity_type` text NOT NULL,
	`duration_seconds` integer DEFAULT 0 NOT NULL,
	`units` integer DEFAULT 1 NOT NULL,
	`score` integer,
	`source_type` text NOT NULL,
	`source_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`class_id`) REFERENCES `smartlingo_language_classes`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`attempt_id`) REFERENCES `smartlingo_placement_attempts`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT `smartlingo_learning_activity_domain_ck` CHECK(`domain` IN ('vocabulary', 'reading', 'writing', 'listening', 'dialogue', 'community')),
	CONSTRAINT `smartlingo_learning_activity_type_ck` CHECK(`activity_type` IN ('placement', 'practice', 'flashcard', 'class_join', 'community_topic', 'community_reply', 'group_chat', 'live_chat')),
	CONSTRAINT `smartlingo_learning_activity_duration_ck` CHECK(`duration_seconds` BETWEEN 0 AND 86400),
	CONSTRAINT `smartlingo_learning_activity_units_ck` CHECK(`units` BETWEEN 1 AND 10000),
	CONSTRAINT `smartlingo_learning_activity_score_ck` CHECK(`score` IS NULL OR `score` BETWEEN 0 AND 100),
	CONSTRAINT `smartlingo_learning_activity_source_ck` CHECK(length(trim(`source_type`)) BETWEEN 1 AND 48 AND length(trim(`source_id`)) BETWEEN 1 AND 160)
);--> statement-breakpoint
CREATE UNIQUE INDEX `smartlingo_learning_activity_source_uq` ON `smartlingo_learning_activity_events` (`user_id`,`source_type`,`source_id`);--> statement-breakpoint
CREATE INDEX `smartlingo_learning_activity_user_created_idx` ON `smartlingo_learning_activity_events` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `smartlingo_learning_activity_user_domain_idx` ON `smartlingo_learning_activity_events` (`user_id`,`domain`,`created_at`);--> statement-breakpoint
CREATE INDEX `smartlingo_learning_activity_class_created_idx` ON `smartlingo_learning_activity_events` (`class_id`,`created_at`);--> statement-breakpoint

CREATE TABLE `smartlingo_vocabulary_progress` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`path_id` text NOT NULL,
	`class_id` text,
	`word_key` text NOT NULL,
	`word_version` text NOT NULL,
	`status` text DEFAULT 'new' NOT NULL,
	`modes_seen` text DEFAULT '[]' NOT NULL,
	`review_box` integer DEFAULT 0 NOT NULL,
	`interval_days` integer DEFAULT 0 NOT NULL,
	`review_count` integer DEFAULT 0 NOT NULL,
	`correct_count` integer DEFAULT 0 NOT NULL,
	`lapse_count` integer DEFAULT 0 NOT NULL,
	`last_score` integer,
	`due_at` integer,
	`last_reviewed_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`path_id`) REFERENCES `smartlingo_language_paths`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`class_id`) REFERENCES `smartlingo_language_classes`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT `smartlingo_vocabulary_progress_identity_ck` CHECK(length(trim(`word_key`)) > 0 AND length(trim(`word_version`)) > 0),
	CONSTRAINT `smartlingo_vocabulary_progress_status_ck` CHECK(`status` IN ('new', 'learning', 'review', 'mastered', 'suspended')),
	CONSTRAINT `smartlingo_vocabulary_progress_modes_ck` CHECK(json_valid(`modes_seen`) AND json_type(`modes_seen`) = 'array' AND length(`modes_seen`) <= 320),
	CONSTRAINT `smartlingo_vocabulary_progress_box_ck` CHECK(`review_box` BETWEEN 0 AND 5),
	CONSTRAINT `smartlingo_vocabulary_progress_interval_ck` CHECK(`interval_days` BETWEEN 0 AND 3650),
	CONSTRAINT `smartlingo_vocabulary_progress_counts_ck` CHECK(
		`review_count` >= 0 AND `correct_count` >= 0 AND `lapse_count` >= 0
		AND `correct_count` + `lapse_count` <= `review_count`
	),
	CONSTRAINT `smartlingo_vocabulary_progress_score_ck` CHECK(`last_score` IS NULL OR `last_score` BETWEEN 0 AND 100)
);--> statement-breakpoint
CREATE UNIQUE INDEX `smartlingo_vocabulary_progress_word_uq` ON `smartlingo_vocabulary_progress` (`user_id`,`path_id`,`word_key`,`word_version`);--> statement-breakpoint
CREATE INDEX `smartlingo_vocabulary_progress_user_due_idx` ON `smartlingo_vocabulary_progress` (`user_id`,`status`,`due_at`);--> statement-breakpoint
CREATE INDEX `smartlingo_vocabulary_progress_path_status_idx` ON `smartlingo_vocabulary_progress` (`path_id`,`status`);--> statement-breakpoint
CREATE INDEX `smartlingo_vocabulary_progress_class_idx` ON `smartlingo_vocabulary_progress` (`class_id`,`updated_at`);
