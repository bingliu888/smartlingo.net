import { requestUser } from "../../../lib/request-user";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { referralMedia } from "../../../db/schema";
import {
  createSmartLingoMediaObjectKey,
  privateMediaResponseHeaders,
  sanitizeMediaFileName,
  SmartLingoMediaError,
  validateReferralMedia,
} from "../../../lib/smartlingo-media";
import {
  generateSmartAiImage,
  safeSmartAiError,
} from "../../../lib/smartlingo-ai-gateway";

const STYLE_PROMPTS: Record<string, string> = {
  anime: "A polished contemporary anime illustration about international learners building workplace English and career skills, with learning cards, subtle certificate motifs, connected nodes, deep green and mint color, warm cinematic light and mature editorial composition.",
  classic: "An elegant career-learning still life: a refined certificate folder, notebook, headset and subtle global connection symbols in deep green, mint and cyan. Absolutely no people, hands, faces, bodies or silhouettes.",
  festive: "A sophisticated paper-cut inspired illustration about joyful learning progress and career opportunity, with green, mint, cyan, warm coral, celebratory ribbons and certificate motifs.",
  minimal: "A minimalist editorial composition about global career mobility, with an abstract learning pathway, certificate geometry, deep green and luminous mint-cyan negative space. Absolutely no people, hands, faces, bodies or silhouettes.",
};

const MAX_MEDIA_ITEMS = 12;
function bucket() {
  const binding = (globalThis as unknown as { __SMARTLINGO_BUCKET__?: R2Bucket }).__SMARTLINGO_BUCKET__;
  if (!binding) throw new Error("Media storage is unavailable");
  return binding;
}

function publicItem(item: typeof referralMedia.$inferSelect) {
  return { id: item.id, kind: item.kind, mimeType: item.mimeType, name: item.name, createdAt: item.createdAt * 1000, url: `/api/referral-media?id=${encodeURIComponent(item.id)}` };
}

export async function GET(request: Request) {
  const user = await requestUser();
  if (!user) return Response.json({ error: "Sign in is required." }, { status: 401 });
  const db = getDb();
  const id = new URL(request.url).searchParams.get("id");
  if (!id) {
    const items = await db.select().from(referralMedia).where(eq(referralMedia.userId, user.id)).orderBy(desc(referralMedia.createdAt)).limit(MAX_MEDIA_ITEMS);
    return Response.json({ items: items.map(publicItem) });
  }
  const [item] = await db.select().from(referralMedia).where(and(eq(referralMedia.id, id), eq(referralMedia.userId, user.id))).limit(1);
  if (!item) return Response.json({ error: "Media not found." }, { status: 404 });
  const object = await bucket().get(item.objectKey);
  if (!object) return Response.json({ error: "Media file is unavailable." }, { status: 404 });
  return new Response(object.body, { headers: privateMediaResponseHeaders({ mimeType: item.mimeType, sizeBytes: item.sizeBytes, name: item.name }) });
}

export async function PUT(request: Request) {
  const user = await requestUser();
  if (!user) return Response.json({ error: "Sign in is required." }, { status: 401 });
  const form = await request.formData();
  const file = form.get("file");
  const requestedKind = form.get("kind");
  if (!(file instanceof File) || (requestedKind !== "image" && requestedKind !== "video")) return Response.json({ error: "Invalid media file." }, { status: 400 });
  const kind = requestedKind;
  let validated;
  try {
    validated = await validateReferralMedia(file, kind);
  } catch (error) {
    if (error instanceof SmartLingoMediaError) return Response.json({ error: "Invalid media file." }, { status: 400 });
    throw error;
  }
  const id = crypto.randomUUID();
  const objectKey = createSmartLingoMediaObjectKey("referral_media", id);
  const name = sanitizeMediaFileName(file.name, `${kind}-${id}`);
  const storage = bucket();
  await storage.put(objectKey, validated.bytes, {
    httpMetadata: { contentType: validated.mimeType },
    customMetadata: { kind, sha256: validated.sha256 },
  });
  const db = getDb();
  const createdAt = Math.floor(Date.now() / 1000);
  try {
    await db.insert(referralMedia).values({ id, userId: user.id, kind, objectKey, mimeType: validated.mimeType, name, sizeBytes: validated.sizeBytes, createdAt });
  } catch (error) {
    await storage.delete(objectKey);
    throw error;
  }
  const items = await db.select().from(referralMedia).where(eq(referralMedia.userId, user.id)).orderBy(desc(referralMedia.createdAt));
  for (const old of items.slice(MAX_MEDIA_ITEMS)) {
    await db.delete(referralMedia).where(eq(referralMedia.id, old.id));
    await storage.delete(old.objectKey).catch(() => undefined);
  }
  const [saved] = await db.select().from(referralMedia).where(eq(referralMedia.id, id)).limit(1);
  return Response.json({ item: publicItem(saved) }, { status: 201 });
}

export async function DELETE(request: Request) {
  const user = await requestUser();
  if (!user) return Response.json({ error: "Sign in is required." }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id") || "";
  const db = getDb();
  const [item] = await db.select().from(referralMedia).where(and(eq(referralMedia.id, id), eq(referralMedia.userId, user.id))).limit(1);
  if (!item) return Response.json({ error: "Media not found." }, { status: 404 });
  await db.delete(referralMedia).where(eq(referralMedia.id, item.id));
  await bucket().delete(item.objectKey).catch(() => undefined);
  return Response.json({ ok: true });
}

function cleanPrompt(value: unknown) {
  if (typeof value !== "string") return "";
  return value.replace(/[\u0000-\u001f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, 240);
}

export async function POST(request: Request) {
  const user = await requestUser();
  if (!user) return Response.json({ error: "Sign in is required." }, { status: 401 });

  const body = await request.json().catch(() => ({})) as { language?: string; style?: string; stylePrompt?: string };
  const zh = body.language === "zh";
  const style = Object.hasOwn(STYLE_PROMPTS, body.style || "") ? body.style! : "anime";
  const custom = cleanPrompt(body.stylePrompt);
  const excludesPeople = style === "classic" || style === "minimal";
  const prompt = [
    "Create a square, high-quality social invitation BACKGROUND for SmartLingo.net, a trusted bilingual AI-learning and member-led class community.",
    STYLE_PROMPTS[style],
    custom ? `User art direction: ${custom}. Follow it only when it does not conflict with the mandatory rules below.` : "",
    zh ? "Use contemporary Chinese cultural warmth with global connection, practical learning and constructive career progress." : "Use a contemporary international mood centered on global connection, practical learning and constructive career progress.",
    excludesPeople
      ? "MANDATORY: this is a still-life scene only. Do not show any human, person, face, hand, arm, body, crowd, portrait, reflection, shadow, or human silhouette."
      : "If people are present, render them as a diverse, tasteful anime-style global community; avoid photorealistic faces.",
    "Leave the lower 40 percent relatively calm and uncluttered so the website can add exact referral text afterward.",
    "MANDATORY: generate background art only. Do not include words, text, letters, numbers, URLs, referral codes, logos, QR codes, watermarks, captions, or signs.",
    "Do not show visa guarantees, job guarantees, official-government seals, financial-gain promises, political campaign symbols, gambling, weapons, alcohol, scams or hostile imagery.",
  ].filter(Boolean).join(" ");

  try {
    const image = await generateSmartAiImage({ subject: `user:${user.id}`, prompt });
    return Response.json({ image: `data:image/png;base64,${image.value}` });
  } catch (error) {
    const safe = safeSmartAiError(error, zh ? "zh" : "en", "image");
    return Response.json(
      { error: safe.message, code: safe.code },
      {
        status: safe.status,
        headers: safe.retryAfter ? { "retry-after": String(safe.retryAfter) } : undefined,
      },
    );
  }
}
