/** Minimal Cloudflare runtime declarations used by the Sites worker build. */
interface D1Result<T = Record<string, unknown>> {
  results?: T[];
  success: boolean;
  meta?: Record<string, unknown>;
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(columnName?: string): Promise<T | null>;
  run<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  raw<T = unknown[]>(options?: { columnNames?: boolean }): Promise<T[]>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = Record<string, unknown>>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
  exec(query: string): Promise<D1Result>;
  dump(): Promise<ArrayBuffer>;
}

interface R2ObjectBody {
  body: ReadableStream<Uint8Array>;
  httpEtag?: string;
  size?: number;
  arrayBuffer(): Promise<ArrayBuffer>;
}

interface R2ListedObject {
  key: string;
  size: number;
  etag: string;
  uploaded: Date;
  httpMetadata?: Record<string, unknown>;
  customMetadata?: Record<string, string>;
}

interface R2Objects {
  objects: R2ListedObject[];
  truncated: boolean;
  cursor?: string;
}

interface R2PutOptions {
  httpMetadata?: { contentType?: string };
  customMetadata?: Record<string, string>;
}

interface R2Bucket {
  get(key: string, options?: { range?: { offset: number; length: number } }): Promise<R2ObjectBody | null>;
  list(options?: {
    cursor?: string;
    limit?: number;
    include?: Array<"httpMetadata" | "customMetadata">;
  }): Promise<R2Objects>;
  put(
    key: string,
    value: ReadableStream | ArrayBuffer | ArrayBufferView | string | Blob,
    options?: R2PutOptions,
  ): Promise<{ etag?: string } | null>;
  delete(key: string): Promise<void>;
}

interface Fetcher {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

declare module "cloudflare:workers" {
  export const env: Record<string, unknown>;
}
