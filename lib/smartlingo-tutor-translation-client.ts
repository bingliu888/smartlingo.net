export async function translateTutorLines(texts: string[], language: string, uiLanguage: string) {
  const response = await fetch("/api/assistant/tutor-translation", { method: "POST", credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ language, uiLanguage, texts }),
  });
  const result = await response.json() as { translations?: string[]; error?: string };
  if (!response.ok || !Array.isArray(result.translations) || result.translations.length !== texts.length)
    throw new Error(result.error || "Translation is unavailable.");
  return result.translations;
}
