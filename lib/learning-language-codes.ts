import { SMARTLINGO_LANGUAGE_COMMUNITIES } from "./smartlingo-language-communities";

export function joinedLanguageCodes(values: readonly string[]) {
  const saved = new Set(values);
  return SMARTLINGO_LANGUAGE_COMMUNITIES.filter(item => saved.has(item.code)).map(item => item.code);
}
