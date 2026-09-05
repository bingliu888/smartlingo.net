-- Gold 3 v1 r1: Clerk is the canonical authorization identity on every
-- request. The legacy sessions table stays in this first release because
-- production applies D1 migrations before replacing the old Worker. Release
-- r2 removes that table only after the Clerk-only Worker is live.

-- Case-only duplicates are identity collisions too. Fail the migration closed
-- for explicit review instead of silently merging two member records.
CREATE UNIQUE INDEX smartlingo_users_email_nocase_unique_idx
  ON users(email COLLATE NOCASE);

CREATE INDEX smartlingo_users_identity_freshness_idx
  ON users(clerk_identity_checked_at,email_verified,id);

-- The historical column default was created before Clerk verification was the
-- only authority. Any future insert that relies on that default is rejected
-- unless it also carries a fresh Clerk identity check.
CREATE TRIGGER smartlingo_users_verified_identity_insert
BEFORE INSERT ON users
FOR EACH ROW WHEN NEW.email_verified=1 AND NEW.clerk_identity_checked_at<=0
BEGIN
  SELECT RAISE(ABORT,'VERIFIED_EMAIL_REQUIRES_FRESH_CLERK_IDENTITY');
END;

CREATE TRIGGER smartlingo_users_verified_identity_update
BEFORE UPDATE OF email_verified,clerk_identity_checked_at ON users
FOR EACH ROW WHEN NEW.email_verified=1 AND NEW.clerk_identity_checked_at<=0
BEGIN
  SELECT RAISE(ABORT,'VERIFIED_EMAIL_REQUIRES_FRESH_CLERK_IDENTITY');
END;

-- Updating users.id is the rare recovery path for a previously linked member
-- or the sole verified permanent administrator after Clerk replaces its user
-- ID. All site-local identity references move atomically with the parent row.
-- SmartPay payer_id/ref_id remain immutable on-chain identity history.
CREATE TRIGGER smartlingo_users_clerk_id_rekey
AFTER UPDATE OF id ON users
FOR EACH ROW WHEN OLD.id<>NEW.id
BEGIN
  UPDATE activity_attempts SET user_id=NEW.id WHERE user_id=OLD.id;
  UPDATE career_profiles SET user_id=NEW.id WHERE user_id=OLD.id;
  UPDATE class_deletion_jobs SET host_user_id=NEW.id WHERE host_user_id=OLD.id;
  UPDATE class_material_uploads SET user_id=NEW.id WHERE user_id=OLD.id;
  UPDATE class_participant_bans SET banned_by_user_id=NEW.id WHERE banned_by_user_id=OLD.id;
  UPDATE class_participant_bans SET user_id=NEW.id WHERE user_id=OLD.id;
  UPDATE class_participant_sessions SET user_id=NEW.id WHERE user_id=OLD.id;
  UPDATE class_playlist_uploads SET user_id=NEW.id WHERE user_id=OLD.id;
  UPDATE class_recording_quota_reservations SET host_user_id=NEW.id WHERE host_user_id=OLD.id;
  UPDATE cohort_replies SET user_id=NEW.id WHERE user_id=OLD.id;
  UPDATE cohort_topics SET user_id=NEW.id WHERE user_id=OLD.id;
  UPDATE community_meetings SET owner_user_id=NEW.id WHERE owner_user_id=OLD.id;
  UPDATE community_replies SET user_id=NEW.id WHERE user_id=OLD.id;
  UPDATE community_topics SET user_id=NEW.id WHERE user_id=OLD.id;
  UPDATE crypto_payment_admin_audit SET admin_user_id=NEW.id WHERE admin_user_id=OLD.id;
  UPDATE crypto_payment_claims SET user_id=NEW.id WHERE user_id=OLD.id;
  UPDATE crypto_payment_settings SET created_by_user_id=NEW.id WHERE created_by_user_id=OLD.id;
  UPDATE learning_cohort_memberships SET user_id=NEW.id WHERE user_id=OLD.id;
  UPDATE learning_credentials SET user_id=NEW.id WHERE user_id=OLD.id;
  UPDATE learning_progress SET user_id=NEW.id WHERE user_id=OLD.id;
  UPDATE live_class_materials SET uploader_user_id=NEW.id WHERE uploader_user_id=OLD.id;
  UPDATE live_class_rooms SET host_user_id=NEW.id WHERE host_user_id=OLD.id;
  UPDATE live_voice_usage SET user_id=NEW.id WHERE user_id=OLD.id;
  UPDATE member_ai_daily_quotas SET user_id=NEW.id WHERE user_id=OLD.id;
  UPDATE member_storage_quota_reservations SET host_user_id=NEW.id WHERE host_user_id=OLD.id;
  UPDATE message_call_participants SET user_id=NEW.id WHERE user_id=OLD.id;
  UPDATE message_calls SET started_by=NEW.id WHERE started_by=OLD.id;
  UPDATE message_participants SET user_id=NEW.id WHERE user_id=OLD.id;
  UPDATE message_threads SET created_by=NEW.id WHERE created_by=OLD.id;
  UPDATE messages SET sender_id=NEW.id WHERE sender_id=OLD.id;
  UPDATE notification_preferences SET user_id=NEW.id WHERE user_id=OLD.id;
  UPDATE password_reset_requests SET user_id=NEW.id WHERE user_id=OLD.id;
  UPDATE platform_admin_audit SET admin_user_id=NEW.id WHERE admin_user_id=OLD.id;
  UPDATE platform_admin_audit SET target_user_id=NEW.id WHERE target_user_id=OLD.id;
  UPDATE platform_member_access SET updated_by_user_id=NEW.id WHERE updated_by_user_id=OLD.id;
  UPDATE platform_member_access SET user_id=NEW.id WHERE user_id=OLD.id;
  UPDATE referral_codes SET user_id=NEW.id WHERE user_id=OLD.id;
  UPDATE referral_media SET user_id=NEW.id WHERE user_id=OLD.id;
  UPDATE referrals SET referred_user_id=NEW.id WHERE referred_user_id=OLD.id;
  UPDATE reward_ledger SET user_id=NEW.id WHERE user_id=OLD.id;
  UPDATE sessions SET user_id=NEW.id WHERE user_id=OLD.id;
  UPDATE smartlingo_admin_audit SET actor_user_id=NEW.id WHERE actor_user_id=OLD.id;
  UPDATE smartlingo_bacc_ledger SET user_id=NEW.id WHERE user_id=OLD.id;
  UPDATE smartlingo_class_enrollments SET direct_referrer_user_id=NEW.id WHERE direct_referrer_user_id=OLD.id;
  UPDATE smartlingo_class_enrollments SET user_id=NEW.id WHERE user_id=OLD.id;
  UPDATE smartlingo_class_invite_visits SET claimed_by_user_id=NEW.id WHERE claimed_by_user_id=OLD.id;
  UPDATE smartlingo_class_invites SET referrer_user_id=NEW.id WHERE referrer_user_id=OLD.id;
  UPDATE smartlingo_class_price_requests SET requested_by_user_id=NEW.id WHERE requested_by_user_id=OLD.id;
  UPDATE smartlingo_class_referral_claims SET referred_user_id=NEW.id WHERE referred_user_id=OLD.id;
  UPDATE smartlingo_class_referral_claims SET referrer_user_id=NEW.id WHERE referrer_user_id=OLD.id;
  UPDATE smartlingo_classes SET owner_user_id=NEW.id WHERE owner_user_id=OLD.id;
  UPDATE smartlingo_connected_accounts SET user_id=NEW.id WHERE user_id=OLD.id;
  UPDATE smartlingo_course_certificates SET user_id=NEW.id WHERE user_id=OLD.id;
  UPDATE smartlingo_course_certificates_v2 SET user_id=NEW.id WHERE user_id=OLD.id;
  UPDATE smartlingo_course_credit_ledger SET user_id=NEW.id WHERE user_id=OLD.id;
  UPDATE smartlingo_course_credit_redemptions SET user_id=NEW.id WHERE user_id=OLD.id;
  UPDATE smartlingo_course_day_progress_v2 SET user_id=NEW.id WHERE user_id=OLD.id;
  UPDATE smartlingo_course_enrollments_v3 SET user_id=NEW.id WHERE user_id=OLD.id;
  UPDATE smartlingo_course_package_purchases SET user_id=NEW.id WHERE user_id=OLD.id;
  UPDATE smartlingo_course_subscriptions SET supervisor_user_id=NEW.id WHERE supervisor_user_id=OLD.id;
  UPDATE smartlingo_course_subscriptions SET user_id=NEW.id WHERE user_id=OLD.id;
  UPDATE smartlingo_course_supervisor_reward_events SET subscriber_user_id=NEW.id WHERE subscriber_user_id=OLD.id;
  UPDATE smartlingo_course_supervisor_reward_events SET supervisor_user_id=NEW.id WHERE supervisor_user_id=OLD.id;
  UPDATE smartlingo_course_templates SET owner_user_id=NEW.id WHERE owner_user_id=OLD.id;
  UPDATE smartlingo_daily_answer_feedback SET user_id=NEW.id WHERE user_id=OLD.id;
  UPDATE smartlingo_daily_learning_preferences SET user_id=NEW.id WHERE user_id=OLD.id;
  UPDATE smartlingo_daily_quiz_attempts SET user_id=NEW.id WHERE user_id=OLD.id;
  UPDATE smartlingo_daily_session_checkpoints SET user_id=NEW.id WHERE user_id=OLD.id;
  UPDATE smartlingo_daily_sprint_runs SET user_id=NEW.id WHERE user_id=OLD.id;
  UPDATE smartlingo_daily_sync_operations SET user_id=NEW.id WHERE user_id=OLD.id;
  UPDATE smartlingo_introducer_reward_ledger SET introducer_user_id=NEW.id WHERE introducer_user_id=OLD.id;
  UPDATE smartlingo_language_class_invites SET created_by_user_id=NEW.id WHERE created_by_user_id=OLD.id;
  UPDATE smartlingo_language_class_members SET user_id=NEW.id WHERE user_id=OLD.id;
  UPDATE smartlingo_language_class_orders SET learner_user_id=NEW.id WHERE learner_user_id=OLD.id;
  UPDATE smartlingo_language_class_orders SET owner_user_id=NEW.id WHERE owner_user_id=OLD.id;
  UPDATE smartlingo_language_classes SET owner_user_id=NEW.id WHERE owner_user_id=OLD.id;
  UPDATE smartlingo_language_progress SET user_id=NEW.id WHERE user_id=OLD.id;
  UPDATE smartlingo_learning_activity_events SET user_id=NEW.id WHERE user_id=OLD.id;
  UPDATE smartlingo_learning_plans SET user_id=NEW.id WHERE user_id=OLD.id;
  UPDATE smartlingo_learning_reward_rules SET updated_by_user_id=NEW.id WHERE updated_by_user_id=OLD.id;
  UPDATE smartlingo_learning_score_history SET user_id=NEW.id WHERE user_id=OLD.id;
  UPDATE smartlingo_learning_streaks SET user_id=NEW.id WHERE user_id=OLD.id;
  UPDATE smartlingo_learning_xp_ledger SET user_id=NEW.id WHERE user_id=OLD.id;
  UPDATE smartlingo_license_orders SET buyer_user_id=NEW.id WHERE buyer_user_id=OLD.id;
  UPDATE smartlingo_media_assets SET owner_user_id=NEW.id WHERE owner_user_id=OLD.id;
  UPDATE smartlingo_memberships SET user_id=NEW.id WHERE user_id=OLD.id;
  UPDATE smartlingo_nearby_blocks SET blocked_user_id=NEW.id WHERE blocked_user_id=OLD.id;
  UPDATE smartlingo_nearby_blocks SET blocker_user_id=NEW.id WHERE blocker_user_id=OLD.id;
  UPDATE smartlingo_nearby_profiles SET user_id=NEW.id WHERE user_id=OLD.id;
  UPDATE smartlingo_nearby_reports SET reported_user_id=NEW.id WHERE reported_user_id=OLD.id;
  UPDATE smartlingo_nearby_reports SET reporter_user_id=NEW.id WHERE reporter_user_id=OLD.id;
  UPDATE smartlingo_placement_attempts SET user_id=NEW.id WHERE user_id=OLD.id;
  UPDATE smartlingo_platform_subscription_payments SET introducer_user_id=NEW.id WHERE introducer_user_id=OLD.id;
  UPDATE smartlingo_platform_subscription_payments SET subscriber_user_id=NEW.id WHERE subscriber_user_id=OLD.id;
  UPDATE smartlingo_quick_course_daily_scores SET user_id=NEW.id WHERE user_id=OLD.id;
  UPDATE smartlingo_quick_course_enrollments SET user_id=NEW.id WHERE user_id=OLD.id;
  UPDATE smartlingo_quick_course_enrollments_v2 SET user_id=NEW.id WHERE user_id=OLD.id;
  UPDATE smartlingo_smartcard_challenge_attempts SET challenger_user_id=NEW.id WHERE challenger_user_id=OLD.id;
  UPDATE smartlingo_smartcard_daily_settlements SET winner_user_id=NEW.id WHERE winner_user_id=OLD.id;
  UPDATE smartlingo_smartcard_decks SET owner_user_id=NEW.id WHERE owner_user_id=OLD.id;
  UPDATE smartlingo_smartcard_game_runs SET claimed_user_id=NEW.id WHERE claimed_user_id=OLD.id;
  UPDATE smartlingo_smartcard_guest_attempts SET claimed_user_id=NEW.id WHERE claimed_user_id=OLD.id;
  UPDATE smartlingo_vocabulary_practice_sessions SET user_id=NEW.id WHERE user_id=OLD.id;
  UPDATE smartlingo_vocabulary_progress SET user_id=NEW.id WHERE user_id=OLD.id;
  UPDATE smartpay_ref_ids SET user_id=NEW.id WHERE user_id=OLD.id;
  UPDATE smartpay_source_publications SET published_by_admin_user_id=NEW.id WHERE published_by_admin_user_id=OLD.id;
  UPDATE smartpay_wallet_bindings SET user_id=NEW.id WHERE user_id=OLD.id;
  UPDATE smartpay3_payment_claims SET user_id=NEW.id WHERE user_id=OLD.id;
  UPDATE smartpay5_payment_claims SET user_id=NEW.id WHERE user_id=OLD.id;
  UPDATE stage_enrollments SET user_id=NEW.id WHERE user_id=OLD.id;
  UPDATE stage_entitlements SET user_id=NEW.id WHERE user_id=OLD.id;
  UPDATE subscriptions SET user_id=NEW.id WHERE user_id=OLD.id;
  UPDATE user_avatars SET user_id=NEW.id WHERE user_id=OLD.id;
  UPDATE user_presence SET user_id=NEW.id WHERE user_id=OLD.id;
END;
