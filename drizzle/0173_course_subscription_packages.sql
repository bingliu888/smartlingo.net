CREATE TABLE IF NOT EXISTS smartlingo_course_packages (
  id TEXT PRIMARY KEY NOT NULL,
  package_tier TEXT NOT NULL CHECK(package_tier IN ('basic','intermediate','advanced')),
  duration_months INTEGER NOT NULL CHECK(duration_months IN (3,6,12)),
  price_cents INTEGER NOT NULL CHECK(price_cents > 0),
  currency TEXT NOT NULL DEFAULT 'USD' CHECK(currency='USD'),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','retired')),
  created_at INTEGER NOT NULL DEFAULT(unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT(unixepoch()),
  UNIQUE(package_tier,duration_months)
);
--> statement-breakpoint
INSERT INTO smartlingo_course_packages(id,package_tier,duration_months,price_cents,currency,status,created_at,updated_at) VALUES
  ('basic_3m','basic',3,3000,'USD','active',unixepoch(),unixepoch()),
  ('basic_6m','basic',6,5000,'USD','active',unixepoch(),unixepoch()),
  ('basic_12m','basic',12,8000,'USD','active',unixepoch(),unixepoch()),
  ('intermediate_3m','intermediate',3,6000,'USD','active',unixepoch(),unixepoch()),
  ('intermediate_6m','intermediate',6,10000,'USD','active',unixepoch(),unixepoch()),
  ('intermediate_12m','intermediate',12,16000,'USD','active',unixepoch(),unixepoch()),
  ('advanced_3m','advanced',3,12000,'USD','active',unixepoch(),unixepoch()),
  ('advanced_6m','advanced',6,20000,'USD','active',unixepoch(),unixepoch()),
  ('advanced_12m','advanced',12,32000,'USD','active',unixepoch(),unixepoch())
ON CONFLICT(id) DO UPDATE SET
  package_tier=excluded.package_tier,duration_months=excluded.duration_months,
  price_cents=excluded.price_cents,currency='USD',status='active',updated_at=unixepoch();
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS smartlingo_course_package_tier_duration_uq
  ON smartlingo_course_packages(package_tier,duration_months);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS smartlingo_course_package_purchases (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  class_id TEXT NOT NULL REFERENCES smartlingo_language_classes(id) ON DELETE RESTRICT,
  target_language TEXT NOT NULL CHECK(target_language IN ('zh','en','es','ja','ko','fr','de','ru','it','pt','ar','hi')),
  package_id TEXT NOT NULL REFERENCES smartlingo_course_packages(id) ON DELETE RESTRICT,
  package_tier TEXT NOT NULL CHECK(package_tier IN ('basic','intermediate','advanced')),
  duration_months INTEGER NOT NULL CHECK(duration_months IN (3,6,12)),
  price_cents INTEGER NOT NULL CHECK(price_cents > 0),
  currency TEXT NOT NULL DEFAULT 'USD' CHECK(currency='USD'),
  provider TEXT NOT NULL CHECK(provider IN ('stripe','smartpay3')),
  provider_reference TEXT NOT NULL,
  department_id TEXT REFERENCES smartlingo_college_departments(id) ON DELETE SET NULL,
  access_starts_at INTEGER NOT NULL,
  access_ends_at INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'paid' CHECK(status IN ('paid','refunded','disputed','void')),
  created_at INTEGER NOT NULL DEFAULT(unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT(unixepoch()),
  UNIQUE(provider,provider_reference)
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS smartlingo_course_package_purchase_provider_uq
  ON smartlingo_course_package_purchases(provider,provider_reference);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS smartlingo_course_package_purchase_user_idx
  ON smartlingo_course_package_purchases(user_id,target_language,package_tier,access_ends_at DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS smartlingo_course_package_purchase_class_idx
  ON smartlingo_course_package_purchases(class_id,status,access_ends_at DESC);
--> statement-breakpoint
UPDATE crypto_payment_settings SET
  basic_token_amount=CASE upper(token_symbol) WHEN 'USDT' THEN '30' ELSE '30000000' END,
  intermediate_token_amount=CASE upper(token_symbol) WHEN 'USDT' THEN '60' ELSE '60000000' END,
  advanced_token_amount=CASE upper(token_symbol) WHEN 'USDT' THEN '120' ELSE '120000000' END,
  updated_at=unixepoch()
WHERE chain_id=137 AND upper(token_symbol) IN ('USDT','GLC') AND deleted_at IS NULL;
--> statement-breakpoint
PRAGMA optimize;
