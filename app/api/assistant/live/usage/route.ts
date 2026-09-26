import { maxTutorDailyLimit } from "../../../../../lib/smartlingo-open-tutor-entitlement";
import { smartAiLiveVoiceConfigured } from "../../../../../lib/smartlingo-ai-gateway";
import { requestUser } from "../../../../../lib/request-user";

export async function GET() {
  const user = await requestUser();
  if (!user) return Response.json({ error: "Sign in is required." }, { status: 401 });
  const dailyLimitSeconds = await maxTutorDailyLimit(user);
  return Response.json({ available: smartAiLiveVoiceConfigured(), maxActive: dailyLimitSeconds > 0,
    dailyLimitSeconds }, { headers: { "cache-control": "no-store" } });
}

export async function POST() {
  const user = await requestUser();
  if (!user) return Response.json({ error: "Sign in is required." }, { status: 401 });
  return Response.json(
    { error: "Client-reported voice usage is disabled. Allowance is reserved by the server when a Live connection opens." },
    { status: 405, headers: { allow: "GET" } },
  );
}
