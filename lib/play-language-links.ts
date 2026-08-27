export function playLanguageLinks(interfaceLanguage: string, targetLanguage?: string) {
  const query = targetLanguage ? `?language=${encodeURIComponent(targetLanguage)}` : "";
  return {
    smartcards: `/${interfaceLanguage}/smartcards${query}`,
    challenge: `/${interfaceLanguage}/play/challenge${query}`,
    rankings: `/${interfaceLanguage}/play/rankings${query}`,
  };
}
