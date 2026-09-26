import { isSmartLingoCommunityLanguage } from "./smartlingo-language-communities";

export function joinedLanguageCodes(values: readonly string[]) {
  return [...new Set(values.filter(isSmartLingoCommunityLanguage))];
}

export function tutorLearningLanguage(query: unknown, joined: readonly string[]) {
  if (typeof query === "string" && isSmartLingoCommunityLanguage(query)) return query;
  return joined.find(isSmartLingoCommunityLanguage) || null;
}
