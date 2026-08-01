import {
  askSmartAi,
  safeSmartAiError,
  type SmartAiFeature,
} from "../../../lib/smartlingo-ai-gateway";

type ChatMessage = { role?: unknown; content?: unknown };

const GURU_INSTRUCTIONS = `You are Guru, the bilingual public language-learning and class assistant for SmartLingo.net. Match the requested language. Be clear, concise, encouraging, and practical. Help people choose among Spanish, English, French, Japanese, German, Italian, and Korean; practice listening, speaking, reading, writing, vocabulary, and real-life conversations; create or join a member-led private class; and use Community, messages, group Live Chat, and site navigation. Every signed-in member may prepare a private class as teacher or coordinator. Do not invent lesson completion, assessment, payment, payout, connected-account, or public-directory status. AI corrections and scores support practice only and are not official examination results. Platform referrals are single-level: only a verified successful platform subscription payment may create published introducer points; signup and member-created class payments never qualify. Never promise fluency, education, employment, visa, income, or other outcomes. Protect personal data, identify uncertainty, and refer high-stakes questions to appropriate official or qualified sources.`;

function featureFor(messages: string[]): Extract<SmartAiFeature, "public_guru" | "message_polish"> {
  const latest = messages.at(-1) ?? "";
  return /^(?:User:\s*)?(?:请把下面的站内消息润色|Polish this private message)/.test(latest)
    ? "message_polish"
    : "public_guru";
}

function originalPolishText(value: string) {
  return value.split(/\n\s*\n/).slice(1).join("\n\n").trim() || value.replace(/^User:\s*/, "").trim();
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { language?: unknown; messages?: ChatMessage[] } | null;
  const language = body?.language === "zh" ? "zh" : "en";
  const messages = Array.isArray(body?.messages) ? body.messages.slice(-12).flatMap(message => {
    const role = message.role === "assistant" ? "Assistant" : message.role === "user" ? "User" : null;
    const content = typeof message.content === "string" ? message.content.trim().slice(0, 2_000) : "";
    return role && content ? [`${role}: ${content}`] : [];
  }) : [];
  if (!messages.length) return Response.json({ error: language === "zh" ? "请输入问题。" : "A question is required." }, { status: 400 });

  const feature = featureFor(messages);
  const visitor = request.headers.get("cf-connecting-ip")
    || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || "anonymous";
  try {
    const answer = await askSmartAi({
      feature,
      subject: `visitor:${visitor}`,
      language,
      instructions: `${GURU_INSTRUCTIONS}\nAnswer in ${language === "zh" ? "Simplified Chinese" : "English"}.`,
      content: messages.join("\n"),
      preserveOnFailure: feature === "message_polish" ? originalPolishText(messages.at(-1) ?? "") : undefined,
    });
    return Response.json({ reply: answer.value, fallback: answer.fallback });
  } catch (error) {
    const safe = safeSmartAiError(error, language, "guru");
    return Response.json(
      { error: safe.message, code: safe.code },
      {
        status: safe.status,
        headers: safe.retryAfter ? { "retry-after": String(safe.retryAfter) } : undefined,
      },
    );
  }
}
