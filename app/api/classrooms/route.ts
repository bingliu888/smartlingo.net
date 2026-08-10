import { createClassRoom, directoryClasses } from "@/lib/live-classrooms";
import { getSessionUser } from "@/lib/auth";
import { isAdminUser } from "@/lib/admin-access";

export async function GET(request:Request){const user=await getSessionUser(request);const view=new URL(request.url).searchParams.get("view");const safe=view==="trial"||view==="private"||view==="mine"?view:"public";return Response.json({classes:await directoryClasses(safe,user),canCreate:await isAdminUser(user)});}
export async function POST(request:Request){const user=await getSessionUser(request);if(!user)return Response.json({error:"Sign in required"},{status:401});if(!await isAdminUser(user))return Response.json({error:"Administrator access required"},{status:403});try{return Response.json(await createClassRoom(user,await request.json()),{status:201});}catch(issue){return Response.json({error:issue instanceof Error?issue.message:"Unable to create class"},{status:400});}}
