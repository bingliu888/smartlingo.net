PRAGMA foreign_keys = ON;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS smartlingo_college_tags (
  id TEXT PRIMARY KEY NOT NULL,
  slug TEXT NOT NULL UNIQUE CHECK(length(slug) BETWEEN 2 AND 40),
  name_en TEXT NOT NULL,
  name_zh TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS smartlingo_colleges (
  id TEXT PRIMARY KEY NOT NULL,
  code TEXT NOT NULL UNIQUE CHECK(length(code)=6),
  owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title_en TEXT NOT NULL,
  title_zh TEXT NOT NULL,
  description_en TEXT NOT NULL DEFAULT '',
  description_zh TEXT NOT NULL DEFAULT '',
  access_type TEXT NOT NULL DEFAULT 'public' CHECK(access_type IN ('public','trial','private')),
  tuition_cents INTEGER NOT NULL DEFAULT 0 CHECK(tuition_cents BETWEEN 0 AND 10000000),
  currency TEXT NOT NULL DEFAULT 'USD',
  trial_days INTEGER NOT NULL DEFAULT 7 CHECK(trial_days BETWEEN 0 AND 365),
  introductory_course_id TEXT NOT NULL UNIQUE REFERENCES smartlingo_language_classes(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','archived')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS smartlingo_colleges_access_idx ON smartlingo_colleges(access_type,status,updated_at DESC);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS smartlingo_college_tag_assignments (
  college_id TEXT NOT NULL REFERENCES smartlingo_colleges(id) ON DELETE CASCADE,
  tag_id TEXT NOT NULL REFERENCES smartlingo_college_tags(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY(college_id,tag_id)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS smartlingo_college_tag_assignments_tag_idx ON smartlingo_college_tag_assignments(tag_id,college_id);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS smartlingo_college_courses (
  college_id TEXT NOT NULL REFERENCES smartlingo_colleges(id) ON DELETE CASCADE,
  course_id TEXT NOT NULL UNIQUE REFERENCES smartlingo_language_classes(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'standard' CHECK(kind IN ('introductory','standard')),
  position INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  PRIMARY KEY(college_id,course_id)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS smartlingo_college_courses_order_idx ON smartlingo_college_courses(college_id,position,created_at);
--> statement-breakpoint
INSERT OR IGNORE INTO smartlingo_college_tags(id,slug,name_en,name_zh,sort_order,active,created_at,updated_at) VALUES
 ('smartlingo-college-tag-general','general','General','通用',10,1,unixepoch(),unixepoch()),
 ('smartlingo-college-tag-finance','finance','Finance','金融',20,1,unixepoch(),unixepoch()),
 ('smartlingo-college-tag-lifestyle','lifestyle','Lifestyle','生活方式',30,1,unixepoch(),unixepoch()),
 ('smartlingo-college-tag-sports','sports','Sports','体育',40,1,unixepoch(),unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO smartlingo_language_classes
 (id,owner_user_id,path_id,class_kind,owner_role,title,summary,target_language,level,schedule,status,visibility,price_cents,currency,capacity,package_tier,billing_interval,trial_days,created_at,updated_at)
VALUES
 ('college_course_general','smartlingo-language-admin','path_en_a1','subject','coordinator','Introduction to SmartLingo General College / SmartLingo 通用学院导论','Explore multidisciplinary learning and the SmartLingo college experience. / 了解跨领域学习与 SmartLingo 学院体验。','en','A1','Self-paced introduction','open','public',0,'USD',1000,'basic','month',30,unixepoch(),unixepoch()),
 ('college_course_finance','smartlingo-language-admin','path_en_a1','subject','coordinator','Introduction to Digital Finance / 数字金融导论','Learn responsible personal finance, digital assets, markets, and risk. / 学习负责任的个人理财、数字资产、市场与风险。','en','A1','Monthly · 7-day referral access','open','public',9900,'USD',1000,'basic','month',7,unixepoch(),unixepoch()),
 ('college_course_lifestyle','smartlingo-language-admin','path_en_a1','subject','coordinator','Introduction to Modern Lifestyle / 现代生活方式导论','Design healthier routines, creativity, relationships, and intentional living. / 设计更健康的习惯、创意、关系与有意识的生活。','en','A1','Invitation only','open','private',14900,'USD',1000,'basic','month',0,unixepoch(),unixepoch()),
 ('college_course_sports','smartlingo-language-admin','path_en_a1','subject','coordinator','Introduction to Global Sports / 全球体育导论','Build knowledge in performance, coaching, recovery, teamwork, and leadership. / 学习运动表现、教练、恢复、团队与领导力。','en','A1','Monthly · 14-day referral access','open','public',7900,'USD',1000,'basic','month',14,unixepoch(),unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO smartlingo_language_class_members(id,class_id,user_id,role,status,joined_at,updated_at)
SELECT 'owner_'||id,id,'smartlingo-language-admin','owner','active',unixepoch(),unixepoch()
FROM smartlingo_language_classes WHERE id LIKE 'college_course_%';
--> statement-breakpoint
INSERT OR IGNORE INTO smartlingo_colleges
 (id,code,owner_user_id,title_en,title_zh,description_en,description_zh,access_type,tuition_cents,currency,trial_days,introductory_course_id,status,created_at,updated_at)
VALUES
 ('smartlingo-college-general','820101','smartlingo-language-admin','SmartLingo General College','SmartLingo 通用学院','A welcoming home for multidisciplinary language, communication, and community learning.','跨学科语言、沟通与社区学习的开放学院。','public',0,'USD',30,'college_course_general','active',unixepoch(),unixepoch()),
 ('smartlingo-college-finance','820102','smartlingo-language-admin','Digital Finance College','数字金融学院','Practical learning in finance, digital assets, markets, risk, and responsible decision-making.','学习金融、数字资产、市场、风险与负责任决策。','trial',9900,'USD',7,'college_course_finance','active',unixepoch(),unixepoch()),
 ('smartlingo-college-lifestyle','820103','smartlingo-language-admin','Modern Lifestyle College','现代生活方式学院','An invitation-only learning community for wellbeing, creativity, relationships, and intentional living.','面向健康、创意、关系与有意识生活的邀请制学习社区。','private',14900,'USD',0,'college_course_lifestyle','active',unixepoch(),unixepoch()),
 ('smartlingo-college-sports','820104','smartlingo-language-admin','Global Sports College','全球体育学院','Performance, coaching, recovery, teamwork, and leadership for global sports communities.','面向全球体育社区的表现、教练、恢复、团队与领导力学习。','trial',7900,'USD',14,'college_course_sports','active',unixepoch(),unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO smartlingo_college_courses(college_id,course_id,kind,position,created_at) VALUES
 ('smartlingo-college-general','college_course_general','introductory',0,unixepoch()),
 ('smartlingo-college-finance','college_course_finance','introductory',0,unixepoch()),
 ('smartlingo-college-lifestyle','college_course_lifestyle','introductory',0,unixepoch()),
 ('smartlingo-college-sports','college_course_sports','introductory',0,unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO smartlingo_college_tag_assignments(college_id,tag_id,created_at) VALUES
 ('smartlingo-college-general','smartlingo-college-tag-general',unixepoch()),
 ('smartlingo-college-finance','smartlingo-college-tag-finance',unixepoch()),
 ('smartlingo-college-lifestyle','smartlingo-college-tag-lifestyle',unixepoch()),
 ('smartlingo-college-sports','smartlingo-college-tag-sports',unixepoch());
