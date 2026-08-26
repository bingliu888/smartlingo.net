import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("account supports setting and updating a Clerk password", async () => {
  const [form, passwordInput] = await Promise.all([
    readFile(new URL("../components/PasswordSettings.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/PasswordInput.tsx", import.meta.url), "utf8"),
  ]);
  const account = await readFile(new URL("../app/[lang]/account/page.tsx", import.meta.url), "utf8");
  const menu = await readFile(new URL("../components/HeaderAccount.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(form, /useReverification/);
  assert.match(form, /user\?\.passwordEnabled/);
  assert.match(form, /user\.updatePassword/);
  assert.match(form, /currentPassword: passwordEnabled \? currentPassword : undefined/);
  assert.match(form, /No additional email code is required/);
  assert.match(form, /不会再次要求邮箱验证码/);
  assert.match(form, /newPassword/);
  assert.match(form, /<PasswordInput[^>]+label=\{t\("Current password", "当前密码"\)/);
  assert.match(form, /<PasswordInput[^>]+label=\{t\("New password", "新密码"\)/);
  assert.match(form, /<PasswordInput[^>]+label=\{t\("Confirm new password", "确认新密码"\)/);
  assert.match(passwordInput, /type=\{view\.type\}/);
  assert.match(passwordInput, /setRevealed\(value => !value\)/);
  assert.match(passwordInput, /aria-pressed=\{revealed\}/);
  assert.match(passwordInput, /aria-label=\{view\.label\}/);
  assert.match(passwordInput, /<input[^>]+\/>\s*<button/s);
  assert.match(form, /密码更新功能正常/);
  assert.match(account, /<PasswordSettings lang=\{lang\}\/>/);
  assert.match(account, /Manage your SmartLingo profile/);
  assert.match(account, /管理您的 SmartLingo 个人资料/);
  assert.match(menu, /lang === "zh" \? "个人资料" : "Profile"/);
});
