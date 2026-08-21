import { getDatabase, getSessionUser } from "../../../../../../lib/auth";
import {
  buildDailyVocabularyQuiz,
  SMARTLINGO_LEARNING_LANGUAGE_CODES,
  type SmartLingoLearningLanguage,
} from "../../../../../../lib/smartlingo-learning";
import { requireOfficialClassMembership } from "../../../../../../lib/smartlingo-learning-access";
import { generateSmartAiImage, safeSmartAiError } from "../../../../../../lib/smartlingo-ai-gateway";

export const dynamic = "force-dynamic";

function bucket() {
  const value = (globalThis as unknown as { __SMARTLINGO_BUCKET__?: R2Bucket }).__SMARTLINGO_BUCKET__;
  if (!value) throw new Error("Vocabulary image storage unavailable");
  return value;
}

function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`));
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}

export async function GET(request: Request, context: { params: Promise<{ classId: string }> }) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: "Authentication required" }, { status: 401 });
  const { classId } = await context.params;
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,99}$/.test(classId)) {
    return Response.json({ error: "Invalid course" }, { status: 400 });
  }
  const access = await requireOfficialClassMembership(getDatabase(), user, classId);
  if (!access || !SMARTLINGO_LEARNING_LANGUAGE_CODES.includes(access.targetLanguage as SmartLingoLearningLanguage)) {
    return Response.json({ error: "Active official course membership required" }, { status: 403 });
  }

  const url = new URL(request.url);
  const date = url.searchParams.get("date") || "";
  const day = Number(url.searchParams.get("day"));
  const questionId = url.searchParams.get("questionId") || "";
  const interfaceLanguage = url.searchParams.get("lang") === "zh" ? "zh" : "en";
  if (!validDate(date) || !Number.isInteger(day) || day < 1 || day > 365 || questionId.length > 120) {
    return Response.json({ error: "Invalid quiz image request" }, { status: 400 });
  }
  const targetLanguage = access.targetLanguage as SmartLingoLearningLanguage;
  const questions = buildDailyVocabularyQuiz(targetLanguage, day, date, interfaceLanguage);
  const question = questions.find(item => item.id === questionId);
  if (!question) return Response.json({ error: "Quiz question not found" }, { status: 404 });

  const prompt = `Create a clean, friendly educational illustration for a beginner language quiz. Depict the concrete meaning or everyday situation represented by the ${targetLanguage} vocabulary term "${question.prompt}". Show one unambiguous scene with ordinary people or objects. Do not include letters, words, captions, flags, logos, brands, watermarks, answer choices, or culturally stereotyped traits. Square composition, warm natural color, accessible visual contrast.`;
  const key = `generated/vocabulary-quiz/${await sha256(`smartlingo-v1:${prompt}`)}.png`;
  const storage = bucket();
  const cached = await storage.get(key);
  if (cached) {
    return new Response(cached.body, { headers: { "content-type": "image/png", "cache-control": "private, max-age=86400", "x-content-type-options": "nosniff" } });
  }

  try {
    const generated = await generateSmartAiImage({ subject: `user:${user.id}:vocabulary-quiz`, prompt });
    const binary = atob(generated.value);
    const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
    if (bytes.byteLength < 64 || bytes.byteLength > 8 * 1024 * 1024) throw new Error("Invalid generated image");
    await storage.put(key, bytes, { httpMetadata: { contentType: "image/png" }, customMetadata: { source: "openai-gpt-image", contentVersion: "smartlingo-v1" } });
    return new Response(bytes, { headers: { "content-type": "image/png", "cache-control": "private, max-age=86400", "x-content-type-options": "nosniff" } });
  } catch (error) {
    const safe = safeSmartAiError(error, interfaceLanguage, "image");
    return Response.json({ error: safe.message, code: safe.code }, { status: safe.status });
  }
}
