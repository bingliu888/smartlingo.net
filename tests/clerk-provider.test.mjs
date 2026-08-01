import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("the application shell always mounts inside ClerkProvider", async () => {
  const layout = await readFile(
    new URL("../app/layout.tsx", import.meta.url),
    "utf8",
  );

  assert.match(layout, /<ClerkProvider>/);
  assert.doesNotMatch(layout, /publishableKey\s*\?/);
});

test("the Clerk session bridge can verify with the production secret key", async () => {
  const [route, bridge] = await Promise.all([
    readFile(new URL("../app/api/auth/clerk-session/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/clerk-session-bridge.ts", import.meta.url), "utf8"),
  ]);

  assert.match(route, /options\.jwtKey[\s\S]*?secretKey:\s*options\.secretKey/);
  assert.match(bridge, /jwtKey\s*\?\s*\{\s*jwtKey,\s*authorizedParties\s*\}\s*:\s*\{\s*secretKey,\s*authorizedParties\s*\}/);
  assert.doesNotMatch(bridge, /!jwtKey\)\s*return Response\.json/);
});

test("the Clerk session bridge trusts only verified Clerk identity claims and safe request metadata", async () => {
  const [route, bridge] = await Promise.all([
    readFile(new URL("../app/api/auth/clerk-session/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/clerk-session-bridge.ts", import.meta.url), "utf8"),
  ]);

  assert.match(route, /createClerkClient\(keys\)\.users\.getUser\(userId\)/);
  assert.match(bridge, /primaryEmail\?\.verification\?\.status === "verified"/);
  assert.match(bridge, /clerkUser\.banned \|\| clerkUser\.locked/);
  assert.doesNotMatch(bridge, /payload\.email|payload\.name/);
  assert.match(bridge, /entries\.length !== 1 \|\| entries\[0\]\[0\] !== "language"/);
  assert.match(bridge, /const clerkSessionId = claims\.sid/);
  assert.match(bridge, /if \(!userId \|\| !clerkSessionId\)/);
});

test("the Clerk session bridge restricts authorized parties to production and safe local development", async () => {
  const bridge = await readFile(
    new URL("../lib/clerk-session-bridge.ts", import.meta.url),
    "utf8",
  );

  assert.match(bridge, /"https:\/\/smartlingo\.net"/);
  assert.match(bridge, /"https:\/\/www\.smartlingo\.net"/);
  assert.match(bridge, /publishableKey\.startsWith\("pk_test_"\)/);
  assert.match(bridge, /requestUrl\.hostname === "localhost"/);
  assert.match(bridge, /authorizedParties = clerkAuthorizedParties/);
});

test("parallel Clerk session initialization creates users idempotently", async () => {
  const auth = await readFile(
    new URL("../lib/auth.ts", import.meta.url),
    "utf8",
  );

  const inserts = auth.match(/INSERT OR IGNORE INTO users/g) ?? [];
  assert.equal(inserts.length, 1);
  assert.match(auth, /WHERE clerk_user_id = \? LIMIT 1/);
  assert.match(auth, /UPDATE users SET clerk_user_id = \?/);
  assert.match(auth, /preferred_language, clerk_user_id, created_at/);
  assert.match(auth, /Unable to create or load Clerk user/);
});

test("app sessions are short-lived, Clerk-linked, and reject legacy cookies", async () => {
  const auth = await readFile(
    new URL("../lib/auth.ts", import.meta.url),
    "utf8",
  );

  assert.match(auth, /const SESSION_SECONDS = 60 \* 60 \* 12/);
  assert.match(auth, /INSERT INTO sessions \(id, user_id, clerk_session_id, expires_at, created_at\)/);
  assert.match(auth, /DELETE FROM sessions WHERE clerk_session_id = \?/);
  assert.match(auth, /s\.clerk_session_id IS NOT NULL/);
  assert.match(auth, /return language === "en" \? "en" : "zh"/);
});

test("anonymous session checks tolerate missing Clerk middleware context", async () => {
  const auth = await readFile(
    new URL("../lib/auth.ts", import.meta.url),
    "utf8",
  );

  assert.match(auth, /process\.env\.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY/);
  assert.match(auth, /clerkUser = await currentUser\(\)/);
  assert.match(auth, /catch\s*\{\s*clerkUser = null/);
});

test("missing Clerk configuration preserves public shells and route-level authorization", async () => {
  const proxy = await readFile(
    new URL("../proxy.ts", import.meta.url),
    "utf8",
  );

  assert.match(proxy, /if \(!process\.env\.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY\) \{\s*return NextResponse\.next\(\);\s*\}/);
  assert.doesNotMatch(proxy, /PRIVATE_PAGE|IDENTITY_API|Identity service is not configured|temporarily unavailable/);
  assert.match(proxy, /return withClerk\(request, event as never\)/);
});

test("custom Clerk login supports Safari ITP and Client Trust", async () => {
  const form = await readFile(
    new URL("../components/ClerkAuthForm.tsx", import.meta.url),
    "utf8",
  );

  assert.match(form, /decorateUrl\(completePath\)/);
  assert.match(form, /status === "needs_second_factor"/);
  assert.match(form, /status === "needs_client_trust"/);
  assert.match(form, /prepareSecondFactor/);
  assert.match(form, /attemptSecondFactor/);
});

test("notifications poll only for signed-in members", async () => {
  const notifications = await readFile(
    new URL("../components/NotificationBar.tsx", import.meta.url),
    "utf8",
  );

  assert.match(notifications, /useUser\(\)/);
  assert.match(notifications, /if\s*\(!isSignedIn\)/);
  assert.match(notifications, /\[isSignedIn\]/);
  assert.match(notifications, /setNotice\(current\s*=>\s*current\s*\?\?\s*next\)/);
});
