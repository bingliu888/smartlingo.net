import { NextResponse } from "next/server";
import { createId, getDatabase, getSessionUser } from "../../../lib/auth";
import { avatarsById } from "../../../lib/member-avatars";
import { tombstoneSmartLingoMedia } from "../../../lib/smartlingo-media";

export const dynamic = "force-dynamic";
type Row = Record<string, string | number | null>;
const nowSeconds = () => Math.floor(Date.now() / 1000);
const isAdmin = (email: string) => (process.env.ADMIN_EMAILS || "").toLowerCase().split(",").map(value => value.trim()).includes(email.toLowerCase());
async function touchPresence(userId: string) { const db = getDatabase(); const now = nowSeconds(); await db.prepare("INSERT INTO user_presence (user_id, last_seen_at) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET last_seen_at = excluded.last_seen_at").bind(userId, now).run(); return now; }
async function participant(threadId: string, userId: string) { return getDatabase().prepare("SELECT id FROM message_participants WHERE thread_id = ? AND user_id = ? AND deleted_at IS NULL").bind(threadId, userId).first(); }
function messageBucket() { const value = (globalThis as unknown as { __SMARTLINGO_BUCKET__?: R2Bucket }).__SMARTLINGO_BUCKET__; if (!value) throw new Error("Message storage unavailable"); return value; }
const attachmentFromBody = (body: string) => { if (!body.startsWith("__ATTACHMENT__|")) return null; try { return JSON.parse(body.slice(15)) as { id: string; name: string; mimeType: string; size: number; url: string }; } catch { return null; } };
const visibleBody = (body: string) => { if (body.startsWith("__GURU__|")) return body.slice(9); if (body.startsWith("__EDITED__|")) return body.slice(11); const attachment = attachmentFromBody(body); return attachment ? `[Attachment] ${attachment.name}` : body; };

async function directThread(userId: string, recipientId: string) {
  const db = getDatabase();
  const existing = await db.prepare(`SELECT t.id FROM message_threads t
    WHERE t.kind = 'direct'
    AND EXISTS (SELECT 1 FROM message_participants a WHERE a.thread_id = t.id AND a.user_id = ?)
    AND EXISTS (SELECT 1 FROM message_participants b WHERE b.thread_id = t.id AND b.user_id = ?)
    AND (SELECT COUNT(*) FROM message_participants c WHERE c.thread_id = t.id) = 2
    ORDER BY t.updated_at DESC LIMIT 1`).bind(userId, recipientId).first<{ id: string }>();
  if (existing) { await db.prepare("UPDATE message_participants SET deleted_at = NULL WHERE thread_id = ? AND user_id IN (?, ?)").bind(existing.id, userId, recipientId).run(); return existing.id; }
  const threadId = createId(); const now = nowSeconds();
  await db.prepare("INSERT INTO message_threads (id, kind, subject, created_by, created_at, updated_at) VALUES (?, 'direct', '', ?, ?, ?)").bind(threadId, userId, now, now).run();
  for (const id of [userId, recipientId]) await db.prepare("INSERT INTO message_participants (id, thread_id, user_id, last_read_at) VALUES (?, ?, ?, ?)").bind(createId(), threadId, id, id === userId ? now : 0).run();
  return threadId;
}

export async function GET(request: Request) {
  const user = await getSessionUser(); if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = getDatabase(); const now = await touchPresence(user.id); const url = new URL(request.url); const threadId = url.searchParams.get("thread");
  if (url.searchParams.get("notifications") === "1") {
    const rows = (await db.prepare(`SELECT m.id, m.thread_id AS threadId, m.body, m.created_at AS createdAt, u.display_name AS senderName
      FROM messages m JOIN users u ON u.id = m.sender_id JOIN message_participants mp ON mp.thread_id = m.thread_id
      WHERE mp.user_id = ? AND mp.deleted_at IS NULL AND m.sender_id != ? AND m.deleted_at IS NULL AND m.created_at >= ? AND m.body NOT LIKE '__NOTICE_RESPONSE__|%' AND m.body NOT LIKE '__MEMBER_JOINED__|%'
      ORDER BY m.created_at DESC LIMIT 20`).bind(user.id, user.id, now - 15).run<Row>()).results || [];
    const responses = (await db.prepare("SELECT body FROM messages WHERE sender_id = ? AND body LIKE '__NOTICE_RESPONSE__|%' ORDER BY created_at DESC LIMIT 50").bind(user.id).run<{ body: string }>()).results || [];
    const closed = new Set(responses.map(item => item.body.split("|")[1]));
    const notifications = rows.filter(row => !closed.has(String(row.id))).map(row => ({ id: String(row.id), type: String(row.body).startsWith("__LIVE_REQUEST__|") ? "live_request" : "message", senderName: String(row.senderName || "Member"), threadId: String(row.threadId), expiresAt: Number(row.createdAt) * 1000 + 15000 })).filter(item => item.expiresAt > Date.now());
    return NextResponse.json({ notifications });
  }
  if (threadId && url.searchParams.get("directory") === "1") {
    if (!await participant(threadId, user.id)) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    const query = (url.searchParams.get("q") || "").trim().slice(0, 100); const exactEmail = query.includes("@") ? query.toLowerCase() : ""; const like = query ? `%${query}%` : "%";
    const rows = (await db.prepare(`SELECT u.id, u.email, u.display_name AS displayName, COALESCE(p.last_seen_at, 0) AS lastSeenAt
      FROM users u LEFT JOIN user_presence p ON p.user_id = u.id
      WHERE u.id != ? AND NOT EXISTS (SELECT 1 FROM message_participants mp WHERE mp.thread_id = ? AND mp.user_id = u.id AND mp.deleted_at IS NULL)
      AND (? = '' OR LOWER(u.display_name) LIKE LOWER(?) OR (? != '' AND LOWER(u.email) = ?))
      ORDER BY u.display_name LIMIT 50`).bind(user.id, threadId, query, like, exactEmail, exactEmail).run<Row>()).results || [];
    const avatars = await avatarsById(); const members = rows.map(member => { const email = String(member.email || ""); return { id: String(member.id), displayName: String(member.displayName || "Member"), imageUrl: avatars.get(String(member.id)) || "", online: Number(member.lastSeenAt) >= now - 45, email: exactEmail && email.toLowerCase() === exactEmail ? email : "" }; });
    return NextResponse.json({ members });
  }
  if (threadId) {
    if (!await participant(threadId, user.id)) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    await db.prepare("UPDATE message_participants SET last_read_at = ? WHERE thread_id = ? AND user_id = ?").bind(now, threadId, user.id).run();
    const thread = await db.prepare("SELECT id, kind, subject, created_by AS createdBy, updated_at AS updatedAt FROM message_threads WHERE id = ?").bind(threadId).first<Row>();
    const rawMessageRows = (await db.prepare("SELECT m.id, m.body, m.created_at AS createdAt, m.sender_id AS senderId, u.display_name AS senderName FROM messages m JOIN users u ON u.id = m.sender_id WHERE m.thread_id = ? AND m.deleted_at IS NULL AND m.body NOT LIKE '__LIVE_REQUEST__|%' AND m.body NOT LIKE '__NOTICE_RESPONSE__|%' ORDER BY m.created_at ASC, m.rowid ASC LIMIT 400").bind(threadId).run<Row>()).results || [];
    const ownJoinMarker = `__MEMBER_JOINED__|${user.id}`; let visibleFrom = 0; rawMessageRows.forEach((message, index) => { if (String(message.body) === ownJoinMarker) visibleFrom = index + 1; }); const messageRows = rawMessageRows.slice(visibleFrom).filter(message => !String(message.body).startsWith("__MEMBER_JOINED__|"));
    const memberRows = (await db.prepare("SELECT u.id, u.display_name AS displayName, COALESCE(p.last_seen_at, 0) AS lastSeenAt FROM message_participants mp JOIN users u ON u.id = mp.user_id LEFT JOIN user_presence p ON p.user_id = u.id WHERE mp.thread_id = ? AND mp.deleted_at IS NULL").bind(threadId).run<Row>()).results || [];
    const avatars = await avatarsById(); const members = memberRows.map(member => ({ ...member, imageUrl: avatars.get(String(member.id)) || "", online: Number(member.lastSeenAt) >= now - 45 }));
    const messages = messageRows.map(message => { const stored = String(message.body); return { ...message, guru: stored.startsWith("__GURU__|"), edited: stored.startsWith("__EDITED__|"), attachment: attachmentFromBody(stored), body: stored.startsWith("__ATTACHMENT__|") ? "" : visibleBody(stored) }; });
    return NextResponse.json({ thread, messages, members, currentUserId: user.id });
  }
  const threads = (await db.prepare(`SELECT t.id, t.kind, t.subject, t.updated_at AS updatedAt,
    (SELECT body FROM messages lm WHERE lm.thread_id = t.id AND lm.deleted_at IS NULL AND lm.body NOT LIKE '__LIVE_REQUEST__|%' AND lm.body NOT LIKE '__NOTICE_RESPONSE__|%' AND lm.body NOT LIKE '__MEMBER_JOINED__|%' ORDER BY lm.created_at DESC LIMIT 1) AS preview,
    (SELECT COUNT(*) FROM messages um WHERE um.thread_id = t.id AND um.deleted_at IS NULL AND um.sender_id != ? AND um.body NOT LIKE '__LIVE_REQUEST__|%' AND um.body NOT LIKE '__NOTICE_RESPONSE__|%' AND um.body NOT LIKE '__MEMBER_JOINED__|%' AND um.created_at > mp.last_read_at) AS unread,
    (SELECT GROUP_CONCAT(u.display_name, ', ') FROM message_participants xp JOIN users u ON u.id = xp.user_id WHERE xp.thread_id = t.id AND xp.user_id != ? AND xp.deleted_at IS NULL) AS memberNames
    FROM message_participants mp JOIN message_threads t ON t.id = mp.thread_id WHERE mp.user_id = ? AND mp.deleted_at IS NULL ORDER BY t.updated_at DESC LIMIT 100`).bind(user.id, user.id, user.id).run<Row>()).results || [];
  const normalizedThreads = threads.map(thread => ({
    ...thread,
    preview: visibleBody(String(thread.preview || "")),
    unread: Number(thread.unread || 0),
  }));
  const unread = normalizedThreads.reduce((total, item) => total + item.unread, 0); if (url.searchParams.get("summary") === "1") return NextResponse.json({ unread });
  const memberRows = (await db.prepare("SELECT u.id, u.display_name AS displayName, u.created_at AS createdAt, COALESCE(p.last_seen_at, 0) AS lastSeenAt FROM users u LEFT JOIN user_presence p ON p.user_id = u.id WHERE u.id != ? ORDER BY u.display_name LIMIT 100").bind(user.id).run<Row>()).results || [];
  const avatars = await avatarsById(); const members = memberRows.map(member => ({ ...member, imageUrl: avatars.get(String(member.id)) || "", online: Number(member.lastSeenAt) >= now - 45 }));
  const teamCount = await db.prepare(`SELECT COUNT(*) AS value
    FROM referrals r JOIN referral_codes code ON code.id = r.referral_code_id
    WHERE code.user_id = ? AND r.status IN ('attributed', 'active', 'converted')`)
    .bind(user.id).first<{ value: number }>();
  return NextResponse.json({ currentUserId: user.id, unread, threads: normalizedThreads, members, canTeam: Number(teamCount?.value || 0) > 0, canGlobal: isAdmin(user.email) });
}

export async function POST(request: Request) {
  const user = await getSessionUser(request); if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const input = await request.json().catch(() => null) as { action?: string; kind?: string; recipientId?: string; memberId?: string; threadId?: string; subject?: string; body?: string; messageId?: string; notificationId?: string; response?: string } | null;
  if (!input) return NextResponse.json({ error: "Invalid request" }, { status: 400 }); const db = getDatabase(); const now = await touchPresence(user.id);
  if (input.action === "start_live") { const recipientId = String(input.recipientId || ""); if (!recipientId || recipientId === user.id || !await db.prepare("SELECT id FROM users WHERE id = ?").bind(recipientId).first()) return NextResponse.json({ error: "Choose a valid member" }, { status: 400 }); const threadId = await directThread(user.id, recipientId); const requestId = createId(); await db.prepare("INSERT INTO messages (id, thread_id, sender_id, body, created_at) VALUES (?, ?, ?, ?, ?)").bind(requestId, threadId, user.id, `__LIVE_REQUEST__|${now + 15}`, now).run(); await db.prepare("UPDATE message_threads SET updated_at = ? WHERE id = ?").bind(now, threadId).run(); return NextResponse.json({ threadId, requestId }); }
  if (input.action === "notification_response") { if (!input.notificationId || !input.threadId || !await participant(input.threadId, user.id)) return NextResponse.json({ error: "Invalid notification" }, { status: 400 }); const marker = `__NOTICE_RESPONSE__|${input.notificationId}|${input.response === "accepted" ? "accepted" : "dismissed"}`; await db.prepare("INSERT INTO messages (id, thread_id, sender_id, body, created_at) VALUES (?, ?, ?, ?, ?)").bind(createId(), input.threadId, user.id, marker, now).run(); return NextResponse.json({ threadId: input.threadId }); }
  if (input.action === "reply" || input.action === "guru_reply") { const body = input.body?.trim() || ""; if (!input.threadId || !body || body.length > 2000 || !await participant(input.threadId, user.id)) return NextResponse.json({ error: "Invalid message" }, { status: 400 }); const id = createId(); const stored = input.action === "guru_reply" ? `__GURU__|${body}` : body; await db.prepare("INSERT INTO messages (id, thread_id, sender_id, body, created_at) VALUES (?, ?, ?, ?, ?)").bind(id, input.threadId, user.id, stored, now).run(); await db.prepare("UPDATE message_threads SET updated_at = ? WHERE id = ?").bind(now, input.threadId).run(); await db.prepare("UPDATE message_participants SET deleted_at = NULL, last_read_at = CASE WHEN user_id = ? THEN ? ELSE last_read_at END WHERE thread_id = ?").bind(user.id, now, input.threadId).run(); return NextResponse.json({ id }); }
  if (input.action === "edit_message") { const body = input.body?.trim() || ""; if (!input.threadId || !input.messageId || !body || body.length > 2000 || !await participant(input.threadId, user.id)) return NextResponse.json({ error: "Invalid edit" }, { status: 400 }); const editable = await db.prepare("SELECT id FROM messages WHERE id = ? AND thread_id = ? AND sender_id = ? AND deleted_at IS NULL AND body NOT LIKE '__ATTACHMENT__|%' AND body NOT LIKE '__GURU__|%' AND body NOT LIKE '__LIVE_REQUEST__|%' AND body NOT LIKE '__NOTICE_RESPONSE__|%'").bind(input.messageId, input.threadId, user.id).first(); if (!editable) return NextResponse.json({ error: "Message cannot be edited" }, { status: 403 }); await db.prepare("UPDATE messages SET body = ? WHERE id = ?").bind(`__EDITED__|${body}`, input.messageId).run(); await db.prepare("UPDATE message_threads SET updated_at = ? WHERE id = ?").bind(now, input.threadId).run(); return NextResponse.json({ ok: true }); }
  if (input.action === "add_member") { const memberId = String(input.memberId || ""); if (!input.threadId || !memberId || memberId === user.id || !await participant(input.threadId, user.id) || !await db.prepare("SELECT id FROM users WHERE id = ?").bind(memberId).first()) return NextResponse.json({ error: "Choose a valid member" }, { status: 400 }); const existing = await db.prepare("SELECT id FROM message_participants WHERE thread_id = ? AND user_id = ?").bind(input.threadId, memberId).first<{ id: string }>(); if (existing) await db.prepare("UPDATE message_participants SET deleted_at = NULL, last_read_at = 0 WHERE id = ?").bind(existing.id).run(); else await db.prepare("INSERT INTO message_participants (id, thread_id, user_id, last_read_at) VALUES (?, ?, ?, 0)").bind(createId(), input.threadId, memberId).run(); await db.prepare("INSERT INTO messages (id, thread_id, sender_id, body, created_at) VALUES (?, ?, ?, ?, ?)").bind(createId(), input.threadId, user.id, `__MEMBER_JOINED__|${memberId}`, now).run(); await db.prepare("UPDATE message_threads SET kind = 'group', updated_at = ? WHERE id = ?").bind(now, input.threadId).run(); return NextResponse.json({ ok: true }); }
  if (input.action === "delete_message") {
    if (!input.messageId) return NextResponse.json({ error: "Message required" }, { status: 400 });
    const target = await db.prepare(
      "SELECT thread_id AS threadId, body FROM messages WHERE id = ? AND sender_id = ? AND deleted_at IS NULL LIMIT 1",
    ).bind(input.messageId, user.id).first<{ threadId: string; body: string }>();
    if (!target) return NextResponse.json({ error: "Message not found" }, { status: 404 });
    const attachment = attachmentFromBody(target.body);
    let attachmentDeleted = false;
    if (attachment?.id) {
      const asset = await db.prepare(`SELECT id, object_key AS objectKey
        FROM smartlingo_media_assets
        WHERE id = ? AND owner_user_id = ? AND kind = 'chat_attachment'
          AND scope_type = 'message_thread' AND scope_id = ?
          AND status IN ('ready', 'tombstone') LIMIT 1`)
        .bind(attachment.id, user.id, target.threadId)
        .first<{ id: string; objectKey: string }>();
      if (asset) {
        try {
          await tombstoneSmartLingoMedia({
            database: db,
            bucket: messageBucket(),
            assetId: asset.id,
            objectKey: asset.objectKey,
            now,
          });
          attachmentDeleted = true;
        } catch {
          return NextResponse.json({ error: "Attachment deletion is pending; retry safely." }, { status: 503 });
        }
      }
    }
    const deleted = await db.prepare("UPDATE messages SET deleted_at = ? WHERE id = ? AND sender_id = ? AND deleted_at IS NULL")
      .bind(now, input.messageId, user.id).run();
    if (!deleted.success) return NextResponse.json({ error: "Message deletion failed" }, { status: 503 });
    return NextResponse.json({ ok: true, attachmentDeleted });
  }
  if (input.action === "delete_thread") { if (!input.threadId || !await participant(input.threadId, user.id)) return NextResponse.json({ error: "Conversation not found" }, { status: 404 }); await db.prepare("UPDATE message_participants SET deleted_at = ? WHERE thread_id = ? AND user_id = ?").bind(now, input.threadId, user.id).run(); return NextResponse.json({ ok: true }); }
  if (input.action !== "create") return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  const kind = input.kind === "team" ? "team" : input.kind === "global" ? "global" : "direct"; const body = input.body?.trim() || ""; const subject = (input.subject?.trim() || "").slice(0, 80); if (!body || body.length > 2000) return NextResponse.json({ error: "Message is required" }, { status: 400 }); let recipients: string[] = [];
  if (kind === "direct") { const recipientId = String(input.recipientId || ""); if (!recipientId || recipientId === user.id || !await db.prepare("SELECT id FROM users WHERE id = ?").bind(recipientId).first()) return NextResponse.json({ error: "Choose a valid recipient" }, { status: 400 }); const threadId = await directThread(user.id, recipientId); await db.prepare("INSERT INTO messages (id, thread_id, sender_id, body, created_at) VALUES (?, ?, ?, ?, ?)").bind(createId(), threadId, user.id, body, now).run(); await db.prepare("UPDATE message_threads SET updated_at = ? WHERE id = ?").bind(now, threadId).run(); return NextResponse.json({ threadId }); }
  if (kind === "team") { const rows = (await db.prepare(`SELECT r.referred_user_id AS id
    FROM referrals r JOIN referral_codes code ON code.id = r.referral_code_id
    WHERE code.user_id = ? AND r.status IN ('attributed', 'active', 'converted')`)
    .bind(user.id).run<{ id: string }>()).results || []; recipients = rows.map(row => row.id); if (!recipients.length) return NextResponse.json({ error: "Your direct-introduction group is empty" }, { status: 400 }); }
  else { if (!isAdmin(user.email)) return NextResponse.json({ error: "Admin permission required" }, { status: 403 }); const rows = (await db.prepare("SELECT id FROM users WHERE id != ?").bind(user.id).run<{ id: string }>()).results || []; recipients = rows.map(row => row.id); }
  const threadId = createId(); await db.prepare("INSERT INTO message_threads (id, kind, subject, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)").bind(threadId, kind, subject, user.id, now, now).run(); for (const id of [user.id, ...new Set(recipients)]) await db.prepare("INSERT INTO message_participants (id, thread_id, user_id, last_read_at) VALUES (?, ?, ?, ?)").bind(createId(), threadId, id, id === user.id ? now : 0).run(); await db.prepare("INSERT INTO messages (id, thread_id, sender_id, body, created_at) VALUES (?, ?, ?, ?, ?)").bind(createId(), threadId, user.id, body, now).run(); return NextResponse.json({ threadId });
}
