CREATE TABLE `smartlingo_exercises` (
	`id` text PRIMARY KEY NOT NULL,
	`path_id` text NOT NULL,
	`stable_key` text NOT NULL,
	`version` text NOT NULL,
	`skill` text NOT NULL,
	`title_zh` text NOT NULL,
	`title_en` text NOT NULL,
	`instruction_zh` text NOT NULL,
	`instruction_en` text NOT NULL,
	`target_content` text NOT NULL,
	`answer_content` text DEFAULT '{}' NOT NULL,
	`source_type` text DEFAULT 'smartlingo_original' NOT NULL,
	`review_status` text DEFAULT 'draft' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`path_id`) REFERENCES `smartlingo_language_paths`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "smartlingo_exercise_identity_ck" CHECK(length(trim("smartlingo_exercises"."stable_key")) > 0 AND length(trim("smartlingo_exercises"."version")) > 0),
	CONSTRAINT "smartlingo_exercise_skill_ck" CHECK("smartlingo_exercises"."skill" IN ('listening', 'speaking', 'reading', 'writing', 'vocabulary', 'review')),
	CONSTRAINT "smartlingo_exercise_bilingual_ck" CHECK(length(trim("smartlingo_exercises"."title_zh")) > 0 AND length(trim("smartlingo_exercises"."title_en")) > 0 AND length(trim("smartlingo_exercises"."instruction_zh")) > 0 AND length(trim("smartlingo_exercises"."instruction_en")) > 0),
	CONSTRAINT "smartlingo_exercise_content_ck" CHECK(length(trim("smartlingo_exercises"."target_content")) > 0 AND length(trim("smartlingo_exercises"."answer_content")) > 0),
	CONSTRAINT "smartlingo_exercise_source_ck" CHECK("smartlingo_exercises"."source_type" = 'smartlingo_original'),
	CONSTRAINT "smartlingo_exercise_review_ck" CHECK("smartlingo_exercises"."review_status" IN ('draft', 'review', 'approved', 'retired'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `smartlingo_exercise_path_key_version_uq` ON `smartlingo_exercises` (`path_id`,`stable_key`,`version`);--> statement-breakpoint
CREATE INDEX `smartlingo_exercise_path_review_skill_idx` ON `smartlingo_exercises` (`path_id`,`review_status`,`skill`);--> statement-breakpoint
CREATE TABLE `smartlingo_language_progress` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`path_id` text NOT NULL,
	`exercise_id` text NOT NULL,
	`exercise_version` text NOT NULL,
	`status` text DEFAULT 'not_started' NOT NULL,
	`best_score` integer,
	`attempt_count` integer DEFAULT 0 NOT NULL,
	`due_at` integer,
	`started_at` integer,
	`completed_at` integer,
	`last_attempt_at` integer,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`path_id`) REFERENCES `smartlingo_language_paths`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`exercise_id`) REFERENCES `smartlingo_exercises`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "smartlingo_language_progress_status_ck" CHECK("smartlingo_language_progress"."status" IN ('not_started', 'in_progress', 'completed', 'needs_review')),
	CONSTRAINT "smartlingo_language_progress_score_ck" CHECK("smartlingo_language_progress"."best_score" IS NULL OR "smartlingo_language_progress"."best_score" BETWEEN 0 AND 100),
	CONSTRAINT "smartlingo_language_progress_attempt_ck" CHECK("smartlingo_language_progress"."attempt_count" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `smartlingo_language_progress_user_exercise_uq` ON `smartlingo_language_progress` (`user_id`,`exercise_id`);--> statement-breakpoint
CREATE INDEX `smartlingo_language_progress_user_path_status_idx` ON `smartlingo_language_progress` (`user_id`,`path_id`,`status`);--> statement-breakpoint
CREATE INDEX `smartlingo_language_progress_user_due_idx` ON `smartlingo_language_progress` (`user_id`,`due_at`);--> statement-breakpoint
CREATE TABLE `__new_smartlingo_language_class_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`class_id` text NOT NULL,
	`learner_user_id` text NOT NULL,
	`owner_user_id` text NOT NULL,
	`provider` text DEFAULT 'stripe_connect' NOT NULL,
	`provider_checkout_id` text,
	`provider_payment_id` text,
	`subtotal_cents` integer NOT NULL,
	`discount_basis_points` integer DEFAULT 0 NOT NULL,
	`discounted_pre_tax_cents` integer NOT NULL,
	`tax_cents` integer DEFAULT 0 NOT NULL,
	`owner_share_cents` integer NOT NULL,
	`platform_fee_cents` integer NOT NULL,
	`currency` text DEFAULT 'USD' NOT NULL,
	`first_class_payment` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`webhook_event_id` text,
	`paid_at` integer,
	`refunded_at` integer,
	`disputed_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`class_id`) REFERENCES `smartlingo_language_classes`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`learner_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "smartlingo_language_class_order_provider_ck" CHECK("provider" = 'stripe_connect'),
	CONSTRAINT "smartlingo_language_class_order_discount_ck" CHECK("discount_basis_points" IN (0, 1500)),
	CONSTRAINT "smartlingo_language_class_order_first_flag_ck" CHECK("first_class_payment" IN (0, 1)),
	CONSTRAINT "smartlingo_language_class_order_first_discount_ck" CHECK((
    ("first_class_payment" = 1 AND "discount_basis_points" = 1500)
    OR ("first_class_payment" = 0 AND "discount_basis_points" = 0)
  )),
	CONSTRAINT "smartlingo_language_class_order_discount_math_ck" CHECK("discounted_pre_tax_cents" = "subtotal_cents" - (("subtotal_cents" * "discount_basis_points") / 10000)),
	CONSTRAINT "smartlingo_language_class_order_owner_share_ck" CHECK("owner_share_cents" = (("discounted_pre_tax_cents" * 7000) / 10000)),
	CONSTRAINT "smartlingo_language_class_order_platform_share_ck" CHECK("platform_fee_cents" = "discounted_pre_tax_cents" - "owner_share_cents"),
	CONSTRAINT "smartlingo_language_class_order_split_ck" CHECK("owner_share_cents" + "platform_fee_cents" = "discounted_pre_tax_cents"),
	CONSTRAINT "smartlingo_language_class_order_amount_ck" CHECK("subtotal_cents" >= 0 AND "discounted_pre_tax_cents" >= 0 AND "tax_cents" >= 0 AND "owner_share_cents" >= 0 AND "platform_fee_cents" >= 0),
	CONSTRAINT "smartlingo_language_class_order_paid_at_ck" CHECK((
    ("status" IN ('paid', 'refunded', 'partially_refunded', 'disputed') AND "paid_at" IS NOT NULL)
    OR ("status" IN ('pending', 'failed', 'cancelled') AND "paid_at" IS NULL)
  )),
	CONSTRAINT "smartlingo_language_class_order_status_ck" CHECK("status" IN ('pending', 'paid', 'refunded', 'partially_refunded', 'disputed', 'failed', 'cancelled'))
);
--> statement-breakpoint
INSERT INTO `__new_smartlingo_language_class_orders`("id", "class_id", "learner_user_id", "owner_user_id", "provider", "provider_checkout_id", "provider_payment_id", "subtotal_cents", "discount_basis_points", "discounted_pre_tax_cents", "tax_cents", "owner_share_cents", "platform_fee_cents", "currency", "first_class_payment", "status", "webhook_event_id", "paid_at", "refunded_at", "disputed_at", "created_at", "updated_at") SELECT "id", "class_id", "learner_user_id", "owner_user_id", "provider", "provider_checkout_id", "provider_payment_id", "subtotal_cents", "discount_basis_points", "discounted_pre_tax_cents", "tax_cents", "owner_share_cents", "platform_fee_cents", "currency", "first_class_payment", "status", "webhook_event_id", "paid_at", "refunded_at", "disputed_at", "created_at", "updated_at" FROM `smartlingo_language_class_orders`;--> statement-breakpoint
DROP TABLE `smartlingo_language_class_orders`;--> statement-breakpoint
ALTER TABLE `__new_smartlingo_language_class_orders` RENAME TO `smartlingo_language_class_orders`;--> statement-breakpoint
CREATE UNIQUE INDEX `smartlingo_language_class_orders_provider_checkout_id_unique` ON `smartlingo_language_class_orders` (`provider_checkout_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `smartlingo_language_class_orders_provider_payment_id_unique` ON `smartlingo_language_class_orders` (`provider_payment_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `smartlingo_language_class_orders_webhook_event_id_unique` ON `smartlingo_language_class_orders` (`webhook_event_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `smartlingo_language_class_order_first_paid_uq` ON `smartlingo_language_class_orders` (`learner_user_id`,`class_id`) WHERE "smartlingo_language_class_orders"."first_class_payment" = 1 AND "smartlingo_language_class_orders"."paid_at" IS NOT NULL;--> statement-breakpoint
CREATE INDEX `smartlingo_language_class_order_learner_class_idx` ON `smartlingo_language_class_orders` (`learner_user_id`,`class_id`,`status`);--> statement-breakpoint
CREATE INDEX `smartlingo_language_class_order_owner_idx` ON `smartlingo_language_class_orders` (`owner_user_id`,`status`,`created_at`);--> statement-breakpoint
CREATE TABLE `__new_smartlingo_media_assets` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_user_id` text NOT NULL,
	`kind` text NOT NULL,
	`scope_type` text NOT NULL,
	`scope_id` text NOT NULL,
	`object_key` text NOT NULL,
	`mime_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`sha256` text NOT NULL,
	`etag` text,
	`visibility` text DEFAULT 'private' NOT NULL,
	`status` text DEFAULT 'uploading' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "smartlingo_media_kind_ck" CHECK("kind" IN ('avatar', 'voice_practice', 'course_cover', 'courseware', 'assignment_attachment', 'chat_attachment', 'certificate_asset')),
	CONSTRAINT "smartlingo_media_scope_ck" CHECK((
    ("kind" IN ('avatar', 'voice_practice', 'certificate_asset') AND "scope_type" = 'user' AND "scope_id" = "owner_user_id")
    OR ("kind" IN ('course_cover', 'courseware', 'assignment_attachment') AND "scope_type" = 'language_class')
    OR ("kind" = 'chat_attachment' AND "scope_type" = 'message_thread')
  )),
	CONSTRAINT "smartlingo_media_size_ck" CHECK("size_bytes" > 0),
	CONSTRAINT "smartlingo_media_sha256_ck" CHECK(length("sha256") = 64 AND "sha256" NOT GLOB '*[^0-9a-f]*'),
	CONSTRAINT "smartlingo_media_visibility_ck" CHECK("visibility" = 'private'),
	CONSTRAINT "smartlingo_media_status_ck" CHECK("status" IN ('uploading', 'ready', 'quarantined', 'failed', 'tombstone'))
);
--> statement-breakpoint
INSERT INTO `__new_smartlingo_media_assets`("id", "owner_user_id", "kind", "scope_type", "scope_id", "object_key", "mime_type", "size_bytes", "sha256", "etag", "visibility", "status", "created_at", "updated_at", "deleted_at") SELECT "id", "owner_user_id", "kind", "scope_type", "scope_id", "object_key", "mime_type", "size_bytes", "sha256", "etag", "visibility", "status", "created_at", "updated_at", "deleted_at" FROM `smartlingo_media_assets`;--> statement-breakpoint
DROP TABLE `smartlingo_media_assets`;--> statement-breakpoint
ALTER TABLE `__new_smartlingo_media_assets` RENAME TO `smartlingo_media_assets`;--> statement-breakpoint
CREATE UNIQUE INDEX `smartlingo_media_assets_object_key_unique` ON `smartlingo_media_assets` (`object_key`);--> statement-breakpoint
CREATE INDEX `smartlingo_media_owner_status_idx` ON `smartlingo_media_assets` (`owner_user_id`,`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `smartlingo_media_scope_status_idx` ON `smartlingo_media_assets` (`scope_type`,`scope_id`,`status`);--> statement-breakpoint
CREATE INDEX `smartlingo_media_kind_status_idx` ON `smartlingo_media_assets` (`kind`,`status`);--> statement-breakpoint
ALTER TABLE `smartlingo_platform_subscription_payments` ADD `direct_referral_id` text REFERENCES referrals(id);--> statement-breakpoint
CREATE INDEX `smartlingo_platform_subscription_direct_referral_idx` ON `smartlingo_platform_subscription_payments` (`direct_referral_id`,`paid_at`);--> statement-breakpoint
UPDATE `smartlingo_platform_subscription_payments` AS `payment`
SET `direct_referral_id` = (
  SELECT `referral`.`id`
  FROM `referrals` AS `referral`
  JOIN `referral_codes` AS `code` ON `code`.`id` = `referral`.`referral_code_id`
  WHERE `referral`.`referred_user_id` = `payment`.`subscriber_user_id`
    AND `code`.`user_id` = `payment`.`introducer_user_id`
  LIMIT 1
)
WHERE `payment`.`introducer_user_id` IS NOT NULL
  AND `payment`.`direct_referral_id` IS NULL;--> statement-breakpoint

CREATE TABLE `__smartlingo_core_integrity_guard` (
  `valid` integer NOT NULL,
  CONSTRAINT `smartlingo_core_integrity_guard_ck` CHECK (`valid` = 1)
);--> statement-breakpoint
INSERT INTO `__smartlingo_core_integrity_guard` (`valid`)
SELECT 0 WHERE EXISTS (
  SELECT 1
  FROM `smartlingo_language_paths`
  WHERE `target_language` NOT IN ('es', 'en', 'fr', 'ja', 'de', 'it', 'ko')
     OR length(trim(`version`)) = 0
);--> statement-breakpoint
INSERT INTO `__smartlingo_core_integrity_guard` (`valid`)
SELECT 0 WHERE EXISTS (
  SELECT 1
  FROM `referrals` AS `referral`
  JOIN `referral_codes` AS `code` ON `code`.`id` = `referral`.`referral_code_id`
  WHERE `referral`.`referred_user_id` = `code`.`user_id`
);--> statement-breakpoint
INSERT INTO `__smartlingo_core_integrity_guard` (`valid`)
SELECT 0 WHERE EXISTS (
  SELECT 1
  FROM `smartlingo_language_class_orders` AS `class_order`
  JOIN `smartlingo_language_classes` AS `language_class` ON `language_class`.`id` = `class_order`.`class_id`
  WHERE `class_order`.`owner_user_id` != `language_class`.`owner_user_id`
);--> statement-breakpoint
INSERT INTO `__smartlingo_core_integrity_guard` (`valid`)
SELECT 0 WHERE EXISTS (
  SELECT 1
  FROM `smartlingo_language_class_orders`
  WHERE `paid_at` IS NOT NULL
  GROUP BY `learner_user_id`, `class_id`
  HAVING sum(CASE WHEN `first_class_payment` = 1 THEN 1 ELSE 0 END) != 1
);--> statement-breakpoint
INSERT INTO `__smartlingo_core_integrity_guard` (`valid`)
SELECT 0 WHERE EXISTS (
  SELECT 1
  FROM `smartlingo_platform_subscription_payments` AS `payment`
  WHERE (`payment`.`introducer_user_id` IS NULL AND `payment`.`direct_referral_id` IS NOT NULL)
     OR (`payment`.`introducer_user_id` IS NOT NULL AND NOT EXISTS (
       SELECT 1
       FROM `referrals` AS `referral`
       JOIN `referral_codes` AS `code` ON `code`.`id` = `referral`.`referral_code_id`
       WHERE `referral`.`id` = `payment`.`direct_referral_id`
         AND `referral`.`referred_user_id` = `payment`.`subscriber_user_id`
         AND `code`.`user_id` = `payment`.`introducer_user_id`
     ))
);--> statement-breakpoint
INSERT INTO `__smartlingo_core_integrity_guard` (`valid`)
SELECT 0 WHERE EXISTS (
  SELECT 1
  FROM `smartlingo_introducer_reward_ledger` AS `ledger`
  JOIN `smartlingo_platform_subscription_payments` AS `payment`
    ON `payment`.`id` = `ledger`.`subscription_payment_id`
  WHERE `ledger`.`status` = 'earned'
    AND (
      `payment`.`status` != 'paid'
      OR `payment`.`amount_cents` <= 0
      OR `payment`.`introducer_user_id` != `ledger`.`introducer_user_id`
      OR NOT EXISTS (
        SELECT 1
        FROM `referrals` AS `referral`
        JOIN `referral_codes` AS `code` ON `code`.`id` = `referral`.`referral_code_id`
        WHERE `referral`.`id` = `payment`.`direct_referral_id`
          AND `referral`.`referred_user_id` = `payment`.`subscriber_user_id`
          AND `code`.`user_id` = `ledger`.`introducer_user_id`
      )
    )
);--> statement-breakpoint
DROP TABLE `__smartlingo_core_integrity_guard`;--> statement-breakpoint

CREATE TRIGGER `smartlingo_language_path_integrity_insert_trg`
BEFORE INSERT ON `smartlingo_language_paths`
FOR EACH ROW
WHEN NEW.`target_language` NOT IN ('es', 'en', 'fr', 'ja', 'de', 'it', 'ko')
  OR length(trim(NEW.`version`)) = 0
BEGIN
  SELECT RAISE(ABORT, 'smartlingo language path requires a supported language and version');
END;--> statement-breakpoint
CREATE TRIGGER `smartlingo_language_path_integrity_update_trg`
BEFORE UPDATE OF `target_language`, `version` ON `smartlingo_language_paths`
FOR EACH ROW
WHEN NEW.`target_language` NOT IN ('es', 'en', 'fr', 'ja', 'de', 'it', 'ko')
  OR length(trim(NEW.`version`)) = 0
BEGIN
  SELECT RAISE(ABORT, 'smartlingo language path requires a supported language and version');
END;--> statement-breakpoint

CREATE TRIGGER `smartlingo_language_progress_link_insert_trg`
BEFORE INSERT ON `smartlingo_language_progress`
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1 FROM `smartlingo_exercises` AS `exercise`
  WHERE `exercise`.`id` = NEW.`exercise_id`
    AND `exercise`.`path_id` = NEW.`path_id`
    AND `exercise`.`version` = NEW.`exercise_version`
)
BEGIN
  SELECT RAISE(ABORT, 'smartlingo progress must reference the exact exercise path and version');
END;--> statement-breakpoint
CREATE TRIGGER `smartlingo_language_progress_link_update_trg`
BEFORE UPDATE OF `exercise_id`, `path_id`, `exercise_version` ON `smartlingo_language_progress`
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1 FROM `smartlingo_exercises` AS `exercise`
  WHERE `exercise`.`id` = NEW.`exercise_id`
    AND `exercise`.`path_id` = NEW.`path_id`
    AND `exercise`.`version` = NEW.`exercise_version`
)
BEGIN
  SELECT RAISE(ABORT, 'smartlingo progress must reference the exact exercise path and version');
END;--> statement-breakpoint

CREATE TRIGGER `smartlingo_class_order_owner_insert_trg`
BEFORE INSERT ON `smartlingo_language_class_orders`
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1 FROM `smartlingo_language_classes` AS `language_class`
  WHERE `language_class`.`id` = NEW.`class_id`
    AND `language_class`.`owner_user_id` = NEW.`owner_user_id`
)
BEGIN
  SELECT RAISE(ABORT, 'smartlingo class order owner must match the class owner');
END;--> statement-breakpoint
CREATE TRIGGER `smartlingo_class_order_owner_update_trg`
BEFORE UPDATE OF `class_id`, `owner_user_id` ON `smartlingo_language_class_orders`
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1 FROM `smartlingo_language_classes` AS `language_class`
  WHERE `language_class`.`id` = NEW.`class_id`
    AND `language_class`.`owner_user_id` = NEW.`owner_user_id`
)
BEGIN
  SELECT RAISE(ABORT, 'smartlingo class order owner must match the class owner');
END;--> statement-breakpoint
CREATE TRIGGER `smartlingo_class_order_first_success_insert_trg`
BEFORE INSERT ON `smartlingo_language_class_orders`
FOR EACH ROW
WHEN NEW.`paid_at` IS NOT NULL
  AND (
    (NEW.`first_class_payment` = 1 AND EXISTS (
      SELECT 1 FROM `smartlingo_language_class_orders` AS `prior_order`
      WHERE `prior_order`.`learner_user_id` = NEW.`learner_user_id`
        AND `prior_order`.`class_id` = NEW.`class_id`
        AND `prior_order`.`paid_at` IS NOT NULL
    ))
    OR (NEW.`first_class_payment` = 0 AND NOT EXISTS (
      SELECT 1 FROM `smartlingo_language_class_orders` AS `prior_order`
      WHERE `prior_order`.`learner_user_id` = NEW.`learner_user_id`
        AND `prior_order`.`class_id` = NEW.`class_id`
        AND `prior_order`.`paid_at` IS NOT NULL
    ))
  )
BEGIN
  SELECT RAISE(ABORT, 'smartlingo first successful class payment discount is single-use');
END;--> statement-breakpoint
CREATE TRIGGER `smartlingo_class_order_first_success_update_trg`
BEFORE UPDATE OF `status`, `first_class_payment`, `learner_user_id`, `class_id`, `paid_at`
ON `smartlingo_language_class_orders`
FOR EACH ROW
WHEN NEW.`paid_at` IS NOT NULL
  AND (
    (NEW.`first_class_payment` = 1 AND EXISTS (
      SELECT 1 FROM `smartlingo_language_class_orders` AS `prior_order`
      WHERE `prior_order`.`id` != NEW.`id`
        AND `prior_order`.`learner_user_id` = NEW.`learner_user_id`
        AND `prior_order`.`class_id` = NEW.`class_id`
        AND `prior_order`.`paid_at` IS NOT NULL
    ))
    OR (NEW.`first_class_payment` = 0 AND NOT EXISTS (
      SELECT 1 FROM `smartlingo_language_class_orders` AS `prior_order`
      WHERE `prior_order`.`id` != NEW.`id`
        AND `prior_order`.`learner_user_id` = NEW.`learner_user_id`
        AND `prior_order`.`class_id` = NEW.`class_id`
        AND `prior_order`.`paid_at` IS NOT NULL
    ))
  )
BEGIN
  SELECT RAISE(ABORT, 'smartlingo first successful class payment discount is single-use');
END;--> statement-breakpoint
CREATE TRIGGER `smartlingo_class_order_success_history_update_trg`
BEFORE UPDATE OF `learner_user_id`, `class_id`, `first_class_payment`, `paid_at`
ON `smartlingo_language_class_orders`
FOR EACH ROW
WHEN OLD.`paid_at` IS NOT NULL
  AND (
    NEW.`learner_user_id` != OLD.`learner_user_id`
    OR NEW.`class_id` != OLD.`class_id`
    OR NEW.`first_class_payment` != OLD.`first_class_payment`
    OR NEW.`paid_at` IS NOT OLD.`paid_at`
  )
BEGIN
  SELECT RAISE(ABORT, 'smartlingo successful class payment history is immutable');
END;--> statement-breakpoint

CREATE TRIGGER `smartlingo_referral_no_self_insert_trg`
BEFORE INSERT ON `referrals`
FOR EACH ROW
WHEN EXISTS (
  SELECT 1 FROM `referral_codes` AS `code`
  WHERE `code`.`id` = NEW.`referral_code_id`
    AND `code`.`user_id` = NEW.`referred_user_id`
)
BEGIN
  SELECT RAISE(ABORT, 'smartlingo direct referral cannot be self-attributed');
END;--> statement-breakpoint
CREATE TRIGGER `smartlingo_referral_no_self_update_trg`
BEFORE UPDATE OF `referral_code_id`, `referred_user_id` ON `referrals`
FOR EACH ROW
WHEN EXISTS (
  SELECT 1 FROM `referral_codes` AS `code`
  WHERE `code`.`id` = NEW.`referral_code_id`
    AND `code`.`user_id` = NEW.`referred_user_id`
)
BEGIN
  SELECT RAISE(ABORT, 'smartlingo direct referral cannot be self-attributed');
END;--> statement-breakpoint
CREATE TRIGGER `smartlingo_referral_payment_link_update_trg`
BEFORE UPDATE OF `referral_code_id`, `referred_user_id` ON `referrals`
FOR EACH ROW
WHEN EXISTS (
  SELECT 1
  FROM `smartlingo_platform_subscription_payments` AS `payment`
  WHERE `payment`.`direct_referral_id` = OLD.`id`
    AND NOT EXISTS (
      SELECT 1 FROM `referral_codes` AS `code`
      WHERE `code`.`id` = NEW.`referral_code_id`
        AND `code`.`user_id` = `payment`.`introducer_user_id`
        AND NEW.`referred_user_id` = `payment`.`subscriber_user_id`
    )
)
BEGIN
  SELECT RAISE(ABORT, 'smartlingo referral relationship is anchored to platform payments');
END;--> statement-breakpoint
CREATE TRIGGER `smartlingo_referral_code_owner_update_trg`
BEFORE UPDATE OF `user_id` ON `referral_codes`
FOR EACH ROW
WHEN EXISTS (
  SELECT 1
  FROM `referrals` AS `referral`
  JOIN `smartlingo_platform_subscription_payments` AS `payment`
    ON `payment`.`direct_referral_id` = `referral`.`id`
  WHERE `referral`.`referral_code_id` = OLD.`id`
    AND `payment`.`introducer_user_id` != NEW.`user_id`
)
BEGIN
  SELECT RAISE(ABORT, 'smartlingo referral code owner is anchored to platform payments');
END;--> statement-breakpoint

CREATE TRIGGER `smartlingo_platform_payment_referral_insert_trg`
BEFORE INSERT ON `smartlingo_platform_subscription_payments`
FOR EACH ROW
WHEN (NEW.`introducer_user_id` IS NULL AND NEW.`direct_referral_id` IS NOT NULL)
  OR (NEW.`introducer_user_id` IS NOT NULL AND (
    NEW.`direct_referral_id` IS NULL
    OR NOT EXISTS (
      SELECT 1
      FROM `referrals` AS `referral`
      JOIN `referral_codes` AS `code` ON `code`.`id` = `referral`.`referral_code_id`
      WHERE `referral`.`id` = NEW.`direct_referral_id`
        AND `referral`.`referred_user_id` = NEW.`subscriber_user_id`
        AND `code`.`user_id` = NEW.`introducer_user_id`
    )
  ))
BEGIN
  SELECT RAISE(ABORT, 'smartlingo platform payment must match one direct referral');
END;--> statement-breakpoint
CREATE TRIGGER `smartlingo_platform_payment_referral_update_trg`
BEFORE UPDATE OF `subscriber_user_id`, `introducer_user_id`, `direct_referral_id`
ON `smartlingo_platform_subscription_payments`
FOR EACH ROW
WHEN (NEW.`introducer_user_id` IS NULL AND NEW.`direct_referral_id` IS NOT NULL)
  OR (NEW.`introducer_user_id` IS NOT NULL AND (
    NEW.`direct_referral_id` IS NULL
    OR NOT EXISTS (
      SELECT 1
      FROM `referrals` AS `referral`
      JOIN `referral_codes` AS `code` ON `code`.`id` = `referral`.`referral_code_id`
      WHERE `referral`.`id` = NEW.`direct_referral_id`
        AND `referral`.`referred_user_id` = NEW.`subscriber_user_id`
        AND `code`.`user_id` = NEW.`introducer_user_id`
    )
  ))
BEGIN
  SELECT RAISE(ABORT, 'smartlingo platform payment must match one direct referral');
END;--> statement-breakpoint

CREATE TRIGGER `smartlingo_reward_earned_payment_insert_trg`
BEFORE INSERT ON `smartlingo_introducer_reward_ledger`
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1
  FROM `smartlingo_platform_subscription_payments` AS `payment`
  JOIN `referrals` AS `referral` ON `referral`.`id` = `payment`.`direct_referral_id`
  JOIN `referral_codes` AS `code` ON `code`.`id` = `referral`.`referral_code_id`
  WHERE `payment`.`id` = NEW.`subscription_payment_id`
    AND `payment`.`status` = 'paid'
    AND `payment`.`amount_cents` > 0
    AND `payment`.`subscriber_user_id` = `referral`.`referred_user_id`
    AND `payment`.`introducer_user_id` = NEW.`introducer_user_id`
    AND `code`.`user_id` = NEW.`introducer_user_id`
)
BEGIN
  SELECT RAISE(ABORT, 'smartlingo reward requires a paid positive platform subscription and matching direct referral');
END;--> statement-breakpoint
CREATE TRIGGER `smartlingo_reward_earned_payment_update_trg`
BEFORE UPDATE OF `introducer_user_id`, `subscription_payment_id`, `status`
ON `smartlingo_introducer_reward_ledger`
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1
  FROM `smartlingo_platform_subscription_payments` AS `payment`
  JOIN `referrals` AS `referral` ON `referral`.`id` = `payment`.`direct_referral_id`
  JOIN `referral_codes` AS `code` ON `code`.`id` = `referral`.`referral_code_id`
  WHERE `payment`.`id` = NEW.`subscription_payment_id`
    AND `payment`.`status` = 'paid'
    AND `payment`.`amount_cents` > 0
    AND `payment`.`subscriber_user_id` = `referral`.`referred_user_id`
    AND `payment`.`introducer_user_id` = NEW.`introducer_user_id`
    AND `code`.`user_id` = NEW.`introducer_user_id`
)
BEGIN
  SELECT RAISE(ABORT, 'smartlingo reward requires a paid positive platform subscription and matching direct referral');
END;--> statement-breakpoint
CREATE TRIGGER `smartlingo_platform_payment_earned_reward_update_trg`
BEFORE UPDATE OF `status`, `amount_cents`, `subscriber_user_id`, `introducer_user_id`, `direct_referral_id`
ON `smartlingo_platform_subscription_payments`
FOR EACH ROW
WHEN EXISTS (
  SELECT 1
  FROM `smartlingo_introducer_reward_ledger` AS `ledger`
  WHERE `ledger`.`subscription_payment_id` = OLD.`id`
    AND `ledger`.`status` = 'earned'
    AND NOT EXISTS (
      SELECT 1
      FROM `referrals` AS `referral`
      JOIN `referral_codes` AS `code` ON `code`.`id` = `referral`.`referral_code_id`
      WHERE NEW.`status` = 'paid'
        AND NEW.`amount_cents` > 0
        AND `referral`.`id` = NEW.`direct_referral_id`
        AND `referral`.`referred_user_id` = NEW.`subscriber_user_id`
        AND `code`.`user_id` = NEW.`introducer_user_id`
        AND `ledger`.`introducer_user_id` = NEW.`introducer_user_id`
    )
)
BEGIN
  SELECT RAISE(ABORT, 'smartlingo earned reward must be reversed before payment reversal');
END;
