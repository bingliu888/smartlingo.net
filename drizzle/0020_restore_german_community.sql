UPDATE `smartlingo_language_paths`
SET `status` = 'published', `updated_at` = 1785607941
WHERE `id` = 'path_de_a1' AND `target_language` = 'de';--> statement-breakpoint

INSERT OR IGNORE INTO `smartlingo_language_classes`
  (`id`,`owner_user_id`,`path_id`,`class_kind`,`owner_role`,`title`,`summary`,`target_language`,`level`,`schedule`,`status`,`visibility`,`price_cents`,`currency`,`capacity`,`created_at`,`updated_at`)
VALUES
  ('class_official_de','smartlingo-official-community','path_de_a1','official_language','coordinator','德语学习社区 / German Community','面向所有德语学习者与母语成员的日常学习、交流与互助社区。','de','A1','Self-paced','open','public',0,'USD',1000,1785607941,1785607941);--> statement-breakpoint

UPDATE `smartlingo_language_classes`
SET `owner_user_id` = 'smartlingo-official-community',
    `path_id` = 'path_de_a1',
    `class_kind` = 'official_language',
    `owner_role` = 'coordinator',
    `target_language` = 'de',
    `level` = 'A1',
    `status` = 'open',
    `visibility` = 'public',
    `price_cents` = 0,
    `currency` = 'USD',
    `updated_at` = 1785607941
WHERE `id` = 'class_official_de';--> statement-breakpoint

INSERT OR IGNORE INTO `smartlingo_language_class_members`
  (`id`,`class_id`,`user_id`,`role`,`status`,`joined_at`,`updated_at`)
VALUES
  ('owner_class_official_de','class_official_de','smartlingo-official-community','owner','active',1785607941,1785607941);
