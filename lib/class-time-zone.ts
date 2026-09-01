const DEFAULT_CLASS_TIME_ZONE = "UTC";

export function validClassTimeZone(value: unknown): string | null {
  const timeZone = String(value || "").trim();
  if (!timeZone || timeZone.length > 64) return null;
  try {
    new Intl.DateTimeFormat("en", { timeZone }).format(0);
    return timeZone;
  } catch {
    return null;
  }
}

export function safeClassTimeZone(
  value: unknown,
  fallback = DEFAULT_CLASS_TIME_ZONE,
) {
  return validClassTimeZone(value) || validClassTimeZone(fallback) || DEFAULT_CLASS_TIME_ZONE;
}

/**
 * Formats an instant for an HTML `datetime-local` input. Those controls do
 * not accept a UTC designator, so slicing `Date#toISOString()` directly would
 * display the wrong wall-clock time outside UTC and later save a shifted
 * class. Subtracting the browser offset first keeps the visible local time
 * and the submitted instant aligned.
 */
export function localDateTimeInputValue(value: Date | number) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
}
