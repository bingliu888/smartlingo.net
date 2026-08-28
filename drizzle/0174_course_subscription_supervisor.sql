CREATE TABLE IF NOT EXISTS smartlingo_course_subscriptions (
  id TEXT PRIMARY KEY NOT NULL,
  class_id TEXT REFERENCES smartlingo_language_classes(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'trialing' CHECK(status IN ('trialing','active','past_due','cancelled','expired')),
  monthly_price_cents INTEGER NOT NULL CHECK(monthly_price_cents > 0),
  trial_started_at INTEGER NOT NULL,
  trial_ends_at INTEGER NOT NULL,
  current_period_ends_at INTEGER,
  provider_subscription_id TEXT UNIQUE,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(class_id,user_id)
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS smartlingo_course_subscription_class_user_uq ON smartlingo_course_subscriptions(class_id,user_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS smartlingo_course_subscription_user_status_idx ON smartlingo_course_subscriptions(user_id,status);
--> statement-breakpoint
ALTER TABLE smartlingo_course_subscriptions ADD COLUMN supervisor_user_id TEXT REFERENCES users(id) ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE smartlingo_course_subscriptions ADD COLUMN supervisor_ref_id TEXT COLLATE NOCASE CHECK(supervisor_ref_id IS NULL OR length(supervisor_ref_id)=6);
--> statement-breakpoint
CREATE INDEX smartlingo_course_subscription_supervisor_idx ON smartlingo_course_subscriptions(supervisor_user_id,status,current_period_ends_at);
--> statement-breakpoint
CREATE TABLE smartlingo_course_supervisor_reward_events (
  id TEXT PRIMARY KEY NOT NULL,
  purchase_id TEXT NOT NULL UNIQUE REFERENCES smartlingo_course_package_purchases(id) ON DELETE RESTRICT,
  supervisor_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  subscriber_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  class_id TEXT NOT NULL REFERENCES smartlingo_language_classes(id) ON DELETE RESTRICT,
  reward_basis_cents INTEGER NOT NULL CHECK(reward_basis_cents > 0),
  reward_amount_cents INTEGER CHECK(reward_amount_cents IS NULL OR reward_amount_cents >= 0),
  status TEXT NOT NULL DEFAULT 'eligible' CHECK(status IN ('eligible','earned','reversed')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX smartlingo_course_supervisor_reward_user_idx ON smartlingo_course_supervisor_reward_events(supervisor_user_id,status,created_at);
--> statement-breakpoint
CREATE TRIGGER smartlingo_course_subscription_supervisor_insert_guard
BEFORE INSERT ON smartlingo_course_subscriptions
WHEN NEW.supervisor_user_id IS NOT NULL AND (
  NEW.supervisor_user_id=NEW.user_id OR NEW.supervisor_ref_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM smartpay_ref_ids ref WHERE ref.user_id=NEW.supervisor_user_id AND lower(ref.ref_id)=lower(NEW.supervisor_ref_id)
  )
)
BEGIN SELECT RAISE(ABORT,'invalid course supervisor'); END;
--> statement-breakpoint
CREATE TRIGGER smartlingo_course_subscription_supervisor_update_guard
BEFORE UPDATE OF supervisor_user_id,supervisor_ref_id ON smartlingo_course_subscriptions
WHEN (OLD.supervisor_user_id IS NOT NULL AND (NEW.supervisor_user_id IS NOT OLD.supervisor_user_id OR NEW.supervisor_ref_id IS NOT OLD.supervisor_ref_id))
  OR (NEW.supervisor_user_id IS NOT NULL AND (
    NEW.supervisor_user_id=NEW.user_id OR NEW.supervisor_ref_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM smartpay_ref_ids ref WHERE ref.user_id=NEW.supervisor_user_id AND lower(ref.ref_id)=lower(NEW.supervisor_ref_id)
    )
  ))
BEGIN SELECT RAISE(ABORT,'immutable or invalid course supervisor'); END;
