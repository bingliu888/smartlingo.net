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
          return { success: true, results: [] };
        },
      };
      return statement;
    },
  };
}

async function sourceFiles(directory) {
  const result = [];
  for (const name of await readdir(directory)) {
    const file = path.join(directory, name);
    const info = await stat(file);
    if (info.isDirectory()) result.push(...await sourceFiles(file));
    else if (/\.(?:ts|tsx)$/.test(name)) result.push(file);
  }
  return result;
}

test("one fixed policy registry owns every SmartLingo AI feature and failure mode", async () => {
  const gateway = await importGateway();
  assert.deepEqual(Object.keys(gateway.SMARTAI_FEATURE_POLICIES).sort(), [
    "chat_guru",
    "content_help",
    "image",
    "live_voice",
    "message_polish",
    "moderation",
    "public_guru",
    "scoring",
  ]);
  assert.equal(gateway.SMARTAI_FEATURE_POLICIES.public_guru.failureMode, "local_fallback");
  assert.equal(gateway.SMARTAI_FEATURE_POLICIES.message_polish.failureMode, "preserve_input");
  assert.equal(gateway.SMARTAI_FEATURE_POLICIES.scoring.failureMode, "deny");
  assert.equal(gateway.SMARTAI_FEATURE_POLICIES.moderation.failureMode, "quarantine");
  assert.equal(gateway.SMARTAI_FEATURE_POLICIES.live_voice.maxInputUnits, 600);
});

test("OpenAI origin and secret name exist only in the unified gateway under app and lib", async () => {
  const files = [
    ...await sourceFiles(path.join(root, "app")),
    ...await sourceFiles(path.join(root, "lib")),
  ];
  const offenders = [];
  for (const file of files) {
    const source = await readFile(file, "utf8");
    if (file.endsWith("lib/smartlingo-ai-gateway.ts")) continue;
    if (/api\.openai\.com|OPENAI_API_KEY/.test(source)) offenders.push(path.relative(root, file));
  }
  assert.deepEqual(offenders, []);
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

test("client voice usage POST can no longer influence the allowance", async () => {
  const route = await read("app/api/assistant/live/usage/route.ts");
  assert.match(route, /status: 405/);
  assert.match(route, /Client-reported voice usage is disabled/);
  assert.doesNotMatch(route, /request\.json|body\.seconds|onConflictDoUpdate|usedSeconds.*\+/);
});
