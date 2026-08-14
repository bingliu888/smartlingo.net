PRAGMA foreign_keys = ON;

-- Normalize only the three reserved demo codes, even when the permanent admin
-- has not signed in locally yet. User-created classrooms are never selected.
UPDATE live_class_rooms
SET title = CASE code
      WHEN '889101' THEN 'Group Call Demo Class'
      WHEN '889102' THEN 'Webinar Demo Class'
      ELSE 'Livestream Demo Class'
    END,
    description = CASE code
      WHEN '889101' THEN 'Permanent public group call demo. Group calls use participant microphones and cameras without a playlist.'
      ELSE 'Permanent public ' || CASE code WHEN '889102' THEN 'webinar' ELSE 'livestream' END || ' demo with real open media. Credits: /demo-media-attribution.txt'
    END,
    subject = CASE code WHEN '889101' THEN 'Realtime group call demo' ELSE 'Live open-media demo' END,
    class_type = 'public',
    streaming_mode = 'video',
    realtime_mode = CASE code WHEN '889101' THEN 'group_call' WHEN '889102' THEN 'webinar' ELSE 'livestream' END,
    starts_at = 4070908800,
    duration_minutes = 480,
    trial_minutes = 0,
    tuition_cents = 0,
    password_hash = NULL,
    status = 'active',
    updated_at = unixepoch()
WHERE code IN ('889101','889102','889103');

-- Group Call never owns or relays a playlist.
DELETE FROM class_playlist_relay_claims
WHERE room_id IN (SELECT id FROM live_class_rooms WHERE code = '889101');

DELETE FROM class_playlist_state
WHERE room_id IN (SELECT id FROM live_class_rooms WHERE code = '889101');

DELETE FROM class_playlist_items
WHERE room_id IN (SELECT id FROM live_class_rooms WHERE code = '889101');
