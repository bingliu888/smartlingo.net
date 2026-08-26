ALTER TABLE crypto_payment_settings ADD COLUMN smartpay3_contract TEXT;
--> statement-breakpoint
ALTER TABLE crypto_payment_settings ADD COLUMN smartpay3_usdt_percent INTEGER NOT NULL DEFAULT 50 CHECK(smartpay3_usdt_percent BETWEEN 0 AND 100);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS smartpay_ref_ids (
  user_id TEXT PRIMARY KEY NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ref_id TEXT NOT NULL COLLATE NOCASE UNIQUE CHECK(length(ref_id)=6),
  created_at INTEGER NOT NULL DEFAULT(unixepoch())
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS smartpay_wallet_bindings (
  wallet_address TEXT PRIMARY KEY NOT NULL COLLATE NOCASE,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  updated_at INTEGER NOT NULL DEFAULT(unixepoch())
);
--> statement-breakpoint

INSERT OR IGNORE INTO smartpay_wallet_bindings(wallet_address,user_id,updated_at)
SELECT lower(wallet_address),id,unixepoch() FROM users
WHERE wallet_address IS NOT NULL AND wallet_address!=''
GROUP BY lower(wallet_address) HAVING count(*)=1;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS smartpay3_payment_claims (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  setting_id TEXT NOT NULL REFERENCES crypto_payment_settings(id),
  contract_address TEXT NOT NULL,
  transaction_id TEXT NOT NULL,
  payer_wallet TEXT NOT NULL,
  ref_id TEXT NOT NULL COLLATE NOCASE,
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
CREATE INDEX IF NOT EXISTS smartpay3_course_claims_user_idx ON smartpay3_payment_claims(user_id,verified_at DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS smartpay3_course_claims_ref_idx ON smartpay3_payment_claims(ref_id,verified_at DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS smartpay3_course_claims_wallet_idx ON smartpay3_payment_claims(payer_wallet,verified_at DESC);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS smartpay_source_publications (
  id TEXT PRIMARY KEY NOT NULL,
  chain_id INTEGER NOT NULL CHECK(chain_id > 0),
  contract_address TEXT NOT NULL,
  deployment_tx_hash TEXT NOT NULL,
  compiler_version TEXT NOT NULL,
  source_code TEXT NOT NULL,
  standard_json_input TEXT NOT NULL,
  sourcify_verification_id TEXT,
  explorer_verification_id TEXT,
  published_by_admin_user_id TEXT NOT NULL REFERENCES users(id),
  published_at INTEGER NOT NULL,
  sourcify_message TEXT,
  explorer_message TEXT,
  explorer_verified INTEGER NOT NULL DEFAULT 0,
  verification_updated_at INTEGER,
  UNIQUE(chain_id,contract_address)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS smartlingo_smartpay_publications_admin_idx
  ON smartpay_source_publications(published_by_admin_user_id,published_at DESC);
--> statement-breakpoint
PRAGMA optimize;
