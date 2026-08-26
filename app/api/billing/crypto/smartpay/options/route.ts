import { currentSmartPayCheckoutOptions } from "@/lib/smartpay-checkout-server";
export async function GET(){try{return Response.json({options:await currentSmartPayCheckoutOptions()},{headers:{"cache-control":"private, no-store"}});}catch{return Response.json({error:"On-chain payment options are temporarily unavailable"},{status:503});}}
