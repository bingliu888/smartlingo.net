import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

const read = path => readFile(new URL(path, import.meta.url), "utf8");

test("the migrated license-based Admin API is an inert 410 endpoint", async () => {
  const route = await read("../app/api/admin/classes/route.ts");

  assert.match(route, /license-based class-admin API is retired/);
  assert.match(route, /member-led language-class model/);
  assert.match(route, /status: 410/);
  assert.match(route, /export const GET = retired/);
  assert.match(route, /export const POST = retired/);
  assert.doesNotMatch(route, /INSERT|UPDATE|DELETE|license\.issue|price\.approve|SMARTAICERT_ADMIN_EMAILS/);
});

test("the old Admin page resolves through Next notFound without a second management console", async () => {
  const page = await read("../app/[lang]/admin/classes/page.tsx");

  assert.match(page, /import \{ notFound \} from "next\/navigation"/);
  assert.match(page, /notFound\(\)/);
  assert.doesNotMatch(page, /SmartLingoAdminConsole|license|membership|price approval/i);
  await assert.rejects(read("../components/SmartLingoAdminConsole.tsx"), error => error?.code === "ENOENT");
  await assert.rejects(read("../lib/smartlingo-admin.ts"), error => error?.code === "ENOENT");
});

test("legacy course commerce stays retired while fixed-course free-month enrollment is isolated", async () => {
  const retiredRoutes = await Promise.all([
    read("../app/api/classes/licenses/route.ts"),
    read("../app/api/classes/referrals/claim/route.ts"),
    read("../app/api/classes/[classId]/referrals/route.ts"),
    read("../app/r/class/[code]/route.ts"),
  ]);

  for (const route of retiredRoutes) {
    assert.match(route, /status: 410/);
    assert.doesNotMatch(route, /INSERT|UPDATE|DELETE|smartlingo_bacc_ledger/i);
  }

  const enrollment = await read("../app/api/classes/[classId]/enroll/route.ts");
  assert.match(enrollment, /Authentication required/);
  assert.match(enrollment, /charged: false/);
  assert.match(enrollment, /smartlingo_course_subscriptions/);
  assert.match(enrollment, /'trialing'/);
  assert.match(enrollment, /trialEndsAt/);
  assert.match(enrollment, /smartlingo_language_class_members/);
  assert.doesNotMatch(enrollment, /smartlingo_bacc_ledger|introducer_reward|stripe\.checkout|PaymentIntent/i);
});

test("all tracked migrations apply in order and 0017 remains additive", async () => {
  const names = (await readdir(new URL("../drizzle", import.meta.url)))
    .filter(name => /^\d{4}_.+\.sql$/.test(name))
    .sort();
  assert.ok(names.includes("0017_smartlingo_language_marketplace.sql"));
  const sources = await Promise.all(names.map(name => read(`../drizzle/${name}`)));
  const marketplace = sources[names.indexOf("0017_smartlingo_language_marketplace.sql")];

  assert.match(marketplace, /smartlingo_language_classes/);
  assert.match(marketplace, /smartlingo_language_class_orders/);
  assert.match(marketplace, /smartlingo_platform_subscription_payments/);
  assert.match(marketplace, /smartlingo_introducer_reward_ledger/);
  assert.match(marketplace, /smartlingo_language_class_order_split_ck/);
  assert.match(marketplace, /smartlingo_introducer_reward_ledger_subscription_payment_id_unique/);
  assert.doesNotMatch(marketplace, /(?:^|\n)\s*(?:DROP|DELETE)\b/i);

  execFileSync("/usr/bin/sqlite3", [":memory:"], {
    input: `PRAGMA foreign_keys=ON;\n${sources.join("\n")}\nPRAGMA foreign_key_check;\n`,
    stdio: ["pipe", "pipe", "pipe"],
  });
});
