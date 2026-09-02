import { cryptoSubscriptionPlanForIds } from "./crypto-subscription";

export type SmartPayReconciliationRecord = {
  wallet: string;
  payerId: string;
  refId: string;
  mainId: string;
  secondId: string;
  subscriptionRecorded?: boolean;
};

export function smartPayRecipientMatches(
  record: Pick<SmartPayReconciliationRecord, "payerId" | "refId">,
  payerId: string,
  productOwnerRefId: string,
) {
  const payer = payerId.trim().toUpperCase();
  const owner = productOwnerRefId.trim().toUpperCase();
  return Boolean(payer && owner)
    && record.payerId.trim().toUpperCase() === payer
    && record.refId.trim().toUpperCase() === owner;
}

export function smartPayTransactionNeedsReconciliation(
  record: SmartPayReconciliationRecord,
  payerId: string,
  productOwnerRefId: string,
) {
  return smartPayRecipientMatches(record, payerId, productOwnerRefId)
    && cryptoSubscriptionPlanForIds(record.mainId, record.secondId) !== null
    && !record.subscriptionRecorded;
}
