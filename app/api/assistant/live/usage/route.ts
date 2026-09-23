import { hasMaxCourseAccess } from "../../../../../lib/platform-entitlements";
import { requestUser } from "../../../../../lib/request-user";

export async function GET() {
  const user = await requestUser();
  if (!user) return Response.json({ error: "Sign in is required." }, { status: 401 });
  return Response.json({ available: process.env.SMARTLINGO_MAX_ROLE_TUTOR_ENABLED === "1", maxActive: await hasMaxCourseAccess(user) });
}

export async function POST() {
  const user = await requestUser();
  if (!user) return Response.json({ error: "Sign in is required." }, { status: 401 });
  return Response.json(
    { error: "Client-reported voice usage is disabled. Allowance is reserved by the server when a Live connection opens." },
    { status: 405, headers: { allow: "GET" } },
  );
}
