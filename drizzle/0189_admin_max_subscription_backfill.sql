-- Repair legacy admin grants that only set subscriber_override. Use the audited
-- grant time, not the role flag alone: older admin/teacher backfills used that
-- flag without representing a genuine Max grant.
INSERT INTO subscriptions
  (id,user_id,cadence,status,current_period_ends_at,cancel_at_period_end,created_at,updated_at)
SELECT 'admin-backfill-' || lower(hex(randomblob(16))), access.user_id,'max','active',
  CAST(strftime('%s', audit.granted_at, 'unixepoch', '+6 months') AS INTEGER),
  1,audit.granted_at,unixepoch()
FROM platform_member_access access
JOIN (
  SELECT target_user_id,MAX(created_at) AS granted_at
  FROM platform_admin_audit WHERE action='role.grant-subscriber'
  GROUP BY target_user_id
) audit ON audit.target_user_id=access.user_id
WHERE access.status='active' AND access.subscriber_override=1
  AND CAST(strftime('%s', audit.granted_at, 'unixepoch', '+6 months') AS INTEGER)>unixepoch()
ON CONFLICT(user_id) DO UPDATE SET
  cadence='max',status='active',
  current_period_ends_at=MAX(COALESCE(subscriptions.current_period_ends_at,0),excluded.current_period_ends_at),
  cancel_at_period_end=1,updated_at=unixepoch();
