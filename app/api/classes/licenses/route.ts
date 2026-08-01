import { getSessionUser } from "../../../../lib/auth";

/**
 * The migrated Admin-license workflow does not belong to SmartLingo.
 * Class creation is available directly to every signed-in member.
 */
export async function POST(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: "Authentication required" }, { status: 401 });
  return Response.json({
    error: "Class license keys are retired. Create a private class directly from Class Studio.",
    code: "SMARTLINGO_CLASS_LICENSE_RETIRED",
  }, { status: 410 });
}
