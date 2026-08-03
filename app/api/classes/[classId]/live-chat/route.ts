import { createId, getDatabase, getSessionUser } from "../../../../../lib/auth";
import { cleanText } from "../../../../../lib/smartlingo-classes";

export const dynamic = "force-dynamic";

const nowSeconds = () => Math.floor(Date.now() / 1000);
const threadIdForClass = (classId: string) => `class-chat:${classId}`;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ classId: string }> },
) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: "Authentication required" }, { status: 401 });

  const classId = cleanText((await params).classId, 100);
  const db = getDatabase();
  const classRow = await db.prepare(`SELECT id, owner_user_id AS ownerUserId, title
    FROM smartlingo_language_classes WHERE id = ? AND status = 'open' LIMIT 1`)
    .bind(classId).first<{ id: string; ownerUserId: string; title: string }>();
  if (!classRow) return Response.json({ error: "Class not found" }, { status: 404 });

  const membership = await db.prepare(`SELECT role, status
    FROM smartlingo_language_class_members
    WHERE class_id = ? AND user_id = ? AND status = 'active' LIMIT 1`)
    .bind(classId, user.id).first<{ role: string; status: string }>();
  const isOwner = classRow.ownerUserId === user.id;
  if (!isOwner && !membership) {
    return Response.json({ error: "Active class membership required" }, { status: 403 });
  }

  const now = nowSeconds();
  const threadId = threadIdForClass(classId);
  await db.batch([
    db.prepare(`INSERT OR IGNORE INTO message_threads
      (id, kind, subject, created_by, created_at, updated_at)
      VALUES (?, 'class', ?, ?, ?, ?)`)
      .bind(threadId, classRow.title, classRow.ownerUserId, now, now),
    db.prepare(`INSERT INTO message_participants (id, thread_id, user_id, last_read_at, deleted_at)
      VALUES (?, ?, ?, 0, NULL)
      ON CONFLICT(thread_id, user_id) DO UPDATE SET deleted_at = NULL`)
      .bind(createId(), threadId, user.id),
    db.prepare(`INSERT INTO user_presence (user_id, last_seen_at) VALUES (?, ?)
      ON CONFLICT(user_id) DO UPDATE SET last_seen_at = excluded.last_seen_at`)
      .bind(user.id, now),
  ]);

  const counts = await db.prepare(`SELECT
      COUNT(DISTINCT eligible.user_id) AS memberCount,
      COUNT(DISTINCT CASE WHEN COALESCE(p.last_seen_at, 0) >= ? THEN eligible.user_id END) AS onlineCount
    FROM (
      SELECT owner_user_id AS user_id FROM smartlingo_language_classes WHERE id = ?
      UNION
      SELECT user_id FROM smartlingo_language_class_members WHERE class_id = ? AND status = 'active'
    ) eligible
    LEFT JOIN user_presence p ON p.user_id = eligible.user_id`)
    .bind(now - 45, classId, classId).first<{ memberCount: number; onlineCount: number }>();
  const activeCall = await db.prepare(`SELECT id, mode, status, expires_at AS expiresAt
    FROM message_calls WHERE thread_id = ? AND status = 'active' AND expires_at > ? LIMIT 1`)
    .bind(threadId, now).first();

  return Response.json({
    classId,
    threadId,
    title: classRow.title,
    memberCount: Number(counts?.memberCount || 0),
    onlineCount: Number(counts?.onlineCount || 0),
    activeAudioCall: activeCall || null,
  });
}
