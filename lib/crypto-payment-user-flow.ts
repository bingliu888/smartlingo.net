export type PaymentLookupContext = "new-payment" | "manual-reconciliation";

export function includeClaimedPaymentForLookup(context: PaymentLookupContext) {
  return context === "manual-reconciliation";
}

export function existingPaymentAction(claimed: boolean | undefined) {
  return claimed ? "none" as const : "reconcile" as const;
}
