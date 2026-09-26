-- One ordinary, public audio Webinar owned by a verified administrator.
CREATE TABLE site_help_rooms (
  singleton INTEGER PRIMARY KEY CHECK(singleton=1),
  room_id TEXT NOT NULL UNIQUE REFERENCES live_class_rooms(id) ON DELETE RESTRICT
);

INSERT INTO live_class_rooms (
  id,code,host_user_id,host_email,host_name,title,description,subject,
  class_type,streaming_mode,realtime_mode,starts_at,duration_minutes,
  trial_minutes,tuition_cents,password_hash,provider_meeting_id,
  stream_active,mute_all,status,created_at,updated_at
)
SELECT 'site-help-room-v1',printf('%06d',candidate.n),admin.id,lower(admin.email),
  admin.display_name,'Help · 帮助中心','','Help','public','audio','webinar',
  unixepoch(),480,0,0,NULL,NULL,0,0,'active',unixepoch(),unixepoch()
FROM users admin
CROSS JOIN (
  WITH RECURSIVE codes(n) AS (
    VALUES(990000)
    UNION ALL SELECT n+1 FROM codes WHERE n<999999
  )
  SELECT n FROM codes WHERE NOT EXISTS (
    SELECT 1 FROM live_class_rooms WHERE code=printf('%06d',codes.n)
  ) LIMIT 1
) candidate
WHERE admin.role='admin' AND admin.email_verified=1
ORDER BY admin.created_at,admin.id LIMIT 1;

INSERT INTO site_help_rooms(singleton,room_id)
SELECT 1,id FROM live_class_rooms WHERE id='site-help-room-v1';
