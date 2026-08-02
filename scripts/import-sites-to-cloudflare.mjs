#!/usr/bin/env node

import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const SOURCE_URL = (process.env.SITES_MIGRATION_SOURCE_URL || "https://smartlingo.net").replace(/\/$/, "");
const SECRET = process.env.MIGRATION_EXPORT_SECRET || "";
const CONFIG = resolve(process.env.CLOUDFLARE_CONFIG || "wrangler.cloudflare.jsonc");
const EXPECTED_DATABASE = "smartlingo-net-cutover-20260801-d1";
const EXPECTED_BUCKET = "smartlingo-net-cutover-20260801-media";
const FORMAT = "smartlingo.net/cloudflare-migration";
const NODE = process.execPath;
const WRANGLER = resolve("node_modules/wrangler/bin/wrangler.js");

function fail(message) {
  throw new Error(message);
}

async function request(path) {
  const response = await fetch(`${SOURCE_URL}${path}`, {
    headers: { authorization: `Bearer ${SECRET}` },
    redirect: "error",
  });
  if (!response.ok) fail(`Source export failed with HTTP ${response.status}`);
  const body = await response.json();
  if (body.format !== FORMAT || body.version !== 1) fail("Unexpected migration export format");
  return body;
}

function run(arguments_, input) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(NODE, [WRANGLER, ...arguments_], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        WRANGLER_WRITE_LOGS: "false",
        WRANGLER_LOG_PATH: join(tmpdir(), "smartlingo-wrangler-migration.log"),
      },
      stdio: [input === undefined ? "ignore" : "pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    if (input !== undefined) child.stdin.end(input);
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolvePromise(stdout);
      else reject(new Error((stderr || stdout || `Wrangler exited ${code}`).slice(-4000)));
    });
  });
}

function quoteIdentifier(value) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) fail("Unsafe SQL identifier");
  return `"${value}"`;
}

function sqlValue(value) {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) fail("Non-finite migration number");
    return String(value);
  }
  if (typeof value === "boolean") return value ? "1" : "0";
  if (Array.isArray(value) && value.every((item) => Number.isInteger(item) && item >= 0 && item <= 255)) {
    return `X'${Buffer.from(value).toString("hex")}'`;
  }
  if (typeof value !== "string") fail("Unsupported migration value");
  return `'${value.replaceAll("'", "''")}'`;
}

function rowsToSql(table, rows) {
  return rows.map((sourceRow) => {
    const row = { ...sourceRow };
    delete row.__migration_rowid__;
    const columns = Object.keys(row);
    if (!columns.length) fail(`Empty row in ${table}`);
    return `INSERT OR REPLACE INTO ${quoteIdentifier(table)} (${columns.map(quoteIdentifier).join(",")}) VALUES (${columns.map((column) => sqlValue(row[column])).join(",")});`;
  }).join("\n");
}

function readDirectResources(configText) {
  const parsed = JSON.parse(configText);
  const database = parsed.d1_databases?.find((item) => item.binding === "DB")?.database_name;
  const bucket = parsed.r2_buckets?.find((item) => item.binding === "BUCKET")?.bucket_name;
  if (database !== EXPECTED_DATABASE || bucket !== EXPECTED_BUCKET) {
    fail("Refusing to import into unexpected Cloudflare resources");
  }
  return { database, bucket };
}

async function main() {
  if (SECRET.length < 32) fail("MIGRATION_EXPORT_SECRET is required");
  const { database, bucket } = readDirectResources(await readFile(CONFIG, "utf8"));
  const inventory = await request("/api/admin/cloudflare-migration?mode=inventory");
  const temporary = await mkdtemp(join(tmpdir(), "smartlingo-migration-"));
  try {
    // Wrangler's remote D1 import executes uploaded statements atomically at
    // the platform layer and rejects explicit SQL transaction statements.
    const sql = ["PRAGMA foreign_keys=OFF;"];
    let exportedRows = 0;
    const sourceTables = inventory.tables.filter((item) => !item.name.startsWith("__") && item.name !== "d1_migrations");
    const expectedRows = sourceTables.reduce((total, item) => total + item.rows, 0);
    for (const item of sourceTables) {
      let after = 0;
      let tableRows = 0;
      do {
        const page = await request(`/api/admin/cloudflare-migration?mode=d1&table=${encodeURIComponent(item.name)}&after=${after}&limit=500`);
        sql.push(rowsToSql(item.name, page.rows));
        tableRows += page.rows.length;
        exportedRows += page.rows.length;
        after = page.nextAfter ?? 0;
      } while (after);
      if (tableRows !== item.rows) fail(`Row count changed during export for ${item.name}`);
    }
    if (exportedRows !== expectedRows) fail("D1 export total did not match inventory");
    sql.push("PRAGMA foreign_keys=ON;");
    const sqlPath = join(temporary, "migration.sql");
    await writeFile(sqlPath, sql.filter(Boolean).join("\n"), { mode: 0o600 });
    await run(["d1", "execute", "DB", "--remote", "--config", CONFIG, "--file", sqlPath]);

    let cursor = "";
    let objectCount = 0;
    let objectBytes = 0;
    do {
      const page = await request(`/api/admin/cloudflare-migration?mode=r2-list${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`);
      for (const object of page.objects) {
        if (!object.key || object.key.length > 1024 || /[\u0000-\u001f\u007f]/.test(object.key)) fail("Unsafe R2 key");
        const chunks = [];
        let offset = 0;
        while (offset < object.size) {
          const chunk = await request(`/api/admin/cloudflare-migration?mode=r2-object&key=${encodeURIComponent(object.key)}&offset=${offset}&length=${Math.min(4 * 1024 * 1024, object.size - offset)}`);
          const bytes = Buffer.from(chunk.data, "base64");
          if (chunk.offset !== offset || chunk.bytes !== bytes.length || bytes.length === 0) fail("Invalid R2 chunk");
          chunks.push(bytes);
          offset += bytes.length;
        }
        const body = Buffer.concat(chunks);
        if (body.length !== object.size) fail(`R2 size mismatch for ${object.key}`);
        const objectPath = join(temporary, `object-${objectCount}`);
        await writeFile(objectPath, body, { mode: 0o600 });
        await run(["r2", "object", "put", `${bucket}/${object.key}`, "--remote", "--config", CONFIG, "--file", objectPath]);
        objectCount += 1;
        objectBytes += body.length;
      }
      cursor = page.nextCursor || "";
    } while (cursor);
    if (objectCount !== inventory.r2.totalObjects || objectBytes !== inventory.r2.totalBytes) fail("R2 import total did not match inventory");
    process.stdout.write(JSON.stringify({ database, bucket, rows: exportedRows, objects: objectCount, bytes: objectBytes }));
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

await main();
