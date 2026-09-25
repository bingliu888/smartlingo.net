import { consumeAccountRequestLimit } from "@/lib/account-request-limit";
import { createId, getDatabase, getSessionUser } from "@/lib/auth";
import { boundedJsonBody } from "@/lib/bounded-request-body";
import { classAccess, classByCode } from "@/lib/live-classrooms";
import { CHAT_MESSAGE_RETENTION_SECONDS, MAX_PERSISTED_CHAT_MESSAGES, canDeleteClassroomChatMessage, validSupportReplyTarget } from "@/lib/classroom-chat-policy";
import { onlineClassMembers } from "@/lib/class-member-room-presence";

type Context = {params:Promise<{code:string}>};
type ChatRow = {id:string;senderUserId:string|null;senderName:string;recipientUserId:string|null;recipientName:string|null;body:string;createdAt:number};
const nowSeconds=()=>Math.floor(Date.now()/1000);

async function context(request:Request,params:Context["params"]) {
  const room=await classByCode((await params).code);
  if(!room||room.status!=="active")return {error:Response.json({error:"Course not found"},{status:404})} as const;
  const user=await getSessionUser(request);
  if(!user)return {error:Response.json({error:"Members sign in to chat"},{status:401})} as const;
  const access=await classAccess(room,user);
  if(!access.allowed)return {error:Response.json({error:"Access denied"},{status:403})} as const;
  if(!access.manager && !(await onlineClassMembers(room.id)).some(member=>member.userId===user.id))
    return {error:Response.json({error:"Enter the course room before chatting"},{status:403})} as const;
  return {room,user,supportAgent:access.manager,error:null} as const;
}
async function limited(request:Request,roomId:string,userId:string) {
  return consumeAccountRequestLimit({request,scope:`class-chat:${roomId}`,userId,limit:60,windowSeconds:60});
}
async function supportUserIds(roomId:string,hostUserId:string) {
  const ids=new Set<string>([hostUserId]);
  const cohosts=(await getDatabase().prepare(`SELECT user_id AS userId FROM live_class_cohosts WHERE room_id=? AND identity_bound_at>0`)
    .bind(roomId).run<{userId:string}>()).results||[];
  cohosts.forEach(item=>ids.add(item.userId));
  return ids;
}

export async function GET(request:Request,{params}:Context) {
  const state=await context(request,params);if(state.error)return state.error;
  const {room,user,supportAgent}=state;
  // Filter by viewer before LIMIT: other members cannot displace private history.
  const rows=(await getDatabase().prepare(`SELECT chat.id,chat.sender_user_id AS senderUserId,
    chat.sender_name AS senderName,chat.recipient_user_id AS recipientUserId,
    recipient.display_name AS recipientName,chat.body,chat.created_at AS createdAt
    FROM live_class_chat_messages chat LEFT JOIN users recipient ON recipient.id=chat.recipient_user_id
    WHERE chat.room_id=? AND chat.created_at>?
      AND (?=1 OR chat.sender_user_id=? OR chat.recipient_user_id=?)
    ORDER BY chat.created_at DESC,chat.id DESC LIMIT 100`)
    .bind(room.id,nowSeconds()-CHAT_MESSAGE_RETENTION_SECONDS,supportAgent?1:0,user.id,user.id)
    .run<ChatRow>()).results||[];
  const managers=await supportUserIds(room.id,room.hostUserId);
  return Response.json({supportAgent,messages:rows.reverse().map(row=>({
    id:row.id,senderName:row.senderName,body:row.body,createdAt:row.createdAt,
    privateReply:Boolean(row.recipientUserId),recipientName:supportAgent?row.recipientName:null,
    canReply:supportAgent&&Boolean(row.senderUserId&&!managers.has(row.senderUserId)&&!row.recipientUserId),
    canDelete:canDeleteClassroomChatMessage(row.senderUserId,user.id,supportAgent),
  }))},{headers:{"cache-control":"private, no-cache"}});
}

export async function POST(request:Request,{params}:Context) {
  const state=await context(request,params);if(state.error)return state.error;
  const {room,user,supportAgent}=state;
  const rate=await limited(request,room.id,user.id);if(rate)return rate;
  let input:{body?:unknown;replyToMessageId?:unknown};
  try{input=await boundedJsonBody(request,8*1024);}catch(error){return error instanceof Response?error:Response.json({error:"Invalid message"},{status:400});}
  const body=String(input.body||"").trim();
  if(!body||body.length>2000)return Response.json({error:"Message must contain 1–2,000 characters"},{status:400});
  const replyToMessageId=String(input.replyToMessageId||"").trim();
  if(replyToMessageId.length>128)return Response.json({error:"Invalid reply target"},{status:400});
  if(replyToMessageId&&!supportAgent)return Response.json({error:"Only the host team can reply privately"},{status:403});
  if(supportAgent&&!replyToMessageId)return Response.json({error:"Choose a member message to reply to"},{status:400});
  let recipientUserId:string|null=null;
  if(replyToMessageId){
    const target=await getDatabase().prepare(`SELECT sender_user_id AS senderUserId,recipient_user_id AS recipientUserId
      FROM live_class_chat_messages WHERE id=? AND room_id=? AND created_at>? LIMIT 1`)
      .bind(replyToMessageId,room.id,nowSeconds()-CHAT_MESSAGE_RETENTION_SECONDS)
      .first<{senderUserId:string|null;recipientUserId:string|null}>();
    const managers=await supportUserIds(room.id,room.hostUserId);
    if(!validSupportReplyTarget(target?{...target,senderIsSupportAgent:Boolean(target.senderUserId&&managers.has(target.senderUserId))}:null))
      return Response.json({error:"Reply target not found"},{status:404});
    recipientUserId=target!.senderUserId;
  }
  const now=nowSeconds();
  await getDatabase().batch([
    getDatabase().prepare(`INSERT INTO live_class_chat_messages(id,room_id,sender_user_id,sender_name,recipient_user_id,body,created_at)
      VALUES(?,?,?,?,?,?,?)`).bind(createId(),room.id,user.id,user.displayName,recipientUserId,body,now),
    getDatabase().prepare(`DELETE FROM live_class_chat_messages WHERE id IN (SELECT id FROM live_class_chat_messages
      WHERE room_id=? ORDER BY created_at DESC,id DESC LIMIT -1 OFFSET ?)`)
      .bind(room.id,MAX_PERSISTED_CHAT_MESSAGES),
    getDatabase().prepare(`DELETE FROM live_class_chat_messages WHERE room_id=? AND created_at<=?`)
      .bind(room.id,now-CHAT_MESSAGE_RETENTION_SECONDS),
  ]);
  return Response.json({ok:true},{status:201});
}

export async function DELETE(request:Request,{params}:Context) {
  const state=await context(request,params);if(state.error)return state.error;
  const {room,user,supportAgent}=state;
  const rate=await limited(request,room.id,user.id);if(rate)return rate;
  let input:{messageId?:unknown};
  try{input=await boundedJsonBody(request,4*1024);}catch(error){return error instanceof Response?error:Response.json({error:"Invalid message"},{status:400});}
  const id=String(input.messageId||"").trim();if(!id||id.length>128)return Response.json({error:"Valid message required"},{status:400});
  const result=await getDatabase().prepare(`DELETE FROM live_class_chat_messages WHERE id=? AND room_id=? AND (?=1 OR sender_user_id=?)`)
    .bind(id,room.id,supportAgent?1:0,user.id).run();
  if(!result.meta?.changes)return Response.json({error:"Message not found"},{status:404});
  return Response.json({ok:true});
}
