export const VERIFIED_REGISTERED_CLASS_USER_SQL = `SELECT id,email,
    display_name AS displayName FROM users
  WHERE lower(email)=lower(?) AND email_verified=1
    AND clerk_identity_checked_at>? AND clerk_user_id=id LIMIT 1`;

export const DELETE_ALREADY_BOUND_CLASS_INVITES_SQL = `DELETE FROM live_class_invites
  WHERE user_id IS NULL AND lower(email)=lower(?)
    AND room_id IN (SELECT room_id FROM live_class_invites WHERE user_id=?)`;

export const DELETE_DUPLICATE_CLASS_INVITES_SQL = `DELETE FROM live_class_invites
  WHERE user_id IS NULL AND lower(email)=lower(?) AND id NOT IN (
    SELECT MIN(candidate.id) FROM live_class_invites candidate
    WHERE candidate.user_id IS NULL AND lower(candidate.email)=lower(?)
    GROUP BY candidate.room_id
  )`;

export const BIND_VERIFIED_CLASS_INVITES_SQL = `UPDATE live_class_invites SET user_id=?
  WHERE user_id IS NULL AND lower(email)=lower(?)
    AND NOT EXISTS (
      SELECT 1 FROM live_class_invites bound
      WHERE bound.room_id=live_class_invites.room_id AND bound.user_id=?
    )`;

export const DELETE_ALREADY_BOUND_STAGE_SPEAKERS_SQL = `DELETE FROM live_class_stage_speakers
  WHERE user_id IS NULL AND lower(member_email)=lower(?)
    AND room_id IN (SELECT room_id FROM live_class_stage_speakers WHERE user_id=?)`;

export const DELETE_DUPLICATE_STAGE_SPEAKERS_SQL = `DELETE FROM live_class_stage_speakers
  WHERE user_id IS NULL AND lower(member_email)=lower(?) AND id NOT IN (
    SELECT MIN(candidate.id) FROM live_class_stage_speakers candidate
    WHERE candidate.user_id IS NULL AND lower(candidate.member_email)=lower(?)
    GROUP BY candidate.room_id
  )`;

export const BIND_VERIFIED_STAGE_SPEAKERS_SQL = `UPDATE live_class_stage_speakers SET user_id=?
  WHERE user_id IS NULL AND lower(member_email)=lower(?)
    AND NOT EXISTS (
      SELECT 1 FROM live_class_stage_speakers bound
      WHERE bound.room_id=live_class_stage_speakers.room_id AND bound.user_id=?
    )`;

export const BIND_VERIFIED_CLASS_COHOSTS_SQL = `UPDATE live_class_cohosts SET identity_bound_at=?
  WHERE user_id=? AND identity_bound_at=0 AND lower(COALESCE(granted_email,''))=lower(?)`;

export const BIND_VERIFIED_CLASS_SUBSCRIPTIONS_SQL = `UPDATE live_class_subscriptions SET identity_bound_at=?
  WHERE user_id=? AND status='active' AND identity_bound_at=0 AND lower(COALESCE(email,''))=lower(?)`;
