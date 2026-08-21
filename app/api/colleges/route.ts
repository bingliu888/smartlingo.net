import { getAdminUser } from "../../../lib/admin-access";
import { createCollege } from "../../../lib/smartlingo-colleges";

export async function POST(request:Request){
  const admin=await getAdminUser(request);if(!admin)return Response.json({error:"Permanent administrator access required"},{status:403});
  const input=await request.json().catch(()=>null) as Record<string,unknown>|null;if(!input)return Response.json({error:"Invalid request"},{status:400});
  try{return Response.json(await createCollege(admin,input),{status:201});}
  catch(error){const message=error instanceof Error?error.message:"";return Response.json({error:message==="INVALID_COLLEGE_PRICE"?"Referred colleges require a price of at least $1 and one referral day":"Check the college names, access type, price, and tag"},{status:400});}
}
