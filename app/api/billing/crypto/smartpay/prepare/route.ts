import { getSessionUser } from "@/lib/auth";
import { consumeAccountRequestLimit } from "@/lib/account-request-limit";
import { boundedJsonBody } from "@/lib/bounded-request-body";
import { currentSmartPayCheckoutOption } from "@/lib/smartpay-checkout-server";
import { ensureSmartPayRefId } from "@/lib/smartpay-refid";
import { smartLingoProductOwnerRefId } from "@/lib/smartpay-product-owner";

export async function POST(request: Request) {
  try {
    const user = await getSessionUser(request);
    if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
    const limited = await consumeAccountRequestLimit({
      request,
      scope: "smartpay-prepare",
      userId: user.id,
      limit: 30,
      windowSeconds: 60,
      unavailableMessage: "Payment protection is temporarily unavailable.",
    });
    if (limited) return limited;
    const body = await boundedJsonBody<{ settingId?: string; classId?: string }>(request, 4 * 1024);
    const option = await currentSmartPayCheckoutOption(String(body.settingId || ""), String(body.classId || ""));
    if (!option) return Response.json({ error: "The selected on-chain course rule is unavailable" }, { status: 409 });
    const [payerId, refId] = await Promise.all([ensureSmartPayRefId(user.id), smartLingoProductOwnerRefId()]);
    return Response.json({ option, payerId, refId }, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    if (error instanceof Response) return error;
    return Response.json({ error: "Invalid payment request" }, { status: 400 });
  }
}
