const SMARTLINGO_CRYPTO_COURSE_MAIN_ID = "smartlingo_course_annual";

export type SmartPayReconciliationRecord = {
  wallet: string;
  refId: string;
  mainId: string;
  secondId: string;
  subscriptionRecorded?: boolean;
};

export function smartPayRecipientMatches(
  record: Pick<SmartPayReconciliationRecord, "wallet" | "refId">,
  payerWalletAddress: string,
  memberRefId: string,
) {
  const wallet = payerWalletAddress.trim().toLowerCase();
  const refId = memberRefId.trim().toUpperCase();
  return Boolean(wallet && refId)
    && record.wallet.trim().toLowerCase() === wallet
    && record.refId.trim().toUpperCase() === refId;
}

export function smartPayTransactionNeedsReconciliation(
  record: SmartPayReconciliationRecord,
  payerWalletAddress: string,
  memberRefId: string,
) {
  return smartPayRecipientMatches(record, payerWalletAddress, memberRefId)
    && record.mainId === SMARTLINGO_CRYPTO_COURSE_MAIN_ID
    && /^course_(zh|en|es|ja|ko|fr|de|ru|it|pt|ar|hi)_(basic|intermediate|advanced)$/.test(record.secondId)
    && !record.subscriptionRecorded;
}
