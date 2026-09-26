import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { restoreLayoutSchemaCache, saveLayoutSchemaCache } from "../scripts/layout-schema-cache.mjs";
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
const everydayCss = await readFile(new URL("../app/[lang]/play/everyday/everyday.css", import.meta.url), "utf8");
const maxTutorSource = await readFile(new URL("../app/[lang]/max/tutor/page.tsx", import.meta.url), "utf8");

test("WebKit schema cache holds only a migration snapshot, never a generated session", async () => {
  const work = await mkdtemp(join(tmpdir(), "smartlingo-layout-cache-test-"));
  const cache = join(work, "cache");
  const migrated = join(work, "migrated");
  const restored = join(work, "restored");
  const fingerprint = "verified-migrations";
  try {
    await mkdir(join(migrated, "v3", "d1"), { recursive: true });
    await writeFile(join(migrated, "v3", "d1", "schema.sqlite"), "migrated schema");
    await saveLayoutSchemaCache(cache, migrated, fingerprint);
    await writeFile(join(migrated, "v3", "d1", "session.sqlite"), "ephemeral login");
    assert.deepEqual((await readdir(join(cache, "d1"))), ["schema.sqlite"]);
    assert.equal(await restoreLayoutSchemaCache(cache, restored, fingerprint), true);
    assert.deepEqual((await readdir(join(restored, "v3", "d1"))), ["schema.sqlite"]);
    assert.equal(await restoreLayoutSchemaCache(cache, join(work, "stale"), "changed-migrations"), false);
    await rm(join(cache, "migration-fingerprint"));
    assert.equal(await restoreLayoutSchemaCache(cache, join(work, "partial"), fingerprint), false);
  } finally {
    await rm(work, { recursive: true, force: true });
  }
});

test("release runner inserts the randomized fixture only after cache creation", () => {
  const restore = releaseSource.indexOf("restoreLayoutSchemaCache(schemaCacheDirectory, state, schemaFingerprint)");
  const migrate = releaseSource.indexOf('"migrations", "apply", "DB"');
  const save = releaseSource.indexOf("saveLayoutSchemaCache(schemaCacheDirectory, state, schemaFingerprint)");
  const fixture = releaseSource.indexOf('"execute", "DB", ...common, "--file", fixture');
  assert.ok(restore > 0 && restore < migrate && migrate < save && save < fixture);
});

test("runtime layout matrix pins both path locales and a short landscape lesson viewport", () => {
  assert.match(maxTutorSource, /data-layout-page="max-tutor" data-layout-ready="true"/);
  assert.deepEqual(SMARTLINGO_LAYOUT_LANGUAGES, ["zh", "en"]);
  assert.deepEqual(SMARTLINGO_VIEWPORTS.map(({ width, height }) => [width, height]), [
    [390, 844],
    [430, 932],
    [820, 1180],
    [1180, 820],
    [1440, 900],
  ]);
  assert.deepEqual(SMARTLINGO_LAYOUT_ROUTES, [
    "/",
    "/flash",
    "/max",
    "/max/tutor?language=ja",
    "/programs/en?path=flash",
    "/programs/en?path=max",
    "/tutorial",
    "/classes",
    "/programs",
    "/programs/en/trial",
    "/classes/course_en_basic/learn",
    "/classes/course_en_basic/learn/session",
    "/classes/course_en_basic/vocabulary",
    "/play",
    "/play/everyday?language=en&scene=grocery&level=beginner",
    "/play/challenge",
    "/smartcards",
    "/smartcards/starter-en",
    "/smartcards/tutorial",
    "/dashboard",
    "/messages",
    "/messages/live/layout-check",
    "/certificates",
    "/certificates/layout-certificate",
    "/admin/members",
    "/admin/certificates",
    "/assistant",
    "/project",
    "/project/day/2026-08-03",
    "/project/report/2026-08-03",
    "/auth/login",
  ]);
  assert.match(swiftSource, /return "\/\\\(language\)\\\(suffix\)"/);
  assert.match(swiftSource, /viewportIndex < config\.viewports\.count \{[\s\S]*webView\.reload\(\)/);
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

test("learning page content aligns with the shared header at every viewport", () => {
  const report = {
    schemaVersion: 1,
    pageName: "home",
    viewport: { width: 1180, height: 820 },
    page: {
      document: { clientWidth: 1180, scrollWidth: 1180 },
      body: { clientWidth: 1180, scrollWidth: 1180 },
    },
    learningShellAlignment: {
      headerContent: { left: 56, right: 1124 },
      shellContent: { left: 20, right: 1160 },
    },
  };
  assert.ok(findSmartLingoRuntimeLayoutIssues(report).some(issue => issue.code === "entry-shell-misalignment"));
  report.learningShellAlignment.shellContent = { left: 56, right: 1124 };
  assert.ok(!findSmartLingoRuntimeLayoutIssues(report).some(issue => issue.code === "entry-shell-misalignment"));
});

test("Max tutor layout rejects a loaded but zero-width selected portrait", () => {
  const report = {
    schemaVersion: 1,
    pageName: "max-tutor",
    page: { document: { clientWidth: 1180, scrollWidth: 1180 }, body: { clientWidth: 1180, scrollWidth: 1180 } },
    tutorPortrait: {
      naturalWidth: 1024,
      naturalHeight: 1024,
      objectFit: "contain",
      image: { left: 590, right: 590, width: 0, height: 380 },
      stage: { left: 120, right: 1060, width: 940, height: 380 },
    },
  };
  assert.ok(findSmartLingoRuntimeLayoutIssues(report).some(issue => issue.code === "hidden-tutor-portrait"));
  report.tutorPortrait.image = { left: 400, right: 780, width: 380, height: 380 };
  assert.ok(!findSmartLingoRuntimeLayoutIssues(report).some(issue => issue.code === "hidden-tutor-portrait"));
  assert.ok(!findSmartLingoRuntimeLayoutIssues(report).some(issue => issue.code === "off-center-tutor-portrait"));
  report.tutorPortrait.image = { left: 120, right: 500, width: 380, height: 380 };
  assert.ok(findSmartLingoRuntimeLayoutIssues(report).some(issue => issue.code === "off-center-tutor-portrait"));
});

test("landscape Everyday Speaking keeps instructions through actions within one viewport", () => {
  assert.match(everydayCss, /\.everyday-player \.everyday-stage\{height:260px;min-height:0;max-height:260px/);
  const report = {
    schemaVersion: 1,
    pageName: "everyday-player",
    language: "zh-CN",
    viewport: { width: 1180, height: 820 },
    page: {
      document: { clientWidth: 1180, scrollWidth: 1180 },
      body: { clientWidth: 1180, scrollWidth: 1180 },
    },
    lessonFit: { height: 830, viewportHeight: 820 },
    sceneCopyFit: { topInset: 18, bottomInset: 18 },
  };
  assert.ok(findSmartLingoRuntimeLayoutIssues(report).some(issue => issue.code === "landscape-lesson-scroll"));
  report.lessonFit.height = 780;
  assert.ok(!findSmartLingoRuntimeLayoutIssues(report).some(issue => issue.code === "landscape-lesson-scroll"));
  report.sceneCopyFit.topInset = 0;
  assert.ok(findSmartLingoRuntimeLayoutIssues(report).some(issue => issue.code === "landscape-scene-content-clipped"));
  report.sceneCopyFit = { topInset: 18, bottomInset: 18 };
  assert.ok(!findSmartLingoRuntimeLayoutIssues(report).some(issue => issue.code === "landscape-scene-content-clipped"));
});

test("header wordmark keeps Smart and Lingo on one baseline", () => {
  const report = {
    schemaVersion: 1,
    page: { document: { clientWidth: 1180, scrollWidth: 1180 }, body: { clientWidth: 1180, scrollWidth: 1180 } },
    wordmark: { first: { top: 170 }, second: { top: 190 } },
  };
  assert.ok(findSmartLingoRuntimeLayoutIssues(report).some(issue => issue.code === "wordmark-wrap"));
  report.wordmark.second.top = 170;
  assert.ok(!findSmartLingoRuntimeLayoutIssues(report).some(issue => issue.code === "wordmark-wrap"));
});

test("homepage type scale remains restrained on phone, tablet, and desktop", () => {
  const report = {
    schemaVersion: 1,
    pageName: "home",
    page: { document: { clientWidth: 1180, scrollWidth: 1180 }, body: { clientWidth: 1180, scrollWidth: 1180 } },
    homeTypography: { title: 76, intro: 20, path: 60, guru: 30 },
  };
  assert.equal(findSmartLingoRuntimeLayoutIssues(report).filter(issue => issue.code === "home-type-scale").length, 4);
  report.homeTypography = { title: 47.2, intro: 16, path: 31.86, guru: 23.6 };
  assert.ok(!findSmartLingoRuntimeLayoutIssues(report).some(issue => issue.code === "home-type-scale"));
});

test("layout gate requires real page markers and representative hook categories", () => {
  for (const page of ["home", "tutorial", "courses", "programs", "anonymous-trial", "learning", "learning-session", "vocabulary-memory", "smartcards", "dashboard", "messages", "live-chat", "certificates", "certificate-detail", "admin-members", "admin-certificates", "assistant", "project", "auth"]) {
    assert.match(runnerSource, new RegExp(`\\"${page}\\"`));
  }
  assert.match(runnerSource, /requiredHooks/);
  assert.match(swiftSource, /route\.readySelector/);
  assert.match(swiftSource, /WKWebsiteDataStore|websiteDataStore = \.nonPersistent\(\)/);
});

test("authenticated surfaces require a loopback D1-backed session and their own ready marker", () => {
  assert.deepEqual(SMARTLINGO_AUTHENTICATED_LAYOUT_ROUTES, [
    "/classes",
    "/max",
    "/max/tutor?language=ja",
    "/programs/en?path=max",
    "/classes/course_en_basic/learn",
    "/classes/course_en_basic/learn/session",
    "/classes/course_en_basic/vocabulary",
    "/dashboard",
    "/messages",
    "/messages/live/layout-check",
    "/certificates",
    "/certificates/layout-certificate",
    "/admin/members",
    "/admin/certificates",
  ]);
  assert.match(runnerSource, /session cookies are allowed only for a loopback layout fixture/);
  assert.match(runnerSource, /authenticated layout routes require --session-cookie-file backed by an ephemeral local D1 session/);
  assert.doesNotMatch(runnerSource, /argv\[index\] === "--session-cookie"/);
  assert.match(runnerSource, /route === "\/max\/tutor\?language=ja"\s*\? "\.max-live-tutor-photo"/);
  assert.doesNotMatch(runnerSource, /data-layout-start-tutor/);
  assert.match(runnerSource, /element\.closest\("details:not\(\[open\]\) > :not\(summary\)"\)/);
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
  assert.match(releaseSource, /'layout-user',unixepoch\(\)\+3600,'admin'/);
  assert.match(releaseSource, /'layout-peer',unixepoch\(\)\+3600,'member'/);
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
  assert.match(releaseSource, /uniqueRoutes\.slice\(index, index \+ 10\)/);
  assert.match(releaseSource, /for \(let attempt = 1; attempt <= 3; attempt \+= 1\)/);
  assert.match(releaseSource, /for \(let attempt = 1; attempt <= 3; attempt \+= 1\) \{\s+const port = await freePort\(\)/);
  assert.match(releaseSource, /const transientWorkerFailure = \/Could not connect to the server/);
  assert.match(releaseSource, /if \(!transientWorkerFailure \|\| attempt === 3\)/);
  assert.match(releaseSource, /protectedPages\.slice\(index, index \+ 4\)\.map/);
  assert.match(releaseSource, /protectedApis\.slice\(index, index \+ 4\)\.map/);
  assert.match(releaseSource, /"--harness-executable", harnessExecutable/);
  assert.match(runnerSource, /options\.harnessExecutable \|\| join\(work, "smartlingo-runtime-layout-webkit"\)/);
  assert.match(runnerSource, /if \(!alreadyCompiled\)/);
  assert.match(releaseSource, /await stopChild\(worker\);\s*worker = null/);
  assert.match(releaseSource, /verifiedLayoutCount !== expectedLayoutCount/);
  assert.match(releaseSource, /Worker diagnostics:/);
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
  assert.match(swiftSource, /Double\(combinationCount\) \* 12\.0/);
  assert.match(releaseSource, /selectedRoutes\.length \? \[\.\.\.new Set\(selectedRoutes\)\] : SMARTLINGO_LAYOUT_ROUTES/);
  assert.match(releaseSource, /SMARTLINGO_LAYOUT_LANGUAGES\.length/);
  assert.match(releaseSource, /SMARTLINGO_VIEWPORTS\.length/);
  assert.doesNotMatch(releaseSource, /270\/270/);
});
