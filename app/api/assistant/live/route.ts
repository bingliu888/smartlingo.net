import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { subscriptions } from "../../../../db/schema";
import {
  openSmartAiLiveVoice,
  readSmartAiRequestText,
  safeSmartAiError,
} from "../../../../lib/smartlingo-ai-gateway";
import { requestUser } from "../../../../lib/request-user";

const LIVE_INSTRUCTIONS = "You are the bilingual live voice language coach for SmartLingo.net. Match the learner's language and target level. Lead short, useful real-life conversations; correct one or two high-value pronunciation, vocabulary, or grammar issues at a time; offer a natural retry; and keep the learner in dialogue. Support the five product skills of vocabulary, reading, writing, listening, and dialogue, plus class navigation, Community, and messages. Every signed-in member may prepare a private class as teacher or coordinator. AI feedback and scores are practice guidance, not official examination results. Do not invent progress, payment, payout, connected-account, or class status. Platform referral points can come only from verified successful platform subscription payments; class purchases never qualify. Never promise fluency, education, employment, visa, income, legal, medical, or financial outcomes. Do not request unnecessary sensitive information and refer high-stakes questions to an official or qualified source.";

export async function POST(request: Request) {
  const user = await requestUser();
  if (!user) return Response.json({ error: "Sign in is required." }, { status: 401 });
  let sdp: string;
  try {
    sdp = await readSmartAiRequestText(request, 100_000);
  } catch (error) {
    const safe = safeSmartAiError(error, user.preferredLanguage === "zh" ? "zh" : "en", "live");
    return Response.json({ error: safe.message, code: safe.code }, { status: safe.status });
  }
  if (!sdp) return Response.json({ error: "Invalid voice connection request." }, { status: 400 });

  const db = getDb();
  const [subscription] = await db.select({ status: subscriptions.status })
    .from(subscriptions)
    .where(eq(subscriptions.userId, user.id))
    .limit(1);
  const paid = subscription?.status === "active" || subscription?.status === "trialing";
  try {
    const answer = await openSmartAiLiveVoice({
      userId: user.id,
      subject: `user:${user.id}`,
      paid,
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
