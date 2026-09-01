#!/usr/bin/env node

import { createHash, randomBytes } from "node:crypto";
import { access, mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import {
  SMARTLINGO_LAYOUT_LANGUAGES,
  SMARTLINGO_LAYOUT_ROUTES,
  SMARTLINGO_VIEWPORTS,
} from "./verify-runtime-layout-webkit.mjs";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const wrangler = join(projectRoot, "node_modules", "wrangler", "bin", "wrangler.js");
const verifier = join(projectRoot, "scripts", "verify-runtime-layout-webkit.mjs");
const protectedPages = [
  "/zh/classes",
  "/zh/classes/course_en_basic/learn",
  "/zh/classes/course_en_basic/vocabulary",
  "/zh/dashboard",
  "/zh/messages",
  "/zh/messages/live/layout-check",
  "/zh/admin/members",
  "/zh/admin/language-classes",
  "/zh/certificates",
  "/zh/certificates/layout-certificate",
  "/zh/admin/certificates",
];
const protectedApis = [
  "/api/classes",
  "/api/classes/course_en_basic/learning",
  "/api/classes/course_en_basic/vocabulary?timeZone=America%2FLos_Angeles",
  "/api/messages",
  "/api/messages?thread=layout-check",
];
const publicReadApis = [
  "/api/community",
  "/api/community/meetings",
];

function run(command, args, options = {}) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, { ...options, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", value => { stdout += value; });
    child.stderr.on("data", value => { stderr += value; });
    child.on("error", rejectPromise);
    child.on("close", code => {
      if (code === 0) resolvePromise({ stdout, stderr });
      else rejectPromise(new Error(`${command} exited ${code}: ${stderr.trim() || stdout.trim()}`));
    });
  });
}

async function freePort() {
  return new Promise((resolvePromise, rejectPromise) => {
    const server = createServer();
    server.once("error", rejectPromise);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close(error => error ? rejectPromise(error) : resolvePromise(port));
    });
  });
}

async function waitForServer(baseURL, process, diagnostics = () => "") {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (process.exitCode !== null) throw new Error(`local layout Worker exited ${process.exitCode}: ${diagnostics().slice(-2000)}`);
    try {
      const response = await fetch(`${baseURL}/zh`, { redirect: "manual" });
      if (response.status === 200) return;
    } catch {
      // The isolated Worker is still starting.
    }
    await new Promise(resolvePromise => setTimeout(resolvePromise, 250));
  }
  throw new Error(`local layout Worker did not become ready: ${diagnostics().slice(-2000)}`);
}

async function assertControls(baseURL, token) {
  for (const path of protectedPages) {
    const signedIn = await fetch(`${baseURL}${path}`, {
      headers: { cookie: `smartlingo_session=${token}` },
      redirect: "manual",
    });
    if (signedIn.status !== 200) throw new Error(`authenticated page control failed: ${path} returned ${signedIn.status} ${signedIn.headers.get("location") || ""}`.trim());
    const anonymous = await fetch(`${baseURL}${path}`, { redirect: "manual" });
    if (![302, 307, 308].includes(anonymous.status)) throw new Error(`anonymous page control failed: ${path} returned ${anonymous.status}`);
  }
  for (const path of protectedApis) {
    const signedIn = await fetch(`${baseURL}${path}`, {
      headers: { cookie: `smartlingo_session=${token}` },
      redirect: "manual",
    });
    if (signedIn.status !== 200) throw new Error(`authenticated API control failed: ${path} returned ${signedIn.status}`);
    const anonymous = await fetch(`${baseURL}${path}`, { redirect: "manual" });
    if (anonymous.status !== 401) throw new Error(`anonymous API control failed: ${path} returned ${anonymous.status}`);
  }
  for (const path of publicReadApis) {
    const anonymous = await fetch(`${baseURL}${path}`, { redirect: "manual" });
    if (anonymous.status !== 200) throw new Error(`public-read API control failed: ${path} returned ${anonymous.status}`);
  }
  process.stdout.write(`Authenticated layout controls verified: ${protectedPages.length} pages + ${protectedApis.length} protected APIs; ${publicReadApis.length} Community read APIs remain public.\n`);
}

async function stopChild(child) {
  if (!child || child.exitCode !== null) return;
  child.kill("SIGTERM");
  await Promise.race([
    new Promise(resolvePromise => child.once("close", resolvePromise)),
    new Promise(resolvePromise => setTimeout(resolvePromise, 3000)),
  ]);
  if (child.exitCode === null) child.kill("SIGKILL");
}

async function main() {
  await Promise.all([
    access(join(projectRoot, "dist", "server", "index.js")),
    access(join(projectRoot, "dist", "client")),
    access(join(projectRoot, "drizzle", "0022_smartlingo_learning_paths.sql")),
  ]);
  const work = await mkdtemp(join(tmpdir(), "smartlingo-layout-release-"));
  const state = join(work, "state");
  const config = join(work, "wrangler.jsonc");
  const fixture = join(work, "fixture.sql");
  const sessionCookieFile = join(work, "session-cookie");
  const token = randomBytes(32).toString("base64url");
  const sessionHash = createHash("sha256").update(token).digest("base64");
  const port = await freePort();
  const baseURL = `http://127.0.0.1:${port}`;
  let worker = null;
  let workerDiagnostics = "";

  const allowedEnvironmentKeys = [
    "PATH", "HOME", "TMPDIR", "LANG", "LC_ALL", "SHELL", "USER", "LOGNAME", "TERM",
    "DEVELOPER_DIR", "SDKROOT", "SMARTLINGO_SWIFT_SDK", "OPENSSL_CONF",
  ];
  const isolatedEnv = Object.fromEntries(allowedEnvironmentKeys
    .filter(key => typeof process.env[key] === "string")
    .map(key => [key, process.env[key]]));
  Object.assign(isolatedEnv, {
    CI: "1",
    WRANGLER_SEND_METRICS: "false",
    CLOUDFLARE_INCLUDE_PROCESS_ENV: "false",
    WRANGLER_WRITE_LOGS: "false",
    WRANGLER_LOG_PATH: join(work, "wrangler.log"),
    WRANGLER_REGISTRY_PATH: join(work, "registry"),
    MINIFLARE_REGISTRY_PATH: join(work, "registry"),
  });

  try {
    await writeFile(config, JSON.stringify({
      $schema: join(projectRoot, "node_modules", "wrangler", "config-schema.json"),
      name: "smartlingo-layout-release",
      main: join(projectRoot, "dist", "server", "index.js"),
      compatibility_date: "2026-05-15",
      compatibility_flags: ["nodejs_compat"],
      no_bundle: true,
      find_additional_modules: true,
      rules: [{ type: "ESModule", globs: ["**/*.js", "**/*.mjs"] }],
      assets: { directory: join(projectRoot, "dist", "client"), binding: "ASSETS" },
      d1_databases: [{
        binding: "DB",
        database_name: "smartlingo-layout-release",
        database_id: "00000000-0000-4000-8000-000000000001",
        migrations_dir: join(projectRoot, "drizzle"),
      }],
      r2_buckets: [{ binding: "BUCKET", bucket_name: "smartlingo-layout-release-media" }],
    }), { mode: 0o600 });
    await writeFile(fixture, `
INSERT INTO users (id,email,email_verified,display_name,password_hash,preferred_language,
 clerk_user_id,clerk_identity_checked_at,role,created_at) VALUES
 ('layout-user','bingliu@cybeye.com',1,'Layout Learner','disabled-local-fixture','en',
  'layout-clerk-user',unixepoch(),'admin',1785680000),
 ('layout-peer','layout-peer@smartlingo.invalid',1,'Layout Peer','disabled-local-fixture','zh',
  'layout-clerk-peer',unixepoch(),'member',1785680001);
INSERT INTO sessions (id,user_id,clerk_session_id,expires_at,created_at) VALUES
 ('${sessionHash}','layout-user','layout-local-session',4102444800,1785680002);
INSERT INTO smartlingo_course_subscriptions
 (id,class_id,user_id,status,monthly_price_cents,trial_started_at,trial_ends_at,current_period_ends_at,provider_subscription_id,created_at,updated_at) VALUES
 ('layout-en-subscription','course_en_basic','layout-user','active',2000,1785680002,4102444800,4102444800,'layout-en',1785680002,1785680002),
 ('layout-es-subscription','course_es_basic','layout-user','active',2000,1785680002,4102444800,4102444800,'layout-es',1785680002,1785680002);
INSERT INTO smartlingo_language_class_members (id,class_id,user_id,role,status,joined_at,updated_at) VALUES
 ('layout-en-member','course_en_basic','layout-user','student','active',1785680003,1785680003),
 ('layout-es-member','course_es_basic','layout-user','student','active',1785680004,1785680004);
INSERT INTO smartlingo_placement_attempts
 (id,user_id,class_id,path_id,entry_mode,status,current_difficulty,active_seconds,vocabulary_score,reading_score,writing_score,listening_score,dialogue_score,overall_score,recommended_level,started_at,completed_at,created_at,updated_at)
 VALUES ('layout-placement','layout-user','course_en_basic','path_en_a1','beginner','completed',1,900,82,78,75,80,79,79,'beginner',1785680100,1785681000,1785680100,1785681000);
INSERT INTO smartlingo_placement_attempts
 (id,user_id,class_id,path_id,entry_mode,status,current_difficulty,active_seconds,last_resumed_at,started_at,created_at,updated_at)
 VALUES ('layout-placement-active','layout-user','course_es_basic','path_es_a1','adaptive','in_progress',3,45,1785682000,1785681900,1785681900,1785682000);
INSERT INTO smartlingo_course_enrollments_v3
 (id,offering_id,user_id,class_id,access_type,status,start_day,current_day,daily_seconds,started_at,completed_at,created_at,updated_at)
 VALUES ('layout-enrollment','sl-course-en-beginner-7d-v1','layout-user','course_en_basic','free','completed',1,1,3600,1785682100,1785682200,1785682100,1785682200);
INSERT INTO smartlingo_course_day_progress_v2
 (id,enrollment_id,user_id,class_id,course_day,started_date,last_activity_date,score,skill_scores,quiz_score,is_complete,started_at,completed_at,updated_at)
 VALUES ('layout-daily-score','layout-enrollment','layout-user','course_en_basic',1,'2026-08-02','2026-08-02',95,'{"vocabulary":95,"listening":95,"dialogue":95}',95,1,1785682150,1785682150,1785682150);
INSERT INTO smartlingo_course_certificates_v2
 (id,certificate_number,verification_code,enrollment_id,offering_id,user_id,class_id,member_name,course_title_zh,course_title_en,target_language,level,duration_days,start_day,completed_days,final_score,pass_score,completion_reason,curriculum_version,issued_at,created_at)
 VALUES ('layout-certificate','SL-2026-LAYOUT','LAYOUT95','layout-enrollment','sl-course-en-beginner-7d-v1','layout-user','course_en_basic','Layout Learner','英语 7 天旅行入门课','English 7-day travel beginner course','en','beginner',7,1,1,95,60,'early_mastery','2026-08-02.3',1785682200,1785682200);
INSERT INTO community_topics (id,user_id,category,title,body,created_at,updated_at) VALUES
 ('layout-topic','layout-peer','learning','Practice together / 一起练习','Share one phrase used today. / 分享一句今天使用的表达。',1785681100,1785681200);
INSERT INTO community_replies (id,topic_id,user_id,body,created_at) VALUES
 ('layout-reply','layout-topic','layout-user','I reviewed greetings. / 我复习了问候表达。',1785681200);
INSERT INTO message_threads (id,kind,subject,created_by,created_at,updated_at) VALUES
 ('layout-check','group','Daily practice / 每日练习','layout-user',1785681300,1785681500);
INSERT INTO message_participants (id,thread_id,user_id,last_read_at,deleted_at) VALUES
 ('layout-participant-user','layout-check','layout-user',1785681300,NULL),
 ('layout-participant-peer','layout-check','layout-peer',0,NULL);
INSERT INTO messages (id,thread_id,sender_id,body,created_at,deleted_at) VALUES
 ('layout-message-1','layout-check','layout-peer','Ready for speaking practice? / 准备好口语练习了吗？',1785681400,NULL),
 ('layout-message-2','layout-check','layout-user','Yes—start with greetings. / 好的，从问候语开始。',1785681500,NULL);
`, { mode: 0o600 });
    await writeFile(sessionCookieFile, `${token}\n`, { mode: 0o600 });

    const common = ["--local", "--persist-to", state, "--config", config];
    await run(process.execPath, [wrangler, "d1", "migrations", "apply", "DB", ...common], { cwd: projectRoot, env: isolatedEnv });
    await run(process.execPath, [wrangler, "d1", "execute", "DB", ...common, "--file", fixture, "-y"], { cwd: projectRoot, env: isolatedEnv });

    worker = spawn(process.execPath, [
      wrangler, "dev", ...common, "--ip", "127.0.0.1", "--port", String(port), "--log-level", "warn",
    ], { cwd: projectRoot, env: isolatedEnv, stdio: ["ignore", "pipe", "pipe"] });
    worker.stdout.on("data", value => { workerDiagnostics += String(value); });
    worker.stderr.on("data", value => { workerDiagnostics += String(value); });
    await waitForServer(baseURL, worker, () => workerDiagnostics);
    await assertControls(baseURL, token);
    const verified = await run(process.execPath, [verifier, "--base-url", baseURL, "--session-cookie-file", sessionCookieFile, ...process.argv.slice(2)], {
      cwd: projectRoot,
      env: isolatedEnv,
    });
    const expectedLayoutCount = SMARTLINGO_LAYOUT_ROUTES.length
      * SMARTLINGO_LAYOUT_LANGUAGES.length
      * SMARTLINGO_VIEWPORTS.length;
    const evidence = verified.stdout.match(new RegExp(
      `WebKit runtime layout verified: ${expectedLayoutCount}\/${expectedLayoutCount}[^\\n]*`,
    ))?.[0];
    if (!evidence) {
      throw new Error(`Full ${expectedLayoutCount}/${expectedLayoutCount} WebKit evidence was not emitted: ${verified.stderr.trim() || verified.stdout.trim() || "no verifier output"}`);
    }
    await writeFile(join(tmpdir(), "smartlingo-layout-release-evidence.txt"), `${evidence}\n`, { mode: 0o600 });
    process.stderr.write(`${evidence}\n`);
  } finally {
    await stopChild(worker);
    await rm(work, { recursive: true, force: true });
  }
}

main().catch(error => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
