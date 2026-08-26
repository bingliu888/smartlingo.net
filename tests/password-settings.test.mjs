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
  assert.match(form, /useReverification/);
  assert.match(form, /user\?\.passwordEnabled/);
  assert.match(form, /passwordSettingsMode\(passwordEnabled\)/);
  assert.match(form, /user\?\.updatePassword/);
  assert.match(form, /currentPassword: mode\.requiresCurrentPassword \? currentPassword : undefined/);
  assert.match(form, /If this sign-in is no longer recent/);
  assert.match(form, /如果本次登录已超过安全时限/);
  assert.match(form, /A recent email-code sign-in needs no extra code/);
  assert.match(form, /近期使用邮箱验证码登录无需再次输入验证码/);
  assert.match(form, /isReverificationCancelledError/);
  assert.match(form, /session_reverification_required/);
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
  assert.match(form, /At least 8 characters/);
  assert.match(form, /至少 8 个字符/);
  assert.doesNotMatch(form, /form_password_pwned|已知数据泄露|12 个字符/);
  assert.match(account, /<PasswordSettings lang=\{lang\}\/>/);
  assert.match(account, /Manage your SmartLingo profile/);
  assert.match(account, /管理您的 SmartLingo 个人资料/);
  assert.match(menu, /lang === "zh" \? "个人资料" : "Profile"/);
});
