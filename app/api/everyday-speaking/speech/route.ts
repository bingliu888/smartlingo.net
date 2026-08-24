import { getDatabase, getSessionUser } from "@/lib/auth";
import { isSmartAiGatewayError, transcribeSmartAiSpeech } from "@/lib/smartlingo-ai-gateway";
import { buildEverydaySpeakingDeckFromDatabase, isSmartLingoEverydayScenario } from "@/lib/smartlingo-everyday-speaking";
import { isSmartLingoCommunityLanguage } from "@/lib/smartlingo-language-communities";
import { scoreSmartCardPronunciation } from "@/lib/smartlingo-smartcards";

export const dynamic = "force-dynamic";
const MAX_AUDIO_BYTES = 750_000;

async function sha256(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

export async function POST(request: Request) {
  const declared = Number(request.headers.get("content-length") || 0);
  if (declared > MAX_AUDIO_BYTES + 80_000) return Response.json({ error: "Pronunciation audio is too large" }, { status: 413 });

  const form = await request.formData().catch(() => null);
  const language = form?.get("language");
  const scene = form?.get("scene");
  const slideId = form?.get("slideId");
  const audio = form?.get("audio");
  if (typeof language !== "string" || !isSmartLingoCommunityLanguage(language)
    || typeof scene !== "string" || !isSmartLingoEverydayScenario(scene)
    || typeof slideId !== "string" || slideId.length > 80
    || !(audio instanceof File) || audio.size < 256 || audio.size > MAX_AUDIO_BYTES
    || (audio.type && !audio.type.startsWith("audio/"))) {
    return Response.json({ error: "Pronunciation audio is invalid" }, { status: 400 });
  }

  const database = getDatabase();
  const level = slideId.includes("-advanced-") ? "advanced" : slideId.includes("-intermediate-") ? "intermediate" : "beginner";
  const deck = await buildEverydaySpeakingDeckFromDatabase({ database, language, sceneId: scene, level });
  const slide = deck.find(item => item.id === slideId);
  if (!slide) return Response.json({ error: "Everyday speaking slide not found" }, { status: 404 });

  const user = await getSessionUser(request);
  const guestSignal = `${request.headers.get("cf-connecting-ip") || "anonymous"}:${request.headers.get("user-agent") || "browser"}`;
  const subject = user ? `user:${user.id}:everyday-speech` : `guest:${await sha256(guestSignal)}:everyday-speech`;
  try {
    const result = await transcribeSmartAiSpeech({ subject, audio, language, deps: { database } });
    const transcript = result.value;
    return Response.json({ transcript, ...scoreSmartCardPronunciation(slide.form, transcript, slide.pronunciation, language) });
  } catch (error) {
    const status = isSmartAiGatewayError(error) ? error.status : 503;
    return Response.json({ error: "Pronunciation analysis is temporarily unavailable" }, { status });
  }
}
