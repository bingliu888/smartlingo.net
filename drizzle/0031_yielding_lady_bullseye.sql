CREATE TABLE `message_calls` (
	`id` text PRIMARY KEY NOT NULL,
	`thread_id` text NOT NULL,
	`provider_meeting_id` text NOT NULL,
	`started_by` text NOT NULL,
	`mode` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`ended_at` integer,
	FOREIGN KEY (`thread_id`) REFERENCES `message_threads`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`started_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "smartlingo_message_call_mode_ck" CHECK("message_calls"."mode" IN ('audio', 'video')),
	CONSTRAINT "smartlingo_message_call_status_ck" CHECK("message_calls"."status" IN ('active', 'ended', 'expired'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `message_calls_provider_meeting_id_unique` ON `message_calls` (`provider_meeting_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `smartlingo_message_call_active_thread_uq` ON `message_calls` (`thread_id`) WHERE "message_calls"."status" = 'active';--> statement-breakpoint
CREATE INDEX `smartlingo_message_call_expiry_idx` ON `message_calls` (`status`,`expires_at`);--> statement-breakpoint
CREATE TABLE `message_call_participants` (
	`id` text PRIMARY KEY NOT NULL,
	`call_id` text NOT NULL,
	`user_id` text NOT NULL,
	`provider_participant_id` text NOT NULL,
	`joined_at` integer NOT NULL,
	`left_at` integer,
	FOREIGN KEY (`call_id`) REFERENCES `message_calls`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `smartlingo_message_call_participant_uq` ON `message_call_participants` (`call_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `smartlingo_message_call_participant_user_idx` ON `message_call_participants` (`user_id`,`joined_at`);
