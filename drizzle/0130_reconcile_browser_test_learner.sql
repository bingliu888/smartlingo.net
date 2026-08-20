-- One-time reconciliation for the established browser QA learner whose trial
-- was created while the fixed-course enrollment UI and learning loop were
-- temporarily disconnected. Future subscriptions are reconciled by the
-- enrollment endpoint itself.
INSERT OR IGNORE INTO smartlingo_course_enrollments_v3
  (id,offering_id,user_id,class_id,access_type,status,start_day,current_day,daily_seconds,
   started_at,completed_at,created_at,updated_at)
SELECT 'browser-qa-enrollment:'||subscription.class_id||':'||subscription.user_id,
  'sl-course-en-beginner-30d-v1',subscription.user_id,subscription.class_id,
  'entitled','active',1,1,3600,COALESCE(subscription.trial_started_at,subscription.created_at),
  NULL,subscription.created_at,unixepoch()
FROM smartlingo_course_subscriptions subscription
JOIN users learner ON learner.id=subscription.user_id
WHERE lower(learner.email)=lower('bingliu+smartlingo-test1@cybeye.com')
  AND subscription.class_id='course_en_basic'
  AND (subscription.status='active'
    OR (subscription.status='trialing' AND subscription.trial_ends_at>unixepoch()));
--> statement-breakpoint
INSERT OR IGNORE INTO smartlingo_course_session_state
  (enrollment_id,course_day,duration_seconds,remaining_seconds,status,updated_at)
SELECT enrollment.id,enrollment.current_day,3600,3600,'ready',unixepoch()
FROM smartlingo_course_enrollments_v3 enrollment
JOIN users learner ON learner.id=enrollment.user_id
WHERE lower(learner.email)=lower('bingliu+smartlingo-test1@cybeye.com')
  AND enrollment.class_id='course_en_basic' AND enrollment.status='active';
