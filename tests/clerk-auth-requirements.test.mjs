import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const read = path => readFile(new URL(path, import.meta.url), "utf8");

async function importTypeScriptModule(path) {
  const source = await read(path);
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(output).toString("base64")}`);
}

test("maps Clerk password-only missing requirements to a safe completion step", async () => {
  const requirements = await importTypeScriptModule("../lib/clerk-auth-requirements.ts");

  assert.deepEqual(requirements.resolveSignUpRequirements(["password"], "zh"), {
    kind: "password",
    fields: ["password"],
    message: "电子邮箱已验证。当前账户设置还要求新用户创建密码；设置后将自动完成登录。",
  });
  assert.deepEqual(requirements.resolveSignUpRequirements(["password"], "en"), {
    kind: "password",
    fields: ["password"],
    message: "Your email is verified. The current account settings also require new users to create a password; sign-in will finish automatically after you set it.",
  });
});

test("names unsupported Clerk requirements instead of showing a generic dead end", async () => {
  const requirements = await importTypeScriptModule("../lib/clerk-auth-requirements.ts");

  const result = requirements.resolveSignUpRequirements(["first_name", "protect_check"], "zh");
  assert.equal(result.kind, "unsupported");
  assert.deepEqual(result.fields, ["first_name", "protect_check"]);
  assert.match(result.message, /名字、安全验证/);
  assert.doesNotMatch(result.message, /额外步骤/);
});

test("verified sign-up completes a session or safely collects a required password", async () => {
  const form = await read("../components/ClerkAuthForm.tsx");

  assert.match(form, /result\.status === "complete" && result\.createdSessionId/);
  assert.match(form, /resolveSignUpRequirements\(result\.missingFields, lang\)/);
  assert.match(form, /setStep\("password-required"\)/);
  assert.match(form, /signUp\.update\(\{ password \}\)/);
  assert.match(form, /await activateSession\(setActiveSignUp, result\.createdSessionId\)/);
  assert.match(form, /id="clerk-captcha"/);
  assert.doesNotMatch(form, /throw new Error\(zh \? "验证需要额外步骤。"/);
});

test("all completed Clerk sessions navigate through the deterministic app bridge", async () => {
  const [form, bridge, completePage] = await Promise.all([
    read("../components/ClerkAuthForm.tsx"),
    read("../components/ClerkSessionBridge.tsx"),
    read("../app/[lang]/auth/complete/page.tsx"),
  ]);

  assert.match(form, /const completePath = `\/\$\{lang\}\/auth\/complete\?returnTo=\$\{encodeURIComponent\(returnTo\)\}`/);
  assert.match(form, /decorateUrl\(completePath\)/);
  assert.doesNotMatch(form, /fetch\("\/api\/auth\/clerk-session"/);
  assert.match(bridge, /fetch\("\/api\/auth\/clerk-session"/);
  assert.match(bridge, /body: JSON\.stringify\(\{ language: lang \}\)/);
  assert.match(bridge, /window\.location\.replace\(returnTo\)/);
  assert.match(completePage, /const returnTo = safeReturnTo\(query\.returnTo, lang\)/);
  assert.match(completePage, /<ClerkSessionBridge lang=\{lang\} returnTo=\{returnTo\}\/>/);
});

test("password sign-in never turns an unknown email into password registration", async () => {
  const form = await read("../components/ClerkAuthForm.tsx");

  assert.doesNotMatch(form, /signUp\.create\(\{\s*emailAddress:\s*identifier,\s*password/);
  assert.match(form, /signUp\.create\(\{ emailAddress: identifier \}\)/);
  assert.match(form, /async function finishSignIn/);
  assert.match(form, /result\.status === "needs_second_factor" \|\| result\.status === "needs_client_trust"/);
  assert.match(form, /const result = await signIn\.create\(\{ identifier, password \}\);\s*await finishSignIn\(result, identifier\)/);
});
