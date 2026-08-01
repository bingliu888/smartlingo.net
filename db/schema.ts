import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  clerkUserId: text("clerk_user_id").unique(),
  displayName: text("display_name").notNull(),
  passwordHash: text("password_hash").notNull(),
  preferredLanguage: text("preferred_language").notNull().default("en"),
  walletAddress: text("wallet_address"),
  createdAt: integer("created_at").notNull(),
});

export const userAvatars = sqliteTable("user_avatars", {
  userId: text("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  objectKey: text("object_key").notNull().unique(),
  mimeType: text("mime_type").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const careerProfiles = sqliteTable("career_profiles", {
  userId: text("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  accountType: text("account_type").notNull().default("learner"),
  headline: text("headline").notNull().default(""),
  location: text("location").notNull().default(""),
  targetRole: text("target_role").notNull().default(""),
  industry: text("industry").notNull().default(""),
  // User-authored profile context only. Verified certification state lives in stage_enrollments and learning_credentials.
  stage: integer("stage").notNull().default(0),
  skills: text("skills").notNull().default("[]"),
  workPreference: text("work_preference").notNull().default("not_specified"),
  openToWork: integer("open_to_work", { mode: "boolean" }).notNull().default(false),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [
  index("smartcert_career_open_idx").on(table.openToWork),
  index("smartcert_career_industry_idx").on(table.industry),
  index("smartcert_career_stage_idx").on(table.stage),
]);

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  clerkSessionId: text("clerk_session_id"),
  expiresAt: integer("expires_at").notNull(),
  createdAt: integer("created_at").notNull(),
}, (table) => [
  index("smartcert_sessions_clerk_session_idx").on(table.clerkSessionId),
]);

export const passwordlessLoginCodes = sqliteTable("passwordless_login_codes", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  codeHash: text("code_hash").notNull(),
  expiresAt: integer("expires_at").notNull(),
  attempts: integer("attempts").notNull().default(0),
  usedAt: integer("used_at"),
  createdAt: integer("created_at").notNull(),
}, (table) => [index("smartcert_passwordless_email_idx").on(table.email), index("smartcert_passwordless_expires_idx").on(table.expiresAt)]);

export const passwordResetRequests = sqliteTable("password_reset_requests", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: integer("expires_at").notNull(),
  usedAt: integer("used_at"),
  createdAt: integer("created_at").notNull(),
});

export const referralCodes = sqliteTable("referral_codes", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  code: text("code").notNull().unique(),
  createdAt: integer("created_at").notNull(),
});

export const referrals = sqliteTable("referrals", {
  id: text("id").primaryKey(),
  referralCodeId: text("referral_code_id").notNull().references(() => referralCodes.id, { onDelete: "cascade" }),
  referredUserId: text("referred_user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("pending"),
  discountPercent: integer("discount_percent").notNull().default(15),
  firstPaymentId: text("first_payment_id").unique(),
  qualifiedAt: integer("qualified_at"),
  rewardedAt: integer("rewarded_at"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [index("smartcert_referrals_code_idx").on(table.referralCodeId), index("smartcert_referrals_status_idx").on(table.status)]);

export const referralMedia = sqliteTable("referral_media", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  objectKey: text("object_key").notNull().unique(),
  mimeType: text("mime_type").notNull(),
  name: text("name").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  createdAt: integer("created_at").notNull(),
}, (table) => [index("smartcert_referral_media_user_created_idx").on(table.userId, table.createdAt)]);

/**
 * R2 object metadata stays in D1 so ownership, scope, integrity and moderation
 * state remain auditable without exposing object contents or signed URLs.
 */
export const smartAiMediaAssets = sqliteTable("smartlingo_media_assets", {
  id: text("id").primaryKey(),
  ownerUserId: text("owner_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  scopeType: text("scope_type").notNull(),
  scopeId: text("scope_id").notNull(),
  objectKey: text("object_key").notNull().unique(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  sha256: text("sha256").notNull(),
  etag: text("etag"),
  visibility: text("visibility").notNull().default("private"),
  status: text("status").notNull().default("uploading"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
  deletedAt: integer("deleted_at"),
}, (table) => [
  check("smartlingo_media_kind_ck", sql`${table.kind} IN ('avatar', 'course_cover', 'courseware', 'assignment_attachment', 'chat_attachment', 'certificate_asset')`),
  check("smartlingo_media_scope_ck", sql`length(${table.scopeType}) > 0 AND length(${table.scopeId}) > 0`),
  check("smartlingo_media_size_ck", sql`${table.sizeBytes} >= 0`),
  check("smartlingo_media_visibility_ck", sql`${table.visibility} = 'private'`),
  check("smartlingo_media_status_ck", sql`${table.status} IN ('uploading', 'ready', 'quarantined', 'failed', 'tombstone')`),
  index("smartlingo_media_owner_status_idx").on(table.ownerUserId, table.status, table.createdAt),
  index("smartlingo_media_scope_status_idx").on(table.scopeType, table.scopeId, table.status),
  index("smartlingo_media_kind_status_idx").on(table.kind, table.status),
]);

export const subscriptions = sqliteTable("subscriptions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  paypalSubscriptionId: text("paypal_subscription_id").unique(),
  paypalPlanId: text("paypal_plan_id"),
  cadence: text("cadence").notNull(),
  status: text("status").notNull().default("pending"),
  trialEndsAt: integer("trial_ends_at"),
  currentPeriodEndsAt: integer("current_period_ends_at"),
  cancelAtPeriodEnd: integer("cancel_at_period_end", { mode: "boolean" }).notNull().default(false),
  referralId: text("referral_id").references(() => referrals.id, { onDelete: "set null" }),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [index("smartcert_subscriptions_status_idx").on(table.status)]);

export const rewardLedger = sqliteTable("reward_ledger", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  points: integer("points").notNull(),
  reason: text("reason").notNull(),
  reference: text("reference").notNull().unique(),
  createdAt: integer("created_at").notNull(),
}, (table) => [index("smartcert_reward_user_idx").on(table.userId)]);

export const liveVoiceUsage = sqliteTable("live_voice_usage", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  usageDate: text("usage_date").notNull(),
  usedSeconds: integer("used_seconds").notNull().default(0),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [index("smartcert_live_voice_user_date_idx").on(table.userId, table.usageDate)]);

/**
 * Rate-limit subjects are one-way hashes of a user, session or network
 * identity. No prompt, response, transcript or other raw content is stored.
 */
export const smartAiUsageWindows = sqliteTable("smartlingo_ai_usage_windows", {
  id: text("id").primaryKey(),
  feature: text("feature").notNull(),
  subjectHash: text("subject_hash").notNull(),
  windowStart: integer("window_start").notNull(),
  windowSeconds: integer("window_seconds").notNull().default(60),
  requestCount: integer("request_count").notNull().default(0),
  inputUnits: integer("input_units").notNull().default(0),
  outputUnits: integer("output_units").notNull().default(0),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [
  check("smartlingo_ai_window_time_ck", sql`${table.windowStart} >= 0 AND ${table.windowSeconds} > 0`),
  check("smartlingo_ai_window_usage_ck", sql`${table.requestCount} >= 0 AND ${table.inputUnits} >= 0 AND ${table.outputUnits} >= 0`),
  uniqueIndex("smartlingo_ai_window_feature_subject_uq").on(table.feature, table.subjectHash, table.windowStart),
  index("smartlingo_ai_window_subject_idx").on(table.subjectHash, table.windowStart),
]);

export const smartAiRequests = sqliteTable("smartlingo_ai_requests", {
  id: text("id").primaryKey(),
  usageWindowId: text("usage_window_id").notNull().references(() => smartAiUsageWindows.id, { onDelete: "restrict" }),
  feature: text("feature").notNull(),
  subjectHash: text("subject_hash").notNull(),
  model: text("model").notNull().default(""),
  status: text("status").notNull().default("started"),
  inputUnits: integer("input_units").notNull().default(0),
  outputUnits: integer("output_units").notNull().default(0),
  fallbackUsed: integer("fallback_used", { mode: "boolean" }).notNull().default(false),
  errorCode: text("error_code"),
  createdAt: integer("created_at").notNull(),
  completedAt: integer("completed_at"),
}, (table) => [
  check("smartlingo_ai_request_status_ck", sql`${table.status} IN ('started', 'succeeded', 'failed', 'fallback')`),
  check("smartlingo_ai_request_usage_ck", sql`${table.inputUnits} >= 0 AND ${table.outputUnits} >= 0`),
  index("smartlingo_ai_request_window_created_idx").on(table.usageWindowId, table.createdAt),
  index("smartlingo_ai_request_subject_feature_idx").on(table.subjectHash, table.feature, table.createdAt),
  index("smartlingo_ai_request_status_created_idx").on(table.status, table.createdAt),
]);

export const paymentWebhookEvents = sqliteTable("payment_webhook_events", {
  id: text("id").primaryKey(),
  eventType: text("event_type").notNull(),
  processedAt: integer("processed_at").notNull(),
});

export const notificationPreferences = sqliteTable("notification_preferences", {
  userId: text("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  language: text("language").notNull().default("en"),
  marketingEmail: integer("marketing_email", { mode: "boolean" }).notNull().default(false),
  productEmail: integer("product_email", { mode: "boolean" }).notNull().default(true),
  reminderEmail: integer("reminder_email", { mode: "boolean" }).notNull().default(true),
  updatedAt: integer("updated_at").notNull(),
});

export const communityTopics = sqliteTable("community_topics", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  category: text("category").notNull().default("general"),
  title: text("title").notNull(),
  body: text("body").notNull(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [index("smartcert_community_topic_updated_idx").on(table.updatedAt), index("smartcert_community_topic_category_idx").on(table.category)]);

export const communityReplies = sqliteTable("community_replies", {
  id: text("id").primaryKey(),
  topicId: text("topic_id").notNull().references(() => communityTopics.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  body: text("body").notNull(),
  createdAt: integer("created_at").notNull(),
}, (table) => [index("smartcert_community_reply_topic_idx").on(table.topicId), index("smartcert_community_reply_created_idx").on(table.createdAt)]);

export const editorialDocuments = sqliteTable("editorial_documents", {
  kind: text("kind").primaryKey(),
  editionDate: text("edition_date").notNull(),
  payload: text("payload").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const messageThreads = sqliteTable("message_threads", {
  id: text("id").primaryKey(),
  kind: text("kind").notNull().default("direct"),
  subject: text("subject").notNull().default(""),
  createdBy: text("created_by").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [index("smartcert_message_threads_updated_idx").on(table.updatedAt)]);

export const messageParticipants = sqliteTable("message_participants", {
  id: text("id").primaryKey(),
  threadId: text("thread_id").notNull().references(() => messageThreads.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  lastReadAt: integer("last_read_at").notNull().default(0),
  deletedAt: integer("deleted_at"),
}, (table) => [
  index("smartcert_message_participant_user_idx").on(table.userId),
  uniqueIndex("smartcert_message_participant_unique_idx").on(table.threadId, table.userId),
]);

export const messages = sqliteTable("messages", {
  id: text("id").primaryKey(),
  threadId: text("thread_id").notNull().references(() => messageThreads.id, { onDelete: "cascade" }),
  senderId: text("sender_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  body: text("body").notNull(),
  createdAt: integer("created_at").notNull(),
  deletedAt: integer("deleted_at"),
}, (table) => [index("smartcert_messages_thread_created_idx").on(table.threadId, table.createdAt)]);

export const userPresence = sqliteTable("user_presence", {
  userId: text("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  lastSeenAt: integer("last_seen_at").notNull(),
});

export const stageEnrollments = sqliteTable("stage_enrollments", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  stage: integer("stage").notNull(),
  trackId: text("track_id"),
  jurisdiction: text("jurisdiction"),
  countryCode: text("country_code"),
  regionCode: text("region_code"),
  scopeKey: text("scope_key").notNull().unique(),
  status: text("status").notNull().default("locked"),
  currentUnitId: text("current_unit_id"),
  startedAt: integer("started_at"),
  // Legacy nullable audit/compatibility field. New stage access always writes null and authorization must never read it.
  accessEndsAt: integer("access_ends_at"),
  passedAt: integer("passed_at"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [
  index("smartcert_stage_enrollment_user_stage_idx").on(table.userId, table.stage),
  index("smartcert_stage_enrollment_status_idx").on(table.status),
  index("smartcert_stage_enrollment_scope_idx").on(table.stage, table.trackId, table.jurisdiction),
  index("smartcert_stage_enrollment_location_idx").on(table.countryCode, table.regionCode),
  index("smartcert_stage_enrollment_access_ends_idx").on(table.accessEndsAt),
]);

export const stageEntitlements = sqliteTable("stage_entitlements", {
  id: text("id").primaryKey(),
  enrollmentId: text("enrollment_id").notNull().references(() => stageEnrollments.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  stage: integer("stage").notNull(),
  trackId: text("track_id"),
  jurisdiction: text("jurisdiction"),
  status: text("status").notNull().default("pending"),
  provider: text("provider").notNull(),
  providerReference: text("provider_reference").unique(),
  amountCents: integer("amount_cents").notNull(),
  currency: text("currency").notNull().default("USD"),
  accessStartsAt: integer("access_starts_at"),
  // Legacy nullable audit/compatibility field. New entitlements always write null and authorization must never read it.
  accessEndsAt: integer("access_ends_at"),
  paidAt: integer("paid_at"),
  disputedAt: integer("disputed_at"),
  refundedAt: integer("refunded_at"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [
  index("smartcert_stage_entitlement_enrollment_idx").on(table.enrollmentId),
  index("smartcert_stage_entitlement_user_stage_idx").on(table.userId, table.stage),
  index("smartcert_stage_entitlement_status_idx").on(table.status),
  index("smartcert_stage_entitlement_access_ends_idx").on(table.accessEndsAt),
]);

export const learningProgress = sqliteTable("learning_progress", {
  id: text("id").primaryKey(),
  enrollmentId: text("enrollment_id").notNull().references(() => stageEnrollments.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  activityId: text("activity_id").notNull(),
  contentVersion: text("content_version").notNull(),
  status: text("status").notNull().default("not_started"),
  bestScore: integer("best_score"),
  attemptCount: integer("attempt_count").notNull().default(0),
  masteryStreak: integer("mastery_streak").notNull().default(0),
  dueAt: integer("due_at"),
  completedAt: integer("completed_at"),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [
  uniqueIndex("smartcert_learning_progress_activity_uq").on(table.enrollmentId, table.activityId, table.contentVersion),
  index("smartcert_learning_progress_user_due_idx").on(table.userId, table.dueAt),
  index("smartcert_learning_progress_status_idx").on(table.status),
]);

export const activityAttempts = sqliteTable("activity_attempts", {
  id: text("id").primaryKey(),
  enrollmentId: text("enrollment_id").notNull().references(() => stageEnrollments.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  activityId: text("activity_id").notNull(),
  kind: text("kind").notNull(),
  contentVersion: text("content_version").notNull(),
  clientAttemptKey: text("client_attempt_key").notNull().unique(),
  startedAt: integer("started_at").notNull(),
  submittedAt: integer("submitted_at"),
  score: integer("score"),
  rubricVersion: text("rubric_version"),
  aiScoreProvisional: integer("ai_score_provisional", { mode: "boolean" }).notNull().default(false),
  feedback: text("feedback").notNull().default("{}"),
  evidenceRefs: text("evidence_refs").notNull().default("[]"),
  createdAt: integer("created_at").notNull(),
}, (table) => [
  index("smartcert_activity_attempt_user_activity_idx").on(table.userId, table.activityId),
  index("smartcert_activity_attempt_enrollment_submitted_idx").on(table.enrollmentId, table.submittedAt),
  index("smartcert_activity_attempt_kind_idx").on(table.kind),
]);

export const skillScores = sqliteTable("skill_scores", {
  id: text("id").primaryKey(),
  attemptId: text("attempt_id").notNull().references(() => activityAttempts.id, { onDelete: "cascade" }),
  skill: text("skill").notNull(),
  score: integer("score").notNull(),
  provisional: integer("provisional", { mode: "boolean" }).notNull().default(false),
  rubricVersion: text("rubric_version").notNull(),
  evidence: text("evidence").notNull().default("{}"),
  createdAt: integer("created_at").notNull(),
}, (table) => [
  uniqueIndex("smartcert_skill_score_attempt_skill_uq").on(table.attemptId, table.skill),
  index("smartcert_skill_score_skill_idx").on(table.skill),
]);

export const learningCredentials = sqliteTable("learning_credentials", {
  id: text("id").primaryKey(),
  enrollmentId: text("enrollment_id").notNull().references(() => stageEnrollments.id, { onDelete: "restrict" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  stage: integer("stage").notNull(),
  trackId: text("track_id"),
  jurisdiction: text("jurisdiction"),
  credentialKind: text("credential_kind").notNull(),
  verificationCode: text("verification_code").notNull().unique(),
  titleZh: text("title_zh").notNull(),
  titleEn: text("title_en").notNull(),
  totalScore: integer("total_score").notNull(),
  skillScores: text("skill_scores").notNull().default("{}"),
  issuedAt: integer("issued_at").notNull(),
  revokedAt: integer("revoked_at"),
  createdAt: integer("created_at").notNull(),
}, (table) => [
  index("smartcert_learning_credential_user_stage_idx").on(table.userId, table.stage),
  index("smartcert_learning_credential_track_idx").on(table.trackId),
  index("smartcert_learning_credential_issued_idx").on(table.issuedAt),
]);

export const credentialSources = sqliteTable("credential_sources", {
  id: text("id").primaryKey(),
  trackId: text("track_id").notNull(),
  jurisdiction: text("jurisdiction").notNull(),
  role: text("role").notNull(),
  issuer: text("issuer").notNull(),
  title: text("title").notNull(),
  officialUrl: text("official_url").notNull(),
  status: text("status").notNull().default("active"),
  lastVerifiedAt: integer("last_verified_at").notNull(),
  reviewDueAt: integer("review_due_at").notNull(),
  notes: text("notes").notNull().default(""),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [
  uniqueIndex("smartcert_credential_source_scope_issuer_uq").on(
    table.trackId,
    table.jurisdiction,
    table.role,
    table.issuer,
  ),
  index("smartcert_credential_source_review_due_idx").on(table.reviewDueAt),
  index("smartcert_credential_source_status_idx").on(table.status),
]);

export const learningCohorts = sqliteTable("learning_cohorts", {
  id: text("id").primaryKey(),
  cohortKey: text("cohort_key").notNull().unique(),
  stage: integer("stage").notNull(),
  trackId: text("track_id"),
  jurisdiction: text("jurisdiction"),
  status: text("status").notNull().default("active"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [
  uniqueIndex("smartcert_learning_cohort_scope_uq").on(
    table.stage,
    table.trackId,
    table.jurisdiction,
  ),
  index("smartcert_learning_cohort_status_idx").on(table.status),
]);

export const learningCohortMemberships = sqliteTable("learning_cohort_memberships", {
  id: text("id").primaryKey(),
  cohortId: text("cohort_id").notNull().references(() => learningCohorts.id, { onDelete: "cascade" }),
  enrollmentId: text("enrollment_id").notNull().references(() => stageEnrollments.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("active"),
  shareStage: integer("share_stage", { mode: "boolean" }).notNull().default(false),
  shareLocation: integer("share_location", { mode: "boolean" }).notNull().default(false),
  shareDaysInStage: integer("share_days_in_stage", { mode: "boolean" }).notNull().default(false),
  allowSameCohortMessages: integer("allow_same_cohort_messages", { mode: "boolean" }).notNull().default(false),
  joinedAt: integer("joined_at").notNull(),
  completedAt: integer("completed_at"),
  leftAt: integer("left_at"),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [
  uniqueIndex("smartcert_cohort_membership_enrollment_uq").on(table.enrollmentId),
  uniqueIndex("smartcert_cohort_membership_cohort_user_uq").on(table.cohortId, table.userId),
  index("smartcert_cohort_membership_user_status_idx").on(table.userId, table.status),
  index("smartcert_cohort_membership_cohort_status_idx").on(table.cohortId, table.status),
]);

export const cohortStatsSnapshots = sqliteTable("cohort_stats_snapshots", {
  id: text("id").primaryKey(),
  cohortId: text("cohort_id").notNull().references(() => learningCohorts.id, { onDelete: "cascade" }),
  minimumGroupSize: integer("minimum_group_size").notNull().default(5),
  suppressed: integer("suppressed", { mode: "boolean" }).notNull().default(true),
  learningCount: integer("learning_count"),
  passedCount: integer("passed_count"),
  totalCount: integer("total_count"),
  averagePassDaysTenths: integer("average_pass_days_tenths"),
  medianPassDaysTenths: integer("median_pass_days_tenths"),
  countryStats: text("country_stats").notNull().default("[]"),
  regionStats: text("region_stats").notNull().default("[]"),
  hasSuppressedLocationGroups: integer("has_suppressed_location_groups", { mode: "boolean" }).notNull().default(false),
  capturedAt: integer("captured_at").notNull(),
}, (table) => [
  uniqueIndex("smartcert_cohort_stats_capture_uq").on(table.cohortId, table.capturedAt),
  index("smartcert_cohort_stats_latest_idx").on(table.cohortId, table.capturedAt),
]);

export const cohortTopics = sqliteTable("cohort_topics", {
  id: text("id").primaryKey(),
  cohortId: text("cohort_id").notNull().references(() => learningCohorts.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  body: text("body").notNull(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
  deletedAt: integer("deleted_at"),
}, (table) => [
  index("smartcert_cohort_topic_cohort_updated_idx").on(table.cohortId, table.updatedAt),
  index("smartcert_cohort_topic_user_idx").on(table.userId),
]);

export const cohortReplies = sqliteTable("cohort_replies", {
  id: text("id").primaryKey(),
  topicId: text("topic_id").notNull().references(() => cohortTopics.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  body: text("body").notNull(),
  createdAt: integer("created_at").notNull(),
  deletedAt: integer("deleted_at"),
}, (table) => [
  index("smartcert_cohort_reply_topic_created_idx").on(table.topicId, table.createdAt),
  index("smartcert_cohort_reply_user_idx").on(table.userId),
]);

/**
 * SmartLingo member-led classes are intentionally isolated from the learning
 * cohort tables above. Cohorts describe a learner's certification stage;
 * classes describe who may publish, clone, invite and enroll learners.
 */
export const smartAiMemberships = sqliteTable("smartlingo_memberships", {
  userId: text("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  tier: text("tier").notNull().default("bronze"),
  status: text("status").notNull().default("active"),
  grantedBy: text("granted_by"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [
  check("smartlingo_membership_tier_ck", sql`${table.tier} IN ('bronze', 'silver', 'gold', 'platinum')`),
  check("smartlingo_membership_status_ck", sql`${table.status} IN ('active', 'paused', 'revoked')`),
  index("smartlingo_membership_tier_status_idx").on(table.tier, table.status),
]);

export const smartAiCourseTemplates = sqliteTable("smartlingo_course_templates", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  ownerUserId: text("owner_user_id").references(() => users.id, { onDelete: "set null" }),
  origin: text("origin").notNull().default("admin"),
  titleEn: text("title_en").notNull(),
  titleZh: text("title_zh").notNull(),
  summaryEn: text("summary_en").notNull().default(""),
  summaryZh: text("summary_zh").notNull().default(""),
  syllabus: text("syllabus").notNull().default("{}"),
  priceCents: integer("price_cents").notNull().default(0),
  currency: text("currency").notNull().default("USD"),
  approvalStatus: text("approval_status").notNull().default("draft"),
  claraStatus: text("clara_status").notNull().default("not_requested"),
  directoryStatus: text("directory_status").notNull().default("private"),
  approvedAt: integer("approved_at"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [
  check("smartlingo_template_origin_ck", sql`${table.origin} IN ('admin', 'member')`),
  check("smartlingo_template_approval_ck", sql`${table.approvalStatus} IN ('draft', 'owner_private', 'clara_pending', 'admin_pending', 'approved', 'rejected')`),
  check("smartlingo_template_clara_ck", sql`${table.claraStatus} IN ('not_requested', 'pending', 'passed', 'flagged')`),
  check("smartlingo_template_directory_ck", sql`${table.directoryStatus} IN ('private', 'review_pending', 'public', 'rejected')`),
  check("smartlingo_template_price_ck", sql`${table.priceCents} >= 0`),
  index("smartlingo_template_approval_directory_idx").on(table.approvalStatus, table.directoryStatus),
  index("smartlingo_template_owner_idx").on(table.ownerUserId),
]);

export const smartAiLicenseOrders = sqliteTable("smartlingo_license_orders", {
  id: text("id").primaryKey(),
  buyerUserId: text("buyer_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  templateId: text("template_id").references(() => smartAiCourseTemplates.id, { onDelete: "restrict" }),
  purpose: text("purpose").notNull().default("template_clone"),
  status: text("status").notNull().default("pending_admin"),
  licenseKeyHash: text("license_key_hash").unique(),
  seatsPurchased: integer("seats_purchased").notNull().default(1),
  seatsRemaining: integer("seats_remaining").notNull().default(1),
  amountCents: integer("amount_cents").notNull().default(0),
  currency: text("currency").notNull().default("USD"),
  requestedAt: integer("requested_at").notNull(),
  issuedAt: integer("issued_at"),
  expiresAt: integer("expires_at"),
  reviewDecision: text("review_decision"),
  reviewedBy: text("reviewed_by"),
  reviewedAt: integer("reviewed_at"),
  decisionNote: text("decision_note"),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [
  check("smartlingo_license_purpose_ck", sql`${table.purpose} IN ('template_clone', 'original_class', 'student_access')`),
  check("smartlingo_license_status_ck", sql`${table.status} IN ('pending_admin', 'issued', 'assigned', 'exhausted', 'expired', 'revoked')`),
  check("smartlingo_license_seats_ck", sql`${table.seatsPurchased} > 0 AND ${table.seatsRemaining} >= 0 AND ${table.seatsRemaining} <= ${table.seatsPurchased}`),
  index("smartlingo_license_buyer_status_idx").on(table.buyerUserId, table.status),
  index("smartlingo_license_template_idx").on(table.templateId),
]);

export const smartAiClasses = sqliteTable("smartlingo_classes", {
  id: text("id").primaryKey(),
  ownerUserId: text("owner_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  templateId: text("template_id").notNull().references(() => smartAiCourseTemplates.id, { onDelete: "restrict" }),
  licenseOrderId: text("license_order_id").notNull().references(() => smartAiLicenseOrders.id, { onDelete: "restrict" }),
  source: text("source").notNull(),
  title: text("title").notNull(),
  summary: text("summary").notNull().default(""),
  status: text("status").notNull().default("open"),
  visibility: text("visibility").notNull().default("private"),
  directoryReviewStatus: text("directory_review_status").notNull().default("not_requested"),
  priceCents: integer("price_cents").notNull().default(0),
  currency: text("currency").notNull().default("USD"),
  capacity: integer("capacity").notNull().default(30),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [
  check("smartlingo_class_source_ck", sql`${table.source} IN ('template_clone', 'original')`),
  check("smartlingo_class_status_ck", sql`${table.status} IN ('draft', 'open', 'closed', 'archived')`),
  check("smartlingo_class_visibility_ck", sql`${table.visibility} IN ('private', 'public')`),
  check("smartlingo_class_directory_review_ck", sql`${table.directoryReviewStatus} IN ('not_requested', 'clara_pending', 'admin_pending', 'approved', 'rejected')`),
  check("smartlingo_class_price_ck", sql`${table.priceCents} >= 0`),
  check("smartlingo_class_capacity_ck", sql`${table.capacity} > 0 AND ${table.capacity} <= 10000`),
  uniqueIndex("smartlingo_class_license_uq").on(table.licenseOrderId),
  index("smartlingo_class_owner_status_idx").on(table.ownerUserId, table.status),
  index("smartlingo_class_template_status_idx").on(table.templateId, table.status),
  index("smartlingo_class_directory_idx").on(table.visibility, table.directoryReviewStatus),
]);

export const smartAiClassPriceRequests = sqliteTable("smartlingo_class_price_requests", {
  id: text("id").primaryKey(),
  classId: text("class_id").notNull().references(() => smartAiClasses.id, { onDelete: "cascade" }),
  requestedByUserId: text("requested_by_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  currentPriceCents: integer("current_price_cents").notNull(),
  requestedPriceCents: integer("requested_price_cents").notNull(),
  status: text("status").notNull().default("pending_admin"),
  reviewedBy: text("reviewed_by"),
  requestedAt: integer("requested_at").notNull(),
  reviewedAt: integer("reviewed_at"),
}, (table) => [
  check("smartlingo_price_request_status_ck", sql`${table.status} IN ('pending_admin', 'approved', 'rejected', 'cancelled')`),
  check("smartlingo_price_request_amount_ck", sql`${table.currentPriceCents} >= 0 AND ${table.requestedPriceCents} >= 0`),
  index("smartlingo_price_request_class_status_idx").on(table.classId, table.status),
  index("smartlingo_price_request_requester_idx").on(table.requestedByUserId),
]);

export const smartAiClassInvites = sqliteTable("smartlingo_class_invites", {
  id: text("id").primaryKey(),
  classId: text("class_id").notNull().references(() => smartAiClasses.id, { onDelete: "cascade" }),
  referrerUserId: text("referrer_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  code: text("code").notNull().unique(),
  status: text("status").notNull().default("active"),
  createdAt: integer("created_at").notNull(),
  expiresAt: integer("expires_at"),
}, (table) => [
  check("smartlingo_class_invite_status_ck", sql`${table.status} IN ('active', 'disabled', 'expired')`),
  uniqueIndex("smartlingo_class_invite_referrer_uq").on(table.classId, table.referrerUserId),
  index("smartlingo_class_invite_class_status_idx").on(table.classId, table.status),
  index("smartlingo_class_invite_referrer_idx").on(table.referrerUserId),
]);

export const smartAiClassInviteVisits = sqliteTable("smartlingo_class_invite_visits", {
  id: text("id").primaryKey(),
  inviteId: text("invite_id").notNull().references(() => smartAiClassInvites.id, { onDelete: "cascade" }),
  visitedAt: integer("visited_at").notNull(),
  claimedByUserId: text("claimed_by_user_id").references(() => users.id, { onDelete: "set null" }),
  claimedAt: integer("claimed_at"),
}, (table) => [
  index("smartlingo_class_invite_visit_invite_idx").on(table.inviteId, table.visitedAt),
  index("smartlingo_class_invite_visit_claim_idx").on(table.claimedByUserId),
]);

export const smartAiClassReferralClaims = sqliteTable("smartlingo_class_referral_claims", {
  id: text("id").primaryKey(),
  inviteId: text("invite_id").notNull().references(() => smartAiClassInvites.id, { onDelete: "restrict" }),
  classId: text("class_id").notNull().references(() => smartAiClasses.id, { onDelete: "restrict" }),
  referrerUserId: text("referrer_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  referredUserId: text("referred_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  newVerifiedMember: integer("new_verified_member", { mode: "boolean" }).notNull().default(false),
  status: text("status").notNull().default("recorded"),
  createdAt: integer("created_at").notNull(),
}, (table) => [
  check("smartlingo_class_referral_status_ck", sql`${table.status} IN ('recorded', 'qualified', 'rewarded', 'void')`),
  uniqueIndex("smartlingo_class_referral_referred_uq").on(table.referredUserId),
  index("smartlingo_class_referral_referrer_idx").on(table.referrerUserId),
  index("smartlingo_class_referral_class_idx").on(table.classId),
]);

export const smartAiClassEnrollments = sqliteTable("smartlingo_class_enrollments", {
  id: text("id").primaryKey(),
  classId: text("class_id").notNull().references(() => smartAiClasses.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  directReferrerUserId: text("direct_referrer_user_id").references(() => users.id, { onDelete: "set null" }),
  referralClaimId: text("referral_claim_id").references(() => smartAiClassReferralClaims.id, { onDelete: "set null" }),
  phase: integer("phase").notNull().default(1),
  status: text("status").notNull().default("active"),
  enrolledAt: integer("enrolled_at").notNull(),
  completedAt: integer("completed_at"),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [
  check("smartlingo_class_enrollment_phase_ck", sql`${table.phase} >= 1`),
  check("smartlingo_class_enrollment_status_ck", sql`${table.status} IN ('active', 'paused', 'completed', 'withdrawn')`),
  uniqueIndex("smartlingo_class_enrollment_user_uq").on(table.classId, table.userId),
  index("smartlingo_class_enrollment_user_status_idx").on(table.userId, table.status),
  index("smartlingo_class_enrollment_class_status_idx").on(table.classId, table.status),
]);

export const smartAiClassAccessGrants = sqliteTable("smartlingo_class_access_grants", {
  id: text("id").primaryKey(),
  enrollmentId: text("enrollment_id").notNull().unique().references(() => smartAiClassEnrollments.id, { onDelete: "cascade" }),
  method: text("method").notNull(),
  inviteId: text("invite_id").references(() => smartAiClassInvites.id, { onDelete: "restrict" }),
  licenseOrderId: text("license_order_id").references(() => smartAiLicenseOrders.id, { onDelete: "restrict" }),
  status: text("status").notNull().default("mvp_recorded"),
  amountCents: integer("amount_cents").notNull().default(0),
  discountPercent: integer("discount_percent").notNull().default(0),
  createdAt: integer("created_at").notNull(),
}, (table) => [
  check("smartlingo_class_access_method_ck", sql`${table.method} IN ('referral', 'license_key')`),
  check("smartlingo_class_access_exclusive_ck", sql`(
    (${table.method} = 'referral' AND ${table.inviteId} IS NOT NULL AND ${table.licenseOrderId} IS NULL)
    OR
    (${table.method} = 'license_key' AND ${table.inviteId} IS NULL AND ${table.licenseOrderId} IS NOT NULL)
  )`),
  check("smartlingo_class_access_status_ck", sql`${table.status} IN ('mvp_recorded', 'confirmed', 'void')`),
  check("smartlingo_class_access_amount_ck", sql`${table.amountCents} >= 0 AND ${table.discountPercent} BETWEEN 0 AND 100`),
  index("smartlingo_class_access_method_idx").on(table.method),
]);

export const smartAiBaccLedger = sqliteTable("smartlingo_bacc_ledger", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  amount: integer("amount").notNull(),
  reason: text("reason").notNull(),
  reference: text("reference").notNull().unique(),
  createdAt: integer("created_at").notNull(),
}, (table) => [
  check("smartlingo_bacc_amount_ck", sql`${table.amount} <> 0`),
  index("smartlingo_bacc_user_created_idx").on(table.userId, table.createdAt),
]);

/**
 * Every SmartLingo Admin mutation is reserved by an idempotency key before
 * the business record changes. The stored response intentionally excludes
 * one-time license-key plaintext; only its hash is persisted on the order.
 */
export const smartAiAdminAudit = sqliteTable("smartlingo_admin_audit", {
  id: text("id").primaryKey(),
  idempotencyKey: text("idempotency_key").notNull().unique(),
  actorUserId: text("actor_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  actorEmail: text("actor_email").notNull(),
  action: text("action").notNull(),
  targetType: text("target_type").notNull(),
  targetId: text("target_id").notNull(),
  requestHash: text("request_hash").notNull(),
  operationToken: text("operation_token").notNull(),
  status: text("status").notNull().default("in_progress"),
  responseJson: text("response_json").notNull().default("{}"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
  completedAt: integer("completed_at"),
}, (table) => [
  check("smartlingo_admin_audit_status_ck", sql`${table.status} IN ('in_progress', 'completed', 'failed')`),
  index("smartlingo_admin_audit_actor_created_idx").on(table.actorUserId, table.createdAt),
  index("smartlingo_admin_audit_target_created_idx").on(table.targetType, table.targetId, table.createdAt),
]);

/**
 * SmartLingo language marketplace foundation.
 * Platform subscriptions and member-created class commerce are intentionally
 * separate: only paid platform subscription invoices can create introducer
 * reward points.
 */
export const lingoLanguagePaths = sqliteTable("smartlingo_language_paths", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  targetLanguage: text("target_language").notNull(),
  level: text("level").notNull(),
  titleEn: text("title_en").notNull(),
  titleZh: text("title_zh").notNull(),
  status: text("status").notNull().default("published"),
  version: text("version").notNull(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [
  check("smartlingo_language_path_status_ck", sql`${table.status} IN ('draft', 'review', 'published', 'archived')`),
  index("smartlingo_language_path_language_level_idx").on(table.targetLanguage, table.level),
]);

export const lingoConnectedAccounts = sqliteTable("smartlingo_connected_accounts", {
  userId: text("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  provider: text("provider").notNull().default("stripe_connect"),
  providerAccountId: text("provider_account_id").unique(),
  onboardingStatus: text("onboarding_status").notNull().default("not_started"),
  chargesEnabled: integer("charges_enabled", { mode: "boolean" }).notNull().default(false),
  payoutsEnabled: integer("payouts_enabled", { mode: "boolean" }).notNull().default(false),
  requirementsDue: text("requirements_due").notNull().default("[]"),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [
  check("smartlingo_connected_account_provider_ck", sql`${table.provider} = 'stripe_connect'`),
  check("smartlingo_connected_account_status_ck", sql`${table.onboardingStatus} IN ('not_started', 'pending', 'restricted', 'ready', 'disabled')`),
  index("smartlingo_connected_account_status_idx").on(table.onboardingStatus),
]);

export const lingoClasses = sqliteTable("smartlingo_language_classes", {
  id: text("id").primaryKey(),
  ownerUserId: text("owner_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  pathId: text("path_id").notNull().references(() => lingoLanguagePaths.id, { onDelete: "restrict" }),
  ownerRole: text("owner_role").notNull().default("coordinator"),
  title: text("title").notNull(),
  summary: text("summary").notNull().default(""),
  targetLanguage: text("target_language").notNull(),
  level: text("level").notNull(),
  schedule: text("schedule").notNull().default("Self-paced"),
  status: text("status").notNull().default("open"),
  visibility: text("visibility").notNull().default("private"),
  priceCents: integer("price_cents").notNull().default(0),
  currency: text("currency").notNull().default("USD"),
  capacity: integer("capacity").notNull().default(30),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [
  check("smartlingo_language_class_role_ck", sql`${table.ownerRole} IN ('teacher', 'coordinator')`),
  check("smartlingo_language_class_status_ck", sql`${table.status} IN ('draft', 'open', 'closed', 'archived')`),
  check("smartlingo_language_class_visibility_ck", sql`${table.visibility} IN ('private', 'review', 'public')`),
  check("smartlingo_language_class_price_ck", sql`${table.priceCents} >= 0`),
  check("smartlingo_language_class_capacity_ck", sql`${table.capacity} > 0 AND ${table.capacity} <= 1000`),
  index("smartlingo_language_class_owner_status_idx").on(table.ownerUserId, table.status),
  index("smartlingo_language_class_directory_idx").on(table.visibility, table.status),
]);

export const lingoClassMembers = sqliteTable("smartlingo_language_class_members", {
  id: text("id").primaryKey(),
  classId: text("class_id").notNull().references(() => lingoClasses.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: text("role").notNull().default("student"),
  status: text("status").notNull().default("active"),
  joinedAt: integer("joined_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [
  uniqueIndex("smartlingo_language_class_member_uq").on(table.classId, table.userId),
  check("smartlingo_language_class_member_role_ck", sql`${table.role} IN ('owner', 'teacher', 'coordinator', 'student')`),
  check("smartlingo_language_class_member_status_ck", sql`${table.status} IN ('invited', 'active', 'paused', 'left', 'removed')`),
  index("smartlingo_language_class_member_user_idx").on(table.userId, table.status),
]);

export const lingoClassInvites = sqliteTable("smartlingo_language_class_invites", {
  id: text("id").primaryKey(),
  classId: text("class_id").notNull().references(() => lingoClasses.id, { onDelete: "cascade" }),
  createdByUserId: text("created_by_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  codeHash: text("code_hash").notNull().unique(),
  status: text("status").notNull().default("active"),
  expiresAt: integer("expires_at"),
  createdAt: integer("created_at").notNull(),
}, (table) => [
  check("smartlingo_language_class_invite_status_ck", sql`${table.status} IN ('active', 'disabled', 'expired')`),
  index("smartlingo_language_class_invite_class_idx").on(table.classId, table.status),
]);

export const lingoClassOrders = sqliteTable("smartlingo_language_class_orders", {
  id: text("id").primaryKey(),
  classId: text("class_id").notNull().references(() => lingoClasses.id, { onDelete: "restrict" }),
  learnerUserId: text("learner_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  ownerUserId: text("owner_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  provider: text("provider").notNull().default("stripe_connect"),
  providerCheckoutId: text("provider_checkout_id").unique(),
  providerPaymentId: text("provider_payment_id").unique(),
  subtotalCents: integer("subtotal_cents").notNull(),
  discountBasisPoints: integer("discount_basis_points").notNull().default(0),
  discountedPreTaxCents: integer("discounted_pre_tax_cents").notNull(),
  taxCents: integer("tax_cents").notNull().default(0),
  ownerShareCents: integer("owner_share_cents").notNull(),
  platformFeeCents: integer("platform_fee_cents").notNull(),
  currency: text("currency").notNull().default("USD"),
  firstClassPayment: integer("first_class_payment", { mode: "boolean" }).notNull().default(false),
  status: text("status").notNull().default("pending"),
  webhookEventId: text("webhook_event_id").unique(),
  paidAt: integer("paid_at"),
  refundedAt: integer("refunded_at"),
  disputedAt: integer("disputed_at"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [
  check("smartlingo_language_class_order_provider_ck", sql`${table.provider} = 'stripe_connect'`),
  check("smartlingo_language_class_order_discount_ck", sql`${table.discountBasisPoints} IN (0, 1500)`),
  check("smartlingo_language_class_order_split_ck", sql`${table.ownerShareCents} + ${table.platformFeeCents} = ${table.discountedPreTaxCents}`),
  check("smartlingo_language_class_order_amount_ck", sql`${table.subtotalCents} >= 0 AND ${table.discountedPreTaxCents} >= 0 AND ${table.taxCents} >= 0`),
  check("smartlingo_language_class_order_status_ck", sql`${table.status} IN ('pending', 'paid', 'refunded', 'partially_refunded', 'disputed', 'failed', 'cancelled')`),
  index("smartlingo_language_class_order_learner_class_idx").on(table.learnerUserId, table.classId, table.status),
  index("smartlingo_language_class_order_owner_idx").on(table.ownerUserId, table.status, table.createdAt),
]);

export const lingoPlatformSubscriptionPayments = sqliteTable("smartlingo_platform_subscription_payments", {
  id: text("id").primaryKey(),
  providerInvoiceId: text("provider_invoice_id").notNull().unique(),
  subscriberUserId: text("subscriber_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  introducerUserId: text("introducer_user_id").references(() => users.id, { onDelete: "set null" }),
  amountCents: integer("amount_cents").notNull(),
  currency: text("currency").notNull().default("USD"),
  status: text("status").notNull().default("paid"),
  paidAt: integer("paid_at").notNull(),
  refundedAt: integer("refunded_at"),
  createdAt: integer("created_at").notNull(),
}, (table) => [
  check("smartlingo_platform_subscription_payment_status_ck", sql`${table.status} IN ('paid', 'refunded', 'disputed', 'void')`),
  check("smartlingo_platform_subscription_payment_amount_ck", sql`${table.amountCents} >= 0`),
  index("smartlingo_platform_subscription_subscriber_idx").on(table.subscriberUserId, table.paidAt),
  index("smartlingo_platform_subscription_introducer_idx").on(table.introducerUserId, table.paidAt),
]);

export const lingoIntroducerRewardLedger = sqliteTable("smartlingo_introducer_reward_ledger", {
  id: text("id").primaryKey(),
  introducerUserId: text("introducer_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  subscriptionPaymentId: text("subscription_payment_id").notNull().unique().references(() => lingoPlatformSubscriptionPayments.id, { onDelete: "restrict" }),
  points: integer("points").notNull(),
  status: text("status").notNull().default("earned"),
  createdAt: integer("created_at").notNull(),
  reversedAt: integer("reversed_at"),
}, (table) => [
  check("smartlingo_introducer_reward_points_ck", sql`${table.points} > 0`),
  check("smartlingo_introducer_reward_status_ck", sql`${table.status} IN ('earned', 'reversed')`),
  index("smartlingo_introducer_reward_user_idx").on(table.introducerUserId, table.createdAt),
]);
