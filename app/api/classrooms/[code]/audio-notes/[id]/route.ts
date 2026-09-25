import { classAccess, classByCode } from "@/lib/live-classrooms";
import { getDatabase, getSessionUser } from "@/lib/auth";
import { canManageClass } from "@/lib/class-managers";
import { boundedByteRange } from "@/lib/class-file-range";
import { cachedPrivateFileRange, cachedPrivateFileSize } from "@/lib/private-file-range-cache";
import { releaseStorageResource } from "@/lib/member-storage-quota";

type R2Object={body:ReadableStream<Uint8Array>;size:number};
type R2Bucket={head(key:string):Promise<{size:number}|null>;get(key:string,options?:{range?:{offset:number;length:number}}):Promise<R2Object|null>;delete(key:string):Promise<unknown>};
async function bucket(){const {env}=await import("cloudflare:workers");return env.CLASS_FILES as unknown as R2Bucket|undefined;}
type Context={params:Promise<{code:string;id:string}>};
async function lookup(code:string,id:string){
  const room=await classByCode(code);
  if(!room)return null;
  const note=await getDatabase().prepare(`SELECT object_key AS objectKey,content_type AS contentType,
    byte_size AS byteSize,created_at AS createdAt FROM class_room_audio_notes
    WHERE room_id=? AND id=? LIMIT 1`).bind(room.id,id)
    .first<{objectKey:string;contentType:string;byteSize:number;createdAt:number}>();
  return {room,note};
}

export async function GET(request:Request,{params}:Context){
  const {code,id}=await params;
  const data=await lookup(code,id);
  if(!data?.note)return new Response("Not found",{status:404});
  const user=await getSessionUser(request);
  if(!user||!(await classAccess(data.room,user)).allowed)
    return new Response("Course access required",{status:user?403:401});
  const storage=await bucket();
  if(!storage)return new Response("Storage unavailable",{status:503});
  const {note}=data,version=`${note.byteSize}:${note.createdAt}`;
  const size=await cachedPrivateFileSize({namespace:"class-audio-note",objectKey:note.objectKey,version,
    load:async()=>Number((await storage.head(note.objectKey))?.size||0)});
  if(size!==note.byteSize)return new Response("Recording temporarily unavailable",{status:503});
  const range=boundedByteRange(request.headers.get("range"),size,4*1024*1024,size>4*1024*1024);
  if(!range)return new Response("Invalid byte range",{status:416,headers:{"content-range":`bytes */${size}`,"cache-control":"no-store"}});
  const response=await cachedPrivateFileRange({namespace:"class-audio-note",objectKey:note.objectKey,version,
    offset:range.offset,length:range.length,load:()=>storage.get(note.objectKey,{range:{offset:range.offset,length:range.length}})});
  if(!response)return new Response("Not found",{status:404});
  const headers=new Headers(response.headers);
  headers.set("content-type",note.contentType);headers.set("content-length",String(range.length));
  headers.set("accept-ranges","bytes");headers.set("cache-control","private, no-store");
  headers.set("x-content-type-options","nosniff");headers.set("content-disposition","inline");
  if(range.contentRange)headers.set("content-range",range.contentRange);
  return new Response(response.body,{status:range.status,headers});
}

export async function DELETE(request:Request,{params}:Context){
  const {code,id}=await params;
  const data=await lookup(code,id);
  if(!data?.note)return Response.json({error:"Recording not found"},{status:404});
  const user=await getSessionUser(request);
  if(!user||!await canManageClass(data.room,user))return Response.json({error:"Manager access required"},{status:403});
  const now=Math.floor(Date.now()/1000);
  await getDatabase().batch([
    getDatabase().prepare(`INSERT INTO class_file_tombstones(object_key,room_id,resource_kind,
      resource_id,attempts,next_attempt_at,requested_at,updated_at)
      VALUES(?,?,'recording',?,0,?,?,?) ON CONFLICT(object_key)
      DO UPDATE SET next_attempt_at=MIN(next_attempt_at,excluded.next_attempt_at),updated_at=excluded.updated_at`)
      .bind(data.note.objectKey,data.room.id,id,now,now,now),
    getDatabase().prepare("DELETE FROM class_room_audio_notes WHERE id=? AND room_id=?").bind(id,data.room.id),
  ]);
  try{
    const storage=await bucket();if(!storage)throw new Error("STORAGE_UNAVAILABLE");
    await storage.delete(data.note.objectKey);
    await getDatabase().prepare("DELETE FROM class_file_tombstones WHERE object_key=?").bind(data.note.objectKey).run();
    await releaseStorageResource("recording_audio",id);
  }catch{/* Scheduled cleanup owns the tombstone. */}
  return Response.json({ok:true});
}
