import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
const read=path=>readFile(new URL(path,import.meta.url),"utf8");

test("admin dashboard stays separate from the normal dashboard and exposes role-scoped user tabs",async()=>{const[page,panel,menu]=await Promise.all([read("../app/[lang]/dashboard/page.tsx"),read("../components/AdminDashboard.tsx"),read("../components/AdminMenuLink.tsx")]);assert.doesNotMatch(page,/user\.role === "admin"/);assert.match(menu,/Admin dashboard/);assert.match(panel,/admin\/members\?tab=members/);assert.match(panel,/admin\/members\?tab=admins/);assert.match(panel,/admin\/members\?tab=subscribers/);assert.match(panel,/admin\/language-classes/);assert.doesNotMatch(panel,/tab=teachers/)});
test("member management uses one expiry-dated Max subscription for paid and admin-granted access", async () => {
  const [list, detail, route, actions, migration, entitlement] = await Promise.all([
    read("../app/[lang]/admin/members/page.tsx"),
    read("../app/[lang]/admin/members/[memberId]/page.tsx"),
    read("../app/api/admin/members/[memberId]/route.ts"),
    read("../components/AdminMemberActions.tsx"),
    read("../drizzle/0189_admin_max_subscription_backfill.sql"),
    read("../lib/platform-entitlements.ts"),
  ]);
  for (const source of [list, detail, route]) assert.match(source, /isPermanentAdmin|getAdminUser/);
  assert.match(list, /s\.current_period_ends_at>unixepoch\(\)/);
  assert.match(list, /data-layout-page="admin-members"[^>]*data-layout-ready="true"/);
  assert.match(list, /Expires: /);
  assert.match(list, /tab === "subscribers"/);
  assert.match(list, /tab === "admins"/);
  assert.match(list, /lower\(u\.email\) LIKE \?/);
  assert.match(list, /name="q" type="search"/);
  assert.doesNotMatch(list, /teachers|教师/);
  assert.match(detail, /AdminMemberRoleEditor/);
  assert.match(detail, /data-layout-page="admin-member-detail"[^>]*data-layout-ready="true"/);
  assert.match(detail, /Max 到期日/);
  assert.match(actions, /6 months/);
  assert.match(actions, /12 months/);
  assert.match(actions, /requestId: crypto\.randomUUID\(\)/);
  assert.match(route, /changeAdminMaxSubscription/);
  assert.match(entitlement, /INSERT INTO subscriptions/);
  assert.match(entitlement, /platform_admin_audit/);
  assert.match(migration, /role\.grant-subscriber/);
  assert.doesNotMatch(route, /export async function DELETE/);
  assert.doesNotMatch(list, /AdminMemberDelete/);
  assert.match(route, /administrator role is protected/i);
  assert.doesNotMatch(route, /DELETE FROM sessions|status='removed'/);
});
test("course administration keeps three curriculum levels and zero course payment items",async()=>{const[page,panel]=await Promise.all([read("../app/[lang]/admin/language-classes/page.tsx"),read("../components/AdminDashboard.tsx")]);assert.match(page,/isPermanentAdmin/);assert.match(page,/SMARTLINGO_COURSE_PACKAGES/);assert.match(page,/No separate course payment item/);assert.match(page,/Course payment items/);assert.match(page,/Course payment items", "课程付款项目"\)\}: 0/);assert.doesNotMatch(page,/data-price-product-id|Polygon · USDT \/ GLC|SMARTLINGO_COURSE_SUBSCRIPTION_PACKAGES/);assert.match(panel,/0 course payment items/);assert.doesNotMatch(panel,/3 levels × 3 fixed terms/)});
