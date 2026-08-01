import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import ts from "typescript";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const read = relative => readFile(path.join(root, relative), "utf8");

async function importGateway() {
  const source = await read("lib/smartlingo-ai-gateway.ts");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(output).toString("base64")}`);
}

function fakeDatabase(options = {}) {
  const queries = [];
  let allowanceReservations = 0;
  return {
    queries,
    prepare(query) {
      const entry = { query, values: [] };
      queries.push(entry);
      const statement = {
        bind(...values) {
          entry.values = values;
          return statement;
        },
        async first() {
          if (query.includes("live_voice_usage")) {
            allowanceReservations += 1;
            return allowanceReservations <= (options.allowanceSuccesses ?? 1)
              ? { used_seconds: 600 }
              : null;
          }
          if (query.includes("smartlingo_ai_usage_windows")) {
            return options.rateLimited ? null : { id: "window-1" };
          }
          return null;
        },
        async run() {
          if (query.includes("UPDATE smartlingo_ai_usage_windows SET output_units") && options.failOutputAccumulation) {
            return { success: false, results: [] };
          }
          if (query.includes("UPDATE smartlingo_ai_requests") && options.failCompletion) {
            return { success: false, results: [] };
          }
          if (query.includes("UPDATE live_voice_usage SET used_seconds = 0") && options.failAllowanceRelease) {
            return { success: false, results: [] };
          }
          return { success: true, results: [] };
        },
      };
      return statement;
    },
  };
}

async function sourceFiles(directory) {
  const result = [];
  const entries = await readdir(directory).catch(error => error.code === "ENOENT" ? [] : Promise.reject(error));
  for (const name of entries) {
    const file = path.join(directory, name);
    const info = await stat(file);
    if (info.isDirectory()) result.push(...await sourceFiles(file));
    else if (/\.(?:cjs|js|jsx|mjs|ts|tsx)$/.test(name)) result.push(file);
  }
  return result;
}

test("one fixed policy registry owns every SmartLingo AI feature and failure mode", async () => {
  const gateway = await importGateway();
  assert.deepEqual(Object.keys(gateway.SMARTAI_FEATURE_POLICIES).sort(), [
    "chat_guru",
    "content_help",
    "image",
    "listening_feedback",
    "live_voice",
    "message_polish",
    "moderation",
    "public_guru",
    "scoring",
    "speaking_feedback",
    "writing_feedback",
  ]);
  assert.equal(gateway.SMARTAI_FEATURE_POLICIES.public_guru.failureMode, "local_fallback");
  assert.equal(gateway.SMARTAI_FEATURE_POLICIES.message_polish.failureMode, "preserve_input");
  assert.equal(gateway.SMARTAI_FEATURE_POLICIES.listening_feedback.failureMode, "preserve_content");
  assert.equal(gateway.SMARTAI_FEATURE_POLICIES.speaking_feedback.failureMode, "preserve_content");
  assert.equal(gateway.SMARTAI_FEATURE_POLICIES.writing_feedback.failureMode, "preserve_content");
  assert.equal(gateway.SMARTAI_FEATURE_POLICIES.scoring.failureMode, "deny");
  assert.equal(gateway.SMARTAI_FEATURE_POLICIES.moderation.failureMode, "quarantine");
  assert.equal(gateway.SMARTAI_FEATURE_POLICIES.live_voice.maxInputUnits, 600);
  for (const feature of [
    "public_guru",
    "message_polish",
    "chat_guru",
    "content_help",
    "listening_feedback",
    "speaking_feedback",
    "writing_feedback",
    "scoring",
  ]) {
    assert.equal(gateway.SMARTAI_FEATURE_POLICIES[feature].model, "gpt-5.6-luna");
  }
  assert.equal(gateway.SMARTAI_FEATURE_POLICIES.moderation.model, "omni-moderation-latest");
  assert.equal(gateway.SMARTAI_FEATURE_POLICIES.image.model, "gpt-image-1-mini");
  assert.equal(gateway.SMARTAI_FEATURE_POLICIES.live_voice.model, "gpt-realtime-2.1-mini");
});

test("OpenAI origin and secret name exist only in the unified gateway across runtime and client artifacts", async () => {
  const runtimeRoots = ["app", "build", "components", "db", "lib", "worker"];
  const files = (await Promise.all(runtimeRoots.map(directory => sourceFiles(path.join(root, directory))))).flat();
  const offenders = [];
  for (const file of files) {
    const source = await readFile(file, "utf8");
    if (file.endsWith("lib/smartlingo-ai-gateway.ts")) continue;
    if (/api\.openai\.com|OPENAI_API_KEY/.test(source)) offenders.push(path.relative(root, file));
  }
  assert.deepEqual(offenders, []);

  const clientFiles = await sourceFiles(path.join(root, "dist", "client"));
  const clientOffenders = [];
  for (const file of clientFiles) {
    const source = await readFile(file, "utf8");
    if (/api\.openai\.com|OPENAI_API_KEY/.test(source)) clientOffenders.push(path.relative(root, file));
  }
  assert.deepEqual(clientOffenders, []);
  const scanner = await read("scripts/scan-sensitive-data.mjs");
  assert.match(scanner, /forbiddenClientMarkers/);
  assert.match(scanner, /OpenAI server environment name/);
  assert.match(scanner, /direct OpenAI provider origin/);
});

test("missing key returns an original localized Guru fallback without auditing raw text", async () => {
  const gateway = await importGateway();
  const database = fakeDatabase();
  const raw = "这是不能写入审计表的原始问题";
  const result = await gateway.askSmartAi({
    feature: "public_guru",
    subject: "visitor:203.0.113.8",
    language: "zh",
    instructions: "safe",
    content: raw,
    deps: {
      apiKey: null,
      subjectHashKey: "test-audit-hash-key",
      database,
      now: () => 1_700_000_000_000,
      randomUUID: (() => {
        let value = 0;
        return () => `id-${++value}`;
      })(),
    },
  });
  assert.equal(result.fallback, true);
  assert.match(result.value, /智能导师暂时无法连接/);
  assert.match(result.value, /语言|学习|班级/);
  assert.doesNotMatch(result.value, /黄金会员|铂金会员|管理员授权码|BACC/);
  assert.equal(database.queries.some(item => item.query.includes(raw)), false);
  assert.equal(database.queries.flatMap(item => item.values).some(value => value === raw), false);
  assert.ok(database.queries.some(item => item.query.includes("fallback_used")));
});

test("audit subjects use keyed deterministic HMACs and never expose a low-entropy subject", async () => {
  const gateway = await importGateway();
  const subject = "visitor:127.0.0.1";
  const first = await gateway.smartAiSubjectHash("public_guru", subject, "server-key-one");
  const same = await gateway.smartAiSubjectHash("public_guru", subject, "server-key-one");
  const rotated = await gateway.smartAiSubjectHash("public_guru", subject, "server-key-two");
  assert.equal(first, same);
  assert.notEqual(first, rotated);
  assert.match(first, /^[a-f0-9]{64}$/);
  assert.doesNotMatch(first, /127\.0\.0\.1|visitor/);
  await assert.rejects(
    gateway.smartAiSubjectHash("public_guru", subject, ""),
    error => error.code === "audit_unavailable" && error.status === 503,
  );
});

test("missing provider and subject-hash keys fail safely without provider or audit writes", async () => {
  const gateway = await importGateway();
  const database = fakeDatabase();
  let providerCalled = false;
  const result = await gateway.askSmartAi({
    feature: "public_guru",
    subject: "visitor:anonymous",
    language: "en",
    instructions: "safe",
    content: "question",
    deps: {
      apiKey: null,
      database,
      fetch: async () => {
        providerCalled = true;
        return new Response();
      },
    },
  });
  assert.equal(result.fallback, true);
  assert.equal(providerCalled, false);
  assert.equal(database.queries.length, 0);
});

test("bounded request readers reject declared and streamed oversized payloads with 413", async () => {
  const gateway = await importGateway();
  const declared = new Request("https://smartlingo.net/api/assistant", {
    method: "POST",
    headers: { "content-length": "11" },
    body: "{}",
  });
  await assert.rejects(
    gateway.readSmartAiRequestText(declared, 10),
    error => error.code === "request_too_large" && error.status === 413,
  );

  const streamed = new Request("https://smartlingo.net/api/assistant", {
    method: "POST",
    body: "12345678901",
  });
  await assert.rejects(
    gateway.readSmartAiRequestText(streamed, 10),
    error => error.code === "request_too_large" && error.status === 413,
  );

  const valid = new Request("https://smartlingo.net/api/assistant", {
    method: "POST",
    body: JSON.stringify({ language: "zh", messages: [] }),
  });
  assert.deepEqual(await gateway.readSmartAiJsonRequest(valid, 128), { language: "zh", messages: [] });
});

test("atomic D1 window rejection produces a sanitized 429 before any provider call", async () => {
  const gateway = await importGateway();
  let called = false;
  await assert.rejects(
    gateway.askSmartAi({
      feature: "public_guru",
      subject: "visitor:limited",
      language: "en",
      instructions: "safe",
      content: "question",
      deps: {
        apiKey: "test-only",
        database: fakeDatabase({ rateLimited: true }),
        fetch: async () => {
          called = true;
          return new Response();
        },
        now: () => 1_700_000_000_000,
        randomUUID: () => "id",
      },
    }),
    error => error.code === "rate_limited" && error.status === 429 && error.retryAfter > 0,
  );
  assert.equal(called, false);
});

test("AbortController timeout and upstream 5xx both use the public bilingual fallback", async () => {
  const gateway = await importGateway();
  const common = {
    feature: "public_guru",
    subject: "visitor:fallback",
    language: "en",
    instructions: "safe",
    content: "question",
  };
  const timeout = await gateway.askSmartAi({
    ...common,
    deps: {
      apiKey: "test-only",
      database: fakeDatabase(),
      policyOverrides: { public_guru: { timeoutMs: 5 } },
      fetch: async (_url, init) => new Promise((_resolve, reject) => {
        init.signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
      }),
    },
  });
  assert.equal(timeout.fallback, true);
  assert.match(timeout.value, /Guru is temporarily unable to connect/);

  const upstream = await gateway.askSmartAi({
    ...common,
    deps: {
      apiKey: "test-only",
      database: fakeDatabase(),
      fetch: async () => new Response("provider-internal-secret", { status: 503 }),
    },
  });
  assert.equal(upstream.fallback, true);
  assert.doesNotMatch(upstream.value, /provider-internal-secret/);
});

test("the timeout covers a stalled response body, not only response headers", async () => {
  const gateway = await importGateway();
  const started = Date.now();
  let bodyCancelled = false;
  const result = await gateway.askSmartAi({
    feature: "public_guru",
    subject: "visitor:slow-body",
    language: "en",
    instructions: "safe",
    content: "question",
    deps: {
      apiKey: "test-only",
      database: fakeDatabase(),
      policyOverrides: { public_guru: { timeoutMs: 10 } },
      fetch: async () => new Response(new ReadableStream({
        start() {},
        cancel() { bodyCancelled = true; },
      }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    },
  });
  assert.equal(result.fallback, true);
  assert.equal(bodyCancelled, true, "gateway timeout must cancel the active provider response body");
  assert.ok(Date.now() - started < 500, "stalled response body must be bounded by the gateway timeout");
});

test("an unsuccessful D1 audit completion never releases an upstream answer", async () => {
  const gateway = await importGateway();
  const database = fakeDatabase({ failCompletion: true });
  const result = await gateway.askSmartAi({
    feature: "public_guru",
    subject: "visitor:audit-failure",
    language: "en",
    instructions: "safe",
    content: "question",
    deps: {
      apiKey: "test-only",
      database,
      fetch: async () => Response.json({ output_text: "provider answer that must not escape" }),
    },
  });
  assert.equal(result.fallback, true);
  assert.doesNotMatch(result.value, /provider answer/);
  assert.ok(database.queries.some(item => item.query.includes("UPDATE smartlingo_ai_requests")));
  assert.ok(database.queries.some(item => item.values.includes("audit_unavailable")));
});

test("listening, speaking, and writing feedback preserve learner content on service failure", async () => {
  const gateway = await importGateway();
  for (const feature of ["listening_feedback", "speaking_feedback", "writing_feedback"]) {
    const content = `learner-owned-${feature}`;
    const result = await gateway.reviewSmartAiLearningContent({
      feature,
      subject: "user:learner",
      language: "en",
      content,
      deps: {
        apiKey: null,
        subjectHashKey: "test-audit-hash-key",
        database: fakeDatabase(),
      },
    });
    assert.deepEqual(result, { value: content, fallback: true });
  }
});

test("learning feedback calls share one explicit AI-not-teacher safety boundary", async () => {
  const gateway = await importGateway();
  let providerRequest;
  const result = await gateway.reviewSmartAiLearningContent({
    feature: "speaking_feedback",
    subject: "user:speaker",
    language: "zh",
    content: "A supplied transcript only",
    instructions: "Focus on one declared target sound.",
    deps: {
      apiKey: "test-only",
      database: fakeDatabase(),
      fetch: async (_url, init) => {
        providerRequest = {
          body: JSON.parse(init.body),
          safetyIdentifier: new Headers(init.headers).get("OpenAI-Safety-Identifier"),
        };
        return Response.json({ output_text: "练习建议" });
      },
    },
  });
  assert.deepEqual(result, { value: "练习建议", fallback: false });
  assert.match(providerRequest.body.instructions, /artificial intelligence practice assistant/);
  assert.match(providerRequest.body.instructions, /not a human teacher or official examiner/);
  assert.match(providerRequest.body.instructions, /State uncertainty/);
  assert.match(providerRequest.body.instructions, /Simplified Chinese/);
  assert.equal(providerRequest.body.model, "gpt-5.6-luna");
  assert.deepEqual(providerRequest.body.reasoning, { effort: "low" });
  assert.match(providerRequest.safetyIdentifier, /^[a-f0-9]{64}$/);
  assert.doesNotMatch(providerRequest.safetyIdentifier, /speaker/);
});

test("safety review is fail-closed and returns a structured quarantine fallback", async () => {
  const gateway = await importGateway();
  const accepted = await gateway.reviewSmartAiSafety({
    subject: "user:moderated",
    content: "ordinary practice content",
    deps: {
      apiKey: "test-only",
      database: fakeDatabase(),
      fetch: async () => Response.json({
        results: [{ flagged: false, categories: { harassment: false, violence: false } }],
      }),
    },
  });
  assert.deepEqual(accepted, {
    value: { allowed: true, flagged: false, categories: [], humanReviewRequired: false },
    fallback: false,
  });

  const unavailable = await gateway.reviewSmartAiSafety({
    subject: "user:moderated",
    content: "content requiring a decision",
    deps: { apiKey: null, database: fakeDatabase() },
  });
  assert.deepEqual(unavailable, {
    value: { allowed: false, flagged: true, categories: ["review_required"], humanReviewRequired: true },
    fallback: true,
  });
});

test("image failure is fail-safe and never returns an upstream error body", async () => {
  const gateway = await importGateway();
  let error;
  try {
    await gateway.generateSmartAiImage({
      subject: "user:one",
      prompt: "safe background",
      deps: {
        apiKey: "test-only",
        database: fakeDatabase(),
        fetch: async () => new Response("raw-provider-error", { status: 500 }),
      },
    });
  } catch (cause) {
    error = cause;
  }
  const safe = gateway.safeSmartAiError(error, "en", "image");
  assert.equal(safe.status, 503);
  assert.match(safe.message, /cannot be generated right now/);
  assert.doesNotMatch(JSON.stringify(safe), /raw-provider-error/);
});

test("free live voice atomically reserves all 600 seconds and blocks a concurrent duplicate", async () => {
  const gateway = await importGateway();
  const database = fakeDatabase({ allowanceSuccesses: 1 });
  const deps = {
    database,
    now: () => Date.parse("2026-07-31T12:00:00.000Z"),
  };
  const results = await Promise.allSettled([
    gateway.reserveLiveVoiceAllowance({ userId: "user-1", paid: false, deps }),
    gateway.reserveLiveVoiceAllowance({ userId: "user-1", paid: false, deps }),
  ]);
  assert.equal(results.filter(item => item.status === "fulfilled").length, 1);
  const failure = results.find(item => item.status === "rejected");
  assert.equal(failure.reason.code, "rate_limited");
  const reservations = database.queries.filter(item => item.query.includes("live_voice_usage"));
  assert.equal(reservations.length, 2);
  assert.ok(reservations.every(item => item.query.includes("used_seconds = 600")));
});

test("a failed free live voice connection releases the reserved daily allowance", async () => {
  const gateway = await importGateway();
  const database = fakeDatabase();
  await assert.rejects(
    gateway.openSmartAiLiveVoice({
      userId: "user-release",
      subject: "user:user-release",
      paid: false,
      sdp: "v=0\r\n",
      instructions: "safe",
      deps: {
        apiKey: null,
        subjectHashKey: "test-audit-hash-key",
        database,
        now: () => Date.parse("2026-08-01T12:00:00.000Z"),
      },
    }),
    error => error.code === "missing_key",
  );
  const release = database.queries.find(item => item.query.includes("UPDATE live_voice_usage SET used_seconds = 0"));
  assert.ok(release);
  assert.deepEqual(release.values.slice(1), ["user-release:2026-08-01", "user-release", "2026-08-01"]);
});

test("assistant routes expose bounded public, authenticated polish, chat, and live capabilities", async () => {
  const route = await read("app/api/assistant/route.ts");
  assert.match(route, /readSmartAiJsonRequest/);
  assert.match(route, /"public_guru" \| "message_polish" \| "chat_guru"/);
  assert.match(route, /feature === "public_guru" \? null : await requestUser\(\)/);
  assert.match(route, /feature !== "public_guru" && !user/);
  assert.doesNotMatch(route, /request\.json\(/);

  const live = await read("app/api/assistant/live/route.ts");
  assert.match(live, /readSmartAiRequestText\(request, 100_000\)/);
  assert.doesNotMatch(live, /request\.text\(/);

  const publicClient = await read("components/AssistantClient.tsx");
  const messageClient = await read("components/MessageCenter.tsx");
  const chatClient = await read("components/LiveChatRoom.tsx");
  assert.match(publicClient, /feature: "public_guru"/);
  assert.match(messageClient, /feature: "message_polish"/);
  assert.match(chatClient, /feature: "chat_guru"/);
});

test("client voice usage POST can no longer influence the allowance", async () => {
  const route = await read("app/api/assistant/live/usage/route.ts");
  assert.match(route, /status: 405/);
  assert.match(route, /Client-reported voice usage is disabled/);
  assert.doesNotMatch(route, /request\.json|body\.seconds|onConflictDoUpdate|usedSeconds.*\+/);
});
