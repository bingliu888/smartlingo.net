-- Preserve existing classroom creators as paid teachers without adding a new role.
INSERT INTO platform_member_access
  (user_id,status,subscriber_override,updated_by_user_id,created_at,updated_at)
SELECT id,'active',1,NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
FROM users WHERE role='admin'
ON CONFLICT(user_id) DO UPDATE SET
  status='active',
  subscriber_override=1,
  updated_at=CURRENT_TIMESTAMP;

