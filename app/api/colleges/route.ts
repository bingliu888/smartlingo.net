import { getSessionUser } from "../../../lib/auth";
import { canCreateCollege, createCollege } from "../../../lib/smartlingo-colleges";

export async function POST(request:Request){
  const user=await getSessionUser(request);if(!user)return Response.json({error:"Authentication required"},{status:401});
  if(!await canCreateCollege(user))return Response.json({error:"College Supervisor license required"},{status:403});
  const input=await request.json().catch(()=>null) as Record<string,unknown>|null;if(!input)return Response.json({error:"Invalid request"},{status:400});
  try{return Response.json(await createCollege(user,input),{status:201});}
  catch(error){const message=error instanceof Error?error.message:"";return Response.json({error:message==="INVALID_COLLEGE_PRICE"?"Referred colleges require a price of at least $1 and one referral day":"Check the college names, access type, price, and tag"},{status:400});}
}
