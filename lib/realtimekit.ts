import {
  readBoundedExternalResponseText,
  REALTIME_PROVIDER_REQUEST_TIMEOUT_MS,
  withExternalRequestTimeout,
} from "./external-request-timeout";

export type RealtimeKitConfig = {
  apiToken: string;
  accountId: string;
  appId: string;
  voicePreset: string;
  videoPreset: string;
};

type RealtimeKitEnvelope<T> = {
  success?: boolean;
  data?: T;
  result?: T;
  errors?: Array<{ code?: number; message?: string }>;
};

export class RealtimeKitRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: number,
  ) {
    super(message);
    this.name = "RealtimeKitRequestError";
  }
}

async function realtimeKitRequest<T>(config: RealtimeKitConfig, path: string, init: RequestInit) {
  const account = encodeURIComponent(config.accountId);
  const app = encodeURIComponent(config.appId);
  const compactApp = encodeURIComponent(config.appId.replaceAll("-", ""));
  const request = (url: string, requestInit: RequestInit = init) => withExternalRequestTimeout((signal) => fetch(url, {
    ...requestInit,
    signal,
    headers: {
      authorization: `Bearer ${config.apiToken}`,
      "content-type": "application/json",
      ...(requestInit.headers || {}),
    },
  }), REALTIME_PROVIDER_REQUEST_TIMEOUT_MS);
  const payloadFor = async <Value>(response: Response) => {
    const raw = await readBoundedExternalResponseText(response, 512 * 1024);
    if (raw.truncated) return null;
    try { return JSON.parse(raw.text) as RealtimeKitEnvelope<Value>; } catch { return null; }
  };
  const bases = [
    `https://api.cloudflare.com/client/v4/accounts/${account}/realtime/kit/${app}`,
    `https://api.cloudflare.com/client/v4/accounts/${account}/realtime/kit/apps/${app}`,
    `https://api.cloudflare.com/client/v4/accounts/${account}/realtime/kit/${compactApp}`,
    `https://api.cloudflare.com/client/v4/accounts/${account}/realtime/kit/apps/${compactApp}`,
  ];
  let response = await request(`${bases[0]}${path}`);
  // RealtimeKit is currently a beta product. Some dashboard-created Apps are
  // exposed through the namespaced Apps route while the documented route is
  // still propagating. Keep the documented route primary and retry only a 404.
  for (const base of bases.slice(1)) {
    if (response.status !== 404) break;
    await response.body?.cancel().catch(() => undefined);
    response = await request(`${base}${path}`);
  }
  let discovery = "";
  if (response.status === 404) {
    const appListResponse = await request(
      `https://api.cloudflare.com/client/v4/accounts/${account}/realtime/kit/apps`,
      { headers: { authorization: `Bearer ${config.apiToken}`, "content-type": "application/json" } },
    );
    const appListPayload = await payloadFor<Array<{ id?: string }>>(appListResponse);
    const apps = appListPayload?.data ?? appListPayload?.result;
    const visible = Array.isArray(apps);
    const matched = visible && apps.some(candidate => candidate.id === config.appId);
    discovery = ` app-list=${appListResponse.status}/${visible ? apps.length : "invalid"} match=${matched}`;
  }
  const payload = await payloadFor<T>(response);
  const data = payload?.data ?? payload?.result;
  if (!response.ok || !payload?.success || !data) {
    const providerError = payload?.errors?.[0];
    throw new RealtimeKitRequestError(
      `${providerError?.message || `RealtimeKit request failed (${response.status})`}${discovery}`,
      response.status,
      providerError?.code,
    );
  }
  return data;
}

export async function createRealtimeMeeting(config: RealtimeKitConfig): Promise<{ id: string }> {
  return realtimeKitRequest<{ id: string }>(config, "/meetings", {
    method: "POST",
    body: JSON.stringify({ title: "SmartLingo member call" }),
  });
}

export async function addRealtimeParticipant(
  config: RealtimeKitConfig,
  input: { meetingId: string; userId: string; displayName: string; mode: "audio" | "video" },
) {
  return realtimeKitRequest<{ id: string; token: string }>(
    config,
    `/meetings/${encodeURIComponent(input.meetingId)}/participants`,
    {
      method: "POST",
      body: JSON.stringify({
        name: input.displayName.slice(0, 80) || "SmartLingo member",
        // Every standard chat call starts with the camera off, but uses the
        // video-capable preset so an admitted participant may enable video
        // later without leaving the room. The app enforces the four-camera cap.
        preset_name: config.videoPreset,
        custom_participant_id: `${input.userId}:${crypto.randomUUID()}`,
      }),
    },
  );
}

export async function deactivateRealtimeMeeting(config: RealtimeKitConfig, meetingId: string) {
  return realtimeKitRequest<{ id: string }>(config, `/meetings/${encodeURIComponent(meetingId)}`, {
    method: "PATCH",
    body: JSON.stringify({ status: "INACTIVE" }),
  });
}
