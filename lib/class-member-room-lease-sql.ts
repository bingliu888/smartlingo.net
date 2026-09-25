// SmartMeeting v2's member room lease SQL with the classroom's site-local table.
export const MEMBER_ROOM_LIVE_SECONDS=18;
export const MEMBER_ROOM_TAB_ID=/^[a-f0-9-]{36}$/i;
export const CLAIM_MEMBER_ROOM_SQL=`INSERT INTO class_member_room_presence
  (room_id,user_id,tab_id,display_name,entered_at,last_seen_at)
  VALUES(?,?,?,?,?,?)
  ON CONFLICT(room_id,user_id) DO UPDATE SET
    tab_id=excluded.tab_id,display_name=excluded.display_name,
    entered_at=CASE WHEN class_member_room_presence.tab_id=excluded.tab_id
      THEN class_member_room_presence.entered_at ELSE excluded.entered_at END,
    last_seen_at=excluded.last_seen_at
  WHERE class_member_room_presence.tab_id=excluded.tab_id
    OR class_member_room_presence.last_seen_at<?`;
export const RELEASE_MEMBER_ROOM_SQL=`DELETE FROM class_member_room_presence
  WHERE room_id=? AND user_id=? AND tab_id=?`;
export const ACTIVE_MEMBER_ROOM_TAB_SQL=`SELECT 1 FROM class_member_room_presence
  WHERE room_id=? AND user_id=? AND tab_id=? AND last_seen_at>=? LIMIT 1`;
