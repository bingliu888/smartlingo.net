import { boundedJsonBody } from "@/lib/bounded-request-body";
import { getSessionUser } from "@/lib/auth";
import { classAccess, classByCode } from "@/lib/live-classrooms";
import { claimMemberRoom, MEMBER_ROOM_TAB_ID, onlineClassMembers, releaseMemberRoom } from "@/lib/class-member-room-presence";

export async function POST(request: Request, { params }: { params: Promise<{code:string}> }) {
  const room = await classByCode((await params).code);
  if (!room || room.status !== "active") return Response.json({error:"Course not found"},{status:404});
  const user = await getSessionUser(request);
  if (!user) return Response.json({error:"Members sign in to enter the room"},{status:401});
  if (!(await classAccess(room,user,true)).allowed) return Response.json({error:"Access denied"},{status:403});
  let input:{action?:string;tabId?:string};
  try { input = await boundedJsonBody(request,1024); }
  catch(error) { return error instanceof Response?error:Response.json({error:"Invalid presence request"},{status:400}); }
  if (!input.tabId || !MEMBER_ROOM_TAB_ID.test(input.tabId) || !["heartbeat","leave"].includes(String(input.action)))
    return Response.json({error:"Invalid presence request"},{status:400});
  if (input.action === "leave") {
    await releaseMemberRoom(room.id,user.id,input.tabId);
    return Response.json({ok:true},{headers:{"cache-control":"no-store"}});
  }
  if (!await claimMemberRoom(room.id,user.id,input.tabId,user.displayName))
    return Response.json({error:"This account is already in this course on another device",errorCode:"ALREADY_IN_ROOM"},
      {status:409,headers:{"cache-control":"no-store"}});
  const users = await onlineClassMembers(room.id);
  return Response.json({ok:true,onlineCount:users.length,users}, {headers:{"cache-control":"no-store"}});
}
