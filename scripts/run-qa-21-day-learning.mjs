import assert from "node:assert/strict";
import { createDailySessionPlan } from "./qa-21-day-session-plan.mjs";

const START_DATE = "2026-08-21";
const END_DATE = "2026-09-10";
const BASE_URL = String(process.env.QA_BASE_URL || "https://smartlingo.net").replace(/\/$/, "");
const localDate = String(process.env.QA_LOCAL_DATE || "");

assert.match(localDate, /^\d{4}-\d{2}-\d{2}$/, "QA_LOCAL_DATE must be YYYY-MM-DD");
assert.ok(localDate >= START_DATE && localDate <= END_DATE, `QA_LOCAL_DATE must be between ${START_DATE} and ${END_DATE}`);

const dayNumber = Math.floor((Date.parse(`${localDate}T12:00:00Z`) - Date.parse(`${START_DATE}T12:00:00Z`)) / 86_400_000) + 1;
const targets = ["en", "ja", "es", "it"];
const sessionPlan = createDailySessionPlan(localDate);

async function checkRoute(target, surface, path, markers) {
  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      headers: { "user-agent": "SmartLingo-21-Day-Preflight/2.0" },
      redirect: "follow",
    });
    const body = await response.text();
    const markerFound = markers.some(marker => body.toLowerCase().includes(marker.toLowerCase()));
    return {
      target,
      surface,
      path,
      status: response.status,
      markerFound,
      bytes: body.length,
      passed: response.status === 200 && body.length > 2_000 && markerFound,
    };
  } catch (error) {
    return { target, surface, path, status: 0, markerFound: false, bytes: 0, passed: false, error: String(error) };
  }
}

const checks = [];
for (const target of targets) {
  checks.push(await checkRoute(target, "course", `/zh/programs/${target}`, ["免费游戏", "免费体验", "选择课程", "课程详情"]));
  checks.push(await checkRoute(target, "course_trial", `/zh/programs/${target}/trial`, ["五项", "词汇", "免费体验"]));
  checks.push(await checkRoute(target, "play", `/zh/play?language=${target}`, ["智慧卡", "边玩边学", "游戏"]));
  checks.push(await checkRoute(target, "everyday_speaking", `/zh/play/everyday?language=${target}`, ["生活口语", "机场", "酒店"]));
}

const report = {
  schemaVersion: 2,
  kind: "production_route_preflight",
  localDate,
  dayNumber,
  baseUrl: BASE_URL,
  interfaceLanguage: "zh",
  targetLanguages: targets,
  requiredRealSessionPlan: sessionPlan,
  checks,
  passed: checks.every(check => check.passed),
  disclaimer: "This is an anonymous route preflight only. It is not login, subscription, learning, speech, score, progress, or Project-report evidence.",
  requiredRealAcceptance: {
    account: "qa_test_learner_1",
    browser: "Chrome",
    authentication: "SmartLingo email verification code retrieved from Gmail",
    surfaces: ["course_five_skills", "play", "everyday_speaking"],
    targetLanguages: targets,
    timing: "For each language, complete at least its planned 1-5 minutes of active learning. Navigation, loading, idle waiting, login, repair, and deployment time do not count.",
    scoreEvidence: "At least one legitimate server-graded score and its persisted learning log are required for every language; synthetic rows are forbidden.",
  },
};

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (!report.passed) process.exitCode = 1;
