-- Keep canonical demo classes enterable for long-term browser testing.
UPDATE live_class_rooms
SET starts_at = 4070908800,
    duration_minutes = 480,
    status = 'active',
    updated_at = unixepoch()
WHERE code IN ('889101','889102','889103');

