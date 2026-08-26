import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { passwordSettingsMode } from "../lib/password-settings-mode.ts";

test("password settings mode distinguishes adding from updating", () => {
  assert.deepEqual(passwordSettingsMode(false), { action: "add", requiresCurrentPassword: false });
  assert.deepEqual(passwordSettingsMode(true), { action: "update", requiresCurrentPassword: true });
});

test("account supports setting and updating a Clerk password", async () => {
  const [form, passwordInput] = await Promise.all([
    readFile(new URL("../components/PasswordSettings.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/PasswordInput.tsx", import.meta.url), "utf8"),
  ]);
  const account = await readFile(new URL("../app/[lang]/account/page.tsx", import.meta.url), "utf8");
  const menu = await readFile(new URL("../components/HeaderAccount.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(form, /useReverification/);
  assert.match(form, /user\?\.passwordEnabled/);
  assert.match(form, /passwordSettingsMode\(passwordEnabled\)/);
  assert.match(form, /user\.updatePassword/);
  assert.match(form, /currentPassword: mode\.requiresCurrentPassword \? currentPassword : undefined/);
  assert.match(form, /No additional email code is required/);
  assert.match(form, /不会再次要求邮箱验证码/);
  assert.match(form, /newPassword/);
  assert.match(form, /<PasswordInput[^>]+label=\{t\("Current password", "当前密码"\)/);
  assert.match(form, /<PasswordInput[^>]+label=\{t\("New password", "新密码"\)/);
  assert.match(form, /<PasswordInput[^>]+label=\{t\("Confirm new password", "确认新密码"\)/);
  assert.match(form, /mode\.requiresCurrentPassword && <PasswordInput/);
  assert.match(form, /t\("Add password", "添加密码"\)/);
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
