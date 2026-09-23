import {
  openSmartAiLiveVoice,
  readSmartAiRequestText,
  safeSmartAiError,
} from "../../../../lib/smartlingo-ai-gateway";
import { hasMaxCourseAccess } from "../../../../lib/platform-entitlements";
import { requestUser } from "../../../../lib/request-user";

const LIVE_INSTRUCTIONS = "You are a SmartLingo language-learning coach. Keep a short practical conversation in the learner's target language, ask one question at a time, offer one useful correction and a retry, and never claim that AI practice is an official assessment. Do not invent learning progress or payment status. Avoid requesting sensitive information; refer high-stakes medical, legal, and financial matters to qualified sources.";

export async function POST(request: Request) {
  const user = await requestUser();
  if (!user) return Response.json({ error: "Sign in is required." }, { status: 401 });
  // The legacy SDP endpoint has no role/task binding or enforceable session cap.
  // It remains closed until the V2 tutor client and server controls are reviewed.
  if (process.env.SMARTLINGO_MAX_ROLE_TUTOR_ENABLED !== "1") return Response.json({ error: "Live role tutor is not available yet." }, { status: 503 });
  if (!await hasMaxCourseAccess(user)) return Response.json({ error: "An active Max plan is required." }, { status: 403 });
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) return Response.json({ error: "Invalid request origin." }, { status: 403 });
  let sdp: string;
  try {
    sdp = await readSmartAiRequestText(request, 100_000);
  } catch (error) {
    const safe = safeSmartAiError(error, user.preferredLanguage === "zh" ? "zh" : "en", "live");
    return Response.json({ error: safe.message, code: safe.code }, { status: safe.status });
  }
  if (!sdp) return Response.json({ error: "Invalid voice connection request." }, { status: 400 });

  try {
    const answer = await openSmartAiLiveVoice({
      userId: user.id,
      subject: `user:${user.id}`,
      paid: true,
      sdp,
      instructions: LIVE_INSTRUCTIONS,
    });
    return new Response(answer.value, {
      status: 201,
      headers: { "content-type": "application/sdp", "cache-control": "no-store" },
    });
  } catch (error) {
    const safe = safeSmartAiError(error, user.preferredLanguage === "zh" ? "zh" : "en", "live");
    return Response.json(
      { error: safe.message, code: safe.code },
      {
        status: safe.status,
        headers: safe.retryAfter ? { "retry-after": String(safe.retryAfter) } : undefined,
      },
    );
  }
}
