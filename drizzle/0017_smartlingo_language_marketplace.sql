CREATE TABLE `smartlingo_language_paths` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`target_language` text NOT NULL,
	`level` text NOT NULL,
	`title_en` text NOT NULL,
	`title_zh` text NOT NULL,
	`status` text DEFAULT 'published' NOT NULL,
	`version` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "smartlingo_language_path_status_ck" CHECK("smartlingo_language_paths"."status" IN ('draft', 'review', 'published', 'archived'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `smartlingo_language_paths_slug_unique` ON `smartlingo_language_paths` (`slug`);
--> statement-breakpoint
CREATE INDEX `smartlingo_language_path_language_level_idx` ON `smartlingo_language_paths` (`target_language`,`level`);
--> statement-breakpoint
CREATE TABLE `smartlingo_connected_accounts` (
	`user_id` text PRIMARY KEY NOT NULL,
	`provider` text DEFAULT 'stripe_connect' NOT NULL,
	`provider_account_id` text,
	`onboarding_status` text DEFAULT 'not_started' NOT NULL,
	`charges_enabled` integer DEFAULT false NOT NULL,
	`payouts_enabled` integer DEFAULT false NOT NULL,
	`requirements_due` text DEFAULT '[]' NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "smartlingo_connected_account_provider_ck" CHECK("smartlingo_connected_accounts"."provider" = 'stripe_connect'),
	CONSTRAINT "smartlingo_connected_account_status_ck" CHECK("smartlingo_connected_accounts"."onboarding_status" IN ('not_started', 'pending', 'restricted', 'ready', 'disabled'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `smartlingo_connected_accounts_provider_account_id_unique` ON `smartlingo_connected_accounts` (`provider_account_id`);
--> statement-breakpoint
CREATE INDEX `smartlingo_connected_account_status_idx` ON `smartlingo_connected_accounts` (`onboarding_status`);
--> statement-breakpoint
CREATE TABLE `smartlingo_language_classes` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_user_id` text NOT NULL,
	`path_id` text NOT NULL,
	`owner_role` text DEFAULT 'coordinator' NOT NULL,
	`title` text NOT NULL,
	`summary` text DEFAULT '' NOT NULL,
	`target_language` text NOT NULL,
	`level` text NOT NULL,
	`schedule` text DEFAULT 'Self-paced' NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`visibility` text DEFAULT 'private' NOT NULL,
	`price_cents` integer DEFAULT 0 NOT NULL,
	`currency` text DEFAULT 'USD' NOT NULL,
	`capacity` integer DEFAULT 30 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`path_id`) REFERENCES `smartlingo_language_paths`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "smartlingo_language_class_role_ck" CHECK("smartlingo_language_classes"."owner_role" IN ('teacher', 'coordinator')),
	CONSTRAINT "smartlingo_language_class_status_ck" CHECK("smartlingo_language_classes"."status" IN ('draft', 'open', 'closed', 'archived')),
	CONSTRAINT "smartlingo_language_class_visibility_ck" CHECK("smartlingo_language_classes"."visibility" IN ('private', 'review', 'public')),
	CONSTRAINT "smartlingo_language_class_price_ck" CHECK("smartlingo_language_classes"."price_cents" >= 0),
	CONSTRAINT "smartlingo_language_class_capacity_ck" CHECK("smartlingo_language_classes"."capacity" > 0 AND "smartlingo_language_classes"."capacity" <= 1000)
);
--> statement-breakpoint
CREATE INDEX `smartlingo_language_class_owner_status_idx` ON `smartlingo_language_classes` (`owner_user_id`,`status`);
--> statement-breakpoint
CREATE INDEX `smartlingo_language_class_directory_idx` ON `smartlingo_language_classes` (`visibility`,`status`);
--> statement-breakpoint
CREATE TABLE `smartlingo_language_class_members` (
	`id` text PRIMARY KEY NOT NULL,
	`class_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text DEFAULT 'student' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`joined_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`class_id`) REFERENCES `smartlingo_language_classes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "smartlingo_language_class_member_role_ck" CHECK("smartlingo_language_class_members"."role" IN ('owner', 'teacher', 'coordinator', 'student')),
	CONSTRAINT "smartlingo_language_class_member_status_ck" CHECK("smartlingo_language_class_members"."status" IN ('invited', 'active', 'paused', 'left', 'removed'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `smartlingo_language_class_member_uq` ON `smartlingo_language_class_members` (`class_id`,`user_id`);
--> statement-breakpoint
CREATE INDEX `smartlingo_language_class_member_user_idx` ON `smartlingo_language_class_members` (`user_id`,`status`);
--> statement-breakpoint
CREATE TABLE `smartlingo_language_class_invites` (
	`id` text PRIMARY KEY NOT NULL,
	`class_id` text NOT NULL,
	`created_by_user_id` text NOT NULL,
	`code_hash` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`expires_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`class_id`) REFERENCES `smartlingo_language_classes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "smartlingo_language_class_invite_status_ck" CHECK("smartlingo_language_class_invites"."status" IN ('active', 'disabled', 'expired'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `smartlingo_language_class_invites_code_hash_unique` ON `smartlingo_language_class_invites` (`code_hash`);
--> statement-breakpoint
CREATE INDEX `smartlingo_language_class_invite_class_idx` ON `smartlingo_language_class_invites` (`class_id`,`status`);
--> statement-breakpoint
CREATE TABLE `smartlingo_language_class_orders` (
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
	CONSTRAINT "smartlingo_language_class_order_provider_ck" CHECK("smartlingo_language_class_orders"."provider" = 'stripe_connect'),
	CONSTRAINT "smartlingo_language_class_order_discount_ck" CHECK("smartlingo_language_class_orders"."discount_basis_points" IN (0, 1500)),
	CONSTRAINT "smartlingo_language_class_order_split_ck" CHECK("smartlingo_language_class_orders"."owner_share_cents" + "smartlingo_language_class_orders"."platform_fee_cents" = "smartlingo_language_class_orders"."discounted_pre_tax_cents"),
	CONSTRAINT "smartlingo_language_class_order_amount_ck" CHECK("smartlingo_language_class_orders"."subtotal_cents" >= 0 AND "smartlingo_language_class_orders"."discounted_pre_tax_cents" >= 0 AND "smartlingo_language_class_orders"."tax_cents" >= 0),
	CONSTRAINT "smartlingo_language_class_order_status_ck" CHECK("smartlingo_language_class_orders"."status" IN ('pending', 'paid', 'refunded', 'partially_refunded', 'disputed', 'failed', 'cancelled'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `smartlingo_language_class_orders_provider_checkout_id_unique` ON `smartlingo_language_class_orders` (`provider_checkout_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `smartlingo_language_class_orders_provider_payment_id_unique` ON `smartlingo_language_class_orders` (`provider_payment_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `smartlingo_language_class_orders_webhook_event_id_unique` ON `smartlingo_language_class_orders` (`webhook_event_id`);
--> statement-breakpoint
CREATE INDEX `smartlingo_language_class_order_learner_class_idx` ON `smartlingo_language_class_orders` (`learner_user_id`,`class_id`,`status`);
--> statement-breakpoint
CREATE INDEX `smartlingo_language_class_order_owner_idx` ON `smartlingo_language_class_orders` (`owner_user_id`,`status`,`created_at`);
--> statement-breakpoint
CREATE TABLE `smartlingo_platform_subscription_payments` (
	`id` text PRIMARY KEY NOT NULL,
	`provider_invoice_id` text NOT NULL,
	`subscriber_user_id` text NOT NULL,
	`introducer_user_id` text,
	`amount_cents` integer NOT NULL,
	`currency` text DEFAULT 'USD' NOT NULL,
	`status` text DEFAULT 'paid' NOT NULL,
	`paid_at` integer NOT NULL,
	`refunded_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`subscriber_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`introducer_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "smartlingo_platform_subscription_payment_status_ck" CHECK("smartlingo_platform_subscription_payments"."status" IN ('paid', 'refunded', 'disputed', 'void')),
	CONSTRAINT "smartlingo_platform_subscription_payment_amount_ck" CHECK("smartlingo_platform_subscription_payments"."amount_cents" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `smartlingo_platform_subscription_payments_provider_invoice_id_unique` ON `smartlingo_platform_subscription_payments` (`provider_invoice_id`);
--> statement-breakpoint
CREATE INDEX `smartlingo_platform_subscription_subscriber_idx` ON `smartlingo_platform_subscription_payments` (`subscriber_user_id`,`paid_at`);
--> statement-breakpoint
CREATE INDEX `smartlingo_platform_subscription_introducer_idx` ON `smartlingo_platform_subscription_payments` (`introducer_user_id`,`paid_at`);
--> statement-breakpoint
CREATE TABLE `smartlingo_introducer_reward_ledger` (
	`id` text PRIMARY KEY NOT NULL,
	`introducer_user_id` text NOT NULL,
	`subscription_payment_id` text NOT NULL,
	`points` integer NOT NULL,
	`status` text DEFAULT 'earned' NOT NULL,
	`created_at` integer NOT NULL,
	`reversed_at` integer,
	FOREIGN KEY (`introducer_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`subscription_payment_id`) REFERENCES `smartlingo_platform_subscription_payments`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "smartlingo_introducer_reward_points_ck" CHECK("smartlingo_introducer_reward_ledger"."points" > 0),
	CONSTRAINT "smartlingo_introducer_reward_status_ck" CHECK("smartlingo_introducer_reward_ledger"."status" IN ('earned', 'reversed'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `smartlingo_introducer_reward_ledger_subscription_payment_id_unique` ON `smartlingo_introducer_reward_ledger` (`subscription_payment_id`);
--> statement-breakpoint
CREATE INDEX `smartlingo_introducer_reward_user_idx` ON `smartlingo_introducer_reward_ledger` (`introducer_user_id`,`created_at`);
--> statement-breakpoint
INSERT INTO `smartlingo_language_paths`
  (`id`,`slug`,`target_language`,`level`,`title_en`,`title_zh`,`status`,`version`,`created_at`,`updated_at`)
VALUES
  ('path_es_a1','spanish-a1','es','A1','Spanish from day one','西班牙语从第一天开口','published','2026.07.31',1785499200,1785499200),
  ('path_en_a1','english-a1','en','A1','English from day one','英语从第一天开口','published','2026.07.31',1785499200,1785499200),
  ('path_fr_a1','french-a1','fr','A1','French from day one','法语从第一天开口','published','2026.07.31',1785499200,1785499200),
  ('path_ja_a1','japanese-a1','ja','A1','Japanese from day one','日语从第一天开口','published','2026.07.31',1785499200,1785499200),
  ('path_de_a1','german-a1','de','A1','German from day one','德语从第一天开口','published','2026.07.31',1785499200,1785499200),
  ('path_it_a1','italian-a1','it','A1','Italian from day one','意大利语从第一天开口','published','2026.07.31',1785499200,1785499200),
  ('path_ko_a1','korean-a1','ko','A1','Korean from day one','韩语从第一天开口','published','2026.07.31',1785499200,1785499200);
