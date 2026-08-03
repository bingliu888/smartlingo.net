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
type CallRow = { id: string; threadId: string; threadKind: string; providerMeetingId: string; startedBy: string; mode: "audio" | "video"; status: string; expiresAt: number; soloSinceAt: number | null; lastAudioAt: number | null };
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
  return getDatabase().prepare(`SELECT calls.id, calls.thread_id AS threadId, threads.kind AS threadKind,
    calls.provider_meeting_id AS providerMeetingId, calls.started_by AS startedBy, calls.mode,
    calls.status, calls.expires_at AS expiresAt, calls.solo_since_at AS soloSinceAt,
    calls.last_audio_at AS lastAudioAt
    FROM message_calls calls JOIN message_threads threads ON threads.id = calls.thread_id
    WHERE calls.id = ? LIMIT 1`).bind(callId).first<CallRow>();
}

async function reconcileCall(call: CallRow, runtime: RealtimeKitConfig, now: number) {
  if (call.status !== "active") return { ended: true, participantCount: 0, cameraCount: 0, soloSecondsRemaining: null as number | null, silenceSecondsRemaining: null as number | null };
  const db = getDatabase();
  await db.prepare(`UPDATE message_call_participants SET left_at = ?, microphone_on = 0, camera_on = 0
    WHERE call_id = ? AND left_at IS NULL AND COALESCE(last_seen_at, joined_at) < ?`)
    .bind(now, call.id, now - 35).run();
  const count = await db.prepare(`SELECT COUNT(*) AS value, SUM(CASE WHEN camera_on = 1 THEN 1 ELSE 0 END) AS cameras FROM message_call_participants
    WHERE call_id = ? AND left_at IS NULL AND COALESCE(last_seen_at, joined_at) >= ?`)
    .bind(call.id, now - 35).first<{ value: number; cameras: number }>();
  const participantCount = Number(count?.value || 0);
  const cameraCount = Number(count?.cameras || 0);
  if (participantCount === 0) {
    await deactivateRealtimeMeeting(runtime, call.providerMeetingId);
    await db.prepare("UPDATE message_calls SET status = 'ended', ended_at = ? WHERE id = ? AND status = 'active'").bind(now, call.id).run();
    return { ended: true, participantCount, cameraCount, soloSecondsRemaining: 0, silenceSecondsRemaining: 0 };
  }
  if (participantCount >= 2) {
    await db.prepare("UPDATE message_calls SET last_audio_at = CASE WHEN solo_since_at IS NOT NULL THEN ? ELSE COALESCE(last_audio_at, ?) END, solo_since_at = NULL WHERE id = ? AND status = 'active'").bind(now, now, call.id).run();
    const state = await db.prepare("SELECT last_audio_at AS lastAudioAt FROM message_calls WHERE id = ?").bind(call.id).first<{ lastAudioAt: number | null }>();
    const lastAudioAt = Number(state?.lastAudioAt || now);
    const silenceSecondsRemaining = Math.max(0, 60 - (now - lastAudioAt));
    if (silenceSecondsRemaining > 0) return { ended: false, participantCount, cameraCount, soloSecondsRemaining: null, silenceSecondsRemaining };
    await deactivateRealtimeMeeting(runtime, call.providerMeetingId);
    await db.prepare("UPDATE message_calls SET status = 'ended', ended_at = ? WHERE id = ? AND status = 'active'").bind(now, call.id).run();
    return { ended: true, participantCount, cameraCount, soloSecondsRemaining: null, silenceSecondsRemaining: 0 };
  }
  const state = await db.prepare("SELECT solo_since_at AS soloSinceAt FROM message_calls WHERE id = ?").bind(call.id).first<{ soloSinceAt: number | null }>();
  const soloSinceAt = Number(state?.soloSinceAt || 0);
  if (!soloSinceAt) {
    await db.prepare("UPDATE message_calls SET solo_since_at = ? WHERE id = ? AND status = 'active'").bind(now, call.id).run();
    return { ended: false, participantCount, cameraCount, soloSecondsRemaining: 60, silenceSecondsRemaining: null };
  }
  const remaining = Math.max(0, 60 - (now - soloSinceAt));
  if (remaining > 0) return { ended: false, participantCount, cameraCount, soloSecondsRemaining: remaining, silenceSecondsRemaining: null };
  await deactivateRealtimeMeeting(runtime, call.providerMeetingId);
  await db.prepare("UPDATE message_calls SET status = 'ended', ended_at = ? WHERE id = ? AND status = 'active'").bind(now, call.id).run();
  return { ended: true, participantCount, cameraCount, soloSecondsRemaining: 0, silenceSecondsRemaining: null };
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
    (id, call_id, user_id, provider_participant_id, joined_at, last_seen_at, microphone_on, camera_on, left_at)
    VALUES (?, ?, ?, ?, ?, ?, 1, 0, NULL)
    ON CONFLICT(call_id, user_id) DO UPDATE SET provider_participant_id = excluded.provider_participant_id,
      joined_at = excluded.joined_at, last_seen_at = excluded.last_seen_at,
      microphone_on = 1, camera_on = 0, left_at = NULL`)
    .bind(createId(), call.id, user.id, provider.id, now, now).run();
  const presence = await reconcileCall(call, runtime, now);
  return { callId: call.id, mode: call.mode, authToken: provider.token, expiresAt: call.expiresAt, startedBy: call.startedBy, threadKind: call.threadKind, ...presence };
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
  const input = await request.json().catch(() => null) as { action?: string; threadId?: string; callId?: string; mode?: string; microphoneOn?: boolean; audioActivity?: boolean } | null;
  const runtime = await config();
  if (!runtime) return NextResponse.json({ error: "Realtime calls are not configured" }, { status: 503 });
  if (!input) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const db = getDatabase(); const now = nowSeconds();
  try {
    if (input.action === "start") {
      const threadId = String(input.threadId || ""); const mode = input.mode === "video" ? "video" : "audio";
      if (!threadId || !await participant(threadId, user.id)) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
      const thread = await db.prepare("SELECT kind FROM message_threads WHERE id = ?").bind(threadId).first<{ kind: string }>();
      await db.prepare("UPDATE message_calls SET status = 'expired', ended_at = ? WHERE thread_id = ? AND status = 'active' AND expires_at <= ?").bind(now, threadId, now).run();
      let call = await db.prepare(`SELECT calls.id, calls.thread_id AS threadId, threads.kind AS threadKind,
        calls.provider_meeting_id AS providerMeetingId, calls.started_by AS startedBy, calls.mode,
        calls.status, calls.expires_at AS expiresAt, calls.solo_since_at AS soloSinceAt,
        calls.last_audio_at AS lastAudioAt
        FROM message_calls calls JOIN message_threads threads ON threads.id = calls.thread_id
        WHERE calls.thread_id = ? AND calls.status = 'active' LIMIT 1`).bind(threadId).first<CallRow>();
      if (!call) {
        const meeting = await createRealtimeMeeting(runtime); const callId = createId(); const expiresAt = now + 14400;
        await db.prepare(`INSERT INTO message_calls
          (id, thread_id, provider_meeting_id, started_by, mode, status, created_at, expires_at, last_audio_at)
          VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?)`)
          .bind(callId, threadId, meeting.id, user.id, mode, now, expiresAt, now).run();
        await db.prepare("INSERT INTO messages (id, thread_id, sender_id, body, created_at) VALUES (?, ?, ?, ?, ?)")
          .bind(createId(), threadId, user.id, `__CALL_INVITE__|${callId}|${mode}|${expiresAt}`, now).run();
        await db.prepare("UPDATE message_threads SET updated_at = ? WHERE id = ?").bind(now, threadId).run();
        call = { id: callId, threadId, threadKind: thread?.kind || "group", providerMeetingId: meeting.id, startedBy: user.id, mode, status: "active", expiresAt, soloSinceAt: null, lastAudioAt: now };
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
      await db.prepare("UPDATE message_call_participants SET left_at = ?, last_seen_at = ?, microphone_on = 0, camera_on = 0 WHERE call_id = ? AND user_id = ?").bind(now, now, call.id, user.id).run();
      return NextResponse.json({ ok: true, ...(await reconcileCall(call, runtime, now)) });
    }
    if (input.action === "heartbeat") {
      const call = await activeCall(String(input.callId || ""));
      if (!call || !await participant(call.threadId, user.id)) return NextResponse.json({ error: "Call not found" }, { status: 404 });
      await db.prepare("UPDATE message_call_participants SET last_seen_at = ?, microphone_on = ?, left_at = NULL WHERE call_id = ? AND user_id = ?").bind(now, input.microphoneOn === false ? 0 : 1, call.id, user.id).run();
      if (input.audioActivity) await db.prepare("UPDATE message_calls SET last_audio_at = ? WHERE id = ? AND status = 'active'").bind(now, call.id).run();
      return NextResponse.json(await reconcileCall(call, runtime, now));
    }
    if (input.action === "camera_on") {
      const call = await activeCall(String(input.callId || ""));
      if (!call || !await participant(call.threadId, user.id)) return NextResponse.json({ error: "Call not found" }, { status: 404 });
      await db.prepare(`UPDATE message_call_participants SET camera_on = 0
        WHERE call_id = ? AND left_at IS NULL AND COALESCE(last_seen_at, joined_at) < ?`).bind(call.id, now - 35).run();
      const own = await db.prepare("SELECT camera_on AS cameraOn FROM message_call_participants WHERE call_id = ? AND user_id = ? AND left_at IS NULL").bind(call.id, user.id).first<{ cameraOn: number }>();
      const count = await db.prepare("SELECT COUNT(*) AS value FROM message_call_participants WHERE call_id = ? AND left_at IS NULL AND camera_on = 1").bind(call.id).first<{ value: number }>();
      const cameraCount = Number(count?.value || 0);
      if (!own) return NextResponse.json({ error: "Join the call first" }, { status: 409 });
      if (!own.cameraOn && cameraCount >= 4) return NextResponse.json({ allowed: false, cameraCount }, { status: 409 });
      await db.prepare("UPDATE message_call_participants SET camera_on = 1, last_seen_at = ? WHERE call_id = ? AND user_id = ?").bind(now, call.id, user.id).run();
      return NextResponse.json({ allowed: true, cameraCount: own.cameraOn ? cameraCount : cameraCount + 1 });
    }
    if (input.action === "camera_off") {
      const call = await activeCall(String(input.callId || ""));
      if (!call || !await participant(call.threadId, user.id)) return NextResponse.json({ error: "Call not found" }, { status: 404 });
      await db.prepare("UPDATE message_call_participants SET camera_on = 0, last_seen_at = ? WHERE call_id = ? AND user_id = ?").bind(now, call.id, user.id).run();
      const count = await db.prepare("SELECT COUNT(*) AS value FROM message_call_participants WHERE call_id = ? AND left_at IS NULL AND camera_on = 1").bind(call.id).first<{ value: number }>();
      return NextResponse.json({ ok: true, cameraCount: Number(count?.value || 0) });
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
