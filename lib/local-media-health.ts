export type LocalMediaKind = "audio" | "video";

type LocalTrack = {
  readyState?: string;
};

type LocalProducer = {
  kind?: string;
  closed?: boolean;
  track?: LocalTrack | null;
};

type LocalSelf = {
  audioEnabled?: boolean;
  videoEnabled?: boolean;
  audioTrack?: LocalTrack | null;
  videoTrack?: LocalTrack | null;
  producers?: readonly LocalProducer[];
};

export function publishedLocalTrackIsLive(
  self: LocalSelf | undefined,
  kind: LocalMediaKind,
) {
  if (!self) return false;
  try {
    if (self.producers)
      return self.producers.some(
        (producer) =>
          producer.kind === kind &&
          !producer.closed &&
          producer.track?.readyState === "live",
      );
  } catch {
    // RealtimeKit can briefly expose its producer facade before the internal
    // store exists. Fall through to the public self track in that interval.
  }
  const enabled = kind === "audio" ? self.audioEnabled : self.videoEnabled;
  const track = kind === "audio" ? self.audioTrack : self.videoTrack;
  return Boolean(enabled && track?.readyState === "live");
}

export type LocalMediaHealthSnapshot = Record<
  LocalMediaKind,
  { expected: boolean; live: boolean }
>;

// The SDK enabled flags and the server media row are eventually consistent.
// Require a sustained mismatch before clearing a dead publisher, while making
// the current real-track state available immediately for the device controls.
export function createLocalMediaHealthMonitor(input: {
  snapshot: () => LocalMediaHealthSnapshot;
  onHealth?: (snapshot: LocalMediaHealthSnapshot) => void;
  onStale: (kinds: LocalMediaKind[]) => Promise<unknown>;
  staleAfterMs?: number;
  now?: () => number;
}) {
  const missingSince = new Map<LocalMediaKind, number>();
  const staleAfterMs = input.staleAfterMs ?? 6_000;
  let running = false;
  let stopped = false;
  return {
    stop() {
      stopped = true;
    },
    async reconcile() {
      if (running || stopped) return;
      running = true;
      try {
        const snapshot = input.snapshot();
        input.onHealth?.(snapshot);
        const now = (input.now || Date.now)();
        const stale: LocalMediaKind[] = [];
        for (const kind of ["audio", "video"] as const) {
          const state = snapshot[kind];
          if (!state.expected || state.live) {
            missingSince.delete(kind);
            continue;
          }
          const since = missingSince.get(kind) ?? now;
          missingSince.set(kind, since);
          if (now - since >= staleAfterMs) stale.push(kind);
        }
        if (!stale.length || stopped) return;
        await input.onStale(stale);
        stale.forEach((kind) => missingSince.delete(kind));
      } catch {
        // Keep the device controls truthful and retry cleanup on the next pass.
      } finally {
        running = false;
      }
    },
  };
}
