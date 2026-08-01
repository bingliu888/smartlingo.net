CREATE TABLE `referral_media` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`object_key` text NOT NULL,
	`mime_type` text NOT NULL,
	`name` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `referral_media_object_key_unique` ON `referral_media` (`object_key`);--> statement-breakpoint
CREATE INDEX `smartcert_referral_media_user_created_idx` ON `referral_media` (`user_id`,`created_at`);