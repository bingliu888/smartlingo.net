// Adapted from the verified Guandan static interface translator.
type Template = { pattern: RegExp; replacement: string; placeholders: string[] };
const templateCache = new WeakMap<Record<string, string>, Template[]>();

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function templatesFor(dictionary: Record<string, string>) {
  const cached = templateCache.get(dictionary);
  if (cached) return cached;
  const templates = Object.entries(dictionary)
    .filter(([source]) => /\{\d+\}/.test(source))
    .map(([source, replacement]) => {
      const placeholders = [...source.matchAll(/\{(\d+)\}/g)].map(match => match[1]);
      let cursor = 0;
      const parts: string[] = [];
      for (const match of source.matchAll(/\{\d+\}/g)) {
        parts.push(escapeRegExp(source.slice(cursor, match.index)));
        parts.push("(.*?)");
        cursor = (match.index || 0) + match[0].length;
      }
      parts.push(escapeRegExp(source.slice(cursor)));
      return { pattern: new RegExp(`^${parts.join("")}$`), replacement, placeholders };
    });
  templateCache.set(dictionary, templates);
  return templates;
}

export function translateStaticValue(value: string, dictionary: Record<string, string>) {
  if (!value.trim()) return value;
  const trimmed = value.trim();
  let replacement = dictionary[value] ?? dictionary[trimmed];
  if (!replacement) {
    for (const template of templatesFor(dictionary)) {
      const match = trimmed.match(template.pattern);
      if (!match) continue;
      replacement = template.replacement;
      template.placeholders.forEach((placeholder, index) => {
        replacement = replacement!.replaceAll(`{${placeholder}}`, match[index + 1] || "");
      });
      break;
    }
  }
  if (!replacement) return value;
  const start = value.indexOf(trimmed);
  return value.slice(0, start) + replacement + value.slice(start + trimmed.length);
}
