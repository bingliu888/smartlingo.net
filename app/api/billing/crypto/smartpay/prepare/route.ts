import { getSessionUser } from "@/lib/auth";
import { currentSmartPayCheckoutOption } from "@/lib/smartpay-checkout-server";
import { ensureSmartPayRefId } from "@/lib/smartpay-refid";
export async function POST(request:Request){const user=await getSessionUser(request);if(!user)return Response.json({error:"Sign in required"},{status:401});const body=await request.json().catch(()=>null) as {settingId?:string;classId?:string}|null;const option=await currentSmartPayCheckoutOption(String(body?.settingId||""),String(body?.classId||""));if(!option)return Response.json({error:"The selected on-chain course rule is unavailable"},{status:409});return Response.json({option,refId:await ensureSmartPayRefId(user.id)},{headers:{"cache-control":"private, no-store"}});}
