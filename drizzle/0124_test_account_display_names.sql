UPDATE users
SET display_name = substr(lower(email), instr(lower(email), '+') + 1, instr(lower(email), '@') - instr(lower(email), '+') - 1)
WHERE lower(email) LIKE 'bingliu+%@%';

UPDATE live_class_rooms
SET host_name = (SELECT display_name FROM users WHERE lower(users.email) = lower(live_class_rooms.host_email) LIMIT 1)
WHERE lower(host_email) LIKE 'bingliu+%@%';
