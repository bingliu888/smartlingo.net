export type SmartAiFeature =
  | "public_guru"
  | "message_polish"
  | "chat_guru"
  | "content_help"
  | "scoring"
  | "moderation"
  | "image"
  | "live_voice";

export type SmartAiFailureMode =
  | "local_fallback"
  | "preserve_input"
  | "unavailable"
  | "preserve_content"
  | "deny"
  | "quarantine";

export type SmartAiFeaturePolicy = {
  model: string;
  maxInputUnits: number;
  maxOutputUnits: number;
  windowSeconds: number;
  requestsPerWindow: number;
  maxWindowInputUnits: number;
  timeoutMs: number;
  failureMode: SmartAiFailureMode;
};

/**
 * This is the only model and budget registry used by SmartLingo AI calls.
 * Callers select a feature; they cannot supply models, limits, or timeouts.
 */
export const SMARTAI_FEATURE_POLICIES: Readonly<Record<SmartAiFeature, SmartAiFeaturePolicy>> = {
  public_guru: {
    model: "gpt-5-nano",
    maxInputUnits: 24_000,
    maxOutputUnits: 1_200,
    windowSeconds: 60,
    requestsPerWindow: 12,
    maxWindowInputUnits: 72_000,
    timeoutMs: 15_000,
    failureMode: "local_fallback",
  },
  message_polish: {
    model: "gpt-5-nano",
    maxInputUnits: 4_000,
    maxOutputUnits: 2_000,
    windowSeconds: 60,
    requestsPerWindow: 10,
    maxWindowInputUnits: 24_000,
    timeoutMs: 12_000,
    failureMode: "preserve_input",
  },
  chat_guru: {
    model: "gpt-5-nano",
    maxInputUnits: 16_000,
    maxOutputUnits: 1_200,
    windowSeconds: 60,
    requestsPerWindow: 10,
    maxWindowInputUnits: 60_000,
    timeoutMs: 15_000,
    failureMode: "unavailable",
  },
  content_help: {
    model: "gpt-5-mini",
    maxInputUnits: 32_000,
    maxOutputUnits: 4_000,
    windowSeconds: 300,
    requestsPerWindow: 8,
    maxWindowInputUnits: 100_000,
    timeoutMs: 25_000,
    failureMode: "preserve_content",
  },
  scoring: {
    model: "gpt-5-mini",
    maxInputUnits: 16_000,
    maxOutputUnits: 2_000,
    windowSeconds: 60,
    requestsPerWindow: 10,
    maxWindowInputUnits: 64_000,
    timeoutMs: 20_000,
    failureMode: "deny",
  },
  moderation: {
    model: "omni-moderation-latest",
    maxInputUnits: 16_000,
    maxOutputUnits: 1,
    windowSeconds: 60,
    requestsPerWindow: 30,
    maxWindowInputUnits: 120_000,
    timeoutMs: 10_000,
    failureMode: "quarantine",
  },
  image: {
    model: "gpt-image-1-mini",
    maxInputUnits: 5_000,
    maxOutputUnits: 1,
    windowSeconds: 3_600,
    requestsPerWindow: 3,
    maxWindowInputUnits: 15_000,
    timeoutMs: 45_000,
    failureMode: "unavailable",
  },
  live_voice: {
    model: "gpt-realtime-2.1-mini",
    maxInputUnits: 600,
    maxOutputUnits: 0,
    windowSeconds: 60,
    requestsPerWindow: 1,
    maxWindowInputUnits: 600,
    timeoutMs: 20_000,
    failureMode: "unavailable",
  },
};

type StatementResult<T> = { success?: boolean; results?: T[] };
type SmartAiStatement = {
  bind(...values: unknown[]): SmartAiStatement;
  first<T>(): Promise<T | null>;
  run<T = Record<string, unknown>>(): Promise<StatementResult<T>>;
};
export type SmartAiDatabase = { prepare(query: string): SmartAiStatement };

export type SmartAiGatewayDependencies = {
  apiKey?: string | null;
  database?: SmartAiDatabase | null;
  fetch?: typeof fetch;
  now?: () => number;
  randomUUID?: () => string;
  policyOverrides?: Partial<Record<SmartAiFeature, Partial<SmartAiFeaturePolicy>>>;
};

export type SmartAiGatewayErrorCode =
  | "invalid_request"
  | "rate_limited"
  | "missing_key"
  | "audit_unavailable"
  | "timeout"
  | "network_error"
  | "upstream_rate_limited"
  | "upstream_rejected"
  | "upstream_unavailable"
  | "invalid_response";

const ERROR_STATUS: Record<SmartAiGatewayErrorCode, number> = {
  invalid_request: 400,
  rate_limited: 429,
  missing_key: 503,
  audit_unavailable: 503,
  timeout: 504,
  network_error: 503,
  upstream_rate_limited: 429,
  upstream_rejected: 502,
  upstream_unavailable: 503,
  invalid_response: 502,
};

export class SmartAiGatewayError extends Error {
  readonly status: number;
  constructor(
    readonly code: SmartAiGatewayErrorCode,
    readonly retryAfter?: number,
  ) {
    super(`SmartLingo AI gateway: ${code}`);
    this.name = "SmartAiGatewayError";
    this.status = ERROR_STATUS[code];
  }
}

export function isSmartAiGatewayError(error: unknown): error is SmartAiGatewayError {
  return error instanceof SmartAiGatewayError;
}

function gatewayError(error: unknown) {
  if (isSmartAiGatewayError(error)) return error;
  return new SmartAiGatewayError("network_error");
}

function globalDatabase() {
  return (globalThis as unknown as { __SMARTLINGO_DB__?: SmartAiDatabase }).__SMARTLINGO_DB__ ?? null;
}

function dependencies(input: SmartAiGatewayDependencies = {}) {
  return {
    apiKey: input.apiKey === undefined ? process.env.OPENAI_API_KEY || "" : input.apiKey || "",
    database: input.database === undefined ? globalDatabase() : input.database,
    fetch: input.fetch ?? fetch,
    now: input.now ?? Date.now,
    randomUUID: input.randomUUID ?? crypto.randomUUID.bind(crypto),
    policyOverrides: input.policyOverrides ?? {},
  };
}

function policyFor(feature: SmartAiFeature, input: SmartAiGatewayDependencies) {
  return {
    ...SMARTAI_FEATURE_POLICIES[feature],
    ...(input.policyOverrides?.[feature] ?? {}),
  };
}

export async function smartAiSubjectHash(feature: SmartAiFeature, subject: string) {
  const bytes = new TextEncoder().encode(`smartlingo:${feature}:${subject}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, "0")).join("");
}

type AuditReservation = {
  requestId: string;
  usageWindowId: string;
  subjectHash: string;
  windowStart: number;
};

async function beginAudit(input: {
  feature: SmartAiFeature;
  subject: string;
  inputUnits: number;
  deps: SmartAiGatewayDependencies;
}) {
  const deps = dependencies(input.deps);
  const policy = policyFor(input.feature, input.deps);
  if (!Number.isSafeInteger(input.inputUnits) || input.inputUnits < 0 || input.inputUnits > policy.maxInputUnits) {
    throw new SmartAiGatewayError("invalid_request");
  }
  if (!deps.database) throw new SmartAiGatewayError("audit_unavailable");
  const now = Math.floor(deps.now() / 1000);
  const windowStart = Math.floor(now / policy.windowSeconds) * policy.windowSeconds;
  const subjectHash = await smartAiSubjectHash(input.feature, input.subject);
  const proposedWindowId = deps.randomUUID();
  const window = await deps.database.prepare(
    `INSERT INTO smartlingo_ai_usage_windows
      (id, feature, subject_hash, window_start, window_seconds, request_count, input_units, output_units, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 1, ?, 0, ?, ?)
     ON CONFLICT(feature, subject_hash, window_start) DO UPDATE SET
       request_count = smartlingo_ai_usage_windows.request_count + 1,
       input_units = smartlingo_ai_usage_windows.input_units + excluded.input_units,
       updated_at = excluded.updated_at
     WHERE smartlingo_ai_usage_windows.request_count < ?
       AND smartlingo_ai_usage_windows.input_units + excluded.input_units <= ?
     RETURNING id`,
  ).bind(
    proposedWindowId,
    input.feature,
    subjectHash,
    windowStart,
    policy.windowSeconds,
    input.inputUnits,
    now,
    now,
    policy.requestsPerWindow,
    policy.maxWindowInputUnits,
  ).first<{ id: string }>();
  if (!window) {
    const retryAfter = Math.max(1, windowStart + policy.windowSeconds - now);
    throw new SmartAiGatewayError("rate_limited", retryAfter);
  }
  const requestId = deps.randomUUID();
  const started = await deps.database.prepare(
    `INSERT INTO smartlingo_ai_requests
      (id, usage_window_id, feature, subject_hash, model, status, input_units, output_units, fallback_used, error_code, created_at, completed_at)
     VALUES (?, ?, ?, ?, ?, 'started', ?, 0, 0, NULL, ?, NULL)`,
  ).bind(
    requestId,
    window.id,
    input.feature,
    subjectHash,
    policy.model,
    input.inputUnits,
    now,
  ).run();
  if (started.success === false) throw new SmartAiGatewayError("audit_unavailable");
  return { requestId, usageWindowId: window.id, subjectHash, windowStart } satisfies AuditReservation;
}

async function completeAudit(input: {
  reservation: AuditReservation;
  status: "succeeded" | "failed" | "fallback";
  outputUnits: number;
  errorCode: SmartAiGatewayErrorCode | null;
  deps: SmartAiGatewayDependencies;
}) {
  const deps = dependencies(input.deps);
  if (!deps.database) return;
  const now = Math.floor(deps.now() / 1000);
  const outputUnits = Math.max(0, Math.floor(input.outputUnits));
  await deps.database.prepare(
    `UPDATE smartlingo_ai_requests
     SET status = ?, output_units = ?, fallback_used = ?, error_code = ?, completed_at = ?
     WHERE id = ? AND status = 'started'`,
  ).bind(
    input.status,
    outputUnits,
    input.status === "fallback" ? 1 : 0,
    input.errorCode,
    now,
    input.reservation.requestId,
  ).run();
  if (outputUnits) {
    await deps.database.prepare(
      "UPDATE smartlingo_ai_usage_windows SET output_units = output_units + ?, updated_at = ? WHERE id = ?",
    ).bind(outputUnits, now, input.reservation.usageWindowId).run();
  }
}

const canUseLocalFallback = (error: SmartAiGatewayError) =>
  error.code === "missing_key"
  || error.code === "audit_unavailable"
  || error.code === "timeout"
  || error.code === "network_error"
  || error.code === "upstream_unavailable"
  || error.code === "invalid_response";

type GatewayValue<T> = { value: T; outputUnits: number };

async function executeGateway<T>(input: {
  feature: SmartAiFeature;
  subject: string;
  inputUnits: number;
  deps?: SmartAiGatewayDependencies;
  request(apiKey: string, subjectHash: string, signal: AbortSignal, model: string): Promise<Response>;
  read(response: Response): Promise<GatewayValue<T>>;
  fallback?(error: SmartAiGatewayError): GatewayValue<T> | null;
}) {
  const suppliedDeps = input.deps ?? {};
  const deps = dependencies(suppliedDeps);
  const policy = policyFor(input.feature, suppliedDeps);
  let reservation: AuditReservation | null = null;
  try {
    reservation = await beginAudit({
      feature: input.feature,
      subject: input.subject,
      inputUnits: input.inputUnits,
      deps: suppliedDeps,
    });
    if (!deps.apiKey) throw new SmartAiGatewayError("missing_key");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), policy.timeoutMs);
    let response: Response;
    try {
      response = await input.request(deps.apiKey, reservation.subjectHash, controller.signal, policy.model);
    } catch (error) {
      if (controller.signal.aborted) throw new SmartAiGatewayError("timeout");
      throw gatewayError(error);
    } finally {
      clearTimeout(timeout);
    }
    if (response.status === 429) throw new SmartAiGatewayError("upstream_rate_limited");
    if (response.status >= 500) throw new SmartAiGatewayError("upstream_unavailable");
    if (!response.ok) throw new SmartAiGatewayError("upstream_rejected");
    const result = await input.read(response);
    await completeAudit({
      reservation,
      status: "succeeded",
      outputUnits: Math.min(policy.maxOutputUnits, result.outputUnits),
      errorCode: null,
      deps: suppliedDeps,
    });
    return { value: result.value, fallback: false as const };
  } catch (cause) {
    const error = gatewayError(cause);
    const fallback = canUseLocalFallback(error) ? input.fallback?.(error) ?? null : null;
    if (reservation) {
      await completeAudit({
        reservation,
        status: fallback ? "fallback" : "failed",
        outputUnits: fallback?.outputUnits ?? 0,
        errorCode: error.code,
        deps: suppliedDeps,
      }).catch(() => undefined);
    }
    if (fallback) return { value: fallback.value, fallback: true as const };
    throw error;
  }
}

type ResponsesData = {
  output_text?: string;
  output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
};

function responseText(data: ResponsesData) {
  const direct = data.output_text?.trim();
  if (direct) return direct;
  return data.output
    ?.flatMap(item => item.content ?? [])
    .filter(item => item.type === "output_text" && typeof item.text === "string")
    .map(item => item.text!.trim())
    .filter(Boolean)
    .join("\n\n") ?? "";
}

const PUBLIC_GURU_FALLBACK = {
  zh: "智能导师暂时无法连接。您仍可查看语言路径、继续每日练习、进入“班级”创建或加入私有语言班，也可使用社区与消息。每位已登录会员均可作为教师或协调员创建私有班级。请勿提交敏感个人资料，稍后再试。",
  en: "Guru is temporarily unable to connect. You can still review Language Paths, continue daily practice, open Classes to create or join a private language class, or use Community and Messages. Please do not submit sensitive personal information, and try again later.",
} as const;

export async function askSmartAi(input: {
  feature: "public_guru" | "message_polish" | "chat_guru" | "content_help";
  subject: string;
  language: "zh" | "en";
  instructions: string;
  content: string;
  preserveOnFailure?: string;
  deps?: SmartAiGatewayDependencies;
}) {
  const fallbackText = input.feature === "public_guru"
    ? PUBLIC_GURU_FALLBACK[input.language]
    : input.feature === "message_polish"
      ? input.preserveOnFailure ?? ""
      : "";
  return executeGateway({
    feature: input.feature,
    subject: input.subject,
    inputUnits: input.content.length,
    deps: input.deps,
    request: (apiKey, subjectHash, signal, model) => dependencies(input.deps).fetch(
      "https://api.openai.com/v1/responses",
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
          "OpenAI-Safety-Identifier": subjectHash,
        },
        body: JSON.stringify({
          model,
          instructions: input.instructions,
          input: input.content,
          reasoning: { effort: "minimal" },
          text: { verbosity: "low" },
          max_output_tokens: policyFor(input.feature, input.deps ?? {}).maxOutputUnits,
        }),
        signal,
      },
    ),
    read: async response => {
      const data = await response.json().catch(() => null) as ResponsesData | null;
      const value = data ? responseText(data) : "";
      if (!value) throw new SmartAiGatewayError("invalid_response");
      return { value, outputUnits: value.length };
    },
    fallback: fallbackText ? () => ({ value: fallbackText, outputUnits: fallbackText.length }) : undefined,
  });
}

export async function generateSmartAiImage(input: {
  subject: string;
  prompt: string;
  deps?: SmartAiGatewayDependencies;
}) {
  return executeGateway({
    feature: "image",
    subject: input.subject,
    inputUnits: input.prompt.length,
    deps: input.deps,
    request: (apiKey, subjectHash, signal, model) => dependencies(input.deps).fetch(
      "https://api.openai.com/v1/images/generations",
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
          "OpenAI-Safety-Identifier": subjectHash,
        },
        body: JSON.stringify({
          model,
          prompt: input.prompt,
          size: "1024x1024",
          quality: "low",
          output_format: "png",
          n: 1,
        }),
        signal,
      },
    ),
    read: async response => {
      const data = await response.json().catch(() => null) as { data?: Array<{ b64_json?: string }> } | null;
      const value = data?.data?.[0]?.b64_json;
      if (!value || !/^[a-zA-Z0-9+/=]+$/.test(value)) throw new SmartAiGatewayError("invalid_response");
      return { value, outputUnits: 1 };
    },
  });
}

export async function reserveLiveVoiceAllowance(input: {
  userId: string;
  paid: boolean;
  deps?: SmartAiGatewayDependencies;
}) {
  if (input.paid) return;
  const deps = dependencies(input.deps);
  if (!deps.database) throw new SmartAiGatewayError("audit_unavailable");
  const now = Math.floor(deps.now() / 1000);
  const day = new Date(deps.now()).toISOString().slice(0, 10);
  const reserved = await deps.database.prepare(
    `INSERT INTO live_voice_usage (id, user_id, usage_date, used_seconds, updated_at)
     VALUES (?, ?, ?, 600, ?)
     ON CONFLICT(id) DO UPDATE SET used_seconds = 600, updated_at = excluded.updated_at
     WHERE live_voice_usage.used_seconds < 600
     RETURNING used_seconds`,
  ).bind(`${input.userId}:${day}`, input.userId, day, now).first<{ used_seconds: number }>();
  if (!reserved) {
    const tomorrow = Math.floor(Date.parse(`${day}T00:00:00.000Z`) / 1000) + 86_400;
    throw new SmartAiGatewayError("rate_limited", Math.max(1, tomorrow - now));
  }
}

export async function openSmartAiLiveVoice(input: {
  userId: string;
  subject: string;
  paid: boolean;
  sdp: string;
  instructions: string;
  deps?: SmartAiGatewayDependencies;
}) {
  if (!input.sdp || input.sdp.length > 100_000) throw new SmartAiGatewayError("invalid_request");
  await reserveLiveVoiceAllowance({ userId: input.userId, paid: input.paid, deps: input.deps });
  return executeGateway({
    feature: "live_voice",
    subject: input.subject,
    inputUnits: 600,
    deps: input.deps,
    request: (apiKey, subjectHash, signal, model) => {
      const form = new FormData();
      form.set("sdp", new Blob([input.sdp], { type: "application/sdp" }), "offer.sdp");
      form.set("session", new Blob([JSON.stringify({
        type: "realtime",
        model,
        instructions: input.instructions,
        audio: { output: { voice: "marin" } },
      })], { type: "application/json" }), "session.json");
      return dependencies(input.deps).fetch(
        "https://api.openai.com/v1/realtime/calls",
        {
          method: "POST",
          headers: {
            authorization: `Bearer ${apiKey}`,
            "OpenAI-Safety-Identifier": subjectHash,
          },
          body: form,
          signal,
        },
      );
    },
    read: async response => {
      const value = await response.text();
      if (!value.startsWith("v=") || value.length > 200_000) throw new SmartAiGatewayError("invalid_response");
      return { value, outputUnits: 0 };
    },
  });
}

export function safeSmartAiError(
  error: unknown,
  language: "zh" | "en",
  service: "guru" | "image" | "live",
) {
  const known = gatewayError(error);
  const messages = {
    zh: {
      invalid_request: "请求内容无效。",
      rate_limited: "请求过于频繁，请稍后再试。",
      guru: "智能导师暂时不可用，请稍后再试。",
      image: "邀请图片暂时无法生成，请稍后再试。",
      live: "实时语音暂时不可用，请稍后再试。",
    },
    en: {
      invalid_request: "The request is invalid.",
      rate_limited: "Too many requests. Please try again later.",
      guru: "Guru is temporarily unavailable. Please try again later.",
      image: "The invitation image cannot be generated right now. Please try again later.",
      live: "Live voice is temporarily unavailable. Please try again later.",
    },
  } as const;
  const copy = messages[language];
  const message = known.code === "invalid_request"
    ? copy.invalid_request
    : known.status === 429
      ? copy.rate_limited
      : copy[service];
  return { code: known.code, message, status: known.status, retryAfter: known.retryAfter };
}
