import { cryptoSubscriptionPlanForIds } from "./crypto-subscription";

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
    && cryptoSubscriptionPlanForIds(record.mainId, record.secondId) !== null
    && !record.subscriptionRecorded;
}
