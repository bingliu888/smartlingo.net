import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const read = path => readFile(new URL(path, import.meta.url), "utf8");

async function loadMediaModule() {
  const source = await read("../lib/smartlingo-media.ts");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(output).toString("base64")}`);
}

function mediaFile(bytes, type, reportedSize = bytes.byteLength) {
  return {
    size: reportedSize,
    type,
    async arrayBuffer() {
      return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    },
  };
}

const encoder = new TextEncoder();

test("seven media purposes expose exact least-privilege MIME policies", async () => {
  const media = await loadMediaModule();
  assert.deepEqual(Object.keys(media.SMARTLINGO_MEDIA_POLICIES), [
    "avatar",
    "course_cover",
    "voice_practice",
    "courseware",
    "assignment_attachment",
    "chat_attachment",
    "certificate_asset",
  ]);
  assert.deepEqual(media.SMARTLINGO_MEDIA_POLICIES.avatar.mimeTypes, [
    "image/jpeg",
    "image/png",
    "image/webp",
  ]);
  assert.deepEqual(media.SMARTLINGO_MEDIA_POLICIES.certificate_asset.mimeTypes, [
    "application/pdf",
    "image/png",
  ]);
  assert.equal(media.SMARTLINGO_MEDIA_POLICIES.certificate_asset.serverOnly, true);
  assert.deepEqual(media.SMARTLINGO_MEDIA_POLICIES.voice_practice.mimeTypes, [
    "audio/mpeg",
    "audio/mp4",
    "audio/ogg",
    "audio/wav",
    "audio/webm",
  ]);
  assert.equal(media.SMARTLINGO_BROWSER_MEDIA_MAX_BYTES, 900 * 1024);
});

test("media scopes bind private voice to its owner and covers to language classes", async () => {
  const media = await loadMediaModule();
  const ownerUserId = "123e4567-e89b-42d3-a456-426614174000";
  assert.doesNotThrow(() => media.validateSmartLingoMediaScope({
    kind: "voice_practice",
    ownerUserId,
    scopeType: "user",
    scopeId: ownerUserId,
  }));
  assert.doesNotThrow(() => media.validateSmartLingoMediaScope({
    kind: "course_cover",
    ownerUserId,
    scopeType: "language_class",
    scopeId: "123e4567-e89b-42d3-a456-426614174001",
  }));
  assert.throws(() => media.validateSmartLingoMediaScope({
    kind: "voice_practice",
    ownerUserId,
    scopeType: "user",
    scopeId: "123e4567-e89b-42d3-a456-426614174002",
  }), error => error.code === "MEDIA_SCOPE_INVALID");
  assert.throws(() => media.validateSmartLingoMediaScope({
    kind: "course_cover",
    ownerUserId,
    scopeType: "message_thread",
    scopeId: "123e4567-e89b-42d3-a456-426614174003",
  }), error => error.code === "MEDIA_SCOPE_INVALID");
});

test("magic-byte validation rejects markup, unsupported types and MIME spoofing", async () => {
  const media = await loadMediaModule();
  const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0xff, 0xd9]);
  const html = encoder.encode("<!doctype html><html><body>not an image</body></html>");
  const svg = encoder.encode("<svg xmlns='http://www.w3.org/2000/svg'></svg>");

  const valid = await media.validateSmartLingoMedia(mediaFile(jpeg, "image/jpeg"), "avatar");
  assert.equal(valid.mimeType, "image/jpeg");
  assert.match(valid.sha256, /^[0-9a-f]{64}$/);
  await assert.rejects(
    media.validateSmartLingoMedia(mediaFile(html, "image/jpeg"), "avatar"),
    error => error.code === "MEDIA_CONTENT_INVALID",
  );
  await assert.rejects(
    media.validateSmartLingoMedia(mediaFile(svg, "text/plain"), "chat_attachment"),
    error => error.code === "MEDIA_CONTENT_INVALID",
  );
  await assert.rejects(
    media.validateSmartLingoMedia(mediaFile(jpeg, "image/gif"), "avatar"),
    error => error.code === "MEDIA_TYPE_INVALID",
  );
  await assert.rejects(
    media.validateSmartLingoMedia(mediaFile(jpeg, "image/jpeg", 900 * 1024 + 1), "avatar"),
    error => error.code === "MEDIA_SIZE_INVALID",
  );
});

test("certificate uploads are server-only and object keys cannot contain user input", async () => {
  const media = await loadMediaModule();
  const pdf = encoder.encode("%PDF-1.7\n%%EOF\n");
  await assert.rejects(
    media.validateSmartLingoMedia(mediaFile(pdf, "application/pdf"), "certificate_asset"),
    error => error.code === "MEDIA_SERVER_ONLY",
  );
  const validated = await media.validateSmartLingoMedia(
    mediaFile(pdf, "application/pdf"),
    "certificate_asset",
    { serverInitiated: true },
  );
  assert.equal(validated.mimeType, "application/pdf");

  const id = "123e4567-e89b-42d3-a456-426614174000";
  assert.equal(media.createSmartLingoMediaObjectKey("avatar", id), `media/avatar/${id}`);
  assert.throws(
    () => media.createSmartLingoMediaObjectKey("avatar", "../../user/avatar"),
    /Unsafe media asset identifier/,
  );
  assert.equal(media.sanitizeMediaFileName("../../evil\r\nname.html"), "_.._evil__name.html");
});

test("media response headers prevent sniffing and sandbox document downloads", async () => {
  const media = await loadMediaModule();
  const pdfHeaders = media.privateMediaResponseHeaders({
    mimeType: "application/pdf",
    sizeBytes: 42,
    name: "lesson.pdf",
  });
  assert.equal(pdfHeaders["x-content-type-options"], "nosniff");
  assert.match(pdfHeaders["content-disposition"], /^attachment;/);
  assert.equal(pdfHeaders["content-security-policy"], "sandbox; default-src 'none'");

  const imageHeaders = media.privateMediaResponseHeaders({
    mimeType: "image/png",
    sizeBytes: 42,
    name: "cover.png",
  });
  assert.match(imageHeaders["content-disposition"], /^inline;/);
  assert.equal(imageHeaders["content-security-policy"], undefined);
});

test("R2 writes are metadata-audited and deletion is retryable", async () => {
  const media = await loadMediaModule();
  const queries = [];
  const deleted = [];
  const database = {
    prepare(query) {
      const record = { query, values: [] };
      queries.push(record);
      return {
        bind(...values) { record.values = values; return this; },
        async run() { return { success: true }; },
      };
    },
  };
  const bucket = {
    async put(key, bytes, options) {
      assert.match(key, /^media\/avatar\/[0-9a-f-]{36}$/);
      assert.ok(bytes.byteLength > 0);
      assert.equal(options.httpMetadata.contentType, "image/jpeg");
      return { etag: "etag-1" };
    },
    async delete(key) { deleted.push(key); },
  };
  const ownerUserId = "123e4567-e89b-42d3-a456-426614174000";
  const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0xff, 0xd9]);
  const stored = await media.storeSmartLingoMedia({
    database,
    bucket,
    ownerUserId,
    kind: "avatar",
    scopeType: "user",
    scopeId: ownerUserId,
    file: mediaFile(jpeg, "image/jpeg"),
    now: 1_785_585_600,
  });
  assert.equal(stored.validated.sha256.length, 64);
  assert.equal(queries.length, 2);
  assert.match(queries[0].query, /status, created_at, updated_at/);
  assert.match(queries[1].query, /status = 'ready'/);
  await media.tombstoneSmartLingoMedia({
    database,
    bucket,
    assetId: stored.id,
    objectKey: stored.objectKey,
    now: 1_785_585_601,
  });
  assert.match(queries.at(-1).query, /status = 'tombstone'/);
  assert.deepEqual(deleted, [stored.objectKey]);
});

test("avatar, class cover, voice, chat and referral routes use validated private media contracts", async () => {
  const [helper, profile, chat, learning, messages, referral, liveChat] = await Promise.all([
    read("../lib/smartlingo-media.ts"),
    read("../app/api/profile/route.ts"),
    read("../app/api/message-media/route.ts"),
    read("../app/api/learning-media/route.ts"),
    read("../app/api/messages/route.ts"),
    read("../app/api/referral-media/route.ts"),
    read("../components/LiveChatRoom.tsx"),
  ]);

  assert.match(helper, /sha256, etag, visibility, status/);
  assert.match(helper, /NULL, 'private', 'uploading'/);
  assert.match(helper, /status = 'ready'/);
  assert.match(helper, /status = 'tombstone'/);
  assert.match(profile, /kind: "avatar"/);
  assert.match(profile, /tombstoneSmartLingoMedia/);
  assert.match(profile, /asset\.status = 'ready'/);
  assert.match(chat, /kind: "chat_attachment"/);
  assert.match(chat, /scopeType: "message_thread"/);
  assert.match(chat, /visibility = 'private' AND status = 'ready'/);
  assert.match(learning, /kind IN \('course_cover', 'voice_practice'\)/);
  assert.match(learning, /Class owner access required/);
  assert.match(learning, /member\.status IN \('active', 'invited', 'paused'\)/);
  assert.match(learning, /Deletion is pending; retry safely/);
  assert.match(messages, /Attachment deletion is pending; retry safely/);
  assert.match(messages, /tombstoneSmartLingoMedia/);
  assert.match(referral, /validateReferralMedia/);
  assert.match(referral, /sanitizeMediaFileName/);
  assert.doesNotMatch(referral, /startsWith\(`\$\{kind\}\//);
  assert.doesNotMatch(liveChat, /accept="(?:image|audio|video)\/\*/);
});
