import { getSessionUser } from "../../../../lib/auth";
import { canManageCollege, collegeByCode, updateCollege } from "../../../../lib/smartlingo-colleges";

export async function PATCH(request:Request,{params}:{params:Promise<{code:string}>}){
  const user=await getSessionUser(request),college=await collegeByCode((await params).code);
  if(!college)return Response.json({error:"College not found"},{status:404});
  if(!canManageCollege(college,user))return Response.json({error:"Forbidden"},{status:403});
  const input=await request.json().catch(()=>null) as Record<string,unknown>|null;if(!input)return Response.json({error:"Invalid request"},{status:400});
  try{await updateCollege(college,input);return Response.json({ok:true});}
  catch{return Response.json({error:"Check the college names, access type, price, and tag"},{status:400});}
}
