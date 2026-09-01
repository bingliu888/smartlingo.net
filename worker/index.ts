/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { runClassMaintenance, type ClassMaintenanceEnvironment } from "../lib/class-maintenance";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  BUCKET: R2Bucket;
  CLASS_FILES: R2Bucket;
  CLOUDFLARE_REALTIME_API_TOKEN?: string;
  CLOUDFLARE_ACCOUNT_ID?: string;
  REALTIMEKIT_APP_ID?: string;
  REALTIMEKIT_GUEST_PRESET?: string;
  REALTIMEKIT_GUEST_AUDIO_PRESET?: string;
  REALTIMEKIT_MEMBER_PRESET?: string;
  REALTIMEKIT_MEMBER_AUDIO_PRESET?: string;
  REALTIMEKIT_HOST_PRESET?: string;
  REALTIMEKIT_HOST_AUDIO_PRESET?: string;
  REALTIMEKIT_VIEWER_PRESET?: string;
  REALTIMEKIT_VIEWER_AUDIO_PRESET?: string;
  REALTIMEKIT_WEBINAR_HOST_PRESET?: string;
  REALTIMEKIT_WEBINAR_SPEAKER_PRESET?: string;
  REALTIMEKIT_WEBINAR_VIEWER_PRESET?: string;
  REALTIMEKIT_LIVESTREAM_HOST_PRESET?: string;
  REALTIMEKIT_LIVESTREAM_SPEAKER_PRESET?: string;
  REALTIMEKIT_LIVESTREAM_VIEWER_PRESET?: string;
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?: string;
  CLERK_SECRET_KEY?: string;
  MIGRATION_EXPORT_SECRET?: string;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env | undefined, ctx: ExecutionContext): Promise<Response> {
    const runtimeEnv = env ?? ({} as Env);
    if (runtimeEnv.DB) (globalThis as unknown as { __SMARTLINGO_DB__?: D1Database }).__SMARTLINGO_DB__ = runtimeEnv.DB;
    if (runtimeEnv.BUCKET) (globalThis as unknown as { __SMARTLINGO_BUCKET__?: R2Bucket }).__SMARTLINGO_BUCKET__ = runtimeEnv.BUCKET;
    (globalThis as typeof globalThis & { __CLASS_RUNTIME_ENV__?: Env }).__CLASS_RUNTIME_ENV__ = runtimeEnv;
    const url = new URL(request.url);

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => runtimeEnv.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await runtimeEnv.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    return handler.fetch(request, runtimeEnv, ctx);
  },
  async scheduled(_controller: unknown, env: Env, ctx: ExecutionContext): Promise<void> {
    if (env.DB) (globalThis as unknown as { __SMARTLINGO_DB__?: D1Database }).__SMARTLINGO_DB__ = env.DB;
    if (env.BUCKET) (globalThis as unknown as { __SMARTLINGO_BUCKET__?: R2Bucket }).__SMARTLINGO_BUCKET__ = env.BUCKET;
    (globalThis as typeof globalThis & { __CLASS_RUNTIME_ENV__?: Env }).__CLASS_RUNTIME_ENV__ = env;
    ctx.waitUntil(runClassMaintenance(env as unknown as ClassMaintenanceEnvironment));
  },
};

export default worker;
