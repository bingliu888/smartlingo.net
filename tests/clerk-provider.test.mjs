import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("each language application shell mounts inside the server-localized Clerk provider", async () => {
  const [rootLayout, languageLayout, provider] = await Promise.all([
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/[lang]/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/LocalizedClerkProvider.tsx", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(provider, /"use client"|usePathname/);
  assert.match(languageLayout, /<LocalizedClerkProvider language=\{safeLanguage\}>/);
  assert.match(provider, /<ClerkProvider localization=\{clerkLocalizations\[language\]\}>/);
  assert.match(languageLayout, /<NotificationBar\/>/);
  assert.match(languageLayout, /<FloatingAssistant\/>/);
  assert.doesNotMatch(rootLayout, /publishableKey\s*\?/);
});

test("Clerk dialogs follow all twelve SmartLingo route languages", async () => {
  const [provider, languageCatalog] = await Promise.all([
    readFile(new URL("../components/LocalizedClerkProvider.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/smartlingo-language-communities.ts", import.meta.url), "utf8"),
  ]);
  const configured = [...provider.matchAll(/^\s{2}([a-z]{2}):\s[a-zA-Z]+,$/gm)].map(match => match[1]).sort();
  const supported = [...languageCatalog.matchAll(/\{ code: "([a-z]{2})",/g)].map(match => match[1]).sort();
  assert.equal(configured.length, 12);
  assert.deepEqual(configured, supported);
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

test("the Clerk session bridge records only the exact active primary identity", async () => {
  const [route, bridge] = await Promise.all([
    readFile(new URL("../app/api/auth/clerk-session/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/clerk-session-bridge.ts", import.meta.url), "utf8"),
  ]);

  assert.match(route, /createClerkClient\(keys\)\.users\.getUser\(userId\)/);
  assert.match(bridge, /resolveActiveClerkPrimaryEmail\(clerkUser\)/);
  assert.match(bridge, /createAppSession\([\s\S]*?emailVerified/);
  assert.match(bridge, /if \(!identity\).*Unauthorized/);
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

test("Clerk synchronization keeps the subject canonical and preserves profile names", async () => {
  const auth = await readFile(
    new URL("../lib/auth.ts", import.meta.url),
    "utf8",
  );

  assert.match(auth, /rekeyLinkedClerkUser/);
  assert.match(auth, /bindVerifiedLegacyClerkUser/);
  assert.match(auth, /ON CONFLICT\(id\) DO UPDATE SET[\s\S]*?clerk_user_id=excluded\.clerk_user_id/);
  assert.doesNotMatch(auth, /DO UPDATE SET[\s\S]{0,300}display_name=excluded\.display_name/);
  assert.match(auth, /WHERE u\.id=\? AND u\.clerk_user_id=\?/);
});

test("unverified Clerk members stay subject-bound and cannot receive permanent-email privileges", async () => {
  const [auth, access, migration] = await Promise.all([
    readFile(new URL("../lib/auth.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/admin-access.ts", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0180_gold3_clerk_identity.sql", import.meta.url), "utf8"),
  ]);

  assert.match(auth, /input\.emailVerified && email === BOOTSTRAP_ADMIN_EMAIL/);
  assert.match(auth, /emailVerified \? 1 : 0/);
  assert.match(access, /user\.emailVerified === 1/);
  assert.match(access, /isBootstrapAdminEmail\(user\.email\)/);
  assert.match(migration, /VERIFIED_EMAIL_REQUIRES_FRESH_CLERK_IDENTITY/);
});

test("authorization reads the current Clerk user on every request and never trusts the compatibility cookie", async () => {
  const auth = await readFile(
    new URL("../lib/auth.ts", import.meta.url),
    "utf8",
  );

  assert.match(auth, /const clerkUser = await currentUser\(\)\.catch\(\(\) => null\)/);
  assert.match(auth, /resolveActiveClerkPrimaryEmail\(clerkUser\)/);
  assert.doesNotMatch(auth, /FROM sessions|INSERT INTO sessions|expires_at>\?/);
  assert.match(auth, /return `\$\{COOKIE_NAME\}=;[^`]*Max-Age=0`/);
});

test("anonymous session checks tolerate missing Clerk middleware context", async () => {
  const auth = await readFile(
    new URL("../lib/auth.ts", import.meta.url),
    "utf8",
  );

  assert.match(auth, /currentUser\(\)\.catch\(\(\) => null\)/);
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
