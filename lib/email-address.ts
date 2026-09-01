const EMAIL_LOCAL_MAX_LENGTH = 64;
const EMAIL_MAX_LENGTH = 254;

export function normalizeEmailAddress(value: unknown) {
  if (typeof value !== "string") return null;
  const email = value.normalize("NFKC").trim().toLowerCase();
  if (!email || email.length > EMAIL_MAX_LENGTH || /[\u0000-\u001f\u007f\s]/u.test(email)) return null;
  const separator = email.lastIndexOf("@");
  if (separator < 1 || separator !== email.indexOf("@") || separator > EMAIL_LOCAL_MAX_LENGTH) return null;
  const local = email.slice(0, separator);
  const domain = email.slice(separator + 1);
  if (!local || local.startsWith(".") || local.endsWith(".") || local.includes("..")) return null;
  if (!domain || domain.length > 253 || domain.startsWith(".") || domain.endsWith(".") || domain.includes("..")) return null;
  const labels = domain.split(".");
  if (labels.length < 2 || labels.some(label => !label || label.length > 63 || label.startsWith("-") || label.endsWith("-") || !/^[a-z0-9-]+$/u.test(label))) return null;
  return email;
}

export function requireNormalizedEmailAddress(value: unknown) {
  const email = normalizeEmailAddress(value);
  if (!email) throw new Error("INVALID_EMAIL");
  return email;
}
