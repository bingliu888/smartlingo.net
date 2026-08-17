ALTER TABLE smartlingo_language_classes ADD COLUMN package_tier TEXT;
--> statement-breakpoint
ALTER TABLE smartlingo_language_classes ADD COLUMN billing_interval TEXT NOT NULL DEFAULT 'month';
--> statement-breakpoint
ALTER TABLE smartlingo_language_classes ADD COLUMN trial_days INTEGER NOT NULL DEFAULT 30;
--> statement-breakpoint

DROP TRIGGER IF EXISTS smartlingo_language_class_kind_insert_trg;
--> statement-breakpoint
DROP TRIGGER IF EXISTS smartlingo_language_class_kind_update_trg;
--> statement-breakpoint
DROP TRIGGER IF EXISTS smartlingo_official_language_class_insert_trg;
--> statement-breakpoint
DROP TRIGGER IF EXISTS smartlingo_official_language_class_update_trg;
--> statement-breakpoint

CREATE TRIGGER smartlingo_language_class_kind_insert_trg
BEFORE INSERT ON smartlingo_language_classes
FOR EACH ROW WHEN NEW.class_kind NOT IN ('official_language','official_course','member_language','subject')
BEGIN SELECT RAISE(ABORT, 'smartlingo class kind is unsupported'); END;
--> statement-breakpoint
CREATE TRIGGER smartlingo_language_class_kind_update_trg
BEFORE UPDATE OF class_kind ON smartlingo_language_classes
FOR EACH ROW WHEN NEW.class_kind NOT IN ('official_language','official_course','member_language','subject')
BEGIN SELECT RAISE(ABORT, 'smartlingo class kind is unsupported'); END;
--> statement-breakpoint

UPDATE smartlingo_language_classes
SET class_kind='subject', status='archived', visibility='private', updated_at=unixepoch()
WHERE class_kind='official_language';
--> statement-breakpoint

INSERT OR IGNORE INTO users
  (id,email,display_name,password_hash,preferred_language,role,created_at)
VALUES
  ('smartlingo-language-admin','language-admin@smartlingo.invalid','SmartLingo Language Admin','system-managed-disabled','en','admin',unixepoch());
--> statement-breakpoint

WITH languages(code,name_en,name_zh,path_id,ordinal) AS (VALUES
  ('zh','Chinese','中文','path_zh_a1',1),('en','English','英语','path_en_a1',2),
  ('es','Spanish','西班牙语','path_es_a1',3),('ja','Japanese','日语','path_ja_a1',4),
  ('ko','Korean','韩语','path_ko_a1',5),('fr','French','法语','path_fr_a1',6),
  ('de','German','德语','path_de_a1',7),('ru','Russian','俄语','path_ru_a1',8),
  ('it','Italian','意大利语','path_it_a1',9),('pt','Portuguese','葡萄牙语','path_pt_a1',10),
  ('ar','Arabic','阿拉伯语','path_ar_a1',11),('hi','Hindi','印地语','path_hi_a1',12)
), tiers(tier,level,label_en,label_zh,price_cents,summary_en,summary_zh,tier_order) AS (VALUES
  ('basic','A1','Basic','基础',2000,'Core vocabulary, pronunciation, listening and guided speaking.','核心词汇、发音、听力和引导式口语训练。',1),
  ('intermediate','A2','Intermediate','中级',10000,'Everything in Basic, plus daily-life dialogue and writing training.','包含基础课程，并增加日常生活对话和写作训练。',2),
  ('advanced','B1+','Advanced','高级',30000,'Everything in Intermediate, plus accent correction, speech training and speech-draft revision.','包含中级课程，并增加口音校正、演讲训练和演讲稿修改。',3)
)
INSERT OR IGNORE INTO smartlingo_language_classes
  (id,owner_user_id,path_id,class_kind,owner_role,title,summary,target_language,level,schedule,status,visibility,price_cents,currency,capacity,package_tier,billing_interval,trial_days,created_at,updated_at)
SELECT 'course_'||code||'_'||tier,'smartlingo-language-admin',path_id,'official_course','coordinator',
  name_en||' '||label_en||' / '||name_zh||label_zh||'课程',summary_en||' '||summary_zh,
  code,level,'Monthly · first month free','open','public',price_cents,'USD',1000,tier,'month',30,unixepoch(),unixepoch()
FROM languages CROSS JOIN tiers;
--> statement-breakpoint

INSERT OR IGNORE INTO smartlingo_language_class_members
  (id,class_id,user_id,role,status,joined_at,updated_at)
SELECT 'owner_'||id,id,'smartlingo-language-admin','owner','active',unixepoch(),unixepoch()
FROM smartlingo_language_classes WHERE class_kind='official_course';
--> statement-breakpoint

CREATE TRIGGER smartlingo_official_course_insert_trg
BEFORE INSERT ON smartlingo_language_classes
FOR EACH ROW WHEN NEW.class_kind='official_course' AND (
  NEW.owner_user_id!='smartlingo-language-admin' OR NEW.status!='open' OR NEW.visibility!='public'
  OR NEW.billing_interval!='month' OR NEW.trial_days!=30
  OR (NEW.package_tier='basic' AND NEW.price_cents!=2000)
  OR (NEW.package_tier='intermediate' AND NEW.price_cents!=10000)
  OR (NEW.package_tier='advanced' AND NEW.price_cents!=30000)
  OR NEW.package_tier NOT IN ('basic','intermediate','advanced')
)
BEGIN SELECT RAISE(ABORT, 'official course pricing and ownership are fixed'); END;
--> statement-breakpoint
CREATE TRIGGER smartlingo_official_course_update_trg
BEFORE UPDATE OF class_kind,owner_user_id,status,visibility,price_cents,package_tier,billing_interval,trial_days ON smartlingo_language_classes
FOR EACH ROW WHEN NEW.class_kind='official_course' AND (
  NEW.owner_user_id!='smartlingo-language-admin' OR NEW.status!='open' OR NEW.visibility!='public'
  OR NEW.billing_interval!='month' OR NEW.trial_days!=30
  OR (NEW.package_tier='basic' AND NEW.price_cents!=2000)
  OR (NEW.package_tier='intermediate' AND NEW.price_cents!=10000)
  OR (NEW.package_tier='advanced' AND NEW.price_cents!=30000)
  OR NEW.package_tier NOT IN ('basic','intermediate','advanced')
)
BEGIN SELECT RAISE(ABORT, 'official course pricing and ownership are fixed'); END;
--> statement-breakpoint

WITH languages(code,ordinal) AS (VALUES
  ('zh',1),('en',2),('es',3),('ja',4),('ko',5),('fr',6),('de',7),('ru',8),('it',9),('pt',10),('ar',11),('hi',12)
), tiers(tier,label_en,label_zh,tier_order) AS (VALUES
  ('basic','Basic','基础',1),('intermediate','Intermediate','中级',2),('advanced','Advanced','高级',3)
)
INSERT OR IGNORE INTO live_class_rooms
  (id,code,host_user_id,host_email,host_name,title,description,subject,class_type,streaming_mode,realtime_mode,starts_at,duration_minutes,trial_minutes,tuition_cents,mute_all,status,created_at,updated_at)
SELECT 'room_course_'||code||'_'||tier,printf('810%02d%1d',ordinal,tier_order),
  'smartlingo-language-admin','language-admin@smartlingo.invalid','SmartLingo Language Admin',
  upper(code)||' '||label_en||' Webinar / '||label_zh||'课程教室',
  'Course webinar for enrolled learners / 订阅学员专属课程教室',upper(code)||' language course',
  'private','video','webinar',unixepoch(),60,0,0,0,'active',unixepoch(),unixepoch()
FROM languages CROSS JOIN tiers;
--> statement-breakpoint

INSERT OR IGNORE INTO smartlingo_course_classrooms(course_id,room_id,created_at)
SELECT id,'room_'||id,unixepoch() FROM smartlingo_language_classes WHERE class_kind='official_course';
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS smartlingo_course_subscriptions (
  id TEXT PRIMARY KEY NOT NULL,
  class_id TEXT NOT NULL REFERENCES smartlingo_language_classes(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'trialing' CHECK(status IN ('trialing','active','past_due','cancelled','expired')),
  monthly_price_cents INTEGER NOT NULL CHECK(monthly_price_cents > 0),
  trial_started_at INTEGER NOT NULL,
  trial_ends_at INTEGER NOT NULL,
  current_period_ends_at INTEGER,
  provider_subscription_id TEXT UNIQUE,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS smartlingo_course_subscription_class_user_uq ON smartlingo_course_subscriptions(class_id,user_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS smartlingo_course_subscription_user_status_idx ON smartlingo_course_subscriptions(user_id,status);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS smartlingo_language_course_tier_idx ON smartlingo_language_classes(target_language,package_tier,status);
--> statement-breakpoint
DROP TRIGGER IF EXISTS smartlingo_placement_attempt_scope_insert_trg;
--> statement-breakpoint
DROP TRIGGER IF EXISTS smartlingo_placement_attempt_scope_update_trg;
--> statement-breakpoint
CREATE TRIGGER smartlingo_placement_attempt_scope_insert_trg
BEFORE INSERT ON smartlingo_placement_attempts
FOR EACH ROW WHEN NOT EXISTS (
  SELECT 1 FROM smartlingo_language_classes c
  JOIN smartlingo_language_class_members m ON m.class_id=c.id
  WHERE c.id=NEW.class_id AND c.path_id=NEW.path_id
    AND c.class_kind IN ('official_language','official_course')
    AND m.user_id=NEW.user_id AND m.status='active'
)
BEGIN SELECT RAISE(ABORT, 'smartlingo placement requires an active official course membership'); END;
--> statement-breakpoint
CREATE TRIGGER smartlingo_placement_attempt_scope_update_trg
BEFORE UPDATE OF user_id,class_id,path_id ON smartlingo_placement_attempts
FOR EACH ROW WHEN NOT EXISTS (
  SELECT 1 FROM smartlingo_language_classes c
  JOIN smartlingo_language_class_members m ON m.class_id=c.id
  WHERE c.id=NEW.class_id AND c.path_id=NEW.path_id
    AND c.class_kind IN ('official_language','official_course')
    AND m.user_id=NEW.user_id AND m.status='active'
)
BEGIN SELECT RAISE(ABORT, 'smartlingo placement requires an active official course membership'); END;
--> statement-breakpoint
PRAGMA optimize;
