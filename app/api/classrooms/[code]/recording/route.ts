import { boundedJsonBody } from "@/lib/bounded-request-body";
import { classAccess, classByCode } from "@/lib/live-classrooms";
import { getDatabase, getSessionUser } from "@/lib/auth";
import { requireParticipantSession } from "@/lib/class-participant-session";
import {
  beginClassRecording,
  startReservedClassRecording,
  stopActiveClassRecording,
} from "@/lib/class-recording";
import { ensureProviderWebhook } from "@/lib/live-class-realtimekit";

type Body = { action?: unknown; sessionToken?: unknown; identity?: unknown };

export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const room = await classByCode(code);
  if (!room) return Response.json({ error: "Course not found" }, { status: 404 });
  const user = await getSessionUser(request);
  const access = await classAccess(room, user);
  if (!access.allowed)
    return Response.json({ error: "Course access required" }, { status: user ? 403 : 401 });
  const artifacts = (await getDatabase().prepare(`SELECT id,status,
    recording_seconds AS recordingSeconds,audio_size_bytes AS audioSizeBytes,
    created_at AS createdAt,updated_at AS updatedAt
    FROM class_recording_artifacts WHERE room_id=? AND status<>'deleted'
    ORDER BY created_at DESC,id DESC LIMIT 100`).bind(room.id).run()).results || [];
  return Response.json({
    artifacts,
    recording: artifacts.some((item) =>
      ["pending", "recording"].includes(String((item as { status?: string }).status))),
    manager: access.manager,
  }, { headers: { "cache-control": "no-store" } });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const room = await classByCode(code);
  if (!room) return Response.json({ error: "Course not found" }, { status: 404 });
  let body: Body;
  try { body = await boundedJsonBody<Body>(request, 8 * 1024); }
  catch (error) {
    return error instanceof Response ? error : Response.json({ error: "Invalid request" }, { status: 400 });
  }
  const user = await getSessionUser(request);
  const access = await classAccess(room, user);
  if (!access.manager || !user)
    return Response.json({ error: "Manager access required" }, { status: 403 });
  if (!user.emailVerified)
    return Response.json({ error: "Verify your email before recording", errorCode: "VERIFIED_MEMBER_REQUIRED" }, { status: 403 });
  let session;
  try {
    session = await requireParticipantSession({
      request,
      room,
      token: body.sessionToken,
      identity: body.identity,
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "PARTICIPANT_SESSION_REQUIRED";
    return Response.json({ error: code, errorCode: code }, { status: 401 });
  }
  const action = String(body.action || "");
  try {
    if (action === "start") {
      await ensureProviderWebhook(new URL("/api/realtimekit/webhook", request.url).toString());
      const reservation = await beginClassRecording(room, session);
      return Response.json(await startReservedClassRecording({ room, reservation }), { status: 201 });
    }
    if (action === "stop")
      return Response.json({ ok: true, ...(await stopActiveClassRecording(room.id)) });
    return Response.json({ error: "Invalid recording action" }, { status: 400 });
  } catch (error) {
    const code = error instanceof Error ? error.message : "RECORDING_UPDATE_FAILED";
    const status = code === "RECORDING_QUOTA_REACHED" ? 429
      : ["RECORDING_NOT_ACTIVE", "RECORDING_RESERVATION_CLOSED"].includes(code) ? 409
        : code.includes("REQUIRED") ? 403 : 502;
    return Response.json({ error: code, errorCode: code }, {
      status,
      headers: { "cache-control": "no-store" },
    });
  }
}
