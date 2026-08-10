import { getDatabase, createId, getSessionUser, type SessionUser } from "@/lib/auth";
import { isAdminUser } from "@/lib/admin-access";

export type ClassType = "public" | "trial" | "private";
export type StreamingMode = "audio" | "video";
export type RealtimeMode = "group_call" | "webinar" | "livestream";
export type ClassRoom = {
  id: string; code: string; hostUserId: string; hostEmail: string; hostName: string;
  title: string; description: string; subject: string; classType: ClassType;
  streamingMode: StreamingMode; realtimeMode: RealtimeMode; startsAt: number; durationMinutes: number;
  trialMinutes: number; tuitionCents: number; hasPassword: number;
  providerMeetingId: string | null; streamActive: number; muteAll: number;
  status: "active" | "archived"; createdAt: number; updatedAt: number;
};

const selection = `SELECT r.id,r.code,r.host_user_id AS hostUserId,r.host_email AS hostEmail,r.host_name AS hostName,
  r.title,r.description,r.subject,r.class_type AS classType,r.streaming_mode AS streamingMode,r.realtime_mode AS realtimeMode,r.starts_at AS startsAt,
  r.duration_minutes AS durationMinutes,r.trial_minutes AS trialMinutes,r.tuition_cents AS tuitionCents,
  CASE WHEN r.password_hash IS NULL THEN 0 ELSE 1 END AS hasPassword,r.provider_meeting_id AS providerMeetingId,
  r.stream_active AS streamActive,r.mute_all AS muteAll,r.status,r.created_at AS createdAt,r.updated_at AS updatedAt
  FROM live_class_rooms r`;

export async function classByCode(code: string) {
  return getDatabase().prepare(`${selection} WHERE code=? LIMIT 1`).bind(code).first<ClassRoom>();
}

export async function directoryClasses(view: "public" | "trial" | "private" | "mine", user: SessionUser | null) {
  const db = getDatabase();
  if (view === "mine") {
    if (!user || !await isAdminUser(user)) return [];
    return (await db.prepare(`${selection} WHERE r.host_user_id=? AND r.status='active' ORDER BY r.updated_at DESC LIMIT 100`).bind(user.id).run<ClassRoom>()).results || [];
  }
  if (view === "private") {
    if (!user) return [];
    return (await db.prepare(`${selection} JOIN live_class_invites i ON i.room_id=r.id WHERE r.class_type='private' AND r.status='active' AND (lower(i.email)=lower(?) OR r.host_user_id=?) ORDER BY r.updated_at DESC LIMIT 100`).bind(user.email,user.id).run<ClassRoom>()).results || [];
  }
  return (await db.prepare(`${selection} WHERE r.class_type=? AND r.status='active' ORDER BY r.starts_at,r.updated_at DESC LIMIT 100`).bind(view).run<ClassRoom>()).results || [];
}

export async function generateClassCode() {
  for (let attempt=0; attempt<30; attempt+=1) {
    const code=String(crypto.getRandomValues(new Uint32Array(1))[0]%1_000_000).padStart(6,"0");
    if (!await classByCode(code)) return code;
  }
  throw new Error("CLASS_CODE_EXHAUSTED");
}

async function hashPassword(value: string) {
  const bytes=new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value)));
  return Array.from(bytes,byte=>byte.toString(16).padStart(2,"0")).join("");
}

export async function verifyClassPassword(value: string, hash: string | null) {
  return !hash || await hashPassword(value) === hash;
}

export async function createClassRoom(user: SessionUser, input: Record<string,unknown>) {
  if (!await isAdminUser(user)) throw new Error("ADMIN_REQUIRED");
  const title=String(input.title||"").trim().slice(0,120);
  const description=String(input.description||"").trim().slice(0,2000);
  const subject=String(input.subject||"").trim().slice(0,80);
  const classType:ClassType=input.classType==="private"?"private":input.classType==="trial"?"trial":"public";
  const streamingMode:StreamingMode=input.streamingMode==="audio"?"audio":"video";
  const realtimeMode:RealtimeMode=input.realtimeMode==="webinar"?"webinar":input.realtimeMode==="livestream"?"livestream":"group_call";
  const startsAt=Math.floor(new Date(String(input.startsAt||new Date().toISOString())).getTime()/1000);
  const durationMinutes=Math.max(15,Math.min(480,Number(input.durationMinutes)||60));
  const trialMinutes=classType==="trial"?Math.max(5,Math.min(1440,Number(input.trialMinutes)||30)):0;
  const tuitionCents=classType==="trial"?Math.max(100,Math.min(10_000_000,Math.round(Number(input.tuition||0)*100))):0;
  const password=classType==="private"?"":String(input.password||"").trim();
  if(title.length<3||!Number.isFinite(startsAt))throw new Error("INVALID_CLASS");
  if(password&&(password.length<4||password.length>72))throw new Error("INVALID_PASSWORD");
  const id=createId(),code=await generateClassCode(),now=Math.floor(Date.now()/1000),db=getDatabase();
  await db.prepare(`INSERT INTO live_class_rooms(id,code,host_user_id,host_email,host_name,title,description,subject,class_type,streaming_mode,realtime_mode,starts_at,duration_minutes,trial_minutes,tuition_cents,password_hash,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(id,code,user.id,user.email,user.displayName,title,description,subject,classType,streamingMode,realtimeMode,startsAt,durationMinutes,trialMinutes,tuitionCents,password?await hashPassword(password):null,now,now).run();
  const invites=String(input.invites||"").split(/[\s,;]+/).map(item=>item.trim().toLowerCase()).filter(item=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item));
  for(const email of new Set(invites))await db.prepare("INSERT OR IGNORE INTO live_class_invites(id,room_id,email,created_at) VALUES(?,?,?,?)").bind(createId(),id,email,now).run();
  return {id,code};
}

export async function classAccess(room: ClassRoom, user: SessionUser | null) {
  const admin=await isAdminUser(user);
  const host=Boolean(user&&room.hostUserId===user.id);
  if(room.classType!=="private")return {allowed:true,admin,host,manager:admin||host};
  if(admin||host)return {allowed:true,admin,host,manager:true};
  if(!user)return {allowed:false,admin:false,host:false,manager:false};
  const invited=await getDatabase().prepare("SELECT id FROM live_class_invites WHERE room_id=? AND lower(email)=lower(?) LIMIT 1").bind(room.id,user.email).first();
  return {allowed:Boolean(invited),admin:false,host:false,manager:false};
}

export async function currentClassUser(request?: Request) { return getSessionUser(request); }
