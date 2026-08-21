UPDATE smartlingo_college_tags
SET slug='general', name_en='General', name_zh='通用', sort_order=10, active=1, updated_at=unixepoch()
WHERE id='smartlingo-college-tag-general';
--> statement-breakpoint
UPDATE smartlingo_college_tags
SET slug='professional', name_en='Professional', name_zh='专业', sort_order=20, active=1, updated_at=unixepoch()
WHERE id='smartlingo-college-tag-finance';
--> statement-breakpoint
UPDATE smartlingo_college_tags
SET slug='archived-lifestyle', name_en='Archived lifestyle', name_zh='已停用生活方式', sort_order=90, active=0, updated_at=unixepoch()
WHERE id='smartlingo-college-tag-lifestyle';
--> statement-breakpoint
UPDATE smartlingo_college_tags
SET slug='test-prep', name_en='Test Prep', name_zh='备考', sort_order=30, active=1, updated_at=unixepoch()
WHERE id='smartlingo-college-tag-sports';
--> statement-breakpoint
DELETE FROM smartlingo_college_tag_assignments
WHERE college_id='smartlingo-college-lifestyle' AND tag_id='smartlingo-college-tag-lifestyle';
--> statement-breakpoint
INSERT OR IGNORE INTO smartlingo_college_tag_assignments(college_id,tag_id,created_at)
VALUES ('smartlingo-college-lifestyle','smartlingo-college-tag-finance',unixepoch());
--> statement-breakpoint

UPDATE smartlingo_colleges
SET title_en='SmartLingo Language College', title_zh='SmartLingo 语言学院',
    description_en='Administrator-built Beginner, Intermediate, and Advanced language courses for practical communication and confident progress.',
    description_zh='由管理员预置初级、中级、高级语言课程，帮助学习者提升实用沟通能力并稳步进阶。',
    updated_at=unixepoch()
WHERE id='smartlingo-college-general';
--> statement-breakpoint
UPDATE smartlingo_colleges
SET title_en='Business College', title_zh='商务学院',
    description_en='Practical language and communication for business, finance, markets, teamwork, and responsible decision-making.',
    description_zh='面向商务、金融、市场、团队协作与负责任决策的实用语言和沟通学习。',
    updated_at=unixepoch()
WHERE id='smartlingo-college-finance';
--> statement-breakpoint
UPDATE smartlingo_colleges
SET title_en='Career College', title_zh='职业学院',
    description_en='Career-focused language, workplace communication, professional growth, and lifelong learning.',
    description_zh='聚焦职业语言、职场沟通、专业成长与终身学习。',
    updated_at=unixepoch()
WHERE id='smartlingo-college-lifestyle';
--> statement-breakpoint
UPDATE smartlingo_colleges
SET title_en='Test Prep College', title_zh='备考学院',
    description_en='Structured preparation for language tests, academic goals, practice strategies, and confident performance.',
    description_zh='为语言考试与学业目标提供结构化备考、练习策略和应试能力训练。',
    updated_at=unixepoch()
WHERE id='smartlingo-college-sports';
--> statement-breakpoint

UPDATE smartlingo_language_classes
SET title='Introduction to SmartLingo Language College / SmartLingo 语言学院导论',
    summary='Explore language learning pathways and the SmartLingo college experience. / 了解语言学习路径与 SmartLingo 学院体验。',
    updated_at=unixepoch()
WHERE id='college_course_general';
--> statement-breakpoint
UPDATE smartlingo_language_classes
SET title='Introduction to Business College / 商务学院导论',
    summary='Explore practical business, finance, market, and workplace communication. / 学习实用商务、金融、市场与职场沟通。',
    updated_at=unixepoch()
WHERE id='college_course_finance';
--> statement-breakpoint
UPDATE smartlingo_language_classes
SET title='Introduction to Career College / 职业学院导论',
    summary='Explore career language, workplace communication, and professional growth. / 学习职业语言、职场沟通与专业成长。',
    updated_at=unixepoch()
WHERE id='college_course_lifestyle';
--> statement-breakpoint
UPDATE smartlingo_language_classes
SET title='Introduction to Test Prep College / 备考学院导论',
    summary='Explore language-test goals, study plans, and effective practice strategies. / 了解语言考试目标、学习计划与有效练习策略。',
    updated_at=unixepoch()
WHERE id='college_course_sports';
--> statement-breakpoint

INSERT OR IGNORE INTO smartlingo_college_courses(college_id,course_id,kind,position,created_at) VALUES
 ('smartlingo-college-general','course_en_basic','standard',10,unixepoch()),
 ('smartlingo-college-general','course_en_intermediate','standard',20,unixepoch()),
 ('smartlingo-college-general','course_en_advanced','standard',30,unixepoch());
