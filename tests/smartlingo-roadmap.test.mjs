import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = fs.readFileSync(path.join(root, "lib", "smartlingo-roadmap.ts"), "utf8");
const payload = source.match(/const \w+RoadmapJson = String\.raw`\s*([\s\S]*?)\s*`;/);

assert.ok(payload, "SmartLingo roadmap must expose a strict JSON payload");
const days = JSON.parse(payload[1]);
const tasks = days.flatMap(day => day.tasks);
const taskById = new Map(tasks.map(task => [task.id, task]));
const dayByDate = new Map(days.map(day => [day.date, day]));
const roadmapText = JSON.stringify(days);

const copyIsBilingual = value =>
  value &&
  typeof value.zh === "string" &&
  value.zh.trim().length > 0 &&
  typeof value.en === "string" &&
  value.en.trim().length > 0;

test("SmartLingo roadmap covers 20 consecutive delivery days", () => {
  assert.equal(days.length, 20);
  assert.equal(days[0].date, "2026-07-31");
  assert.equal(days.at(-1).date, "2026-08-19");

  for (let index = 1; index < days.length; index += 1) {
    const previous = new Date(`${days[index - 1].date}T12:00:00Z`);
    const current = new Date(`${days[index].date}T12:00:00Z`);
    assert.equal(current.getTime() - previous.getTime(), 86_400_000, `missing date between ${days[index - 1].date} and ${days[index].date}`);
  }
});

test("every day has exactly five bilingual tasks with evidence-based status", () => {
  for (const day of days) {
    assert.match(day.date, /^\d{4}-\d{2}-\d{2}$/);
    const expectedDayStatus = day.date === "2026-07-31" ? "done" : day.date === "2026-08-01" ? "blocked" : "planned";
    assert.equal(day.status, expectedDayStatus);
    assert.equal(day.tasks.length, 5, `${day.date} must contain exactly five tasks`);
    assert.ok(copyIsBilingual(day.category), `${day.date} category must be bilingual`);
    assert.ok(copyIsBilingual(day.owner), `${day.date} owner must be bilingual`);
    assert.ok(copyIsBilingual(day.acceptance), `${day.date} acceptance must be bilingual`);

    for (const task of day.tasks) {
      if (day.date === "2026-07-31") {
        assert.equal(task.status, "done");
        assert.equal(task.progress, 100);
      } else if (day.date === "2026-08-01") {
        const blocked = task.id === "sl-d02-clerk-auth";
        assert.equal(task.status, blocked ? "blocked" : "done");
        assert.equal(task.progress, blocked ? 90 : 100);
      } else {
        assert.equal(task.status, "planned");
        assert.equal(task.progress, 0);
      }
      assert.ok(copyIsBilingual(task.title), `${task.id} title must be bilingual`);
      assert.ok(copyIsBilingual(task.summary), `${task.id} summary must be bilingual`);
    }
  }
});

test("roadmap contains exactly 100 unique SmartLingo task ids", () => {
  const ids = tasks.map(task => task.id);
  assert.equal(ids.length, 100);
  assert.equal(new Set(ids).size, 100);
  assert.ok(ids.every(id => /^sl-d\d{2}-[a-z0-9-]+$/.test(id)));
});

test("first-day evidence preserves the legacy site and fixes product boundaries", () => {
  for (const id of [
    "sl-d01-legacy-archive",
    "sl-d01-learning-reference",
    "sl-d01-independent-foundation",
    "sl-d01-commercial-rules",
    "sl-d01-roadmap-contract",
  ]) assert.ok(taskById.has(id), `${id} must exist`);

  assert.match(taskById.get("sl-d01-legacy-archive").summary.en, /checksums.*does not depend on legacy assets/i);
  assert.match(taskById.get("sl-d01-commercial-rules").summary.zh, /任何已登录会员.*百分之十五.*百分之七十.*百分之三十.*不产生推荐积分/);
  assert.match(taskById.get("sl-d01-roadmap-contract").summary.zh, /二十个连续日期.*每天恰好五项/);
});

test("learning, AI, member-created classes, and class communities are scheduled", () => {
  for (const id of [
    "sl-d03-language-catalog",
    "sl-d04-session-composer",
    "sl-d06-pronunciation-feedback",
    "sl-d07-live-audio-entry",
    "sl-d08-writing-coach",
    "sl-d09-public-guru",
    "sl-d10-class-wizard",
    "sl-d11-class-forum",
  ]) assert.ok(taskById.has(id), `${id} must exist`);

  assert.match(taskById.get("sl-d10-class-wizard").summary.zh, /角色.*班名.*时区.*每人费用.*仅邀请可见/);
  assert.match(taskById.get("sl-d11-shared-goals").summary.en, /opted-in completion status.*never private scores/i);
});

test("commerce and rewards retain the required single-level boundary", () => {
  assert.match(taskById.get("sl-d14-first-payment-discount").summary.en, /per learner-class.*15% off/i);
  assert.match(taskById.get("sl-d14-split-math").summary.en, /discounted pre-tax.*remainder goes to the platform.*reconcile/i);
  assert.match(taskById.get("sl-d15-direct-attribution").summary.zh, /一名.*一名.*直接介绍人.*不追溯上级.*多层/);
  assert.match(taskById.get("sl-d15-reward-ledger").summary.en, /successful platform subscription payment.*reject class-order event types/i);
  assert.doesNotMatch(roadmapText, /多层返佣|second-level commission|upline earnings/i);
});

test("production release remains planned rather than reported as completed", () => {
  const releaseDay = dayByDate.get("2026-08-19");
  assert.equal(releaseDay.status, "planned");
  assert.ok(releaseDay.tasks.every(task => task.status === "planned" && task.progress === 0));
  for (const id of ["sl-d20-domain-services", "sl-d20-release-sync", "sl-d20-production-acceptance", "sl-d20-daily-automation", "sl-d20-recovery-report"]) {
    assert.ok(taskById.has(id), `${id} must remain scheduled`);
  }
});

test("Project status records the second-day evidence without inventing a verified release", () => {
  const projectStatus = fs.readFileSync(path.join(root, "lib", "project-status.ts"), "utf8");
  const runtime = fs.readFileSync(path.join(root, "lib", "project-runtime.ts"), "utf8");
  const dashboard = fs.readFileSync(path.join(root, "components", "ProjectDashboard.tsx"), "utf8");

  assert.match(projectStatus, /import \{ smartLingoRoadmapTasks \} from "\.\/smartlingo-roadmap";/);
  assert.match(projectStatus, /projectTasks: ProjectTask\[\] = smartLingoRoadmapTasks/);
  assert.match(projectStatus, /editionDate: "2026-08-01"/);
  assert.match(projectStatus, /today: 9/);
  assert.match(projectStatus, /total: 100/);
  assert.match(projectStatus, /projectBuilds: ProjectBuild\[\] = \[\]/);
  assert.match(projectStatus, /does not represent a completed Sites, GitHub, or production-domain release/);
  assert.match(projectStatus, /date: "2026-08-01"/);
  assert.match(projectStatus, /completed: 4/);
  assert.match(projectStatus, /Sites has no Clerk production configuration/);
  assert.match(projectStatus, /production domain has not passed Sites custom-domain acceptance/);
  assert.doesNotMatch(projectStatus, /Sites version \d+ (?:is|was) saved|deployment (?:is|was) successful|production (?:is|was) live/i);
  assert.match(runtime, /PROJECT_RUNTIME_KEY = "smartlingo-project-status"/);

  assert.match(dashboard, /SMARTLINGO PUBLIC PROJECT OPERATIONS/);
  assert.match(dashboard, /二十天，每天五项/);
  assert.match(dashboard, /尚无经核验的发布记录/);
  assert.match(dashboard, /runtime\.builds\.length > 0/);
  assert.doesNotMatch(dashboard, /SMARTAICERT|four membership tiers|四级会员/);
});
