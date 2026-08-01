ALTER TABLE `stage_enrollments` ADD `country_code` text;--> statement-breakpoint
ALTER TABLE `stage_enrollments` ADD `region_code` text;--> statement-breakpoint
CREATE INDEX `smartcert_stage_enrollment_location_idx` ON `stage_enrollments` (`country_code`,`region_code`);--> statement-breakpoint
ALTER TABLE `stage_entitlements` ADD `disputed_at` integer;