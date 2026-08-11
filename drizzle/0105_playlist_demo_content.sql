INSERT OR IGNORE INTO class_playlist_items (id,room_id,title,source_type,source_url,r2_key,content_type,file_size_bytes,position,created_at,updated_at)
SELECT 'demo-webinar-video',id,'Welcome preview','upload',NULL,'demo:/demo-playlist.mp4','video/mp4',1694949,0,1786419150,1786419150 FROM live_class_rooms WHERE code='889102';
INSERT OR IGNORE INTO class_playlist_items (id,room_id,title,source_type,source_url,r2_key,content_type,file_size_bytes,position,created_at,updated_at)
SELECT 'demo-livestream-video',id,'Welcome preview','upload',NULL,'demo:/demo-playlist.mp4','video/mp4',1694949,0,1786419150,1786419150 FROM live_class_rooms WHERE code='889103';
INSERT OR REPLACE INTO class_playlist_state (room_id,active,current_item_id,started_at,offset_seconds,updated_by_user_id,updated_at)
SELECT id,1,'demo-webinar-video',1786419150,0,NULL,1786419150 FROM live_class_rooms WHERE code='889102';
INSERT OR REPLACE INTO class_playlist_state (room_id,active,current_item_id,started_at,offset_seconds,updated_by_user_id,updated_at)
SELECT id,1,'demo-livestream-video',1786419150,0,NULL,1786419150 FROM live_class_rooms WHERE code='889103';
