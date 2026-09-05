import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import {
  SMARTLINGO_AUTHENTICATED_LAYOUT_ROUTES,
  SMARTLINGO_LAYOUT_LANGUAGES,
  SMARTLINGO_LAYOUT_ROUTES,
  SMARTLINGO_VIEWPORTS,
  collectSmartLingoRuntimeLayout,
  findSmartLingoRuntimeLayoutIssues,
} from "../scripts/verify-runtime-layout-webkit.mjs";

const swiftSource = await readFile(new URL("../scripts/measure-runtime-layout.swift", import.meta.url), "utf8");
const runnerSource = await readFile(new URL("../scripts/verify-runtime-layout-webkit.mjs", import.meta.url), "utf8");
const releaseSource = await readFile(new URL("../scripts/verify-runtime-layout-release.mjs", import.meta.url), "utf8");
const fixtureAuthSource = await readFile(new URL("../lib/layout-fixture-auth.ts", import.meta.url), "utf8");
const packageSource = await readFile(new URL("../package.json", import.meta.url), "utf8");

test("runtime layout matrix pins both path locales and all five required viewports", () => {
  assert.deepEqual(SMARTLINGO_LAYOUT_LANGUAGES, ["zh", "en"]);
  assert.deepEqual(SMARTLINGO_VIEWPORTS.map(({ width, height }) => [width, height]), [
    [390, 844],
    [430, 932],
    [834, 1112],
    [1194, 834],
    [1440, 1000],
  ]);
  assert.deepEqual(SMARTLINGO_LAYOUT_ROUTES, [
    "/",
    "/tutorial",
    "/classes",
    "/programs",
    "/programs/en/trial",
    "/classes/course_en_basic/learn",
    "/classes/course_en_basic/learn/session",
    "/classes/course_en_basic/vocabulary",
    "/play",
    "/play/challenge",
    "/smartcards",
    "/smartcards/starter-en",
    "/smartcards/tutorial",
    "/dashboard",
    "/messages",
    "/messages/live/layout-check",
    "/certificates",
    "/certificates/layout-certificate",
    "/admin/certificates",
    "/assistant",
    "/project",
    "/project/day/2026-08-03",
    "/project/report/2026-08-03",
    "/auth/login",
  ]);
  assert.match(swiftSource, /return "\/\\\(language\)\\\(suffix\)"/);
  assert.doesNotMatch(swiftSource, /localStorage|mahj-language/);
});

test("serialized WebKit collector covers fill, track, readable, text, clipping, overlap, and viewport geometry", () => {
  const collectorSource = collectSmartLingoRuntimeLayout.toString();
  for (const contract of [
    "data-layout-fill",
    "data-layout-track",
    "data-readable-copy",
    "data-layout-text-fit",
    "data-layout-overlap-check",
    "scrollWidth",
    "clientWidth",
    "scrollHeight",
    "clientHeight",
    "textOverflow",
    "overlaps",
    "overlapChecks",
    "viewportExceeds",
  ]) {
    assert.match(collectorSource, new RegExp(contract));
  }
  assert.match(runnerSource, /page-mismatch/);
  assert.match(runnerSource, /runtime-layout-failures\.json/);
  assert.match(runnerSource, /isInsideHorizontalScroller/);
});

test("issue detector rejects overflow, non-filling rows, clipping, overlap, and ellipsis evidence", () => {
  const report = {
    schemaVersion: 1,
    language: "zh-CN",
    viewport: { width: 390, height: 844 },
    page: {
      document: { clientWidth: 390, scrollWidth: 402 },
      body: { clientWidth: 390, scrollWidth: 390 },
    },
    fills: [{
      visible: true,
      allowedDecoration: false,
      selector: "[data-layout-fill=sample]",
      name: "sample",
      clientWidth: 350,
      scrollWidth: 350,
      rect: { left: 20, right: 370, width: 350 },
      expected: { left: 16, right: 374, width: 358 },
    }],
    tracks: [],
    readableCopy: [],
    textFits: [],
    headings: [],
    clipping: [{ selector: "textarea", clipsY: true, ellipsis: false, allowedDecoration: false }],
    overlaps: [{ first: "h2", second: "button", overlapWidth: 20, overlapHeight: 8 }],
    viewportExceeds: [{ selector: "button", rect: { left: 350, right: 410 } }],
  };
  const codes = findSmartLingoRuntimeLayoutIssues(report, {
    language: "zh",
    viewport: { width: 390, height: 844 },
    required: { overlapChecks: 1 },
  }).map(issue => issue.code);
  assert.ok(codes.includes("horizontal-overflow"));
  assert.ok(codes.includes("fill-surface-gap"));
  assert.ok(codes.includes("clipped-content"));
  assert.ok(codes.includes("content-overlap"));
  assert.ok(codes.includes("missing-layout-hooks"));
  assert.ok(codes.includes("viewport-exceed"));
});

test("layout gate requires real page markers and representative hook categories", () => {
  for (const page of ["home", "tutorial", "courses", "programs", "anonymous-trial", "learning", "learning-session", "vocabulary-memory", "smartcards", "dashboard", "messages", "live-chat", "certificates", "certificate-detail", "admin-certificates", "assistant", "project", "auth"]) {
    assert.match(runnerSource, new RegExp(`\\"${page}\\"`));
  }
  assert.match(runnerSource, /requiredHooks/);
  assert.match(swiftSource, /route\.readySelector/);
  assert.match(swiftSource, /WKWebsiteDataStore|websiteDataStore = \.nonPersistent\(\)/);
});

test("authenticated surfaces require a loopback D1-backed session and their own ready marker", () => {
  assert.deepEqual(SMARTLINGO_AUTHENTICATED_LAYOUT_ROUTES, [
    "/classes",
    "/classes/course_en_basic/learn",
    "/classes/course_en_basic/learn/session",
    "/classes/course_en_basic/vocabulary",
    "/dashboard",
    "/messages",
    "/messages/live/layout-check",
    "/certificates",
    "/certificates/layout-certificate",
    "/admin/certificates",
  ]);
  assert.match(runnerSource, /session cookies are allowed only for a loopback layout fixture/);
  assert.match(runnerSource, /authenticated layout routes require --session-cookie-file backed by an ephemeral local D1 session/);
  assert.doesNotMatch(runnerSource, /argv\[index\] === "--session-cookie"/);
  assert.match(runnerSource, /SMARTLINGO_AUTHENTICATED_LAYOUT_ROUTES\.includes\(route\)/);
  assert.match(runnerSource, /five-skill-workspace/);
  assert.match(swiftSource, /httpCookieStore/);
  assert.match(swiftSource, /cookieStore\.setCookie/);
  assert.match(swiftSource, /smartlingo_session/);
  assert.match(swiftSource, /\.originURL: baseURL/);
  assert.match(swiftSource, /HTTPCookiePropertyKey\("HttpOnly"\)/);
  assert.match(swiftSource, /!\$0\.isSecure/);
  assert.doesNotMatch(swiftSource, /\.secure:/);
  assert.match(swiftSource, /url\.scheme != baseScheme/);
  assert.match(swiftSource, /url\.host != baseHost/);
  assert.match(swiftSource, /port != basePort/);
  assert.match(releaseSource, /randomBytes\(32\)\.toString\("base64url"\)/);
  assert.match(releaseSource, /createHash\("sha256"\)\.update\(token\)\.digest\("base64"\)/);
  assert.match(releaseSource, /mkdtemp\(join\(tmpdir\(\), "smartlingo-layout-release-"\)\)/);
  assert.match(releaseSource, /const allowedEnvironmentKeys = \[/);
  assert.match(releaseSource, /Object\.fromEntries\(allowedEnvironmentKeys/);
  assert.doesNotMatch(releaseSource, /\.\.\.process\.env/);
  assert.match(releaseSource, /const common = \["--local", "--persist-to", state, "--config", config\]/);
  assert.doesNotMatch(releaseSource, /--remote/);
  assert.match(releaseSource, /database_id: "00000000-0000-4000-8000-000000000001"/);
  assert.match(releaseSource, /vars: \{ SMARTLINGO_RUNTIME_LAYOUT_FIXTURE_TOKEN: token \}/);
  assert.match(releaseSource, /'layout-user',unixepoch\(\),'admin'/);
  assert.match(releaseSource, /'layout-peer',unixepoch\(\),'member'/);
  assert.doesNotMatch(releaseSource, /\broutes:/);
  assert.match(releaseSource, /WRANGLER_SEND_METRICS: "false"/);
  assert.match(releaseSource, /WRANGLER_REGISTRY_PATH: join\(work, "registry"\)/);
  assert.match(releaseSource, /CLOUDFLARE_INCLUDE_PROCESS_ENV: "false"/);
  assert.match(releaseSource, /writeFile\(sessionCookieFile, `\$\{token\}\\n`, \{ mode: 0o600 \}\)/);
  assert.match(releaseSource, /"--session-cookie-file", sessionCookieFile/);
  assert.doesNotMatch(releaseSource, /"--session-cookie", token/);
  assert.match(releaseSource, /'layout-placement-active'/);
  assert.match(releaseSource, /'layout-en-subscription'[^\n]+4102444800,4102444800/);
  assert.match(releaseSource, /'layout-es-subscription'[^\n]+4102444800,4102444800/);
  assert.match(releaseSource, /anonymous page control failed/);
  assert.match(releaseSource, /anonymous API control failed/);
  assert.match(releaseSource, /public-read API control failed/);
  assert.match(releaseSource, /const publicReadApis = \[/);
  assert.match(releaseSource, /rm\(work, \{ recursive: true, force: true \}\)/);
  assert.match(packageSource, /"validate:layout": "node scripts\/verify-runtime-layout-release\.mjs"/);
  assert.match(fixtureAuthSource, /SMARTLINGO_RUNTIME_LAYOUT_FIXTURE_TOKEN/);
  assert.match(fixtureAuthSource, /hostname !== "127\.0\.0\.1" && hostname !== "localhost"/);
  assert.match(fixtureAuthSource, /sameSecret\(suppliedToken, expectedToken\)/);
  assert.match(fixtureAuthSource, /u\.id=u\.clerk_user_id AND u\.email_verified=1/);
  assert.match(fixtureAuthSource, /s\.expires_at>\?/);
  assert.doesNotMatch(fixtureAuthSource, /process\.env/);
});

test("full release matrix uses bounded fresh-WebKit batches and one merged count", () => {
  assert.match(runnerSource, /selectedRoutes\.slice\(index, index \+ 5\)/);
  assert.match(runnerSource, /runWebKitBatch\(executable, configPath\)/);
  assert.match(runnerSource, /attempt < 3/);
  assert.match(runnerSource, /Connection Invalid error for service/);
  assert.match(runnerSource, /reports\.push\(\.\.\.stdout\.split/);
  assert.match(runnerSource, /expectedCount = selectedRoutes\.length \* SMARTLINGO_LAYOUT_LANGUAGES\.length \* SMARTLINGO_VIEWPORTS\.length/);
  assert.match(runnerSource, /code: "path-mismatch"/);
  assert.match(runnerSource, /required: \{ overlapChecks: 1/);
  assert.match(swiftSource, /Double\(combinationCount\) \* 5\.0/);
  assert.match(releaseSource, /SMARTLINGO_LAYOUT_ROUTES\.length/);
  assert.match(releaseSource, /SMARTLINGO_LAYOUT_LANGUAGES\.length/);
  assert.match(releaseSource, /SMARTLINGO_VIEWPORTS\.length/);
  assert.doesNotMatch(releaseSource, /270\/270/);
});
