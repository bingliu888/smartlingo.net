export type RecoverableRemoteTrack = {
  id: string;
  enabled?: boolean;
  track?: { readyState: string };
};

// RealtimeKit's manual subscribe() promise confirms the requested subscription
// configuration, not the eventual MediaStreamTrack. Give delayed producers a
// bounded grace period, then rebuild only the receiver that never became live.
export function createRemoteMediaRecovery(input: {
  peers: () => RecoverableRemoteTrack[];
  subscribed: Set<string>;
  subscribe: (ids: string[]) => Promise<unknown>;
  unsubscribe: (ids: string[]) => Promise<unknown>;
  pruneAbsent?: boolean;
  repairAfterMs?: number;
  now?: () => number;
}) {
  const missingSince = new Map<string, number>();
  const repairAfterMs = input.repairAfterMs ?? 6_000;
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
        const peers = input.peers();
        if (input.pruneAbsent !== false) {
          const presentIds = new Set(peers.map((peer) => peer.id));
          for (const id of input.subscribed) {
            if (!presentIds.has(id)) {
              input.subscribed.delete(id);
              missingSince.delete(id);
            }
          }
        }
        const now = (input.now || Date.now)();
        const repair: string[] = [];
        for (const peer of peers) {
          if (!peer.enabled || peer.track?.readyState === "live") {
            missingSince.delete(peer.id);
          } else if (input.subscribed.has(peer.id)) {
            const since = missingSince.get(peer.id) ?? now;
            missingSince.set(peer.id, since);
            if (now - since >= repairAfterMs) repair.push(peer.id);
          }
        }
        if (repair.length) {
          await input.unsubscribe(repair).catch(() => undefined);
          if (stopped) return;
          repair.forEach((id) => {
            input.subscribed.delete(id);
            missingSince.delete(id);
          });
        }
        const missing = peers
          .map((peer) => peer.id)
          .filter((id) => !input.subscribed.has(id));
        if (!missing.length || stopped) return;
        // Cache only accepted requests. A provider error remains eligible for
        // the next independent timer even if no participant event follows.
        await input.subscribe(missing);
        if (!stopped) missing.forEach((id) => input.subscribed.add(id));
      } catch {
        // The owning timer retries without requiring another participant event.
      } finally {
        running = false;
      }
    },
  };
}
