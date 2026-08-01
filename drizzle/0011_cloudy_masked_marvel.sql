CREATE TABLE `activity_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`enrollment_id` text NOT NULL,
	`user_id` text NOT NULL,
	`activity_id` text NOT NULL,
	`kind` text NOT NULL,
	`content_version` text NOT NULL,
	`client_attempt_key` text NOT NULL,
	`started_at` integer NOT NULL,
	`submitted_at` integer,
	`score` integer,
	`rubric_version` text,
	`ai_score_provisional` integer DEFAULT false NOT NULL,
	`feedback` text DEFAULT '{}' NOT NULL,
	`evidence_refs` text DEFAULT '[]' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`enrollment_id`) REFERENCES `stage_enrollments`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `activity_attempts_client_attempt_key_unique` ON `activity_attempts` (`client_attempt_key`);--> statement-breakpoint
CREATE INDEX `smartcert_activity_attempt_user_activity_idx` ON `activity_attempts` (`user_id`,`activity_id`);--> statement-breakpoint
CREATE INDEX `smartcert_activity_attempt_enrollment_submitted_idx` ON `activity_attempts` (`enrollment_id`,`submitted_at`);--> statement-breakpoint
CREATE INDEX `smartcert_activity_attempt_kind_idx` ON `activity_attempts` (`kind`);--> statement-breakpoint
CREATE TABLE `credential_sources` (
	`id` text PRIMARY KEY NOT NULL,
	`track_id` text NOT NULL,
	`jurisdiction` text NOT NULL,
	`role` text NOT NULL,
	`issuer` text NOT NULL,
	`title` text NOT NULL,
	`official_url` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`last_verified_at` integer NOT NULL,
	`review_due_at` integer NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `smartcert_credential_source_scope_issuer_uq` ON `credential_sources` (`track_id`,`jurisdiction`,`role`,`issuer`);--> statement-breakpoint
CREATE INDEX `smartcert_credential_source_review_due_idx` ON `credential_sources` (`review_due_at`);--> statement-breakpoint
CREATE INDEX `smartcert_credential_source_status_idx` ON `credential_sources` (`status`);--> statement-breakpoint
CREATE TABLE `learning_credentials` (
	`id` text PRIMARY KEY NOT NULL,
	`enrollment_id` text NOT NULL,
	`user_id` text NOT NULL,
	`stage` integer NOT NULL,
	`track_id` text,
	`jurisdiction` text,
	`credential_kind` text NOT NULL,
	`verification_code` text NOT NULL,
	`title_zh` text NOT NULL,
	`title_en` text NOT NULL,
	`total_score` integer NOT NULL,
	`skill_scores` text DEFAULT '{}' NOT NULL,
	`issued_at` integer NOT NULL,
	`revoked_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`enrollment_id`) REFERENCES `stage_enrollments`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `learning_credentials_verification_code_unique` ON `learning_credentials` (`verification_code`);--> statement-breakpoint
CREATE INDEX `smartcert_learning_credential_user_stage_idx` ON `learning_credentials` (`user_id`,`stage`);--> statement-breakpoint
CREATE INDEX `smartcert_learning_credential_track_idx` ON `learning_credentials` (`track_id`);--> statement-breakpoint
CREATE INDEX `smartcert_learning_credential_issued_idx` ON `learning_credentials` (`issued_at`);--> statement-breakpoint
CREATE TABLE `learning_progress` (
	`id` text PRIMARY KEY NOT NULL,
	`enrollment_id` text NOT NULL,
	`user_id` text NOT NULL,
	`activity_id` text NOT NULL,
	`content_version` text NOT NULL,
	`status` text DEFAULT 'not_started' NOT NULL,
	`best_score` integer,
	`attempt_count` integer DEFAULT 0 NOT NULL,
	`mastery_streak` integer DEFAULT 0 NOT NULL,
	`due_at` integer,
	`completed_at` integer,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`enrollment_id`) REFERENCES `stage_enrollments`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `smartcert_learning_progress_activity_uq` ON `learning_progress` (`enrollment_id`,`activity_id`,`content_version`);--> statement-breakpoint
CREATE INDEX `smartcert_learning_progress_user_due_idx` ON `learning_progress` (`user_id`,`due_at`);--> statement-breakpoint
CREATE INDEX `smartcert_learning_progress_status_idx` ON `learning_progress` (`status`);--> statement-breakpoint
CREATE TABLE `skill_scores` (
	`id` text PRIMARY KEY NOT NULL,
	`attempt_id` text NOT NULL,
	`skill` text NOT NULL,
	`score` integer NOT NULL,
	`provisional` integer DEFAULT false NOT NULL,
	`rubric_version` text NOT NULL,
	`evidence` text DEFAULT '{}' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`attempt_id`) REFERENCES `activity_attempts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `smartcert_skill_score_attempt_skill_uq` ON `skill_scores` (`attempt_id`,`skill`);--> statement-breakpoint
CREATE INDEX `smartcert_skill_score_skill_idx` ON `skill_scores` (`skill`);--> statement-breakpoint
CREATE TABLE `stage_enrollments` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`stage` integer NOT NULL,
	`track_id` text,
	`jurisdiction` text,
	`scope_key` text NOT NULL,
	`status` text DEFAULT 'locked' NOT NULL,
	`current_unit_id` text,
	`started_at` integer,
	`access_ends_at` integer,
	`passed_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `stage_enrollments_scope_key_unique` ON `stage_enrollments` (`scope_key`);--> statement-breakpoint
CREATE INDEX `smartcert_stage_enrollment_user_stage_idx` ON `stage_enrollments` (`user_id`,`stage`);--> statement-breakpoint
CREATE INDEX `smartcert_stage_enrollment_status_idx` ON `stage_enrollments` (`status`);--> statement-breakpoint
CREATE INDEX `smartcert_stage_enrollment_scope_idx` ON `stage_enrollments` (`stage`,`track_id`,`jurisdiction`);--> statement-breakpoint
CREATE INDEX `smartcert_stage_enrollment_access_ends_idx` ON `stage_enrollments` (`access_ends_at`);--> statement-breakpoint
CREATE TABLE `stage_entitlements` (
	`id` text PRIMARY KEY NOT NULL,
	`enrollment_id` text NOT NULL,
	`user_id` text NOT NULL,
	`stage` integer NOT NULL,
	`track_id` text,
	`jurisdiction` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`provider` text NOT NULL,
	`provider_reference` text,
	`amount_cents` integer NOT NULL,
	`currency` text DEFAULT 'USD' NOT NULL,
	`access_starts_at` integer,
	`access_ends_at` integer,
	`paid_at` integer,
	`refunded_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`enrollment_id`) REFERENCES `stage_enrollments`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `stage_entitlements_provider_reference_unique` ON `stage_entitlements` (`provider_reference`);--> statement-breakpoint
CREATE INDEX `smartcert_stage_entitlement_enrollment_idx` ON `stage_entitlements` (`enrollment_id`);--> statement-breakpoint
CREATE INDEX `smartcert_stage_entitlement_user_stage_idx` ON `stage_entitlements` (`user_id`,`stage`);--> statement-breakpoint
CREATE INDEX `smartcert_stage_entitlement_status_idx` ON `stage_entitlements` (`status`);--> statement-breakpoint
CREATE INDEX `smartcert_stage_entitlement_access_ends_idx` ON `stage_entitlements` (`access_ends_at`);