export const MAX_BROWSER_RECORDING_SECONDS = 15 * 60;
export const MAX_AUDIO_FILE_SECONDS = 30 * 60;
export const MAX_AUDIO_NOTE_BYTES = 100 * 1024 * 1024;
export const AUDIO_NOTE_TYPES: Record<string, string> = {
  "audio/mp4": "m4a", "audio/x-m4a": "m4a", "audio/webm": "webm",
  "audio/mpeg": "mp3", "audio/wav": "wav", "audio/x-wav": "wav", "audio/ogg": "ogg",
};

export function audioNoteDurationAllowed(source: string, seconds: number) {
  return Number.isFinite(seconds) && seconds > 0 &&
    seconds <= (source === "browser" ? MAX_BROWSER_RECORDING_SECONDS :
      source === "file" ? MAX_AUDIO_FILE_SECONDS : 0);
}
