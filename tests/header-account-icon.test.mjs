import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("desktop account icon and the mobile drawer expose the same account destinations", async () => {
  const account = await readFile(new URL("../components/HeaderAccount.tsx", import.meta.url), "utf8");
  const header = await readFile(new URL("../components/SiteHeader.tsx", import.meta.url), "utf8");

  assert.equal((header.match(/<HeaderAccount lang=\{lang\}/g) ?? []).length, 2);
  assert.match(header, /<HeaderAccount lang=\{lang\} mobile onNavigate=/);
  assert.doesNotMatch(header, /variant="text"/);
  assert.match(account, /session\.imageUrl \? <Image src=\{session\.imageUrl\} alt="" width=\{96\} height=\{96\} unoptimized\/> : <span className="avatar-glyph"/);
  assert.match(account, /className="user-icon" href=\{`\/\$\{lang\}\/auth\/login`\} aria-label=\{label\} title=\{label\}/);
  assert.doesNotMatch(account, /variant === "icon"/);
  assert.match(account, /mobile \? <nav className=\{styles\.mobileSignIn\}/);
  assert.match(account, /\(open \|\| mobile\) && <nav/);
});
