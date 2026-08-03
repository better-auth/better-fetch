import { createApp, toNodeListener } from "h3";
import { type Listener, listen } from "listhen";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { BetterFetchError, betterFetch, createFetch } from "..";
import { router } from "./test-router";

describe("fetch", () => {
	const getURL = (path?: string) =>
		path ? `http://localhost:4000/${path}` : "http://localhost:4000";

	let listener: Listener;

	beforeAll(async () => {
		const app = createApp().use(router);
		listener = await listen(toNodeListener(app), { port: 4000 });
	});

	afterAll(async () => {
		await listener.close();
	});

	const $echo = createFetch({ baseURL: getURL() });

	it("returns the response body", async () => {
		const { data } = await betterFetch(getURL("ok"));
		expect(data).toBe("ok");
	});

	it("returns a blob for binary content-type", async () => {
		const { data } = await betterFetch<Blob>(getURL("binary"));
		expect(data).toHaveProperty("size");
	});

	it("prepends baseURL to a relative url", async () => {
		const { data } = await betterFetch("/ok", { baseURL: getURL() });
		expect(data).toBe("ok");
	});

	it("stringifies an object body automatically", async () => {
		const { data } = await betterFetch<{ body: { num: number } }>(
			getURL("post"),
			{ method: "POST", body: { num: 42 } },
		);
		expect(data?.body).toEqual({ num: 42 });
	});

	it("stringifies an array body automatically", async () => {
		const { data } = await betterFetch<{ body: { num: number }[] }>(
			getURL("post"),
			{ method: "POST", body: [{ num: 42 }, { num: 43 }] },
		);
		expect(data?.body).toEqual([{ num: 42 }, { num: 43 }]);
	});

	it.each([
		{ name: "array of tuples", headers: [["X-header", "1"]] as HeadersInit },
		{ name: "plain object", headers: { "x-header": "1" } as HeadersInit },
		{ name: "Headers instance", headers: new Headers({ "x-header": "1" }) },
	])("sends custom headers given a $name", async ({ headers }) => {
		const { data } = await betterFetch<any>(getURL("post"), {
			method: "POST",
			body: { num: 42 },
			headers,
		});
		expect(data.headers).toMatchObject({
			"x-header": "1",
			"content-type": "application/json",
		});
	});

	it.each<Record<string, string>>([
		{ foo: "bar" },
		{ foo: "bar", bar: "baz" },
	])("forwards query params %o", async (query) => {
		const { data } = await betterFetch<any>(getURL("query"), {
			method: "GET",
			query,
		});
		expect(data).toMatchObject(query);
	});

	it("does not stringify the body when content-type is not json", async () => {
		const message = '"Hallo von Pascal"';
		const { data } = await $echo<any>("/echo", {
			method: "POST",
			body: message,
			headers: { "Content-Type": "text/plain" },
		});
		expect(data?.body).toEqual(message);
	});

	it("passes a Buffer body through untouched", async () => {
		const message = "Hallo von Pascal";
		const { data } = await $echo<any>("/echo", {
			method: "POST",
			body: Buffer.from(message),
			headers: { "Content-Type": "text/plain" },
		});
		expect(data?.body).toEqual(message);
	});

	it("passes a URLSearchParams body through untouched", async () => {
		const { data } = await betterFetch<any>(getURL("post"), {
			method: "POST",
			body: new URLSearchParams({ foo: "bar" }),
		});
		expect(data.body).toMatchObject({ foo: "bar" });
	});

	it("returns a structured error for a 404", async () => {
		const { error, data } = await betterFetch<
			{ test: string },
			{ statusCode: number; stack: []; statusMessage: string }
		>(getURL("404"));

		expect(error).toEqual({
			statusCode: 404,
			statusMessage: "Cannot find any path matching /404.",
			stack: [],
			status: 404,
			statusText: "Cannot find any path matching /404.",
		});
		expect(data).toBeNull();
	});

	it("returns an empty body for a 204 response", async () => {
		const { data } = await betterFetch(getURL("204"));
		expect(data).toBe("");
	});

	it("returns an empty body for a HEAD request", async () => {
		const { data } = await betterFetch(getURL("ok"), { method: "HEAD" });
		expect(data).toBe("");
	});

	it("retries the configured number of times on error", async () => {
		let count = 0;
		await betterFetch(getURL("error"), {
			retry: 3,
			onError() {
				count++;
			},
		});
		expect(count).toBe(4);
	});

	it("waits a linear delay between retries", async () => {
		let count = 0;
		const beforeCall = Date.now();
		let lastCallTime = 0;

		await betterFetch(getURL("error"), {
			retry: { type: "linear", attempts: 3, delay: 200 },
			onError() {
				count++;
				lastCallTime = Date.now();
			},
		});

		expect(count).toBe(4);
		expect(lastCallTime - beforeCall).toBeGreaterThanOrEqual(200 * 3);
	});

	it("increases the delay with exponential backoff", async () => {
		let count = 0;
		const delays: number[] = [];
		let lastCallTime = 0;

		await betterFetch(getURL("error"), {
			retry: {
				type: "exponential",
				attempts: 3,
				baseDelay: 100,
				maxDelay: 1000,
			},
			onError() {
				count++;
				const currentTime = Date.now();
				if (lastCallTime > 0) {
					delays.push(currentTime - lastCallTime);
				}
				lastCallTime = currentTime;
			},
		});

		expect(count).toBe(4);
		expect(delays[1]).toBeGreaterThan(delays[0]);
		expect(delays[2]).toBeGreaterThan(delays[1]);
		expect(delays[0]).toBeGreaterThanOrEqual(100);
		expect(delays[1]).toBeGreaterThanOrEqual(200);
		expect(delays[2]).toBeGreaterThanOrEqual(400);
	});

	it("rejects when an already-aborted signal is passed", async () => {
		const controller = new AbortController();
		controller.abort();
		await expect(
			betterFetch("", {
				baseURL: getURL("ok"),
				retry: 3,
				signal: controller.signal,
			}),
		).rejects.toThrow(/aborted/);
	});

	it("resolves a dynamic path param", async () => {
		const { data } = await betterFetch(getURL("param/:id"), { params: ["2"] });
		expect(data).toBe("/param/2");
	});

	it("resolves the http method from a method modifier prefix", async () => {
		const baseURL = getURL();
		const post = await betterFetch("@post/method", { baseURL });
		expect(post.data).toBe("POST");
		const get = await betterFetch("@get/method", { baseURL });
		expect(get.data).toBe("GET");
	});

	it("sets a Bearer auth header", async () => {
		const { data } = await betterFetch<any>(getURL("post"), {
			method: "POST",
			auth: { type: "Bearer", token: "test" },
		});
		expect(data.headers).toMatchObject({ authorization: "Bearer test" });
	});

	it("sets a Bearer auth header from an async token", async () => {
		const { data } = await betterFetch<any>(getURL("post"), {
			method: "POST",
			auth: { type: "Bearer", token: async () => "test" },
		});
		expect(data.headers).toMatchObject({ authorization: "Bearer test" });
	});

	it("sets a Basic auth header from username and password", async () => {
		expect.hasAssertions();
		await betterFetch<any>(getURL("post"), {
			auth: {
				type: "Basic",
				username: "test-user",
				password: "test-password",
			},
			onRequest: (req) => {
				expect(req.headers.get("authorization")).toBe(
					"Basic dGVzdC11c2VyOnRlc3QtcGFzc3dvcmQ=",
				);
			},
		});
	});

	it("sets a Basic auth header from username and password resolvers", async () => {
		expect.hasAssertions();
		await betterFetch<any>(getURL("post"), {
			auth: {
				type: "Basic",
				username: () => "test-user",
				password: () => "test-password",
			},
			onRequest: (req) => {
				expect(req.headers.get("authorization")).toBe(
					"Basic dGVzdC11c2VyOnRlc3QtcGFzc3dvcmQ=",
				);
			},
		});
	});
});

describe("fetch-error", () => {
	const f = createFetch({
		baseURL: "http://localhost:4001",
		customFetchImpl: async () => new Response(null, { status: 500 }),
		throw: true,
	});

	it("throws a BetterFetchError when the response is not ok", async () => {
		await expect(f("/ok")).rejects.toThrowError(BetterFetchError);
	});
});

describe("hooks", () => {
	it("calls onRequest and onResponse", async () => {
		const onRequest = vi.fn();
		const onResponse = vi.fn();
		const f = createFetch({
			baseURL: "http://localhost:4001",
			customFetchImpl: async () => new Response(JSON.stringify({ message: "ok" })),
			onRequest,
			onResponse,
		});
		await f("/ok");
		expect(onRequest).toHaveBeenCalled();
		expect(onResponse).toHaveBeenCalled();
	});

	it("calls onError but not onSuccess on a failing response", async () => {
		const onError = vi.fn();
		const onResponse = vi.fn();
		const onSuccess = vi.fn();
		const f = createFetch({
			baseURL: "http://localhost:4001",
			customFetchImpl: async () =>
				new Response(JSON.stringify({ message: "Server Error" }), {
					status: 500,
				}),
			onError,
			onResponse,
			onSuccess,
		});
		await f("/ok");
		expect(onError).toHaveBeenCalledWith({
			request: expect.any(Object),
			response: expect.any(Response),
			responseText: '{"message":"Server Error"}',
			error: { message: "Server Error", status: 500, statusText: "" },
		});
		expect(onResponse).toHaveBeenCalled();
		expect(onSuccess).not.toHaveBeenCalled();
	});

	it("works with a relative url and a custom fetch impl", async () => {
		const onRequest = vi.fn();
		const onResponse = vi.fn();
		const f = createFetch({
			customFetchImpl: async () => new Response(JSON.stringify({ message: "ok" })),
			onRequest,
			onResponse,
		});
		const res = await f("/ok");
		expect(res.data).toMatchObject({ message: "ok" });
		expect(onRequest).toHaveBeenCalled();
		expect(onResponse).toHaveBeenCalled();
	});
});

describe("network-errors", () => {
	it("should call onError for network failures", async () => {
		const onError = vi.fn();
		const f = createFetch({
			baseURL: "http://localhost:9999",
			customFetchImpl: async () => {
				throw new TypeError("fetch failed");
			},
			onError,
		});

		const result = await f("/test");

		expect(onError).toHaveBeenCalledWith({
			response: undefined,
			request: expect.any(Object),
			error: expect.objectContaining({
				status: 0,
				statusText: "Network Error",
				message: "fetch failed",
			}),
		});
		expect(result.data).toBeNull();
		expect(result.error).toMatchObject({
			status: 0,
			statusText: "Network Error",
			message: "fetch failed",
		});
	});

	it("should return error object for network failures", async () => {
		const f = createFetch({
			baseURL: "http://localhost:9999",
			customFetchImpl: async () => {
				throw new TypeError("ECONNREFUSED");
			},
		});

		const result = await f("/test");

		expect(result.data).toBeNull();
		expect(result.error).toMatchObject({
			status: 0,
			statusText: "Network Error",
			message: "ECONNREFUSED",
		});
	});

	it("should throw for network failures when throw: true", async () => {
		const f = createFetch({
			baseURL: "http://localhost:9999",
			customFetchImpl: async () => {
				throw new TypeError("fetch failed");
			},
			throw: true,
		});

		await expect(f("/test")).rejects.toThrow(BetterFetchError);

		try {
			await f("/test");
		} catch (error) {
			if (error instanceof BetterFetchError) {
				expect(error.status).toBe(0);
				expect(error.statusText).toBe("Network Error");
			}
		}
	});

	it("should retry on network failure", async () => {
		let attempts = 0;
		const f = createFetch({
			baseURL: "http://localhost:9999",
			customFetchImpl: async () => {
				attempts++;
				if (attempts < 3) {
					throw new TypeError("fetch failed");
				}
				return new Response(JSON.stringify({ success: true }));
			},
			retry: 3,
		});

		const result = await f("/test");
		expect(attempts).toBe(3);
		expect(result.data).toEqual({ success: true });
	});

	it("should not call onSuccess for network failures", async () => {
		const onSuccess = vi.fn();
		const onError = vi.fn();
		const f = createFetch({
			baseURL: "http://localhost:9999",
			customFetchImpl: async () => {
				throw new TypeError("fetch failed");
			},
			onSuccess,
			onError,
		});

		await f("/test");
		expect(onSuccess).not.toHaveBeenCalled();
		expect(onError).toHaveBeenCalled();
	});

	it("should include original error in cause", async () => {
		const originalError = new TypeError("ECONNREFUSED");
		const onError = vi.fn();
		const f = createFetch({
			baseURL: "http://localhost:9999",
			customFetchImpl: async () => {
				throw originalError;
			},
			onError,
		});

		await f("/test");
		expect(onError).toHaveBeenCalledWith(
			expect.objectContaining({
				error: expect.objectContaining({
					cause: originalError,
				}),
			}),
		);
	});
});

describe("fetch-error-throw", () => {
	const f = createFetch({
		baseURL: "http://localhost:4001",
		customFetchImpl: async (req) => {
			const url = new URL(req.toString());
			if (url.pathname.startsWith("/ok")) {
				return new Response(JSON.stringify({ message: "ok" }));
			}
			if (url.pathname.startsWith("/error-json-response")) {
				return new Response(JSON.stringify({ message: "error" }), {
					status: 400,
				});
			}
			if (url.pathname.startsWith("/error-string-response")) {
				return new Response("An error occurred", { status: 400 });
			}
			return new Response(null, { status: 500 });
		},
		throw: true,
	});

	it("throws a BetterFetchError when the response is not ok", async () => {
		await expect(f("/not-ok")).rejects.toThrowError(BetterFetchError);
	});

	it("exposes the parsed JSON body on the thrown error", async () => {
		await expect(f("/error-json-response")).rejects.toMatchObject({
			error: { message: "error" },
		});
	});

	it("exposes the text body on the thrown error", async () => {
		await expect(f("/error-string-response")).rejects.toMatchObject({
			error: "An error occurred",
		});
	});

	it("returns data directly when throw is enabled and the response is ok", async () => {
		const res = await f<{ message: "ok" }>("/ok");
		expect(res).toEqual({ message: "ok" });
	});
});

describe("form data", () => {
	it("encodes an object body as form-urlencoded", async () => {
		const { data } = await betterFetch("/echo", {
			body: { name: "John Doe", age: 30 },
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			customFetchImpl: async (_req, init) =>
				new Response(JSON.stringify(init?.body), { status: 200 }),
		});
		expect(data).toBe("name=John+Doe&age=30");
	});
});
