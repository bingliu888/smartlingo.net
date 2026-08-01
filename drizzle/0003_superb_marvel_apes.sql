CREATE TABLE `community_replies` (
	`id` text PRIMARY KEY NOT NULL,
	`topic_id` text NOT NULL,
	`user_id` text NOT NULL,
	`body` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`topic_id`) REFERENCES `community_topics`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `smartcert_community_reply_topic_idx` ON `community_replies` (`topic_id`);--> statement-breakpoint
CREATE INDEX `smartcert_community_reply_created_idx` ON `community_replies` (`created_at`);--> statement-breakpoint
CREATE TABLE `community_topics` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`category` text DEFAULT 'general' NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `smartcert_community_topic_updated_idx` ON `community_topics` (`updated_at`);--> statement-breakpoint
CREATE INDEX `smartcert_community_topic_category_idx` ON `community_topics` (`category`);