-- Idempotent production QA fixture: test1 is an English-interface learner who
-- self-selects beginner Chinese, then demonstrates the cumulative 7 → 14 → 30
-- day certificate path. This never creates a user or an identity.
UPDATE users SET preferred_language = 'en'
WHERE id = 'user_3HJppy68T8seO0Usw1btuqRvocI';

UPDATE smartlingo_placement_attempts
SET entry_mode = 'beginner', current_difficulty = 1,
  vocabulary_score = NULL, reading_score = NULL, writing_score = NULL,
  listening_score = NULL, dialogue_score = NULL, overall_score = NULL,
  recommended_level = 'beginner', updated_at = 1785772800
WHERE user_id = 'user_3HJppy68T8seO0Usw1btuqRvocI'
  AND class_id = 'class_official_zh' AND status = 'completed';

INSERT OR IGNORE INTO smartlingo_course_enrollments_v3
  (id, offering_id, user_id, class_id, access_type, status, start_day,
   current_day, daily_seconds, started_at, completed_at, created_at, updated_at)
SELECT 'qa-test1-zh-14d-20260802','sl-course-zh-beginner-14d-v1',id,
  'class_official_zh','entitled','completed',8,8,3600,
  1785772800,1785772860,1785772800,1785772860
FROM users WHERE id = 'user_3HJppy68T8seO0Usw1btuqRvocI';

INSERT OR IGNORE INTO smartlingo_course_day_progress_v2
  (id,enrollment_id,user_id,class_id,course_day,started_date,last_activity_date,
   score,skill_scores,quiz_score,is_complete,started_at,completed_at,updated_at)
SELECT 'qa-test1-zh-14d-progress','qa-test1-zh-14d-20260802',id,'class_official_zh',8,
  '2026-08-02','2026-08-02',95,
  '{"vocabulary":95,"reading":95,"listening":95,"dialogue":95}',95,1,
  1785772800,1785772860,1785772860
FROM users WHERE id = 'user_3HJppy68T8seO0Usw1btuqRvocI';

INSERT OR IGNORE INTO smartlingo_course_certificates_v2
  (id,certificate_number,verification_code,enrollment_id,offering_id,user_id,class_id,
   member_name,course_title_zh,course_title_en,target_language,level,duration_days,
   start_day,completed_days,final_score,pass_score,completion_reason,curriculum_version,
   issued_at,created_at)
SELECT 'qa-test1-zh-14d-certificate','SL-2026-TEST1-ZH14','TEST1ZH14VERIFY',
  'qa-test1-zh-14d-20260802','sl-course-zh-beginner-14d-v1',id,'class_official_zh',
  display_name,'14 天入门课程','14-day Beginner Course','zh','beginner',14,8,1,95,60,
  'early_mastery','2026-08-02.3',1785772860,1785772860
FROM users WHERE id = 'user_3HJppy68T8seO0Usw1btuqRvocI';

INSERT OR IGNORE INTO smartlingo_course_enrollments_v3
  (id, offering_id, user_id, class_id, access_type, status, start_day,
   current_day, daily_seconds, started_at, completed_at, created_at, updated_at)
SELECT 'qa-test1-zh-30d-20260802','sl-course-zh-beginner-30d-v1',id,
  'class_official_zh','entitled','completed',15,15,3600,
  1785772920,1785772980,1785772920,1785772980
FROM users WHERE id = 'user_3HJppy68T8seO0Usw1btuqRvocI';

INSERT OR IGNORE INTO smartlingo_course_day_progress_v2
  (id,enrollment_id,user_id,class_id,course_day,started_date,last_activity_date,
   score,skill_scores,quiz_score,is_complete,started_at,completed_at,updated_at)
SELECT 'qa-test1-zh-30d-progress','qa-test1-zh-30d-20260802',id,'class_official_zh',15,
  '2026-08-02','2026-08-02',95,
  '{"vocabulary":95,"reading":95,"writing":95,"listening":95,"dialogue":95}',95,1,
  1785772920,1785772980,1785772980
FROM users WHERE id = 'user_3HJppy68T8seO0Usw1btuqRvocI';

INSERT OR IGNORE INTO smartlingo_course_certificates_v2
  (id,certificate_number,verification_code,enrollment_id,offering_id,user_id,class_id,
   member_name,course_title_zh,course_title_en,target_language,level,duration_days,
   start_day,completed_days,final_score,pass_score,completion_reason,curriculum_version,
   issued_at,created_at)
SELECT 'qa-test1-zh-30d-certificate','SL-2026-TEST1-ZH30','TEST1ZH30VERIFY',
  'qa-test1-zh-30d-20260802','sl-course-zh-beginner-30d-v1',id,'class_official_zh',
  display_name,'30 天入门课程','30-day Beginner Course','zh','beginner',30,15,1,95,60,
  'early_mastery','2026-08-02.3',1785772980,1785772980
FROM users WHERE id = 'user_3HJppy68T8seO0Usw1btuqRvocI';
