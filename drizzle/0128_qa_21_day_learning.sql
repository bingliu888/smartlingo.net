CREATE TABLE IF NOT EXISTS smartlingo_qa_test_accounts (
  user_id TEXT PRIMARY KEY NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  test_key TEXT NOT NULL UNIQUE,
  interface_language TEXT NOT NULL CHECK(interface_language IN ('zh','en')),
  target_languages TEXT NOT NULL CHECK(json_valid(target_languages) AND json_type(target_languages)='array'),
  time_zone TEXT NOT NULL DEFAULT 'America/Los_Angeles',
  starts_on TEXT NOT NULL,
  ends_on TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','completed','disabled')),
  created_at INTEGER NOT NULL DEFAULT(unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT(unixepoch())
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS smartlingo_qa_learning_runs (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES smartlingo_qa_test_accounts(user_id) ON DELETE CASCADE,
  target_language TEXT NOT NULL CHECK(target_language IN ('zh','en','ja','es','it')),
  interface_language TEXT NOT NULL CHECK(interface_language IN ('zh','en')),
  local_date TEXT NOT NULL,
  day_number INTEGER NOT NULL CHECK(day_number BETWEEN 1 AND 21),
  status TEXT NOT NULL CHECK(status IN ('passed','failed')),
  test_mode TEXT NOT NULL DEFAULT 'synthetic_http_and_storage' CHECK(test_mode='synthetic_http_and_storage'),
  route_checks_json TEXT NOT NULL CHECK(json_valid(route_checks_json) AND json_type(route_checks_json)='array'),
  summary_zh TEXT NOT NULL,
  summary_en TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  completed_at INTEGER NOT NULL,
  UNIQUE(user_id,target_language,local_date)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS smartlingo_qa_learning_runs_date_idx
  ON smartlingo_qa_learning_runs(local_date,status,target_language);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS smartlingo_qa_learning_log_items (
  id TEXT PRIMARY KEY NOT NULL,
  run_id TEXT NOT NULL REFERENCES smartlingo_qa_learning_runs(id) ON DELETE CASCADE,
  skill TEXT NOT NULL CHECK(skill IN ('vocabulary','speaking','listening','writing','quiz')),
  score INTEGER NOT NULL CHECK(score BETWEEN 0 AND 100),
  passed INTEGER NOT NULL CHECK(passed IN (0,1)),
  duration_seconds INTEGER NOT NULL CHECK(duration_seconds BETWEEN 1 AND 3600),
  note_zh TEXT NOT NULL,
  note_en TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE(run_id,skill)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS smartlingo_qa_learning_log_items_run_idx
  ON smartlingo_qa_learning_log_items(run_id,skill);
--> statement-breakpoint
INSERT OR IGNORE INTO users
  (id,email,display_name,password_hash,preferred_language,role,created_at)
VALUES
  ('smartlingo-qa-21d-zh','smartlingo-qa-21d-zh@smartlingo.invalid','[QA] 中文界面四语学习者','system-managed-disabled','zh','member',unixepoch()),
  ('smartlingo-qa-21d-en','smartlingo-qa-21d-en@smartlingo.invalid','[QA] English UI four-language learner','system-managed-disabled','en','member',unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO smartlingo_qa_test_accounts
  (user_id,test_key,interface_language,target_languages,time_zone,starts_on,ends_on,status)
VALUES
  ('smartlingo-qa-21d-zh','qa_21d_zh','zh','["en","ja","es","it"]','America/Los_Angeles','2026-08-21','2026-09-10','active'),
  ('smartlingo-qa-21d-en','qa_21d_en','en','["zh","ja","es","it"]','America/Los_Angeles','2026-08-21','2026-09-10','active');
--> statement-breakpoint
WITH qa_courses(user_id,target_language) AS (
  VALUES
    ('smartlingo-qa-21d-zh','en'),('smartlingo-qa-21d-zh','ja'),
    ('smartlingo-qa-21d-zh','es'),('smartlingo-qa-21d-zh','it'),
    ('smartlingo-qa-21d-en','zh'),('smartlingo-qa-21d-en','ja'),
    ('smartlingo-qa-21d-en','es'),('smartlingo-qa-21d-en','it')
)
INSERT OR IGNORE INTO smartlingo_language_class_members
  (id,class_id,user_id,role,status,joined_at,updated_at)
SELECT 'qa21-member-'||user_id||'-'||target_language,
  'course_'||target_language||'_basic',user_id,'student','active',unixepoch(),unixepoch()
FROM qa_courses;
--> statement-breakpoint
WITH qa_courses(user_id,target_language) AS (
  VALUES
    ('smartlingo-qa-21d-zh','en'),('smartlingo-qa-21d-zh','ja'),
    ('smartlingo-qa-21d-zh','es'),('smartlingo-qa-21d-zh','it'),
    ('smartlingo-qa-21d-en','zh'),('smartlingo-qa-21d-en','ja'),
    ('smartlingo-qa-21d-en','es'),('smartlingo-qa-21d-en','it')
)
INSERT OR IGNORE INTO smartlingo_course_subscriptions
  (id,class_id,user_id,status,monthly_price_cents,trial_started_at,trial_ends_at,
   current_period_ends_at,provider_subscription_id,created_at,updated_at)
SELECT 'qa21-sub-'||user_id||'-'||target_language,
  'course_'||target_language||'_basic',user_id,'trialing',2000,unixepoch(),unixepoch()+2678400,
  NULL,NULL,unixepoch(),unixepoch()
FROM qa_courses;
--> statement-breakpoint
WITH qa_courses(user_id,target_language) AS (
  VALUES
    ('smartlingo-qa-21d-zh','en'),('smartlingo-qa-21d-zh','ja'),
    ('smartlingo-qa-21d-zh','es'),('smartlingo-qa-21d-zh','it'),
    ('smartlingo-qa-21d-en','zh'),('smartlingo-qa-21d-en','ja'),
    ('smartlingo-qa-21d-en','es'),('smartlingo-qa-21d-en','it')
)
INSERT OR IGNORE INTO smartlingo_course_enrollments_v3
  (id,offering_id,user_id,class_id,access_type,status,start_day,current_day,daily_seconds,
   started_at,completed_at,created_at,updated_at)
SELECT 'qa21-enrollment-'||user_id||'-'||target_language,
  'sl-course-'||target_language||'-beginner-30d-v1',user_id,
  'course_'||target_language||'_basic','entitled','active',1,1,3600,
  unixepoch(),NULL,unixepoch(),unixepoch()
FROM qa_courses;
