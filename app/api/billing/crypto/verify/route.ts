import { getDatabase, getSessionUser } from "@/lib/auth";
import { cryptoPaymentSettingById,cryptoPlan,tokenAmountFor,tokenAmountToAtomic } from "@/lib/crypto-payments";
import { addressTopic,cryptoRpc,cryptoRpcUrl,TRANSFER_TOPIC } from "@/lib/crypto-rpc";
import { fixedCourseId } from "@/lib/smartlingo-course-packages";
import { isSmartLingoCommunityLanguage } from "@/lib/smartlingo-language-communities";

export async function POST(request:Request){
 try{
  const user=await getSessionUser();if(!user)return Response.json({error:"Sign in required"},{status:401});
  const body=await request.json().catch(()=>null) as {settingId?:string;plan?:string;languageCode?:string;txHash?:string}|null;
  const setting=await cryptoPaymentSettingById(String(body?.settingId||"")),plan=cryptoPlan(body?.plan),languageCode=String(body?.languageCode||""),txHash=String(body?.txHash||"").toLowerCase();
  if(!setting||!plan||!isSmartLingoCommunityLanguage(languageCode)||!/^0x[a-f0-9]{64}$/.test(txHash))return Response.json({error:"Select a valid course, language, rail, and transaction hash"},{status:400});
  const db=getDatabase();if(await db.prepare("SELECT id FROM crypto_payment_claims WHERE tx_hash=?").bind(txHash).first())return Response.json({error:"This transaction was already claimed"},{status:409});
  const account=await db.prepare("SELECT wallet_address AS wallet FROM users WHERE id=?").bind(user.id).first<{wallet:string|null}>();if(!account?.wallet)return Response.json({error:"Save the payer wallet first"},{status:409});
  const classId=fixedCourseId(languageCode,plan.id),course=await db.prepare("SELECT id,price_cents AS priceCents,package_tier AS tier FROM smartlingo_language_classes WHERE id=? AND class_kind='official_course' AND status='open'").bind(classId).first<{id:string;priceCents:number;tier:string}>();
  if(!course||course.tier!==plan.id||course.priceCents!==plan.priceCents)return Response.json({error:"The selected fixed-price course is unavailable"},{status:409});
  const url=await cryptoRpcUrl(setting.chainId);if(!url)return Response.json({error:"Blockchain RPC is not configured"},{status:503});
  const receipt=await cryptoRpc(url,"eth_getTransactionReceipt",[txHash]) as {status?:string;blockNumber?:string;logs?:Array<{address?:string;topics?:string[];data?:string}>};if(receipt.status!=="0x1"||!receipt.blockNumber)return Response.json({error:"Transaction is not confirmed successfully"},{status:422});
  const latest=BigInt(await cryptoRpc(url,"eth_blockNumber",[]) as string),confirmations=Number(latest-BigInt(receipt.blockNumber)+BigInt(1));if(confirmations<setting.minConfirmations)return Response.json({error:`Waiting for ${setting.minConfirmations-confirmations} more confirmations`},{status:425});
  const transfer=(receipt.logs||[]).find(log=>log.address?.toLowerCase()===setting.tokenContract.toLowerCase()&&log.topics?.[0]?.toLowerCase()===TRANSFER_TOPIC&&log.topics?.[1]?.toLowerCase()===addressTopic(account.wallet!)&&log.topics?.[2]?.toLowerCase()===addressTopic(setting.receiverWallet));if(!transfer?.data)return Response.json({error:"No matching ERC-20 transfer from payer to receiver was found"},{status:422});
  const observed=BigInt(transfer.data),expected=tokenAmountToAtomic(tokenAmountFor(setting,plan.id),setting.tokenDecimals);if(observed<expected)return Response.json({error:"Transferred amount is below the selected course price"},{status:422});
  const now=Math.floor(Date.now()/1000),periodEnds=now+30*24*60*60,claimId=crypto.randomUUID();
  await db.prepare(`INSERT INTO crypto_payment_claims(id,user_id,setting_id,tx_hash,plan_id,language_code,class_id,chain_id,chain_name,token_symbol,payer_wallet,receiver_wallet,expected_atomic_amount,observed_atomic_amount,status,entitlement_status,verified_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,'verified','pending_sync',?)`).bind(claimId,user.id,setting.id,txHash,plan.id,languageCode,classId,setting.chainId,setting.chainName,setting.tokenSymbol,account.wallet,setting.receiverWallet,expected.toString(),observed.toString(),now).run();
  await db.prepare(`INSERT INTO smartlingo_course_subscriptions(id,class_id,user_id,status,monthly_price_cents,trial_started_at,trial_ends_at,current_period_ends_at,provider_subscription_id,created_at,updated_at) VALUES(?,?,?,'active',?,?,?,?,?,?,?) ON CONFLICT(class_id,user_id) DO UPDATE SET status='active',monthly_price_cents=excluded.monthly_price_cents,current_period_ends_at=excluded.current_period_ends_at,provider_subscription_id=excluded.provider_subscription_id,updated_at=excluded.updated_at`).bind(crypto.randomUUID(),classId,user.id,plan.priceCents,now,now,periodEnds,`crypto:${txHash}`,now,now).run();
  await db.prepare(`INSERT INTO smartlingo_language_class_members(id,class_id,user_id,role,status,joined_at,updated_at) VALUES(?,?,?,'student','active',?,?) ON CONFLICT(class_id,user_id) DO UPDATE SET role='student',status='active',updated_at=excluded.updated_at`).bind(crypto.randomUUID(),classId,user.id,now,now).run();
  await db.prepare(`INSERT INTO subscriptions(id,user_id,cadence,status,current_period_ends_at,cancel_at_period_end,created_at,updated_at) VALUES(?,?,'monthly','active',?,0,?,?) ON CONFLICT(user_id) DO UPDATE SET cadence='monthly',status='active',current_period_ends_at=excluded.current_period_ends_at,cancel_at_period_end=0,updated_at=excluded.updated_at`).bind(crypto.randomUUID(),user.id,periodEnds,now,now).run();
  await db.prepare("UPDATE crypto_payment_claims SET entitlement_status='synced' WHERE id=?").bind(claimId).run();
  return Response.json({verified:true,entitlementStatus:"synced",classId});
 }catch{return Response.json({error:"Server-side on-chain verification is temporarily unavailable"},{status:502});}
}
