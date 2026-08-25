CREATE TABLE smartlingo_nearby_profiles (
  user_id TEXT PRIMARY KEY NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0,1)),
  adult_confirmed INTEGER NOT NULL DEFAULT 0 CHECK(adult_confirmed IN (0,1)),
  coarse_region TEXT NOT NULL DEFAULT '' CHECK(length(coarse_region) <= 80),
  source_language TEXT NOT NULL DEFAULT 'zh' CHECK(source_language IN ('zh','en','es','ja','ko','fr','de','ru','it','pt','ar','hi')),
  target_language TEXT NOT NULL DEFAULT 'en' CHECK(target_language IN ('zh','en','es','ja','ko','fr','de','ru','it','pt','ar','hi')),
  level TEXT NOT NULL DEFAULT 'beginner' CHECK(level IN ('beginner','intermediate','advanced')),
  study_mode TEXT NOT NULL DEFAULT 'mixed' CHECK(study_mode IN ('vocabulary','challenge','speaking','mixed')),
  availability TEXT NOT NULL DEFAULT 'flexible' CHECK(availability IN ('weekdays','evenings','weekends','flexible')),
  bio TEXT NOT NULL DEFAULT '' CHECK(length(bio) <= 280),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  CHECK(source_language <> target_language),
  CHECK(enabled = 0 OR (adult_confirmed = 1 AND length(trim(coarse_region)) BETWEEN 2 AND 80))
);
--> statement-breakpoint
CREATE INDEX smartlingo_nearby_match_idx
ON smartlingo_nearby_profiles(enabled,coarse_region,source_language,target_language,level,updated_at DESC);
--> statement-breakpoint
CREATE TABLE smartlingo_nearby_blocks (
  blocker_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY(blocker_user_id,blocked_user_id),
  CHECK(blocker_user_id <> blocked_user_id)
);
--> statement-breakpoint
CREATE INDEX smartlingo_nearby_blocked_idx
ON smartlingo_nearby_blocks(blocked_user_id,blocker_user_id);
--> statement-breakpoint
CREATE TABLE smartlingo_nearby_reports (
  id TEXT PRIMARY KEY NOT NULL,
  reporter_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reported_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK(category IN ('spam','harassment','unsafe','other')),
  detail TEXT NOT NULL DEFAULT '' CHECK(length(detail) <= 500),
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','reviewed','closed')),
  created_at INTEGER NOT NULL,
  reviewed_at INTEGER,
  CHECK(reporter_user_id <> reported_user_id)
);
--> statement-breakpoint
CREATE INDEX smartlingo_nearby_report_status_idx
ON smartlingo_nearby_reports(status,created_at DESC);
--> statement-breakpoint
CREATE INDEX smartlingo_nearby_report_target_idx
ON smartlingo_nearby_reports(reported_user_id,created_at DESC);
--> statement-breakpoint
PRAGMA optimize;
