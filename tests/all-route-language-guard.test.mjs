import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(path) : entry.name.endsWith(".tsx") ? [path] : [];
  });
}

test("every language-prefixed page accepts all twelve site languages", () => {
  for (const file of sourceFiles("app")) {
    for (const [index, line] of readFileSync(file, "utf8").split("\n").entries()) {
      const guarded = [...line.matchAll(/[A-Za-z0-9_.]*lang\s*!==\s*"(en|zh)"/gi)].map(match => match[1]);
      if (!line.includes("notFound()") || !guarded.includes("en") || !guarded.includes("zh")) continue;
      const context = `${file}:${index + 1}: ${line}`;
      assert.match(line, /[A-Za-z0-9_.]*lang\s*!==\s*"ja"/i, `stale bilingual-only route guard: ${context}`);
      assert.match(line, /[A-Za-z0-9_.]*lang\s*!==\s*"hi"/i, `incomplete twelve-language route guard: ${context}`);
    }
  }
});
