import { type FetchEsque, createFetch } from "@better-fetch/fetch";
import { describe, expect, it, vi } from "vitest";
import { type LoggerOptions, logger } from "../src/index";

function mockConsole() {
	return {
		log: vi.fn(),
		error: vi.fn(),
		success: vi.fn(),
		fail: vi.fn(),
		warn: vi.fn(),
	};
}

function mockFetch(status: number, body?: unknown): FetchEsque {
	return async () =>
		new Response(body !== undefined ? JSON.stringify(body) : null, {
			status,
			statusText: status === 200 ? "OK" : status === 404 ? "Not Found" : "",
		});
}

function setup(
	loggerOptions: LoggerOptions = {},
	fetchImpl: FetchEsque = mockFetch(200, { ok: true }),
) {
	const cons = mockConsole();
	const $fetch = createFetch({
		baseURL: "http://localhost:3000",
		plugins: [logger({ console: cons, ...loggerOptions })],
		customFetchImpl: fetchImpl,
	});
	return { cons, $fetch };
}

const messageOf = (fn: { mock: { calls: unknown[][] } }, index = 0): string =>
	fn.mock.calls[index]?.[0] as string;

const messagesOf = (fn: { mock: { calls: unknown[][] } }): string[] =>
	fn.mock.calls.map((call) => call[0] as string);

describe("logger - default format", () => {
	it("logs method and url on request", async () => {
		const { cons, $fetch } = setup();

		await $fetch("/users");

		expect(cons.log).toHaveBeenCalledWith(
			expect.stringContaining("[GET] http://localhost:3000/users"),
		);
	});

	it("logs method, url, status and duration on success", async () => {
		const { cons, $fetch } = setup();

		await $fetch("/users");

		expect(cons.success).toHaveBeenCalledTimes(1);
		const msg = messageOf(cons.success);
		expect(msg).toContain("[GET] http://localhost:3000/users");
		expect(msg).toContain("200");
		expect(msg).toContain("OK");
		expect(msg).toMatch(/\(\d+ms\)/);
	});

	it("logs method, url, status and duration on error", async () => {
		const { cons, $fetch } = setup(
			{},
			mockFetch(404, { message: "not found" }),
		);

		await $fetch("/missing");

		expect(cons.fail).toHaveBeenCalledTimes(1);
		const msg = messageOf(cons.fail);
		expect(msg).toContain("[GET] http://localhost:3000/missing");
		expect(msg).toContain("404");
		expect(msg).toContain("Not Found");
		expect(msg).toMatch(/\(\d+ms\)/);
	});

	it("includes POST method for post requests", async () => {
		const { cons, $fetch } = setup();

		await $fetch("/users", { method: "POST", body: { name: "test" } });

		expect(cons.log).toHaveBeenCalledWith(expect.stringContaining("[POST]"));
		expect(cons.success).toHaveBeenCalledWith(
			expect.stringContaining("[POST]"),
		);
	});

	it("logs verbose data on success", async () => {
		const { cons, $fetch } = setup(
			{ verbose: true },
			mockFetch(200, { id: 1 }),
		);

		await $fetch("/users");

		expect(cons.success).toHaveBeenCalledTimes(1);
		expect(cons.log).toHaveBeenCalledWith({ id: 1 });
	});

	it("logs the error line on error", async () => {
		const { cons, $fetch } = setup(
			{ verbose: true },
			mockFetch(500, { error: "boom" }),
		);

		await $fetch("/fail");

		expect(cons.fail).toHaveBeenCalledTimes(1);
		const msg = messageOf(cons.fail);
		expect(msg).toContain("[GET] http://localhost:3000/fail");
		expect(msg).toContain("500");
	});

	it("produces one distinguishable log per parallel request", async () => {
		const slowFast: FetchEsque = async (input) => {
			if (input.toString().includes("/slow")) {
				await new Promise((r) => setTimeout(r, 50));
			}
			return new Response(null, { status: 200, statusText: "OK" });
		};
		const { cons, $fetch } = setup({}, slowFast);

		await Promise.all([$fetch("/slow"), $fetch("/fast")]);

		const messages = messagesOf(cons.success);
		expect(messages).toHaveLength(2);
		expect(messages.filter((m) => m.includes("/slow"))).toHaveLength(1);
		expect(messages.filter((m) => m.includes("/fast"))).toHaveLength(1);
	});
});

describe("logger - legacy format", () => {
	it("logs the original request message", async () => {
		const { cons, $fetch } = setup({ logFormat: "legacy" });

		await $fetch("/users");

		expect(cons.log).toHaveBeenCalledWith(
			"Request being sent to:",
			"http://localhost:3000/users",
		);
	});

	it("logs the original success message", async () => {
		const { cons, $fetch } = setup({ logFormat: "legacy" });

		await $fetch("/users");

		expect(cons.success).toHaveBeenCalledWith("Request succeeded", {
			ok: true,
		});
	});

	it("logs the original error message", async () => {
		const { cons, $fetch } = setup(
			{ logFormat: "legacy" },
			mockFetch(404, { message: "not found" }),
		);

		await $fetch("/missing");

		expect(cons.fail).toHaveBeenCalledWith(
			"Request failed with status: ",
			404,
			"(Not Found)",
		);
	});
});

describe("logger - disabled", () => {
	it("does not log when disabled", async () => {
		const { cons, $fetch } = setup({ enabled: false });

		await $fetch("/users");

		expect(cons.log).not.toHaveBeenCalled();
		expect(cons.success).not.toHaveBeenCalled();
		expect(cons.fail).not.toHaveBeenCalled();
		expect(cons.error).not.toHaveBeenCalled();
	});
});
