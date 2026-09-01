import { consumeAccountRequestLimit } from "@/lib/account-request-limit";
import { consumeAiDailyQuota } from "@/lib/ai-daily-quota";
import { getSessionUser } from "@/lib/auth";
import { boundedJsonBody } from "@/lib/bounded-request-body";
import { classAccess, classByCode } from "@/lib/live-classrooms";
import { generateSmartAiImage, safeSmartAiError } from "@/lib/smartlingo-ai-gateway";

export const dynamic = "force-dynamic";

const styles: Record<string, string> = {
  global: "premium global learning community, refined architectural light, diverse abstract human connection, deep teal and emerald palette",
  creative: "editorial creative learning gathering, expressive shapes, optimistic color, sophisticated contemporary illustration",
  technology: "future technology course, luminous networks, spatial depth, elegant dark teal cinematic atmosphere",
  warm: "warm international learning gathering, golden natural light, welcoming modern space, calm human connection",
};

export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const room = /^\d{6}$/.test(code) ? await classByCode(code) : null;
  if (!room) return Response.json({ error: "Course not found" }, { status: 404 });
  const user = await getSessionUser(request);
  const access = await classAccess(room, user);
  if (!user || !access.allowed)
    return Response.json({ error: "Course access required" }, { status: 403 });
  if (!user.emailVerified || user.identityCheckedAt <= Math.floor(Date.now() / 1_000) - 5 * 60)
    return Response.json({ error: "Verify your email before generating a course image" }, { status: 403 });
  const limited = await consumeAccountRequestLimit({
    request, scope: "class-share-image", userId: user.id, limit: 6, windowSeconds: 60,
  });
  if (limited) return limited;
  const quota = await consumeAiDailyQuota(user.id, "class-share-image");
  if (quota) return quota;
  let input: { style?: string; direction?: string; locale?: string };
  try { input = await boundedJsonBody(request, 8 * 1024); }
  catch (error) {
    return error instanceof Response ? error : Response.json({ error: "Invalid request" }, { status: 400 });
  }
  const style = styles[String(input.style)] || styles.global;
  const direction = String(input.direction || "").trim().slice(0, 240);
  const prompt = `Square social invitation background for an online language course. ${style}. ${direction}. Strong visual focus with generous dark lower space for later typography overlay. High-end editorial artwork, tasteful, inclusive, no identifiable public figures. MANDATORY: background artwork only. Do not generate words, letters, numbers, URLs, logos, QR codes, signs, captions, watermarks, text-like glyphs, or interface elements.`;
  try {
    const result = await generateSmartAiImage({ subject: `user:${user.id}:course-share`, prompt });
    return Response.json({ image: `data:image/png;base64,${result.value}` }, {
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    const safe = safeSmartAiError(error, input.locale === "zh" ? "zh" : "en", "image");
    return Response.json({ error: safe.message, code: safe.code }, {
      status: safe.status,
      headers: safe.retryAfter ? { "retry-after": String(safe.retryAfter) } : undefined,
    });
  }
}
