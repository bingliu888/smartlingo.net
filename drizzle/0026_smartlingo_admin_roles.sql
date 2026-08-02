ALTER TABLE `users` ADD `role` text DEFAULT 'member' NOT NULL CHECK (`role` IN ('member','admin'));--> statement-breakpoint
UPDATE `users` SET `role` = 'admin' WHERE lower(`email`) = 'bingliu@cybeye.com';--> statement-breakpoint
CREATE INDEX `smartlingo_users_role_created_idx` ON `users` (`role`,`created_at`);
