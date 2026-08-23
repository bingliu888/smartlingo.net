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
  const guard = /lang\s*!==\s*"en"\s*&&\s*lang\s*!==\s*"zh"/;
  for (const file of sourceFiles("app")) {
    for (const [index, line] of readFileSync(file, "utf8").split("\n").entries()) {
      if (!guard.test(line)) continue;
      const context = `${file}:${index + 1}: ${line}`;
      assert.match(line, /lang\s*!==\s*"ja"/, `stale bilingual-only route guard: ${context}`);
      assert.match(line, /lang\s*!==\s*"hi"/, `incomplete twelve-language route guard: ${context}`);
    }
  }
});
