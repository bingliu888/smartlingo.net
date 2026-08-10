export type ClassRuntimeBindings = {
  CLASS_FILES?: unknown;
  CLOUDFLARE_REALTIME_API_TOKEN?: string;
  CLOUDFLARE_ACCOUNT_ID?: string;
  REALTIMEKIT_APP_ID?: string;
  REALTIMEKIT_GUEST_PRESET?: string;
  REALTIMEKIT_MEMBER_PRESET?: string;
  REALTIMEKIT_HOST_PRESET?: string;
  REALTIMEKIT_VIEWER_PRESET?: string;
  REALTIMEKIT_WEBINAR_HOST_PRESET?: string;
  REALTIMEKIT_WEBINAR_SPEAKER_PRESET?: string;
  REALTIMEKIT_WEBINAR_VIEWER_PRESET?: string;
  REALTIMEKIT_LIVESTREAM_HOST_PRESET?: string;
  REALTIMEKIT_LIVESTREAM_SPEAKER_PRESET?: string;
  REALTIMEKIT_LIVESTREAM_VIEWER_PRESET?: string;
};

export function getClassRuntimeBindings() {
  return ((globalThis as unknown as { __CLASS_RUNTIME_ENV__?: ClassRuntimeBindings }).__CLASS_RUNTIME_ENV__ || {}) as ClassRuntimeBindings;
}
