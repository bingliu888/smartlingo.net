import { getSessionUser } from "@/lib/auth";
import { isPermanentAdmin } from "@/lib/admin-access";
import { consumeAccountRequestLimit } from "@/lib/account-request-limit";
import { boundedJsonBody } from "@/lib/bounded-request-body";
import { claimSmartLingoCoursePayment } from "@/lib/smartlingo-smartpay-claim";

type ClaimInput = {
  settingId?: string;
  paymentId?: string;
  classId?: string;
  memberId?: string;
  supervisorRefId?: string;
};

export async function POST(request: Request) {
  try {
    const actor = await getSessionUser(request);
    if (!actor) return Response.json({ error: "Sign in required" }, { status: 401 });
    const limited = await consumeAccountRequestLimit({
      request,
      scope: "smartpay-claim",
      userId: actor.id,
      limit: 30,
      windowSeconds: 60,
      unavailableMessage: "Payment protection is temporarily unavailable.",
    });
    if (limited) return limited;
    const body = await boundedJsonBody<ClaimInput>(request, 8 * 1024);
    const target = String(body.memberId || "");
    if (target && target !== actor.id && !isPermanentAdmin(actor))
      return Response.json({ error: "Administrator access required" }, { status: 403 });
    return Response.json(await claimSmartLingoCoursePayment({
      actor,
      targetUserId: target || undefined,
      settingId: String(body.settingId || ""),
      transactionId: String(body.paymentId || ""),
      classId: body.classId ? String(body.classId) : undefined,
      supervisorRefId: body.supervisorRefId || undefined,
    }));
  } catch (error) {
    if (error instanceof Response) return error;
    const reason = error instanceof Error ? error.message : "PAYMENT_VERIFICATION_FAILED";
    const waiting = reason.match(/^PAYMENT_CONFIRMATIONS_PENDING:(\d+)$/);
    if (waiting)
      return Response.json({ error: `Waiting for ${waiting[1]} more confirmations` }, { status: 425 });
    const status = reason === "INVALID_TRANSACTION_ID" ? 400
      : reason === "TRANSACTION_ALREADY_CLAIMED" ? 409
        : reason.includes("UNAVAILABLE") || reason === "RPC_UNAVAILABLE" ? 503 : 422;
    return Response.json({ error: reason }, { status });
  }
}
