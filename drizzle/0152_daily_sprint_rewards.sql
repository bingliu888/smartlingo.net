CREATE TABLE smartlingo_daily_sprint_runs (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  class_id TEXT NOT NULL REFERENCES smartlingo_language_classes(id) ON DELETE RESTRICT,
  target_language TEXT NOT NULL,
  level TEXT NOT NULL CHECK(level IN ('beginner','intermediate','advanced')),
  duration_minutes INTEGER NOT NULL CHECK(duration_minutes IN (5,10,15,20)),
  round_count INTEGER NOT NULL CHECK(round_count BETWEEN 1 AND 4),
  local_date TEXT NOT NULL CHECK(length(local_date)=10),
  time_zone TEXT NOT NULL,
  plan_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK(status IN ('in_progress','completed','abandoned')),
  score INTEGER CHECK(score BETWEEN 0 AND 100),
  skill_scores_json TEXT,
  started_at INTEGER NOT NULL,
  completed_at INTEGER
);
CREATE INDEX smartlingo_daily_sprint_rank_idx ON smartlingo_daily_sprint_runs(target_language,local_date,status,score DESC,completed_at ASC);
CREATE INDEX smartlingo_daily_sprint_user_idx ON smartlingo_daily_sprint_runs(user_id,started_at DESC);
--> statement-breakpoint
CREATE TABLE smartlingo_digital_reward_items (
  id TEXT PRIMARY KEY NOT NULL,
  title_zh TEXT NOT NULL,
  title_en TEXT NOT NULL,
  description_zh TEXT NOT NULL,
  description_en TEXT NOT NULL,
  icon TEXT NOT NULL,
  points INTEGER NOT NULL CHECK(points BETWEEN 1 AND 100000),
  item_type TEXT NOT NULL CHECK(item_type IN ('profile_badge','course_theme','certificate_frame','avatar_frame')),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','retired')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
INSERT INTO smartlingo_digital_reward_items(id,title_zh,title_en,description_zh,description_en,icon,points,item_type,status,sort_order,created_at,updated_at) VALUES
('reward-badge-sprinter','速成达人徽章','Quick Learner Badge','显示在个人学习档案中的速成达人徽章。','A Quick Learner badge for your learning profile.','⚡',120,'profile_badge','active',1,unixepoch(),unixepoch()),
('reward-theme-garden','智慧花园主题','Smart Garden Theme','课程学习页的智慧花园数字主题。','A Smart Garden digital theme for course learning.','✿',240,'course_theme','active',2,unixepoch(),unixepoch()),
('reward-frame-emerald','翡翠头像框','Emerald Avatar Frame','个人头像的翡翠色数字边框。','An emerald digital frame for your profile avatar.','◇',360,'avatar_frame','active',3,unixepoch(),unixepoch()),
('reward-cert-starlight','星光证书框','Starlight Certificate Frame','为 SmartLingo 电子证书添加星光边框。','A starlight frame for SmartLingo digital certificates.','★',500,'certificate_frame','active',4,unixepoch(),unixepoch()),
('reward-theme-night','夜空学习主题','Night Study Theme','课程学习页的夜空数字主题。','A night-sky digital theme for course learning.','☾',650,'course_theme','active',5,unixepoch(),unixepoch()),
('reward-badge-polyglot','多语学习者徽章','Polyglot Badge','显示在个人学习档案中的多语学习者徽章。','A Polyglot badge for your learning profile.','∞',900,'profile_badge','active',6,unixepoch(),unixepoch());
--> statement-breakpoint
CREATE TABLE smartlingo_digital_reward_redemptions (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  item_id TEXT NOT NULL REFERENCES smartlingo_digital_reward_items(id) ON DELETE RESTRICT,
  points INTEGER NOT NULL CHECK(points > 0),
  status TEXT NOT NULL DEFAULT 'owned' CHECK(status IN ('owned','reversed')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX smartlingo_digital_reward_owner_uq ON smartlingo_digital_reward_redemptions(user_id,item_id) WHERE status='owned';
--> statement-breakpoint
DROP TRIGGER smartlingo_course_credit_challenge_insert_trg;
DROP TRIGGER smartlingo_course_credit_game_insert_trg;
DROP TRIGGER smartlingo_course_credit_winner_insert_trg;
DROP TRIGGER smartlingo_course_credit_balance_insert_trg;
ALTER TABLE smartlingo_course_credit_ledger RENAME TO smartlingo_course_credit_ledger_v3;
CREATE TABLE smartlingo_course_credit_ledger (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  points INTEGER NOT NULL CHECK(points != 0),
  entry_type TEXT NOT NULL CHECK(entry_type IN ('challenge_earn','smartcard_game_earn','smartcard_winner_earn','course_redeem','digital_redeem','redemption_release','admin_adjustment','reversal')),
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  local_date TEXT NOT NULL,
  related_entry_id TEXT REFERENCES smartlingo_course_credit_ledger(id) ON DELETE RESTRICT,
  note TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);
INSERT INTO smartlingo_course_credit_ledger(id,user_id,points,entry_type,source_type,source_id,local_date,related_entry_id,note,created_at)
SELECT id,user_id,points,entry_type,source_type,source_id,local_date,related_entry_id,note,created_at FROM smartlingo_course_credit_ledger_v3;
DROP TABLE smartlingo_course_credit_ledger_v3;
CREATE UNIQUE INDEX smartlingo_course_credit_source_uq ON smartlingo_course_credit_ledger(user_id,source_type,source_id);
CREATE INDEX smartlingo_course_credit_user_idx ON smartlingo_course_credit_ledger(user_id,created_at);
CREATE TRIGGER smartlingo_course_credit_challenge_insert_trg BEFORE INSERT ON smartlingo_course_credit_ledger
FOR EACH ROW WHEN NEW.entry_type='challenge_earn' AND (NEW.points!=10 OR NOT EXISTS (
  SELECT 1 FROM smartlingo_smartcard_challenge_attempts attempt JOIN smartlingo_smartcard_decks deck ON deck.id=attempt.deck_id
  WHERE attempt.id=NEW.source_id AND attempt.challenger_user_id=NEW.user_id AND attempt.passed=1 AND attempt.reward_points=10 AND deck.owner_user_id!=NEW.user_id
) OR COALESCE((SELECT SUM(points) FROM smartlingo_course_credit_ledger WHERE user_id=NEW.user_id AND entry_type='challenge_earn' AND local_date=NEW.local_date),0)+NEW.points>50)
BEGIN SELECT RAISE(ABORT,'invalid or capped SmartCard challenge reward'); END;
CREATE TRIGGER smartlingo_course_credit_game_insert_trg BEFORE INSERT ON smartlingo_course_credit_ledger
FOR EACH ROW WHEN NEW.entry_type='smartcard_game_earn' AND (NEW.source_type!='smartcard_game' OR NOT EXISTS (
  SELECT 1 FROM smartlingo_smartcard_game_runs run JOIN smartlingo_smartcard_decks deck ON deck.id=run.deck_id
  WHERE run.id=NEW.source_id AND run.claim_status='claimed' AND run.claimed_user_id=NEW.user_id AND run.game_mode='practice'
    AND run.score=NEW.points AND run.score>0 AND run.local_date=NEW.local_date AND deck.owner_user_id!=NEW.user_id
)) BEGIN SELECT RAISE(ABORT,'invalid SmartCard practice reward'); END;
CREATE TRIGGER smartlingo_course_credit_winner_insert_trg BEFORE INSERT ON smartlingo_course_credit_ledger
FOR EACH ROW WHEN NEW.entry_type='smartcard_winner_earn' AND (NEW.source_type!='smartcard_daily_winner' OR NOT EXISTS (
  SELECT 1 FROM smartlingo_smartcard_daily_settlements settlement WHERE settlement.id=NEW.source_id AND settlement.winner_user_id=NEW.user_id
    AND settlement.reward_points=NEW.points AND settlement.local_date=NEW.local_date
)) BEGIN SELECT RAISE(ABORT,'invalid SmartCard winner reward'); END;
CREATE TRIGGER smartlingo_course_credit_digital_insert_trg BEFORE INSERT ON smartlingo_course_credit_ledger
FOR EACH ROW WHEN NEW.entry_type='digital_redeem' AND (NEW.points>=0 OR NEW.source_type!='digital_reward' OR NOT EXISTS (
  SELECT 1 FROM smartlingo_digital_reward_redemptions redemption WHERE redemption.id=NEW.source_id AND redemption.user_id=NEW.user_id
    AND redemption.points=-NEW.points AND redemption.status='owned'
)) BEGIN SELECT RAISE(ABORT,'invalid digital reward redemption'); END;
CREATE TRIGGER smartlingo_course_credit_balance_insert_trg BEFORE INSERT ON smartlingo_course_credit_ledger
FOR EACH ROW WHEN NEW.points<0 AND COALESCE((SELECT SUM(points) FROM smartlingo_course_credit_ledger WHERE user_id=NEW.user_id),0)+NEW.points<0
BEGIN SELECT RAISE(ABORT,'insufficient SmartLingo course credit'); END;
--> statement-breakpoint
PRAGMA optimize;
