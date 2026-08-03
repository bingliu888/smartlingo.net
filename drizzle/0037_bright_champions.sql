CREATE TABLE `community_meetings` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_user_id` text NOT NULL,
	`thread_id` text NOT NULL,
	`title` text NOT NULL,
	`scheduled_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`ended_at` integer,
	FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`thread_id`) REFERENCES `message_threads`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "smartlingo_community_meeting_title_ck" CHECK(length(trim("community_meetings"."title")) BETWEEN 3 AND 80)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `community_meetings_thread_id_unique` ON `community_meetings` (`thread_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `smartlingo_community_meeting_active_owner_uq` ON `community_meetings` (`owner_user_id`) WHERE "community_meetings"."ended_at" IS NULL;--> statement-breakpoint
CREATE INDEX `smartlingo_community_meeting_schedule_idx` ON `community_meetings` (`ended_at`,`scheduled_at`);