import { createHash } from "node:crypto";

export const QA_TARGET_LANGUAGES = ["en", "ja", "es", "it"];
export const QA_COURSE_SKILLS = ["vocabulary", "reading", "writing", "listening", "speaking"];
export const QA_LEARNING_FEATURES = ["course", "todays_sprint", "smartcard_practice", "smartcard_challenge", "everyday_speaking"];

function boundedHash(value, size) {
  const digest = createHash("sha256").update(value).digest();
  return digest.readUInt32BE(0) % size;
}

export function createDailySessionPlan(localDate) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(localDate)) {
    throw new TypeError("localDate must be YYYY-MM-DD");
  }

  return QA_TARGET_LANGUAGES.map((language, languageIndex) => ({
    language,
    minimumActiveMinutes: 1 + boundedHash(`smartlingo-qa-minutes:${localDate}:${language}`, 5),
    deepFocus: QA_COURSE_SKILLS[boundedHash(`smartlingo-qa-focus:${localDate}:${language}`, QA_COURSE_SKILLS.length)],
    featureFocus: QA_LEARNING_FEATURES[boundedHash(`smartlingo-qa-feature:${localDate}:${language}`, QA_LEARNING_FEATURES.length)],
    rotationOrder: QA_COURSE_SKILLS.map((_, offset) => QA_COURSE_SKILLS[(languageIndex + offset + boundedHash(`smartlingo-qa-order:${localDate}`, QA_COURSE_SKILLS.length)) % QA_COURSE_SKILLS.length]),
  }));
}
