CREATE TABLE IF NOT EXISTS smartlingo_daily_sprint_runs (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  class_id TEXT NOT NULL REFERENCES smartlingo_language_classes(id) ON DELETE RESTRICT,
  target_language TEXT NOT NULL,
  level TEXT NOT NULL CHECK(level IN ('beginner','intermediate','advanced')),
  duration_minutes INTEGER NOT NULL CHECK(duration_minutes IN (5,10,15,20)),
  round_count INTEGER NOT NULL CHECK(round_count BETWEEN 1 AND 4),
  local_date TEXT NOT NULL CHECK(length(local_date)=10),
  time_zone TEXT NOT NULL,
  plan_json TEXT NOT NULL CHECK(json_valid(plan_json)),
  progress_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(progress_json)),
  checkpointed_at INTEGER,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK(status IN ('in_progress','completed','abandoned')),
  score INTEGER CHECK(score BETWEEN 0 AND 100),
  skill_scores_json TEXT CHECK(skill_scores_json IS NULL OR json_valid(skill_scores_json)),
  started_at INTEGER NOT NULL,
  completed_at INTEGER
);
CREATE INDEX IF NOT EXISTS smartlingo_daily_sprint_rank_idx ON smartlingo_daily_sprint_runs(target_language,local_date,status,score DESC,completed_at ASC);
CREATE INDEX IF NOT EXISTS smartlingo_daily_sprint_user_idx ON smartlingo_daily_sprint_runs(user_id,started_at DESC);
CREATE INDEX IF NOT EXISTS smartlingo_daily_sprint_resume_idx ON smartlingo_daily_sprint_runs(user_id,class_id,status,started_at DESC);
CREATE TABLE smartlingo_daily_sprint_run_days (
  run_id TEXT PRIMARY KEY NOT NULL REFERENCES smartlingo_daily_sprint_runs(id) ON DELETE CASCADE,
  day_number INTEGER NOT NULL CHECK(day_number BETWEEN 1 AND 21),
  created_at INTEGER NOT NULL
);
CREATE INDEX smartlingo_daily_sprint_run_day_idx ON smartlingo_daily_sprint_run_days(day_number,run_id);
CREATE TABLE smartlingo_smartcard_practice_session_days (
  subject_key TEXT NOT NULL,
  deck_id TEXT NOT NULL REFERENCES smartlingo_smartcard_decks(id) ON DELETE CASCADE,
  deck_version INTEGER NOT NULL CHECK(deck_version>0),
  day_number INTEGER NOT NULL CHECK(day_number BETWEEN 1 AND 21),
  updated_at INTEGER NOT NULL,
  PRIMARY KEY(subject_key,deck_id,deck_version)
);
CREATE INDEX smartlingo_smartcard_practice_day_idx ON smartlingo_smartcard_practice_session_days(deck_id,day_number,updated_at DESC);
--> statement-breakpoint
CREATE TABLE smartlingo_learning_reward_rules (
  id TEXT PRIMARY KEY NOT NULL,
  feature TEXT NOT NULL CHECK(feature IN ('sprint','smartcard_practice','smartcard_challenge','course')),
  level TEXT NOT NULL CHECK(level IN ('beginner','intermediate','advanced')),
  minimum_score INTEGER NOT NULL CHECK(minimum_score BETWEEN 0 AND 100),
  reward_points INTEGER NOT NULL CHECK(reward_points BETWEEN 0 AND 100000),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','disabled')),
  updated_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(feature,level,minimum_score)
);
INSERT INTO smartlingo_learning_reward_rules(id,feature,level,minimum_score,reward_points,status,created_at,updated_at)
VALUES
('learning-reward-sprint-beginner-60','sprint','beginner',60,12,'active',unixepoch(),unixepoch()),
('learning-reward-sprint-beginner-80','sprint','beginner',80,25,'active',unixepoch(),unixepoch()),
('learning-reward-sprint-beginner-95','sprint','beginner',95,40,'active',unixepoch(),unixepoch()),
('learning-reward-sprint-intermediate-60','sprint','intermediate',60,18,'active',unixepoch(),unixepoch()),
('learning-reward-sprint-intermediate-80','sprint','intermediate',80,35,'active',unixepoch(),unixepoch()),
('learning-reward-sprint-intermediate-95','sprint','intermediate',95,55,'active',unixepoch(),unixepoch()),
('learning-reward-sprint-advanced-60','sprint','advanced',60,24,'active',unixepoch(),unixepoch()),
('learning-reward-sprint-advanced-80','sprint','advanced',80,45,'active',unixepoch(),unixepoch()),
('learning-reward-sprint-advanced-95','sprint','advanced',95,70,'active',unixepoch(),unixepoch()),
('learning-reward-smartcard_practice-beginner-60','smartcard_practice','beginner',60,12,'active',unixepoch(),unixepoch()),
('learning-reward-smartcard_practice-beginner-80','smartcard_practice','beginner',80,25,'active',unixepoch(),unixepoch()),
('learning-reward-smartcard_practice-beginner-95','smartcard_practice','beginner',95,40,'active',unixepoch(),unixepoch()),
('learning-reward-smartcard_practice-intermediate-60','smartcard_practice','intermediate',60,18,'active',unixepoch(),unixepoch()),
('learning-reward-smartcard_practice-intermediate-80','smartcard_practice','intermediate',80,35,'active',unixepoch(),unixepoch()),
('learning-reward-smartcard_practice-intermediate-95','smartcard_practice','intermediate',95,55,'active',unixepoch(),unixepoch()),
('learning-reward-smartcard_practice-advanced-60','smartcard_practice','advanced',60,24,'active',unixepoch(),unixepoch()),
('learning-reward-smartcard_practice-advanced-80','smartcard_practice','advanced',80,45,'active',unixepoch(),unixepoch()),
('learning-reward-smartcard_practice-advanced-95','smartcard_practice','advanced',95,70,'active',unixepoch(),unixepoch()),
('learning-reward-smartcard_challenge-beginner-60','smartcard_challenge','beginner',60,12,'active',unixepoch(),unixepoch()),
('learning-reward-smartcard_challenge-beginner-80','smartcard_challenge','beginner',80,25,'active',unixepoch(),unixepoch()),
('learning-reward-smartcard_challenge-beginner-95','smartcard_challenge','beginner',95,40,'active',unixepoch(),unixepoch()),
('learning-reward-smartcard_challenge-intermediate-60','smartcard_challenge','intermediate',60,18,'active',unixepoch(),unixepoch()),
('learning-reward-smartcard_challenge-intermediate-80','smartcard_challenge','intermediate',80,35,'active',unixepoch(),unixepoch()),
('learning-reward-smartcard_challenge-intermediate-95','smartcard_challenge','intermediate',95,55,'active',unixepoch(),unixepoch()),
('learning-reward-smartcard_challenge-advanced-60','smartcard_challenge','advanced',60,24,'active',unixepoch(),unixepoch()),
('learning-reward-smartcard_challenge-advanced-80','smartcard_challenge','advanced',80,45,'active',unixepoch(),unixepoch()),
('learning-reward-smartcard_challenge-advanced-95','smartcard_challenge','advanced',95,70,'active',unixepoch(),unixepoch()),
('learning-reward-course-beginner-60','course','beginner',60,12,'active',unixepoch(),unixepoch()),
('learning-reward-course-beginner-80','course','beginner',80,25,'active',unixepoch(),unixepoch()),
('learning-reward-course-beginner-95','course','beginner',95,40,'active',unixepoch(),unixepoch()),
('learning-reward-course-intermediate-60','course','intermediate',60,18,'active',unixepoch(),unixepoch()),
('learning-reward-course-intermediate-80','course','intermediate',80,35,'active',unixepoch(),unixepoch()),
('learning-reward-course-intermediate-95','course','intermediate',95,55,'active',unixepoch(),unixepoch()),
('learning-reward-course-advanced-60','course','advanced',60,24,'active',unixepoch(),unixepoch()),
('learning-reward-course-advanced-80','course','advanced',80,45,'active',unixepoch(),unixepoch()),
('learning-reward-course-advanced-95','course','advanced',95,70,'active',unixepoch(),unixepoch());
--> statement-breakpoint
CREATE TABLE smartlingo_learning_score_history (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  feature TEXT NOT NULL CHECK(feature IN ('sprint','smartcard_practice','smartcard_challenge','course')),
  level TEXT NOT NULL CHECK(level IN ('beginner','intermediate','advanced')),
  target_language TEXT NOT NULL,
  class_id TEXT REFERENCES smartlingo_language_classes(id) ON DELETE SET NULL,
  day_number INTEGER NOT NULL CHECK(day_number BETWEEN 1 AND 21),
  score INTEGER NOT NULL CHECK(score BETWEEN 0 AND 100),
  reward_points INTEGER NOT NULL DEFAULT 0 CHECK(reward_points >= 0),
  local_date TEXT NOT NULL CHECK(length(local_date)=10),
  source_id TEXT NOT NULL,
  detail_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(detail_json)),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(user_id,feature,source_id)
);
CREATE INDEX smartlingo_learning_score_user_idx ON smartlingo_learning_score_history(user_id,created_at DESC);
CREATE INDEX smartlingo_learning_score_rank_idx ON smartlingo_learning_score_history(feature,level,target_language,score DESC,created_at ASC);
--> statement-breakpoint
CREATE TABLE smartlingo_smartcard_daily_question_sets (
  id TEXT PRIMARY KEY NOT NULL,
  deck_id TEXT NOT NULL REFERENCES smartlingo_smartcard_decks(id) ON DELETE CASCADE,
  target_language TEXT NOT NULL,
  level TEXT NOT NULL CHECK(level IN ('beginner','intermediate','advanced')),
  local_date TEXT NOT NULL CHECK(length(local_date)=10),
  vocabulary_ids_json TEXT NOT NULL CHECK(json_valid(vocabulary_ids_json)),
  question_count INTEGER NOT NULL DEFAULT 20 CHECK(question_count=20),
  pool_size INTEGER NOT NULL DEFAULT 500 CHECK(pool_size>=20),
  created_at INTEGER NOT NULL,
  UNIQUE(target_language,level,local_date)
);
CREATE INDEX smartlingo_smartcard_daily_set_idx ON smartlingo_smartcard_daily_question_sets(deck_id,local_date DESC);
--> statement-breakpoint
INSERT INTO smartlingo_smartcard_decks(id,owner_user_id,class_id,target_language,level,title,version,visibility,share_token,status,created_at,updated_at)
VALUES
('starter_zh_intermediate','smartlingo-language-admin',NULL,'zh','intermediate','Zh Intermediate 21-Day SmartCard',2,'public','starter-zh-intermediate','active',unixepoch(),unixepoch()),
('starter_zh_advanced','smartlingo-language-admin',NULL,'zh','advanced','Zh Advanced 21-Day SmartCard',2,'public','starter-zh-advanced','active',unixepoch(),unixepoch()),
('starter_en_intermediate','smartlingo-language-admin',NULL,'en','intermediate','En Intermediate 21-Day SmartCard',2,'public','starter-en-intermediate','active',unixepoch(),unixepoch()),
('starter_en_advanced','smartlingo-language-admin',NULL,'en','advanced','En Advanced 21-Day SmartCard',2,'public','starter-en-advanced','active',unixepoch(),unixepoch()),
('starter_es_intermediate','smartlingo-language-admin',NULL,'es','intermediate','Es Intermediate 21-Day SmartCard',2,'public','starter-es-intermediate','active',unixepoch(),unixepoch()),
('starter_es_advanced','smartlingo-language-admin',NULL,'es','advanced','Es Advanced 21-Day SmartCard',2,'public','starter-es-advanced','active',unixepoch(),unixepoch()),
('starter_ja_intermediate','smartlingo-language-admin',NULL,'ja','intermediate','Ja Intermediate 21-Day SmartCard',2,'public','starter-ja-intermediate','active',unixepoch(),unixepoch()),
('starter_ja_advanced','smartlingo-language-admin',NULL,'ja','advanced','Ja Advanced 21-Day SmartCard',2,'public','starter-ja-advanced','active',unixepoch(),unixepoch()),
('starter_ko_intermediate','smartlingo-language-admin',NULL,'ko','intermediate','Ko Intermediate 21-Day SmartCard',2,'public','starter-ko-intermediate','active',unixepoch(),unixepoch()),
('starter_ko_advanced','smartlingo-language-admin',NULL,'ko','advanced','Ko Advanced 21-Day SmartCard',2,'public','starter-ko-advanced','active',unixepoch(),unixepoch()),
('starter_fr_intermediate','smartlingo-language-admin',NULL,'fr','intermediate','Fr Intermediate 21-Day SmartCard',2,'public','starter-fr-intermediate','active',unixepoch(),unixepoch()),
('starter_fr_advanced','smartlingo-language-admin',NULL,'fr','advanced','Fr Advanced 21-Day SmartCard',2,'public','starter-fr-advanced','active',unixepoch(),unixepoch()),
('starter_de_intermediate','smartlingo-language-admin',NULL,'de','intermediate','De Intermediate 21-Day SmartCard',2,'public','starter-de-intermediate','active',unixepoch(),unixepoch()),
('starter_de_advanced','smartlingo-language-admin',NULL,'de','advanced','De Advanced 21-Day SmartCard',2,'public','starter-de-advanced','active',unixepoch(),unixepoch()),
('starter_ru_intermediate','smartlingo-language-admin',NULL,'ru','intermediate','Ru Intermediate 21-Day SmartCard',2,'public','starter-ru-intermediate','active',unixepoch(),unixepoch()),
('starter_ru_advanced','smartlingo-language-admin',NULL,'ru','advanced','Ru Advanced 21-Day SmartCard',2,'public','starter-ru-advanced','active',unixepoch(),unixepoch()),
('starter_it_intermediate','smartlingo-language-admin',NULL,'it','intermediate','It Intermediate 21-Day SmartCard',2,'public','starter-it-intermediate','active',unixepoch(),unixepoch()),
('starter_it_advanced','smartlingo-language-admin',NULL,'it','advanced','It Advanced 21-Day SmartCard',2,'public','starter-it-advanced','active',unixepoch(),unixepoch()),
('starter_pt_intermediate','smartlingo-language-admin',NULL,'pt','intermediate','Pt Intermediate 21-Day SmartCard',2,'public','starter-pt-intermediate','active',unixepoch(),unixepoch()),
('starter_pt_advanced','smartlingo-language-admin',NULL,'pt','advanced','Pt Advanced 21-Day SmartCard',2,'public','starter-pt-advanced','active',unixepoch(),unixepoch()),
('starter_ar_intermediate','smartlingo-language-admin',NULL,'ar','intermediate','Ar Intermediate 21-Day SmartCard',2,'public','starter-ar-intermediate','active',unixepoch(),unixepoch()),
('starter_ar_advanced','smartlingo-language-admin',NULL,'ar','advanced','Ar Advanced 21-Day SmartCard',2,'public','starter-ar-advanced','active',unixepoch(),unixepoch()),
('starter_hi_intermediate','smartlingo-language-admin',NULL,'hi','intermediate','Hi Intermediate 21-Day SmartCard',2,'public','starter-hi-intermediate','active',unixepoch(),unixepoch()),
('starter_hi_advanced','smartlingo-language-admin',NULL,'hi','advanced','Hi Advanced 21-Day SmartCard',2,'public','starter-hi-advanced','active',unixepoch(),unixepoch());
--> statement-breakpoint
PRAGMA optimize;
