export const SMARTLINGO_BROWSER_MEDIA_MAX_BYTES = 900 * 1024;

const IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
const DOCUMENT_MIME_TYPES = ["application/pdf", "text/plain"] as const;
const AUDIO_MIME_TYPES = ["audio/mpeg", "audio/mp4", "audio/ogg", "audio/wav", "audio/webm"] as const;
const VIDEO_MIME_TYPES = ["video/mp4", "video/webm"] as const;

export type SmartLingoMediaKind =
  | "avatar"
  | "course_cover"
  | "voice_practice"
  | "courseware"
  | "assignment_attachment"
  | "chat_attachment"
  | "certificate_asset";

type MediaPolicy = {
  mimeTypes: readonly string[];
  serverOnly: boolean;
};

export const SMARTLINGO_MEDIA_POLICIES: Readonly<Record<SmartLingoMediaKind, MediaPolicy>> = {
  avatar: { mimeTypes: IMAGE_MIME_TYPES, serverOnly: false },
  course_cover: { mimeTypes: IMAGE_MIME_TYPES, serverOnly: false },
  voice_practice: { mimeTypes: AUDIO_MIME_TYPES, serverOnly: false },
  courseware: { mimeTypes: [...IMAGE_MIME_TYPES, ...DOCUMENT_MIME_TYPES, ...AUDIO_MIME_TYPES, ...VIDEO_MIME_TYPES], serverOnly: false },
  assignment_attachment: { mimeTypes: [...IMAGE_MIME_TYPES, ...DOCUMENT_MIME_TYPES, ...AUDIO_MIME_TYPES, ...VIDEO_MIME_TYPES], serverOnly: false },
  chat_attachment: { mimeTypes: [...IMAGE_MIME_TYPES, ...DOCUMENT_MIME_TYPES, ...AUDIO_MIME_TYPES, ...VIDEO_MIME_TYPES], serverOnly: false },
  certificate_asset: { mimeTypes: ["application/pdf", "image/png"], serverOnly: true },
};

export const SMARTLINGO_REFERRAL_MEDIA_POLICIES = {
  image: IMAGE_MIME_TYPES,
  video: VIDEO_MIME_TYPES,
} as const;

export type MediaFileInput = {
  size: number;
  type: string;
  arrayBuffer(): Promise<ArrayBuffer>;
};

export type ValidatedMediaUpload = {
  bytes: Uint8Array;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
};

export class SmartLingoMediaError extends Error {
  constructor(public readonly code: "MEDIA_SIZE_INVALID" | "MEDIA_TYPE_INVALID" | "MEDIA_CONTENT_INVALID" | "MEDIA_SERVER_ONLY" | "MEDIA_SCOPE_INVALID") {
    super(code);
    this.name = "SmartLingoMediaError";
  }
}

const SAFE_SCOPE_ID = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/;

const SMARTLINGO_MEDIA_SCOPE_TYPES: Readonly<Record<SmartLingoMediaKind, readonly string[]>> = {
  avatar: ["user"],
  course_cover: ["language_class"],
  voice_practice: ["user"],
  courseware: ["language_class"],
  assignment_attachment: ["language_class"],
  chat_attachment: ["message_thread"],
  certificate_asset: ["user"],
};

export function validateSmartLingoMediaScope(input: {
  kind: SmartLingoMediaKind;
  ownerUserId: string;
  scopeType: string;
  scopeId: string;
}) {
  const scopeTypes = SMARTLINGO_MEDIA_SCOPE_TYPES[input.kind];
  const ownerScoped = input.kind === "avatar" || input.kind === "voice_practice";
  if (
    !scopeTypes.includes(input.scopeType)
    || !SAFE_SCOPE_ID.test(input.scopeId)
    || !SAFE_SCOPE_ID.test(input.ownerUserId)
    || (ownerScoped && input.scopeId !== input.ownerUserId)
  ) {
    throw new SmartLingoMediaError("MEDIA_SCOPE_INVALID");
  }
}

const ascii = (bytes: Uint8Array, start: number, length: number) =>
  String.fromCharCode(...bytes.slice(start, start + length));

const startsWithBytes = (bytes: Uint8Array, expected: readonly number[]) =>
  bytes.length >= expected.length && expected.every((value, index) => bytes[index] === value);

const endsWithBytes = (bytes: Uint8Array, expected: readonly number[]) => {
  const start = bytes.length - expected.length;
  return start >= 0 && expected.every((value, index) => bytes[start + index] === value);
};

function readUint32LittleEndian(bytes: Uint8Array, offset: number) {
  if (offset + 4 > bytes.length) return -1;
  return (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0;
}

function readUint32BigEndian(bytes: Uint8Array, offset: number) {
  if (offset + 4 > bytes.length) return -1;
  return ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0;
}

function looksLikeActiveMarkup(bytes: Uint8Array) {
  const sample = new TextDecoder("utf-8", { fatal: false })
    .decode(bytes.slice(0, 4096))
    .replace(/^\uFEFF/, "")
    .trimStart();
  return /^(?:<!doctype\s+html\b|<html\b|<svg\b|<\?xml[\s\S]{0,1024}<svg\b)/i.test(sample);
}

function isUtf8PlainText(bytes: Uint8Array) {
  if (bytes.includes(0) || looksLikeActiveMarkup(bytes)) return false;
  try {
    const value = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return !Array.from(value).some((character) => {
      const code = character.charCodeAt(0);
      return code < 32 && code !== 9 && code !== 10 && code !== 13;
    });
  } catch {
    return false;
  }
}

function isJpeg(bytes: Uint8Array) {
  return bytes.length >= 4
    && startsWithBytes(bytes, [0xff, 0xd8, 0xff])
    && endsWithBytes(bytes, [0xff, 0xd9]);
}

function isPng(bytes: Uint8Array) {
  return bytes.length >= 45
    && startsWithBytes(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    && ascii(bytes, 12, 4) === "IHDR"
    && endsWithBytes(bytes, [0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82]);
}

function isWebp(bytes: Uint8Array) {
  return bytes.length >= 16
    && ascii(bytes, 0, 4) === "RIFF"
    && ascii(bytes, 8, 4) === "WEBP"
    && readUint32LittleEndian(bytes, 4) + 8 === bytes.length;
}

function isPdf(bytes: Uint8Array) {
  if (bytes.length < 9 || ascii(bytes, 0, 5) !== "%PDF-") return false;
  return /%%EOF[\t\n\f\r ]*$/.test(ascii(bytes, Math.max(0, bytes.length - 1024), Math.min(1024, bytes.length)));
}

function hasMpegFrame(bytes: Uint8Array, start: number) {
  const end = Math.min(bytes.length - 1, start + 4096);
  for (let index = start; index < end; index += 1) {
    if (bytes[index] === 0xff && (bytes[index + 1] & 0xe0) === 0xe0) return true;
  }
  return false;
}

function isMpegAudio(bytes: Uint8Array) {
  if (ascii(bytes, 0, 3) !== "ID3") return hasMpegFrame(bytes, 0);
  if (bytes.length < 10 || bytes.slice(6, 10).some((value) => value > 0x7f)) return false;
  const tagSize = (bytes[6] << 21) | (bytes[7] << 14) | (bytes[8] << 7) | bytes[9];
  return hasMpegFrame(bytes, 10 + tagSize);
}

function isIsoBaseMedia(bytes: Uint8Array) {
  const firstSize = readUint32BigEndian(bytes, 0);
  if (bytes.length < 24 || ascii(bytes, 4, 4) !== "ftyp" || firstSize < 16 || firstSize > bytes.length) return false;
  const sample = ascii(bytes, 0, Math.min(bytes.length, 64 * 1024));
  return sample.includes("moov") || sample.includes("mdat");
}

function isOgg(bytes: Uint8Array) {
  return bytes.length >= 27 && ascii(bytes, 0, 4) === "OggS" && bytes[4] === 0;
}

function isWav(bytes: Uint8Array) {
  return bytes.length >= 44
    && ascii(bytes, 0, 4) === "RIFF"
    && ascii(bytes, 8, 4) === "WAVE"
    && readUint32LittleEndian(bytes, 4) + 8 === bytes.length;
}

function isWebm(bytes: Uint8Array) {
  return bytes.length >= 16
    && startsWithBytes(bytes, [0x1a, 0x45, 0xdf, 0xa3])
    && ascii(bytes, 0, Math.min(bytes.length, 4096)).includes("webm");
}

export function mediaBytesMatchMime(bytes: Uint8Array, mimeType: string) {
  if (!bytes.length || looksLikeActiveMarkup(bytes)) return false;
  switch (mimeType) {
    case "image/jpeg": return isJpeg(bytes);
    case "image/png": return isPng(bytes);
    case "image/webp": return isWebp(bytes);
    case "application/pdf": return isPdf(bytes);
    case "text/plain": return isUtf8PlainText(bytes);
    case "audio/mpeg": return isMpegAudio(bytes);
    case "audio/mp4":
    case "video/mp4": return isIsoBaseMedia(bytes);
    case "audio/ogg": return isOgg(bytes);
    case "audio/wav": return isWav(bytes);
    case "audio/webm":
    case "video/webm": return isWebm(bytes);
    default: return false;
  }
}

async function sha256Hex(bytes: Uint8Array) {
  const digest = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function validateAgainst(file: MediaFileInput, mimeTypes: readonly string[]) {
  if (!Number.isSafeInteger(file.size) || file.size <= 0 || file.size > SMARTLINGO_BROWSER_MEDIA_MAX_BYTES) {
    throw new SmartLingoMediaError("MEDIA_SIZE_INVALID");
  }
  const mimeType = file.type.trim().toLowerCase();
  if (!mimeTypes.includes(mimeType)) throw new SmartLingoMediaError("MEDIA_TYPE_INVALID");
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.byteLength !== file.size || !mediaBytesMatchMime(bytes, mimeType)) {
    throw new SmartLingoMediaError("MEDIA_CONTENT_INVALID");
  }
  return { bytes, mimeType, sizeBytes: bytes.byteLength, sha256: await sha256Hex(bytes) };
}

export async function validateSmartLingoMedia(
  file: MediaFileInput,
  kind: SmartLingoMediaKind,
  options: { serverInitiated?: boolean } = {},
): Promise<ValidatedMediaUpload> {
  const policy = SMARTLINGO_MEDIA_POLICIES[kind];
  if (policy.serverOnly && !options.serverInitiated) throw new SmartLingoMediaError("MEDIA_SERVER_ONLY");
  return validateAgainst(file, policy.mimeTypes);
}

export async function validateReferralMedia(file: MediaFileInput, kind: "image" | "video") {
  return validateAgainst(file, SMARTLINGO_REFERRAL_MEDIA_POLICIES[kind]);
}

const SAFE_ASSET_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function createSmartLingoMediaObjectKey(
  kind: SmartLingoMediaKind | "referral_media",
  assetId = crypto.randomUUID(),
) {
  if (!SAFE_ASSET_ID.test(assetId)) throw new Error("Unsafe media asset identifier");
  return `media/${kind}/${assetId}`;
}

export function sanitizeMediaFileName(value: string, fallback = "media") {
  const cleaned = value
    .normalize("NFKC")
    .replace(/[^a-zA-Z0-9._ -]/g, "_")
    .replace(/\s+/g, " ")
    .replace(/^\.+/, "")
    .trim()
    .slice(-100);
  return cleaned || fallback.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-100) || "media";
}

export function privateMediaResponseHeaders(input: { mimeType: string; sizeBytes: number; name: string; disposition?: "inline" | "attachment" }) {
  const disposition = input.disposition || "inline";
  const headers: Record<string, string> = {
    "cache-control": "private, max-age=300",
    "content-disposition": `${disposition}; filename="${sanitizeMediaFileName(input.name).replace(/["\\]/g, "_")}"`,
    "content-length": String(input.sizeBytes),
    "content-type": input.mimeType,
    "cross-origin-resource-policy": "same-origin",
    "x-content-type-options": "nosniff",
  };
  if (DOCUMENT_MIME_TYPES.includes(input.mimeType as (typeof DOCUMENT_MIME_TYPES)[number])) headers["content-security-policy"] = "sandbox; default-src 'none'";
  return headers;
}

type MediaStatement = {
  bind(...values: unknown[]): MediaStatement;
  run(): Promise<{ success: boolean }>;
};

export type SmartLingoMediaDatabase = {
  prepare(query: string): MediaStatement;
};

export type SmartLingoMediaBucket = {
  put(
    key: string,
    value: ArrayBuffer | ArrayBufferView,
    options?: { httpMetadata?: { contentType?: string }; customMetadata?: Record<string, string> },
  ): Promise<{ etag?: string } | null>;
  delete(key: string): Promise<void>;
};

async function runChecked(statement: MediaStatement) {
  const result = await statement.run();
  if (!result.success) throw new Error("D1 media metadata write failed");
}

async function markFailedAndDiscard(
  database: SmartLingoMediaDatabase,
  bucket: SmartLingoMediaBucket,
  id: string,
  objectKey: string,
  now: number,
) {
  await database.prepare(
    "UPDATE smartlingo_media_assets SET status = 'failed', updated_at = ? WHERE id = ? AND status != 'tombstone'",
  ).bind(now, id).run().catch(() => undefined);
  await bucket.delete(objectKey).catch(() => undefined);
}

export async function storeSmartLingoMedia(input: {
  database: SmartLingoMediaDatabase;
  bucket: SmartLingoMediaBucket;
  ownerUserId: string;
  kind: SmartLingoMediaKind;
  scopeType: string;
  scopeId: string;
  file: MediaFileInput;
  serverInitiated?: boolean;
  now?: number;
}) {
  validateSmartLingoMediaScope(input);
  const validated = await validateSmartLingoMedia(input.file, input.kind, { serverInitiated: input.serverInitiated });
  const id = crypto.randomUUID();
  const objectKey = createSmartLingoMediaObjectKey(input.kind, id);
  const now = input.now ?? Math.floor(Date.now() / 1000);
  await runChecked(input.database.prepare(
    `INSERT INTO smartlingo_media_assets
      (id, owner_user_id, kind, scope_type, scope_id, object_key, mime_type, size_bytes, sha256, etag, visibility, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 'private', 'uploading', ?, ?)`,
  ).bind(
    id,
    input.ownerUserId,
    input.kind,
    input.scopeType,
    input.scopeId,
    objectKey,
    validated.mimeType,
    validated.sizeBytes,
    validated.sha256,
    now,
    now,
  ));

  try {
    const stored = await input.bucket.put(objectKey, validated.bytes, {
      httpMetadata: { contentType: validated.mimeType },
      customMetadata: { assetId: id, kind: input.kind, sha256: validated.sha256 },
    });
    await runChecked(input.database.prepare(
      "UPDATE smartlingo_media_assets SET etag = ?, status = 'ready', updated_at = ? WHERE id = ? AND status = 'uploading'",
    ).bind(stored?.etag ?? null, now, id));
    return { id, objectKey, etag: stored?.etag ?? null, validated };
  } catch (error) {
    await markFailedAndDiscard(input.database, input.bucket, id, objectKey, now);
    throw error;
  }
}

export async function tombstoneSmartLingoMedia(input: {
  database: SmartLingoMediaDatabase;
  bucket: SmartLingoMediaBucket;
  objectKey: string;
  assetId?: string;
  now?: number;
}) {
  const now = input.now ?? Math.floor(Date.now() / 1000);
  const selector = input.assetId ? "id = ?" : "object_key = ?";
  await runChecked(input.database.prepare(
    `UPDATE smartlingo_media_assets SET status = 'tombstone', deleted_at = ?, updated_at = ? WHERE ${selector}`,
  ).bind(now, now, input.assetId ?? input.objectKey));
  await input.bucket.delete(input.objectKey);
}
