import fs from "node:fs/promises";
import ts from "typescript";

const generatedUrl = new URL("../lib/home-interface-translations.generated.ts", import.meta.url);
const sourceUrls = process.argv.slice(2).map(value => new URL(`../${value}`, import.meta.url));
if (!sourceUrls.length) throw new Error("Pass at least one source file");

const generated = await fs.readFile(generatedUrl, "utf8");
const payload = generated.match(/homeInterfaceTranslations[^=]*=\s*([\s\S]*);\s*$/)?.[1];
if (!payload) throw new Error("Unable to parse generated translation catalog");
const translations = JSON.parse(payload);
const pairs = new Map();
for (const sourceUrl of sourceUrls) {
  const source = await fs.readFile(sourceUrl, "utf8");
  for (const match of source.matchAll(/\bt\(\s*("(?:\\.|[^"\\])*")\s*,\s*("(?:\\.|[^"\\])*")\s*,?\s*\)/g)) {
    pairs.set(JSON.parse(match[1]), JSON.parse(match[2]));
  }
  for (const match of source.matchAll(/\binterfaceText\([^,]+,\s*("(?:\\.|[^"\\])*")\s*,\s*("(?:\\.|[^"\\])*")\s*\)/g)) {
    pairs.set(JSON.parse(match[1]), JSON.parse(match[2]));
  }
  const sourceFile = ts.createSourceFile(sourceUrl.pathname, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const collectStrings = node => {
    if (ts.isStringLiteralLike(node)) pairs.set(node.text, "");
    ts.forEachChild(node, collectStrings);
  };
  const visit = node => {
    if (ts.isPropertyAssignment(node) && ["en", "nameEn"].includes(node.name.getText(sourceFile))) {
      if (ts.isStringLiteralLike(node.initializer)) pairs.set(node.initializer.text, "");
      else collectStrings(node.initializer);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
}

const targets = ["ja", "ko", "es", "fr", "de", "ru", "it", "pt", "ar", "hi"];
const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
for (const target of targets) {
  translations[target] ||= {};
  for (const english of pairs.keys()) {
    if (translations[target][english]) continue;
    const endpoint = new URL("https://clients5.google.com/translate_a/t");
    endpoint.searchParams.set("client", "dict-chrome-ex");
    endpoint.searchParams.set("sl", "en");
    endpoint.searchParams.set("tl", target);
    const placeholders = [...new Set(english.match(/\{[a-z]+\}/g) ?? [])];
    let query = english;
    const placeholderTokens = placeholders.map((_, index) =>
      `SMARTLINGOPLACEHOLDER${String.fromCharCode(65 + index)}`,
    );
    placeholders.forEach((placeholder, index) => {
      query = query.replaceAll(placeholder, placeholderTokens[index]);
    });
    endpoint.searchParams.set("q", query);
    const response = await fetch(endpoint, { signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error(`${target} translation HTTP ${response.status}`);
    const result = await response.json();
    if (!Array.isArray(result) || typeof result[0] !== "string") throw new Error(`${target} invalid translation`);
    let translated = result[0];
    placeholders.forEach((placeholder, index) => {
      translated = translated.replace(new RegExp(placeholderTokens[index], "gi"), placeholder);
    });
    for (const placeholder of placeholders) {
      if (!translated.includes(placeholder)) {
        throw new Error(`${target} lost placeholder ${placeholder}: ${english}`);
      }
    }
    translations[target][english] = translated;
    await wait(80);
  }
  process.stdout.write(`Extended ${target}\n`);
}

await fs.writeFile(generatedUrl, `// Generated interface translation catalog.\n// Public interface copy only; review changes before release.\nexport const homeInterfaceTranslations: Record<string, Record<string, string>> = ${JSON.stringify(translations, null, 2)};\n`);
