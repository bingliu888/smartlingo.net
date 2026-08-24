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
SELECT 'learning-reward-'||feature||'-'||level||'-'||minimum_score,feature,level,minimum_score,
  CASE minimum_score WHEN 95 THEN CASE level WHEN 'beginner' THEN 40 WHEN 'intermediate' THEN 55 ELSE 70 END
    WHEN 80 THEN CASE level WHEN 'beginner' THEN 25 WHEN 'intermediate' THEN 35 ELSE 45 END
    ELSE CASE level WHEN 'beginner' THEN 12 WHEN 'intermediate' THEN 18 ELSE 24 END END,
  'active',unixepoch(),unixepoch()
FROM (
  SELECT 'sprint' AS feature UNION ALL SELECT 'smartcard_practice' UNION ALL
  SELECT 'smartcard_challenge' UNION ALL SELECT 'course'
) features
CROSS JOIN (SELECT 'beginner' AS level UNION ALL SELECT 'intermediate' UNION ALL SELECT 'advanced') levels
CROSS JOIN (SELECT 60 AS minimum_score UNION ALL SELECT 80 UNION ALL SELECT 95) bands;
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
SELECT 'starter_'||language||'_'||level,'smartlingo-language-admin',NULL,language,level,
  upper(substr(language,1,1))||substr(language,2)||' '||upper(substr(level,1,1))||substr(level,2)||' 21-Day SmartCard',2,
  'public','starter-'||language||'-'||level,'active',unixepoch(),unixepoch()
FROM (
  SELECT 'zh' AS language UNION ALL SELECT 'en' UNION ALL SELECT 'es' UNION ALL SELECT 'ja' UNION ALL
  SELECT 'ko' UNION ALL SELECT 'fr' UNION ALL SELECT 'de' UNION ALL SELECT 'ru' UNION ALL
  SELECT 'it' UNION ALL SELECT 'pt' UNION ALL SELECT 'ar' UNION ALL SELECT 'hi'
) languages
CROSS JOIN (SELECT 'intermediate' AS level UNION ALL SELECT 'advanced') levels;
--> statement-breakpoint
PRAGMA optimize;
