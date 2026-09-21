import { getSessionUser } from "@/lib/auth";
import { aigcCreditBalance, consumeAigcCredits, SMARTLINGO_AIGC_CREDIT_COSTS } from "@/lib/aigc-credits";
import { boundedJsonBody } from "@/lib/bounded-request-body";

export async function GET(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  return Response.json({ balance: await aigcCreditBalance(user.id), costs: SMARTLINGO_AIGC_CREDIT_COSTS }, { headers: { "cache-control": "private, no-store" } });
}

export async function POST(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  const body = await boundedJsonBody<{ kind?: unknown; requestId?: unknown }>(request, 4 * 1024);
  const kind = body.kind === "video" ? "video" : null;
  const requestId = String(body.requestId || "");
  if (!kind || !/^[a-zA-Z0-9_-]{16,80}$/.test(requestId)) return Response.json({ error: "Invalid media request" }, { status: 400 });
  try {
    const balance = await consumeAigcCredits({ userId: user.id, credits: SMARTLINGO_AIGC_CREDIT_COSTS.video, reason: "aigc_video", providerReference: `aigc:video:${user.id}:${requestId}` });
    return Response.json({ ok: true, balance, cost: SMARTLINGO_AIGC_CREDIT_COSTS.video });
  } catch (error) {
    if (error instanceof Error && error.message === "AIGC_CREDITS_REQUIRED") return Response.json({ error: "AIGC_CREDITS_REQUIRED", required: SMARTLINGO_AIGC_CREDIT_COSTS.video }, { status: 402 });
    throw error;
  }
}
