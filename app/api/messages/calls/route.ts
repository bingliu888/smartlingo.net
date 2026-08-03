import { NextResponse } from "next/server";
import { createId, getDatabase, getSessionUser } from "../../../../lib/auth";
import {
  addRealtimeParticipant,
  createRealtimeMeeting,
  deactivateRealtimeMeeting,
  RealtimeKitRequestError,
  type RealtimeKitConfig,
} from "../../../../lib/realtimekit";

export const dynamic = "force-dynamic";
type CallRow = { id: string; threadId: string; providerMeetingId: string; startedBy: string; mode: "audio" | "video"; status: string; expiresAt: number };
const nowSeconds = () => Math.floor(Date.now() / 1000);

async function config(): Promise<RealtimeKitConfig | null> {
  const { env } = await import("cloudflare:workers");
  const runtime = env as unknown as Record<string, string | undefined>;
  const value = {
    apiToken: runtime.CLOUDFLARE_REALTIME_API_TOKEN || "",
    accountId: runtime.CLOUDFLARE_ACCOUNT_ID || "",
    appId: runtime.REALTIMEKIT_APP_ID || "",
    voicePreset: runtime.REALTIMEKIT_VOICE_PRESET || "",
    videoPreset: runtime.REALTIMEKIT_VIDEO_PRESET || "",
  };
  return Object.values(value).every(Boolean) ? value : null;
}

async function participant(threadId: string, userId: string) {
  return getDatabase().prepare("SELECT id FROM message_participants WHERE thread_id = ? AND user_id = ? AND deleted_at IS NULL")
    .bind(threadId, userId).first();
}

async function activeCall(callId: string) {
  return getDatabase().prepare(`SELECT id, thread_id AS threadId, provider_meeting_id AS providerMeetingId,
    started_by AS startedBy, mode, status, expires_at AS expiresAt
    FROM message_calls WHERE id = ? LIMIT 1`).bind(callId).first<CallRow>();
}

async function joinCall(call: CallRow, user: { id: string; displayName: string }, runtime: RealtimeKitConfig) {
  const now = nowSeconds();
  if (call.status !== "active" || call.expiresAt <= now) throw new Error("CALL_ENDED");
  if (!await participant(call.threadId, user.id)) throw new Error("NOT_PARTICIPANT");
  const provider = await addRealtimeParticipant(runtime, {
    meetingId: call.providerMeetingId,
    userId: user.id,
    displayName: user.displayName,
    mode: call.mode,
  });
  await getDatabase().prepare(`INSERT INTO message_call_participants
    (id, call_id, user_id, provider_participant_id, joined_at, left_at)
    VALUES (?, ?, ?, ?, ?, NULL)
    ON CONFLICT(call_id, user_id) DO UPDATE SET provider_participant_id = excluded.provider_participant_id,
      joined_at = excluded.joined_at, left_at = NULL`)
    .bind(createId(), call.id, user.id, provider.id, now).run();
  return { callId: call.id, mode: call.mode, authToken: provider.token, expiresAt: call.expiresAt, startedBy: call.startedBy };
}

export async function GET(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const threadId = new URL(request.url).searchParams.get("thread") || "";
  if (!threadId || !await participant(threadId, user.id)) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  const now = nowSeconds();
  await getDatabase().prepare("UPDATE message_calls SET status = 'expired', ended_at = ? WHERE status = 'active' AND expires_at <= ?").bind(now, now).run();
  const call = await getDatabase().prepare(`SELECT id, mode, status, started_by AS startedBy, expires_at AS expiresAt
    FROM message_calls WHERE thread_id = ? ORDER BY created_at DESC LIMIT 1`).bind(threadId).first();
  return NextResponse.json({ call: call || null });
}

export async function POST(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const input = await request.json().catch(() => null) as { action?: string; threadId?: string; callId?: string; mode?: string } | null;
  const runtime = await config();
  if (!runtime) return NextResponse.json({ error: "Realtime calls are not configured" }, { status: 503 });
  if (!input) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const db = getDatabase(); const now = nowSeconds();
  try {
    if (input.action === "start") {
      const threadId = String(input.threadId || ""); const mode = input.mode === "video" ? "video" : "audio";
      if (!threadId || !await participant(threadId, user.id)) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
      await db.prepare("UPDATE message_calls SET status = 'expired', ended_at = ? WHERE thread_id = ? AND status = 'active' AND expires_at <= ?").bind(now, threadId, now).run();
      let call = await db.prepare(`SELECT id, thread_id AS threadId, provider_meeting_id AS providerMeetingId,
        started_by AS startedBy, mode, status, expires_at AS expiresAt FROM message_calls
        WHERE thread_id = ? AND status = 'active' LIMIT 1`).bind(threadId).first<CallRow>();
      if (!call) {
        const meeting = await createRealtimeMeeting(runtime); const callId = createId(); const expiresAt = now + 14400;
        await db.prepare(`INSERT INTO message_calls
          (id, thread_id, provider_meeting_id, started_by, mode, status, created_at, expires_at)
          VALUES (?, ?, ?, ?, ?, 'active', ?, ?)`)
          .bind(callId, threadId, meeting.id, user.id, mode, now, expiresAt).run();
        await db.prepare("INSERT INTO messages (id, thread_id, sender_id, body, created_at) VALUES (?, ?, ?, ?, ?)")
          .bind(createId(), threadId, user.id, `__CALL_INVITE__|${callId}|${mode}|${expiresAt}`, now).run();
        await db.prepare("UPDATE message_threads SET updated_at = ? WHERE id = ?").bind(now, threadId).run();
        call = { id: callId, threadId, providerMeetingId: meeting.id, startedBy: user.id, mode, status: "active", expiresAt };
      }
      return NextResponse.json(await joinCall(call, user, runtime));
    }
    if (input.action === "join") {
      const call = await activeCall(String(input.callId || ""));
      if (!call) return NextResponse.json({ error: "Call not found" }, { status: 404 });
      return NextResponse.json(await joinCall(call, user, runtime));
    }
    if (input.action === "leave") {
      const call = await activeCall(String(input.callId || ""));
      if (!call || !await participant(call.threadId, user.id)) return NextResponse.json({ error: "Call not found" }, { status: 404 });
      await db.prepare("UPDATE message_call_participants SET left_at = ? WHERE call_id = ? AND user_id = ?").bind(now, call.id, user.id).run();
      return NextResponse.json({ ok: true });
    }
    if (input.action === "end") {
      const call = await activeCall(String(input.callId || ""));
      if (!call || call.startedBy !== user.id) return NextResponse.json({ error: "Only the caller can end this call" }, { status: 403 });
      await deactivateRealtimeMeeting(runtime, call.providerMeetingId);
      await db.prepare("UPDATE message_calls SET status = 'ended', ended_at = ? WHERE id = ? AND status = 'active'").bind(now, call.id).run();
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Realtime call failed";
    const provider = error instanceof RealtimeKitRequestError
      ? `status=${error.status} code=${error.code ?? "none"}`
      : "status=unknown";
    console.warn("RealtimeKit call failed", provider, message.slice(0, 180));
    const status = message === "NOT_PARTICIPANT" ? 403 : message === "CALL_ENDED" ? 410 : 502;
    return NextResponse.json({ error: status === 502 ? "Realtime call provider unavailable" : message }, { status });
  }
}
