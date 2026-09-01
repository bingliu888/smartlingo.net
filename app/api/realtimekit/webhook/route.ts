import { boundedRequestBody } from "@/lib/bounded-request-body";
import { getDatabase } from "@/lib/auth";
import { archiveClassRecording } from "@/lib/class-recording-artifact";
import { failClassRecording } from "@/lib/class-recording";
import { realtimeKitWebhookPublicKey } from "@/lib/realtimekit-webhook-key-cache";
import { stopProviderRecordingForTeardown } from "@/lib/live-class-realtimekit";

type Payload = {
  event?: unknown;
  recording?: Record<string, unknown>;
  meeting?: Record<string, unknown>;
};

const WEBHOOK_MAX_BODY_BYTES = 256 * 1024;
const WEBHOOK_CLAIM_SECONDS = 6 * 60 * 60;

function value(record: Record<string, unknown> | undefined, ...names: string[]) {
  for (const name of names) if (record?.[name] != null) return record[name];
  return undefined;
}

function decodeBase64(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/").replace(/\s/g, "");
  const binary = atob(normalized + "=".repeat((4 - normalized.length % 4) % 4));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function bodyId(body: ArrayBuffer) {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", body));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function verifySignature(body: ArrayBuffer, signature: string, request: Request) {
  if (!/^[A-Za-z0-9+/_=-]{64,1024}$/.test(signature)) return false;
  let decoded: Uint8Array;
  try { decoded = decodeBase64(signature); } catch { return false; }
  let key: CryptoKey;
  try { key = await realtimeKitWebhookPublicKey(request); }
  catch (error) {
    if (error instanceof Response) throw error;
    throw new Response("Webhook verification is temporarily unavailable", {
      status: 503,
      headers: { "retry-after": "30", "cache-control": "no-store" },
    });
  }
  try {
    const bytes = decoded.buffer.slice(decoded.byteOffset, decoded.byteOffset + decoded.byteLength) as ArrayBuffer;
    return crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, bytes, body);
  } catch { return false; }
}

async function complete(eventId: string) {
  const now = Math.floor(Date.now() / 1_000);
  await getDatabase().batch([
    getDatabase().prepare(`INSERT OR IGNORE INTO processed_webhooks(
      id,provider,processed_at
    ) VALUES(?,'realtimekit',?)`).bind(eventId, now),
    getDatabase().prepare("DELETE FROM webhook_processing_claims WHERE id=?").bind(eventId),
  ]);
}

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let claimed = "";
  try {
    const body = await boundedRequestBody(request, WEBHOOK_MAX_BODY_BYTES);
    if (!await verifySignature(body, request.headers.get("rtk-signature") || "", request))
      return new Response("Invalid signature", { status: 401 });
    const deliveryId = (request.headers.get("rtk-uuid") || "").trim();
    if (!/^[A-Za-z0-9_-]{8,200}$/.test(deliveryId))
      return new Response("Missing webhook delivery id", { status: 400 });
    const eventId = `rtk:${await bodyId(body)}`;
    if (await getDatabase().prepare("SELECT 1 FROM processed_webhooks WHERE id=?")
      .bind(eventId).first()) return new Response("ok");
    const now = Math.floor(Date.now() / 1_000);
    const claim = await getDatabase().prepare(`INSERT INTO webhook_processing_claims(
      id,provider,claimed_at
    ) VALUES(?,'realtimekit',?) ON CONFLICT(id) DO UPDATE SET claimed_at=excluded.claimed_at
      WHERE webhook_processing_claims.claimed_at<?`).bind(
      eventId,
      now,
      now - WEBHOOK_CLAIM_SECONDS,
    ).run();
    if (Number(claim.meta?.changes || 0) !== 1)
      return new Response("Webhook delivery is already processing", {
        status: 503,
        headers: { "retry-after": "5", "cache-control": "no-store" },
      });
    claimed = eventId;

    const payload = JSON.parse(new TextDecoder().decode(body)) as Payload;
    const event = String(payload.event || "");
    const recording = payload.recording;
    if (event !== "recording.statusUpdate") {
      await complete(eventId);
      return new Response("ok");
    }
    const providerRecordingId = String(value(recording, "id", "recordingId", "recording_id") || "");
    if (!providerRecordingId) throw new Error("RECORDING_ID_REQUIRED");
    const authorized = await getDatabase().prepare(`SELECT artifact_id AS artifactId
      FROM class_recording_claims WHERE provider_recording_id=? LIMIT 1`)
      .bind(providerRecordingId).first<{ artifactId: string }>();
    if (!authorized) {
      const timestamp = Math.floor(Date.now() / 1_000);
      await getDatabase().prepare(`INSERT INTO provider_recording_cleanup_jobs(
        provider_recording_id,room_id,attempts,next_attempt_at,requested_at,updated_at
      ) VALUES(?,NULL,0,?,?,?) ON CONFLICT(provider_recording_id)
        DO UPDATE SET next_attempt_at=MIN(next_attempt_at,excluded.next_attempt_at),updated_at=excluded.updated_at`)
        .bind(providerRecordingId, timestamp, timestamp, timestamp).run();
      await stopProviderRecordingForTeardown(providerRecordingId).catch(() => undefined);
      await complete(eventId);
      return new Response("ok");
    }
    const status = String(value(recording, "status") || "").toUpperCase();
    if (status === "ERRORED") {
      await failClassRecording(providerRecordingId);
    } else if (status === "UPLOADED") {
      const audioUrl = String(value(recording, "audioDownloadUrl", "audio_download_url") || "");
      if (!audioUrl) throw new Error("ARTIFACT_URL_MISSING");
      const seconds = Math.max(0, Math.floor(Number(value(
        recording,
        "recordingDuration",
        "recording_duration",
      ) || 0)));
      const { env } = await import("cloudflare:workers");
      await archiveClassRecording({
        bucket: env.CLASS_FILES as never,
        providerRecordingId,
        sourceUrl: audioUrl,
        recordingSeconds: seconds,
      });
    } else {
      await getDatabase().prepare(`UPDATE class_recording_artifacts SET status=?,updated_at=?
        WHERE provider_recording_id=? AND status NOT IN ('ready','deleted')`).bind(
        status === "UPLOADING" ? "processing" : "recording",
        Math.floor(Date.now() / 1_000),
        providerRecordingId,
      ).run();
    }
    await complete(eventId);
    claimed = "";
    return new Response("ok");
  } catch (error) {
    if (claimed) await getDatabase().prepare("DELETE FROM webhook_processing_claims WHERE id=?")
      .bind(claimed).run().catch(() => undefined);
    if (error instanceof Response) return error;
    console.warn("RealtimeKit webhook failed",
      error instanceof Error ? error.message.slice(0, 160) : "unknown");
    return new Response("Webhook processing failed", { status: 500 });
  }
}
