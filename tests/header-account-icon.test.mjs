import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("desktop and mobile headers use the same accessible account icon", async () => {
  const account = await readFile(new URL("../components/HeaderAccount.tsx", import.meta.url), "utf8");
  const header = await readFile(new URL("../components/SiteHeader.tsx", import.meta.url), "utf8");

  assert.equal((header.match(/<HeaderAccount lang=\{lang\}\/>/g) ?? []).length, 2);
  assert.doesNotMatch(header, /variant="text"/);
  assert.match(account, /session\.imageUrl \? <img src=\{session\.imageUrl\} alt=""\/> : <span className="avatar-glyph"/);
  assert.match(account, /className="user-icon" href=\{`\/\$\{lang\}\/auth\/login`\} aria-label=\{label\} title=\{label\}/);
  assert.doesNotMatch(account, /variant === "icon"/);
});
