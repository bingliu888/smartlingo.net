CREATE TABLE smartpay5_payment_item_states (
  chain_id INTEGER NOT NULL,
  preset_key TEXT NOT NULL,
  preset_fingerprint TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0, 1)),
  updated_by_admin_id TEXT NOT NULL,
  confirmed_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (chain_id, preset_key)
);

CREATE INDEX smartpay5_payment_item_states_chain_idx
  ON smartpay5_payment_item_states(chain_id, enabled, updated_at DESC);
