import { getDatabase, getSessionUser } from "../../../lib/auth";
import {
  privateMediaResponseHeaders,
  SmartLingoMediaError,
  storeSmartLingoMedia,
  tombstoneSmartLingoMedia,
} from "../../../lib/smartlingo-media";

function bucket() {
  const value = (globalThis as unknown as { __SMARTLINGO_BUCKET__?: R2Bucket }).__SMARTLINGO_BUCKET__;
  if (!value) throw new Error("Profile storage unavailable");
  return value;
}

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "Authentication required" }, { status: 401 });
  const avatarUserId = new URL(request.url).searchParams.get("avatar");
  if (avatarUserId) {
    const avatar = await getDatabase().prepare(
      `SELECT asset.object_key AS objectKey, asset.mime_type AS mimeType, asset.size_bytes AS sizeBytes
       FROM user_avatars avatar
       JOIN smartlingo_media_assets asset ON asset.object_key = avatar.object_key
       WHERE avatar.user_id = ? AND asset.kind = 'avatar' AND asset.scope_type = 'user'
         AND asset.scope_id = avatar.user_id AND asset.visibility = 'private' AND asset.status = 'ready'`,
    ).bind(avatarUserId).first<{ objectKey: string; mimeType: string; sizeBytes: number }>();
    if (!avatar) return new Response(null, { status: 404 });
    const object = await bucket().get(avatar.objectKey);
    if (!object) return new Response(null, { status: 404 });
    return new Response(object.body, {
      headers: privateMediaResponseHeaders({
        mimeType: avatar.mimeType,
        sizeBytes: avatar.sizeBytes,
        name: "profile-photo",
      }),
    });
  }
  const introducer = await getDatabase().prepare(`SELECT owner.display_name AS displayName, r.status AS status
    FROM referrals r
    JOIN referral_codes code ON code.id = r.referral_code_id
    JOIN users owner ON owner.id = code.user_id
    WHERE r.referred_user_id = ? AND r.status IN ('attributed', 'active', 'converted')
    LIMIT 1`).bind(user.id).first<{ displayName: string; status: string }>();
  const avatar = await getDatabase().prepare("SELECT user_id AS userId FROM user_avatars WHERE user_id = ?").bind(user.id).first<{ userId: string }>();
  const wallet = await getDatabase().prepare("SELECT wallet_address AS walletAddress FROM users WHERE id = ?").bind(user.id).first<{ walletAddress: string | null }>();
  return Response.json({ profile: { displayName: user.displayName, preferredLanguage: user.preferredLanguage, walletAddress: wallet?.walletAddress ?? "", imageUrl: avatar ? `/api/profile?avatar=${encodeURIComponent(user.id)}` : "" }, introducer: introducer ?? null });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "Authentication required" }, { status: 401 });
  if (request.headers.get("content-type")?.includes("multipart/form-data")) {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return Response.json({ error: "Photo is required" }, { status: 400 });
    const database = getDatabase();
    const storage = bucket();
    const previous = await database.prepare(
      `SELECT avatar.object_key AS objectKey, asset.id AS assetId
       FROM user_avatars avatar
       LEFT JOIN smartlingo_media_assets asset ON asset.object_key = avatar.object_key
       WHERE avatar.user_id = ?`,
    ).bind(user.id).first<{ objectKey: string; assetId: string | null }>();
    const now = Math.floor(Date.now() / 1000);
    let stored;
    try {
      stored = await storeSmartLingoMedia({
        database,
        bucket: storage,
        ownerUserId: user.id,
        kind: "avatar",
        scopeType: "user",
        scopeId: user.id,
        file,
        now,
      });
    } catch (error) {
      if (error instanceof SmartLingoMediaError) {
        return Response.json({ error: "Invalid photo" }, { status: 400 });
      }
      throw error;
    }
    try {
      const result = await database.prepare(
        "INSERT INTO user_avatars (user_id, object_key, mime_type, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET object_key = excluded.object_key, mime_type = excluded.mime_type, updated_at = excluded.updated_at",
      ).bind(user.id, stored.objectKey, stored.validated.mimeType, now).run();
      if (!result.success) throw new Error("Avatar pointer update failed");
    } catch (error) {
      await tombstoneSmartLingoMedia({
        database,
        bucket: storage,
        assetId: stored.id,
        objectKey: stored.objectKey,
        now,
      }).catch(() => undefined);
      throw error;
    }
    if (previous?.objectKey && previous.objectKey !== stored.objectKey) {
      await tombstoneSmartLingoMedia({
        database,
        bucket: storage,
        assetId: previous.assetId ?? undefined,
        objectKey: previous.objectKey,
        now,
      }).catch(() => undefined);
    }
    return Response.json({ imageUrl: `/api/profile?avatar=${encodeURIComponent(user.id)}&v=${now}` });
  }
  const payload = await request.json() as { displayName?: string; preferredLanguage?: string; walletAddress?: string };
  const hasProfile = typeof payload.displayName === "string";
  const hasWallet = Object.prototype.hasOwnProperty.call(payload, "walletAddress");
  if (!hasProfile && !hasWallet) return Response.json({ error: "No profile changes supplied" }, { status: 400 });
  const displayName = payload.displayName?.trim().slice(0, 60);
  if (hasProfile && (!displayName || displayName.length < 2)) return Response.json({ error: "Display name is required" }, { status: 400 });
  const preferredLanguage = payload.preferredLanguage === "zh" ? "zh" : "en";
  const walletAddress = payload.walletAddress?.trim() || "";
  if (hasWallet && walletAddress && !/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) return Response.json({ error: "Enter a valid EVM wallet address" }, { status: 400 });
  if (hasProfile && hasWallet) await getDatabase().prepare("UPDATE users SET display_name = ?, preferred_language = ?, wallet_address = ? WHERE id = ?").bind(displayName, preferredLanguage, walletAddress || null, user.id).run();
  else if (hasProfile) await getDatabase().prepare("UPDATE users SET display_name = ?, preferred_language = ? WHERE id = ?").bind(displayName, preferredLanguage, user.id).run();
  else await getDatabase().prepare("UPDATE users SET wallet_address = ? WHERE id = ?").bind(walletAddress || null, user.id).run();
  return Response.json({ profile: { displayName: displayName ?? user.displayName, preferredLanguage: hasProfile ? preferredLanguage : user.preferredLanguage, walletAddress } });
}
