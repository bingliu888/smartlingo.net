PRAGMA foreign_keys = ON;

-- Rebuild only the three reserved demo codes under the permanent administrator.
-- User-created classes are intentionally outside this scope.
DELETE FROM class_playlist_relay_claims
WHERE room_id IN (SELECT id FROM live_class_rooms WHERE code IN ('889101','889102','889103'));

DELETE FROM class_playlist_state
WHERE room_id IN (SELECT id FROM live_class_rooms WHERE code IN ('889101','889102','889103'));

DELETE FROM class_playlist_items
WHERE room_id IN (SELECT id FROM live_class_rooms WHERE code IN ('889101','889102','889103'));

DELETE FROM live_class_rooms
WHERE code IN ('889101','889102','889103')
  AND EXISTS (SELECT 1 FROM users WHERE lower(email)='bingliu@cybeye.com');

INSERT INTO live_class_rooms (
  id,code,host_user_id,host_email,host_name,title,description,subject,
  class_type,streaming_mode,realtime_mode,starts_at,duration_minutes,
  trial_minutes,tuition_cents,password_hash,provider_meeting_id,
  stream_active,mute_all,status,created_at,updated_at
)
SELECT seed.id,seed.code,u.id,lower(u.email),u.display_name,seed.title,
       seed.description,seed.subject,'public','video',seed.realtime_mode,
       4070908800,480,0,0,NULL,NULL,0,0,'active',unixepoch(),unixepoch()
FROM users u
JOIN (
  SELECT 'demo-class-group-v1' id,'889101' code,'Group Call Demo Class' title,
         'Permanent public group call demo. Group calls use participant microphones and cameras without a playlist.' description,
         'Realtime group call demo' subject,'group_call' realtime_mode
  UNION ALL
  SELECT 'demo-class-webinar-v1','889102','Webinar Demo Class',
         'Permanent public webinar demo with real open media. Credits: /demo-media-attribution.txt',
         'Live open-media demo','webinar'
  UNION ALL
  SELECT 'demo-class-livestream-v1','889103','Livestream Demo Class',
         'Permanent public livestream demo with real open media. Credits: /demo-media-attribution.txt',
         'Live open-media demo','livestream'
) seed
WHERE lower(u.email)='bingliu@cybeye.com';

-- Group Call deliberately has no playlist. Webinar and Livestream share the
-- same credited, bundled real audio/video samples as SmartClass.guru.
INSERT INTO class_playlist_items
  (id,room_id,title,source_type,source_url,r2_key,content_type,file_size_bytes,position,created_at,updated_at)
SELECT 'demo-' || code || '-loop-a',id,'Canon in D Major — Kevin MacLeod · CC BY 3.0','upload',NULL,
       'demo:/demo-music-canon-in-d.mp4','video/mp4',4959885,0,unixepoch(),unixepoch()
FROM live_class_rooms WHERE code IN ('889102','889103');

INSERT INTO class_playlist_items
  (id,room_id,title,source_type,source_url,r2_key,content_type,file_size_bytes,position,created_at,updated_at)
SELECT 'demo-' || code || '-loop-b',id,'Big Buck Bunny clip — © Blender Foundation · CC BY 3.0','upload',NULL,
       'demo:/demo-video-big-buck-bunny.mp4','video/mp4',1746086,1,unixepoch(),unixepoch()
FROM live_class_rooms WHERE code IN ('889102','889103');

INSERT INTO class_playlist_state
  (room_id,active,current_item_id,started_at,offset_seconds,updated_by_user_id,updated_at)
SELECT id,1,'demo-' || code || '-loop-a',unixepoch(),0,NULL,unixepoch()
FROM live_class_rooms WHERE code IN ('889102','889103');
