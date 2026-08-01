CREATE TABLE `smartlingo_media_assets` (
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
	CONSTRAINT "smartlingo_media_kind_ck" CHECK("smartlingo_media_assets"."kind" IN ('avatar', 'course_cover', 'courseware', 'assignment_attachment', 'chat_attachment', 'certificate_asset')),
	CONSTRAINT "smartlingo_media_scope_ck" CHECK(length("smartlingo_media_assets"."scope_type") > 0 AND length("smartlingo_media_assets"."scope_id") > 0),
	CONSTRAINT "smartlingo_media_size_ck" CHECK("smartlingo_media_assets"."size_bytes" >= 0),
	CONSTRAINT "smartlingo_media_visibility_ck" CHECK("smartlingo_media_assets"."visibility" = 'private'),
	CONSTRAINT "smartlingo_media_status_ck" CHECK("smartlingo_media_assets"."status" IN ('uploading', 'ready', 'quarantined', 'failed', 'tombstone'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `smartlingo_media_assets_object_key_unique` ON `smartlingo_media_assets` (`object_key`);--> statement-breakpoint
CREATE INDEX `smartlingo_media_owner_status_idx` ON `smartlingo_media_assets` (`owner_user_id`,`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `smartlingo_media_scope_status_idx` ON `smartlingo_media_assets` (`scope_type`,`scope_id`,`status`);--> statement-breakpoint
CREATE INDEX `smartlingo_media_kind_status_idx` ON `smartlingo_media_assets` (`kind`,`status`);--> statement-breakpoint
CREATE TABLE `smartlingo_ai_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`usage_window_id` text NOT NULL,
	`feature` text NOT NULL,
	`subject_hash` text NOT NULL,
	`model` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'started' NOT NULL,
	`input_units` integer DEFAULT 0 NOT NULL,
	`output_units` integer DEFAULT 0 NOT NULL,
	`fallback_used` integer DEFAULT false NOT NULL,
	`error_code` text,
	`created_at` integer NOT NULL,
	`completed_at` integer,
	FOREIGN KEY (`usage_window_id`) REFERENCES `smartlingo_ai_usage_windows`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "smartlingo_ai_request_status_ck" CHECK("smartlingo_ai_requests"."status" IN ('started', 'succeeded', 'failed', 'fallback')),
	CONSTRAINT "smartlingo_ai_request_usage_ck" CHECK("smartlingo_ai_requests"."input_units" >= 0 AND "smartlingo_ai_requests"."output_units" >= 0)
);
--> statement-breakpoint
CREATE INDEX `smartlingo_ai_request_window_created_idx` ON `smartlingo_ai_requests` (`usage_window_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `smartlingo_ai_request_subject_feature_idx` ON `smartlingo_ai_requests` (`subject_hash`,`feature`,`created_at`);--> statement-breakpoint
CREATE INDEX `smartlingo_ai_request_status_created_idx` ON `smartlingo_ai_requests` (`status`,`created_at`);--> statement-breakpoint
CREATE TABLE `smartlingo_ai_usage_windows` (
	`id` text PRIMARY KEY NOT NULL,
	`feature` text NOT NULL,
	`subject_hash` text NOT NULL,
	`window_start` integer NOT NULL,
	`window_seconds` integer DEFAULT 60 NOT NULL,
	`request_count` integer DEFAULT 0 NOT NULL,
	`input_units` integer DEFAULT 0 NOT NULL,
	`output_units` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "smartlingo_ai_window_time_ck" CHECK("smartlingo_ai_usage_windows"."window_start" >= 0 AND "smartlingo_ai_usage_windows"."window_seconds" > 0),
	CONSTRAINT "smartlingo_ai_window_usage_ck" CHECK("smartlingo_ai_usage_windows"."request_count" >= 0 AND "smartlingo_ai_usage_windows"."input_units" >= 0 AND "smartlingo_ai_usage_windows"."output_units" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `smartlingo_ai_window_feature_subject_uq` ON `smartlingo_ai_usage_windows` (`feature`,`subject_hash`,`window_start`);--> statement-breakpoint
CREATE INDEX `smartlingo_ai_window_subject_idx` ON `smartlingo_ai_usage_windows` (`subject_hash`,`window_start`);--> statement-breakpoint
ALTER TABLE `sessions` ADD `clerk_session_id` text;--> statement-breakpoint
CREATE INDEX `smartcert_sessions_clerk_session_idx` ON `sessions` (`clerk_session_id`);--> statement-breakpoint
ALTER TABLE `users` ADD `clerk_user_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `users_clerk_user_id_unique` ON `users` (`clerk_user_id`);