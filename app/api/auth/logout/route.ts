import { clearReferralCookie, clearSessionCookie } from "../../../../lib/auth";

export async function POST() {
  const headers = new Headers();
  headers.append("set-cookie", clearSessionCookie());
  headers.append("set-cookie", clearReferralCookie());
  return Response.json({ ok: true }, { headers });
}
