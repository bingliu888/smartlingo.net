import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import {
  SMARTLINGO_LAYOUT_LANGUAGES,
  SMARTLINGO_LAYOUT_ROUTES,
  SMARTLINGO_VIEWPORTS,
  collectSmartLingoRuntimeLayout,
  findSmartLingoRuntimeLayoutIssues,
} from "../scripts/verify-runtime-layout-webkit.mjs";

const swiftSource = await readFile(new URL("../scripts/measure-runtime-layout.swift", import.meta.url), "utf8");
const runnerSource = await readFile(new URL("../scripts/verify-runtime-layout-webkit.mjs", import.meta.url), "utf8");

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
    "/classes",
    "/programs",
    "/classes/class_official_en/placement",
    "/classes/class_official_en/learn",
    "/community",
    "/messages",
    "/messages/live/layout-check",
    "/assistant",
    "/project",
    "/project/day/2026-08-02",
    "/project/report/2026-08-02",
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
    "viewportExceeds",
  ]) {
    assert.match(collectorSource, new RegExp(contract));
  }
  assert.match(runnerSource, /page-mismatch/);
  assert.match(runnerSource, /runtime-layout-failures\.json/);
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
  }).map(issue => issue.code);
  assert.ok(codes.includes("horizontal-overflow"));
  assert.ok(codes.includes("fill-surface-gap"));
  assert.ok(codes.includes("clipped-content"));
  assert.ok(codes.includes("content-overlap"));
  assert.ok(codes.includes("viewport-exceed"));
});

test("layout gate requires real page markers and representative hook categories", () => {
  for (const page of ["home", "programs", "assistant", "project", "auth"]) {
    assert.match(runnerSource, new RegExp(`\\"${page}\\"`));
  }
  assert.match(runnerSource, /requiredHooks/);
  assert.match(swiftSource, /document\.querySelector\('\[data-layout-page\]'\)/);
  assert.match(swiftSource, /WKWebsiteDataStore|websiteDataStore = \.nonPersistent\(\)/);
});

test("full release matrix uses bounded fresh-WebKit batches and one merged count", () => {
  assert.match(runnerSource, /selectedRoutes\.slice\(index, index \+ 5\)/);
  assert.match(runnerSource, /reports\.push\(\.\.\.stdout\.split/);
  assert.match(runnerSource, /expectedCount = selectedRoutes\.length \* SMARTLINGO_LAYOUT_LANGUAGES\.length \* SMARTLINGO_VIEWPORTS\.length/);
  assert.match(swiftSource, /Double\(combinationCount\) \* 5\.0/);
});
