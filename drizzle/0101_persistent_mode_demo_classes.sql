-- Permanent public test classrooms for browser regression and user self-tests.
-- These rows are deliberately not removed by retention jobs.
INSERT OR IGNORE INTO live_class_rooms (
  id,code,host_user_id,host_email,host_name,title,description,subject,
  class_type,streaming_mode,realtime_mode,starts_at,duration_minutes,
  trial_minutes,tuition_cents,password_hash,provider_meeting_id,
  stream_active,mute_all,status,created_at,updated_at
)
SELECT seed.id,seed.code,u.id,lower(u.email),u.display_name,seed.title,
       'Permanent public test classroom. Users may join to test media controls.',
       'Realtime media testing','public','video',seed.realtime_mode,
       unixepoch(),480,0,0,NULL,NULL,0,0,'active',unixepoch(),unixepoch()
FROM users u
JOIN (
  SELECT 'demo-class-group-v1' id,'889101' code,'Group Call Demo Class' title,'group_call' realtime_mode
  UNION ALL SELECT 'demo-class-webinar-v1','889102','Webinar Demo Class','webinar'
  UNION ALL SELECT 'demo-class-livestream-v1','889103','Livestream Demo Class','livestream'
) seed
WHERE lower(u.email)='bingliu@cybeye.com';

