export type SmartAiFeature =
  | "public_guru"
  | "message_polish"
  | "chat_guru"
  | "content_help"
  | "listening_feedback"
  | "speaking_feedback"
  | "writing_feedback"
  | "scoring"
  | "moderation"
  | "image"
  | "live_voice";

export type SmartAiLearningFeature =
  | "listening_feedback"
  | "speaking_feedback"
  | "writing_feedback";

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
    failureMode: "local_fallback",
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
  listening_feedback: {
    model: "gpt-5-mini",
    maxInputUnits: 16_000,
    maxOutputUnits: 1_600,
    windowSeconds: 60,
    requestsPerWindow: 10,
    maxWindowInputUnits: 64_000,
    timeoutMs: 20_000,
    failureMode: "preserve_content",
  },
  speaking_feedback: {
    model: "gpt-5-mini",
    maxInputUnits: 16_000,
    maxOutputUnits: 1_600,
    windowSeconds: 60,
    requestsPerWindow: 10,
    maxWindowInputUnits: 64_000,
    timeoutMs: 20_000,
    failureMode: "preserve_content",
  },
  writing_feedback: {
    model: "gpt-5-mini",
    maxInputUnits: 16_000,
    maxOutputUnits: 2_000,
    windowSeconds: 60,
    requestsPerWindow: 10,
    maxWindowInputUnits: 64_000,
    timeoutMs: 20_000,
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
  subjectHashKey?: string | null;
  database?: SmartAiDatabase | null;
  fetch?: typeof fetch;
  now?: () => number;
  randomUUID?: () => string;
  policyOverrides?: Partial<Record<SmartAiFeature, Partial<SmartAiFeaturePolicy>>>;
};

export type SmartAiGatewayErrorCode =
  | "invalid_request"
  | "request_too_large"
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
  request_too_large: 413,
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
  const apiKey = input.apiKey === undefined ? process.env.OPENAI_API_KEY || "" : input.apiKey || "";
  return {
    apiKey,
    // The provider credential is already server-only and gives the audit hash
    // a keyed, non-enumerable identity without adding another hosted secret.
    // Tests may inject an independent key while deliberately omitting apiKey.
    subjectHashKey: input.subjectHashKey === undefined ? apiKey : input.subjectHashKey || "",
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

export async function smartAiSubjectHash(feature: SmartAiFeature, subject: string, secret: string) {
  if (!secret) throw new SmartAiGatewayError("audit_unavailable");
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign("HMAC", key, encoder.encode(`smartlingo:${feature}:${subject}`));
  return Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, "0")).join("");
}

export const SMARTAI_ASSISTANT_REQUEST_MAX_BYTES = 96 * 1024;

export async function readSmartAiRequestText(request: Request, maxBytes: number) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) throw new SmartAiGatewayError("invalid_request");
  const declaredValue = request.headers.get("content-length");
  if (declaredValue !== null) {
    const declared = Number(declaredValue);
    if (!Number.isSafeInteger(declared) || declared < 0) throw new SmartAiGatewayError("invalid_request");
    if (declared > maxBytes) throw new SmartAiGatewayError("request_too_large");
  }
  if (!request.body) return "";

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        void reader.cancel().catch(() => undefined);
        throw new SmartAiGatewayError("request_too_large");
      }
      chunks.push(value);
    }
  } catch (error) {
    if (isSmartAiGatewayError(error)) throw error;
    throw new SmartAiGatewayError("invalid_request");
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

export async function readSmartAiJsonRequest<T>(request: Request, maxBytes = SMARTAI_ASSISTANT_REQUEST_MAX_BYTES) {
  const text = await readSmartAiRequestText(request, maxBytes);
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new SmartAiGatewayError("invalid_request");
  }
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
  if (!deps.database || !deps.subjectHashKey) throw new SmartAiGatewayError("audit_unavailable");
  const now = Math.floor(deps.now() / 1000);
  const windowStart = Math.floor(now / policy.windowSeconds) * policy.windowSeconds;
  const subjectHash = await smartAiSubjectHash(input.feature, input.subject, deps.subjectHashKey);
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
  if (outputUnits) {
    const accumulated = await deps.database.prepare(
      "UPDATE smartlingo_ai_usage_windows SET output_units = output_units + ?, updated_at = ? WHERE id = ?",
    ).bind(outputUnits, now, input.reservation.usageWindowId).run();
    if (accumulated.success === false) throw new SmartAiGatewayError("audit_unavailable");
  }
  const completed = await deps.database.prepare(
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
  if (completed.success === false) throw new SmartAiGatewayError("audit_unavailable");
}

const canUseLocalFallback = (error: SmartAiGatewayError) =>
  error.code === "missing_key"
  || error.code === "audit_unavailable"
  || error.code === "timeout"
  || error.code === "network_error"
  || error.code === "upstream_rate_limited"
  || error.code === "upstream_rejected"
  || error.code === "upstream_unavailable"
  || error.code === "invalid_response";

type GatewayValue<T> = { value: T; outputUnits: number };
const SMARTAI_PROVIDER_RESPONSE_MAX_BYTES = 12 * 1024 * 1024;

async function bufferedSmartAiResponse(
  response: Response,
  signal: AbortSignal,
  setCancel: (cancel: (() => void) | null) => void,
) {
  if (!response.body) return response;
  const reader = response.body.getReader();
  setCancel(() => { void reader.cancel().catch(() => undefined); });
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > SMARTAI_PROVIDER_RESPONSE_MAX_BYTES) {
        void reader.cancel().catch(() => undefined);
        throw new SmartAiGatewayError("invalid_response");
      }
      chunks.push(value);
    }
  } finally {
    setCancel(null);
  }
  if (signal.aborted) throw new SmartAiGatewayError("timeout");

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new Response(total ? bytes : undefined, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}

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
    let cancelResponseBody: (() => void) | null = null;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const timedOut = new Promise<never>((_resolve, reject) => {
      timeout = setTimeout(() => {
        controller.abort();
        cancelResponseBody?.();
        reject(new SmartAiGatewayError("timeout"));
      }, policy.timeoutMs);
    });
    let result: GatewayValue<T>;
    try {
      result = await Promise.race([
        (async () => {
          const response = await input.request(deps.apiKey, reservation.subjectHash, controller.signal, policy.model);
          if (response.status === 429) throw new SmartAiGatewayError("upstream_rate_limited");
          if (response.status >= 500) throw new SmartAiGatewayError("upstream_unavailable");
          if (!response.ok) throw new SmartAiGatewayError("upstream_rejected");
          const buffered = await bufferedSmartAiResponse(
            response,
            controller.signal,
            cancel => { cancelResponseBody = cancel; },
          );
          const value = await input.read(buffered);
          if (controller.signal.aborted) throw new SmartAiGatewayError("timeout");
          return value;
        })(),
        timedOut,
      ]);
    } catch (error) {
      if (controller.signal.aborted) throw new SmartAiGatewayError("timeout");
      throw error;
    } finally {
      if (timeout) clearTimeout(timeout);
    }
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

const CHAT_GURU_FALLBACK = {
  zh: "人工智能导师暂时无法加入这段对话。原消息保持不变；请稍后重试，或继续与班级成员交流。人工智能反馈不是教师评价或正式考试结果。",
  en: "The AI Guru cannot join this conversation right now. The original messages remain unchanged; try again later or continue with class members. AI feedback is not a teacher evaluation or an official exam result.",
} as const;

type SmartAiTextFeature =
  | "public_guru"
  | "message_polish"
  | "chat_guru"
  | "content_help"
  | SmartAiLearningFeature;

function preservedTextFallback(input: {
  feature: SmartAiTextFeature;
  language: "zh" | "en";
  content: string;
  preserveOnFailure?: string;
  deps?: SmartAiGatewayDependencies;
}) {
  if (input.feature === "public_guru") return PUBLIC_GURU_FALLBACK[input.language];
  if (input.feature === "chat_guru") return CHAT_GURU_FALLBACK[input.language];
  const mode = policyFor(input.feature, input.deps ?? {}).failureMode;
  if (mode === "preserve_input" || mode === "preserve_content") {
    return input.preserveOnFailure ?? input.content;
  }
  return "";
}

export async function askSmartAi(input: {
  feature: SmartAiTextFeature;
  subject: string;
  language: "zh" | "en";
  instructions: string;
  content: string;
  preserveOnFailure?: string;
  deps?: SmartAiGatewayDependencies;
}) {
  const fallbackText = preservedTextFallback(input);
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

const LEARNING_FEEDBACK_INSTRUCTIONS: Readonly<Record<SmartAiLearningFeature, string>> = {
  listening_feedback: "Use only the supplied transcript, answer, and declared listening context. Explain likely comprehension gaps and suggest one small retry. Never claim to have heard audio that was not supplied.",
  speaking_feedback: "Give cautious practice feedback about intelligibility, the declared target sounds, wording, and rhythm. State uncertainty. Never infer nationality, ethnicity, disability, identity, intelligence, or personal worth from speech.",
  writing_feedback: "Give rubric-based suggestions for task completion, clarity, grammar, and vocabulary while preserving the learner's authorship. Do not complete an assignment, examination, or credential submission for the learner.",
};

const LEARNING_FEEDBACK_BOUNDARY = "You are an artificial intelligence practice assistant, not a human teacher or official examiner. Your feedback is provisional learning support, not a credential, score guarantee, admission decision, employment decision, or immigration result. Protect personal data, identify uncertainty, and never invent progress or completion.";

export async function reviewSmartAiLearningContent(input: {
  feature: SmartAiLearningFeature;
  subject: string;
  language: "zh" | "en";
  content: string;
  instructions?: string;
  deps?: SmartAiGatewayDependencies;
}) {
  return askSmartAi({
    feature: input.feature,
    subject: input.subject,
    language: input.language,
    instructions: [
      LEARNING_FEEDBACK_BOUNDARY,
      LEARNING_FEEDBACK_INSTRUCTIONS[input.feature],
      `Respond in ${input.language === "zh" ? "Simplified Chinese" : "English"}.`,
      input.instructions?.trim() ?? "",
    ].filter(Boolean).join("\n"),
    content: input.content,
    preserveOnFailure: input.content,
    deps: input.deps,
  });
}

export type SmartAiSafetyReview = {
  allowed: boolean;
  flagged: boolean;
  categories: string[];
  humanReviewRequired: boolean;
};

const QUARANTINE_REVIEW: SmartAiSafetyReview = {
  allowed: false,
  flagged: true,
  categories: ["review_required"],
  humanReviewRequired: true,
};

export async function reviewSmartAiSafety(input: {
  subject: string;
  content: string;
  deps?: SmartAiGatewayDependencies;
}) {
  return executeGateway({
    feature: "moderation",
    subject: input.subject,
    inputUnits: input.content.length,
    deps: input.deps,
    request: (apiKey, subjectHash, signal, model) => dependencies(input.deps).fetch(
      "https://api.openai.com/v1/moderations",
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
          "OpenAI-Safety-Identifier": subjectHash,
        },
        body: JSON.stringify({ model, input: input.content }),
        signal,
      },
    ),
    read: async response => {
      const data = await response.json().catch(() => null) as {
        results?: Array<{ flagged?: unknown; categories?: Record<string, unknown> }>;
      } | null;
      const result = data?.results?.[0];
      if (!result || typeof result.flagged !== "boolean" || !result.categories || typeof result.categories !== "object") {
        throw new SmartAiGatewayError("invalid_response");
      }
      const categories = Object.entries(result.categories)
        .filter(([, value]) => value === true)
        .map(([name]) => name)
        .sort();
      const value: SmartAiSafetyReview = {
        allowed: !result.flagged,
        flagged: result.flagged,
        categories,
        humanReviewRequired: result.flagged,
      };
      return { value, outputUnits: 1 };
    },
    fallback: () => ({ value: { ...QUARANTINE_REVIEW, categories: [...QUARANTINE_REVIEW.categories] }, outputUnits: 0 }),
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

async function releaseLiveVoiceAllowance(input: {
  userId: string;
  deps?: SmartAiGatewayDependencies;
}) {
  const deps = dependencies(input.deps);
  if (!deps.database) return;
  const now = Math.floor(deps.now() / 1000);
  const day = new Date(deps.now()).toISOString().slice(0, 10);
  const released = await deps.database.prepare(
    `UPDATE live_voice_usage SET used_seconds = 0, updated_at = ?
     WHERE id = ? AND user_id = ? AND usage_date = ? AND used_seconds = 600`,
  ).bind(now, `${input.userId}:${day}`, input.userId, day).run();
  if (released.success === false) throw new SmartAiGatewayError("audit_unavailable");
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
  try {
    return await executeGateway({
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
  } catch (error) {
    if (!input.paid) {
      await releaseLiveVoiceAllowance({ userId: input.userId, deps: input.deps }).catch(() => undefined);
    }
    throw error;
  }
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
      request_too_large: "请求内容过大。",
      rate_limited: "请求过于频繁，请稍后再试。",
      guru: "智能导师暂时不可用，请稍后再试。",
      image: "邀请图片暂时无法生成，请稍后再试。",
      live: "实时语音暂时不可用，请稍后再试。",
    },
    en: {
      invalid_request: "The request is invalid.",
      request_too_large: "The request is too large.",
      rate_limited: "Too many requests. Please try again later.",
      guru: "Guru is temporarily unavailable. Please try again later.",
      image: "The invitation image cannot be generated right now. Please try again later.",
      live: "Live voice is temporarily unavailable. Please try again later.",
    },
  } as const;
  const copy = messages[language];
  const message = known.code === "invalid_request" || known.code === "request_too_large"
    ? copy[known.code]
    : known.status === 429
      ? copy.rate_limited
      : copy[service];
  return { code: known.code, message, status: known.status, retryAfter: known.retryAfter };
}
