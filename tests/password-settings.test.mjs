import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("account supports setting and updating a Clerk password", async () => {
  const form = await readFile(new URL("../components/PasswordSettings.tsx", import.meta.url), "utf8");
  const account = await readFile(new URL("../app/[lang]/account/page.tsx", import.meta.url), "utf8");
  const menu = await readFile(new URL("../components/HeaderAccount.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(form, /useReverification/);
  assert.match(form, /user\?\.passwordEnabled/);
  assert.match(form, /user\.updatePassword/);
  assert.match(form, /currentPassword: passwordEnabled \? currentPassword : undefined/);
  assert.match(form, /No additional email code is required/);
  assert.match(form, /不会再次要求邮箱验证码/);
  assert.match(form, /newPassword/);
  assert.match(account, /<PasswordSettings lang=\{lang === "zh" \? "zh" : "en"\}\/>/);
  assert.match(account, /Manage your SmartLingo profile/);
  assert.match(account, /管理您的 SmartLingo 个人资料/);
  assert.match(menu, /lang === "zh" \? "个人资料" : "Profile"/);
});
