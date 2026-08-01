CREATE TABLE `smartlingo_bacc_ledger` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`amount` integer NOT NULL,
	`reason` text NOT NULL,
	`reference` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "smartlingo_bacc_amount_ck" CHECK("smartlingo_bacc_ledger"."amount" <> 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `smartlingo_bacc_ledger_reference_unique` ON `smartlingo_bacc_ledger` (`reference`);--> statement-breakpoint
CREATE INDEX `smartlingo_bacc_user_created_idx` ON `smartlingo_bacc_ledger` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `smartlingo_class_access_grants` (
	`id` text PRIMARY KEY NOT NULL,
	`enrollment_id` text NOT NULL,
	`method` text NOT NULL,
	`invite_id` text,
	`license_order_id` text,
	`status` text DEFAULT 'mvp_recorded' NOT NULL,
	`amount_cents` integer DEFAULT 0 NOT NULL,
	`discount_percent` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`enrollment_id`) REFERENCES `smartlingo_class_enrollments`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`invite_id`) REFERENCES `smartlingo_class_invites`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`license_order_id`) REFERENCES `smartlingo_license_orders`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "smartlingo_class_access_method_ck" CHECK("smartlingo_class_access_grants"."method" IN ('referral', 'license_key')),
	CONSTRAINT "smartlingo_class_access_exclusive_ck" CHECK((
    ("smartlingo_class_access_grants"."method" = 'referral' AND "smartlingo_class_access_grants"."invite_id" IS NOT NULL AND "smartlingo_class_access_grants"."license_order_id" IS NULL)
    OR
    ("smartlingo_class_access_grants"."method" = 'license_key' AND "smartlingo_class_access_grants"."invite_id" IS NULL AND "smartlingo_class_access_grants"."license_order_id" IS NOT NULL)
  )),
	CONSTRAINT "smartlingo_class_access_status_ck" CHECK("smartlingo_class_access_grants"."status" IN ('mvp_recorded', 'confirmed', 'void')),
	CONSTRAINT "smartlingo_class_access_amount_ck" CHECK("smartlingo_class_access_grants"."amount_cents" >= 0 AND "smartlingo_class_access_grants"."discount_percent" BETWEEN 0 AND 100)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `smartlingo_class_access_grants_enrollment_id_unique` ON `smartlingo_class_access_grants` (`enrollment_id`);--> statement-breakpoint
CREATE INDEX `smartlingo_class_access_method_idx` ON `smartlingo_class_access_grants` (`method`);--> statement-breakpoint
CREATE TABLE `smartlingo_class_enrollments` (
	`id` text PRIMARY KEY NOT NULL,
	`class_id` text NOT NULL,
	`user_id` text NOT NULL,
	`direct_referrer_user_id` text,
	`referral_claim_id` text,
	`phase` integer DEFAULT 1 NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`enrolled_at` integer NOT NULL,
	`completed_at` integer,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`class_id`) REFERENCES `smartlingo_classes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`direct_referrer_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`referral_claim_id`) REFERENCES `smartlingo_class_referral_claims`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "smartlingo_class_enrollment_phase_ck" CHECK("smartlingo_class_enrollments"."phase" >= 1),
	CONSTRAINT "smartlingo_class_enrollment_status_ck" CHECK("smartlingo_class_enrollments"."status" IN ('active', 'paused', 'completed', 'withdrawn'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `smartlingo_class_enrollment_user_uq` ON `smartlingo_class_enrollments` (`class_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `smartlingo_class_enrollment_user_status_idx` ON `smartlingo_class_enrollments` (`user_id`,`status`);--> statement-breakpoint
CREATE INDEX `smartlingo_class_enrollment_class_status_idx` ON `smartlingo_class_enrollments` (`class_id`,`status`);--> statement-breakpoint
CREATE TABLE `smartlingo_class_invite_visits` (
	`id` text PRIMARY KEY NOT NULL,
	`invite_id` text NOT NULL,
	`visited_at` integer NOT NULL,
	`claimed_by_user_id` text,
	`claimed_at` integer,
	FOREIGN KEY (`invite_id`) REFERENCES `smartlingo_class_invites`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`claimed_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `smartlingo_class_invite_visit_invite_idx` ON `smartlingo_class_invite_visits` (`invite_id`,`visited_at`);--> statement-breakpoint
CREATE INDEX `smartlingo_class_invite_visit_claim_idx` ON `smartlingo_class_invite_visits` (`claimed_by_user_id`);--> statement-breakpoint
CREATE TABLE `smartlingo_class_invites` (
	`id` text PRIMARY KEY NOT NULL,
	`class_id` text NOT NULL,
	`referrer_user_id` text NOT NULL,
	`code` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer,
	FOREIGN KEY (`class_id`) REFERENCES `smartlingo_classes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`referrer_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "smartlingo_class_invite_status_ck" CHECK("smartlingo_class_invites"."status" IN ('active', 'disabled', 'expired'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `smartlingo_class_invites_code_unique` ON `smartlingo_class_invites` (`code`);--> statement-breakpoint
CREATE UNIQUE INDEX `smartlingo_class_invite_referrer_uq` ON `smartlingo_class_invites` (`class_id`,`referrer_user_id`);--> statement-breakpoint
CREATE INDEX `smartlingo_class_invite_class_status_idx` ON `smartlingo_class_invites` (`class_id`,`status`);--> statement-breakpoint
CREATE INDEX `smartlingo_class_invite_referrer_idx` ON `smartlingo_class_invites` (`referrer_user_id`);--> statement-breakpoint
CREATE TABLE `smartlingo_class_price_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`class_id` text NOT NULL,
	`requested_by_user_id` text NOT NULL,
	`current_price_cents` integer NOT NULL,
	`requested_price_cents` integer NOT NULL,
	`status` text DEFAULT 'pending_admin' NOT NULL,
	`reviewed_by` text,
	`requested_at` integer NOT NULL,
	`reviewed_at` integer,
	FOREIGN KEY (`class_id`) REFERENCES `smartlingo_classes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`requested_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "smartlingo_price_request_status_ck" CHECK("smartlingo_class_price_requests"."status" IN ('pending_admin', 'approved', 'rejected', 'cancelled')),
	CONSTRAINT "smartlingo_price_request_amount_ck" CHECK("smartlingo_class_price_requests"."current_price_cents" >= 0 AND "smartlingo_class_price_requests"."requested_price_cents" >= 0)
);
--> statement-breakpoint
CREATE INDEX `smartlingo_price_request_class_status_idx` ON `smartlingo_class_price_requests` (`class_id`,`status`);--> statement-breakpoint
CREATE INDEX `smartlingo_price_request_requester_idx` ON `smartlingo_class_price_requests` (`requested_by_user_id`);--> statement-breakpoint
CREATE TABLE `smartlingo_class_referral_claims` (
	`id` text PRIMARY KEY NOT NULL,
	`invite_id` text NOT NULL,
	`class_id` text NOT NULL,
	`referrer_user_id` text NOT NULL,
	`referred_user_id` text NOT NULL,
	`new_verified_member` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'recorded' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`invite_id`) REFERENCES `smartlingo_class_invites`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`class_id`) REFERENCES `smartlingo_classes`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`referrer_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`referred_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "smartlingo_class_referral_status_ck" CHECK("smartlingo_class_referral_claims"."status" IN ('recorded', 'qualified', 'rewarded', 'void'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `smartlingo_class_referral_referred_uq` ON `smartlingo_class_referral_claims` (`referred_user_id`);--> statement-breakpoint
CREATE INDEX `smartlingo_class_referral_referrer_idx` ON `smartlingo_class_referral_claims` (`referrer_user_id`);--> statement-breakpoint
CREATE INDEX `smartlingo_class_referral_class_idx` ON `smartlingo_class_referral_claims` (`class_id`);--> statement-breakpoint
CREATE TABLE `smartlingo_classes` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_user_id` text NOT NULL,
	`template_id` text NOT NULL,
	`license_order_id` text NOT NULL,
	`source` text NOT NULL,
	`title` text NOT NULL,
	`summary` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`visibility` text DEFAULT 'private' NOT NULL,
	`directory_review_status` text DEFAULT 'not_requested' NOT NULL,
	`price_cents` integer DEFAULT 0 NOT NULL,
	`currency` text DEFAULT 'USD' NOT NULL,
	`capacity` integer DEFAULT 30 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`template_id`) REFERENCES `smartlingo_course_templates`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`license_order_id`) REFERENCES `smartlingo_license_orders`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "smartlingo_class_source_ck" CHECK("smartlingo_classes"."source" IN ('template_clone', 'original')),
	CONSTRAINT "smartlingo_class_status_ck" CHECK("smartlingo_classes"."status" IN ('draft', 'open', 'closed', 'archived')),
	CONSTRAINT "smartlingo_class_visibility_ck" CHECK("smartlingo_classes"."visibility" IN ('private', 'public')),
	CONSTRAINT "smartlingo_class_directory_review_ck" CHECK("smartlingo_classes"."directory_review_status" IN ('not_requested', 'clara_pending', 'admin_pending', 'approved', 'rejected')),
	CONSTRAINT "smartlingo_class_price_ck" CHECK("smartlingo_classes"."price_cents" >= 0),
	CONSTRAINT "smartlingo_class_capacity_ck" CHECK("smartlingo_classes"."capacity" > 0 AND "smartlingo_classes"."capacity" <= 10000)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `smartlingo_class_license_uq` ON `smartlingo_classes` (`license_order_id`);--> statement-breakpoint
CREATE INDEX `smartlingo_class_owner_status_idx` ON `smartlingo_classes` (`owner_user_id`,`status`);--> statement-breakpoint
CREATE INDEX `smartlingo_class_template_status_idx` ON `smartlingo_classes` (`template_id`,`status`);--> statement-breakpoint
CREATE INDEX `smartlingo_class_directory_idx` ON `smartlingo_classes` (`visibility`,`directory_review_status`);--> statement-breakpoint
CREATE TABLE `smartlingo_course_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`owner_user_id` text,
	`origin` text DEFAULT 'admin' NOT NULL,
	`title_en` text NOT NULL,
	`title_zh` text NOT NULL,
	`summary_en` text DEFAULT '' NOT NULL,
	`summary_zh` text DEFAULT '' NOT NULL,
	`syllabus` text DEFAULT '{}' NOT NULL,
	`price_cents` integer DEFAULT 0 NOT NULL,
	`currency` text DEFAULT 'USD' NOT NULL,
	`approval_status` text DEFAULT 'draft' NOT NULL,
	`clara_status` text DEFAULT 'not_requested' NOT NULL,
	`directory_status` text DEFAULT 'private' NOT NULL,
	`approved_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "smartlingo_template_origin_ck" CHECK("smartlingo_course_templates"."origin" IN ('admin', 'member')),
	CONSTRAINT "smartlingo_template_approval_ck" CHECK("smartlingo_course_templates"."approval_status" IN ('draft', 'owner_private', 'clara_pending', 'admin_pending', 'approved', 'rejected')),
	CONSTRAINT "smartlingo_template_clara_ck" CHECK("smartlingo_course_templates"."clara_status" IN ('not_requested', 'pending', 'passed', 'flagged')),
	CONSTRAINT "smartlingo_template_directory_ck" CHECK("smartlingo_course_templates"."directory_status" IN ('private', 'review_pending', 'public', 'rejected')),
	CONSTRAINT "smartlingo_template_price_ck" CHECK("smartlingo_course_templates"."price_cents" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `smartlingo_course_templates_slug_unique` ON `smartlingo_course_templates` (`slug`);--> statement-breakpoint
CREATE INDEX `smartlingo_template_approval_directory_idx` ON `smartlingo_course_templates` (`approval_status`,`directory_status`);--> statement-breakpoint
CREATE INDEX `smartlingo_template_owner_idx` ON `smartlingo_course_templates` (`owner_user_id`);--> statement-breakpoint
CREATE TABLE `smartlingo_license_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`buyer_user_id` text NOT NULL,
	`template_id` text,
	`purpose` text DEFAULT 'template_clone' NOT NULL,
	`status` text DEFAULT 'pending_admin' NOT NULL,
	`license_key_hash` text,
	`seats_purchased` integer DEFAULT 1 NOT NULL,
	`seats_remaining` integer DEFAULT 1 NOT NULL,
	`amount_cents` integer DEFAULT 0 NOT NULL,
	`currency` text DEFAULT 'USD' NOT NULL,
	`requested_at` integer NOT NULL,
	`issued_at` integer,
	`expires_at` integer,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`buyer_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`template_id`) REFERENCES `smartlingo_course_templates`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "smartlingo_license_purpose_ck" CHECK("smartlingo_license_orders"."purpose" IN ('template_clone', 'original_class', 'student_access')),
	CONSTRAINT "smartlingo_license_status_ck" CHECK("smartlingo_license_orders"."status" IN ('pending_admin', 'issued', 'assigned', 'exhausted', 'expired', 'revoked')),
	CONSTRAINT "smartlingo_license_seats_ck" CHECK("smartlingo_license_orders"."seats_purchased" > 0 AND "smartlingo_license_orders"."seats_remaining" >= 0 AND "smartlingo_license_orders"."seats_remaining" <= "smartlingo_license_orders"."seats_purchased")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `smartlingo_license_orders_license_key_hash_unique` ON `smartlingo_license_orders` (`license_key_hash`);--> statement-breakpoint
CREATE INDEX `smartlingo_license_buyer_status_idx` ON `smartlingo_license_orders` (`buyer_user_id`,`status`);--> statement-breakpoint
CREATE INDEX `smartlingo_license_template_idx` ON `smartlingo_license_orders` (`template_id`);--> statement-breakpoint
CREATE TABLE `smartlingo_memberships` (
	`user_id` text PRIMARY KEY NOT NULL,
	`tier` text DEFAULT 'bronze' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`granted_by` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "smartlingo_membership_tier_ck" CHECK("smartlingo_memberships"."tier" IN ('bronze', 'silver', 'gold', 'platinum')),
	CONSTRAINT "smartlingo_membership_status_ck" CHECK("smartlingo_memberships"."status" IN ('active', 'paused', 'revoked'))
);
--> statement-breakpoint
CREATE INDEX `smartlingo_membership_tier_status_idx` ON `smartlingo_memberships` (`tier`,`status`);
--> statement-breakpoint
INSERT INTO `smartlingo_course_templates`
  (`id`, `slug`, `origin`, `title_en`, `title_zh`, `summary_en`, `summary_zh`, `syllabus`, `price_cents`, `currency`, `approval_status`, `clara_status`, `directory_status`, `approved_at`, `created_at`, `updated_at`)
VALUES
  (
    'tpl_ai_foundations_2026',
    'ai-foundations',
    'admin',
    'Practical AI Foundations',
    '实用人工智能基础',
    'Understand modern AI, prompt clearly, evaluate results and work safely with everyday AI tools.',
    '理解现代人工智能、清晰提出任务、判断输出质量，并安全使用常见智能工具。',
    '{"phases":[{"id":1,"title":"AI literacy"},{"id":2,"title":"Prompt practice"},{"id":3,"title":"Evaluation and safety"}]}',
    9900,
    'USD',
    'approved',
    'passed',
    'public',
    1785462308,
    1785462308,
    1785462308
  ),
  (
    'tpl_ai_workflows_2026',
    'ai-workflow-builder',
    'admin',
    'AI Workflow Builder',
    '人工智能工作流设计',
    'Turn repeatable work into a supervised AI workflow with clear inputs, review gates and measurable outcomes.',
    '把重复工作设计成可监督的智能工作流，明确输入、人工审核节点和可衡量结果。',
    '{"phases":[{"id":1,"title":"Map the work"},{"id":2,"title":"Build the workflow"},{"id":3,"title":"Test and improve"}]}',
    14900,
    'USD',
    'approved',
    'passed',
    'public',
    1785462308,
    1785462308,
    1785462308
  ),
  (
    'tpl_ai_agents_2026',
    'responsible-ai-agents',
    'admin',
    'Responsible AI Agent Operations',
    '负责任的智能体运营',
    'Plan, supervise and improve AI agents while protecting people, data and business controls.',
    '在保护人员、数据与业务控制的前提下，规划、监督并改进智能体。',
    '{"phases":[{"id":1,"title":"Agent scope"},{"id":2,"title":"Tools and controls"},{"id":3,"title":"Operations and audit"}]}',
    19900,
    'USD',
    'approved',
    'passed',
    'public',
    1785462308,
    1785462308,
    1785462308
  );
