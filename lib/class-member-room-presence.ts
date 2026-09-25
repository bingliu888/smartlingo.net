import { getDatabase } from "@/lib/auth";
import { ACTIVE_MEMBER_ROOM_TAB_SQL, CLAIM_MEMBER_ROOM_SQL, MEMBER_ROOM_LIVE_SECONDS, MEMBER_ROOM_TAB_ID, RELEASE_MEMBER_ROOM_SQL } from "./class-member-room-lease-sql";
export { MEMBER_ROOM_LIVE_SECONDS, MEMBER_ROOM_TAB_ID } from "./class-member-room-lease-sql";

// Reuses SmartMeeting v2's 18-second, one-tab-per-member lease contract.
export async function claimMemberRoom(roomId: string, userId: string, tabId: string, displayName: string, now = Math.floor(Date.now()/1000)) {
  if (!MEMBER_ROOM_TAB_ID.test(tabId)) return false;
  const result = await getDatabase().prepare(CLAIM_MEMBER_ROOM_SQL)
    .bind(roomId,userId,tabId,displayName.slice(0,80),now,now,now-MEMBER_ROOM_LIVE_SECONDS).run();
  return Number(result.meta?.changes || 0) > 0;
}
export async function releaseMemberRoom(roomId: string, userId: string, tabId: string) {
  if (!MEMBER_ROOM_TAB_ID.test(tabId)) return;
  await getDatabase().prepare(RELEASE_MEMBER_ROOM_SQL)
    .bind(roomId,userId,tabId).run();
}
export async function hasMemberRoomTab(roomId: string, userId: string, tabId: string, now = Math.floor(Date.now()/1000)) {
  if (!MEMBER_ROOM_TAB_ID.test(tabId)) return false;
  return Boolean(await getDatabase().prepare(ACTIVE_MEMBER_ROOM_TAB_SQL)
    .bind(roomId,userId,tabId,now-MEMBER_ROOM_LIVE_SECONDS).first());
}
export async function onlineClassMembers(roomId: string, now = Math.floor(Date.now()/1000)) {
  return (await getDatabase().prepare(`SELECT user_id AS userId,display_name AS displayName,entered_at AS enteredAt
    FROM class_member_room_presence WHERE room_id=? AND last_seen_at>=? ORDER BY entered_at,user_id LIMIT 1000`)
    .bind(roomId,now-MEMBER_ROOM_LIVE_SECONDS).run<{userId:string;displayName:string;enteredAt:number}>()).results || [];
}
