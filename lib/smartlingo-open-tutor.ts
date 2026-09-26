import { isSmartLingoCommunityLanguage, SMARTLINGO_LANGUAGE_COMMUNITIES } from "./smartlingo-language-communities";
import { isInterfaceLanguage, type InterfaceLanguage } from "./interface-locale";

// The existing Live tutor session and translation routes share this language validation.
export function resolveOpenTutorMission(input: { language?: unknown; uiLanguage?: unknown }) {
  if (typeof input.language !== "string" || !isSmartLingoCommunityLanguage(input.language)) return null;
  if (typeof input.uiLanguage !== "string" || !isInterfaceLanguage(input.uiLanguage)) return null;
  return {
    language: SMARTLINGO_LANGUAGE_COMMUNITIES.find(item => item.code === input.language)!,
    uiLanguage: input.uiLanguage as InterfaceLanguage,
  };
}
