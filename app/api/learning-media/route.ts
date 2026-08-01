import { getDatabase, getSessionUser } from "../../../lib/auth";
import {
  privateMediaResponseHeaders,
  SmartLingoMediaError,
  storeSmartLingoMedia,
  tombstoneSmartLingoMedia,
} from "../../../lib/smartlingo-media";

export const dynamic = "force-dynamic";

type LearningMediaKind = "course_cover" | "voice_practice";

type AssetRow = {
  id: string;
  ownerUserId: string;
  kind: LearningMediaKind;
  scopeType: string;
  scopeId: string;
  objectKey: string;
  mimeType: string;
  sizeBytes: number;
  status: string;
};

function bucket() {
  const value = (globalThis as unknown as { __SMARTLINGO_BUCKET__?: R2Bucket }).__SMARTLINGO_BUCKET__;
  if (!value) throw new Error("Learning media storage unavailable");
  return value;
}

async function classAccess(classId: string, userId: string, ownerOnly = false) {
  const row = await getDatabase().prepare(`SELECT c.owner_user_id AS ownerUserId,
      c.visibility,
      EXISTS (
        SELECT 1 FROM smartlingo_language_class_members member
        WHERE member.class_id = c.id AND member.user_id = ?
          AND member.status IN ('active', 'invited', 'paused')
      ) AS isMember
    FROM smartlingo_language_classes c WHERE c.id = ? LIMIT 1`)
    .bind(userId, classId)
    .first<{ ownerUserId: string; visibility: string; isMember: number }>();
  if (!row) return false;
  if (row.ownerUserId === userId) return true;
  return !ownerOnly && (row.visibility === "public" || Boolean(row.isMember));
}

async function assetById(id: string, includeTombstone = false) {
  return getDatabase().prepare(`SELECT id, owner_user_id AS ownerUserId, kind,
      scope_type AS scopeType, scope_id AS scopeId, object_key AS objectKey,
      mime_type AS mimeType, size_bytes AS sizeBytes, status
    FROM smartlingo_media_assets
    WHERE id = ? AND kind IN ('course_cover', 'voice_practice')
      ${includeTombstone ? "AND status IN ('ready', 'tombstone')" : "AND status = 'ready'"}
    LIMIT 1`).bind(id).first<AssetRow>();
}

async function canRead(asset: AssetRow, userId: string) {
  if (asset.kind === "voice_practice") {
    return asset.scopeType === "user" && asset.scopeId === userId && asset.ownerUserId === userId;
  }
  return asset.scopeType === "language_class" && classAccess(asset.scopeId, userId);
}

async function canDelete(asset: AssetRow, userId: string) {
  if (asset.ownerUserId !== userId) return false;
  if (asset.kind === "voice_practice") return asset.scopeType === "user" && asset.scopeId === userId;
  return asset.scopeType === "language_class" && classAccess(asset.scopeId, userId, true);
}

export async function GET(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: "Authentication required" }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id") || "";
  const asset = id ? await assetById(id) : null;
  if (!asset || !await canRead(asset, user.id)) {
    return Response.json({ error: "Learning media not found" }, { status: 404 });
  }
  const object = await bucket().get(asset.objectKey);
  if (!object) return Response.json({ error: "Learning media unavailable" }, { status: 404 });
  const name = asset.kind === "course_cover" ? "class-cover" : "voice-practice";
  return new Response(object.body, {
    headers: privateMediaResponseHeaders({ mimeType: asset.mimeType, sizeBytes: asset.sizeBytes, name }),
  });
}

export async function POST(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: "Authentication required" }, { status: 401 });
  const form = await request.formData();
  const kind = String(form.get("kind") || "") as LearningMediaKind;
  const file = form.get("file");
  if (!(file instanceof File) || (kind !== "course_cover" && kind !== "voice_practice")) {
    return Response.json({ error: "Invalid learning media" }, { status: 400 });
  }

  const database = getDatabase();
  const storage = bucket();
  const rawClassId = String(form.get("classId") || "").trim();
  const classId = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/.test(rawClassId) ? rawClassId : "";
  let scopeType: "language_class" | "user";
  let scopeId: string;
  if (kind === "course_cover") {
    if (!classId || !await classAccess(classId, user.id, true)) {
      return Response.json({ error: "Class owner access required" }, { status: 403 });
    }
    scopeType = "language_class";
    scopeId = classId;
  } else {
    scopeType = "user";
    scopeId = user.id;
  }

  const previous = kind === "course_cover"
    ? await database.prepare(`SELECT id, object_key AS objectKey
        FROM smartlingo_media_assets
        WHERE owner_user_id = ? AND kind = 'course_cover'
          AND scope_type = 'language_class' AND scope_id = ? AND status = 'ready'
        ORDER BY created_at DESC LIMIT 1`)
      .bind(user.id, scopeId).first<{ id: string; objectKey: string }>()
    : null;

  let stored;
  try {
    stored = await storeSmartLingoMedia({
      database,
      bucket: storage,
      ownerUserId: user.id,
      kind,
      scopeType,
      scopeId,
      file,
    });
  } catch (error) {
    if (error instanceof SmartLingoMediaError) {
      return Response.json({ error: "Invalid learning media" }, { status: 400 });
    }
    throw error;
  }

  let cleanupPending = false;
  if (previous && previous.id !== stored.id) {
    try {
      await tombstoneSmartLingoMedia({
        database,
        bucket: storage,
        assetId: previous.id,
        objectKey: previous.objectKey,
      });
    } catch {
      cleanupPending = true;
    }
  }

  return Response.json({
    media: {
      id: stored.id,
      kind,
      mimeType: stored.validated.mimeType,
      sizeBytes: stored.validated.sizeBytes,
      url: `/api/learning-media?id=${encodeURIComponent(stored.id)}`,
    },
    cleanupPending,
  }, { status: 201 });
}

export async function DELETE(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: "Authentication required" }, { status: 401 });
  const payload = await request.json().catch(() => null) as { id?: string } | null;
  const asset = payload?.id ? await assetById(payload.id, true) : null;
  if (!asset || !await canDelete(asset, user.id)) {
    return Response.json({ error: "Learning media not found" }, { status: 404 });
  }
  try {
    await tombstoneSmartLingoMedia({
      database: getDatabase(),
      bucket: bucket(),
      assetId: asset.id,
      objectKey: asset.objectKey,
    });
  } catch {
    return Response.json({ error: "Deletion is pending; retry safely." }, { status: 503 });
  }
  return Response.json({ ok: true });
}
