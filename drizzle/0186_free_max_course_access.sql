-- Collapse SmartLingo commerce to Free + Max while preserving the three
-- administrator-authored curriculum levels as learning content.

-- Preserve already-paid course access by converting its remaining term into
-- a non-renewing Max term. This avoids revoking access during the migration.
UPDATE subscriptions
SET cadence='max',
    status='active',
    current_period_ends_at=MAX(
      COALESCE(current_period_ends_at,0),
      COALESCE((SELECT MAX(COALESCE(course.current_period_ends_at,course.trial_ends_at,0))
        FROM smartlingo_course_subscriptions course
        WHERE course.user_id=subscriptions.user_id
          AND course.status IN ('trialing','active')
          AND COALESCE(course.current_period_ends_at,course.trial_ends_at,0)>unixepoch()),0)
    ),
    cancel_at_period_end=1,
    updated_at=unixepoch()
WHERE EXISTS (
  SELECT 1 FROM smartlingo_course_subscriptions course
  WHERE course.user_id=subscriptions.user_id
    AND course.status IN ('trialing','active')
    AND COALESCE(course.current_period_ends_at,course.trial_ends_at,0)>unixepoch()
);
--> statement-breakpoint
INSERT INTO subscriptions
  (id,user_id,cadence,status,current_period_ends_at,cancel_at_period_end,created_at,updated_at)
SELECT lower(hex(randomblob(16))),course.user_id,'max','active',
  MAX(COALESCE(course.current_period_ends_at,course.trial_ends_at,unixepoch())),1,unixepoch(),unixepoch()
FROM smartlingo_course_subscriptions course
WHERE course.status IN ('trialing','active')
  AND COALESCE(course.current_period_ends_at,course.trial_ends_at,0)>unixepoch()
  AND NOT EXISTS (SELECT 1 FROM subscriptions platform WHERE platform.user_id=course.user_id)
GROUP BY course.user_id;
--> statement-breakpoint

-- The former nine course packages remain only as immutable historical
-- references for completed receipts. They are not selectable payment items.
UPDATE smartlingo_course_packages SET status='retired',updated_at=unixepoch() WHERE status='active';
--> statement-breakpoint
UPDATE smartpay5_payment_item_states
SET enabled=0,updated_at=unixepoch()
WHERE preset_key LIKE '%:basic_3m'
   OR preset_key LIKE '%:intermediate_3m'
   OR preset_key LIKE '%:advanced_3m';
--> statement-breakpoint

DROP TRIGGER IF EXISTS smartlingo_official_course_insert_trg;
--> statement-breakpoint
DROP TRIGGER IF EXISTS smartlingo_official_course_update_trg;
--> statement-breakpoint
UPDATE smartlingo_language_classes
SET price_cents=0,
    schedule=CASE
      WHEN id LIKE '%_basic' THEN 'Free Beginner course / 免费初级课程'
      ELSE '7-day Max trial, then active Max / 7 天 Max 试用，之后需有效 Max'
    END,
    updated_at=unixepoch()
WHERE class_kind='official_course';
--> statement-breakpoint
CREATE TRIGGER smartlingo_official_course_insert_trg
BEFORE INSERT ON smartlingo_language_classes
FOR EACH ROW WHEN NEW.class_kind='official_course' AND (
  NEW.owner_user_id!='smartlingo-language-admin' OR NEW.status!='open' OR NEW.visibility!='public'
  OR NEW.price_cents!=0
)
BEGIN SELECT RAISE(ABORT, 'official courses are curriculum levels governed by Free and Max'); END;
--> statement-breakpoint
CREATE TRIGGER smartlingo_official_course_update_trg
BEFORE UPDATE OF class_kind,owner_user_id,status,visibility,price_cents,package_tier,billing_interval,trial_days ON smartlingo_language_classes
FOR EACH ROW WHEN NEW.class_kind='official_course' AND (
  NEW.owner_user_id!='smartlingo-language-admin' OR NEW.status!='open' OR NEW.visibility!='public'
  OR NEW.price_cents!=0
)
BEGIN SELECT RAISE(ABORT, 'official courses are curriculum levels governed by Free and Max'); END;
--> statement-breakpoint
PRAGMA optimize;
