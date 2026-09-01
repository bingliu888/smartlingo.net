export const REMOTE_VIDEO_SUBSCRIPTION_WINDOW = 16;
export const LOCAL_RECORDING_MEMORY_LIMIT_BYTES = 85 * 1024 * 1024;
// RealtimeKit media events wake passive listeners without returning every
// attendee to Gold v1's three-second polling. The second read covers the
// short race where the remote track ends just before D1 retires the provider.
export const REMOTE_IDLE_MEDIA_RECONCILE_DELAYS = [750, 3_000] as const;

export type RemoteVideoWindow<T> = {
  items: T[];
  page: number;
  pageCount: number;
  total: number;
};

export function remoteVideoWindow<T>(
  items: T[],
  requestedPage: number,
  windowSize = REMOTE_VIDEO_SUBSCRIPTION_WINDOW,
): RemoteVideoWindow<T> {
  const safeWindowSize = Math.max(1, Math.floor(windowSize));
  const pageCount = Math.max(1, Math.ceil(items.length / safeWindowSize));
  const page = Math.min(
    pageCount - 1,
    Math.max(0, Math.floor(requestedPage) || 0),
  );
  const offset = page * safeWindowSize;
  return {
    items: items.slice(offset, offset + safeWindowSize),
    page,
    pageCount,
    total: items.length,
  };
}

export type ClassPollKind = "media" | "attendees" | "playlist";

export function classPollDelay(input: {
  kind: ClassPollKind;
  joined: boolean;
  moderator: boolean;
  hidden: boolean;
  failures?: number;
  jitter?: number;
}) {
  const failures = Math.max(0, Math.min(3, Math.floor(input.failures || 0)));
  const jitter = Math.max(0, Math.min(1, input.jitter ?? 0));
  if (input.hidden) return 60_000 + Math.floor(jitter * 3_000);
  const base =
    input.kind === "media"
      ? input.joined
        ? input.moderator
          ? 4_000
          : 30_000
        : 15_000
      : input.kind === "attendees"
        ? input.joined
          ? input.moderator
            ? 8_000
            : 45_000
          : 60_000
        : 30_000;
  return Math.min(60_000, base * 2 ** failures) + Math.floor(jitter * 750);
}

export function livestreamClientPollDelay(
  status: string,
  hidden: boolean,
  failures = 0,
  jitter = 0,
) {
  if (hidden) return 30_000 + Math.floor(Math.max(0, Math.min(1, jitter)) * 2_000);
  const normalized = status.toUpperCase();
  const base =
    normalized === "LIVE" || normalized === "LIVESTREAMING"
      ? 20_000
      : normalized === "INVOKED" ||
          normalized === "STARTING" ||
          normalized === "WAITING_ON_MANUAL_INGESTION"
        ? 2_500
        : 8_000;
  return (
    Math.min(60_000, base * 2 ** Math.max(0, Math.min(3, failures))) +
    Math.floor(Math.max(0, Math.min(1, jitter)) * 500)
  );
}
