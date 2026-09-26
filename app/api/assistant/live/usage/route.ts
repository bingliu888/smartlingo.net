import { getDatabase } from "../../../../../lib/auth";
import { maxLiveTutorDailyLimit } from "../../../../../lib/smartlingo-open-tutor-entitlement";
import { smartAiLiveVoiceConfigured } from "../../../../../lib/smartlingo-ai-gateway";
import { readMaxLiveTutorUsage } from "../../../../../lib/smartlingo-max-live-tutor";
import { requestUser } from "../../../../../lib/request-user";

export async function GET() {
  const user = await requestUser();
  if (!user) return Response.json({ error: "Sign in is required." }, { status: 401 });
  const dailyLimitSeconds = await maxLiveTutorDailyLimit(user);
  const usage = dailyLimitSeconds ? await readMaxLiveTutorUsage(getDatabase(), user.id,
    Math.floor(Date.now() / 1_000), dailyLimitSeconds) : { usedSeconds: 0, remainingSeconds: 0 };
  return Response.json({ available: smartAiLiveVoiceConfigured(), maxActive: dailyLimitSeconds > 0,
    dailyLimitSeconds, ...usage }, { headers: { "cache-control": "no-store" } });
}

export async function POST() {
  const user = await requestUser();
  if (!user) return Response.json({ error: "Sign in is required." }, { status: 401 });
  return Response.json(
    { error: "Client-reported voice usage is disabled. Allowance is reserved by the server when a Live connection opens." },
    { status: 405, headers: { allow: "GET" } },
  );
}
