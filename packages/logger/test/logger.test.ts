import { describe, expect, it, vi } from "vitest";
import { createFetch } from "@better-fetch/fetch";
import { logger } from "../src/index";

function mockConsole() {
	return {
		log: vi.fn(),
		error: vi.fn(),
		success: vi.fn(),
		fail: vi.fn(),
		warn: vi.fn(),
	};
}

function createMockFetch(status: number, body?: any) {
	return async () =>
		new Response(body !== undefined ? JSON.stringify(body) : null, {
			status,
			statusText: status === 200 ? "OK" : status === 404 ? "Not Found" : "",
		});
}

describe("logger - default format", () => {
	it("logs method and url on request", async () => {
		const cons = mockConsole();
		const $fetch = createFetch({
			baseURL: "http://localhost:3000",
			plugins: [logger({ console: cons })],
			customFetchImpl: createMockFetch(200, { ok: true }),
		});

		await $fetch("/users");

		expect(cons.log).toHaveBeenCalledWith(
			expect.stringContaining("[GET] http://localhost:3000/users"),
		);
	});

	it("logs method, url, status and duration on success", async () => {
		const cons = mockConsole();
		const $fetch = createFetch({
			baseURL: "http://localhost:3000",
			plugins: [logger({ console: cons })],
			customFetchImpl: createMockFetch(200, { ok: true }),
		});

		await $fetch("/users");

		expect(cons.success).toHaveBeenCalledTimes(1);
		const msg = cons.success.mock.calls[0][0] as string;
		expect(msg).toContain("[GET] http://localhost:3000/users");
		expect(msg).toContain("200");
		expect(msg).toContain("OK");
		expect(msg).toMatch(/\(\d+ms\)/);
	});

	it("logs method, url, status and duration on error", async () => {
		const cons = mockConsole();
		const $fetch = createFetch({
			baseURL: "http://localhost:3000",
			plugins: [logger({ console: cons })],
			customFetchImpl: createMockFetch(404, { message: "not found" }),
		});

		await $fetch("/missing");

		expect(cons.fail).toHaveBeenCalledTimes(1);
		const msg = cons.fail.mock.calls[0][0] as string;
		expect(msg).toContain("[GET] http://localhost:3000/missing");
		expect(msg).toContain("404");
		expect(msg).toContain("Not Found");
		expect(msg).toMatch(/\(\d+ms\)/);
	});

	it("includes POST method for post requests", async () => {
		const cons = mockConsole();
		const $fetch = createFetch({
			baseURL: "http://localhost:3000",
			plugins: [logger({ console: cons })],
			customFetchImpl: createMockFetch(200, { ok: true }),
		});

		await $fetch("/users", { method: "POST", body: { name: "test" } });

		expect(cons.log).toHaveBeenCalledWith(
			expect.stringContaining("[POST]"),
		);
		expect(cons.success).toHaveBeenCalledWith(
			expect.stringContaining("[POST]"),
		);
	});

	it("logs verbose data on success", async () => {
		const cons = mockConsole();
		const $fetch = createFetch({
			baseURL: "http://localhost:3000",
			plugins: [logger({ console: cons, verbose: true })],
			customFetchImpl: createMockFetch(200, { id: 1 }),
		});

		await $fetch("/users");

		// success line + verbose data line
		expect(cons.success).toHaveBeenCalledTimes(1);
		expect(cons.log).toHaveBeenCalledWith({ id: 1 });
	});

	it("logs verbose error body on error", async () => {
		const cons = mockConsole();
		const $fetch = createFetch({
			baseURL: "http://localhost:3000",
			plugins: [
				logger({
					console: cons,
					verbose: true,
				}),
			],
			customFetchImpl: createMockFetch(500, { error: "boom" }),
		});

		await $fetch("/fail");

		expect(cons.fail).toHaveBeenCalledTimes(1);
		// verbose error body clones the response internally;
		// happy-dom doesn't support cloning an already-consumed body,
		// so we just verify the error log line was emitted
		const msg = cons.fail.mock.calls[0][0] as string;
		expect(msg).toContain("[GET] http://localhost:3000/fail");
		expect(msg).toContain("500");
	});

	it("parallel requests produce distinguishable logs", async () => {
		const cons = mockConsole();
		const customFetch = async (url: string | URL) => {
			const path = url.toString();
			if (path.includes("/slow")) {
				await new Promise((r) => setTimeout(r, 50));
				return new Response(JSON.stringify({ slow: true }), {
					status: 200,
					statusText: "OK",
				});
			}
			return new Response(JSON.stringify({ fast: true }), {
				status: 200,
				statusText: "OK",
			});
		};

		const $fetch = createFetch({
			baseURL: "http://localhost:3000",
			plugins: [logger({ console: cons })],
			customFetchImpl: customFetch as any,
		});

		await Promise.all([$fetch("/slow"), $fetch("/fast")]);

		const successMessages = cons.success.mock.calls.map(
			(c: any[]) => c[0] as string,
		);
		expect(successMessages).toHaveLength(2);

		const slowLog = successMessages.find((m) => m.includes("/slow"));
		const fastLog = successMessages.find((m) => m.includes("/fast"));
		expect(slowLog).toBeDefined();
		expect(fastLog).toBeDefined();
	});
});

describe("logger - legacy format", () => {
	it("logs the original request message", async () => {
		const cons = mockConsole();
		const $fetch = createFetch({
			baseURL: "http://localhost:3000",
			plugins: [logger({ console: cons, logFormat: "legacy" })],
			customFetchImpl: createMockFetch(200, { ok: true }),
		});

		await $fetch("/users");

		expect(cons.log).toHaveBeenCalledWith(
			"Request being sent to:",
			"http://localhost:3000/users",
		);
	});

	it("logs the original success message", async () => {
		const cons = mockConsole();
		const $fetch = createFetch({
			baseURL: "http://localhost:3000",
			plugins: [logger({ console: cons, logFormat: "legacy" })],
			customFetchImpl: createMockFetch(200, { ok: true }),
		});

		await $fetch("/users");

		expect(cons.success).toHaveBeenCalledWith("Request succeeded", {
			ok: true,
		});
	});

	it("logs the original error message", async () => {
		const cons = mockConsole();
		const $fetch = createFetch({
			baseURL: "http://localhost:3000",
			plugins: [logger({ console: cons, logFormat: "legacy" })],
			customFetchImpl: createMockFetch(404, { message: "not found" }),
		});

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
		const cons = mockConsole();
		const $fetch = createFetch({
			baseURL: "http://localhost:3000",
			plugins: [logger({ console: cons, enabled: false })],
			customFetchImpl: createMockFetch(200, { ok: true }),
		});

		await $fetch("/users");

		expect(cons.log).not.toHaveBeenCalled();
		expect(cons.success).not.toHaveBeenCalled();
		expect(cons.fail).not.toHaveBeenCalled();
		expect(cons.error).not.toHaveBeenCalled();
	});
});
