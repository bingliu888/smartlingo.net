import { sql } from "drizzle-orm";
import { type AnySQLiteColumn, check, index, integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  clerkUserId: text("clerk_user_id").unique(),
  displayName: text("display_name").notNull(),
  passwordHash: text("password_hash").notNull(),
  preferredLanguage: text("preferred_language").notNull().default("en"),
  aiProviderPreference: text("ai_provider_preference").notNull().default("auto"),
  role: text("role").notNull().default("member"),
  walletAddress: text("wallet_address"),
  createdAt: integer("created_at").notNull(),
}, (table) => [
  check("smartlingo_user_role_ck", sql`${table.role} IN ('member', 'admin')`),
  check("smartlingo_user_ai_provider_ck", sql`${table.aiProviderPreference} IN ('auto', 'openai', 'deepseek')`),
  index("smartlingo_users_role_created_idx").on(table.role, table.createdAt),
]);

// Unified, site-local member lifecycle. Authentication remains in Clerk.
export const platformMemberAccess = sqliteTable("platform_member_access", {
  userId: text("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("active"),
  // -1 explicitly revokes subscriber access, 0 follows billing, 1 grants it.
  subscriberOverride: integer("subscriber_override").notNull().default(0),
  updatedByUserId: text("updated_by_user_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [index("platform_member_access_status_idx").on(table.status, table.updatedAt)]);
export const platformAdminAudit = sqliteTable("platform_admin_audit", { id:text("id").primaryKey(),adminUserId:text("admin_user_id").references(()=>users.id,{onDelete:"set null"}),targetUserId:text("target_user_id").references(()=>users.id,{onDelete:"set null"}),action:text("action").notNull(),createdAt:integer("created_at").notNull() },table=>[index("platform_admin_audit_target_idx").on(table.targetUserId,table.createdAt)]);

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
  check("smartlingo_media_kind_ck", sql`${table.kind} IN ('avatar', 'voice_practice', 'course_cover', 'courseware', 'assignment_attachment', 'chat_attachment', 'certificate_asset')`),
  check("smartlingo_media_scope_ck", sql`(
    (${table.kind} IN ('avatar', 'voice_practice', 'certificate_asset') AND ${table.scopeType} = 'user' AND ${table.scopeId} = ${table.ownerUserId})
    OR (${table.kind} IN ('course_cover', 'courseware', 'assignment_attachment') AND ${table.scopeType} = 'language_class')
    OR (${table.kind} = 'chat_attachment' AND ${table.scopeType} = 'message_thread')
  )`),
  check("smartlingo_media_size_ck", sql`${table.sizeBytes} > 0`),
  check("smartlingo_media_sha256_ck", sql`length(${table.sha256}) = 64 AND ${table.sha256} NOT GLOB '*[^0-9a-f]*'`),
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
  stripeSubscriptionId: text("stripe_subscription_id").unique(),
  stripeCustomerId: text("stripe_customer_id"),
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

// A scheduled community meeting owns one durable group-chat thread. The partial
// unique index is the server-side guarantee that a host has at most one meeting
// that has not been cancelled or ended.
export const communityMeetings = sqliteTable("community_meetings", {
  id: text("id").primaryKey(),
  ownerUserId: text("owner_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  threadId: text("thread_id").notNull().unique().references(() => messageThreads.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  scheduledAt: integer("scheduled_at").notNull(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
  endedAt: integer("ended_at"),
}, (table) => [
  check("smartlingo_community_meeting_title_ck", sql`length(trim(${table.title})) BETWEEN 3 AND 80`),
  uniqueIndex("smartlingo_community_meeting_active_owner_uq").on(table.ownerUserId).where(sql`${table.endedAt} IS NULL`),
  index("smartlingo_community_meeting_schedule_idx").on(table.endedAt, table.scheduledAt),
]);

export const messages = sqliteTable("messages", {
  id: text("id").primaryKey(),
  threadId: text("thread_id").notNull().references(() => messageThreads.id, { onDelete: "cascade" }),
  senderId: text("sender_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  body: text("body").notNull(),
  createdAt: integer("created_at").notNull(),
  deletedAt: integer("deleted_at"),
}, (table) => [index("smartcert_messages_thread_created_idx").on(table.threadId, table.createdAt)]);

export const messageCalls = sqliteTable("message_calls", {
  id: text("id").primaryKey(),
  threadId: text("thread_id").notNull().references(() => messageThreads.id, { onDelete: "cascade" }),
  providerMeetingId: text("provider_meeting_id").notNull().unique(),
  startedBy: text("started_by").notNull().references(() => users.id, { onDelete: "cascade" }),
  mode: text("mode").notNull(),
  status: text("status").notNull().default("active"),
  createdAt: integer("created_at").notNull(),
  expiresAt: integer("expires_at").notNull(),
  endedAt: integer("ended_at"),
  soloSinceAt: integer("solo_since_at"),
  lastAudioAt: integer("last_audio_at"),
}, (table) => [
  check("smartlingo_message_call_mode_ck", sql`${table.mode} IN ('audio', 'video')`),
  check("smartlingo_message_call_status_ck", sql`${table.status} IN ('active', 'ended', 'expired')`),
  uniqueIndex("smartlingo_message_call_active_thread_uq").on(table.threadId).where(sql`${table.status} = 'active'`),
  index("smartlingo_message_call_expiry_idx").on(table.status, table.expiresAt),
]);

export const messageCallParticipants = sqliteTable("message_call_participants", {
  id: text("id").primaryKey(),
  callId: text("call_id").notNull().references(() => messageCalls.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  providerParticipantId: text("provider_participant_id").notNull(),
  joinedAt: integer("joined_at").notNull(),
  lastSeenAt: integer("last_seen_at"),
  microphoneOn: integer("microphone_on", { mode: "boolean" }).notNull().default(true),
  cameraOn: integer("camera_on", { mode: "boolean" }).notNull().default(false),
  leftAt: integer("left_at"),
}, (table) => [
  uniqueIndex("smartlingo_message_call_participant_uq").on(table.callId, table.userId),
  index("smartlingo_message_call_participant_user_idx").on(table.userId, table.joinedAt),
]);

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
 * SmartLingo language course foundation. MVP courses are platform-authored,
 * use fixed monthly prices, and include a server-authoritative free first month.
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

/**
 * A row is one immutable, versioned SmartLingo-authored exercise. Publishing a
 * revision creates a new version instead of rewriting evidence referenced by
 * learner progress.
 */
export const lingoExercises = sqliteTable("smartlingo_exercises", {
  id: text("id").primaryKey(),
  pathId: text("path_id").notNull().references(() => lingoLanguagePaths.id, { onDelete: "restrict" }),
  stableKey: text("stable_key").notNull(),
  version: text("version").notNull(),
  skill: text("skill").notNull(),
  titleZh: text("title_zh").notNull(),
  titleEn: text("title_en").notNull(),
  instructionZh: text("instruction_zh").notNull(),
  instructionEn: text("instruction_en").notNull(),
  targetContent: text("target_content").notNull(),
  answerContent: text("answer_content").notNull().default("{}"),
  sourceType: text("source_type").notNull().default("smartlingo_original"),
  reviewStatus: text("review_status").notNull().default("draft"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [
  check("smartlingo_exercise_identity_ck", sql`length(trim(${table.stableKey})) > 0 AND length(trim(${table.version})) > 0`),
  check("smartlingo_exercise_skill_ck", sql`${table.skill} IN ('listening', 'speaking', 'reading', 'writing', 'vocabulary', 'review')`),
  check("smartlingo_exercise_bilingual_ck", sql`length(trim(${table.titleZh})) > 0 AND length(trim(${table.titleEn})) > 0 AND length(trim(${table.instructionZh})) > 0 AND length(trim(${table.instructionEn})) > 0`),
  check("smartlingo_exercise_content_ck", sql`length(trim(${table.targetContent})) > 0 AND length(trim(${table.answerContent})) > 0`),
  check("smartlingo_exercise_source_ck", sql`${table.sourceType} = 'smartlingo_original'`),
  check("smartlingo_exercise_review_ck", sql`${table.reviewStatus} IN ('draft', 'review', 'approved', 'retired')`),
  uniqueIndex("smartlingo_exercise_path_key_version_uq").on(table.pathId, table.stableKey, table.version),
  index("smartlingo_exercise_path_review_skill_idx").on(table.pathId, table.reviewStatus, table.skill),
]);

/**
 * Server-authoritative progress links one member and one language path to the
 * exact immutable exercise version that produced the recorded evidence.
 */
export const lingoLearningProgress = sqliteTable("smartlingo_language_progress", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  pathId: text("path_id").notNull().references(() => lingoLanguagePaths.id, { onDelete: "restrict" }),
  exerciseId: text("exercise_id").notNull().references(() => lingoExercises.id, { onDelete: "restrict" }),
  exerciseVersion: text("exercise_version").notNull(),
  status: text("status").notNull().default("not_started"),
  bestScore: integer("best_score"),
  attemptCount: integer("attempt_count").notNull().default(0),
  dueAt: integer("due_at"),
  startedAt: integer("started_at"),
  completedAt: integer("completed_at"),
  lastAttemptAt: integer("last_attempt_at"),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [
  check("smartlingo_language_progress_status_ck", sql`${table.status} IN ('not_started', 'in_progress', 'completed', 'needs_review')`),
  check("smartlingo_language_progress_score_ck", sql`${table.bestScore} IS NULL OR ${table.bestScore} BETWEEN 0 AND 100`),
  check("smartlingo_language_progress_attempt_ck", sql`${table.attemptCount} >= 0`),
  uniqueIndex("smartlingo_language_progress_user_exercise_uq").on(table.userId, table.exerciseId),
  index("smartlingo_language_progress_user_path_status_idx").on(table.userId, table.pathId, table.status),
  index("smartlingo_language_progress_user_due_idx").on(table.userId, table.dueAt),
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
  classKind: text("class_kind").notNull().default("official_course"),
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
  packageTier: text("package_tier"),
  billingInterval: text("billing_interval").notNull().default("month"),
  trialDays: integer("trial_days").notNull().default(30),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [
  check("smartlingo_language_class_kind_ck", sql`${table.classKind} IN ('official_language', 'official_course', 'member_language', 'subject')`),
  check("smartlingo_language_class_package_ck", sql`${table.packageTier} IS NULL OR ${table.packageTier} IN ('basic', 'intermediate', 'advanced')`),
  check("smartlingo_language_class_billing_ck", sql`${table.billingInterval} = 'month' AND ${table.trialDays} BETWEEN 0 AND 365`),
  check("smartlingo_language_class_role_ck", sql`${table.ownerRole} IN ('teacher', 'coordinator')`),
  check("smartlingo_language_class_status_ck", sql`${table.status} IN ('draft', 'open', 'closed', 'archived')`),
  check("smartlingo_language_class_visibility_ck", sql`${table.visibility} IN ('private', 'review', 'public')`),
  check("smartlingo_language_class_price_ck", sql`${table.priceCents} >= 0`),
  check("smartlingo_language_class_capacity_ck", sql`${table.capacity} > 0 AND ${table.capacity} <= 1000`),
  index("smartlingo_language_class_owner_status_idx").on(table.ownerUserId, table.status),
  index("smartlingo_language_class_directory_idx").on(table.visibility, table.status),
  index("smartlingo_language_class_kind_path_idx").on(table.classKind, table.pathId, table.status),
]);

export const lingoCourseSubscriptions = sqliteTable("smartlingo_course_subscriptions", {
  id: text("id").primaryKey(),
  classId: text("class_id").references(() => lingoClasses.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("trialing"),
  monthlyPriceCents: integer("monthly_price_cents").notNull(),
  trialStartedAt: integer("trial_started_at").notNull(),
  trialEndsAt: integer("trial_ends_at").notNull(),
  currentPeriodEndsAt: integer("current_period_ends_at"),
  providerSubscriptionId: text("provider_subscription_id").unique(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [
  uniqueIndex("smartlingo_course_subscription_class_user_uq").on(table.classId, table.userId),
  check("smartlingo_course_subscription_status_ck", sql`${table.status} IN ('trialing', 'active', 'past_due', 'cancelled', 'expired')`),
  check("smartlingo_course_subscription_price_ck", sql`${table.monthlyPriceCents} > 0`),
  index("smartlingo_course_subscription_user_status_idx").on(table.userId, table.status),
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
  check("smartlingo_language_class_order_first_flag_ck", sql`${table.firstClassPayment} IN (0, 1)`),
  check("smartlingo_language_class_order_first_discount_ck", sql`(
    (${table.firstClassPayment} = 1 AND ${table.discountBasisPoints} = 1500)
    OR (${table.firstClassPayment} = 0 AND ${table.discountBasisPoints} = 0)
  )`),
  check("smartlingo_language_class_order_discount_math_ck", sql`${table.discountedPreTaxCents} = ${table.subtotalCents} - ((${table.subtotalCents} * ${table.discountBasisPoints}) / 10000)`),
  check("smartlingo_language_class_order_owner_share_ck", sql`${table.ownerShareCents} = ((${table.discountedPreTaxCents} * 7000) / 10000)`),
  check("smartlingo_language_class_order_platform_share_ck", sql`${table.platformFeeCents} = ${table.discountedPreTaxCents} - ${table.ownerShareCents}`),
  check("smartlingo_language_class_order_split_ck", sql`${table.ownerShareCents} + ${table.platformFeeCents} = ${table.discountedPreTaxCents}`),
  check("smartlingo_language_class_order_amount_ck", sql`${table.subtotalCents} >= 0 AND ${table.discountedPreTaxCents} >= 0 AND ${table.taxCents} >= 0 AND ${table.ownerShareCents} >= 0 AND ${table.platformFeeCents} >= 0`),
  check("smartlingo_language_class_order_paid_at_ck", sql`(
    (${table.status} IN ('paid', 'refunded', 'partially_refunded', 'disputed') AND ${table.paidAt} IS NOT NULL)
    OR (${table.status} IN ('pending', 'failed', 'cancelled') AND ${table.paidAt} IS NULL)
  )`),
  check("smartlingo_language_class_order_status_ck", sql`${table.status} IN ('pending', 'paid', 'refunded', 'partially_refunded', 'disputed', 'failed', 'cancelled')`),
  uniqueIndex("smartlingo_language_class_order_first_paid_uq")
    .on(table.learnerUserId, table.classId)
    .where(sql`${table.firstClassPayment} = 1 AND ${table.paidAt} IS NOT NULL`),
  index("smartlingo_language_class_order_learner_class_idx").on(table.learnerUserId, table.classId, table.status),
  index("smartlingo_language_class_order_owner_idx").on(table.ownerUserId, table.status, table.createdAt),
]);

export const lingoPlatformSubscriptionPayments = sqliteTable("smartlingo_platform_subscription_payments", {
  id: text("id").primaryKey(),
  providerInvoiceId: text("provider_invoice_id").notNull().unique(),
  subscriberUserId: text("subscriber_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  introducerUserId: text("introducer_user_id").references(() => users.id, { onDelete: "set null" }),
  directReferralId: text("direct_referral_id").references(() => referrals.id, { onDelete: "restrict" }),
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
  index("smartlingo_platform_subscription_direct_referral_idx").on(table.directReferralId, table.paidAt),
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

/** Published curriculum targets are product goals aligned to CEFR descriptors;
 * they are not official CEFR word-count requirements or certifications. */
export const lingoCurriculumLevels = sqliteTable("smartlingo_curriculum_levels", {
  level: text("level").primaryKey(),
  cefrBand: text("cefr_band").notNull(),
  cumulativeItemTarget: integer("cumulative_item_target").notNull(),
  productiveItemTarget: integer("productive_item_target").notNull(),
  goalEn: text("goal_en").notNull(),
  goalZh: text("goal_zh").notNull(),
  methodologyVersion: text("methodology_version").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [
  check("smartlingo_curriculum_level_ck", sql`${table.level} IN ('beginner','intermediate','advanced')`),
  check("smartlingo_curriculum_target_ck", sql`${table.cumulativeItemTarget} > 0 AND ${table.productiveItemTarget} BETWEEN 1 AND ${table.cumulativeItemTarget}`),
]);

/** One row represents a learnable sense, phrase, formula or word. Versions are
 * immutable once published so cards and challenge evidence remain auditable. */
export const lingoVocabularyItems = sqliteTable("smartlingo_vocabulary_items", {
  id: text("id").primaryKey(),
  stableKey: text("stable_key").notNull(),
  version: text("version").notNull(),
  targetLanguage: text("target_language").notNull(),
  level: text("level").notNull(),
  cefrBand: text("cefr_band").notNull(),
  difficulty: integer("difficulty").notNull(),
  frequencyDegree: integer("frequency_degree").notNull().default(1),
  gradeLevel: integer("grade_level").notNull().default(0),
  sceneKey: text("scene_key").notNull(),
  sequence: integer("sequence").notNull(),
  form: text("form").notNull(),
  pronunciation: text("pronunciation").notNull().default(""),
  targetPhonetic: text("target_phonetic").notNull().default(""),
  pronunciationEn: text("pronunciation_en").notNull().default(""),
  pronunciationZh: text("pronunciation_zh").notNull().default(""),
  meaningEn: text("meaning_en").notNull(),
  meaningZh: text("meaning_zh").notNull(),
  itemKind: text("item_kind").notNull(),
  productive: integer("productive", { mode: "boolean" }).notNull().default(true),
  sourceType: text("source_type").notNull().default("smartlingo_original"),
  reviewStatus: text("review_status").notNull(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [
  uniqueIndex("smartlingo_vocabulary_identity_uq").on(table.targetLanguage, table.stableKey, table.version),
  index("smartlingo_vocabulary_catalog_idx").on(table.targetLanguage, table.level, table.reviewStatus, table.sceneKey, table.sequence),
  check("smartlingo_vocabulary_frequency_degree_ck", sql`${table.frequencyDegree} BETWEEN 1 AND 10`),
  check("smartlingo_vocabulary_grade_level_ck", sql`${table.gradeLevel} BETWEEN 0 AND 12`),
]);

export const lingoSmartcardDecks = sqliteTable("smartlingo_smartcard_decks", {
  id: text("id").primaryKey(),
  ownerUserId: text("owner_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  classId: text("class_id").notNull().references(() => lingoClasses.id, { onDelete: "cascade" }),
  targetLanguage: text("target_language").notNull(),
  level: text("level").notNull(),
  title: text("title").notNull(),
  version: integer("version").notNull().default(1),
  visibility: text("visibility").notNull().default("public"),
  shareToken: text("share_token").notNull().unique(),
  status: text("status").notNull().default("active"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [
  index("smartlingo_smartcard_deck_owner_idx").on(table.ownerUserId, table.updatedAt),
  index("smartlingo_smartcard_deck_public_idx").on(table.visibility, table.status, table.updatedAt),
]);

export const lingoSmartcardItems = sqliteTable("smartlingo_smartcard_items", {
  deckId: text("deck_id").notNull().references(() => lingoSmartcardDecks.id, { onDelete: "cascade" }),
  vocabularyItemId: text("vocabulary_item_id").notNull().references(() => lingoVocabularyItems.id, { onDelete: "restrict" }),
  position: integer("position").notNull(),
}, (table) => [
  primaryKey({ columns: [table.deckId, table.vocabularyItemId] }),
  uniqueIndex("smartlingo_smartcard_position_uq").on(table.deckId, table.position),
]);

export const lingoSmartcardChallengeAttempts = sqliteTable("smartlingo_smartcard_challenge_attempts", {
  id: text("id").primaryKey(),
  deckId: text("deck_id").notNull().references(() => lingoSmartcardDecks.id, { onDelete: "restrict" }),
  deckVersion: integer("deck_version").notNull(),
  attemptNumber: integer("attempt_number").notNull(),
  challengerUserId: text("challenger_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  score: integer("score").notNull(),
  correctCount: integer("correct_count").notNull(),
  questionCount: integer("question_count").notNull(),
  passed: integer("passed", { mode: "boolean" }).notNull(),
  rewardPoints: integer("reward_points").notNull().default(0),
  answerFingerprint: text("answer_fingerprint").notNull(),
  localDate: text("local_date").notNull(),
  createdAt: integer("created_at").notNull(),
}, (table) => [
  uniqueIndex("smartlingo_smartcard_attempt_identity_uq").on(table.challengerUserId, table.deckId, table.deckVersion, table.attemptNumber),
  uniqueIndex("smartlingo_smartcard_reward_once_uq").on(table.challengerUserId, table.deckId, table.deckVersion).where(sql`${table.rewardPoints} > 0`),
  index("smartlingo_smartcard_challenge_deck_idx").on(table.deckId, table.score, table.createdAt),
]);

/** Guests may practice without an account. Their random HttpOnly device key
 * stores provisional points only; redeemable credit is created after sign-in. */
export const lingoSmartcardGuestAttempts = sqliteTable("smartlingo_smartcard_guest_attempts", {
  id: text("id").primaryKey(),
  guestKeyHash: text("guest_key_hash").notNull(),
  deckId: text("deck_id").notNull().references(() => lingoSmartcardDecks.id, { onDelete: "restrict" }),
  deckVersion: integer("deck_version").notNull(),
  attemptNumber: integer("attempt_number").notNull(),
  score: integer("score").notNull(),
  correctCount: integer("correct_count").notNull(),
  questionCount: integer("question_count").notNull(),
  passed: integer("passed", { mode: "boolean" }).notNull(),
  provisionalPoints: integer("provisional_points").notNull(),
  answerFingerprint: text("answer_fingerprint").notNull(),
  localDate: text("local_date").notNull(),
  claimedUserId: text("claimed_user_id").references(() => users.id, { onDelete: "restrict" }),
  claimedAt: integer("claimed_at"),
  createdAt: integer("created_at").notNull(),
}, (table) => [
  uniqueIndex("smartlingo_smartcard_guest_attempt_identity_uq").on(table.guestKeyHash, table.deckId, table.deckVersion, table.attemptNumber),
  uniqueIndex("smartlingo_smartcard_guest_reward_once_uq").on(table.guestKeyHash, table.deckId, table.deckVersion).where(sql`${table.provisionalPoints} > 0`),
  index("smartlingo_smartcard_guest_claim_idx").on(table.guestKeyHash, table.claimedUserId, table.createdAt),
]);

/** One durable game result per device and published deck version. The score
 * begins at 100 and becomes course credit only after a verified account claim. */
export const lingoSmartcardGameRuns = sqliteTable("smartlingo_smartcard_game_runs", {
  id: text("id").primaryKey(),
  guestKeyHash: text("guest_key_hash").notNull(),
  deckId: text("deck_id").notNull().references(() => lingoSmartcardDecks.id, { onDelete: "restrict" }),
  deckVersion: integer("deck_version").notNull(),
  gameMode: text("game_mode").notNull(),
  score: integer("score").notNull(),
  correctCount: integer("correct_count").notNull(),
  questionCount: integer("question_count").notNull(),
  pronunciationPasses: integer("pronunciation_passes").notNull(),
  answerFingerprint: text("answer_fingerprint").notNull(),
  localDate: text("local_date").notNull(),
  claimStatus: text("claim_status").notNull().default("pending"),
  claimedUserId: text("claimed_user_id").references(() => users.id, { onDelete: "restrict" }),
  claimedAt: integer("claimed_at"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [
  uniqueIndex("smartlingo_smartcard_game_guest_deck_uq").on(table.guestKeyHash, table.deckId, table.deckVersion, table.gameMode, table.localDate),
  uniqueIndex("smartlingo_smartcard_game_user_deck_uq").on(table.claimedUserId, table.deckId, table.deckVersion, table.gameMode, table.localDate).where(sql`${table.claimedUserId} IS NOT NULL`),
  index("smartlingo_smartcard_game_claim_idx").on(table.guestKeyHash, table.claimedUserId, table.updatedAt),
]);

export const lingoCourseCreditPolicy = sqliteTable("smartlingo_course_credit_policy", {
  id: text("id").primaryKey(),
  pointsPerUsd: integer("points_per_usd").notNull(),
  challengePassScore: integer("challenge_pass_score").notNull(),
  challengeRewardPoints: integer("challenge_reward_points").notNull(),
  dailyEarnCap: integer("daily_earn_cap").notNull(),
  maxRedemptionBasisPoints: integer("max_redemption_basis_points").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

/** Redeemable course points are independent from non-cash learning XP and the
 * direct-introducer ledger. Every balance change is append-only and idempotent. */
export const lingoCourseCreditLedger = sqliteTable("smartlingo_course_credit_ledger", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  points: integer("points").notNull(),
  entryType: text("entry_type").notNull(),
  sourceType: text("source_type").notNull(),
  sourceId: text("source_id").notNull(),
  localDate: text("local_date").notNull(),
  relatedEntryId: text("related_entry_id").references((): AnySQLiteColumn => lingoCourseCreditLedger.id, { onDelete: "restrict" }),
  note: text("note").notNull().default(""),
  createdAt: integer("created_at").notNull(),
}, (table) => [
  uniqueIndex("smartlingo_course_credit_source_uq").on(table.userId, table.sourceType, table.sourceId),
  index("smartlingo_course_credit_user_idx").on(table.userId, table.createdAt),
]);

export const lingoCourseCreditRedemptions = sqliteTable("smartlingo_course_credit_redemptions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  classId: text("class_id").notNull().references(() => lingoClasses.id, { onDelete: "restrict" }),
  points: integer("points").notNull(),
  discountCents: integer("discount_cents").notNull(),
  coursePriceCents: integer("course_price_cents").notNull(),
  provider: text("provider").notNull(),
  providerReference: text("provider_reference"),
  status: text("status").notNull(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [
  index("smartlingo_course_credit_redemption_user_idx").on(table.userId, table.status, table.createdAt),
]);

/**
 * Exact, versioned unit identities for every published language path. Learning
 * plans reference this registry so a position cannot name a fabricated unit,
 * cross a language path, or pair a real unit with the wrong stage.
 */
export const lingoLearningPathUnits = sqliteTable("smartlingo_learning_path_units", {
  id: text("id").primaryKey(),
  pathId: text("path_id").notNull().references(() => lingoLanguagePaths.id, { onDelete: "restrict" }),
  targetLanguage: text("target_language").notNull(),
  stageId: text("stage_id").notNull(),
  sequence: integer("sequence").notNull(),
  unitKey: text("unit_key").notNull(),
  prerequisiteUnitId: text("prerequisite_unit_id").references(
    (): AnySQLiteColumn => lingoLearningPathUnits.id,
    { onDelete: "restrict" },
  ),
  availability: text("availability").notNull(),
  contentVersion: text("content_version").notNull(),
  sourceType: text("source_type").notNull().default("smartlingo_original"),
}, (table) => [
  check("smartlingo_path_unit_language_ck", sql`${table.targetLanguage} IN ('zh', 'en', 'es', 'ja', 'ko', 'fr', 'de', 'ru', 'it', 'pt', 'ar', 'hi')`),
  check("smartlingo_path_unit_stage_ck", sql`${table.stageId} IN ('foundation', 'everyday', 'independent')`),
  check("smartlingo_path_unit_sequence_ck", sql`${table.sequence} BETWEEN 1 AND 9`),
  check("smartlingo_path_unit_stage_sequence_ck", sql`(${table.stageId} = 'foundation' AND ${table.sequence} BETWEEN 1 AND 3) OR (${table.stageId} = 'everyday' AND ${table.sequence} BETWEEN 4 AND 6) OR (${table.stageId} = 'independent' AND ${table.sequence} BETWEEN 7 AND 9)`),
  check("smartlingo_path_unit_key_ck", sql`length(trim(${table.unitKey})) BETWEEN 1 AND 80`),
  check("smartlingo_path_unit_prerequisite_ck", sql`(${table.sequence} = 1 AND ${table.prerequisiteUnitId} IS NULL) OR (${table.sequence} > 1 AND ${table.prerequisiteUnitId} IS NOT NULL)`),
  check("smartlingo_path_unit_availability_ck", sql`${table.availability} IN ('available', 'preview')`),
  check("smartlingo_path_unit_version_ck", sql`length(trim(${table.contentVersion})) BETWEEN 1 AND 48`),
  check("smartlingo_path_unit_source_ck", sql`${table.sourceType} = 'smartlingo_original'`),
  uniqueIndex("smartlingo_path_unit_path_key_uq").on(table.pathId, table.unitKey),
  uniqueIndex("smartlingo_path_unit_path_sequence_uq").on(table.pathId, table.sequence),
  index("smartlingo_path_unit_path_stage_idx").on(table.pathId, table.targetLanguage, table.stageId, table.sequence),
]);

/**
 * One durable onboarding plan is retained per learner and language path.
 * Switching languages changes only the active marker; a later save updates
 * preferences without erasing the learner's current stage or unit.
 */
export const lingoLearningPlans = sqliteTable("smartlingo_learning_plans", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  pathId: text("path_id").notNull().references(() => lingoLanguagePaths.id, { onDelete: "restrict" }),
  targetLanguage: text("target_language").notNull(),
  useCase: text("use_case").notNull(),
  dailyMinutes: integer("daily_minutes").notNull(),
  selfReportedLevel: text("self_reported_level").notNull(),
  entryMode: text("entry_mode").notNull(),
  contentVersion: text("content_version").notNull(),
  currentStageId: text("current_stage_id"),
  currentUnitId: text("current_unit_id").references(() => lingoLearningPathUnits.id, { onDelete: "restrict" }),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [
  check("smartlingo_learning_plan_language_ck", sql`${table.targetLanguage} IN ('zh', 'en', 'es', 'ja', 'ko', 'fr', 'de', 'ru', 'it', 'pt', 'ar', 'hi')`),
  check("smartlingo_learning_plan_use_case_ck", sql`${table.useCase} IN ('daily_life', 'travel', 'work', 'study', 'community')`),
  check("smartlingo_learning_plan_daily_minutes_ck", sql`${table.dailyMinutes} IN (5, 10, 15, 20)`),
  check("smartlingo_learning_plan_level_ck", sql`${table.selfReportedLevel} IN ('beginner', 'intermediate', 'advanced')`),
  check("smartlingo_learning_plan_entry_mode_ck", sql`${table.entryMode} IN ('adaptive', 'self_selected', 'fundamentals')`),
  check("smartlingo_learning_plan_version_ck", sql`length(trim(${table.contentVersion})) BETWEEN 1 AND 48`),
  check("smartlingo_learning_plan_stage_ck", sql`${table.currentStageId} IS NULL OR ${table.currentStageId} IN ('foundation', 'everyday', 'independent')`),
  check("smartlingo_learning_plan_unit_ck", sql`${table.currentUnitId} IS NULL OR length(trim(${table.currentUnitId})) BETWEEN 1 AND 120`),
  check("smartlingo_learning_plan_position_ck", sql`(${table.currentStageId} IS NULL) = (${table.currentUnitId} IS NULL)`),
  check("smartlingo_learning_plan_active_ck", sql`${table.isActive} IN (0, 1)`),
  uniqueIndex("smartlingo_learning_plan_user_path_uq").on(table.userId, table.pathId),
  uniqueIndex("smartlingo_learning_plan_active_user_uq").on(table.userId).where(sql`${table.isActive} = 1`),
  index("smartlingo_learning_plan_user_updated_idx").on(table.userId, table.updatedAt),
  index("smartlingo_learning_plan_path_idx").on(table.pathId, table.targetLanguage),
]);

/** Admin-configurable beginner fast tracks. `is_free` is stored in D1 so a
 * course can change access policy without a new frontend release. */
export const lingoQuickCourseOfferings = sqliteTable("smartlingo_quick_course_offerings_v2", {
  id: text("id").primaryKey(),
  pathId: text("path_id").notNull().references(() => lingoLanguagePaths.id, { onDelete: "restrict" }),
  targetLanguage: text("target_language").notNull(),
  durationDays: integer("duration_days").notNull(),
  level: text("level").notNull().default("beginner"),
  curriculumVersion: text("curriculum_version").notNull(),
  isFree: integer("is_free", { mode: "boolean" }).notNull().default(false),
  status: text("status").notNull().default("published"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [
  check("smartlingo_quick_course_language_ck", sql`${table.targetLanguage} IN ('zh', 'en', 'es', 'ja', 'ko', 'fr', 'de', 'ru', 'it', 'pt', 'ar', 'hi')`),
  check("smartlingo_quick_course_duration_v2_ck", sql`${table.durationDays} IN (7, 14, 28)`),
  check("smartlingo_quick_course_level_ck", sql`${table.level} = 'beginner'`),
  check("smartlingo_quick_course_free_ck", sql`${table.isFree} IN (0, 1)`),
  check("smartlingo_quick_course_status_ck", sql`${table.status} IN ('published', 'paused', 'retired')`),
  uniqueIndex("smartlingo_quick_course_path_duration_v2_uq").on(table.pathId, table.durationDays),
  index("smartlingo_quick_course_catalog_v2_idx").on(table.status, table.targetLanguage, table.durationDays),
]);

export const lingoQuickCourseEnrollments = sqliteTable("smartlingo_quick_course_enrollments_v2", {
  id: text("id").primaryKey(),
  offeringId: text("offering_id").notNull().references(() => lingoQuickCourseOfferings.id, { onDelete: "restrict" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  classId: text("class_id").notNull().references(() => lingoClasses.id, { onDelete: "cascade" }),
  accessType: text("access_type").notNull(),
  status: text("status").notNull().default("active"),
  currentDay: integer("current_day").notNull().default(1),
  startedAt: integer("started_at").notNull(),
  completedAt: integer("completed_at"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [
  check("smartlingo_quick_enrollment_access_ck", sql`${table.accessType} IN ('free', 'entitled', 'payment_required')`),
  check("smartlingo_quick_enrollment_status_ck", sql`${table.status} IN ('active', 'paused', 'completed', 'withdrawn', 'pending_payment')`),
  check("smartlingo_quick_enrollment_day_v2_ck", sql`${table.currentDay} BETWEEN 1 AND 28`),
  uniqueIndex("smartlingo_quick_enrollment_user_offering_v2_uq").on(table.userId, table.offeringId),
  index("smartlingo_quick_enrollment_user_status_v2_idx").on(table.userId, table.status, table.updatedAt),
]);

/**
 * One authoritative score snapshot per learner, fast-track enrollment, and
 * local study date. The JSON skill map contains only the scheduled skills for
 * that course day; the server computes the 1–100 daily score and completion
 * flag from recorded learning evidence.
 */
export const lingoQuickCourseDailyScores = sqliteTable("smartlingo_quick_course_daily_scores", {
  id: text("id").primaryKey(),
  enrollmentId: text("enrollment_id").notNull().references(() => lingoQuickCourseEnrollments.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  classId: text("class_id").notNull().references(() => lingoClasses.id, { onDelete: "cascade" }),
  courseDay: integer("course_day").notNull(),
  localDate: text("local_date").notNull(),
  score: integer("score").notNull(),
  skillScores: text("skill_scores").notNull().default("{}"),
  quizScore: integer("quiz_score"),
  isComplete: integer("is_complete", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [
  check("smartlingo_quick_daily_day_ck", sql`${table.courseDay} BETWEEN 1 AND 28`),
  check("smartlingo_quick_daily_date_ck", sql`length(${table.localDate}) = 10`),
  check("smartlingo_quick_daily_score_ck", sql`${table.score} BETWEEN 1 AND 100`),
  check("smartlingo_quick_daily_skills_ck", sql`json_valid(${table.skillScores}) AND json_type(${table.skillScores}) = 'object' AND length(${table.skillScores}) <= 1000`),
  check("smartlingo_quick_daily_quiz_ck", sql`${table.quizScore} IS NULL OR ${table.quizScore} BETWEEN 0 AND 100`),
  check("smartlingo_quick_daily_complete_ck", sql`${table.isComplete} IN (0, 1)`),
  uniqueIndex("smartlingo_quick_daily_enrollment_date_uq").on(table.enrollmentId, table.localDate),
  uniqueIndex("smartlingo_quick_daily_enrollment_day_uq").on(table.enrollmentId, table.courseDay),
  index("smartlingo_quick_daily_user_date_idx").on(table.userId, table.localDate),
  index("smartlingo_quick_daily_class_date_idx").on(table.classId, table.localDate),
]);

/** A completion certificate is immutable evidence for one passed enrollment. */
export const lingoCourseCertificates = sqliteTable("smartlingo_course_certificates", {
  id: text("id").primaryKey(),
  certificateNumber: text("certificate_number").notNull().unique(),
  verificationCode: text("verification_code").notNull().unique(),
  enrollmentId: text("enrollment_id").notNull().unique().references(() => lingoQuickCourseEnrollments.id, { onDelete: "restrict" }),
  offeringId: text("offering_id").notNull().references(() => lingoQuickCourseOfferings.id, { onDelete: "restrict" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  classId: text("class_id").notNull().references(() => lingoClasses.id, { onDelete: "restrict" }),
  memberName: text("member_name").notNull(),
  courseTitleZh: text("course_title_zh").notNull(),
  courseTitleEn: text("course_title_en").notNull(),
  targetLanguage: text("target_language").notNull(),
  level: text("level").notNull().default("beginner"),
  durationDays: integer("duration_days").notNull(),
  completedDays: integer("completed_days").notNull(),
  finalScore: integer("final_score").notNull(),
  passScore: integer("pass_score").notNull().default(60),
  completionReason: text("completion_reason").notNull(),
  curriculumVersion: text("curriculum_version").notNull(),
  issuedAt: integer("issued_at").notNull(),
  createdAt: integer("created_at").notNull(),
}, (table) => [
  check("smartlingo_certificate_member_ck", sql`length(trim(${table.memberName})) BETWEEN 1 AND 120`),
  check("smartlingo_certificate_language_ck", sql`${table.targetLanguage} IN ('zh', 'en', 'es', 'ja', 'ko', 'fr', 'de', 'ru', 'it', 'pt', 'ar', 'hi')`),
  check("smartlingo_certificate_level_ck", sql`${table.level} = 'beginner'`),
  check("smartlingo_certificate_duration_ck", sql`${table.durationDays} IN (7, 14, 28)`),
  check("smartlingo_certificate_days_ck", sql`${table.completedDays} BETWEEN 1 AND ${table.durationDays}`),
  check("smartlingo_certificate_score_ck", sql`${table.finalScore} BETWEEN 60 AND 100 AND ${table.passScore} = 60`),
  check("smartlingo_certificate_reason_ck", sql`${table.completionReason} IN ('course_complete', 'early_mastery')`),
  index("smartlingo_certificate_user_issued_idx").on(table.userId, table.issuedAt),
  index("smartlingo_certificate_class_score_idx").on(table.classId, table.finalScore, table.issuedAt),
  index("smartlingo_certificate_rank_idx").on(table.finalScore, table.issuedAt),
]);

/** Unified language-course catalog. Every language has three cumulative levels
 * and three durations per level; each site owns its own D1 rows. */
export const lingoCourseOfferingsV3 = sqliteTable("smartlingo_course_offerings_v3", {
  id: text("id").primaryKey(),
  pathId: text("path_id").notNull().references(() => lingoLanguagePaths.id, { onDelete: "restrict" }),
  targetLanguage: text("target_language").notNull(),
  level: text("level").notNull(),
  durationDays: integer("duration_days").notNull(),
  sequence: integer("sequence").notNull(),
  curriculumVersion: text("curriculum_version").notNull(),
  isFree: integer("is_free", { mode: "boolean" }).notNull().default(false),
  status: text("status").notNull().default("published"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [
  check("smartlingo_course_v3_language_ck", sql`${table.targetLanguage} IN ('zh', 'en', 'es', 'ja', 'ko', 'fr', 'de', 'ru', 'it', 'pt', 'ar', 'hi')`),
  check("smartlingo_course_v3_level_ck", sql`${table.level} IN ('beginner', 'intermediate', 'advanced')`),
  check("smartlingo_course_v3_duration_ck", sql`${table.durationDays} IN (7, 14, 30, 60, 90, 180, 365)`),
  check("smartlingo_course_v3_sequence_ck", sql`${table.sequence} BETWEEN 1 AND 3`),
  check("smartlingo_course_v3_free_ck", sql`${table.isFree} IN (0, 1)`),
  check("smartlingo_course_v3_status_ck", sql`${table.status} IN ('published', 'paused', 'retired')`),
  uniqueIndex("smartlingo_course_v3_path_level_duration_uq").on(table.pathId, table.level, table.durationDays),
  index("smartlingo_course_v3_catalog_idx").on(table.status, table.targetLanguage, table.level, table.sequence),
]);

export const lingoCourseEnrollmentsV3 = sqliteTable("smartlingo_course_enrollments_v3", {
  id: text("id").primaryKey(),
  offeringId: text("offering_id").notNull().references(() => lingoCourseOfferingsV3.id, { onDelete: "restrict" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  classId: text("class_id").notNull().references(() => lingoClasses.id, { onDelete: "cascade" }),
  accessType: text("access_type").notNull(),
  status: text("status").notNull().default("active"),
  startDay: integer("start_day").notNull().default(1),
  currentDay: integer("current_day").notNull().default(1),
  dailySeconds: integer("daily_seconds").notNull().default(3600),
  startedAt: integer("started_at").notNull(),
  completedAt: integer("completed_at"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [
  check("smartlingo_course_enrollment_v3_access_ck", sql`${table.accessType} IN ('free', 'entitled', 'payment_required')`),
  check("smartlingo_course_enrollment_v3_status_ck", sql`${table.status} IN ('active', 'paused', 'completed', 'withdrawn', 'pending_payment')`),
  check("smartlingo_course_enrollment_v3_start_ck", sql`${table.startDay} BETWEEN 1 AND 365`),
  check("smartlingo_course_enrollment_v3_day_ck", sql`${table.currentDay} BETWEEN ${table.startDay} AND 365`),
  check("smartlingo_course_enrollment_v3_timer_ck", sql`${table.dailySeconds} = 3600`),
  uniqueIndex("smartlingo_course_enrollment_v3_user_offering_uq").on(table.userId, table.offeringId),
  index("smartlingo_course_enrollment_v3_user_status_idx").on(table.userId, table.status, table.updatedAt),
]);

/** Cross-date progress is keyed by course day, so an unfinished lesson resumes
 * tomorrow instead of advancing or losing its evidence. */
export const lingoCourseDayProgressV2 = sqliteTable("smartlingo_course_day_progress_v2", {
  id: text("id").primaryKey(),
  enrollmentId: text("enrollment_id").notNull().references(() => lingoCourseEnrollmentsV3.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  classId: text("class_id").notNull().references(() => lingoClasses.id, { onDelete: "cascade" }),
  courseDay: integer("course_day").notNull(),
  startedDate: text("started_date").notNull(),
  lastActivityDate: text("last_activity_date").notNull(),
  score: integer("score").notNull().default(1),
  skillScores: text("skill_scores").notNull().default("{}"),
  quizScore: integer("quiz_score"),
  isComplete: integer("is_complete", { mode: "boolean" }).notNull().default(false),
  startedAt: integer("started_at").notNull(),
  completedAt: integer("completed_at"),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [
  check("smartlingo_course_day_v2_day_ck", sql`${table.courseDay} BETWEEN 1 AND 365`),
  check("smartlingo_course_day_v2_date_ck", sql`length(${table.startedDate}) = 10 AND length(${table.lastActivityDate}) = 10`),
  check("smartlingo_course_day_v2_score_ck", sql`${table.score} BETWEEN 1 AND 100`),
  check("smartlingo_course_day_v2_skills_ck", sql`json_valid(${table.skillScores}) AND json_type(${table.skillScores}) = 'object' AND length(${table.skillScores}) <= 1000`),
  check("smartlingo_course_day_v2_quiz_ck", sql`${table.quizScore} IS NULL OR ${table.quizScore} BETWEEN 0 AND 100`),
  check("smartlingo_course_day_v2_complete_ck", sql`${table.isComplete} IN (0, 1)`),
  uniqueIndex("smartlingo_course_day_v2_enrollment_day_uq").on(table.enrollmentId, table.courseDay),
  index("smartlingo_course_day_v2_user_date_idx").on(table.userId, table.lastActivityDate),
]);

export const lingoCourseSessionState = sqliteTable("smartlingo_course_session_state", {
  enrollmentId: text("enrollment_id").primaryKey().references(() => lingoCourseEnrollmentsV3.id, { onDelete: "cascade" }),
  courseDay: integer("course_day").notNull(),
  durationSeconds: integer("duration_seconds").notNull().default(3600),
  remainingSeconds: integer("remaining_seconds").notNull().default(3600),
  status: text("status").notNull().default("ready"),
  lastStartedAt: integer("last_started_at"),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [
  check("smartlingo_course_session_day_ck", sql`${table.courseDay} BETWEEN 1 AND 365`),
  check("smartlingo_course_session_duration_ck", sql`${table.durationSeconds} = 3600`),
  check("smartlingo_course_session_remaining_ck", sql`${table.remainingSeconds} BETWEEN 0 AND 3600`),
  check("smartlingo_course_session_status_ck", sql`${table.status} IN ('ready', 'running', 'paused', 'completed')`),
]);

export const lingoCourseCertificatesV2 = sqliteTable("smartlingo_course_certificates_v2", {
  id: text("id").primaryKey(),
  certificateNumber: text("certificate_number").notNull().unique(),
  verificationCode: text("verification_code").notNull().unique(),
  enrollmentId: text("enrollment_id").notNull().unique().references(() => lingoCourseEnrollmentsV3.id, { onDelete: "restrict" }),
  offeringId: text("offering_id").notNull().references(() => lingoCourseOfferingsV3.id, { onDelete: "restrict" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  classId: text("class_id").notNull().references(() => lingoClasses.id, { onDelete: "restrict" }),
  memberName: text("member_name").notNull(),
  courseTitleZh: text("course_title_zh").notNull(),
  courseTitleEn: text("course_title_en").notNull(),
  targetLanguage: text("target_language").notNull(),
  level: text("level").notNull(),
  durationDays: integer("duration_days").notNull(),
  startDay: integer("start_day").notNull().default(1),
  completedDays: integer("completed_days").notNull(),
  finalScore: integer("final_score").notNull(),
  passScore: integer("pass_score").notNull().default(60),
  completionReason: text("completion_reason").notNull(),
  curriculumVersion: text("curriculum_version").notNull(),
  issuedAt: integer("issued_at").notNull(),
  createdAt: integer("created_at").notNull(),
}, (table) => [
  check("smartlingo_certificate_v2_member_ck", sql`length(trim(${table.memberName})) BETWEEN 1 AND 120`),
  check("smartlingo_certificate_v2_language_ck", sql`${table.targetLanguage} IN ('zh', 'en', 'es', 'ja', 'ko', 'fr', 'de', 'ru', 'it', 'pt', 'ar', 'hi')`),
  check("smartlingo_certificate_v2_level_ck", sql`${table.level} IN ('beginner', 'intermediate', 'advanced')`),
  check("smartlingo_certificate_v2_duration_ck", sql`${table.durationDays} IN (7, 14, 30, 60, 90, 180, 365)`),
  check("smartlingo_certificate_v2_score_ck", sql`${table.finalScore} BETWEEN 60 AND 100 AND ${table.passScore} = 60`),
  check("smartlingo_certificate_v2_reason_ck", sql`${table.completionReason} IN ('course_complete', 'early_mastery', 'exam_pass')`),
  index("smartlingo_certificate_v2_user_issued_idx").on(table.userId, table.issuedAt),
  index("smartlingo_certificate_v2_class_score_idx").on(table.classId, table.finalScore, table.issuedAt),
  index("smartlingo_certificate_v2_rank_idx").on(table.finalScore, table.issuedAt),
]);

/**
 * A placement attempt belongs to one active member of one platform-provided
 * language community. Self-selected entry levels intentionally keep the five
 * skill scores nullable; adaptive attempts add evidence as each skill is
 * completed. Results guide practice and are not official language scores.
 */
export const lingoPlacementAttempts = sqliteTable("smartlingo_placement_attempts", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  classId: text("class_id").notNull().references(() => lingoClasses.id, { onDelete: "cascade" }),
  pathId: text("path_id").notNull().references(() => lingoLanguagePaths.id, { onDelete: "restrict" }),
  entryMode: text("entry_mode").notNull(),
  status: text("status").notNull().default("in_progress"),
  currentDifficulty: integer("current_difficulty").notNull().default(3),
  activeSeconds: integer("active_seconds").notNull().default(0),
  lastResumedAt: integer("last_resumed_at"),
  vocabularyScore: integer("vocabulary_score"),
  readingScore: integer("reading_score"),
  writingScore: integer("writing_score"),
  listeningScore: integer("listening_score"),
  dialogueScore: integer("dialogue_score"),
  overallScore: integer("overall_score"),
  recommendedLevel: text("recommended_level"),
  startedAt: integer("started_at").notNull(),
  pausedAt: integer("paused_at"),
  completedAt: integer("completed_at"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [
  check("smartlingo_placement_attempt_entry_mode_ck", sql`${table.entryMode} IN ('beginner', 'intermediate', 'advanced', 'adaptive')`),
  check("smartlingo_placement_attempt_status_ck", sql`${table.status} IN ('in_progress', 'paused', 'completed', 'abandoned')`),
  check("smartlingo_placement_attempt_difficulty_ck", sql`${table.currentDifficulty} BETWEEN 1 AND 5`),
  check("smartlingo_placement_attempt_active_time_ck", sql`${table.activeSeconds} BETWEEN 0 AND 14400`),
  check("smartlingo_placement_attempt_scores_ck", sql`
    (${table.vocabularyScore} IS NULL OR ${table.vocabularyScore} BETWEEN 0 AND 100)
    AND (${table.readingScore} IS NULL OR ${table.readingScore} BETWEEN 0 AND 100)
    AND (${table.writingScore} IS NULL OR ${table.writingScore} BETWEEN 0 AND 100)
    AND (${table.listeningScore} IS NULL OR ${table.listeningScore} BETWEEN 0 AND 100)
    AND (${table.dialogueScore} IS NULL OR ${table.dialogueScore} BETWEEN 0 AND 100)
    AND (${table.overallScore} IS NULL OR ${table.overallScore} BETWEEN 0 AND 100)
  `),
  check("smartlingo_placement_attempt_level_ck", sql`${table.recommendedLevel} IS NULL OR ${table.recommendedLevel} IN ('beginner', 'intermediate', 'advanced')`),
  uniqueIndex("smartlingo_placement_attempt_active_uq")
    .on(table.userId, table.classId)
    .where(sql`${table.status} IN ('in_progress', 'paused')`),
  index("smartlingo_placement_attempt_user_class_idx").on(table.userId, table.classId, table.updatedAt),
  index("smartlingo_placement_attempt_class_status_idx").on(table.classId, table.status, table.updatedAt),
]);

export const lingoPlacementResponses = sqliteTable("smartlingo_placement_responses", {
  id: text("id").primaryKey(),
  attemptId: text("attempt_id").notNull().references(() => lingoPlacementAttempts.id, { onDelete: "cascade" }),
  itemKey: text("item_key").notNull(),
  itemVersion: text("item_version").notNull(),
  skill: text("skill").notNull(),
  difficulty: integer("difficulty").notNull(),
  answerText: text("answer_text").notNull().default(""),
  skipped: integer("skipped", { mode: "boolean" }).notNull().default(false),
  score: integer("score"),
  aiFeedback: text("ai_feedback").notNull().default(""),
  durationSeconds: integer("duration_seconds").notNull().default(0),
  answeredAt: integer("answered_at").notNull(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [
  check("smartlingo_placement_response_identity_ck", sql`length(trim(${table.itemKey})) > 0 AND length(trim(${table.itemVersion})) > 0`),
  check("smartlingo_placement_response_skill_ck", sql`${table.skill} IN ('vocabulary', 'reading', 'writing', 'listening', 'dialogue')`),
  check("smartlingo_placement_response_difficulty_ck", sql`${table.difficulty} BETWEEN 1 AND 5`),
  check("smartlingo_placement_response_skipped_ck", sql`${table.skipped} IN (0, 1)`),
  check("smartlingo_placement_response_score_ck", sql`${table.score} IS NULL OR ${table.score} BETWEEN 0 AND 100`),
  check("smartlingo_placement_response_skip_score_ck", sql`${table.skipped} = 0 OR ${table.score} IS NULL`),
  check("smartlingo_placement_response_text_ck", sql`length(${table.answerText}) <= 6000 AND length(${table.aiFeedback}) <= 6000`),
  check("smartlingo_placement_response_duration_ck", sql`${table.durationSeconds} BETWEEN 0 AND 3600`),
  uniqueIndex("smartlingo_placement_response_item_uq").on(table.attemptId, table.itemKey, table.itemVersion),
  index("smartlingo_placement_response_attempt_skill_idx").on(table.attemptId, table.skill, table.answeredAt),
]);

/**
 * Calendar events are append-only, server-authored evidence. `source_type` and
 * `source_id` make writes idempotent without storing private exercise bodies.
 */
export const lingoLearningActivityEvents = sqliteTable("smartlingo_learning_activity_events", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  classId: text("class_id").references(() => lingoClasses.id, { onDelete: "set null" }),
  attemptId: text("attempt_id").references(() => lingoPlacementAttempts.id, { onDelete: "set null" }),
  domain: text("domain").notNull(),
  activityType: text("activity_type").notNull(),
  durationSeconds: integer("duration_seconds").notNull().default(0),
  units: integer("units").notNull().default(1),
  score: integer("score"),
  sourceType: text("source_type").notNull(),
  sourceId: text("source_id").notNull(),
  createdAt: integer("created_at").notNull(),
}, (table) => [
  check("smartlingo_learning_activity_domain_ck", sql`${table.domain} IN ('vocabulary', 'reading', 'writing', 'listening', 'dialogue', 'community')`),
  check("smartlingo_learning_activity_type_ck", sql`${table.activityType} IN ('placement', 'practice', 'flashcard', 'class_join', 'community_topic', 'community_reply', 'group_chat', 'live_chat')`),
  check("smartlingo_learning_activity_duration_ck", sql`${table.durationSeconds} BETWEEN 0 AND 86400`),
  check("smartlingo_learning_activity_units_ck", sql`${table.units} BETWEEN 1 AND 10000`),
  check("smartlingo_learning_activity_score_ck", sql`${table.score} IS NULL OR ${table.score} BETWEEN 0 AND 100`),
  check("smartlingo_learning_activity_source_ck", sql`length(trim(${table.sourceType})) BETWEEN 1 AND 48 AND length(trim(${table.sourceId})) BETWEEN 1 AND 160`),
  uniqueIndex("smartlingo_learning_activity_source_uq").on(table.userId, table.sourceType, table.sourceId),
  index("smartlingo_learning_activity_user_created_idx").on(table.userId, table.createdAt),
  index("smartlingo_learning_activity_user_domain_idx").on(table.userId, table.domain, table.createdAt),
  index("smartlingo_learning_activity_class_created_idx").on(table.classId, table.createdAt),
]);

/** One server-owned duration preference per learner and official class. */
export const lingoDailyLearningPreferences = sqliteTable("smartlingo_daily_learning_preferences", {
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  classId: text("class_id").notNull().references(() => lingoClasses.id, { onDelete: "cascade" }),
  sessionMinutes: integer("session_minutes").notNull().default(15),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [
  primaryKey({ columns: [table.userId, table.classId] }),
  check("smartlingo_daily_preference_minutes_ck", sql`${table.sessionMinutes} IN (15, 30, 45, 60)`),
  index("smartlingo_daily_preference_user_updated_idx").on(table.userId, table.updatedAt),
]);

/**
 * One immutable composition and one revisioned draft checkpoint per course day.
 * The server plan is authoritative; `draft_json` may contain unfinished client
 * text but can never mark a task or course day complete.
 */
export const lingoDailySessionCheckpoints = sqliteTable("smartlingo_daily_session_checkpoints", {
  id: text("id").primaryKey(),
  enrollmentId: text("enrollment_id").notNull().references(() => lingoCourseEnrollmentsV3.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  classId: text("class_id").notNull().references(() => lingoClasses.id, { onDelete: "cascade" }),
  courseDay: integer("course_day").notNull(),
  localDate: text("local_date").notNull(),
  timeZone: text("time_zone").notNull(),
  contentVersion: text("content_version").notNull(),
  planJson: text("plan_json").notNull().default("{}"),
  draftJson: text("draft_json").notNull().default("{}"),
  activeStep: text("active_step").notNull().default("vocabulary"),
  revision: integer("revision").notNull().default(1),
  lastOperationId: text("last_operation_id"),
  lastOperationFingerprint: text("last_operation_fingerprint"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [
  check("smartlingo_daily_checkpoint_day_ck", sql`${table.courseDay} BETWEEN 1 AND 365`),
  check("smartlingo_daily_checkpoint_date_ck", sql`length(${table.localDate}) = 10`),
  check("smartlingo_daily_checkpoint_timezone_ck", sql`length(trim(${table.timeZone})) BETWEEN 1 AND 64`),
  check("smartlingo_daily_checkpoint_version_ck", sql`length(trim(${table.contentVersion})) BETWEEN 1 AND 48`),
  check("smartlingo_daily_checkpoint_plan_ck", sql`json_valid(${table.planJson}) AND json_type(${table.planJson}) = 'object' AND length(${table.planJson}) <= 24000`),
  check("smartlingo_daily_checkpoint_draft_ck", sql`json_valid(${table.draftJson}) AND json_type(${table.draftJson}) = 'object' AND length(${table.draftJson}) <= 12000`),
  check("smartlingo_daily_checkpoint_step_ck", sql`${table.activeStep} IN ('vocabulary', 'reading', 'writing', 'listening', 'dialogue', 'exam', 'recap')`),
  check("smartlingo_daily_checkpoint_revision_ck", sql`${table.revision} >= 1`),
  uniqueIndex("smartlingo_daily_checkpoint_enrollment_day_uq").on(table.enrollmentId, table.courseDay),
  uniqueIndex("smartlingo_daily_checkpoint_last_operation_uq").on(table.lastOperationId)
    .where(sql`${table.lastOperationId} IS NOT NULL`),
  index("smartlingo_daily_checkpoint_user_date_idx").on(table.userId, table.localDate, table.updatedAt),
  index("smartlingo_daily_checkpoint_class_date_idx").on(table.classId, table.localDate, table.updatedAt),
]);

/** Client mutation receipts make checkpoint retries idempotent across devices. */
export const lingoDailySyncOperations = sqliteTable("smartlingo_daily_sync_operations", {
  id: text("id").primaryKey(),
  checkpointId: text("checkpoint_id").notNull().references(() => lingoDailySessionCheckpoints.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  operation: text("operation").notNull(),
  requestFingerprint: text("request_fingerprint"),
  createdAt: integer("created_at").notNull(),
}, (table) => [
  check("smartlingo_daily_sync_operation_ck", sql`${table.operation} IN ('save_draft', 'select_step')`),
  index("smartlingo_daily_sync_checkpoint_idx").on(table.checkpointId, table.createdAt),
  index("smartlingo_daily_sync_user_idx").on(table.userId, table.createdAt),
]);

/**
 * Server-owned draft snapshots provide the real base for a three-way merge.
 * Client-supplied base content is never trusted to reconstruct prior state.
 */
export const lingoDailyCheckpointRevisions = sqliteTable("smartlingo_daily_checkpoint_revisions", {
  checkpointId: text("checkpoint_id").notNull().references(() => lingoDailySessionCheckpoints.id, { onDelete: "cascade" }),
  revision: integer("revision").notNull(),
  draftJson: text("draft_json").notNull(),
  activeStep: text("active_step").notNull(),
  createdAt: integer("created_at").notNull(),
}, (table) => [
  primaryKey({ columns: [table.checkpointId, table.revision] }),
  check("smartlingo_daily_checkpoint_history_revision_ck", sql`${table.revision} >= 1`),
  check("smartlingo_daily_checkpoint_history_draft_ck", sql`json_valid(${table.draftJson}) AND json_type(${table.draftJson}) = 'object' AND length(${table.draftJson}) <= 12000`),
  check("smartlingo_daily_checkpoint_history_step_ck", sql`${table.activeStep} IN ('vocabulary', 'reading', 'writing', 'listening', 'dialogue', 'exam', 'recap')`),
  index("smartlingo_daily_checkpoint_history_created_idx").on(table.checkpointId, table.createdAt),
]);

/**
 * Every graded answer keeps the exact content version and original bilingual
 * explanation that the learner saw. These are practice records, not teacher or
 * official-exam judgments.
 */
export const lingoDailyAnswerFeedback = sqliteTable("smartlingo_daily_answer_feedback", {
  id: text("id").primaryKey(),
  checkpointId: text("checkpoint_id").notNull().references(() => lingoDailySessionCheckpoints.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  classId: text("class_id").notNull().references(() => lingoClasses.id, { onDelete: "cascade" }),
  taskId: text("task_id").notNull(),
  skill: text("skill").notNull(),
  clientOperationId: text("client_operation_id").notNull().unique(),
  answerText: text("answer_text").notNull().default(""),
  score: integer("score"),
  correct: integer("correct", { mode: "boolean" }).notNull().default(false),
  skipped: integer("skipped", { mode: "boolean" }).notNull().default(false),
  explanationZh: text("explanation_zh").notNull(),
  explanationEn: text("explanation_en").notNull(),
  hintZh: text("hint_zh").notNull(),
  hintEn: text("hint_en").notNull(),
  contentVersion: text("content_version").notNull(),
  createdAt: integer("created_at").notNull(),
}, (table) => [
  check("smartlingo_daily_feedback_skill_ck", sql`${table.skill} IN ('vocabulary', 'reading', 'writing', 'listening', 'dialogue', 'quiz')`),
  check("smartlingo_daily_feedback_score_ck", sql`${table.score} IS NULL OR ${table.score} BETWEEN 0 AND 100`),
  check("smartlingo_daily_feedback_flags_ck", sql`${table.correct} IN (0, 1) AND ${table.skipped} IN (0, 1)`),
  check("smartlingo_daily_feedback_skip_ck", sql`(${table.skipped} = 1 AND ${table.score} IS NULL AND ${table.correct} = 0) OR (${table.skipped} = 0 AND ${table.score} IS NOT NULL)`),
  check("smartlingo_daily_feedback_answer_ck", sql`length(${table.answerText}) <= 1200`),
  check("smartlingo_daily_feedback_copy_ck", sql`length(trim(${table.explanationZh})) BETWEEN 1 AND 1200 AND length(trim(${table.explanationEn})) BETWEEN 1 AND 1200 AND length(trim(${table.hintZh})) BETWEEN 1 AND 600 AND length(trim(${table.hintEn})) BETWEEN 1 AND 600`),
  check("smartlingo_daily_feedback_version_ck", sql`length(trim(${table.contentVersion})) BETWEEN 1 AND 48`),
  index("smartlingo_daily_feedback_checkpoint_task_idx").on(table.checkpointId, table.taskId, table.createdAt),
  index("smartlingo_daily_feedback_user_created_idx").on(table.userId, table.createdAt),
]);

/** Learning XP is motivational, server-authored, and has no cash value. */
export const lingoLearningXpLedger = sqliteTable("smartlingo_learning_xp_ledger", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  classId: text("class_id").notNull().references(() => lingoClasses.id, { onDelete: "cascade" }),
  activityEventId: text("activity_event_id").notNull().unique().references(() => lingoLearningActivityEvents.id, { onDelete: "restrict" }),
  xp: integer("xp").notNull(),
  reason: text("reason").notNull(),
  localDate: text("local_date").notNull(),
  timeZone: text("time_zone").notNull(),
  createdAt: integer("created_at").notNull(),
}, (table) => [
  check("smartlingo_learning_xp_amount_ck", sql`${table.xp} BETWEEN 1 AND 100`),
  check("smartlingo_learning_xp_reason_ck", sql`${table.reason} IN ('daily_practice', 'vocabulary_review', 'daily_quiz', 'pronunciation_review')`),
  check("smartlingo_learning_xp_date_ck", sql`length(${table.localDate}) = 10`),
  check("smartlingo_learning_xp_timezone_ck", sql`length(trim(${table.timeZone})) BETWEEN 1 AND 64`),
  index("smartlingo_learning_xp_user_date_idx").on(table.userId, table.localDate, table.createdAt),
  index("smartlingo_learning_xp_class_date_idx").on(table.classId, table.localDate, table.createdAt),
]);

/** One global learning streak per member, intentionally separate from rewards. */
export const lingoLearningStreaks = sqliteTable("smartlingo_learning_streaks", {
  userId: text("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  timeZone: text("time_zone").notNull(),
  currentStreak: integer("current_streak").notNull().default(0),
  longestStreak: integer("longest_streak").notNull().default(0),
  lastQualifiedDate: text("last_qualified_date"),
  repairedDate: text("repaired_date"),
  repairWindowStartedDate: text("repair_window_started_date"),
  repairCredits: integer("repair_credits").notNull().default(1),
  revision: integer("revision").notNull().default(0),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [
  check("smartlingo_learning_streak_timezone_ck", sql`length(trim(${table.timeZone})) BETWEEN 1 AND 64`),
  check("smartlingo_learning_streak_counts_ck", sql`${table.currentStreak} >= 0 AND ${table.longestStreak} >= ${table.currentStreak}`),
  check("smartlingo_learning_streak_date_ck", sql`(${table.lastQualifiedDate} IS NULL OR length(${table.lastQualifiedDate}) = 10) AND (${table.repairedDate} IS NULL OR length(${table.repairedDate}) = 10) AND (${table.repairWindowStartedDate} IS NULL OR length(${table.repairWindowStartedDate}) = 10)`),
  check("smartlingo_learning_streak_credit_ck", sql`${table.repairCredits} IN (0, 1)`),
  check("smartlingo_learning_streak_revision_ck", sql`${table.revision} >= 0`),
  index("smartlingo_learning_streak_last_date_idx").on(table.lastQualifiedDate, table.updatedAt),
]);

/** Daily quiz results are graded and retained by the server; answer keys never leave it. */
export const lingoDailyQuizAttempts = sqliteTable("smartlingo_daily_quiz_attempts", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  classId: text("class_id").notNull().references(() => lingoClasses.id, { onDelete: "cascade" }),
  localDate: text("local_date").notNull(),
  targetLanguage: text("target_language").notNull(),
  contentVersion: text("content_version").notNull(),
  attemptNumber: integer("attempt_number").notNull(),
  score: integer("score").notNull(),
  correctCount: integer("correct_count").notNull(),
  questionCount: integer("question_count").notNull(),
  createdAt: integer("created_at").notNull(),
}, (table) => [
  check("smartlingo_daily_quiz_language_ck", sql`${table.targetLanguage} IN ('zh', 'en', 'es', 'ja', 'ko', 'fr', 'de', 'ru', 'it', 'pt', 'ar', 'hi')`),
  check("smartlingo_daily_quiz_attempt_ck", sql`${table.attemptNumber} BETWEEN 1 AND 20`),
  check("smartlingo_daily_quiz_score_ck", sql`${table.score} BETWEEN 0 AND 100`),
  check("smartlingo_daily_quiz_counts_ck", sql`${table.questionCount} BETWEEN 1 AND 20 AND ${table.correctCount} BETWEEN 0 AND ${table.questionCount}`),
  uniqueIndex("smartlingo_daily_quiz_attempt_uq").on(table.userId, table.classId, table.localDate, table.attemptNumber),
  index("smartlingo_daily_quiz_user_date_idx").on(table.userId, table.localDate, table.createdAt),
  index("smartlingo_daily_quiz_class_date_idx").on(table.classId, table.localDate, table.createdAt),
]);

/**
 * Spaced vocabulary state references a stable, versioned word key. The word
 * and its licensed/original content live outside this progress table.
 */
export const lingoVocabularyProgress = sqliteTable("smartlingo_vocabulary_progress", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  pathId: text("path_id").notNull().references(() => lingoLanguagePaths.id, { onDelete: "restrict" }),
  classId: text("class_id").references(() => lingoClasses.id, { onDelete: "set null" }),
  wordKey: text("word_key").notNull(),
  wordVersion: text("word_version").notNull(),
  status: text("status").notNull().default("new"),
  modesSeen: text("modes_seen").notNull().default("[]"),
  reviewBox: integer("review_box").notNull().default(0),
  intervalDays: integer("interval_days").notNull().default(0),
  reviewCount: integer("review_count").notNull().default(0),
  correctCount: integer("correct_count").notNull().default(0),
  lapseCount: integer("lapse_count").notNull().default(0),
  lastScore: integer("last_score"),
  isFocused: integer("is_focused", { mode: "boolean" }).notNull().default(false),
  successfulDates: text("successful_dates").notNull().default("[]"),
  firstLearnedAt: integer("first_learned_at"),
  masteredAt: integer("mastered_at"),
  dueAt: integer("due_at"),
  lastReviewedAt: integer("last_reviewed_at"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [
  check("smartlingo_vocabulary_progress_identity_ck", sql`length(trim(${table.wordKey})) > 0 AND length(trim(${table.wordVersion})) > 0`),
  check("smartlingo_vocabulary_progress_status_ck", sql`${table.status} IN ('new', 'learning', 'review', 'mastered', 'suspended')`),
  check("smartlingo_vocabulary_progress_modes_ck", sql`json_valid(${table.modesSeen}) AND json_type(${table.modesSeen}) = 'array' AND length(${table.modesSeen}) <= 320`),
  check("smartlingo_vocabulary_progress_box_ck", sql`${table.reviewBox} BETWEEN 0 AND 5`),
  check("smartlingo_vocabulary_progress_interval_ck", sql`${table.intervalDays} BETWEEN 0 AND 3650`),
  check("smartlingo_vocabulary_progress_counts_ck", sql`
    ${table.reviewCount} >= 0 AND ${table.correctCount} >= 0 AND ${table.lapseCount} >= 0
    AND ${table.correctCount} + ${table.lapseCount} <= ${table.reviewCount}
  `),
  check("smartlingo_vocabulary_progress_score_ck", sql`${table.lastScore} IS NULL OR ${table.lastScore} BETWEEN 0 AND 100`),
  check("smartlingo_vocabulary_progress_focus_ck", sql`${table.isFocused} IN (0, 1)`),
  check("smartlingo_vocabulary_progress_success_dates_ck", sql`json_valid(${table.successfulDates}) AND json_type(${table.successfulDates}) = 'array' AND length(${table.successfulDates}) <= 512`),
  uniqueIndex("smartlingo_vocabulary_progress_word_uq").on(table.userId, table.pathId, table.wordKey, table.wordVersion),
  index("smartlingo_vocabulary_progress_user_due_idx").on(table.userId, table.status, table.dueAt),
  index("smartlingo_vocabulary_progress_path_status_idx").on(table.pathId, table.status),
  index("smartlingo_vocabulary_progress_class_idx").on(table.classId, table.updatedAt),
]);

/** Immutable daily snapshots make long-term vocabulary growth visible without
 * rewriting history when the published curriculum later grows. */
export const lingoVocabularyDailyReports = sqliteTable("smartlingo_vocabulary_daily_reports", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  pathId: text("path_id").notNull().references(() => lingoLanguagePaths.id, { onDelete: "restrict" }),
  classId: text("class_id").references(() => lingoClasses.id, { onDelete: "set null" }),
  localDate: text("local_date").notNull(),
  totalCount: integer("total_count").notNull(),
  masteredCount: integer("mastered_count").notNull(),
  learningCount: integer("learning_count").notNull(),
  unlearnedCount: integer("unlearned_count").notNull(),
  masteryPercent: integer("mastery_percent").notNull(),
  stars: integer("stars").notNull(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [
  check("smartlingo_vocabulary_daily_report_counts_ck", sql`${table.totalCount} >= 0 AND ${table.masteredCount} >= 0 AND ${table.learningCount} >= 0 AND ${table.unlearnedCount} >= 0 AND ${table.masteredCount} + ${table.learningCount} + ${table.unlearnedCount} = ${table.totalCount}`),
  check("smartlingo_vocabulary_daily_report_percent_ck", sql`${table.masteryPercent} BETWEEN 0 AND 100 AND ${table.stars} BETWEEN 0 AND 5`),
  uniqueIndex("smartlingo_vocabulary_daily_report_uq").on(table.userId, table.pathId, table.localDate),
  index("smartlingo_vocabulary_daily_report_history_idx").on(table.userId, table.pathId, table.localDate),
]);
