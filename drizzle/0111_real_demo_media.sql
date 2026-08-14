-- Replace synthetic demo loops with real, credited open media.
UPDATE live_class_rooms
SET description = 'Permanent public demo room with real open media. Credits: /demo-media-attribution.txt',
    subject = 'Live open-media demo',
    updated_at = unixepoch()
WHERE code IN ('889101','889102','889103');

DELETE FROM class_playlist_items
WHERE room_id IN (SELECT id FROM live_class_rooms WHERE code IN ('889101','889102','889103'));

INSERT INTO class_playlist_items
  (id,room_id,title,source_type,source_url,r2_key,content_type,file_size_bytes,position,created_at,updated_at)
SELECT 'demo-' || code || '-loop-a',id,'Canon in D Major — Kevin MacLeod · CC BY 3.0','upload',NULL,
       'demo:/demo-music-canon-in-d.mp4','video/mp4',4959885,0,unixepoch(),unixepoch()
FROM live_class_rooms WHERE code IN ('889101','889102','889103');

INSERT INTO class_playlist_items
  (id,room_id,title,source_type,source_url,r2_key,content_type,file_size_bytes,position,created_at,updated_at)
SELECT 'demo-' || code || '-loop-b',id,'Big Buck Bunny clip — © Blender Foundation · CC BY 3.0','upload',NULL,
       'demo:/demo-video-big-buck-bunny.mp4','video/mp4',1746086,1,unixepoch(),unixepoch()
FROM live_class_rooms WHERE code IN ('889101','889102','889103');

INSERT INTO class_playlist_state
  (room_id,active,current_item_id,started_at,offset_seconds,updated_by_user_id,updated_at)
SELECT id,1,'demo-' || code || '-loop-a',unixepoch(),0,NULL,unixepoch()
FROM live_class_rooms WHERE code IN ('889101','889102','889103')
ON CONFLICT(room_id) DO UPDATE SET
  active=1,
  current_item_id=excluded.current_item_id,
  started_at=excluded.started_at,
  offset_seconds=0,
  updated_by_user_id=NULL,
  updated_at=excluded.updated_at;

