export type MediaGridLayout = "solo" | "duo" | "quad" | "stage" | "gallery";

export function mediaGridLayout(tileCount: number): MediaGridLayout {
  if (tileCount <= 1) return "solo";
  if (tileCount === 2) return "duo";
  if (tileCount <= 4) return "quad";
  if (tileCount <= 9) return "stage";
  return "gallery";
}

export function formatConnectionDuration(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;
  return [hours, minutes, seconds]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
}

export function shouldAutoJoinClassRoom(state: {
  providerMeetingId?: string | null;
  streamActive: boolean;
  screenShareActive?: boolean;
}) {
  return Boolean(
    state.providerMeetingId && (state.streamActive || state.screenShareActive),
  );
}
