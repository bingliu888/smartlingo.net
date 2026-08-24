CREATE TABLE IF NOT EXISTS smartlingo_smartcard_practice_sessions (
  id TEXT PRIMARY KEY,
  subject_key TEXT NOT NULL,
  deck_id TEXT NOT NULL,
  deck_version INTEGER NOT NULL,
  current_index INTEGER NOT NULL DEFAULT 0 CHECK(current_index >= 0),
  points INTEGER NOT NULL DEFAULT 100 CHECK(points >= 0 AND points <= 850),
  evidence_json TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(evidence_json)),
  completed_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY(deck_id) REFERENCES smartlingo_smartcard_decks(id) ON DELETE CASCADE,
  UNIQUE(subject_key, deck_id, deck_version)
);

CREATE INDEX IF NOT EXISTS idx_smartlingo_smartcard_practice_resume
  ON smartlingo_smartcard_practice_sessions(subject_key, updated_at DESC);
