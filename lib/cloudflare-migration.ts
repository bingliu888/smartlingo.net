const EXPORT_FORMAT = "smartlingo.net/cloudflare-migration";
const EXPORT_VERSION = 1;
const MAX_LIMIT = 500;
const MAX_OBJECT_CHUNK = 4 * 1024 * 1024;
const INTERNAL_TABLE_PREFIXES = ["sqlite_", "_cf_", "__new_"];
const INTERNAL_TABLES = new Set([
  "d1_migrations",
  "__drizzle_migrations",
  "__appgarden_migrations",
  "__smartlingo_core_integrity_guard",
]);

type MigrationBindings = {
  DB?: D1Database;
  BUCKET?: R2Bucket;
};

function bindings(): MigrationBindings {
  const value = globalThis as unknown as {
    __SMARTLINGO_DB__?: D1Database;
    __SMARTLINGO_BUCKET__?: R2Bucket;
  };
  return { DB: value.__SMARTLINGO_DB__, BUCKET: value.__SMARTLINGO_BUCKET__ };
}

function secureEqual(left: string, right: string) {
  const encoder = new TextEncoder();
  const a = encoder.encode(left);
  const b = encoder.encode(right);
  let difference = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    difference |= (a[index] ?? 0) ^ (b[index] ?? 0);
  }
  return difference === 0;
}

function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "cache-control": "private, no-store, max-age=0, must-revalidate",
      "content-security-policy": "default-src 'none'; frame-ancestors 'none'",
      "x-content-type-options": "nosniff",
    },
  });
}

function authorized(request: Request) {
  const expected = process.env.MIGRATION_EXPORT_SECRET?.trim() ?? "";
  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ?? "";
  return expected.length >= 32 && provided.length >= 32 && secureEqual(expected, provided);
}

function isBusinessTable(name: string) {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(name)
    && !INTERNAL_TABLES.has(name)
    && !INTERNAL_TABLE_PREFIXES.some((prefix) => name.startsWith(prefix));
}

async function tableNames(db: D1Database) {
  const result = await db.prepare(
    "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
  ).all<{ name: string }>();
  return (result.results ?? []).map((row) => row.name).filter(isBusinessTable);
}

function safeInteger(value: string | null, fallback: number, maximum = Number.MAX_SAFE_INTEGER) {
  if (value === null || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0 || parsed > maximum) throw new Error("Invalid integer");
  return parsed;
}

async function inventory(db: D1Database, bucket: R2Bucket) {
  const tables = await tableNames(db);
  const counts: Array<{ name: string; rows: number }> = [];
  let totalRows = 0;
  for (const name of tables) {
    const row = await db.prepare(`SELECT COUNT(*) AS count FROM "${name}"`).first<{ count: number | string }>();
    const count = Number(row?.count ?? 0);
    if (!Number.isSafeInteger(count) || count < 0) throw new Error("Invalid table count");
    counts.push({ name, rows: count });
    totalRows += count;
  }
  let cursor: string | undefined;
  let totalObjects = 0;
  let totalBytes = 0;
  do {
    const page = await bucket.list({ cursor, limit: 1000 });
    for (const object of page.objects) {
      totalObjects += 1;
      totalBytes += object.size;
    }
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return { tables: counts, totalRows, r2: { totalObjects, totalBytes } };
}

async function d1Page(db: D1Database, url: URL) {
  const table = url.searchParams.get("table") ?? "";
  if (!isBusinessTable(table) || !(await tableNames(db)).includes(table)) {
    return json({ error: "Unknown migration table" }, 400);
  }
  const after = safeInteger(url.searchParams.get("after"), 0);
  const limit = safeInteger(url.searchParams.get("limit"), 250, MAX_LIMIT);
  const result = await db.prepare(
    `SELECT rowid AS __migration_rowid__, * FROM "${table}" WHERE rowid > ? ORDER BY rowid LIMIT ?`,
  ).bind(after, limit).all<Record<string, unknown>>();
  const rows = result.results ?? [];
  const nextAfter = rows.length === limit ? Number(rows.at(-1)?.__migration_rowid__) : null;
  return json({ format: EXPORT_FORMAT, version: EXPORT_VERSION, mode: "d1", table, rows, nextAfter });
}

async function r2List(bucket: R2Bucket, url: URL) {
  const cursor = url.searchParams.get("cursor") || undefined;
  if (cursor && (cursor.length > 4096 || /[\u0000-\u001f\u007f]/.test(cursor))) {
    return json({ error: "Invalid R2 cursor" }, 400);
  }
  const page = await bucket.list({ cursor, limit: 250, include: ["httpMetadata", "customMetadata"] });
  return json({
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    mode: "r2-list",
    objects: page.objects.map((object) => ({
      key: object.key,
      size: object.size,
      etag: object.etag,
      uploaded: object.uploaded.toISOString(),
      httpMetadata: object.httpMetadata ?? null,
      customMetadata: object.customMetadata ?? null,
    })),
    nextCursor: page.truncated ? page.cursor : null,
  });
}

async function r2Object(bucket: R2Bucket, url: URL) {
  const key = url.searchParams.get("key") ?? "";
  if (!key || key.length > 1024 || /[\u0000-\u001f\u007f]/.test(key)) {
    return json({ error: "Invalid R2 key" }, 400);
  }
  const offset = safeInteger(url.searchParams.get("offset"), 0);
  const length = safeInteger(url.searchParams.get("length"), MAX_OBJECT_CHUNK, MAX_OBJECT_CHUNK);
  const object = await bucket.get(key, { range: { offset, length } });
  if (!object) return json({ error: "R2 object not found" }, 404);
  const bytes = new Uint8Array(await object.arrayBuffer());
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return json({
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    mode: "r2-object",
    key,
    offset,
    bytes: bytes.length,
    data: btoa(binary),
  });
}

export async function cloudflareMigrationExport(request: Request) {
  if (!authorized(request)) return json({ error: "Not found" }, 404);
  const { DB, BUCKET } = bindings();
  if (!DB || !BUCKET) return json({ error: "Migration bindings unavailable" }, 503);
  try {
    const url = new URL(request.url);
    const mode = url.searchParams.get("mode") ?? "inventory";
    if (mode === "inventory") {
      return json({ format: EXPORT_FORMAT, version: EXPORT_VERSION, mode, ...(await inventory(DB, BUCKET)) });
    }
    if (mode === "d1") return d1Page(DB, url);
    if (mode === "r2-list") return r2List(BUCKET, url);
    if (mode === "r2-object") return r2Object(BUCKET, url);
    return json({ error: "Unknown migration mode" }, 400);
  } catch {
    return json({ error: "Migration export failed" }, 500);
  }
}
