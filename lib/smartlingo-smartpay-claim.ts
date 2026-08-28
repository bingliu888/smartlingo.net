import type { Address, Hex } from "viem";
import { getDatabase, type SessionUser } from "./auth";
import { cryptoRpcUrl } from "./crypto-rpc";
import { cryptoPaymentSettingById } from "./crypto-payments";
import { currentSmartPayCheckoutOption } from "./smartpay-checkout-server";
import { ensureSmartPayRefId, normalizeSmartPayRefId } from "./smartpay-refid";
import { smartPay3TransactionById, verifySmartPay3Identity } from "./smartpay3-server";
import { cryptoSubscriptionPlanForIds, SMARTLINGO_CRYPTO_MONTHS } from "./crypto-subscription";
import { courseSubscriptionPackage, fixedCourseId } from "./smartlingo-course-packages";
import { isSmartLingoCommunityLanguage } from "./smartlingo-language-communities";
import { recordCoursePackagePurchase } from "./course-package-purchase";

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
  supervisorRefId?: string;
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
  const languageCode = record.secondId;
  const plan = cryptoSubscriptionPlanForIds(record.mainId, languageCode);
  if (!plan || !isSmartLingoCommunityLanguage(languageCode)) throw new Error("PAYMENT_PACKAGE_MISMATCH");
  const classId = fixedCourseId(languageCode, plan);
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
  const course = await database.prepare(`SELECT target_language AS languageCode,package_tier AS packageTier
    FROM smartlingo_language_classes WHERE id=? AND class_kind='official_course' AND status='open' LIMIT 1`)
    .bind(classId).first<{ languageCode: string; packageTier: "basic"|"intermediate"|"advanced" }>();
  if (!course || course.packageTier !== option.plan || course.languageCode !== option.languageCode) throw new Error("COURSE_UNAVAILABLE");
  const selectedPackage = courseSubscriptionPackage(course.packageTier, SMARTLINGO_CRYPTO_MONTHS);
  if (!selectedPackage) throw new Error("PAYMENT_PACKAGE_MISMATCH");
  const now = Math.floor(Date.now()/1000);
  const purchase = await recordCoursePackagePurchase({
    userId: targetUserId,
    classId,
    targetLanguage: course.languageCode,
    packageTier: course.packageTier,
    durationMonths: selectedPackage.months,
    priceCents: selectedPackage.priceCents,
    provider: "smartpay3",
    providerReference: `${setting.smartPay3Contract.toLowerCase()}:${transactionId}`,
    paidAt: now,
    supervisorRefId: input.supervisorRefId || null,
  });
  const claimId = crypto.randomUUID();
  await database.prepare(`INSERT INTO smartpay3_payment_claims
    (id,user_id,setting_id,contract_address,transaction_id,payer_wallet,ref_id,main_id,second_id,language_code,package_tier,class_id,
     primary_token_symbol,primary_token_address,primary_atomic_amount,secondary_token_symbol,secondary_token_address,secondary_atomic_amount,
     entitlement_status,current_period_ends_at,verified_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'synced',?,?)`)
    .bind(claimId,targetUserId,setting.id,setting.smartPay3Contract,transactionId,identity.wallet,identity.refId,record.mainId,record.secondId,
      course.languageCode,course.packageTier,classId,setting.tokenSymbol,record.primaryTokenAddress,record.primaryTokenAmount,
      actualSecondary>0n?offer.secondaryTokenSymbol:null,actualSecondary>0n?record.secondaryTokenAddress:null,record.secondaryTokenAmount,
      purchase.accessEndsAt,now).run();
  return { verified: true, alreadyRecorded: false, classId, languageCode: course.languageCode, packageTier: course.packageTier,
    months: selectedPackage.months, currentPeriodStart: purchase.accessStartsAt, currentPeriodEnd: purchase.accessEndsAt, paymentId: transactionId };
}
