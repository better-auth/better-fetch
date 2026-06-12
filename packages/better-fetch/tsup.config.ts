import { defineConfig } from "tsup";

/**
 * Fetch API type stubs prepended to built .d.ts files.
 *
 * The built .d.ts references Fetch API types (Response, Headers, RequestInit, etc.)
 * as bare identifiers from lib.dom.d.ts. Consumers whose tsconfig does not include
 * "DOM" in lib (e.g., backend projects with lib: ["ESNext"]) get TS2304 errors.
 *
 * These module-scoped declarations shadow DOM globals when DOM is present and provide
 * the necessary types when it's absent. Since .d.ts files with export statements are
 * modules, these declarations are file-scoped and do not pollute the global namespace.
 */
const FETCH_API_STUBS = `// -- Fetch API type stubs (self-contained for non-DOM environments) --

// Simple string-literal union types
type RequestCache = "default" | "force-cache" | "no-cache" | "no-store" | "only-if-cached" | "reload";
type RequestCredentials = "include" | "omit" | "same-origin";
type RequestMode = "cors" | "navigate" | "no-cors" | "same-origin";
type RequestPriority = "auto" | "high" | "low";
type RequestRedirect = "error" | "follow" | "manual";
type ReferrerPolicy = "" | "no-referrer" | "no-referrer-when-downgrade" | "origin" | "origin-when-cross-origin" | "same-origin" | "strict-origin" | "strict-origin-when-cross-origin" | "unsafe-url";

// Timer — opaque handle compatible with all runtimes
type Timer = number | { ref(): void; unref(): void };

// ReadableStream — minimal stub for body types
interface ReadableStream<R = any> {
  readonly locked: boolean;
  getReader(): any;
}

// Fetch API interfaces — minimal subset covering usage in this package
interface Headers {
  append(name: string, value: string): void;
  delete(name: string): void;
  get(name: string): string | null;
  has(name: string): boolean;
  set(name: string, value: string): void;
  forEach(callbackfn: (value: string, key: string, parent: Headers) => void): void;
}
type HeadersInit = [string, string][] | Record<string, string> | Headers;

interface AbortSignal {
  readonly aborted: boolean;
  readonly reason: any;
}

interface AbortController {
  readonly signal: AbortSignal;
  abort(reason?: any): void;
}

interface Blob {
  readonly size: number;
  readonly type: string;
  text(): Promise<string>;
  arrayBuffer(): Promise<ArrayBuffer>;
}
declare var Blob: { new(blobParts?: any[], options?: any): Blob; prototype: Blob; };

interface File extends Blob {
  readonly name: string;
  readonly lastModified: number;
}
declare var File: { new(fileBits: any[], fileName: string, options?: any): File; prototype: File; };

interface URL {
  href: string;
  readonly origin: string;
  protocol: string;
  host: string;
  hostname: string;
  port: string;
  pathname: string;
  search: string;
  hash: string;
  toString(): string;
}

interface Response {
  readonly ok: boolean;
  readonly status: number;
  readonly statusText: string;
  readonly headers: Headers;
  readonly body: ReadableStream<Uint8Array> | null;
  readonly bodyUsed: boolean;
  readonly url: string;
  readonly redirected: boolean;
  json(): Promise<any>;
  text(): Promise<string>;
  blob(): Promise<Blob>;
  arrayBuffer(): Promise<ArrayBuffer>;
  clone(): Response;
}

interface RequestInit {
  method?: string;
  headers?: HeadersInit;
  body?: any;
  mode?: RequestMode;
  credentials?: RequestCredentials;
  cache?: RequestCache;
  redirect?: RequestRedirect;
  referrer?: string;
  referrerPolicy?: ReferrerPolicy;
  integrity?: string;
  keepalive?: boolean;
  signal?: AbortSignal | null;
  window?: null;
  priority?: RequestPriority;
  duplex?: string;
}

declare namespace globalThis {
  interface Request {
    readonly url: string;
    readonly method: string;
    readonly headers: Headers;
    readonly body: ReadableStream<Uint8Array> | null;
    clone(): globalThis.Request;
  }
}

// -- End Fetch API type stubs --
`;

export default defineConfig({
	entry: ["./src/index.ts"],
	splitting: false,
	sourcemap: true,
	format: ["esm", "cjs"],
	dts: {
		banner: FETCH_API_STUBS,
	},
	clean: true,
	external: ["zod"],
});
