-- SmartLingo Gold v2 identity freshness, bounded request accounting, and
-- shared payer-wallet semantics. A payer wallet is a payment instrument, not
-- an account identity: SmartPay3 attributes credit with the account RefID.

ALTER TABLE users ADD COLUMN clerk_identity_checked_at INTEGER NOT NULL DEFAULT 0
  CHECK(clerk_identity_checked_at >= 0);
ALTER TABLE users ADD COLUMN clerk_identity_refresh_claim_token TEXT;
ALTER TABLE users ADD COLUMN clerk_identity_refresh_claimed_until INTEGER NOT NULL DEFAULT 0
  CHECK(clerk_identity_refresh_claimed_until >= 0);

CREATE INDEX IF NOT EXISTS smartlingo_users_email_nocase_idx
  ON users(email COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS smartlingo_sessions_expiry_sweep_idx
  ON sessions(expires_at,id);

CREATE TABLE smartpay_wallet_bindings_gold_v2 (
  user_id TEXT PRIMARY KEY NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  wallet_address TEXT NOT NULL COLLATE NOCASE,
  updated_at INTEGER NOT NULL
);
INSERT OR REPLACE INTO smartpay_wallet_bindings_gold_v2(user_id,wallet_address,updated_at)
SELECT user_id,lower(wallet_address),updated_at FROM smartpay_wallet_bindings;
DROP TABLE smartpay_wallet_bindings;
ALTER TABLE smartpay_wallet_bindings_gold_v2 RENAME TO smartpay_wallet_bindings;
CREATE INDEX smartlingo_smartpay_wallet_lookup_idx
  ON smartpay_wallet_bindings(wallet_address,updated_at DESC,user_id);

CREATE TABLE account_request_limits (
  scope TEXT NOT NULL,
  actor_key TEXT NOT NULL,
  window_started_at INTEGER NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 1 CHECK(request_count >= 1),
  blocked_until INTEGER NOT NULL DEFAULT 0 CHECK(blocked_until >= 0),
  updated_at INTEGER NOT NULL,
  PRIMARY KEY(scope,actor_key)
) WITHOUT ROWID;
CREATE INDEX account_request_limits_cleanup_idx
  ON account_request_limits(updated_at,scope,actor_key);

CREATE TABLE member_ai_daily_quotas (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  quota_kind TEXT NOT NULL,
  usage_day INTEGER NOT NULL CHECK(usage_day >= 0),
  used_count INTEGER NOT NULL CHECK(used_count >= 1),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY(user_id,quota_kind)
) WITHOUT ROWID;

CREATE TABLE worker_maintenance_cursors (
  task TEXT PRIMARY KEY NOT NULL,
  cursor_value TEXT NOT NULL DEFAULT '',
  updated_at INTEGER NOT NULL,
  CHECK(length(task) BETWEEN 1 AND 80),
  CHECK(length(cursor_value) <= 200)
);
