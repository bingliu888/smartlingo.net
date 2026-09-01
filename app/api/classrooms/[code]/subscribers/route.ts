import { getSessionUser } from "@/lib/auth";
import { boundedJsonBody } from "@/lib/bounded-request-body";
import {
  addClassSubscriber,
  canManageClass,
  classSubscribers,
  removeClassSubscriber,
} from "@/lib/class-managers";
import { classByCode } from "@/lib/live-classrooms";

async function context(request: Request, code: string) {
  const room = await classByCode(code);
  const user = await getSessionUser(request);
  if (!room) return { error: Response.json({ error: "Course not found" }, { status: 404 }) };
  if (!user || !await canManageClass(room, user))
    return { error: Response.json({ error: "Manager access required" }, { status: 403 }) };
  return { room, user };
}

export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const value = await context(request, code);
  if ("error" in value) return value.error;
  return Response.json({ members: await classSubscribers(value.room.id) });
}

export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const value = await context(request, code);
  if ("error" in value) return value.error;
  try {
    const body = await boundedJsonBody<{ email?: unknown }>(request, 4 * 1024);
    await addClassSubscriber(value.room.id, value.user, String(body.email || ""));
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof Response) return error;
    const issue = error instanceof Error ? error.message : "Unable to add subscriber";
    return Response.json({ error: issue }, { status: issue === "MEMBER_NOT_FOUND" ? 404 : 400 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const value = await context(request, code);
  if ("error" in value) return value.error;
  await removeClassSubscriber(value.room.id, new URL(request.url).searchParams.get("userId") || "");
  return Response.json({ ok: true });
}
