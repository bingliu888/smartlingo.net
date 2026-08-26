export const clerkLocalizationLanguages = [
  "zh", "en", "es", "ja", "ko", "fr", "de", "ru", "it", "pt", "ar", "hi",
] as const;

export type ClerkLocalizationLanguage = typeof clerkLocalizationLanguages[number];

const clerkLocalizationLanguageCodes = new Set<string>(clerkLocalizationLanguages);

export function clerkLocalizationLanguage(pathname: string | null | undefined): ClerkLocalizationLanguage {
  const language = pathname?.split("/")[1] ?? "";
  return clerkLocalizationLanguageCodes.has(language) ? language as ClerkLocalizationLanguage : "en";
}
