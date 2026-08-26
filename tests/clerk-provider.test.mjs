import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { clerkLocalizationLanguage, clerkLocalizationLanguages } from "../lib/clerk-localization-language.ts";

test("the application shell always mounts inside the localized Clerk provider", async () => {
  const [layout, provider] = await Promise.all([
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/LocalizedClerkProvider.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(layout, /<LocalizedClerkProvider>/);
  assert.match(provider, /<ClerkProvider localization=\{clerkLocalizations\[language\]\}>/);
  assert.doesNotMatch(layout, /publishableKey\s*\?/);
});

test("Clerk dialogs follow all twelve SmartLingo route languages", () => {
  assert.equal(clerkLocalizationLanguages.length, 12);
  for (const language of clerkLocalizationLanguages) {
    assert.equal(clerkLocalizationLanguage(`/${language}/account`), language);
  }
  assert.equal(clerkLocalizationLanguage("/r/invitation"), "en");
  assert.equal(clerkLocalizationLanguage("/xx/account"), "en");
  assert.equal(clerkLocalizationLanguage(null), "en");
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

test("the Clerk session bridge records email verification while trusting only Clerk subject and safe request metadata", async () => {
  const [route, bridge] = await Promise.all([
    readFile(new URL("../app/api/auth/clerk-session/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/clerk-session-bridge.ts", import.meta.url), "utf8"),
  ]);

  assert.match(route, /createClerkClient\(keys\)\.users\.getUser\(userId\)/);
  assert.match(bridge, /primaryEmail\?\.verification\?\.status === "verified"/);
  assert.match(bridge, /createAppSession\([\s\S]*?emailVerified/);
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
  assert.match(auth, /WHERE clerk_user_id = \? AND NOT EXISTS/);
  assert.match(auth, /UPDATE users SET clerk_user_id = \?/);
  assert.match(auth, /email_verified, display_name, password_hash, preferred_language, clerk_user_id, created_at/);
  assert.match(auth, /Unable to create or load Clerk user/);
});

test("unverified Clerk members stay subject-bound and cannot receive permanent-email privileges", async () => {
  const [auth, access, migration] = await Promise.all([
    readFile(new URL("../lib/auth.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/admin-access.ts", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0171_clerk_email_verification.sql", import.meta.url), "utf8"),
  ]);

  assert.match(auth, /const emailUser = emailVerified \?/);
  assert.match(auth, /emailVerified \? 1 : 0/);
  assert.match(access, /user\.emailVerified === 1/);
  assert.match(access, /isBootstrapAdminEmail\(user\.email\)/);
  assert.match(migration, /ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 1/);
});

test("app sessions are short-lived, Clerk-linked, and reject legacy cookies", async () => {
  const auth = await readFile(
    new URL("../lib/auth.ts", import.meta.url),
    "utf8",
  );

  assert.match(auth, /export const SESSION_SECONDS = 60 \* 60 \* 24 \* 7/);
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
