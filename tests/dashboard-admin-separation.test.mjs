import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("member and admin dashboards stay separate", async () => {
  const member = await read("app/[lang]/dashboard/page.tsx");
  const admin = await read("app/[lang]/admin/page.tsx");
  assert.doesNotMatch(member, /AdminDashboard/);
  assert.match(admin, /AdminDashboard/);
  assert.match(admin, /SiteHeader/);
  assert.match(admin, /SiteFooter/);
  assert.match(admin, /isBootstrapAdminEmail|isPermanentAdmin|bingliu@cybeye\.com/);
});

test("admin menu visibility comes from server role context", async () => {
  const header = await read("components/HeaderAccount.tsx");
  const menu = await read("components/AdminMenuLink.tsx");
  const context = await read("app/api/account-context/route.ts");
  assert.match(header, /AdminMenuLink/);
  assert.match(menu, /isPermanentAdmin/);
  assert.match(context, /isPermanentAdmin/);
});
