#!/usr/bin/env node

import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawn } from "node:child_process";

export const SMARTLINGO_VIEWPORTS = Object.freeze([
  Object.freeze({ id: "phone-390x844", width: 390, height: 844 }),
  Object.freeze({ id: "phone-430x932", width: 430, height: 932 }),
  Object.freeze({ id: "tablet-834x1112", width: 834, height: 1112 }),
  Object.freeze({ id: "landscape-1194x834", width: 1194, height: 834 }),
  Object.freeze({ id: "desktop-1440x1000", width: 1440, height: 1000 }),
]);

export const SMARTLINGO_LAYOUT_LANGUAGES = Object.freeze(["zh", "en"]);

export const SMARTLINGO_LAYOUT_ROUTES = Object.freeze([
  "/",
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

export const SMARTLINGO_AUTHENTICATED_LAYOUT_ROUTES = Object.freeze([
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

const expectedPageNames = Object.freeze({
  "/": "home",
  "/classes": "classes",
  "/programs": "programs",
  "/programs/en/trial": "anonymous-trial",
  "/classes/course_en_basic/learn": "learning",
  "/classes/course_en_basic/learn/session": "learning-session",
  "/classes/course_en_basic/vocabulary": "vocabulary-memory",
  "/play": "play",
  "/play/challenge": "play",
  "/smartcards": "smartcards",
  "/smartcards/starter-en": "smartcards",
  "/smartcards/tutorial": "smartcards",
  "/dashboard": "dashboard",
  "/messages": "messages",
  "/messages/live/layout-check": "live-chat",
  "/certificates": "certificates",
  "/certificates/layout-certificate": "certificate-detail",
  "/admin/certificates": "admin-certificates",
  "/assistant": "assistant",
  "/project": "project",
  "/project/day/2026-08-03": "project",
  "/project/report/2026-08-03": "project",
  "/auth/login": "auth",
});

const requiredHooks = Object.freeze({
  "/": { fills: 1, tracks: 1, readableCopy: 1, textFits: 1 },
  "/classes": {},
  "/programs": { fills: 2, tracks: 2, readableCopy: 1, textFits: 1 },
  "/programs/en/trial": { fills: 3, readableCopy: 1, textFits: 1 },
  "/classes/course_en_basic/learn": { fills: 2, readableCopy: 1, textFits: 1 },
  "/classes/course_en_basic/learn/session": { fills: 3, readableCopy: 1, textFits: 1 },
  "/classes/course_en_basic/vocabulary": {},
  "/play": {},
  "/play/challenge": {},
  "/smartcards": {},
  "/smartcards/starter-en": {},
  "/smartcards/tutorial": {},
  "/dashboard": {},
  "/messages": { fills: 1, textFits: 1 },
  "/messages/live/layout-check": { fills: 1, textFits: 1 },
  "/certificates": { fills: 1 },
  "/certificates/layout-certificate": { fills: 1 },
  "/admin/certificates": { fills: 1 },
  "/assistant": { fills: 2, readableCopy: 1 },
  "/project": { fills: 2, tracks: 1, readableCopy: 1, textFits: 1 },
  "/project/day/2026-08-03": { fills: 1, tracks: 1, readableCopy: 1, textFits: 1 },
  "/project/report/2026-08-03": { fills: 2, tracks: 2, readableCopy: 1, textFits: 1 },
  "/auth/login": { fills: 1, tracks: 1, readableCopy: 1, textFits: 1 },
});

/**
 * Collect final WebKit geometry. All helpers stay inside the function so its
 * source can be serialized and evaluated without module state.
 */
export function collectSmartLingoRuntimeLayout(options = {}) {
  const tolerance = Number.isFinite(options.tolerance) ? options.tolerance : 1.25;
  const root = document.documentElement;
  const body = document.body;
  const number = value => {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const pixelValue = value => {
    if (typeof value !== "string" || !/^-?\d+(?:\.\d+)?px$/.test(value.trim())) return null;
    return Number.parseFloat(value);
  };
  const rectValue = rect => ({
    left: rect.left,
    right: rect.right,
    top: rect.top,
    bottom: rect.bottom,
    width: rect.width,
    height: rect.height,
  });
  const selectorFor = element => {
    if (element === root) return "html";
    if (element === body) return "body";
    if (element.id) return `#${element.id}`;
    for (const attribute of [
      "data-layout-fill",
      "data-layout-track",
      "data-readable-copy",
      "data-layout-text-fit",
      "data-layout-page",
      "data-layout-overlap-check",
    ]) {
      if (element.hasAttribute(attribute)) return `[${attribute}="${element.getAttribute(attribute)}"]`;
    }
    const classes = Array.from(element.classList || []).slice(0, 2);
    return `${element.localName}${classes.length ? `.${classes.join(".")}` : ""}`;
  };
  const isVisible = (element, style = getComputedStyle(element), rect = element.getBoundingClientRect()) => (
    style.display !== "none"
    && style.visibility !== "hidden"
    && Number(style.opacity || 1) !== 0
    && rect.width > 0
    && rect.height > 0
  );
  const allowsDecorativeClipping = element => Boolean(
    element.closest('[data-layout-allow-clipping="decoration"]'),
  );
  const allowsOverlap = element => Boolean(
    element.closest('[data-layout-allow-overlap="intentional"]'),
  );
  const contentBox = element => {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    const borderLeft = number(style.borderLeftWidth);
    const borderRight = number(style.borderRightWidth);
    const borderTop = number(style.borderTopWidth);
    const borderBottom = number(style.borderBottomWidth);
    const paddingLeft = number(style.paddingLeft);
    const paddingRight = number(style.paddingRight);
    const paddingTop = number(style.paddingTop);
    const paddingBottom = number(style.paddingBottom);
    const rectWidth = Math.max(0, rect.width - borderLeft - borderRight - paddingLeft - paddingRight);
    const clientWidth = Math.max(0, element.clientWidth - paddingLeft - paddingRight);
    const rectHeight = Math.max(0, rect.height - borderTop - borderBottom - paddingTop - paddingBottom);
    const clientHeight = Math.max(0, element.clientHeight - paddingTop - paddingBottom);
    const width = Math.min(rectWidth, clientWidth || rectWidth);
    const height = Math.min(rectHeight, clientHeight || rectHeight);
    const left = rect.left + borderLeft + paddingLeft;
    const top = rect.top + borderTop + paddingTop;
    return { left, right: left + width, top, bottom: top + height, width, height };
  };
  const resolvedGridTracks = (style, parentBox) => {
    const template = String(style.gridTemplateColumns || "").replace(/\[[^\]]*\]/g, " ");
    if (!template || template === "none" || template === "subgrid") return [];
    const matches = template.match(/-?\d+(?:\.\d+)?px/g) || [];
    const widths = matches.map(value => Number.parseFloat(value)).filter(value => value >= 0);
    if (!widths.length) return [];
    const gap = number(style.columnGap);
    const resolved = widths.reduce((sum, width) => sum + width, 0) + gap * Math.max(0, widths.length - 1);
    if (Math.abs(resolved - parentBox.width) > Math.max(2.5, tolerance * 2)) return [];
    let left = parentBox.left;
    return widths.map(width => {
      const track = { left, right: left + width, width };
      left += width + gap;
      return track;
    });
  };
  const assignedTrackBox = element => {
    const parent = element.parentElement;
    if (!parent) return null;
    const parentStyle = getComputedStyle(parent);
    const parentBox = contentBox(parent);
    const rect = element.getBoundingClientRect();
    if (parentStyle.display.includes("grid")) {
      const tracks = resolvedGridTracks(parentStyle, parentBox);
      const intersecting = tracks.filter(track => (
        rect.right > track.left + tolerance && rect.left < track.right - tolerance
      ));
      if (intersecting.length) {
        const left = intersecting[0].left;
        const right = intersecting.at(-1).right;
        return { left, right, width: right - left, source: "grid-track" };
      }
    }
    return { left: parentBox.left, right: parentBox.right, width: parentBox.width, source: "parent-content" };
  };
  const computedSummary = style => ({
    display: style.display,
    position: style.position,
    width: style.width,
    inlineSize: style.inlineSize,
    maxWidth: style.maxWidth,
    maxInlineSize: style.maxInlineSize,
    justifySelf: style.justifySelf,
    overflowX: style.overflowX,
    overflowY: style.overflowY,
    textOverflow: style.textOverflow,
    whiteSpace: style.whiteSpace,
    transform: style.transform,
  });
  const textBounds = element => {
    if (typeof document.createRange !== "function" || !element.textContent?.trim()) return null;
    const range = document.createRange();
    range.selectNodeContents(element);
    const rect = range.getBoundingClientRect();
    return rect.width || rect.height ? rectValue(rect) : null;
  };
  const measureHook = (element, kind) => {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    const parent = element.parentElement;
    const expected = kind === "track" ? assignedTrackBox(element) : (parent ? contentBox(parent) : null);
    return {
      kind,
      name: element.getAttribute(kind === "fill" ? "data-layout-fill" : "data-layout-track") || selectorFor(element),
      selector: selectorFor(element),
      parent: parent ? selectorFor(parent) : null,
      visible: isVisible(element, style, rect),
      allowedDecoration: allowsDecorativeClipping(element),
      rect: rectValue(rect),
      expected,
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
      computed: computedSummary(style),
    };
  };
  const measureTextFit = element => {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    const ownBox = contentBox(element);
    const box = style.display === "inline" && element.parentElement ? contentBox(element.parentElement) : ownBox;
    const bounds = textBounds(element);
    const boundsOverflow = Boolean(bounds && (
      bounds.left < box.left - tolerance || bounds.right > box.right + tolerance
    ));
    const clientWidth = element.clientWidth || box.width;
    const scrollWidth = element.scrollWidth || bounds?.width || clientWidth;
    return {
      name: element.getAttribute("data-layout-text-fit") || selectorFor(element),
      selector: selectorFor(element),
      visible: isVisible(element, style, rect),
      allowedDecoration: allowsDecorativeClipping(element),
      rect: rectValue(rect),
      contentBox: box,
      textBounds: bounds,
      clientWidth,
      scrollWidth,
      boundsOverflow,
      computed: computedSummary(style),
    };
  };

  const fills = Array.from(document.querySelectorAll("[data-layout-fill]"), element => measureHook(element, "fill"));
  const tracks = Array.from(document.querySelectorAll("[data-layout-track]"), element => measureHook(element, "track"));
  const readableCopy = Array.from(document.querySelectorAll("[data-readable-copy]"), element => {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    const parent = element.parentElement;
    return {
      name: element.getAttribute("data-readable-copy") || selectorFor(element),
      selector: selectorFor(element),
      visible: isVisible(element, style, rect),
      rect: rectValue(rect),
      parentContent: parent ? contentBox(parent) : null,
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
      isFillSurface: element.hasAttribute("data-layout-fill"),
      isTrackSurface: element.hasAttribute("data-layout-track"),
      computed: computedSummary(style),
    };
  });
  const textFits = Array.from(document.querySelectorAll("[data-layout-text-fit]"), measureTextFit);
  const headings = Array.from(document.querySelectorAll("h1,h2,h3"), element => {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    const parent = element.parentElement;
    const parentContent = parent ? contentBox(parent) : null;
    const owner = element.closest("[data-layout-fill],[data-layout-track]");
    const bounds = textBounds(element);
    const box = contentBox(element);
    const boundsOverflow = Boolean(bounds && (
      bounds.left < box.left - tolerance || bounds.right > box.right + tolerance
    ));
    const maxInlineSize = pixelValue(style.maxInlineSize) ?? pixelValue(style.maxWidth);
    const constrained = Boolean(
      parentContent
      && style.display !== "inline"
      && rect.width + tolerance < parentContent.width
      && (maxInlineSize !== null || ["fit-content", "max-content", "min-content"].includes(style.width)),
    );
    return {
      selector: selectorFor(element),
      visible: isVisible(element, style, rect),
      tracked: Boolean(owner),
      allowConstraint: element.getAttribute("data-layout-heading-constraint") === "intentional",
      allowedDecoration: allowsDecorativeClipping(element),
      rect: rectValue(rect),
      parentContent,
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
      textBounds: bounds,
      boundsOverflow,
      constrained,
      computed: computedSummary(style),
    };
  });

  const clipping = [];
  const viewportExceeds = [];
  const keySelector = "[data-layout-fill],[data-layout-track],[data-readable-copy],[data-layout-text-fit],[data-layout-overlap-check],h1,h2,h3,a,button,input,textarea,select,[role='button']";
  const keyElements = new Set(document.querySelectorAll(keySelector));
  for (const element of keyElements) {
    if (element.getAttribute("aria-hidden") === "true" || element.classList.contains("sr-only")) continue;
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    if (!isVisible(element, style, rect)) continue;
    const actualOverflowX = element.scrollWidth > element.clientWidth + tolerance;
    const actualOverflowY = element.scrollHeight > element.clientHeight + tolerance;
    const clipsX = ["hidden", "clip"].includes(style.overflowX) && actualOverflowX;
    const clipsY = ["hidden", "clip"].includes(style.overflowY) && actualOverflowY;
    const ellipsis = style.textOverflow === "ellipsis" && actualOverflowX;
    const allowedDecoration = allowsDecorativeClipping(element);
    if (clipsX || clipsY || ellipsis) {
      clipping.push({
        selector: selectorFor(element),
        clipsX,
        clipsY,
        ellipsis,
        allowedDecoration,
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
        clientHeight: element.clientHeight,
        scrollHeight: element.scrollHeight,
        computed: computedSummary(style),
      });
    }
    if (!allowedDecoration
      && !["absolute", "fixed"].includes(style.position)
      && (rect.left < -tolerance || rect.right > root.clientWidth + tolerance)) {
      viewportExceeds.push({ selector: selectorFor(element), rect: rectValue(rect) });
    }
  }

  const overlaps = [];
  const overlapChecks = [];
  const overlapCandidates = new Set(document.querySelectorAll([
    "[data-layout-overlap-check]",
    "[data-layout-fill] > :not(style):not(script):not(template):not(link):not(meta)",
    "[data-layout-track] > :not(style):not(script):not(template):not(link):not(meta)",
  ].join(",")));
  const overlapIds = new Map(Array.from(overlapCandidates, (element, index) => [element, index]));
  const checkedPairs = new Set();
  const checkOverlapPair = (leftElement, rightElement) => {
    if (leftElement === rightElement
      || leftElement.contains(rightElement)
      || rightElement.contains(leftElement)
      || allowsOverlap(leftElement)
      || allowsOverlap(rightElement)) return;
    if (!overlapIds.has(leftElement)) overlapIds.set(leftElement, overlapIds.size);
    if (!overlapIds.has(rightElement)) overlapIds.set(rightElement, overlapIds.size);
    const leftId = overlapIds.get(leftElement);
    const rightId = overlapIds.get(rightElement);
    const pairKey = leftId < rightId ? `${leftId}:${rightId}` : `${rightId}:${leftId}`;
    if (checkedPairs.has(pairKey)) return;
    checkedPairs.add(pairKey);
    const leftStyle = getComputedStyle(leftElement);
    const rightStyle = getComputedStyle(rightElement);
    const leftRect = leftElement.getBoundingClientRect();
    const rightRect = rightElement.getBoundingClientRect();
    if (!isVisible(leftElement, leftStyle, leftRect) || !isVisible(rightElement, rightStyle, rightRect)) return;
    const overlapWidth = Math.min(leftRect.right, rightRect.right) - Math.max(leftRect.left, rightRect.left);
    const overlapHeight = Math.min(leftRect.bottom, rightRect.bottom) - Math.max(leftRect.top, rightRect.top);
    const measurement = {
      first: selectorFor(leftElement),
      second: selectorFor(rightElement),
      visible: true,
      overlapWidth,
      overlapHeight,
      firstRect: rectValue(leftRect),
      secondRect: rectValue(rightRect),
    };
    overlapChecks.push(measurement);
    if (overlapWidth > tolerance && overlapHeight > tolerance) overlaps.push(measurement);
  };
  const siblingGroups = new Map();
  for (const element of overlapCandidates) {
    const parent = element.parentElement;
    if (!parent) continue;
    if (!siblingGroups.has(parent)) siblingGroups.set(parent, []);
    siblingGroups.get(parent).push(element);
  }
  for (const elements of siblingGroups.values()) {
    for (let leftIndex = 0; leftIndex < elements.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < elements.length; rightIndex += 1) {
        checkOverlapPair(elements[leftIndex], elements[rightIndex]);
      }
    }
  }
  const floatingCandidates = Array.from(keyElements).filter(element => {
    const position = getComputedStyle(element).position;
    return position === "fixed" || position === "sticky" || position === "absolute";
  });
  for (const floating of floatingCandidates) {
    for (const element of keyElements) checkOverlapPair(floating, element);
  }

  return {
    schemaVersion: 1,
    url: window.location.href,
    route: options.route || window.location.pathname,
    language: root.lang || "",
    pageName: document.querySelector("[data-layout-page]")?.getAttribute("data-layout-page") || "",
    viewport: { width: window.innerWidth, height: window.innerHeight },
    page: {
      document: { clientWidth: root.clientWidth, scrollWidth: root.scrollWidth },
      body: { clientWidth: body.clientWidth, scrollWidth: body.scrollWidth },
    },
    fills,
    tracks,
    readableCopy,
    textFits,
    headings,
    clipping,
    overlapChecks,
    overlaps,
    viewportExceeds,
  };
}

export function findSmartLingoRuntimeLayoutIssues(report, options = {}) {
  const tolerance = Number.isFinite(options.tolerance) ? options.tolerance : 1.25;
  const issues = [];
  const add = (code, selector, message, actual, expected) => {
    issues.push({ code, selector, message, actual, expected });
  };
  const overflow = (label, metrics, allowedDecoration = false) => {
    if (allowedDecoration) return;
    if (!metrics || !Number.isFinite(metrics.clientWidth) || !Number.isFinite(metrics.scrollWidth)) {
      add("invalid-measurement", label, "missing browser clientWidth/scrollWidth measurements");
    } else if (metrics.scrollWidth > metrics.clientWidth + tolerance) {
      add("horizontal-overflow", label, `${label} scrollWidth exceeds clientWidth`, metrics.scrollWidth, metrics.clientWidth);
    }
  };

  if (!report || report.schemaVersion !== 1) {
    return [{ code: "invalid-report", selector: "report", message: "unsupported SmartLingo runtime-layout report" }];
  }
  overflow("documentElement", report.page?.document);
  overflow("body", report.page?.body);
  if (options.viewport && (
    report.viewport?.width !== options.viewport.width || report.viewport?.height !== options.viewport.height
  )) {
    add("viewport-mismatch", "window", "browser viewport does not match the requested viewport", report.viewport, options.viewport);
  }
  if (options.language && !String(report.language || "").toLowerCase().startsWith(options.language)) {
    add("language-mismatch", "html", "document language does not match the requested path locale", report.language, options.language);
  }

  for (const collectionName of ["fills", "tracks"]) {
    for (const item of report[collectionName] || []) {
      if (!item.visible || item.allowedDecoration) continue;
      overflow(item.selector, item);
      if (!item.expected) {
        add("missing-parent-box", item.selector, `${collectionName} surface has no measurable assigned box`);
        continue;
      }
      const deltas = {
        left: Math.abs(item.rect.left - item.expected.left),
        right: Math.abs(item.rect.right - item.expected.right),
        width: Math.abs(item.rect.width - item.expected.width),
      };
      if (deltas.left > tolerance || deltas.right > tolerance || deltas.width > tolerance) {
        add(
          collectionName === "fills" ? "fill-surface-gap" : "track-surface-gap",
          item.selector,
          `${item.name} does not fill its assigned inline box`,
          { rect: item.rect, deltas },
          item.expected,
        );
      }
    }
  }

  for (const item of report.readableCopy || []) {
    if (!item.visible) continue;
    if (item.isFillSurface || item.isTrackSurface) {
      add("readable-owner-conflict", item.selector, "readable measure is attached to a fill/track owner");
    }
    overflow(item.selector, item);
    if (item.parentContent && item.rect.width > item.parentContent.width + tolerance) {
      add("readable-copy-overflow", item.selector, "readable copy exceeds its parent content box", item.rect.width, item.parentContent.width);
    }
  }
  for (const heading of report.headings || []) {
    if (!heading.visible || heading.allowedDecoration) continue;
    if (heading.scrollWidth > heading.clientWidth + tolerance || heading.boundsOverflow) {
      add("heading-overflow", heading.selector, "heading text exceeds its rendered box", {
        clientWidth: heading.clientWidth,
        scrollWidth: heading.scrollWidth,
        textBounds: heading.textBounds,
      });
    }
    if (heading.tracked && heading.constrained && !heading.allowConstraint) {
      add("premature-heading-wrap", heading.selector, "tracked heading is narrower than its semantic column", heading.rect.width, heading.parentContent?.width);
    }
  }
  for (const item of report.textFits || []) {
    if (!item.visible || item.allowedDecoration) continue;
    if (item.scrollWidth > item.clientWidth + tolerance || item.boundsOverflow) {
      add("text-overflow", item.selector, `${item.name} text exceeds its rendered box`, {
        clientWidth: item.clientWidth,
        scrollWidth: item.scrollWidth,
        textBounds: item.textBounds,
        contentBox: item.contentBox,
      });
    }
  }
  for (const item of report.clipping || []) {
    if (!item.allowedDecoration) add("clipped-content", item.selector, "visible key content is clipped or ellipsized", item);
  }
  for (const item of report.overlaps || []) {
    add("content-overlap", `${item.first} + ${item.second}`, "visible sibling layout checks overlap", item);
  }
  for (const item of report.viewportExceeds || []) {
    add("viewport-exceed", item.selector, "visible key content extends beyond the viewport", item.rect);
  }

  const required = options.required || {};
  for (const [name, minimum] of Object.entries(required)) {
    if (!Number.isFinite(minimum)) continue;
    const count = Array.isArray(report[name]) ? report[name].filter(item => item.visible !== false).length : 0;
    if (count < minimum) add("missing-layout-hooks", name, `expected at least ${minimum} visible ${name} measurements`, count, minimum);
  }
  return issues;
}

function fail(message) {
  throw new Error(message);
}

function parseArgs(argv) {
  const options = { baseURL: "http://127.0.0.1:4173", routes: [], sessionCookie: null, sessionCookieFile: null };
  for (let index = 0; index < argv.length; index += 1) {
    if (!argv[index + 1]) fail("usage: verify-runtime-layout-webkit --base-url <url> [--route <path>] [--session-cookie-file <0600-local-fixture-file>]");
    if (argv[index] === "--base-url") options.baseURL = argv[index + 1];
    else if (argv[index] === "--route") options.routes.push(argv[index + 1]);
    else if (argv[index] === "--session-cookie-file") options.sessionCookieFile = argv[index + 1];
    else fail("usage: verify-runtime-layout-webkit --base-url <url> [--route <path>] [--session-cookie-file <0600-local-fixture-file>]");
    index += 1;
  }
  const parsed = new URL(options.baseURL);
  if (!/^https?:$/.test(parsed.protocol)) fail("base URL must use http or https");
  options.baseURL = parsed.href.endsWith("/") ? parsed.href : `${parsed.href}/`;
  if (options.sessionCookieFile) {
    if (!["127.0.0.1", "localhost"].includes(parsed.hostname)) fail("session cookies are allowed only for a loopback layout fixture");
  }
  if (options.routes.some(route => !SMARTLINGO_LAYOUT_ROUTES.includes(route))) {
    fail("every --route must be in SMARTLINGO_LAYOUT_ROUTES");
  }
  return options;
}

async function run(command, args, options = {}) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, { ...options, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", chunk => { stdout += chunk; });
    child.stderr.on("data", chunk => { stderr += chunk; });
    child.on("error", rejectPromise);
    child.on("close", code => {
      if (code === 0) resolvePromise({ stdout, stderr });
      else rejectPromise(new Error(`${command} exited ${code}: ${stderr.trim() || stdout.trim()}`));
    });
  });
}

export async function verifySmartLingoRuntimeLayout(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (options.sessionCookieFile) options.sessionCookie = (await readFile(options.sessionCookieFile, "utf8")).trim();
  if (options.sessionCookie && !/^[A-Za-z0-9_-]{16,128}$/.test(options.sessionCookie)) {
    fail("local fixture session cookie has an invalid format");
  }
  const selectedRoutes = options.routes.length ? [...new Set(options.routes)] : SMARTLINGO_LAYOUT_ROUTES;
  if (selectedRoutes.some(route => SMARTLINGO_AUTHENTICATED_LAYOUT_ROUTES.includes(route)) && !options.sessionCookie) {
    fail("authenticated layout routes require --session-cookie-file backed by an ephemeral local D1 session");
  }
  const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const work = await mkdtemp(join(tmpdir(), "smartlingo-runtime-layout-"));
  try {
    const executable = join(work, "smartlingo-runtime-layout-webkit");
    const configPath = join(work, "matrix.json");
    const infoPlistPath = join(work, "Info.plist");
    const swiftSource = join(projectRoot, "scripts", "measure-runtime-layout.swift");
    const cache = join(work, "swift-cache");
    const sdk = process.env.SMARTLINGO_SWIFT_SDK?.trim();
    const compileArgs = ["swiftc"];
    if (sdk) compileArgs.push("-sdk", sdk);
    await writeFile(infoPlistPath, `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict><key>NSAppTransportSecurity</key><dict><key>NSAllowsLocalNetworking</key><true/><key>NSAllowsArbitraryLoadsInWebContent</key><true/></dict></dict></plist>\n`);
    compileArgs.push(
      swiftSource,
      "-Xlinker", "-sectcreate",
      "-Xlinker", "__TEXT",
      "-Xlinker", "__info_plist",
      "-Xlinker", infoPlistPath,
      "-o", executable,
    );
    await run("xcrun", compileArgs, {
      env: {
        ...process.env,
        CLANG_MODULE_CACHE_PATH: cache,
        SWIFT_MODULECACHE_PATH: cache,
      },
    });
    // A fresh WebKit process per bounded route batch avoids the native
    // resource exhaustion observed after many consecutive navigations while
    // still compiling the measurement harness only once. Reports are merged
    // and validated as one complete release matrix below.
    const routeBatches = [];
    for (let index = 0; index < selectedRoutes.length; index += 5) {
      routeBatches.push(selectedRoutes.slice(index, index + 5));
    }
    const reports = [];
    for (const routes of routeBatches) {
      await writeFile(configPath, JSON.stringify({
        baseURL: options.baseURL,
        routes: routes.map(route => ({
          route,
          loadPath: route,
          readySelector: route.startsWith("/classes/course_en_basic/learn")
            ? '[data-layout-fill="five-skill-workspace"][data-layout-ready="true"]'
            : SMARTLINGO_AUTHENTICATED_LAYOUT_ROUTES.includes(route)
              ? '[data-layout-ready="true"]'
              : "[data-layout-page]",
        })),
        languages: SMARTLINGO_LAYOUT_LANGUAGES,
        viewports: SMARTLINGO_VIEWPORTS,
        collectorSource: collectSmartLingoRuntimeLayout.toString(),
        settleMilliseconds: 700,
        sessionCookieValue: options.sessionCookie,
      }));
      const { stdout } = await run(executable, [configPath]);
      reports.push(...stdout.split("\n").filter(line => line.startsWith("{")).map(line => JSON.parse(line)));
    }
    const expectedCount = selectedRoutes.length * SMARTLINGO_LAYOUT_LANGUAGES.length * SMARTLINGO_VIEWPORTS.length;
    if (reports.length !== expectedCount) fail(`expected ${expectedCount} WebKit reports, received ${reports.length}`);

    const failures = [];
    for (const entry of reports) {
      const expectedPage = expectedPageNames[entry.route];
      const expectedPath = `/${entry.language}${entry.route === "/" ? "" : entry.route}`;
      const actualPath = new URL(entry.report.url).pathname;
      if (actualPath !== expectedPath) {
        failures.push({
          route: entry.route,
          language: entry.language,
          viewport: entry.viewport.id,
          issues: [{ code: "path-mismatch", actual: actualPath, expected: expectedPath, url: entry.report.url }],
        });
        continue;
      }
      if (entry.report.pageName !== expectedPage) {
        failures.push({
          route: entry.route,
          language: entry.language,
          viewport: entry.viewport.id,
          issues: [{ code: "page-mismatch", actual: entry.report.pageName, expected: expectedPage, url: entry.report.url }],
        });
        continue;
      }
      const issues = findSmartLingoRuntimeLayoutIssues(entry.report, {
        viewport: entry.viewport,
        language: entry.language,
        required: { overlapChecks: 1, ...(requiredHooks[entry.route] ?? { fills: 1 }) },
      });
      if (issues.length) failures.push({
        route: entry.route,
        language: entry.language,
        viewport: entry.viewport.id,
        issues,
      });
    }
    if (failures.length) {
      const evidenceDirectory = join(projectRoot, ".sites-runtime");
      const evidencePath = join(evidenceDirectory, "runtime-layout-failures.json");
      await mkdir(evidenceDirectory, { recursive: true });
      await writeFile(evidencePath, `${JSON.stringify({ baseURL: options.baseURL, failures }, null, 2)}\n`);
      fail(`${failures.length} rendered layout combination(s) failed; evidence: ${evidencePath}`);
    }
    process.stdout.write(`WebKit runtime layout verified: ${reports.length}/${expectedCount} · ${selectedRoutes.length} routes · 2 languages · 5 viewports · ${options.baseURL}\n`);
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) {
  await verifySmartLingoRuntimeLayout();
}
