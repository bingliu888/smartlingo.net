import { getDatabase } from "./auth";
import { withExternalRequestIdleTimeout } from "./external-request-timeout";
import { settleClassRecording } from "./class-recording";

type R2Bucket = {
  head(key: string): Promise<{ size: number } | null>;
  put(key: string, body: ReadableStream<Uint8Array>, options: {
    httpMetadata: { contentType: string };
    customMetadata?: Record<string, string>;
  }): Promise<unknown>;
};

function safeArtifactSource(value: string, base?: URL) {
  let url: URL;
  try { url = new URL(value, base); } catch { return null; }
  if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!host || host === "localhost" || [".localhost", ".local", ".internal", ".lan"]
    .some((suffix) => host.endsWith(suffix))) return null;
  if (host.includes(":")) return null;
  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (ipv4) {
    const parts = ipv4.slice(1).map(Number);
    if (parts.some((part) => part > 255)) return null;
    const [a, b] = parts;
    if (a === 0 || a === 10 || a === 127 || a >= 224
      || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127)
      || (a === 198 && (b === 18 || b === 19))) return null;
  }
  return url;
}

async function fetchArtifactSource(value: string, signal: AbortSignal, touch: () => void) {
  const initial = safeArtifactSource(value);
  if (!initial) throw new Error("ARTIFACT_URL_REJECTED");
  let url = initial;
  for (let redirects = 0; redirects <= 3; redirects += 1) {
    const response = await fetch(url, { redirect: "manual", signal });
    touch();
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      const next = location ? safeArtifactSource(location, url) : null;
      await response.body?.cancel().catch(() => undefined);
      if (!next || redirects === 3) throw new Error("ARTIFACT_REDIRECT_REJECTED");
      url = next;
      continue;
    }
    return response;
  }
  throw new Error("ARTIFACT_REDIRECT_REJECTED");
}

export async function archiveClassRecording(input: {
  bucket: R2Bucket | undefined;
  providerRecordingId: string;
  sourceUrl: string;
  recordingSeconds: number;
}) {
  if (!input.bucket) throw new Error("ARTIFACT_STORAGE_UNAVAILABLE");
  const claim = await getDatabase().prepare(`SELECT claim.room_id AS roomId,
    claim.artifact_id AS artifactId,claim.storage_reservation_id AS storageReservationId,
    artifact.status,quota.reserved_bytes AS reservedBytes
    FROM class_recording_claims claim
    JOIN class_recording_artifacts artifact ON artifact.id=claim.artifact_id
    JOIN member_storage_quota_reservations quota ON quota.id=claim.storage_reservation_id
    WHERE claim.provider_recording_id=? LIMIT 1`)
    .bind(input.providerRecordingId)
    .first<{ roomId: string; artifactId: string; storageReservationId: string;
      status: string; reservedBytes: number }>();
  if (!claim) throw new Error("RECORDING_CLAIM_NOT_FOUND");
  if (claim.status === "ready") return;
  if (claim.status === "deleted") throw new Error("RECORDING_DELETED");
  const maxBytes = Number(claim.reservedBytes || 0);
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1)
    throw new Error("RECORDING_STORAGE_RESERVATION_INVALID");
  const objectKey = `classes/${claim.roomId}/recordings/${claim.artifactId}.m4a`;
  const existing = await input.bucket.head(objectKey);
  if (existing?.size) {
    if (existing.size > maxBytes) throw new Error("ARTIFACT_TOO_LARGE");
    await settleClassRecording({
      providerRecordingId: input.providerRecordingId,
      artifactId: claim.artifactId,
      recordingSeconds: input.recordingSeconds,
      objectKey,
      objectBytes: existing.size,
    });
    return;
  }

  let received = 0;
  await withExternalRequestIdleTimeout(async (signal, touch) => {
    const response = await fetchArtifactSource(input.sourceUrl, signal, touch);
    if (!response.ok || !response.body) throw new Error(`ARTIFACT_FETCH_${response.status}`);
    const declared = Number(response.headers.get("content-length") || 0);
    if (Number.isFinite(declared) && declared > maxBytes)
      throw new Error("ARTIFACT_TOO_LARGE");
    const guarded = response.body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        touch();
        received += chunk.byteLength;
        if (received > maxBytes) {
          controller.error(new Error("ARTIFACT_TOO_LARGE"));
          return;
        }
        controller.enqueue(chunk);
      },
    }));
    await input.bucket!.put(objectKey, guarded, {
      httpMetadata: { contentType: response.headers.get("content-type") || "audio/mp4" },
      customMetadata: { roomId: claim.roomId, artifactId: claim.artifactId },
    });
  });
  if (received < 1) throw new Error("ARTIFACT_EMPTY");
  const committed = await input.bucket.head(objectKey);
  const exactBytes = Number(committed?.size || received);
  if (exactBytes < 1 || exactBytes > maxBytes) throw new Error("ARTIFACT_SIZE_INVALID");
  await settleClassRecording({
    providerRecordingId: input.providerRecordingId,
    artifactId: claim.artifactId,
    recordingSeconds: input.recordingSeconds,
    objectKey,
    objectBytes: exactBytes,
  });
}
