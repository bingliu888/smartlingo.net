-- Keep reserved public demo titles aligned with the visible Course terminology.
UPDATE class_rooms
SET title = CASE code
  WHEN '889101' THEN 'Group Call Demo Course'
  WHEN '889102' THEN 'Webinar Demo Course'
  ELSE 'Livestream Demo Course'
END,
updated_at = unixepoch()
WHERE code IN ('889101','889102','889103');

