-- SmartPay5 replaces SmartPay4 so fee-on-transfer tokens such as GLC may burn
-- part of each nominal payout without reverting the payment. Preserve claims
-- and purchase history; require a fresh site-owned SmartPay5 deployment.
ALTER TABLE crypto_payment_settings ADD COLUMN smartpay5_contract TEXT;
--> statement-breakpoint
ALTER TABLE crypto_payment_settings ADD COLUMN smartpay5_usdt_percent INTEGER NOT NULL DEFAULT 50
  CHECK(smartpay5_usdt_percent BETWEEN 0 AND 100);
--> statement-breakpoint
UPDATE crypto_payment_settings SET smartpay5_usdt_percent=smartpay4_usdt_percent;
--> statement-breakpoint
ALTER TABLE crypto_payment_settings DROP COLUMN smartpay4_contract;
--> statement-breakpoint
ALTER TABLE crypto_payment_settings DROP COLUMN smartpay4_usdt_percent;
--> statement-breakpoint

ALTER TABLE smartpay4_payment_claims RENAME TO smartpay5_payment_claims;
--> statement-breakpoint
DROP INDEX smartpay4_course_claims_user_idx;
--> statement-breakpoint
DROP INDEX smartpay4_course_claims_payer_idx;
--> statement-breakpoint
DROP INDEX smartpay4_course_claims_owner_idx;
--> statement-breakpoint
CREATE INDEX smartpay5_course_claims_user_idx ON smartpay5_payment_claims(user_id,verified_at DESC);
--> statement-breakpoint
CREATE INDEX smartpay5_course_claims_payer_idx ON smartpay5_payment_claims(payer_id,verified_at DESC);
--> statement-breakpoint
CREATE INDEX smartpay5_course_claims_owner_idx ON smartpay5_payment_claims(ref_id,verified_at DESC);
--> statement-breakpoint

PRAGMA foreign_keys=OFF;
--> statement-breakpoint
CREATE TABLE smartlingo_course_package_purchases_smartpay5 (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  class_id TEXT NOT NULL REFERENCES smartlingo_language_classes(id) ON DELETE RESTRICT,
  target_language TEXT NOT NULL CHECK(target_language IN ('zh','en','es','ja','ko','fr','de','ru','it','pt','ar','hi')),
  package_id TEXT NOT NULL REFERENCES smartlingo_course_packages(id) ON DELETE RESTRICT,
  package_tier TEXT NOT NULL CHECK(package_tier IN ('basic','intermediate','advanced')),
  duration_months INTEGER NOT NULL CHECK(duration_months IN (3,6,12)),
  price_cents INTEGER NOT NULL CHECK(price_cents > 0),
  currency TEXT NOT NULL DEFAULT 'USD' CHECK(currency='USD'),
  provider TEXT NOT NULL CHECK(provider IN ('stripe','smartpay3','smartpay4','smartpay5')),
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
INSERT INTO smartlingo_course_package_purchases_smartpay5 SELECT * FROM smartlingo_course_package_purchases;
--> statement-breakpoint
DROP TABLE smartlingo_course_package_purchases;
--> statement-breakpoint
ALTER TABLE smartlingo_course_package_purchases_smartpay5 RENAME TO smartlingo_course_package_purchases;
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
