import {
  askSmartAi,
  askSmartAiVision,
  readSmartAiJsonRequest,
  safeSmartAiError,
  smartAiRequestCountry,
  type SmartAiFeature,
} from "../../../lib/smartlingo-ai-gateway";
import { validateSmartLingoMedia } from "../../../lib/smartlingo-media";
import { requestUser } from "../../../lib/request-user";

type ChatMessage = { role?: unknown; content?: unknown };
type AssistantFeature = Extract<SmartAiFeature, "public_guru" | "message_polish" | "chat_guru">;
type AssistantImage = { dataUrl?: unknown; mimeType?: unknown; size?: unknown; name?: unknown };
type AssistantRequest = { feature?: unknown; language?: unknown; messages?: ChatMessage[]; image?: AssistantImage };

const GURU_INSTRUCTIONS = `You are Guru, the bilingual public language-learning and course assistant for SmartLingo.net. Match the requested language. Be clear, concise, encouraging, and practical. Help people choose among Chinese, English, Spanish, Japanese, Korean, French, German, Russian, Italian, Portuguese, Arabic, and Hindi; compare the fixed Beginner ($20/month), Intermediate ($100/month), and Advanced ($300/month) courses; explain the free first month; and practice vocabulary, reading, writing, listening, dialogue, accent correction, speeches, and speech-draft revision when included in the selected level. Courses are created and priced only by SmartLingo administrators. Each course has an A/V webinar classroom whose administrator may assign co-host speakers. Do not claim that members can create courses, set fees, or receive course payouts. Do not invent lesson completion, assessment, payment, or subscription status. AI corrections and scores support practice only and are not official examination results. Never promise fluency, education, employment, visa, income, or other outcomes. Protect personal data, identify uncertainty, and refer high-stakes questions to appropriate official or qualified sources.`;

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

function decodeImageDataUrl(value: unknown, mimeType: unknown) {
  if (typeof value !== "string" || typeof mimeType !== "string") return null;
  const match = value.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!match || match[1] !== mimeType || match[2].length > 1_300_000) return null;
  try {
    const binary = atob(match[2]);
    const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
    return { bytes, dataUrl: value, mimeType };
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  let body: AssistantRequest;
  try {
    body = await readSmartAiJsonRequest<AssistantRequest>(request, 1_400_000);
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
    const decodedImage = body.image ? decodeImageDataUrl(body.image.dataUrl, body.image.mimeType) : null;
    if (body.image && !decodedImage) {
      return Response.json({ error: language === "zh" ? "图片格式无效。" : "The image is invalid." }, { status: 400 });
    }
    if (decodedImage) {
      if (feature !== "public_guru") {
        return Response.json({ error: language === "zh" ? "图片仅支持智能导师问答。" : "Images are supported only in Ask Guru." }, { status: 400 });
      }
      await validateSmartLingoMedia({
        size: decodedImage.bytes.byteLength,
        type: decodedImage.mimeType,
        arrayBuffer: async () => decodedImage.bytes.buffer.slice(
          decodedImage.bytes.byteOffset,
          decodedImage.bytes.byteOffset + decodedImage.bytes.byteLength,
        ) as ArrayBuffer,
      }, "chat_attachment");
      const answer = await askSmartAiVision({
        subject: user ? `user:${user.id}` : `visitor:${visitor}`,
        language,
        instructions: `${GURU_INSTRUCTIONS}\nAnalyze only the attached image and the supplied question. Answer in ${language === "zh" ? "Simplified Chinese" : "English"}. Do not infer sensitive traits or identity.`,
        content: messages.join("\n"),
        imageDataUrl: decodedImage.dataUrl,
        imageBytes: decodedImage.bytes.byteLength,
      });
      return Response.json({ reply: answer.value, fallback: answer.fallback, provider: "openai", modality: "vision" });
    }
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
