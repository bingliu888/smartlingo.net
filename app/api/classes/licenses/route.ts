import { getSessionUser } from "../../../../lib/auth";

/**
 * The migrated Admin-license workflow does not belong to SmartLingo.
 * Course creation is reserved for SmartLingo administrators in the MVP.
 */
export async function POST(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: "Authentication required" }, { status: 401 });
  return Response.json({
    error: "Course license keys and member course creation are retired.",
    code: "SMARTLINGO_CLASS_LICENSE_RETIRED",
  }, { status: 410 });
}
