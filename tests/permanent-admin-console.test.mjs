import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const root = new URL("../", import.meta.url).pathname;
async function files(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (["node_modules", ".next", "dist", "coverage"].includes(entry.name)) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await files(path));
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(path);
  }
  return out;
}
const sourceFiles = await files(root);
const source = Object.fromEntries(await Promise.all(sourceFiles.map(async path => [path.slice(root.length), await readFile(path, "utf8")])));
const joined = Object.values(source).join("\n");

test("bootstrap administrator is permanent", () => {
  assert.match(joined, /bingliu@cybeye\.com/);
  assert.match(joined, /cannot be removed|不可移除|Protected administrator|isBootstrapAdminEmail|BOOTSTRAP_ADMIN_EMAIL/);
});

test("only permanent administrator receives console discovery", () => {
  const menuSources = Object.entries(source).filter(([path, value]) => /header-account|HeaderAccount|AdminMenuLink|site-header/.test(path) && /Admin dashboard|管理员面板/.test(value)).map(([, value]) => value).join("\n");
  assert.ok(menuSources.length > 0, "account menu must expose the permanent console link");
  assert.match(menuSources, /isPermanentAdmin|AdminMenuLink/);
  const dashboardSources = Object.entries(source).filter(([path]) => /dashboard\/page\.tsx$|account\/page\.tsx$/.test(path)).map(([, value]) => value).join("\n");
  assert.doesNotMatch(dashboardSources, /admin-account-link|Open admin dashboard|打开管理员后台/);
});

test("direct admin console and management APIs enforce permanent identity", () => {
  const adminPages = Object.entries(source).filter(([path]) => /app\/(?:\[lang\]\/)?admin\/.*page\.tsx$|app\/(?:\[lang\]\/)?admin\/page\.tsx$/.test(path));
  assert.ok(adminPages.length > 0, "admin console page must exist");
  for (const [path, value] of adminPages) {
    if (/export default function Retired[\s\S]*notFound\(\)/.test(value)) continue;
    assert.match(value, /bingliu@cybeye\.com|getAdminUser|requirePermanentAdmin|isPermanentAdmin|isSmartAiCertAdminEmail|isBootstrapAdminEmail/, path);
  }
  const adminApis = Object.entries(source).filter(([path, value]) => /app\/api\/admin\/.+route\.ts$/.test(path) && !/cloudflare-migration|migration-(?:export|manifest|restore)/.test(path) && !/status:s*410|const (?:GET|POST) = retired|export const (?:GET|POST) = retired/.test(value));
  assert.ok(adminApis.length > 0, "admin management API must exist");
  for (const [path, value] of adminApis) assert.match(value, /bingliu@cybeye\.com|getAdminUser|requirePermanentAdmin|isSmartAiCertAdminEmail|isBootstrapAdminEmail/, path);
});
