import { createHash } from "node:crypto";
import { access, cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { readMigrationManifest } from "./validate-d1-migrations.mjs";

const markerName = "migration-fingerprint";

export function layoutSchemaFingerprint() {
  const migrations = readMigrationManifest();
  return createHash("sha256")
    .update(migrations.map(({ tag, hash }) => `${tag}:${hash}`).join("\n"))
    .digest("hex");
}

export async function restoreLayoutSchemaCache(cacheDirectory, state, fingerprint) {
  if (!cacheDirectory) return false;
  const cachedD1 = join(cacheDirectory, "d1");
  const targetD1 = join(state, "v3", "d1");
  try {
    const cachedFingerprint = (await readFile(join(cacheDirectory, markerName), "utf8")).trim();
    if (cachedFingerprint !== fingerprint || !(await readdir(cachedD1)).length) return false;
    await mkdir(join(state, "v3"), { recursive: true });
    await cp(cachedD1, targetD1, { recursive: true, errorOnExist: true, force: false });
    return true;
  } catch {
    await rm(targetD1, { recursive: true, force: true });
    return false;
  }
}

export async function saveLayoutSchemaCache(cacheDirectory, state, fingerprint) {
  if (!cacheDirectory) return;
  const sourceD1 = join(state, "v3", "d1");
  await access(sourceD1);
  await mkdir(cacheDirectory, { recursive: true });
  await cp(sourceD1, join(cacheDirectory, "d1"), {
    recursive: true, errorOnExist: true, force: false,
  });
  // The marker is written last: a partial copy must never be restored.
  await writeFile(join(cacheDirectory, markerName), `${fingerprint}\n`, { mode: 0o600 });
}
