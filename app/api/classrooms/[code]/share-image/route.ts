import { classByCode } from "@/lib/live-classrooms";

export const dynamic = "force-dynamic";

const styles: Record<string, string> = {
  global: "premium global learning community, refined architectural light, diverse abstract human connection, deep teal and emerald palette",
  creative: "editorial creative learning gathering, expressive shapes, optimistic color, sophisticated contemporary illustration",
  technology: "future technology class, luminous networks, spatial depth, elegant dark teal cinematic atmosphere",
  warm: "warm international learning gathering, golden natural light, welcoming modern space, calm human connection",
};

export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  if (!/^\d{6}$/.test(code) || !await classByCode(code)) return Response.json({ error: "Class not found" }, { status: 404 });
  const input = await request.json().catch(() => ({})) as { style?: string; direction?: string; locale?: string };
  const style = styles[String(input.style)] || styles.global;
  const direction = String(input.direction || "").trim().slice(0, 240);
  const prompt = `Square social invitation background for an online class. ${style}. ${direction}. Strong visual focus with generous dark lower space for later typography overlay. High-end editorial artwork, tasteful, inclusive, no identifiable public figures. MANDATORY: background artwork only. Do not generate words, letters, numbers, URLs, logos, QR codes, signs, captions, watermarks, text-like glyphs, or interface elements.`;
  try {
    const { env } = await import("cloudflare:workers");
    const ai = env.AI as unknown as { run(model: string, input: Record<string, unknown>): Promise<{ image?: string }> };
    const result = await ai.run("@cf/black-forest-labs/flux-1-schnell", { prompt, steps: 6, seed: Math.floor(Math.random() * 2_147_483_647) });
    if (!result.image) return Response.json({ error: "Image generation unavailable" }, { status: 502 });
    return Response.json({ image: `data:image/jpeg;base64,${result.image}` }, { headers: { "Cache-Control": "no-store" } });
  } catch { return Response.json({ error: "Image generation failed" }, { status: 502 }); }
}
