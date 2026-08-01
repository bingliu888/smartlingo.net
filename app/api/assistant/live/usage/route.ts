import { and, eq } from "drizzle-orm";
import { getDb } from "../../../../../db";
import { liveVoiceUsage, subscriptions } from "../../../../../db/schema";
import { requestUser } from "../../../../../lib/request-user";

const FREE_SECONDS = 600;
const dateKey = () => new Date().toISOString().slice(0, 10);

async function status(userId: string) {
  const db = getDb();
  const [subscription] = await db.select({ status: subscriptions.status }).from(subscriptions).where(eq(subscriptions.userId, userId)).limit(1);
  const paid = subscription?.status === "active" || subscription?.status === "trialing";
  const day = dateKey();
  const [usage] = await db.select().from(liveVoiceUsage).where(and(eq(liveVoiceUsage.userId, userId), eq(liveVoiceUsage.usageDate, day))).limit(1);
  const usedSeconds = usage?.usedSeconds ?? 0;
  return { paid, usedSeconds, remainingSeconds: paid ? null : Math.max(0, FREE_SECONDS - usedSeconds), day };
}

export async function GET() {
  const user = await requestUser();
  if (!user) return Response.json({ error: "Sign in is required." }, { status: 401 });
  return Response.json(await status(user.id));
}

export async function POST() {
  const user = await requestUser();
  if (!user) return Response.json({ error: "Sign in is required." }, { status: 401 });
  return Response.json(
    { error: "Client-reported voice usage is disabled. Allowance is reserved by the server when a Live connection opens." },
    { status: 405, headers: { allow: "GET" } },
  );
}
