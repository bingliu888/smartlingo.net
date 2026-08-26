import type { Address, Hex } from "viem";
import { getDatabase, type SessionUser } from "./auth";
import { cryptoRpcUrl } from "./crypto-rpc";
import { cryptoPaymentSettingById } from "./crypto-payments";
import { currentSmartPayCheckoutOption } from "./smartpay-checkout-server";
import { ensureSmartPayRefId, normalizeSmartPayRefId } from "./smartpay-refid";
import { smartPay3TransactionById, verifySmartPay3Identity } from "./smartpay3-server";

const YEAR_SECONDS = 365 * 24 * 60 * 60;
const sameAddress = (left: string, right: string) => left.toLowerCase() === right.toLowerCase();

export async function smartPayUserIdentity(userId: string) {
  const database = getDatabase();
  const row = await database.prepare("SELECT wallet_address AS wallet FROM users WHERE id=? LIMIT 1")
    .bind(userId).first<{ wallet: string | null }>();
  return { wallet: row?.wallet?.toLowerCase() || "", refId: await ensureSmartPayRefId(userId) };
}

export async function claimSmartLingoCoursePayment(input: {
  actor: SessionUser;
  targetUserId?: string;
  settingId: string;
  transactionId: string;
  classId?: string;
}) {
  const database = getDatabase();
  const targetUserId = input.targetUserId || input.actor.id;
  const setting = await cryptoPaymentSettingById(input.settingId);
  if (!setting?.smartPay3Contract || !/^0x[a-fA-F0-9]{40}$/.test(setting.smartPay3Contract)) throw new Error("PAYMENT_OPTION_UNAVAILABLE");
  const transactionId = input.transactionId.toLowerCase();
  if (!/^0x[a-f0-9]{64}$/.test(transactionId)) throw new Error("INVALID_TRANSACTION_ID");
  const prior = await database.prepare(`SELECT user_id AS userId,class_id AS classId,current_period_ends_at AS currentPeriodEnd
    FROM smartpay3_payment_claims WHERE lower(contract_address)=lower(?) AND lower(transaction_id)=lower(?) LIMIT 1`)
    .bind(setting.smartPay3Contract, transactionId).first<{ userId: string; classId: string; currentPeriodEnd: number }>();
  if (prior) {
    if (prior.userId !== targetUserId) throw new Error("TRANSACTION_ALREADY_CLAIMED");
    return { verified: true, alreadyRecorded: true, classId: prior.classId, currentPeriodEnd: prior.currentPeriodEnd, paymentId: transactionId };
  }
  const identity = await smartPayUserIdentity(targetUserId);
  if (!/^0x[a-f0-9]{40}$/.test(identity.wallet)) throw new Error("PAYER_WALLET_REQUIRED");
  const rpcUrl = await cryptoRpcUrl(setting.chainId);
  if (!rpcUrl) throw new Error("RPC_UNAVAILABLE");
  await verifySmartPay3Identity(rpcUrl, setting.smartPay3Contract as Address);
  const record = await smartPay3TransactionById(rpcUrl, setting.smartPay3Contract as Address, transactionId as Hex);
  if (!record.timestamp || !sameAddress(record.wallet, identity.wallet) || normalizeSmartPayRefId(record.refId) !== normalizeSmartPayRefId(identity.refId)) {
    throw new Error("PAYMENT_RECIPIENT_MISMATCH");
  }
  const classId = record.secondId;
  if (input.classId && input.classId !== classId) throw new Error("PAYMENT_COURSE_MISMATCH");
  const option = await currentSmartPayCheckoutOption(setting.id, classId);
  if (!option || option.mainId !== record.mainId || option.secondId !== record.secondId) throw new Error("PAYMENT_RULE_MISMATCH");
  const offer = option.smartPay3Offer;
  if (!sameAddress(record.primaryTokenAddress, offer.primaryTokenAddress)
    || !sameAddress(record.secondaryTokenAddress, offer.secondaryTokenAddress)) throw new Error("PAYMENT_TOKEN_MISMATCH");
  const actualPrimary = BigInt(record.primaryTokenAmount), actualSecondary = BigInt(record.secondaryTokenAmount);
  const mixed = actualPrimary === BigInt(offer.primaryTokenAmountAtomic) && actualSecondary === BigInt(offer.secondaryTokenAmountAtomic);
  const fullPrimary = actualPrimary === BigInt(option.tokenAmountAtomic) && actualSecondary === 0n;
  if (!(mixed || fullPrimary)) throw new Error("PAYMENT_AMOUNT_MISMATCH");
  const course = await database.prepare(`SELECT target_language AS languageCode,package_tier AS packageTier,price_cents AS monthlyPriceCents
    FROM smartlingo_language_classes WHERE id=? AND class_kind='official_course' AND status='open' LIMIT 1`)
    .bind(classId).first<{ languageCode: string; packageTier: "basic"|"intermediate"|"advanced"; monthlyPriceCents: number }>();
  if (!course || course.packageTier !== option.plan || course.languageCode !== option.languageCode) throw new Error("COURSE_UNAVAILABLE");
  const current = await database.prepare(`SELECT trial_ends_at AS trialEnds,current_period_ends_at AS periodEnds
    FROM smartlingo_course_subscriptions WHERE class_id=? AND user_id=? LIMIT 1`).bind(classId,targetUserId)
    .first<{ trialEnds: number; periodEnds: number | null }>();
  const now = Math.floor(Date.now()/1000);
  const periodStart = Math.max(now, current?.trialEnds || 0, current?.periodEnds || 0);
  const periodEnd = periodStart + YEAR_SECONDS;
  const claimId = crypto.randomUUID();
  await database.batch([
    database.prepare(`INSERT INTO smartpay3_payment_claims
      (id,user_id,setting_id,contract_address,transaction_id,payer_wallet,ref_id,main_id,second_id,language_code,package_tier,class_id,primary_token_symbol,primary_token_address,primary_atomic_amount,secondary_token_symbol,secondary_token_address,secondary_atomic_amount,entitlement_status,current_period_ends_at,verified_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'synced',?,?)`)
      .bind(claimId,targetUserId,setting.id,setting.smartPay3Contract,transactionId,identity.wallet,identity.refId,record.mainId,record.secondId,course.languageCode,course.packageTier,classId,setting.tokenSymbol,record.primaryTokenAddress,record.primaryTokenAmount,actualSecondary>0n?offer.secondaryTokenSymbol:null,actualSecondary>0n?record.secondaryTokenAddress:null,record.secondaryTokenAmount,periodEnd,now),
    database.prepare(`INSERT INTO smartlingo_course_subscriptions
      (id,class_id,user_id,status,monthly_price_cents,trial_started_at,trial_ends_at,current_period_ends_at,provider_subscription_id,created_at,updated_at)
      VALUES(?,?,?,'active',?,?,?,?,?,?,?)
      ON CONFLICT(class_id,user_id) DO UPDATE SET status='active',monthly_price_cents=excluded.monthly_price_cents,current_period_ends_at=excluded.current_period_ends_at,provider_subscription_id=excluded.provider_subscription_id,updated_at=excluded.updated_at`)
      .bind(crypto.randomUUID(),classId,targetUserId,course.monthlyPriceCents,now,now,periodEnd,`smartpay3:${setting.smartPay3Contract}:${transactionId}`,now,now),
    database.prepare(`INSERT INTO smartlingo_language_class_members(id,class_id,user_id,role,status,joined_at,updated_at)
      VALUES(?,?,?,'student','active',?,?) ON CONFLICT(class_id,user_id) DO UPDATE SET role='student',status='active',updated_at=excluded.updated_at`)
      .bind(crypto.randomUUID(),classId,targetUserId,now,now),
  ]);
  return { verified: true, alreadyRecorded: false, classId, currentPeriodStart: periodStart, currentPeriodEnd: periodEnd, paymentId: transactionId };
}
