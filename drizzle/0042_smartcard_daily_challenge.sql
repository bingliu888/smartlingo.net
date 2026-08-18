ALTER TABLE smartlingo_smartcard_game_runs ADD COLUMN leader_bonus_basis_points INTEGER NOT NULL DEFAULT 0 CHECK(leader_bonus_basis_points IN (0,1000));
--> statement-breakpoint
CREATE TABLE smartlingo_smartcard_timed_sessions (
  id TEXT PRIMARY KEY NOT NULL,
  guest_key_hash TEXT NOT NULL,
  deck_id TEXT NOT NULL REFERENCES smartlingo_smartcard_decks(id) ON DELETE RESTRICT,
  deck_version INTEGER NOT NULL CHECK(deck_version > 0),
  local_date TEXT NOT NULL CHECK(length(local_date)=10),
  current_index INTEGER NOT NULL DEFAULT 0 CHECK(current_index >= 0),
  correct_count INTEGER NOT NULL DEFAULT 0 CHECK(correct_count >= 0),
  question_started_ms INTEGER NOT NULL,
  completed_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX smartlingo_smartcard_timed_guest_uq ON smartlingo_smartcard_timed_sessions(guest_key_hash,deck_id,deck_version,local_date);
--> statement-breakpoint
CREATE TABLE smartlingo_smartcard_daily_settlements (
  id TEXT PRIMARY KEY NOT NULL,
  target_language TEXT NOT NULL,
  local_date TEXT NOT NULL CHECK(length(local_date)=10),
  winner_run_id TEXT NOT NULL REFERENCES smartlingo_smartcard_game_runs(id) ON DELETE RESTRICT,
  winner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  winning_score INTEGER NOT NULL CHECK(winning_score BETWEEN 1 AND 100),
  reward_points INTEGER NOT NULL CHECK(reward_points BETWEEN 1 AND 110),
  settled_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX smartlingo_smartcard_daily_settlement_uq ON smartlingo_smartcard_daily_settlements(target_language,local_date);
--> statement-breakpoint
DROP TRIGGER smartlingo_course_credit_challenge_insert_trg;
DROP TRIGGER smartlingo_course_credit_game_insert_trg;
DROP TRIGGER smartlingo_course_credit_balance_insert_trg;
ALTER TABLE smartlingo_course_credit_ledger RENAME TO smartlingo_course_credit_ledger_v2;
CREATE TABLE smartlingo_course_credit_ledger (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  points INTEGER NOT NULL CHECK(points != 0),
  entry_type TEXT NOT NULL CHECK(entry_type IN ('challenge_earn','smartcard_game_earn','smartcard_winner_earn','course_redeem','redemption_release','admin_adjustment','reversal')),
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  local_date TEXT NOT NULL,
  related_entry_id TEXT REFERENCES smartlingo_course_credit_ledger(id) ON DELETE RESTRICT,
  note TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);
INSERT INTO smartlingo_course_credit_ledger(id,user_id,points,entry_type,source_type,source_id,local_date,related_entry_id,note,created_at)
SELECT id,user_id,points,entry_type,source_type,source_id,local_date,related_entry_id,note,created_at FROM smartlingo_course_credit_ledger_v2;
DROP TABLE smartlingo_course_credit_ledger_v2;
CREATE UNIQUE INDEX smartlingo_course_credit_source_uq ON smartlingo_course_credit_ledger(user_id,source_type,source_id);
CREATE INDEX smartlingo_course_credit_user_idx ON smartlingo_course_credit_ledger(user_id,created_at);
CREATE TRIGGER smartlingo_course_credit_challenge_insert_trg
BEFORE INSERT ON smartlingo_course_credit_ledger
FOR EACH ROW WHEN NEW.entry_type='challenge_earn' AND (
  NEW.points != 10 OR NOT EXISTS (
    SELECT 1 FROM smartlingo_smartcard_challenge_attempts attempt JOIN smartlingo_smartcard_decks deck ON deck.id=attempt.deck_id
    WHERE attempt.id=NEW.source_id AND attempt.challenger_user_id=NEW.user_id AND attempt.passed=1 AND attempt.reward_points=10 AND deck.owner_user_id!=NEW.user_id
  ) OR COALESCE((SELECT SUM(points) FROM smartlingo_course_credit_ledger WHERE user_id=NEW.user_id AND entry_type='challenge_earn' AND local_date=NEW.local_date),0)+NEW.points>50
)
BEGIN SELECT RAISE(ABORT,'invalid or capped SmartCard challenge reward'); END;
CREATE TRIGGER smartlingo_course_credit_game_insert_trg
BEFORE INSERT ON smartlingo_course_credit_ledger
FOR EACH ROW WHEN NEW.entry_type='smartcard_game_earn' AND (
  NEW.source_type!='smartcard_game' OR NOT EXISTS (
    SELECT 1 FROM smartlingo_smartcard_game_runs run JOIN smartlingo_smartcard_decks deck ON deck.id=run.deck_id
    WHERE run.id=NEW.source_id AND run.claim_status='claimed' AND run.claimed_user_id=NEW.user_id AND run.game_mode='practice'
      AND run.score=NEW.points AND run.score>0 AND run.local_date=NEW.local_date AND deck.owner_user_id!=NEW.user_id
  )
)
BEGIN SELECT RAISE(ABORT,'invalid SmartCard practice reward'); END;
CREATE TRIGGER smartlingo_course_credit_winner_insert_trg
BEFORE INSERT ON smartlingo_course_credit_ledger
FOR EACH ROW WHEN NEW.entry_type='smartcard_winner_earn' AND (
  NEW.source_type!='smartcard_daily_winner' OR NOT EXISTS (
    SELECT 1 FROM smartlingo_smartcard_daily_settlements settlement
    WHERE settlement.id=NEW.source_id AND settlement.winner_user_id=NEW.user_id AND settlement.reward_points=NEW.points AND settlement.local_date=NEW.local_date
  )
)
BEGIN SELECT RAISE(ABORT,'invalid SmartCard winner reward'); END;
CREATE TRIGGER smartlingo_course_credit_balance_insert_trg
BEFORE INSERT ON smartlingo_course_credit_ledger
FOR EACH ROW WHEN NEW.points<0 AND COALESCE((SELECT SUM(points) FROM smartlingo_course_credit_ledger WHERE user_id=NEW.user_id),0)+NEW.points<0
BEGIN SELECT RAISE(ABORT,'insufficient SmartLingo course credit'); END;
--> statement-breakpoint
PRAGMA optimize;
