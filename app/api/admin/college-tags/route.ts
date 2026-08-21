import { createId, getDatabase } from "../../../../lib/auth";
import { getAdminUser } from "../../../../lib/admin-access";

export async function POST(request:Request){
  const admin=await getAdminUser(request);if(!admin)return Response.json({error:"Permanent administrator access required"},{status:403});
  const input=await request.json().catch(()=>null) as Record<string,unknown>|null;
  const nameEn=String(input?.nameEn||"").trim().slice(0,40),nameZh=String(input?.nameZh||"").trim().slice(0,40);
  const slug=String(input?.slug||nameEn).trim().toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,40);
  if(nameEn.length<2||nameZh.length<1||slug.length<2)return Response.json({error:"Check the tag names"},{status:400});
  try{await getDatabase().prepare("INSERT INTO smartlingo_college_tags(id,slug,name_en,name_zh,sort_order,active,created_at,updated_at) VALUES(?,?,?,?,100,1,unixepoch(),unixepoch())").bind(createId(),slug,nameEn,nameZh).run();return Response.json({ok:true},{status:201});}
  catch{return Response.json({error:"The tag already exists or could not be created"},{status:400});}
}
