-- Role management must never remove the underlying SmartLingo member.
-- Restore every account removed by the former ambiguous Admin "Delete" action.
UPDATE platform_member_access
SET status = 'active', updated_at = unixepoch()
WHERE status = 'removed'
  AND EXISTS (
    SELECT 1
    FROM platform_admin_audit audit
    WHERE audit.target_user_id = platform_member_access.user_id
      AND audit.action = 'member.removed'
  );
