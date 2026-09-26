// Adapted from Guandan.guru's verified static Traditional Chinese generator.
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import OpenCC from "opencc-js";
import ts from "typescript";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = join(projectRoot, "lib/traditional-ui-translations.generated.ts");
const converter = OpenCC.Converter({ from: "cn", to: "twp" });
const phrases = new Set();

function addPhrase(value) {
  const normalized = value.replace(/\r\n/g, "\n").trim();
  if (normalized && normalized.length <= 2_000 && /\p{Script=Han}/u.test(normalized)) phrases.add(normalized);
}

function normalizedTemplate(node) {
  if (!ts.isTemplateExpression(node)) return null;
  let value = node.head.text;
  node.templateSpans.forEach((span, index) => { value += `{${index}}${span.literal.text}`; });
  return value;
}

function collectSource(relativePath) {
  const source = readFileSync(join(projectRoot, relativePath), "utf8");
  const sourceFile = ts.createSourceFile(relativePath, source, ts.ScriptTarget.Latest, true, relativePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  function visit(node) {
    if (ts.isStringLiteralLike(node)) addPhrase(node.text);
    else if (ts.isTemplateExpression(node)) addPhrase(normalizedTemplate(node) || "");
    else if (ts.isJsxText(node)) addPhrase(node.text.replace(/\s+/g, " "));
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
}

function visitDirectory(directory) {
  for (const name of readdirSync(join(projectRoot, directory))) {
    const relativePath = join(directory, name);
    const stat = statSync(join(projectRoot, relativePath));
    if (stat.isDirectory()) { visitDirectory(relativePath); continue; }
    if (!/\.tsx?$/.test(name) || name.endsWith(".d.ts") || name.endsWith(".generated.ts") || stat.size > 200_000) continue;
    collectSource(relativePath);
  }
}

for (const root of ["app", "components", "lib"]) visitDirectory(root);
const translations = Object.fromEntries([...phrases]
  .sort((left, right) => left.localeCompare(right, "zh-CN"))
  .map(source => [source, converter(source)])
  .filter(([source, translated]) => source !== translated));
const generated = `// Generated from authored SmartLingo Simplified Chinese interface copy.\n// Run npm run i18n:traditional after changing Simplified Chinese copy.\nconst traditionalUiTranslations: Record<string, string> = ${JSON.stringify(translations, null, 2)};\nexport default traditionalUiTranslations;\n`;

if (process.argv.includes("--check")) {
  if (readFileSync(outputPath, "utf8") !== generated) {
    console.error(`${relative(projectRoot, outputPath)} is stale. Run npm run i18n:traditional.`);
    process.exitCode = 1;
  }
} else {
  writeFileSync(outputPath, generated);
  console.log(`Wrote ${Object.keys(translations).length} Traditional Chinese interface translations.`);
}
