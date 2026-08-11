UPDATE live_class_rooms SET
  title = CASE code WHEN '889101' THEN 'Group call with playlist' WHEN '889102' THEN 'Webinar with playlist' WHEN '889103' THEN 'Livestream with playlist' END,
  description = 'Permanent public demo room with two audible loop videos.',
  subject = 'Live media demo', streaming_mode = 'video', status = 'active',
  provider_meeting_id = NULL, stream_active = 0, updated_at = unixepoch()
WHERE code IN ('889101','889102','889103');

DELETE FROM class_playlist_items WHERE room_id IN (SELECT id FROM live_class_rooms WHERE code IN ('889101','889102','889103'));
INSERT INTO class_playlist_items (id,room_id,title,source_type,source_url,r2_key,content_type,file_size_bytes,position,created_at,updated_at)
SELECT 'demo-'||code||'-loop-a',id,'Demo loop A · 15 minutes','upload',NULL,'demo:/playlist-demo-a-15min.mp4','video/mp4',2663368,0,unixepoch(),unixepoch() FROM live_class_rooms WHERE code IN ('889101','889102','889103');
INSERT INTO class_playlist_items (id,room_id,title,source_type,source_url,r2_key,content_type,file_size_bytes,position,created_at,updated_at)
SELECT 'demo-'||code||'-loop-b',id,'Demo loop B · 15 minutes','upload',NULL,'demo:/playlist-demo-b-15min.mp4','video/mp4',2685684,1,unixepoch(),unixepoch() FROM live_class_rooms WHERE code IN ('889101','889102','889103');
INSERT INTO class_playlist_state (room_id,active,current_item_id,started_at,offset_seconds,updated_by_user_id,updated_at)
SELECT id,1,'demo-'||code||'-loop-a',unixepoch(),0,NULL,unixepoch() FROM live_class_rooms WHERE code IN ('889101','889102','889103')
ON CONFLICT(room_id) DO UPDATE SET active=1,current_item_id=excluded.current_item_id,started_at=excluded.started_at,offset_seconds=0,updated_by_user_id=NULL,updated_at=excluded.updated_at;
