import { BetterFetchPlugin } from "@better-fetch/fetch";
import { createConsola } from "consola";
import { getStatusText } from "./util";

type ConsoleEsque = {
	log: (...args: any[]) => void;
	error: (...args: any[]) => void;
	success?: (...args: any[]) => void;
	fail?: (...args: any[]) => void;
	warn?: (...args: any[]) => void;
};

const c = createConsola({
	fancy: true,
	formatOptions: {
		columns: 80,
		colors: true,
		compact: 10,
		date: false,
	},
});

export interface LoggerOptions {
	/**
	 * Enable or disable the logger
	 * @default true
	 */
	enabled?: boolean;
	/**
	 * Custom console object
	 */
	console?: ConsoleEsque;
	/**
	 * Enable or disable verbose mode
	 */
	verbose?: boolean;
	/**
	 * Log format to use.
	 *
	 * - `"default"` — each log line includes the HTTP method, URL, status, and
	 *   duration so parallel requests are easy to distinguish.
	 * - `"legacy"` — the original log format from <= v1.1.x.
	 *
	 * @default "default"
	 */
	logFormat?: "default" | "legacy";
}

const defaultConsole: ConsoleEsque = {
	error(...args) {
		c.error("", ...args);
	},
	log(...args) {
		c.info("", ...args);
	},
	success(...args) {
		c.success("", ...args);
	},
	fail(...args) {
		c.fail("", ...args);
	},
	warn(...args) {
		c.warn("", ...args);
	},
};

const START = "@better-fetch/logger.start";

function formatPrefix(method: string, url: string | URL): string {
	return `[${method.toUpperCase()}] ${url.toString()}`;
}

function formatLine(
	request: {
		method: string;
		url: string | URL;
		context?: Record<string, unknown>;
	},
	response: Response,
): string {
	const status = response.status;
	const statusText = response.statusText || getStatusText(status);
	const start = request.context?.[START];
	const duration =
		typeof start === "number" ? ` (${Date.now() - start}ms)` : "";
	return `${formatPrefix(
		request.method,
		request.url,
	)} — ${status} ${statusText}${duration}`;
}

async function parseBody(response: Response): Promise<unknown> {
	try {
		return await response.clone().json();
	} catch {
		return undefined;
	}
}

export const logger = (options?: LoggerOptions) => {
	const opts = {
		console: defaultConsole,
		enabled: true,
		logFormat: "default" as const,
		...options,
	};
	const { enabled } = opts;
	const isLegacy = opts.logFormat === "legacy";

	return {
		id: "logger",
		name: "Logger",
		version: "1.0.0",
		hooks: {
			onRequest(context) {
				if (!enabled) return;
				if (context.context) {
					context.context[START] = Date.now();
				}
				if (isLegacy) {
					opts.console.log("Request being sent to:", context.url.toString());
					return;
				}
				opts.console.log(formatPrefix(context.method, context.url));
			},
			async onSuccess(context) {
				if (!enabled) return;
				const log = opts.console.success || opts.console.log;
				if (isLegacy) {
					log("Request succeeded", context.data);
					return;
				}
				log(formatLine(context.request, context.response));
				if (opts.verbose) {
					opts.console.log(context.data);
				}
			},
			onRetry(response) {
				if (!enabled) return;
				const log = opts.console.warn || opts.console.log;
				const attempt = (response.request.retryAttempt || 0) + 1;
				if (isLegacy) {
					log("Retrying request...", "Attempt:", attempt);
					return;
				}
				log(
					`${formatPrefix(
						response.request.method,
						response.request.url,
					)} — Retry attempt #${attempt}`,
				);
			},
			async onError(context) {
				if (!enabled) return;
				const log = opts.console.fail || opts.console.error;
				const body = opts.verbose
					? await parseBody(context.response)
					: undefined;
				if (isLegacy) {
					const status = context.response.status;
					const statusText =
						context.response.statusText || getStatusText(status);
					log("Request failed with status: ", status, `(${statusText})`);
				} else {
					log(formatLine(context.request, context.response));
				}
				if (body) {
					opts.console.error(body);
				}
			},
		},
	} satisfies BetterFetchPlugin;
};
