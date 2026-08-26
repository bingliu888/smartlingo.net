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

const bridge = await importTypeScriptModule("../lib/clerk-session-bridge.ts");
const inertClerkDomain = Buffer.from("smartlingo.clerk.accounts.invalid$").toString("base64");
const inertPublishableKey = ["pk", "test", inertClerkDomain].join("_");
const inertSecretKey = ["sk", "test", inertClerkDomain].join("_");

function request({
  url = "http://localhost/api/auth/clerk-session",
  token = "inert-session-token",
  body = { language: "zh" },
} = {}) {
  return new Request(url, {
    method: "POST",
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      "content-type": "application/json",
      cookie: "smartlingo_referral_code=LINGO_TEST",
    },
    body: JSON.stringify(body),
  });
}

function dependencies(overrides = {}) {
  return {
    runtime: {
      CLERK_SECRET_KEY: inertSecretKey,
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: inertPublishableKey,
    },
    verifyClerkToken: async () => ({ sub: "user_inert", sid: "sess_inert" }),
    getClerkUser: async () => ({
      banned: false,
      locked: false,
      firstName: "Inert",
      lastName: "Member",
      primaryEmailAddress: {
        emailAddress: "MEMBER@EXAMPLE.COM",
        verification: { status: "verified" },
      },
    }),
    createAppSession: async () => ({
      cookie: "smartlingo_session=inert-app-cookie; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=604800",
    }),
    referralCodeFromRequest: () => "LINGO_TEST",
    clearReferralCookie: () => "smartlingo_referral_code=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0",
    logError: () => {},
    ...overrides,
  };
}

test("the bridge verifies an inert Clerk token, trusts verified profile data, and sets both cookies", async () => {
  const calls = [];
  const response = await bridge.handleClerkSessionBridgeRequest(request(), dependencies({
    verifyClerkToken: async (token, options) => {
      calls.push(["verify", token, options]);
      return { sub: "user_inert", sid: "sess_inert" };
    },
    getClerkUser: async (userId, keys) => {
      calls.push(["user", userId, keys]);
      return {
        firstName: "Inert",
        lastName: "Member",
        primaryEmailAddress: {
          emailAddress: "MEMBER@EXAMPLE.COM",
          verification: { status: "verified" },
        },
      };
    },
    createAppSession: async (...args) => {
      calls.push(["session", ...args]);
      return { cookie: "smartlingo_session=inert-app-cookie; Path=/; HttpOnly; Secure; SameSite=Lax" };
    },
  }));

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
  assert.deepEqual(calls[0], [
    "verify",
    "inert-session-token",
    {
      secretKey: inertSecretKey,
      authorizedParties: [
        "https://smartlingo.net",
        "https://www.smartlingo.net",
        "http://localhost",
      ],
    },
  ]);
  assert.deepEqual(calls[1], [
    "user",
    "user_inert",
    { secretKey: inertSecretKey, publishableKey: inertPublishableKey },
  ]);
  assert.deepEqual(calls[2], [
    "session",
    "user_inert",
    "member@example.com",
    true,
    "Inert Member",
    "zh",
    "sess_inert",
    "LINGO_TEST",
  ]);
  const setCookies = typeof response.headers.getSetCookie === "function"
    ? response.headers.getSetCookie()
    : [response.headers.get("set-cookie") ?? ""];
  assert.match(setCookies.join("\n"), /smartlingo_session=inert-app-cookie/);
  assert.match(setCookies.join("\n"), /smartlingo_referral_code=;/);
});

test("the bridge uses a configured JWT key without widening authorized parties", async () => {
  let verificationOptions;
  const response = await bridge.handleClerkSessionBridgeRequest(
    request({ url: "https://preview.example/api/auth/clerk-session", body: { language: "en" } }),
    dependencies({
      runtime: {
        CLERK_SECRET_KEY: inertSecretKey,
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: inertPublishableKey,
        CLERK_JWT_KEY: "inert-jwt-public-key",
      },
      verifyClerkToken: async (_token, options) => {
        verificationOptions = options;
        return { sub: "user_inert", sid: "sess_inert" };
      },
    }),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(verificationOptions, {
    jwtKey: "inert-jwt-public-key",
    authorizedParties: ["https://smartlingo.net", "https://www.smartlingo.net"],
  });
});

test("the bridge rejects missing configuration, malformed bodies, and incomplete claims", async () => {
  const missingToken = await bridge.handleClerkSessionBridgeRequest(
    request({ token: "" }),
    dependencies(),
  );
  assert.equal(missingToken.status, 401);

  const wrongSchemeRequest = request();
  wrongSchemeRequest.headers.set("authorization", "Basic inert-session-token");
  const wrongScheme = await bridge.handleClerkSessionBridgeRequest(
    wrongSchemeRequest,
    dependencies({ verifyClerkToken: async () => assert.fail("a non-Bearer credential must not be verified") }),
  );
  assert.equal(wrongScheme.status, 401);

  const missingConfig = await bridge.handleClerkSessionBridgeRequest(
    request(),
    dependencies({ runtime: {} }),
  );
  assert.equal(missingConfig.status, 401);

  const malformedBody = await bridge.handleClerkSessionBridgeRequest(
    request({ body: { language: "zh", email: "untrusted@example.com" } }),
    dependencies(),
  );
  assert.equal(malformedBody.status, 400);

  const incompleteClaims = await bridge.handleClerkSessionBridgeRequest(
    request(),
    dependencies({ verifyClerkToken: async () => ({ sub: "user_inert" }) }),
  );
  assert.equal(incompleteClaims.status, 401);
});

test("the bridge accepts an unverified member by Clerk subject while rejecting banned and locked users", async () => {
  const appSessionCalls = [];
  const unverified = await bridge.handleClerkSessionBridgeRequest(request(), dependencies({
    getClerkUser: async () => ({
      firstName: "Unverified",
      primaryEmailAddress: {
        emailAddress: "member@example.com",
        verification: { status: "unverified" },
      },
    }),
    createAppSession: async (...args) => {
      appSessionCalls.push(args);
      return { cookie: "smartlingo_session=unverified; Path=/; HttpOnly; Secure; SameSite=Lax" };
    },
  }));
  assert.equal(unverified.status, 200);
  assert.deepEqual(appSessionCalls[0], [
    "user_inert",
    "member@example.com",
    false,
    "Unverified",
    "zh",
    "sess_inert",
    "LINGO_TEST",
  ]);

  for (const state of [{ banned: true }, { locked: true }]) {
    const response = await bridge.handleClerkSessionBridgeRequest(request(), dependencies({
      getClerkUser: async () => ({
        ...state,
        primaryEmailAddress: {
          emailAddress: "member@example.com",
          verification: { status: "verified" },
        },
      }),
      createAppSession: async () => assert.fail("blocked Clerk users must not create app sessions"),
    }));
    assert.equal(response.status, 401);
  }
  assert.equal(appSessionCalls.length, 1);
});

test("verification failures fail closed and log only bounded error details", async () => {
  const logs = [];
  const verificationError = Object.assign(new Error("inert verification failed"), { reason: "token-invalid" });
  const response = await bridge.handleClerkSessionBridgeRequest(request(), dependencies({
    verifyClerkToken: async () => { throw verificationError; },
    logError: details => logs.push(details),
  }));

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: "Unauthorized", code: "token-invalid" });
  assert.deepEqual(logs, [{ name: "Error", message: "inert verification failed" }]);

  const unsafeReason = Object.assign(
    new Error(`private detail\n${"x".repeat(240)}`),
    { reason: `invalid reason ${"y".repeat(80)}` },
  );
  const unsafeResponse = await bridge.handleClerkSessionBridgeRequest(request(), dependencies({
    verifyClerkToken: async () => { throw unsafeReason; },
    logError: details => logs.push(details),
  }));
  assert.deepEqual(await unsafeResponse.json(), { error: "Unauthorized", code: "verification_failed" });
  assert.equal(logs[1].name, "Error");
  assert.ok(logs[1].message.length <= 160);
  assert.doesNotMatch(logs[1].message, /[\r\n\t]/);
});

test("the production route delegates to the tested bridge with Clerk and D1 adapters", async () => {
  const route = await read("../app/api/auth/clerk-session/route.ts");
  assert.match(route, /handleClerkSessionBridgeRequest\(request/);
  assert.match(route, /verifyClerkToken: \(token, options\) => verifyToken/);
  assert.match(route, /getClerkUser: \(userId, keys\) => createClerkClient\(keys\)\.users\.getUser\(userId\)/);
  assert.match(route, /createAppSession: createSessionForClerkUser/);
  assert.doesNotMatch(route, /payload\.email|payload\.name/);
});
