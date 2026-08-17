import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const read = (path) => readFileSync(path, "utf8");
function findCss(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      const found = findCss(path);
      if (found) return found;
    } else if (entry.name.endsWith(".css") && read(path).includes("class-entry-form")) return path;
  }
}

test("password-protected class entry is visible, toggleable, and verified server-side", () => {
  const detail = read("components/class-detail-experience.tsx");
  const clientPath = existsSync("components/live-class-room-client.tsx")
    ? "components/live-class-room-client.tsx"
    : "components/class-room-client.tsx";
  const routePath = existsSync("app/api/classrooms/[code]/join/route.ts")
    ? "app/api/classrooms/[code]/join/route.ts"
    : "app/api/classes/[code]/join/route.ts";
  const libraryPath = existsSync("lib/live-classrooms.ts") ? "lib/live-classrooms.ts" : "lib/classrooms.ts";
  const client = read(clientPath);
  const screenShare = read("components/class-screen-share.tsx");
  const route = read(routePath);
  const library = read(libraryPath);
  const css = read(findCss("app"));

  assert.match(detail, /room\.hasPassword&&!manager/);
  assert.match(detail, /class-password-toggle/);
  assert.match(detail, /showPassword\?"text":"password"/);
  assert.match(detail, /sessionStorage\.setItem\(`class-entry-\$\{room\.code\}`/);
  assert.match(client, /class-entry-\$\{room\.code\}/);
  assert.match(client, /password: entryPassword/);
  assert.match(screenShare, /class-entry-\$\{code\}/);
  assert.match(route, /room\.hasPassword && !access\.manager/);
  assert.match(route, /INCORRECT_CLASS_PASSWORD/);
  assert.match(library, /SELECT password_hash AS passwordHash/);
  assert.match(css, /\.class-password-toggle/);
});

