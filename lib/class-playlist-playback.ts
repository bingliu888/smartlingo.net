export const PLAYLIST_MAX_ROUNDS = 5;
export const PLAYLIST_MAX_ACTIVE_MS = 300_000;
export const PLAYLIST_CONTINUE_SECONDS = 15;

export type PlaylistSoundEvent =
  | "user-muted"
  | "user-unmuted"
  | "source-change"
  | "play-failed";

export function nextPlaylistSoundEnabled(
  current: boolean,
  event: PlaylistSoundEvent,
) {
  if (event === "user-muted") return false;
  if (event === "user-unmuted") return true;
  return current;
}

export function playlistLimitReached(rounds: number, activeMs: number) {
  return rounds >= PLAYLIST_MAX_ROUNDS || activeMs >= PLAYLIST_MAX_ACTIVE_MS;
}

export function playlistLimitResolution(seconds: number, declined: boolean) {
  if (declined) return "stop" as const;
  if (seconds <= 0) return "continue" as const;
  return "wait" as const;
}
