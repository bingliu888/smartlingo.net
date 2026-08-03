import { NextResponse } from "next/server";
import { createId, getDatabase, getSessionUser } from "../../../../lib/auth";
import { avatarsById } from "../../../../lib/member-avatars";

export const dynamic = "force-dynamic";

type MeetingRow = {
  id: string;
  ownerUserId: string;
  threadId: string;
  title: string;
  scheduledAt: number;
  createdAt: number;
  ownerName: string;
  participantCount: number;
  callParticipantCount: number;
  activeCallId: string | null;
};

const nowSeconds = () => Math.floor(Date.now() / 1000);

async function listMeetings(currentUserId: string) {
  const db = getDatabase();
  const now = nowSeconds();
  const rows = (await db.prepare(`SELECT cm.id, cm.owner_user_id AS ownerUserId,
      cm.thread_id AS threadId, cm.title, cm.scheduled_at AS scheduledAt,
      cm.created_at AS createdAt, u.display_name AS ownerName,
      (SELECT COUNT(*) FROM message_participants mp
        WHERE mp.thread_id = cm.thread_id AND mp.deleted_at IS NULL) AS participantCount,
      (SELECT mc.id FROM message_calls mc
        WHERE mc.thread_id = cm.thread_id AND mc.status = 'active'
        ORDER BY mc.created_at DESC LIMIT 1) AS activeCallId,
      (SELECT COUNT(*) FROM message_call_participants mcp
        JOIN message_calls mc2 ON mc2.id = mcp.call_id
        WHERE mc2.thread_id = cm.thread_id AND mc2.status = 'active'
          AND mcp.left_at IS NULL AND mcp.last_seen_at >= ?) AS callParticipantCount
    FROM community_meetings cm JOIN users u ON u.id = cm.owner_user_id
    WHERE cm.ended_at IS NULL
    ORDER BY CASE WHEN cm.scheduled_at <= ? THEN 0 ELSE 1 END,
      cm.scheduled_at ASC, cm.created_at ASC LIMIT 100`)
    .bind(now - 45, now).run<MeetingRow>()).results || [];
  const avatars = await avatarsById();
  return rows.map(row => ({
    ...row,
    participantCount: Number(row.participantCount || 0),
    callParticipantCount: Number(row.callParticipantCount || 0),
    ownerImageUrl: avatars.get(row.ownerUserId) || "",
    isOwner: row.ownerUserId === currentUserId,
    status: Number(row.scheduledAt) <= now ? "live" : "upcoming",
  }));
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const meetings = await listMeetings(user.id);
  return NextResponse.json({ currentUserId: user.id, serverNow: nowSeconds(), meetings });
}

export async function POST(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const input = await request.json().catch(() => null) as {
    action?: string;
    meetingId?: string;
    title?: string;
    scheduledAt?: number;
  } | null;
  if (!input) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const db = getDatabase();
  const now = nowSeconds();

  if (input.action === "schedule") {
    const title = String(input.title || "").trim().replace(/\s+/g, " ");
    const scheduledAt = Math.floor(Number(input.scheduledAt || 0));
    if (title.length < 3 || title.length > 80) return NextResponse.json({ error: "Meeting title must be 3–80 characters" }, { status: 400 });
    if (!Number.isSafeInteger(scheduledAt) || scheduledAt < now - 300 || scheduledAt > now + 90 * 86400) {
      return NextResponse.json({ error: "Choose a start time within the next 90 days" }, { status: 400 });
    }
    const existing = await db.prepare("SELECT id FROM community_meetings WHERE owner_user_id = ? AND ended_at IS NULL LIMIT 1").bind(user.id).first();
    if (existing) return NextResponse.json({ error: "You already have a live or scheduled meeting" }, { status: 409 });
    const meetingId = createId();
    const threadId = createId();
    try {
      await db.batch([
        db.prepare("INSERT INTO message_threads (id, kind, subject, created_by, created_at, updated_at) VALUES (?, 'meeting', ?, ?, ?, ?)").bind(threadId, title, user.id, now, now),
        db.prepare("INSERT INTO message_participants (id, thread_id, user_id, last_read_at) VALUES (?, ?, ?, ?)").bind(createId(), threadId, user.id, now),
        db.prepare("INSERT INTO community_meetings (id, owner_user_id, thread_id, title, scheduled_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(meetingId, user.id, threadId, title, scheduledAt, now, now),
      ]);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "";
      if (/active_owner|UNIQUE/i.test(detail)) return NextResponse.json({ error: "You already have a live or scheduled meeting" }, { status: 409 });
      return NextResponse.json({ error: "Meeting could not be scheduled" }, { status: 503 });
    }
    return NextResponse.json({ meetingId, threadId }, { status: 201 });
  }

  const meetingId = String(input.meetingId || "");
  const meeting = meetingId ? await db.prepare("SELECT id, owner_user_id AS ownerUserId, thread_id AS threadId, scheduled_at AS scheduledAt FROM community_meetings WHERE id = ? AND ended_at IS NULL LIMIT 1").bind(meetingId).first<{ id: string; ownerUserId: string; threadId: string; scheduledAt: number }>() : null;
  if (!meeting) return NextResponse.json({ error: "Meeting not found" }, { status: 404 });

  if (input.action === "join") {
    const existing = await db.prepare("SELECT id FROM message_participants WHERE thread_id = ? AND user_id = ? LIMIT 1").bind(meeting.threadId, user.id).first<{ id: string }>();
    if (existing) await db.prepare("UPDATE message_participants SET deleted_at = NULL WHERE id = ?").bind(existing.id).run();
    else await db.prepare("INSERT INTO message_participants (id, thread_id, user_id, last_read_at) VALUES (?, ?, ?, 0)").bind(createId(), meeting.threadId, user.id).run();
    return NextResponse.json({ threadId: meeting.threadId, live: Number(meeting.scheduledAt) <= now });
  }

  if (input.action === "end") {
    if (meeting.ownerUserId !== user.id) return NextResponse.json({ error: "Only the host can end this meeting" }, { status: 403 });
    await db.batch([
      db.prepare("UPDATE community_meetings SET ended_at = ?, updated_at = ? WHERE id = ? AND ended_at IS NULL").bind(now, now, meeting.id),
      db.prepare("UPDATE message_calls SET status = 'ended', ended_at = ? WHERE thread_id = ? AND status = 'active'").bind(now, meeting.threadId),
      db.prepare("UPDATE message_threads SET updated_at = ? WHERE id = ?").bind(now, meeting.threadId),
    ]);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
