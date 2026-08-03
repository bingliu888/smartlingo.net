ALTER TABLE `message_calls` ADD `solo_since_at` integer;--> statement-breakpoint
ALTER TABLE `message_call_participants` ADD `last_seen_at` integer;--> statement-breakpoint
UPDATE `message_call_participants` SET `last_seen_at` = `joined_at` WHERE `last_seen_at` IS NULL;
