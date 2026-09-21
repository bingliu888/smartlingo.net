import { getSessionUser } from "@/lib/auth";
import { consumeAigcCredits, refundAigcCredits, SMARTLINGO_AIGC_CREDIT_COSTS } from "@/lib/aigc-credits";
import { boundedJsonBody } from "@/lib/bounded-request-body";
import { consumeAccountRequestLimit } from "@/lib/account-request-limit";
import { generateSmartAiAudio } from "@/lib/smartlingo-ai-gateway";

export async function POST(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  const limited = await consumeAccountRequestLimit({ request, scope: "aigc-audio", userId: user.id, limit: 6, windowSeconds: 60, unavailableMessage: "AIGC protection is temporarily unavailable." });
  if (limited) return limited;
  const body = await boundedJsonBody<{ text?: unknown; requestId?: unknown }>(request, 12 * 1024);
  const text = String(body.text || "").trim().slice(0, 4_000);
  const requestId = String(body.requestId || "");
  if (!text || !/^[a-zA-Z0-9_-]{16,80}$/.test(requestId)) return Response.json({ error: "Enter narration text" }, { status: 400 });
  const reference = `aigc:audio:${user.id}:${requestId}`;
  let debited = false;
  try {
    const balance = await consumeAigcCredits({ userId: user.id, credits: SMARTLINGO_AIGC_CREDIT_COSTS.audio, reason: "aigc_audio", providerReference: reference });
    debited = true;
    const audio = await generateSmartAiAudio({ subject: `user:${user.id}`, text });
    return new Response(audio.value, { headers: { "content-type": "audio/mpeg", "cache-control": "no-store", "x-smartlingo-credit-balance": String(balance) } });
  } catch (error) {
    if (error instanceof Error && error.message === "AIGC_CREDITS_REQUIRED") return Response.json({ error: "AIGC_CREDITS_REQUIRED", required: SMARTLINGO_AIGC_CREDIT_COSTS.audio }, { status: 402 });
    if (debited) await refundAigcCredits({ userId: user.id, credits: SMARTLINGO_AIGC_CREDIT_COSTS.audio, reason: "aigc_audio_refund", providerReference: reference }).catch(() => undefined);
    return Response.json({ error: "AUDIO_GENERATION_UNAVAILABLE" }, { status: 503 });
  }
}
