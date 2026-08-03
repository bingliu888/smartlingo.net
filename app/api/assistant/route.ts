import {
  askSmartAi,
  readSmartAiJsonRequest,
  safeSmartAiError,
  smartAiRequestCountry,
  type SmartAiFeature,
} from "../../../lib/smartlingo-ai-gateway";
import { requestUser } from "../../../lib/request-user";

type ChatMessage = { role?: unknown; content?: unknown };
type AssistantFeature = Extract<SmartAiFeature, "public_guru" | "message_polish" | "chat_guru">;
type AssistantRequest = { feature?: unknown; language?: unknown; messages?: ChatMessage[] };

const GURU_INSTRUCTIONS = `You are Guru, the bilingual public language-learning and class assistant for SmartLingo.net. Match the requested language. Be clear, concise, encouraging, and practical. Help people choose among Chinese, English, Spanish, Japanese, Korean, French, German, Russian, Italian, Portuguese, Arabic, and Hindi; practice the five product skills of vocabulary, reading, writing, listening, and dialogue; create or join a member-led private class; and use Community, messages, group Live Chat, and site navigation. Native speakers and existing learners may also join a community for their own language. Every signed-in member may prepare a private class as teacher or coordinator. Do not invent lesson completion, assessment, payment, payout, connected-account, or public-directory status. AI corrections and scores support practice only and are not official examination results. Platform referrals are single-level: only a verified successful platform subscription payment may create published introducer points; signup and member-created class payments never qualify. Never promise fluency, education, employment, visa, income, or other outcomes. Protect personal data, identify uncertainty, and refer high-stakes questions to appropriate official or qualified sources.`;

function featureFor(messages: string[]): Extract<SmartAiFeature, "public_guru" | "message_polish"> {
  const latest = messages.at(-1) ?? "";
  return /^(?:User:\s*)?(?:请把下面的站内消息润色|Polish this private message)/.test(latest)
    ? "message_polish"
    : "public_guru";
}

function requestedFeature(value: unknown): AssistantFeature | null {
  return value === "public_guru" || value === "message_polish" || value === "chat_guru" ? value : null;
}

function originalPolishText(value: string) {
  return value.split(/\n\s*\n/).slice(1).join("\n\n").trim() || value.replace(/^User:\s*/, "").trim();
}

export async function POST(request: Request) {
  let body: AssistantRequest;
  try {
    body = await readSmartAiJsonRequest<AssistantRequest>(request);
  } catch (error) {
    const language = request.headers.get("accept-language")?.toLowerCase().startsWith("zh") ? "zh" : "en";
    const safe = safeSmartAiError(error, language, "guru");
    return Response.json({ error: safe.message, code: safe.code }, { status: safe.status });
  }
  const language = body?.language === "zh" ? "zh" : "en";
  const messages = Array.isArray(body?.messages) ? body.messages.slice(-12).flatMap(message => {
    const role = message.role === "assistant" ? "Assistant" : message.role === "user" ? "User" : null;
    const content = typeof message.content === "string" ? message.content.trim().slice(0, 2_000) : "";
    return role && content ? [`${role}: ${content}`] : [];
  }) : [];
  if (!messages.length) return Response.json({ error: language === "zh" ? "请输入问题。" : "A question is required." }, { status: 400 });

  const explicitFeature = requestedFeature(body.feature);
  if (body.feature !== undefined && !explicitFeature) {
    return Response.json({ error: language === "zh" ? "人工智能功能无效。" : "The AI feature is invalid." }, { status: 400 });
  }
  const feature = explicitFeature ?? featureFor(messages);
  const user = await requestUser();
  if (feature !== "public_guru" && !user) {
    return Response.json({ error: language === "zh" ? "请先登录。" : "Sign in is required." }, { status: 401 });
  }
  const visitor = request.headers.get("cf-connecting-ip")
    || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || "anonymous";
  try {
    const answer = await askSmartAi({
      feature,
      subject: user ? `user:${user.id}` : `visitor:${visitor}`,
      language,
      instructions: `${GURU_INSTRUCTIONS}\nAnswer in ${language === "zh" ? "Simplified Chinese" : "English"}.`,
      content: messages.join("\n"),
      preserveOnFailure: feature === "message_polish" ? originalPolishText(messages.at(-1) ?? "") : undefined,
      deps: {
        providerPreference: user?.aiProviderPreference ?? "auto",
        country: smartAiRequestCountry(request),
      },
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
