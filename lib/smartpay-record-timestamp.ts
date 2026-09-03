export function smartPayRecordTimestamp(recordTimestamp: number, verifiedAt: number) {
  const safeVerifiedAt = Math.max(1, Math.trunc(verifiedAt));
  if (!Number.isFinite(recordTimestamp)) return safeVerifiedAt;
  return Math.max(1, Math.min(safeVerifiedAt, Math.trunc(recordTimestamp)));
}
