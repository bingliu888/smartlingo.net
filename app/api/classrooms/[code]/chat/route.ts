import { consumeAccountRequestLimit } from "@/lib/account-request-limit";
import { createId, getDatabase, getSessionUser } from "@/lib/auth";
import { boundedJsonBody } from "@/lib/bounded-request-body";
import { classAccess, classByCode } from "@/lib/live-classrooms";

export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const room = await classByCode(code);
  if (!room) return Response.json({ error: "Not found" }, { status: 404 });
  if (!(await classAccess(room, await getSessionUser(request))).allowed)
    return Response.json({ error: "Access denied" }, { status: 403 });
  const messages = (await getDatabase().prepare(`SELECT id,sender_name AS senderName,
    body,created_at AS createdAt FROM live_class_chat_messages
    WHERE room_id=? ORDER BY created_at LIMIT 300`).bind(room.id).run()).results || [];
  return Response.json({ messages });
}

export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const room = await classByCode(code);
  const user = await getSessionUser(request);
  if (!room) return Response.json({ error: "Not found" }, { status: 404 });
  if (!user) return Response.json({ error: "Members sign in to chat" }, { status: 401 });
  if (!(await classAccess(room, user)).allowed)
    return Response.json({ error: "Access denied" }, { status: 403 });
  const limited = await consumeAccountRequestLimit({
    request,
    scope: `class-chat:${room.id}`,
    userId: user.id,
    limit: 60,
    windowSeconds: 60,
  });
  if (limited) return limited;
  let input: { body?: unknown };
  try { input = await boundedJsonBody<{ body?: unknown }>(request, 4 * 1024); }
  catch (error) {
    return error instanceof Response ? error : Response.json({ error: "Invalid message" }, { status: 400 });
  }
  const body = String(input.body || "").trim().slice(0, 2_000);
  if (!body) return Response.json({ error: "Message required" }, { status: 400 });
  await getDatabase().prepare(`INSERT INTO live_class_chat_messages(
    id,room_id,sender_user_id,sender_name,body,created_at
  ) VALUES(?,?,?,?,?,?)`).bind(
    createId(), room.id, user.id, user.displayName, body, Math.floor(Date.now() / 1_000),
  ).run();
  return Response.json({ ok: true }, { status: 201 });
}
