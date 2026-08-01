ALTER TABLE `smartlingo_language_classes` ADD `class_kind` text DEFAULT 'member_language' NOT NULL;--> statement-breakpoint
CREATE INDEX `smartlingo_language_class_kind_path_idx` ON `smartlingo_language_classes` (`class_kind`,`path_id`,`status`);--> statement-breakpoint

CREATE TRIGGER `smartlingo_language_class_kind_insert_trg`
BEFORE INSERT ON `smartlingo_language_classes`
FOR EACH ROW
WHEN NEW.`class_kind` NOT IN ('official_language', 'member_language', 'subject')
BEGIN
  SELECT RAISE(ABORT, 'smartlingo class kind is unsupported');
END;--> statement-breakpoint
CREATE TRIGGER `smartlingo_language_class_kind_update_trg`
BEFORE UPDATE OF `class_kind` ON `smartlingo_language_classes`
FOR EACH ROW
WHEN NEW.`class_kind` NOT IN ('official_language', 'member_language', 'subject')
BEGIN
  SELECT RAISE(ABORT, 'smartlingo class kind is unsupported');
END;--> statement-breakpoint

DROP TRIGGER IF EXISTS `smartlingo_language_path_integrity_insert_trg`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `smartlingo_language_path_integrity_update_trg`;--> statement-breakpoint
CREATE TRIGGER `smartlingo_language_path_integrity_insert_trg`
BEFORE INSERT ON `smartlingo_language_paths`
FOR EACH ROW
WHEN NEW.`target_language` NOT IN ('zh', 'en', 'es', 'ja', 'ko', 'fr', 'ru', 'it', 'pt', 'de')
  OR length(trim(NEW.`version`)) = 0
BEGIN
  SELECT RAISE(ABORT, 'smartlingo language path requires a supported language and version');
END;--> statement-breakpoint
CREATE TRIGGER `smartlingo_language_path_integrity_update_trg`
BEFORE UPDATE OF `target_language`, `version` ON `smartlingo_language_paths`
FOR EACH ROW
WHEN NEW.`target_language` NOT IN ('zh', 'en', 'es', 'ja', 'ko', 'fr', 'ru', 'it', 'pt', 'de')
  OR length(trim(NEW.`version`)) = 0
BEGIN
  SELECT RAISE(ABORT, 'smartlingo language path requires a supported language and version');
END;--> statement-breakpoint

INSERT OR IGNORE INTO `smartlingo_language_paths`
  (`id`,`slug`,`target_language`,`level`,`title_en`,`title_zh`,`status`,`version`,`created_at`,`updated_at`)
VALUES
  ('path_zh_a1','chinese-a1','zh','A1','Chinese from day one','中文从第一天开口','published','2026.08.01',1785600000,1785600000),
  ('path_ru_a1','russian-a1','ru','A1','Russian from day one','俄语从第一天开口','published','2026.08.01',1785600000,1785600000),
  ('path_pt_a1','portuguese-a1','pt','A1','Portuguese from day one','葡萄牙语从第一天开口','published','2026.08.01',1785600000,1785600000);--> statement-breakpoint
UPDATE `smartlingo_language_paths`
SET `status` = 'published', `updated_at` = 1785600000
WHERE `target_language` IN ('zh', 'en', 'es', 'ja', 'ko', 'fr', 'ru', 'it', 'pt');--> statement-breakpoint
UPDATE `smartlingo_language_paths`
SET `status` = 'archived', `updated_at` = 1785600000
WHERE `target_language` = 'de';--> statement-breakpoint

INSERT OR IGNORE INTO `users`
  (`id`,`email`,`display_name`,`password_hash`,`preferred_language`,`created_at`)
VALUES
  ('smartlingo-official-community','official-community@smartlingo.invalid','SmartLingo 官方社区','system-managed-disabled','zh',1785600000);--> statement-breakpoint

INSERT OR IGNORE INTO `smartlingo_language_classes`
  (`id`,`owner_user_id`,`path_id`,`class_kind`,`owner_role`,`title`,`summary`,`target_language`,`level`,`schedule`,`status`,`visibility`,`price_cents`,`currency`,`capacity`,`created_at`,`updated_at`)
VALUES
  ('class_official_zh','smartlingo-official-community','path_zh_a1','official_language','coordinator','中文学习社区 / Chinese Community','面向所有中文学习者与母语成员的日常学习、交流与互助社区。','zh','A1','Self-paced','open','public',0,'USD',1000,1785600000,1785600000),
  ('class_official_en','smartlingo-official-community','path_en_a1','official_language','coordinator','英语学习社区 / English Community','面向所有英语学习者与母语成员的日常学习、交流与互助社区。','en','A1','Self-paced','open','public',0,'USD',1000,1785600000,1785600000),
  ('class_official_es','smartlingo-official-community','path_es_a1','official_language','coordinator','西班牙语学习社区 / Spanish Community','面向所有西班牙语学习者与母语成员的日常学习、交流与互助社区。','es','A1','Self-paced','open','public',0,'USD',1000,1785600000,1785600000),
  ('class_official_ja','smartlingo-official-community','path_ja_a1','official_language','coordinator','日语学习社区 / Japanese Community','面向所有日语学习者与母语成员的日常学习、交流与互助社区。','ja','A1','Self-paced','open','public',0,'USD',1000,1785600000,1785600000),
  ('class_official_ko','smartlingo-official-community','path_ko_a1','official_language','coordinator','韩语学习社区 / Korean Community','面向所有韩语学习者与母语成员的日常学习、交流与互助社区。','ko','A1','Self-paced','open','public',0,'USD',1000,1785600000,1785600000),
  ('class_official_fr','smartlingo-official-community','path_fr_a1','official_language','coordinator','法语学习社区 / French Community','面向所有法语学习者与母语成员的日常学习、交流与互助社区。','fr','A1','Self-paced','open','public',0,'USD',1000,1785600000,1785600000),
  ('class_official_ru','smartlingo-official-community','path_ru_a1','official_language','coordinator','俄语学习社区 / Russian Community','面向所有俄语学习者与母语成员的日常学习、交流与互助社区。','ru','A1','Self-paced','open','public',0,'USD',1000,1785600000,1785600000),
  ('class_official_it','smartlingo-official-community','path_it_a1','official_language','coordinator','意大利语学习社区 / Italian Community','面向所有意大利语学习者与母语成员的日常学习、交流与互助社区。','it','A1','Self-paced','open','public',0,'USD',1000,1785600000,1785600000),
  ('class_official_pt','smartlingo-official-community','path_pt_a1','official_language','coordinator','葡萄牙语学习社区 / Portuguese Community','面向所有葡萄牙语学习者与母语成员的日常学习、交流与互助社区。','pt','A1','Self-paced','open','public',0,'USD',1000,1785600000,1785600000);--> statement-breakpoint

INSERT OR IGNORE INTO `smartlingo_language_class_members`
  (`id`,`class_id`,`user_id`,`role`,`status`,`joined_at`,`updated_at`)
SELECT
  'owner_' || `id`, `id`, 'smartlingo-official-community', 'owner', 'active', 1785600000, 1785600000
FROM `smartlingo_language_classes`
WHERE `class_kind` = 'official_language';--> statement-breakpoint

CREATE TRIGGER `smartlingo_language_class_path_insert_trg`
BEFORE INSERT ON `smartlingo_language_classes`
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1 FROM `smartlingo_language_paths` AS `path`
  WHERE `path`.`id` = NEW.`path_id` AND `path`.`target_language` = NEW.`target_language`
)
BEGIN
  SELECT RAISE(ABORT, 'smartlingo class target language must match its language path');
END;--> statement-breakpoint
CREATE TRIGGER `smartlingo_language_class_path_update_trg`
BEFORE UPDATE OF `path_id`, `target_language` ON `smartlingo_language_classes`
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1 FROM `smartlingo_language_paths` AS `path`
  WHERE `path`.`id` = NEW.`path_id` AND `path`.`target_language` = NEW.`target_language`
)
BEGIN
  SELECT RAISE(ABORT, 'smartlingo class target language must match its language path');
END;--> statement-breakpoint
CREATE TRIGGER `smartlingo_official_language_class_insert_trg`
BEFORE INSERT ON `smartlingo_language_classes`
FOR EACH ROW
WHEN NEW.`class_kind` = 'official_language' AND (
  NEW.`owner_user_id` != 'smartlingo-official-community'
  OR NEW.`status` != 'open'
  OR NEW.`visibility` != 'public'
  OR NEW.`price_cents` != 0
)
BEGIN
  SELECT RAISE(ABORT, 'smartlingo official language classes must remain public, open, free, and platform-owned');
END;--> statement-breakpoint
CREATE TRIGGER `smartlingo_official_language_class_update_trg`
BEFORE UPDATE OF `class_kind`, `owner_user_id`, `status`, `visibility`, `price_cents` ON `smartlingo_language_classes`
FOR EACH ROW
WHEN NEW.`class_kind` = 'official_language' AND (
  NEW.`owner_user_id` != 'smartlingo-official-community'
  OR NEW.`status` != 'open'
  OR NEW.`visibility` != 'public'
  OR NEW.`price_cents` != 0
)
BEGIN
  SELECT RAISE(ABORT, 'smartlingo official language classes must remain public, open, free, and platform-owned');
END;
