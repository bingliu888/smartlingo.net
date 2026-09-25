import { boundedRequestStream } from "@/lib/bounded-request-body";
import { classAccess, classByCode } from "@/lib/live-classrooms";
import { createId, getDatabase, getSessionUser } from "@/lib/auth";
import { canManageClass } from "@/lib/class-managers";
import { hasMemberRoomTab } from "@/lib/class-member-room-presence";
import { reserveMemberStorage, commitMemberStorageReservation, releaseMemberStorageReservation } from "@/lib/member-storage-quota";
import { canAddClassAudioNote } from "@/lib/class-room-audio-notes";
import { AUDIO_NOTE_TYPES, audioNoteDurationAllowed, MAX_AUDIO_NOTE_BYTES } from "@/lib/class-room-audio-note-policy";

type R2Bucket = { put(key: string, value: ReadableStream<Uint8Array>, options: { httpMetadata: { contentType: string } }): Promise<{size?: number}|null>; delete(key: string): Promise<unknown> };
async function bucket() { const {env} = await import("cloudflare:workers"); return env.CLASS_FILES as unknown as R2Bucket|undefined; }
type Context = {params: Promise<{code:string}>};

export async function GET(request:Request,{params}:Context) {
  const room=await classByCode((await params).code);
  if(!room)return Response.json({error:"Course not found"},{status:404});
  const user=await getSessionUser(request);
  if(!user||!(await classAccess(room,user)).allowed)return Response.json({error:"Course access required"},{status:user?403:401});
  const items=(await getDatabase().prepare(`SELECT id,content_type AS contentType,byte_size AS byteSize,
    recording_seconds AS recordingSeconds,source,created_at AS createdAt
    FROM class_room_audio_notes WHERE room_id=? ORDER BY created_at DESC,id DESC LIMIT 100`)
    .bind(room.id).run()).results||[];
  return Response.json({items,canAdd:await canManageClass(room,user)&&await canAddClassAudioNote(user)},
    {headers:{"cache-control":"no-store"}});
}

export async function POST(request:Request,{params}:Context) {
  const room=await classByCode((await params).code);
  if(!room)return Response.json({error:"Course not found"},{status:404});
  const user=await getSessionUser(request);
  if(!user||!await canManageClass(room,user))return Response.json({error:"Manager access required"},{status:403});
  if(!await canAddClassAudioNote(user))return Response.json({error:"Subscription required"},{status:402});
  if(!user.emailVerified)return Response.json({error:"Verify your email before uploading recordings"},{status:403});
  if(!await hasMemberRoomTab(room.id,user.id,request.headers.get("x-room-tab-id")||""))
    return Response.json({error:"Join the course room before recording"},{status:403});
  const source=request.headers.get("x-recording-source")||"";
  const seconds=Number(request.headers.get("x-recording-seconds"));
  if(!audioNoteDurationAllowed(source,seconds))return Response.json({error:"Recording duration exceeds the allowed limit"},{status:400});
  const contentType=(request.headers.get("content-type")||"").split(";")[0].toLowerCase().trim();
  const extension=AUDIO_NOTE_TYPES[contentType];
  if(!extension)return Response.json({error:"Supported audio file required"},{status:415});
  const claimed=Number(request.headers.get("x-recording-size"));
  if(!Number.isSafeInteger(claimed)||claimed<1||claimed>MAX_AUDIO_NOTE_BYTES)
    return Response.json({error:"Choose audio up to 100 MB"},{status:413});
  const count=Number((await getDatabase().prepare("SELECT COUNT(*) AS count FROM class_room_audio_notes WHERE room_id=?")
    .bind(room.id).first<{count:number}>())?.count||0);
  if(count>=100)return Response.json({error:"This room already has 100 recordings"},{status:409});
  const storage=await bucket();
  if(!storage)return Response.json({error:"Recording storage is unavailable"},{status:503});
  const id=createId(),key=`classes/${room.id}/audio-notes/${id}.${extension}`;
  let reservation:{id:string}|null=null;
  try{
    reservation=await reserveMemberStorage({hostUserId:room.hostUserId,roomId:room.id,
      resourceKind:"recording_audio",resourceId:id,bytes:claimed,expiresInSeconds:2*60*60});
    const stream=boundedRequestStream(request,MAX_AUDIO_NOTE_BYTES);
    const FixedLength=(globalThis as unknown as {FixedLengthStream?:new(size:number)=>{readable:ReadableStream<Uint8Array>;writable:WritableStream<Uint8Array>}}).FixedLengthStream;
    if(!FixedLength)throw new Error("FIXED_LENGTH_STREAM_UNAVAILABLE");
    const fixed=new FixedLength(claimed);
    const piping=stream.body.pipeTo(fixed.writable);
    let object;
    try{[object]=await Promise.all([storage.put(key,fixed.readable,{httpMetadata:{contentType}}),piping]);}
    catch(error){await piping.catch(()=>undefined);throw error;}
    if(stream.receivedBytes()!==claimed||(object?.size&&object.size!==claimed))throw new Error("UPLOAD_SIZE_MISMATCH");
    if(!await canManageClass(room,user)||!await canAddClassAudioNote(user)||
      !await hasMemberRoomTab(room.id,user.id,request.headers.get("x-room-tab-id")||""))
      throw new Error("RECORDING_PERMISSION_CHANGED");
    const now=Math.floor(Date.now()/1000);
    const result=await getDatabase().prepare(`INSERT INTO class_room_audio_notes(
      id,room_id,uploader_user_id,object_key,content_type,byte_size,recording_seconds,source,created_at)
      SELECT ?,?,?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM class_room_audio_notes WHERE room_id=?)<100`)
      .bind(id,room.id,user.id,key,contentType,claimed,Math.ceil(seconds),source,now,room.id).run();
    if(Number(result.meta?.changes||0)!==1)throw new Error("RECORDING_LIMIT_REACHED");
    try{await commitMemberStorageReservation(reservation.id,claimed);}
    catch(error){await getDatabase().prepare("DELETE FROM class_room_audio_notes WHERE id=?").bind(id).run();throw error;}
    return Response.json({id,status:"ready"},{status:201});
  }catch(error){
    await storage.delete(key).catch(()=>undefined);
    if(reservation)await releaseMemberStorageReservation(reservation.id).catch(()=>undefined);
    const code=error instanceof Error?error.message:"RECORDING_UPLOAD_FAILED";
    return Response.json({error:code==="MEMBER_STORAGE_QUOTA_EXCEEDED"?"Account storage quota exceeded":"Unable to save recording",errorCode:code},
      {status:code==="MEMBER_STORAGE_QUOTA_EXCEEDED"?413:code==="RECORDING_LIMIT_REACHED"?409:500});
  }
}
