CREATE TABLE `notification_preferences` (
	`user_id` text PRIMARY KEY NOT NULL,
	`language` text DEFAULT 'en' NOT NULL,
	`marketing_email` integer DEFAULT false NOT NULL,
	`product_email` integer DEFAULT true NOT NULL,
	`reminder_email` integer DEFAULT true NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `payment_webhook_events` (
	`id` text PRIMARY KEY NOT NULL,
	`event_type` text NOT NULL,
	`processed_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `referral_codes` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`code` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `referral_codes_user_id_unique` ON `referral_codes` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `referral_codes_code_unique` ON `referral_codes` (`code`);--> statement-breakpoint
CREATE TABLE `referrals` (
	`id` text PRIMARY KEY NOT NULL,
	`referral_code_id` text NOT NULL,
	`referred_user_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`discount_percent` integer DEFAULT 15 NOT NULL,
	`first_payment_id` text,
	`qualified_at` integer,
	`rewarded_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`referral_code_id`) REFERENCES `referral_codes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`referred_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `referrals_referred_user_id_unique` ON `referrals` (`referred_user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `referrals_first_payment_id_unique` ON `referrals` (`first_payment_id`);--> statement-breakpoint
CREATE INDEX `smartcert_referrals_code_idx` ON `referrals` (`referral_code_id`);--> statement-breakpoint
CREATE INDEX `smartcert_referrals_status_idx` ON `referrals` (`status`);--> statement-breakpoint
CREATE TABLE `reward_ledger` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`points` integer NOT NULL,
	`reason` text NOT NULL,
	`reference` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reward_ledger_reference_unique` ON `reward_ledger` (`reference`);--> statement-breakpoint
CREATE INDEX `smartcert_reward_user_idx` ON `reward_ledger` (`user_id`);--> statement-breakpoint
CREATE TABLE `subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`paypal_subscription_id` text,
	`paypal_plan_id` text,
	`cadence` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`trial_ends_at` integer,
	`current_period_ends_at` integer,
	`cancel_at_period_end` integer DEFAULT false NOT NULL,
	`referral_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`referral_id`) REFERENCES `referrals`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `subscriptions_user_id_unique` ON `subscriptions` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `subscriptions_paypal_subscription_id_unique` ON `subscriptions` (`paypal_subscription_id`);--> statement-breakpoint
CREATE INDEX `smartcert_subscriptions_status_idx` ON `subscriptions` (`status`);