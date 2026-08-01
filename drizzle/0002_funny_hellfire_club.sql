CREATE TABLE `passwordless_login_codes` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`code_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`used_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `smartcert_passwordless_email_idx` ON `passwordless_login_codes` (`email`);--> statement-breakpoint
CREATE INDEX `smartcert_passwordless_expires_idx` ON `passwordless_login_codes` (`expires_at`);