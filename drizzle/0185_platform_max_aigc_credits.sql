-- Standard is free with ads. Max is a fixed-term, non-renewing platform plan.
-- AIGC credits are prepaid and independent from course credit.
CREATE TABLE smartlingo_platform_checkout_intents (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK(provider IN ('stripe','smartpay5')),
  product_id TEXT NOT NULL CHECK(product_id IN ('max_6m','max_12m','aigc_1000')),
  amount_cents INTEGER NOT NULL CHECK(amount_cents>0),
  currency TEXT NOT NULL DEFAULT 'usd',
  idempotency_key TEXT NOT NULL UNIQUE,
  provider_session_id TEXT UNIQUE,
  checkout_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','paid','expired','cancelled','refunded','disputed')),
  expires_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX smartlingo_platform_checkout_pending_user_uq
  ON smartlingo_platform_checkout_intents(user_id) WHERE status='pending';
CREATE INDEX smartlingo_platform_checkout_user_created_idx
  ON smartlingo_platform_checkout_intents(user_id,created_at DESC);

CREATE TABLE smartlingo_aigc_credit_accounts (
  user_id TEXT PRIMARY KEY NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  balance INTEGER NOT NULL DEFAULT 0 CHECK(balance>=0),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE smartlingo_aigc_credit_ledger (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  delta INTEGER NOT NULL CHECK(delta<>0),
  balance_after INTEGER NOT NULL CHECK(balance_after>=0),
  reason TEXT NOT NULL,
  provider_reference TEXT NOT NULL UNIQUE,
  metadata_json TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX smartlingo_aigc_credit_ledger_user_created_idx
  ON smartlingo_aigc_credit_ledger(user_id,created_at DESC);
INSERT INTO smartlingo_aigc_credit_accounts(user_id,balance,created_at,updated_at)
SELECT id,0,created_at,CAST(strftime('%s','now') AS INTEGER) FROM users;

CREATE TABLE smartlingo_platform_smartpay_claims (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  setting_id TEXT NOT NULL,
  contract_address TEXT NOT NULL,
  transaction_id TEXT NOT NULL,
  payer_wallet TEXT NOT NULL,
  payer_id TEXT NOT NULL,
  ref_id TEXT NOT NULL,
  main_id TEXT NOT NULL,
  second_id TEXT NOT NULL,
  product_id TEXT NOT NULL CHECK(product_id IN ('max_6m','max_12m','aigc_1000')),
  primary_token_symbol TEXT NOT NULL,
  primary_token_address TEXT NOT NULL,
  primary_atomic_amount TEXT NOT NULL,
  secondary_token_symbol TEXT,
  secondary_token_address TEXT NOT NULL,
  secondary_atomic_amount TEXT NOT NULL,
  entitlement_status TEXT NOT NULL DEFAULT 'pending_sync' CHECK(entitlement_status IN ('pending_sync','synced')),
  current_period_ends_at INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  verified_at INTEGER NOT NULL,
  UNIQUE(contract_address,transaction_id)
);
CREATE INDEX smartlingo_platform_smartpay_user_idx
  ON smartlingo_platform_smartpay_claims(user_id,verified_at DESC);

-- Clerk remains the canonical member identity. Keep every newly introduced
-- account-owned row attached during the existing atomic user-ID recovery path.
CREATE TRIGGER smartlingo_platform_commerce_users_clerk_id_rekey
AFTER UPDATE OF id ON users
FOR EACH ROW WHEN OLD.id<>NEW.id
BEGIN
  UPDATE smartlingo_platform_checkout_intents SET user_id=NEW.id WHERE user_id=OLD.id;
  UPDATE smartlingo_aigc_credit_accounts SET user_id=NEW.id WHERE user_id=OLD.id;
  UPDATE smartlingo_aigc_credit_ledger SET user_id=NEW.id WHERE user_id=OLD.id;
  UPDATE smartlingo_platform_smartpay_claims SET user_id=NEW.id WHERE user_id=OLD.id;
END;
