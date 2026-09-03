import { isAddress, type Address, type Hex } from "viem";
import { getDatabase, type SessionUser } from "./auth";
import { cryptoRpc, cryptoRpcUrl } from "./crypto-rpc";
import { activeCryptoPaymentSettings, cryptoPaymentSettingById } from "./crypto-payments";
import { ensureSmartPayRefId } from "./smartpay-refid";
import {
  smartPay5ReceiptByTransactionId,
  smartPay5TransactionById,
  verifySmartPay5Identity,
} from "./smartpay5-server";
import { smartPay5ExpectedTokenPair } from "./smartpay5-presets";
import { smartPayRecipientMatches } from "./smartpay-reconciliation";
import { smartPayRecordTimestamp } from "./smartpay-record-timestamp";
import { smartLingoProductOwnerRefId } from "./smartpay-product-owner";
import { cryptoSubscriptionPlanForIds, SMARTLINGO_CRYPTO_MONTHS } from "./crypto-subscription";
import { courseSubscriptionPackage, fixedCourseId } from "./smartlingo-course-packages";
import { isSmartLingoCommunityLanguage } from "./smartlingo-language-communities";
import { recordCoursePackagePurchase } from "./course-package-purchase";

type ExistingClaim = {
  userId: string;
  classId: string;
  entitlementStatus: string;
  currentPeriodEnd: number;
};

export async function smartPayUserIdentity(userId: string) {
  return {
    payerId: await ensureSmartPayRefId(userId),
    productOwnerRefId: await smartLingoProductOwnerRefId(),
  };
}

export async function claimSmartLingoCoursePayment(input: {
  actor: SessionUser;
  targetUserId?: string;
  settingId: string;
  transactionId: string;
  classId?: string;
  supervisorRefId?: string | null;
}) {
  const database = getDatabase();
  const targetUserId = input.targetUserId || input.actor.id;
  const setting = await cryptoPaymentSettingById(input.settingId);
  if (!setting?.smartPay5Contract || !isAddress(setting.smartPay5Contract))
    throw new Error("PAYMENT_OPTION_UNAVAILABLE");
  const contract = setting.smartPay5Contract as Address;
  const transactionId = input.transactionId.trim().toLowerCase();
  if (!/^0x[a-f0-9]{64}$/.test(transactionId)) throw new Error("INVALID_TRANSACTION_ID");

  const existing = await database.prepare(`SELECT user_id AS userId,class_id AS classId,
    entitlement_status AS entitlementStatus,current_period_ends_at AS currentPeriodEnd
    FROM smartpay5_payment_claims WHERE lower(contract_address)=lower(?)
      AND lower(transaction_id)=lower(?) LIMIT 1`)
    .bind(contract, transactionId).first<ExistingClaim>();
  if (existing && existing.userId !== targetUserId)
    throw new Error("TRANSACTION_ALREADY_CLAIMED");
  if (existing?.entitlementStatus === "synced" && existing.currentPeriodEnd > 0) {
    return {
      verified: true,
      alreadyRecorded: true,
      classId: existing.classId,
      currentPeriodEnd: existing.currentPeriodEnd,
      paymentId: transactionId,
    };
  }

  const identity = await smartPayUserIdentity(targetUserId);
  const rpcUrl = await cryptoRpcUrl(setting.chainId);
  if (!rpcUrl) throw new Error("RPC_UNAVAILABLE");
  await verifySmartPay5Identity(rpcUrl, contract);
  const record = await smartPay5TransactionById(rpcUrl, contract, transactionId as Hex);
  if (!record.timestamp || !smartPayRecipientMatches(record, identity.payerId, identity.productOwnerRefId))
    throw new Error("PAYMENT_RECIPIENT_MISMATCH");

  const languageCode = record.secondId;
  const plan = cryptoSubscriptionPlanForIds(record.mainId, languageCode);
  if (!plan || !isSmartLingoCommunityLanguage(languageCode))
    throw new Error("PAYMENT_PACKAGE_MISMATCH");
  const classId = fixedCourseId(languageCode, plan);
  if (input.classId && input.classId !== classId) throw new Error("PAYMENT_COURSE_MISMATCH");
  const tokenPair = smartPay5ExpectedTokenPair(await activeCryptoPaymentSettings(), setting);
  if (!tokenPair
    || record.primaryTokenAddress.toLowerCase() !== setting.tokenContract.toLowerCase()
    || record.secondaryTokenAddress.toLowerCase() !== tokenPair.secondaryTokenAddress.toLowerCase())
    throw new Error("PAYMENT_TOKEN_MISMATCH");

  const receipt = await smartPay5ReceiptByTransactionId({
    rpcUrl,
    contract,
    transactionId: transactionId as Hex,
    timestamp: record.timestamp,
  });
  const latestBlock = BigInt(await cryptoRpc<string>(rpcUrl, "eth_blockNumber", []));
  const receiptBlock = BigInt(receipt.blockNumber!);
  const confirmations = receiptBlock <= latestBlock ? latestBlock - receiptBlock + 1n : 0n;
  const requiredConfirmations = BigInt(Math.max(1, setting.minConfirmations));
  if (confirmations < requiredConfirmations)
    throw new Error(`PAYMENT_CONFIRMATIONS_PENDING:${requiredConfirmations - confirmations}`);

  const course = await database.prepare(`SELECT target_language AS languageCode,package_tier AS packageTier
    FROM smartlingo_language_classes WHERE id=? AND class_kind='official_course'
      AND status='open' LIMIT 1`).bind(classId)
    .first<{ languageCode: string; packageTier: "basic" | "intermediate" | "advanced" }>();
  if (!course || course.packageTier !== plan || course.languageCode !== languageCode)
    throw new Error("COURSE_UNAVAILABLE");
  const selectedPackage = courseSubscriptionPackage(course.packageTier, SMARTLINGO_CRYPTO_MONTHS);
  if (!selectedPackage) throw new Error("PAYMENT_PACKAGE_MISMATCH");

  const now = Math.floor(Date.now() / 1_000);
  const paymentTime = smartPayRecordTimestamp(record.timestamp, now);
  await database.prepare(`INSERT INTO smartpay5_payment_claims(
    id,user_id,setting_id,contract_address,transaction_id,payer_wallet,payer_id,ref_id,
    main_id,second_id,language_code,package_tier,class_id,primary_token_symbol,
    primary_token_address,primary_atomic_amount,secondary_token_symbol,
    secondary_token_address,secondary_atomic_amount,entitlement_status,
    current_period_ends_at,created_at,verified_at
  ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'pending_sync',0,?,?)
    ON CONFLICT(contract_address,transaction_id) DO NOTHING`).bind(
    crypto.randomUUID(), targetUserId, setting.id, contract.toLowerCase(), transactionId,
    record.wallet.toLowerCase(), identity.payerId, identity.productOwnerRefId, record.mainId, record.secondId,
    course.languageCode, course.packageTier, classId, setting.tokenSymbol,
    record.primaryTokenAddress.toLowerCase(), record.primaryTokenAmount,
    tokenPair.secondarySetting?.tokenSymbol || null,
    record.secondaryTokenAddress.toLowerCase(), record.secondaryTokenAmount, paymentTime, now,
  ).run();
  const owner = await database.prepare(`SELECT user_id AS userId FROM smartpay5_payment_claims
    WHERE lower(contract_address)=lower(?) AND lower(transaction_id)=lower(?) LIMIT 1`)
    .bind(contract, transactionId).first<{ userId: string }>();
  if (!owner || owner.userId !== targetUserId) throw new Error("TRANSACTION_ALREADY_CLAIMED");

  const purchase = await recordCoursePackagePurchase({
    userId: targetUserId,
    classId,
    targetLanguage: course.languageCode,
    packageTier: course.packageTier,
    durationMonths: selectedPackage.months,
    priceCents: selectedPackage.priceCents,
    provider: "smartpay5",
    providerReference: `${contract.toLowerCase()}:${transactionId}`,
    paidAt: paymentTime,
    supervisorRefId: input.supervisorRefId || null,
  });
  await database.prepare(`UPDATE smartpay5_payment_claims SET entitlement_status='synced',
    current_period_ends_at=?,verified_at=? WHERE lower(contract_address)=lower(?)
    AND lower(transaction_id)=lower(?) AND user_id=?`).bind(
    purchase.accessEndsAt, now, contract, transactionId, targetUserId,
  ).run();
  const synchronized = await database.prepare(`SELECT entitlement_status AS status,
    current_period_ends_at AS currentPeriodEnd FROM smartpay5_payment_claims
    WHERE lower(contract_address)=lower(?) AND lower(transaction_id)=lower(?)
      AND user_id=? LIMIT 1`).bind(contract, transactionId, targetUserId)
    .first<{ status: string; currentPeriodEnd: number }>();
  if (synchronized?.status !== "synced" || synchronized.currentPeriodEnd !== purchase.accessEndsAt)
    throw new Error("PAYMENT_ENTITLEMENT_SYNC_CONFLICT");
  return {
    verified: true,
    alreadyRecorded: purchase.alreadyRecorded,
    receiptTransactionHash: receipt.transactionHash,
    classId,
    languageCode: course.languageCode,
    packageTier: course.packageTier,
    months: selectedPackage.months,
    currentPeriodStart: purchase.accessStartsAt,
    currentPeriodEnd: purchase.accessEndsAt,
    paymentId: transactionId,
  };
}
