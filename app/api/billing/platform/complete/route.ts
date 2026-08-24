import { getSessionUser } from "@/lib/auth";
import { loadSupervisorCheckoutSession, syncStripeCollegeSupervisorLicense } from "@/lib/stripe-platform-subscription";

export async function POST(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  const body = await request.json().catch(() => null) as { sessionId?: string } | null;
  const sessionId = String(body?.sessionId || "");
  if (!/^cs_(?:test_|live_)?[A-Za-z0-9]+$/.test(sessionId)) return Response.json({ error: "Invalid checkout return" }, { status: 400 });
  try {
    const session = await loadSupervisorCheckoutSession(sessionId);
    if (session.client_reference_id !== user.id) return Response.json({ error: "Checkout does not match this member" }, { status: 403 });
    const result = await syncStripeCollegeSupervisorLicense(user.id, session);
    return Response.json({ synced: true, ...result });
  } catch (error) {
    const unavailable = error instanceof Error && error.message === "STRIPE_NOT_CONFIGURED";
    return Response.json({ error: unavailable ? "Credit-card checkout is not configured" : "Unable to verify checkout" }, { status: unavailable ? 503 : 502 });
  }
}
