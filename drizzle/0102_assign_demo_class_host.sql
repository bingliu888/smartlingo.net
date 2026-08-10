-- Assign permanent browser-test rooms to the site's existing Test 1 account
-- when available. The permanent administrator remains a manager by policy.
UPDATE live_class_rooms
SET host_user_id=(SELECT id FROM users WHERE lower(email) LIKE 'bingliu+%-test1@cybeye.com' ORDER BY email LIMIT 1),
    host_email=(SELECT lower(email) FROM users WHERE lower(email) LIKE 'bingliu+%-test1@cybeye.com' ORDER BY email LIMIT 1),
    host_name=(SELECT display_name FROM users WHERE lower(email) LIKE 'bingliu+%-test1@cybeye.com' ORDER BY email LIMIT 1),
    updated_at=unixepoch()
WHERE id IN ('demo-class-group-v1','demo-class-webinar-v1','demo-class-livestream-v1')
  AND EXISTS (SELECT 1 FROM users WHERE lower(email) LIKE 'bingliu+%-test1@cybeye.com');

