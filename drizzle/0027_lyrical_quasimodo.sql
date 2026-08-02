CREATE TABLE `platform_member_access` (
  `user_id` text PRIMARY KEY NOT NULL,
  `status` text DEFAULT 'active' NOT NULL,
  `subscriber_override` integer DEFAULT 0 NOT NULL,
  `updated_by_user_id` text,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`updated_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `platform_member_access_status_idx` ON `platform_member_access` (`status`,`updated_at`);--> statement-breakpoint
CREATE TABLE `platform_admin_audit` (
  `id` text PRIMARY KEY NOT NULL,
  `admin_user_id` text,
  `target_user_id` text,
  `action` text NOT NULL,
  `created_at` integer NOT NULL,
  FOREIGN KEY (`admin_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
  FOREIGN KEY (`target_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `platform_admin_audit_target_idx` ON `platform_admin_audit` (`target_user_id`,`created_at`);
