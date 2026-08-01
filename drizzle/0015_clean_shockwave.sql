CREATE TABLE `smartlingo_admin_audit` (
	`id` text PRIMARY KEY NOT NULL,
	`idempotency_key` text NOT NULL,
	`actor_user_id` text NOT NULL,
	`actor_email` text NOT NULL,
	`action` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`request_hash` text NOT NULL,
	`operation_token` text NOT NULL,
	`status` text DEFAULT 'in_progress' NOT NULL,
	`response_json` text DEFAULT '{}' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`completed_at` integer,
	FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "smartlingo_admin_audit_status_ck" CHECK("smartlingo_admin_audit"."status" IN ('in_progress', 'completed', 'failed'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `smartlingo_admin_audit_idempotency_key_unique` ON `smartlingo_admin_audit` (`idempotency_key`);--> statement-breakpoint
CREATE INDEX `smartlingo_admin_audit_actor_created_idx` ON `smartlingo_admin_audit` (`actor_user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `smartlingo_admin_audit_target_created_idx` ON `smartlingo_admin_audit` (`target_type`,`target_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `smartlingo_license_orders` ADD `review_decision` text;--> statement-breakpoint
ALTER TABLE `smartlingo_license_orders` ADD `reviewed_by` text;--> statement-breakpoint
ALTER TABLE `smartlingo_license_orders` ADD `reviewed_at` integer;--> statement-breakpoint
ALTER TABLE `smartlingo_license_orders` ADD `decision_note` text;