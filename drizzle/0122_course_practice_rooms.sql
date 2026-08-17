CREATE TABLE IF NOT EXISTS smartlingo_course_practice_rooms (
  course_id TEXT PRIMARY KEY NOT NULL REFERENCES smartlingo_language_classes(id) ON DELETE CASCADE,
  room_id TEXT NOT NULL UNIQUE REFERENCES live_class_rooms(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL
);
--> statement-breakpoint

WITH languages(code,ordinal) AS (VALUES
  ('zh',1),('en',2),('es',3),('ja',4),('ko',5),('fr',6),
  ('de',7),('ru',8),('it',9),('pt',10),('ar',11),('hi',12)
), tiers(tier,label_en,label_zh,tier_order) AS (VALUES
  ('basic','Beginner','初期',1),
  ('intermediate','Intermediate','中级',2),
  ('advanced','Advanced','高级',3)
)
INSERT OR IGNORE INTO live_class_rooms
  (id,code,host_user_id,host_email,host_name,title,description,subject,class_type,streaming_mode,realtime_mode,starts_at,duration_minutes,trial_minutes,tuition_cents,mute_all,status,created_at,updated_at)
SELECT 'practice_course_'||code||'_'||tier,printf('820%02d%1d',ordinal,tier_order),
  'smartlingo-language-admin','language-admin@smartlingo.invalid','SmartLingo Language Admin',
  upper(code)||' '||label_en||' Practice Room / '||label_zh||'课程练习室',
  'Free group audio discussion for enrolled course students / 订阅学员免费小组语音讨论与口语练习',
  upper(code)||' speaking practice','private','audio','group_call',unixepoch(),60,0,0,0,'active',unixepoch(),unixepoch()
FROM languages CROSS JOIN tiers;
--> statement-breakpoint

INSERT OR IGNORE INTO smartlingo_course_practice_rooms(course_id,room_id,created_at)
SELECT id,'practice_'||id,unixepoch()
FROM smartlingo_language_classes
WHERE class_kind='official_course';
--> statement-breakpoint

PRAGMA optimize;
