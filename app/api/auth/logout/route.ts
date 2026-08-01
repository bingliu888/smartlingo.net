import { clearReferralCookie, clearSessionCookie, deleteCurrentSession } from "../../../../lib/auth";

export async function POST(request: Request) {
  await deleteCurrentSession(request);
  const headers = new Headers();
  headers.append("set-cookie", clearSessionCookie());
  headers.append("set-cookie", clearReferralCookie());
  return Response.json({ ok: true }, { headers });
}
