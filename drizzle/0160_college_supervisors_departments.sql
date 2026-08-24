PRAGMA foreign_keys = ON;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS smartlingo_college_supervisor_licenses (
  user_id TEXT PRIMARY KEY NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tier TEXT NOT NULL CHECK(tier IN ('basic','premium','supreme')),
  price_cents INTEGER NOT NULL CHECK(price_cents IN (99900,299900,499900)),
  max_departments INTEGER NOT NULL CHECK(max_departments IN (3,9,15)),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','active','refunded','disputed')),
  stripe_checkout_session_id TEXT UNIQUE,
  stripe_payment_intent_id TEXT UNIQUE,
  purchased_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  CHECK((tier='basic' AND price_cents=99900 AND max_departments=3)
    OR (tier='premium' AND price_cents=299900 AND max_departments=9)
    OR (tier='supreme' AND price_cents=499900 AND max_departments=15))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS smartlingo_college_supervisor_status_idx
  ON smartlingo_college_supervisor_licenses(status,tier);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS smartlingo_college_departments (
  id TEXT PRIMARY KEY NOT NULL,
  code TEXT NOT NULL UNIQUE CHECK(length(code)=8),
  college_id TEXT NOT NULL REFERENCES smartlingo_colleges(id) ON DELETE CASCADE,
  source_language TEXT NOT NULL CHECK(source_language IN ('zh','en','es','ja','ko','fr','de','ru','it','pt','ar','hi')),
  target_language TEXT NOT NULL CHECK(target_language IN ('zh','en','es','ja','ko','fr','de','ru','it','pt','ar','hi')),
  title_en TEXT NOT NULL,
  title_zh TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','archived')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(college_id,source_language,target_language),
  CHECK(source_language<>target_language)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS smartlingo_college_departments_college_idx
  ON smartlingo_college_departments(college_id,status,created_at);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS smartlingo_college_department_courses (
  department_id TEXT NOT NULL REFERENCES smartlingo_college_departments(id) ON DELETE CASCADE,
  course_id TEXT NOT NULL REFERENCES smartlingo_language_classes(id) ON DELETE RESTRICT,
  position INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  PRIMARY KEY(department_id,course_id)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS smartlingo_department_classrooms (
  department_id TEXT PRIMARY KEY NOT NULL REFERENCES smartlingo_college_departments(id) ON DELETE CASCADE,
  room_id TEXT NOT NULL UNIQUE REFERENCES live_class_rooms(id) ON DELETE RESTRICT,
  created_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS smartlingo_department_enrollments (
  id TEXT PRIMARY KEY NOT NULL,
  department_id TEXT NOT NULL REFERENCES smartlingo_college_departments(id) ON DELETE CASCADE,
  course_id TEXT NOT NULL REFERENCES smartlingo_language_classes(id) ON DELETE RESTRICT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('trialing','active','past_due','cancelled','refunded','disputed')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(department_id,course_id,user_id)
);
--> statement-breakpoint
ALTER TABLE smartlingo_course_subscriptions ADD COLUMN department_id TEXT REFERENCES smartlingo_college_departments(id) ON DELETE SET NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS smartlingo_course_subscription_department_idx
  ON smartlingo_course_subscriptions(department_id,status);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS smartlingo_department_subscription_payments (
  id TEXT PRIMARY KEY NOT NULL,
  department_id TEXT NOT NULL REFERENCES smartlingo_college_departments(id) ON DELETE RESTRICT,
  course_id TEXT NOT NULL REFERENCES smartlingo_language_classes(id) ON DELETE RESTRICT,
  learner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  provider_invoice_id TEXT UNIQUE,
  provider_subscription_id TEXT,
  gross_cents INTEGER NOT NULL CHECK(gross_cents>=0),
  owner_share_cents INTEGER NOT NULL CHECK(owner_share_cents>=0),
  platform_fee_cents INTEGER NOT NULL CHECK(platform_fee_cents>=0),
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','paid','refunded','disputed','failed')),
  paid_at INTEGER,
  refunded_at INTEGER,
  disputed_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  CHECK(owner_share_cents=(gross_cents*7000)/10000),
  CHECK(platform_fee_cents=gross_cents-owner_share_cents)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS smartlingo_department_payments_owner_idx
  ON smartlingo_department_subscription_payments(owner_user_id,status,created_at);
