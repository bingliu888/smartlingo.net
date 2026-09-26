import { createId, getDatabase } from "@/lib/auth";
import { generateClassCode } from "@/lib/live-classrooms";

export async function helpRoomCode(): Promise<string | null> {
  const row=await getDatabase().prepare(`SELECT room.code FROM site_help_rooms help
    JOIN live_class_rooms room ON room.id=help.room_id
    JOIN users admin ON admin.id=room.host_user_id
    WHERE help.singleton=1 AND room.status='active' AND room.class_type='public'
      AND room.streaming_mode='audio' AND room.realtime_mode='webinar'
      AND room.password_hash IS NULL AND room.tuition_cents=0
      AND admin.role='admin' AND admin.email_verified=1
    LIMIT 1`).first<{code:string}>();
  return row?.code??null;
}

/** Repair a deployment where the administrator was created after the migration. */
export async function ensureHelpRoom(): Promise<string | null> {
  const existing=await helpRoomCode();
  if(existing)return existing;
  const db=getDatabase();
  if(await db.prepare("SELECT 1 FROM site_help_rooms WHERE singleton=1").first())return null;
  for(let attempt=0;attempt<3;attempt+=1){
    const id=createId(),code=await generateClassCode(),now=Math.floor(Date.now()/1000);
    try{
      await db.batch([
        db.prepare(`INSERT INTO live_class_rooms (
          id,code,host_user_id,host_email,host_name,title,description,subject,
          class_type,streaming_mode,realtime_mode,starts_at,duration_minutes,
          trial_minutes,tuition_cents,password_hash,provider_meeting_id,
          stream_active,mute_all,status,created_at,updated_at
        ) SELECT ?,?,admin.id,lower(admin.email),admin.display_name,?,?,'Help',
          'public','audio','webinar',?,480,0,0,NULL,NULL,0,0,'active',?,?
          FROM users admin WHERE admin.role='admin' AND admin.email_verified=1
            AND NOT EXISTS(SELECT 1 FROM site_help_rooms WHERE singleton=1)
          ORDER BY admin.created_at,admin.id LIMIT 1`)
          .bind(id,code,"Help · 帮助中心","",now,now,now),
        db.prepare(`INSERT INTO site_help_rooms(singleton,room_id)
          SELECT 1,id FROM live_class_rooms WHERE id=?
          ON CONFLICT(singleton) DO NOTHING`).bind(id),
      ]);
      return await helpRoomCode();
    }catch(error){
      if(!/UNIQUE constraint failed:\s*live_class_rooms\.code|SQLITE_CONSTRAINT_UNIQUE/i.test(String(error))||attempt===2)throw error;
      const winner=await helpRoomCode();if(winner)return winner;
    }
  }
  return null;
}
