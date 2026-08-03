import { NextResponse } from "next/server";
import { createId, getDatabase, getSessionUser } from "../../../lib/auth";
import { avatarsById } from "../../../lib/member-avatars";

export const dynamic = "force-dynamic";

async function recordCommunityActivity(db: ReturnType<typeof getDatabase>, userId: string, sourceType: string, sourceId: string, now: number) {
  await db.prepare(`INSERT OR IGNORE INTO smartlingo_learning_activity_events
    (id, user_id, domain, activity_type, duration_seconds, units,
     source_type, source_id, created_at)
    VALUES (?, ?, 'community', ?, 0, 1, ?, ?, ?)`)
    .bind(createId(), userId, sourceType === "community_reply" ? "community_reply" : "community_topic", sourceType, sourceId, now).run();
}

export async function GET() {
  const user = await getSessionUser(); if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = getDatabase();
  const memberRows = (await db.prepare("SELECT id, display_name AS displayName, created_at AS createdAt FROM users ORDER BY created_at DESC LIMIT 60").run<{ id: string; displayName: string; createdAt: number }>()).results || [];
  const avatars = await avatarsById();
  const meetingRows = (await db.prepare(`SELECT id, owner_user_id AS ownerUserId, thread_id AS threadId,
    title, scheduled_at AS scheduledAt FROM community_meetings WHERE ended_at IS NULL`).run<{
      id: string; ownerUserId: string; threadId: string; title: string; scheduledAt: number;
    }>()).results || [];
  const meetingByOwner = new Map(meetingRows.map(meeting => [meeting.ownerUserId, meeting]));
  const members = memberRows.map(member => ({ ...member, imageUrl: avatars.get(member.id) || "", meeting: meetingByOwner.get(member.id) || null }));
  const topics = (await db.prepare("SELECT t.id, t.category, t.title, t.body, t.created_at AS createdAt, u.id AS authorId, u.display_name AS authorName FROM community_topics t JOIN users u ON u.id = t.user_id ORDER BY t.updated_at DESC LIMIT 80").run()).results || [];
  const replies = (await db.prepare("SELECT r.id, r.topic_id AS topicId, r.body, r.created_at AS createdAt, u.id AS authorId, u.display_name AS authorName FROM community_replies r JOIN users u ON u.id = r.user_id ORDER BY r.created_at ASC LIMIT 400").run()).results || [];
  return NextResponse.json({ currentUserId: user.id, members, topics, replies });
}

export async function POST(request: Request) {
  const user = await getSessionUser(request); if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const input = await request.json() as { type?: string; category?: string; title?: string; body?: string; topicId?: string }; const now = Math.floor(Date.now() / 1000); const db = getDatabase();
  const body = input.body?.trim(); if (!body || body.length > 1200) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  if (input.type === "topic") { const title = input.title?.trim(); if (!title || title.length > 100) return NextResponse.json({ error: "Invalid title" }, { status: 400 }); const category = ["general", "learning", "projects", "events"].includes(input.category || "") ? input.category : "general"; const id = createId(); await db.prepare("INSERT INTO community_topics (id, user_id, category, title, body, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(id, user.id, category, title, body, now, now).run(); await recordCommunityActivity(db, user.id, "community_topic", id, now); return NextResponse.json({ id }); }
  if (input.type === "reply" && input.topicId) { const topic = await db.prepare("SELECT id FROM community_topics WHERE id = ?").bind(input.topicId).first<{ id: string }>(); if (!topic) return NextResponse.json({ error: "Topic not found" }, { status: 404 }); const id = createId(); await db.prepare("INSERT INTO community_replies (id, topic_id, user_id, body, created_at) VALUES (?, ?, ?, ?, ?)").bind(id, input.topicId, user.id, body, now).run(); await db.prepare("UPDATE community_topics SET updated_at = ? WHERE id = ?").bind(now, input.topicId).run(); await recordCommunityActivity(db, user.id, "community_reply", id, now); return NextResponse.json({ id }); }
  return NextResponse.json({ error: "Invalid request" }, { status: 400 });
}
