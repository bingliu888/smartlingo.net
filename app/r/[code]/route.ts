import { getDatabase, setReferralCookie } from "../../../lib/auth";

export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const incoming = new URL(request.url);
  const lang = incoming.searchParams.get("lang") === "en" ? "en" : "zh";
  const normalized = code.trim().toUpperCase();
  if (!/^[A-Z0-9_-]{6,32}$/.test(normalized)) {
    return Response.redirect(new URL(`/${lang}/auth/sign-up?referral=invalid`, request.url), 302);
  }
  try {
    const found = await getDatabase().prepare("SELECT id FROM referral_codes WHERE code = ? LIMIT 1")
      .bind(normalized)
      .first<{ id: string }>();
    if (!found) return Response.redirect(new URL(`/${lang}/auth/sign-up?referral=invalid`, request.url), 302);
  } catch {
    return Response.redirect(new URL(`/${lang}/auth/sign-up?referral=unavailable`, request.url), 302);
  }
  // Keep the real code in the URL as well as the HttpOnly cookie.  Social-app
  // hand-offs often open Safari/Chrome with a separate cookie jar.
  const location = new URL(`/${lang}/auth/sign-up?referral=${encodeURIComponent(normalized)}`, request.url);
  return new Response(null, {
    status: 302,
    headers: {
      Location: location.toString(),
      "Set-Cookie": setReferralCookie(normalized),
      "Cache-Control": "private, no-store, max-age=0",
    },
  });
}

export const HEAD = GET;
