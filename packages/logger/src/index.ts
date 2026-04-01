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

function formatPrefix(method: string, url: string | URL): string {
	return `[${method.toUpperCase()}] ${url.toString()}`;
}

function formatDuration(startTime: number | undefined): string {
	if (startTime === undefined) return "";
	const ms = Date.now() - startTime;
	return ` (${ms}ms)`;
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
	const startTimes = new WeakMap<object, number>();

	return {
		id: "logger",
		name: "Logger",
		version: "1.0.0",
		hooks: {
			onRequest(context) {
				if (!enabled) return;
				startTimes.set(context, Date.now());
				if (isLegacy) {
					opts.console.log(
						"Request being sent to:",
						context.url.toString(),
					);
					return;
				}
				opts.console.log(
					formatPrefix(context.method, context.url),
				);
			},
			async onSuccess(context) {
				if (!enabled) return;
				const log = opts.console.success || opts.console.log;
				if (isLegacy) {
					log("Request succeeded", context.data);
					return;
				}
				const duration = formatDuration(
					startTimes.get(context.request),
				);
				const status = context.response.status;
				const statusText =
					context.response.statusText || getStatusText(status);
				log(
					`${formatPrefix(context.request.method, context.request.url)} — ${status} ${statusText}${duration}`,
				);
				if (opts.verbose) {
					opts.console.log(context.data);
				}
			},
			onRetry(response) {
				if (!enabled) return;
				const log = opts.console.warn || opts.console.log;
				if (isLegacy) {
					log(
						"Retrying request...",
						"Attempt:",
						(response.request.retryAttempt || 0) + 1,
					);
					return;
				}
				const attempt = (response.request.retryAttempt || 0) + 1;
				log(
					`${formatPrefix(response.request.method, response.request.url)} — Retry attempt #${attempt}`,
				);
			},
			async onError(context) {
				if (!enabled) return;
				const log = opts.console.fail || opts.console.error;
				if (isLegacy) {
					let obj: any;
					try {
						if (opts.verbose) {
							const res = context.response.clone();
							const json = await res.json();
							if (json) {
								obj = json;
							}
						}
					} catch (e) {}
					log(
						"Request failed with status: ",
						context.response.status,
						`(${
							context.response.statusText ||
							getStatusText(context.response.status)
						})`,
					);
					opts.verbose && obj && opts.console.error(obj);
					return;
				}
				const duration = formatDuration(
					startTimes.get(context.request),
				);
				const status = context.response.status;
				const statusText =
					context.response.statusText || getStatusText(status);
				log(
					`${formatPrefix(context.request.method, context.request.url)} — ${status} ${statusText}${duration}`,
				);
				if (opts.verbose) {
					let obj: any;
					try {
						const res = context.response.clone();
						const json = await res.json();
						if (json) {
							obj = json;
						}
					} catch (e) {}
					if (obj) {
						opts.console.error(obj);
					}
				}
			},
		},
	} satisfies BetterFetchPlugin;
};
