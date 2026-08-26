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

const requirements = await importTypeScriptModule("../lib/clerk-auth-requirements.ts");

test("prepares an existing member's email-code factor and returns bilingual code state", async () => {
  const preparedFactors = [];
  const result = await requirements.prepareEmailCodeFlow("member@example.com", "zh", {
    createSignIn: async identifier => {
      assert.equal(identifier, "member@example.com");
      return {
        supportedFirstFactors: [
          { strategy: "password" },
          { strategy: "email_code", emailAddressId: "email_123" },
        ],
        prepareFirstFactor: async factor => preparedFactors.push(factor),
      };
    },
    createSignUp: async () => assert.fail("an existing member must not enter sign-up"),
    isIdentifierNotFound: () => false,
  });

  assert.deepEqual(preparedFactors, [{ strategy: "email_code", emailAddressId: "email_123" }]);
  assert.deepEqual(result, {
    flow: "sign-in",
    identifier: "member@example.com",
    message: "验证码已发送至 member@example.com",
  });
  assert.equal(
    requirements.emailCodeSentMessage("member@example.com", "en"),
    "Code sent to member@example.com",
  );
});

test("prepares passwordless email-code registration only when Clerk reports an unknown identifier", async () => {
  const identifierNotFound = new Error("identifier_not_found");
  const signUpCalls = [];
  const result = await requirements.prepareEmailCodeFlow("new@example.com", "en", {
    createSignIn: async () => { throw identifierNotFound; },
    createSignUp: async identifier => {
      signUpCalls.push(identifier);
      return {
        prepareEmailAddressVerification: async params => signUpCalls.push(params),
      };
    },
    isIdentifierNotFound: issue => issue === identifierNotFound,
  });

  assert.deepEqual(signUpCalls, ["new@example.com", { strategy: "email_code" }]);
  assert.deepEqual(result, {
    flow: "sign-up",
    identifier: "new@example.com",
    message: "Code sent to new@example.com",
  });

  const outage = new Error("identity_service_unavailable");
  await assert.rejects(
    requirements.prepareEmailCodeFlow("new@example.com", "en", {
      createSignIn: async () => { throw outage; },
      createSignUp: async () => assert.fail("non-identifier errors must fail closed"),
      isIdentifierNotFound: () => false,
    }),
    outage,
  );
});

test("password mode signs in existing accounts and creates unknown accounts with the submitted password", async () => {
  const calls = [];
  const existing = await requirements.startPasswordSignInOrUp("member@example.com", "member-secret", {
    createSignIn: async (identifier, password) => {
      calls.push(["sign-in", identifier, password]);
      return { status: "complete" };
    },
    createSignUp: async () => assert.fail("an existing password account must not be registered again"),
    isIdentifierNotFound: () => false,
  });
  assert.deepEqual(existing, { flow: "sign-in", result: { status: "complete" } });

  const identifierNotFound = new Error("identifier_not_found");
  const created = await requirements.startPasswordSignInOrUp("new@example.com", "new-member-secret", {
    createSignIn: async () => { throw identifierNotFound; },
    createSignUp: async (identifier, password) => {
      calls.push(["sign-up", identifier, password]);
      return { status: "complete", createdSessionId: "sess_new" };
    },
    isIdentifierNotFound: issue => issue === identifierNotFound,
  });
  assert.deepEqual(created, { flow: "sign-up", result: { status: "complete", createdSessionId: "sess_new" } });
  assert.deepEqual(calls, [
    ["sign-in", "member@example.com", "member-secret"],
    ["sign-up", "new@example.com", "new-member-secret"],
  ]);
});

test("completed Clerk sign-up activates exactly the created session", async () => {
  const activated = [];
  const result = await requirements.completeSignUpAttempt(
    { status: "complete", createdSessionId: "sess_complete" },
    "en",
    async sessionId => activated.push(sessionId),
  );

  assert.deepEqual(activated, ["sess_complete"]);
  assert.deepEqual(result, { kind: "activated", sessionId: "sess_complete" });
});

test("password-only missing requirements remain user-controlled in both languages", async () => {
  for (const [lang, expected] of [
    ["zh", "电子邮箱已验证。当前账户设置还要求新用户创建密码；设置后将自动完成登录。"],
    ["en", "Your email is verified. The current account settings also require new users to create a password; sign-in will finish automatically after you set it."],
  ]) {
    const result = await requirements.completeSignUpAttempt(
      { status: "missing_requirements", createdSessionId: null, missingFields: ["password"] },
      lang,
      async () => assert.fail("missing requirements must not activate a session"),
    );
    assert.deepEqual(result, { kind: "password", fields: ["password"], message: expected });
  }
});

test("unsupported Clerk requirements are named and never silently completed", async () => {
  const resultZh = await requirements.completeSignUpAttempt(
    {
      status: "missing_requirements",
      createdSessionId: null,
      missingFields: ["first_name", "protect_check", "first_name"],
    },
    "zh",
    async () => assert.fail("unsupported requirements must not activate a session"),
  );
  assert.equal(resultZh.kind, "unsupported");
  assert.deepEqual(resultZh.fields, ["first_name", "protect_check"]);
  assert.match(resultZh.message, /名字、安全验证/);

  const resultEn = requirements.resolveSignUpRequirements(["phone_number", "custom_field"], "en");
  assert.equal(resultEn.kind, "unsupported");
  assert.match(resultEn.message, /phone number, custom_field/);

  await assert.rejects(
    requirements.completeSignUpAttempt(
      { status: "complete", createdSessionId: null },
      "en",
      async () => assert.fail("a missing createdSessionId must fail closed"),
    ),
    /Account creation could not finish \(complete\)/,
  );
});

test("the executable auth view model owns code, password-compatibility, and CAPTCHA states", () => {
  assert.deepEqual(requirements.clerkAuthStepView("code", "code", "zh"), {
    showCodeField: true,
    captchaElementId: "clerk-captcha",
    primaryAction: "验证并继续",
    secondaryAction: "更换邮箱",
  });
  assert.deepEqual(requirements.clerkAuthStepView("code", "code", "en"), {
    showCodeField: true,
    captchaElementId: "clerk-captcha",
    primaryAction: "Verify & continue",
    secondaryAction: "Use another email",
  });
  assert.equal(requirements.clerkAuthStepView("password-required", "code", "zh").primaryAction, "设置密码并登录");
  assert.equal(requirements.clerkAuthStepView("credentials", "code", "en").primaryAction, "Send secure code");
  assert.deepEqual(requirements.clerkAuthStepView("recovery-email", "password", "en"), {
    showCodeField: false,
    captchaElementId: "clerk-captcha",
    primaryAction: "Send reset code",
    secondaryAction: "Use another email",
  });
  assert.equal(requirements.clerkAuthStepView("recovery-code", "password", "zh").primaryAction, "重置密码并登录");
});

test("the form delegates live transitions to tested helpers and mounts Clerk CAPTCHA", async () => {
  const form = await read("../components/ClerkAuthForm.tsx");

  assert.match(form, /prepareEmailCodeFlow\(identifier, lang/);
  assert.match(form, /setFlow\(prepared\.flow\)/);
  assert.match(form, /setStep\("code"\)/);
  assert.match(form, /completeSignUpAttempt\(/);
  assert.match(form, /signUp\.update\(\{ password \}\)/);
  assert.match(form, /startPasswordSignInOrUp\(identifier, password/);
  assert.match(form, /createSignUp: \(value, secret\) => signUp\.create\(\{ emailAddress: value, password: secret \}\)/);
  assert.match(form, /strategy: "reset_password_email_code"/);
  assert.match(form, /No account exists with that email/);
  assert.match(form, /id=\{authView\.captchaElementId\}/);
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

test("the form keeps email code as the default while exposing password sign-in-or-up", async () => {
  const form = await read("../components/ClerkAuthForm.tsx");

  assert.match(form, /useState<"code" \| "password">\("code"\)/);
  assert.match(form, /createSignUp: value => signUp\.create\(\{ emailAddress: value \}\)/);
  assert.match(form, /createSignUp: \(value, secret\) => signUp\.create\(\{ emailAddress: value, password: secret \}\)/);
  assert.match(form, /async function finishSignIn/);
  assert.match(form, /result\.status === "needs_second_factor" \|\| result\.status === "needs_client_trust"/);
  assert.match(form, /if \(result\.flow === "sign-in"\) await finishSignIn\(result\.result, identifier\)/);
});
