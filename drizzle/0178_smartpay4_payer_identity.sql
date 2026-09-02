-- SmartPay4 replaces SmartPay3 for new payments. Existing SmartPay3 claims
-- remain immutable history, while every new transaction is indexed by PayerID.
ALTER TABLE crypto_payment_settings ADD COLUMN smartpay4_contract TEXT;
--> statement-breakpoint
ALTER TABLE crypto_payment_settings ADD COLUMN smartpay4_usdt_percent INTEGER NOT NULL DEFAULT 50
  CHECK(smartpay4_usdt_percent BETWEEN 0 AND 100);
--> statement-breakpoint
UPDATE crypto_payment_settings SET smartpay4_usdt_percent=smartpay3_usdt_percent;
--> statement-breakpoint
ALTER TABLE crypto_payment_settings DROP COLUMN smartpay3_contract;
--> statement-breakpoint
ALTER TABLE crypto_payment_settings DROP COLUMN smartpay3_usdt_percent;
--> statement-breakpoint

CREATE TABLE smartpay4_payment_claims (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  setting_id TEXT NOT NULL REFERENCES crypto_payment_settings(id),
  contract_address TEXT NOT NULL,
  transaction_id TEXT NOT NULL,
  payer_wallet TEXT NOT NULL,
  payer_id TEXT NOT NULL COLLATE NOCASE CHECK(length(payer_id)=6),
  ref_id TEXT NOT NULL COLLATE NOCASE CHECK(length(ref_id)=6),
  main_id TEXT NOT NULL,
  second_id TEXT NOT NULL,
  language_code TEXT NOT NULL CHECK(language_code IN ('zh','en','es','ja','ko','fr','de','ru','it','pt','ar','hi')),
  package_tier TEXT NOT NULL CHECK(package_tier IN ('basic','intermediate','advanced')),
  class_id TEXT NOT NULL REFERENCES smartlingo_language_classes(id),
  primary_token_symbol TEXT NOT NULL,
  primary_token_address TEXT NOT NULL,
  primary_atomic_amount TEXT NOT NULL,
  secondary_token_symbol TEXT,
  secondary_token_address TEXT,
  secondary_atomic_amount TEXT,
  entitlement_status TEXT NOT NULL DEFAULT 'synced' CHECK(entitlement_status IN ('pending_sync','synced','rejected')),
  current_period_ends_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT(unixepoch()),
  verified_at INTEGER NOT NULL,
  UNIQUE(contract_address,transaction_id)
);
--> statement-breakpoint
CREATE INDEX smartpay4_course_claims_user_idx ON smartpay4_payment_claims(user_id,verified_at DESC);
--> statement-breakpoint
CREATE INDEX smartpay4_course_claims_payer_idx ON smartpay4_payment_claims(payer_id,verified_at DESC);
--> statement-breakpoint
CREATE INDEX smartpay4_course_claims_owner_idx ON smartpay4_payment_claims(ref_id,verified_at DESC);
--> statement-breakpoint

PRAGMA foreign_keys=OFF;
--> statement-breakpoint
CREATE TABLE smartlingo_course_package_purchases_smartpay4 (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  class_id TEXT NOT NULL REFERENCES smartlingo_language_classes(id) ON DELETE RESTRICT,
  target_language TEXT NOT NULL CHECK(target_language IN ('zh','en','es','ja','ko','fr','de','ru','it','pt','ar','hi')),
  package_id TEXT NOT NULL REFERENCES smartlingo_course_packages(id) ON DELETE RESTRICT,
  package_tier TEXT NOT NULL CHECK(package_tier IN ('basic','intermediate','advanced')),
  duration_months INTEGER NOT NULL CHECK(duration_months IN (3,6,12)),
  price_cents INTEGER NOT NULL CHECK(price_cents > 0),
  currency TEXT NOT NULL DEFAULT 'USD' CHECK(currency='USD'),
  provider TEXT NOT NULL CHECK(provider IN ('stripe','smartpay3','smartpay4')),
  provider_reference TEXT NOT NULL,
  department_id TEXT,
  access_starts_at INTEGER NOT NULL,
  access_ends_at INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'paid' CHECK(status IN ('paid','refunded','disputed','void')),
  created_at INTEGER NOT NULL DEFAULT(unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT(unixepoch()),
  UNIQUE(provider,provider_reference)
);
--> statement-breakpoint
INSERT INTO smartlingo_course_package_purchases_smartpay4 SELECT * FROM smartlingo_course_package_purchases;
--> statement-breakpoint
DROP TABLE smartlingo_course_package_purchases;
--> statement-breakpoint
ALTER TABLE smartlingo_course_package_purchases_smartpay4 RENAME TO smartlingo_course_package_purchases;
--> statement-breakpoint
CREATE UNIQUE INDEX smartlingo_course_package_purchase_provider_uq
  ON smartlingo_course_package_purchases(provider,provider_reference);
--> statement-breakpoint
CREATE INDEX smartlingo_course_package_purchase_user_idx
  ON smartlingo_course_package_purchases(user_id,target_language,package_tier,access_ends_at DESC);
--> statement-breakpoint
CREATE INDEX smartlingo_course_package_purchase_class_idx
  ON smartlingo_course_package_purchases(class_id,status,access_ends_at DESC);
--> statement-breakpoint
PRAGMA foreign_keys=ON;
--> statement-breakpoint
PRAGMA optimize;
