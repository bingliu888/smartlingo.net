import { requestUser } from "../../../lib/request-user";
import { getDatabase } from "../../../lib/auth";
import {
  privateMediaResponseHeaders,
  sanitizeMediaFileName,
  SmartLingoMediaError,
  storeSmartLingoMedia,
  tombstoneSmartLingoMedia,
} from "../../../lib/smartlingo-media";

export const dynamic = "force-dynamic";
function bucket() { const value = (globalThis as unknown as { __SMARTLINGO_BUCKET__?: R2Bucket }).__SMARTLINGO_BUCKET__; if (!value) throw new Error("Message storage unavailable"); return value; }
async function participant(threadId: string, userId: string) { return getDatabase().prepare("SELECT id FROM message_participants WHERE thread_id = ? AND user_id = ? AND deleted_at IS NULL").bind(threadId, userId).first(); }

export async function GET(request: Request) {
  const user = await requestUser(); if (!user) return Response.json({ error: "Authentication required" }, { status: 401 }); const url = new URL(request.url); const threadId = url.searchParams.get("thread") || ""; const id = url.searchParams.get("id") || ""; const db = getDatabase();
  if (!threadId || !id || !await participant(threadId, user.id)) return Response.json({ error: "Attachment not found" }, { status: 404 });
  const message = await db.prepare("SELECT body FROM messages WHERE thread_id = ? AND deleted_at IS NULL AND body LIKE ?").bind(threadId, `%\"id\":\"${id}\"%`).first<{ body: string }>();
  if (!message?.body.startsWith("__ATTACHMENT__|")) return Response.json({ error: "Attachment not found" }, { status: 404 });
  let meta: { id?: string; name?: string };
  try { meta = JSON.parse(message.body.slice(15)) as { id?: string; name?: string }; } catch { return Response.json({ error: "Attachment not found" }, { status: 404 }); }
  if (meta.id !== id) return Response.json({ error: "Attachment not found" }, { status: 404 });
  const asset = await db.prepare(
    `SELECT object_key AS objectKey, mime_type AS mimeType, size_bytes AS sizeBytes
     FROM smartlingo_media_assets
     WHERE id = ? AND kind = 'chat_attachment' AND scope_type = 'message_thread'
       AND scope_id = ? AND visibility = 'private' AND status = 'ready'`,
  ).bind(id, threadId).first<{ objectKey: string; mimeType: string; sizeBytes: number }>();
  if (!asset) return Response.json({ error: "Attachment not found" }, { status: 404 });
  const object = await bucket().get(asset.objectKey); if (!object) return Response.json({ error: "Attachment unavailable" }, { status: 404 });
  return new Response(object.body, { headers: privateMediaResponseHeaders({ mimeType: asset.mimeType, sizeBytes: asset.sizeBytes, name: meta.name || "attachment" }) });
}

export async function POST(request: Request) {
  const user = await requestUser(); if (!user) return Response.json({ error: "Authentication required" }, { status: 401 }); const form = await request.formData(); const file = form.get("file"); const threadId = String(form.get("threadId") || ""); const db = getDatabase();
  if (!threadId || !(file instanceof File) || !await participant(threadId, user.id)) return Response.json({ error: "Invalid attachment" }, { status: 400 });
  const storage = bucket();
  const now = Math.floor(Date.now() / 1000);
  let stored;
  try {
    stored = await storeSmartLingoMedia({ database: db, bucket: storage, ownerUserId: user.id, kind: "chat_attachment", scopeType: "message_thread", scopeId: threadId, file, now });
  } catch (error) {
    if (error instanceof SmartLingoMediaError) return Response.json({ error: "Invalid attachment" }, { status: 400 });
    throw error;
  }
  const id = stored.id;
  const messageId = crypto.randomUUID();
  const name = sanitizeMediaFileName(file.name, `attachment-${id}`);
  const meta = { id, name, mimeType: stored.validated.mimeType, size: stored.validated.sizeBytes, url: `/api/message-media?thread=${encodeURIComponent(threadId)}&id=${encodeURIComponent(id)}` };
  let messageInserted = false;
  try {
    const inserted = await db.prepare("INSERT INTO messages (id, thread_id, sender_id, body, created_at) VALUES (?, ?, ?, ?, ?)").bind(messageId, threadId, user.id, `__ATTACHMENT__|${JSON.stringify(meta)}`, now).run();
    if (!inserted.success) throw new Error("Attachment message insert failed");
    messageInserted = true;
    const updated = await db.prepare("UPDATE message_threads SET updated_at = ? WHERE id = ?").bind(now, threadId).run();
    if (!updated.success) throw new Error("Attachment thread update failed");
  } catch (error) {
    if (messageInserted) await db.prepare("DELETE FROM messages WHERE id = ? AND sender_id = ?").bind(messageId, user.id).run().catch(() => undefined);
    await tombstoneSmartLingoMedia({ database: db, bucket: storage, assetId: stored.id, objectKey: stored.objectKey, now }).catch(() => undefined);
    throw error;
  }
  return Response.json({ attachment: meta }, { status: 201 });
}
