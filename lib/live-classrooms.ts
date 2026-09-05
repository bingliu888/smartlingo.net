import { getDatabase, getSessionUser, type SessionUser } from "@/lib/auth";
import { isAdminUser } from "@/lib/admin-access";
import { bindVerifiedClassInvites, canManageClass, paidClassAccess } from "@/lib/class-managers";
import { verifyStoredClassPassword } from "@/lib/class-password";

export type ClassType = "public" | "trial" | "private";
export type StreamingMode = "audio" | "video";
export type RealtimeMode = "group_call" | "webinar" | "livestream";
export type ClassRoom = {
  id: string; code: string; hostUserId: string; hostEmail: string; hostName: string;
  title: string; description: string; subject: string; classType: ClassType;
  streamingMode: StreamingMode; realtimeMode: RealtimeMode; startsAt: number; durationMinutes: number;
  trialMinutes: number; tuitionCents: number; hasPassword: number;
  providerMeetingId: string | null; streamActive: number; muteAll: number;
  providerGeneration: number; providerGenerationStartedAt: number | null;
  liveStartedAt: number | null; timeZone: string; providerCreateDeadlineAt: number | null;
  status: "active" | "archived"; createdAt: number; updatedAt: number;
};

const selection = `SELECT r.id,r.code,r.host_user_id AS hostUserId,r.host_email AS hostEmail,r.host_name AS hostName,
  r.title,r.description,r.subject,r.class_type AS classType,r.streaming_mode AS streamingMode,r.realtime_mode AS realtimeMode,r.starts_at AS startsAt,
  r.duration_minutes AS durationMinutes,r.trial_minutes AS trialMinutes,r.tuition_cents AS tuitionCents,
  CASE WHEN r.password_hash IS NULL THEN 0 ELSE 1 END AS hasPassword,r.provider_meeting_id AS providerMeetingId,
  r.stream_active AS streamActive,r.mute_all AS muteAll,
  r.provider_generation AS providerGeneration,r.provider_generation_started_at AS providerGenerationStartedAt,
  r.live_started_at AS liveStartedAt,r.time_zone AS timeZone,
  r.provider_create_deadline_at AS providerCreateDeadlineAt,
  r.status,r.created_at AS createdAt,r.updated_at AS updatedAt
  FROM live_class_rooms r`;

export async function classByCode(code: string) {
  return getDatabase().prepare(`${selection} WHERE code=? LIMIT 1`).bind(code).first<ClassRoom>();
}

export async function generateClassCode() {
  for (let attempt=0; attempt<30; attempt+=1) {
    const code=String(crypto.getRandomValues(new Uint32Array(1))[0]%1_000_000).padStart(6,"0");
    if (!await classByCode(code)) return code;
  }
  throw new Error("CLASS_CODE_EXHAUSTED");
}

export async function verifyClassPassword(value: string, hash: string | null) {
  return verifyStoredClassPassword(value, hash);
}

export async function verifyClassEntryPassword(code: string, value: string) {
  const row = await getDatabase().prepare("SELECT password_hash AS passwordHash FROM live_class_rooms WHERE code=? LIMIT 1").bind(code).first<{passwordHash:string|null}>();
  return verifyClassPassword(value, row?.passwordHash ?? null);
}

export async function recordClassJoin(userId:string,roomId:string,joinedAt=Math.floor(Date.now()/1000)){
  await getDatabase().prepare(`INSERT INTO live_class_join_history(user_id,room_id,first_joined_at,last_joined_at) VALUES(?,?,?,?) ON CONFLICT(user_id,room_id) DO UPDATE SET last_joined_at=excluded.last_joined_at`).bind(userId,roomId,joinedAt,joinedAt).run();
}

export async function classAccess(room: ClassRoom, user: SessionUser | null, startTrial=false) {
  const admin=await isAdminUser(user);
  const host=Boolean(user&&room.hostUserId===user.id),manager=await canManageClass(room,user);
  if(room.classType==="trial"){const paid=await paidClassAccess(room,user,startTrial);return {...paid,admin,host,manager};}
  if(room.classType!=="private")return {allowed:true,admin,host,manager};
  if(manager)return {allowed:true,admin,host,manager:true};
  if(!user)return {allowed:false,admin:false,host:false,manager:false};
  if(!user.emailVerified
    || user.identityCheckedAt<=Math.floor(Date.now()/1_000)-5*60)
    return {allowed:false,admin:false,host:false,manager:false};
  const courseMember=await getDatabase().prepare(`SELECT linked.course_id FROM (
      SELECT course_id,room_id FROM smartlingo_course_classrooms
      UNION ALL
      SELECT course_id,room_id FROM smartlingo_course_practice_rooms
    ) linked
    JOIN smartlingo_language_classes c ON c.id=linked.course_id
    LEFT JOIN smartlingo_language_class_members m ON m.class_id=c.id AND m.user_id=?
    LEFT JOIN smartlingo_course_subscriptions s ON s.class_id=c.id AND s.user_id=?
    WHERE linked.room_id=? AND (c.owner_user_id=? OR (m.status='active' AND
      ((s.status='active' AND s.current_period_ends_at>unixepoch()) OR (s.status='trialing' AND s.trial_ends_at>unixepoch())))) LIMIT 1`).bind(user.id,user.id,room.id,user.id).first();
  if(courseMember)return {allowed:true,admin:false,host,manager};
  await bindVerifiedClassInvites(user);
  const invited=await getDatabase().prepare("SELECT id FROM live_class_invites WHERE room_id=? AND user_id=? LIMIT 1").bind(room.id,user.id).first();
  return {allowed:Boolean(invited),admin:false,host:false,manager:false};
}

export async function currentClassUser(request?: Request) { return getSessionUser(request); }
