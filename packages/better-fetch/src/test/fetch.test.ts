import { createApp, toNodeListener } from "h3";
import { type Listener, listen } from "listhen";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { BetterFetchError, betterFetch, createFetch } from "..";
import { getURL } from "../url";
import { router } from "./test-router";

describe("fetch", () => {
	const getURL = (path?: string) =>
		path ? `http://localhost:4000/${path}` : "http://localhost:4000";

	let listener: Listener;

	beforeAll(async () => {
		const app = createApp().use(router);
		listener = await listen(toNodeListener(app), {
			port: 4000,
		});
	});

	afterAll(async () => {
		await listener.close().catch(console.error);
	});

	const $echo = createFetch({
		baseURL: getURL(),
	});

	it("ok", async () => {
		expect((await betterFetch(getURL("ok"))).data).to.equal("ok");
	});

	it("returns a blob for binary content-type", async () => {
		const { data } = await betterFetch<Blob>(getURL("binary"));
		expect(data).to.has.property("size");
	});

	it("baseURL", async () => {
		const { data } = await betterFetch("/ok", {
			baseURL: getURL(),
		});
		expect(data).to.equal("ok");
	});

	it("stringifies posts body automatically", async () => {
		const res = await betterFetch<{ body: { num: number } }>(getURL("post"), {
			method: "POST",
			body: { num: 42 },
		});
		expect(res.data?.body).toEqual({ num: 42 });
		const res2 = await betterFetch<any>(getURL("post"), {
			method: "POST",
			body: [{ num: 42 }, { num: 43 }],
		});
		expect(res2.data?.body).toEqual([{ num: 42 }, { num: 43 }]);
	});

	it("should work with headers", async () => {
		const headerFetches = [
			[["X-header", "1"]],
			{ "x-header": "1" },
			new Headers({ "x-header": "1" }),
		];

		for (const sentHeaders of headerFetches) {
			const res2 = await betterFetch<any>(getURL("post"), {
				method: "POST",
				body: { num: 42 },
				headers: sentHeaders as HeadersInit,
			});

			expect(res2.data.headers).to.include({ "x-header": "1" });
			expect(res2.data.headers).to.include({
				"content-type": "application/json",
			});
		}
	});

	it("should work with query params", async () => {
		const queries = [
			{ foo: "bar" },
			{
				foo: "bar",
				bar: "baz",
			},
		];

		for (const query of queries) {
			const response = await betterFetch<any>(getURL("query"), {
				method: "GET",
				query,
			});
			expect(response.data).toMatchObject(query);
		}
	});

	it("does not stringify body when content type != application/json", async () => {
		const message = '"Hallo von Pascal"';
		const { data } = await $echo<any>("/echo", {
			method: "POST",
			body: message,
			headers: { "Content-Type": "text/plain" },
		});
		expect(data?.body).toEqual(message);
	});

	it("Handle Buffer body", async () => {
		const message = "Hallo von Pascal";
		const { data } = await $echo<any>("/echo", {
			method: "POST",
			body: Buffer.from("Hallo von Pascal"),
			headers: { "Content-Type": "text/plain" },
		});
		expect(data?.body).to.deep.eq(message);
	});

	it("Bypass URLSearchParams body", async () => {
		const data = new URLSearchParams({ foo: "bar" });
		const { data: res } = await betterFetch<any>(getURL("post"), {
			method: "POST",
			body: data,
		});
		expect(res.body).toMatchObject({ foo: "bar" });
	});

	it("404", async () => {
		const { error, data } = await betterFetch<
			{
				test: string;
			},
			{
				statusCode: number;
				stack: [];
				statusMessage: string;
			}
		>(getURL("404"));

		expect(error).to.deep.eq({
			statusCode: 404,
			statusMessage: "Cannot find any path matching /404.",
			stack: [],
			status: 404,
			statusText: "Cannot find any path matching /404.",
		});
		expect(data).toBe(null);
	});

	it("204 no content", async () => {
		const { data } = await betterFetch(getURL("204"));

		expect(data).toEqual("");
	});

	it("HEAD no content", async () => {
		const { data } = await betterFetch(getURL("ok"), {
			method: "HEAD",
		});
		expect(data).toEqual("");
	});

	it("should retry on error", async () => {
		let count = 0;
		await betterFetch(getURL("error"), {
			retry: 3,
			onError() {
				count++;
			},
		});
		expect(count).toBe(4);
	});

	it("should retry with linear delay", async () => {
		let count = 0;

		const beforeCall = Date.now();
		let lastCallTime = 0;

		const fetchPromise = betterFetch(getURL("error"), {
			retry: {
				type: "linear",
				attempts: 3,
				delay: 200,
			},
			onError() {
				count++;
				lastCallTime = Date.now();
			},
		});

		await fetchPromise;

		expect(count).toBe(4);
		expect(lastCallTime - beforeCall).toBeGreaterThanOrEqual(200 * 3);
	});

	it("should retry with exponential backoff and increasing delays", async () => {
		let count = 0;
		const delays: number[] = [];
		let lastCallTime = 0;

		const fetchPromise = betterFetch(getURL("error"), {
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

		await fetchPromise;

		expect(count).toBe(4);

		expect(delays[1]).toBeGreaterThan(delays[0]);
		expect(delays[2]).toBeGreaterThan(delays[1]);

		expect(delays[0]).toBeGreaterThanOrEqual(100);
		expect(delays[1]).toBeGreaterThanOrEqual(200);
		expect(delays[2]).toBeGreaterThanOrEqual(400);
	});

	it("abort with retry", () => {
		const controller = new AbortController();
		async function abortHandle() {
			controller.abort();
			const response = await betterFetch("", {
				baseURL: getURL("ok"),
				retry: 3,
				signal: controller.signal,
			});
		}
		expect(abortHandle()).rejects.toThrow(/aborted/);
	});

	it("should work with params", async () => {
		const response = await betterFetch(getURL("param/:id"), {
			params: ["2"],
		});
		expect(response.data).toBe("/param/2");
	});

	it("should work with params", async () => {
		const response = await betterFetch(getURL("param/:id"), {
			params: ["2"],
		});
		expect(response.data).toBe("/param/2");
	});

	it("should work with method modifier string", async () => {
		const url = getURL();
		const response = await betterFetch("@post/method", {
			baseURL: url,
		});
		expect(response.data).toBe("POST");
		const response2 = await betterFetch("@get/method", {
			baseURL: url,
		});
		expect(response2.data).toBe("GET");
	});

	it("should set auth headers", async () => {
		const url = getURL("post");
		const res = await betterFetch<any>(url, {
			auth: {
				type: "Bearer",
				token: "test",
			},
			method: "POST",
		});

		expect(res.data.headers).to.include({
			authorization: "Bearer test",
		});
	});

	it("should work with async auth token", async () => {
		const url = getURL("post");
		const res = await betterFetch<any>(url, {
			auth: {
				type: "Bearer",
				token: async () => "test",
			},
			method: "POST",
		});

		expect(res.data.headers).to.include({
			authorization: "Bearer test",
		});
	});

	it("should set basic auth headers", async () => {
		const url = getURL("post");
		await betterFetch<any>(url, {
			auth: {
				type: "Basic",
				username: "test-user",
				password: "test-password",
			},
			onRequest: (req) => {
				expect(req.headers.get("authorization")).to.equal(
					"Basic dGVzdC11c2VyOnRlc3QtcGFzc3dvcmQ=",
				);
			},
		});
	});

	it("shet set basic auth headers with function for username and password", async () => {
		const url = getURL("post");
		await betterFetch<any>(url, {
			auth: {
				type: "Basic",
				username: () => "test-user",
				password: () => "test-password",
			},
			onRequest: (req) => {
				expect(req.headers.get("authorization")).to.equal(
					"Basic dGVzdC11c2VyOnRlc3QtcGFzc3dvcmQ=",
				);
			},
		});
	});
});

describe("fetch-error", () => {
	const f = createFetch({
		baseURL: "http://localhost:4001",
		customFetchImpl: async (req, init) => {
			return new Response(null, {
				status: 500,
			});
		},
		throw: true,
	});
	it("should throw if the response is not ok", async () => {
		await expect(f("/ok")).rejects.toThrowError(BetterFetchError);
	});
});

describe("hooks", () => {
	it("should call onRequest and onResponse", async () => {
		const onRequest = vi.fn();
		const onResponse = vi.fn();
		const f = createFetch({
			baseURL: "http://localhost:4001",
			customFetchImpl: async (req, init) => {
				return new Response(JSON.stringify({ message: "ok" }));
			},
			onRequest,
			onResponse,
		});
		await f("/ok");
		expect(onRequest).toHaveBeenCalled();
		expect(onResponse).toHaveBeenCalled();
	});

	it("should call onError", async () => {
		const onError = vi.fn();
		const onResponse = vi.fn();
		const onSuccess = vi.fn();
		const f = createFetch({
			baseURL: "http://localhost:4001",
			customFetchImpl: async (req, init) => {
				return new Response(
					JSON.stringify({
						message: "Server Error",
					}),
					{
						status: 500,
					},
				);
			},
			onError,
			onResponse,
			onSuccess,
		});
		await f("/ok");
		expect(onError).toHaveBeenCalledWith({
			request: expect.any(Object),
			response: expect.any(Response),
			responseText: '{"message":"Server Error"}',
			error: {
				message: "Server Error",
				status: 500,
				statusText: "",
			},
		});
		expect(onResponse).toHaveBeenCalled();
		expect(onSuccess).not.toHaveBeenCalled();
	});

	it("should work with relative url", async () => {
		const onRequest = vi.fn();
		const onResponse = vi.fn();
		const f = createFetch({
			customFetchImpl: async (req, init) => {
				return new Response(JSON.stringify({ message: "ok" }));
			},
			onRequest,
			onResponse,
		});
		const res = await f("/ok");
		expect(res.data).toMatchObject({ message: "ok" });
		expect(onRequest).toHaveBeenCalled();
		expect(onResponse).toHaveBeenCalled();
	});
});

describe("fetch-error-throw", () => {
	const f = createFetch({
		baseURL: "http://localhost:4001",
		customFetchImpl: async (req, init) => {
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
				return new Response("An error occurred", {
					status: 400,
				});
			}
			return new Response(null, {
				status: 500,
			});
		},
		throw: true,
	});
	it("should throw if the response is not ok", async () => {
		await expect(f("/not-ok")).rejects.toThrowError(BetterFetchError);
	});

	it("error should have error object if json returned", async () => {
		try {
			await f("/error-json-response");
		} catch (error) {
			if (error instanceof BetterFetchError) {
				expect(error.error).toEqual({ message: "error" });
			}
		}
	});

	it("error should have error string if text returned", async () => {
		try {
			await f("/error-string-response");
		} catch (error) {
			if (error instanceof BetterFetchError) {
				expect(error.error).toEqual("An error occurred");
			}
		}
	});

	it("should return data without error object", async () => {
		const res = await f<{ message: "ok" }>("/ok");
		expect(res).toEqual({ message: "ok" });
	});
});

describe("url", () => {
	it("should work with params", async () => {
		const url = getURL("param/:id", {
			params: {
				id: "1",
			},
			baseURL: "http://localhost:4001",
		});
		expect(url.toString()).toBe("http://localhost:4001/param/1");
	});

	it("should use the url base if the url starts with http", async () => {
		const url = getURL("http://localhost:4001/param/:id", {
			params: {
				id: "1",
			},
		});
		expect(url.toString()).toBe("http://localhost:4001/param/1");
	});

	it("should work with query params", async () => {
		const url = getURL("/query", {
			query: {
				id: "1",
			},
			baseURL: "http://localhost:4001",
		});
		expect(url.toString()).toBe("http://localhost:4001/query?id=1");
	});

	it("should not include nullable values in query params", async () => {
		const url = getURL("/query", {
			query: {
				id: "1",
				nullValue: null,
				undefinedValue: undefined,
			},
			baseURL: "http://localhost:4001",
		});
		expect(url.toString()).toBe("http://localhost:4001/query?id=1");
	});

	it("should work with dynamic params", async () => {
		const url = getURL("/param/:id", {
			params: {
				id: "1",
			},
			baseURL: "http://localhost:4001",
		});
		expect(url.toString()).toBe("http://localhost:4001/param/1");
	});

	it("should merge query from the url", async () => {
		const url = getURL("/query?name=test&age=20", {
			query: {
				id: "1",
			},
			baseURL: "http://localhost:4001",
		});
		expect(url.toString()).toBe(
			"http://localhost:4001/query?name=test&age=20&id=1",
		);
	});

	it("should give priority based on the order", async () => {
		const url = getURL("/query", {
			query: {
				id: "1",
				name: "test2",
			},
			baseURL: "http://localhost:4001",
		});
		expect(url.toString()).toBe("http://localhost:4001/query?id=1&name=test2");
	});

	it("should encode the query params", async () => {
		const url = getURL("/query", {
			query: {
				id: "#20",
				name: "test 2",
			},
			baseURL: "http://localhost:4001",
		});
		expect(url.toString()).toBe(
			"http://localhost:4001/query?id=%2320&name=test%202",
		);
	});

	it("should encode dynamic params", async () => {
		const url = getURL("/param/:id/:space", {
			params: {
				id: "#test",
				space: "item 1",
			},
			baseURL: "http://localhost:4001",
		});
		expect(url.toString()).toBe("http://localhost:4001/param/%23test/item%201");
	});

	it("dynamic params should not collide with url", async () => {
		const url = getURL("/v1/places:searchNearby", {
			baseURL: "http://localhost:4000",
			params: {
				searchNearby: "test",
			},
		});

		expect(url.toString()).toBe(
			"http://localhost:4000/v1/places:searchNearby",
		);
	});

	it("should expand array values into multiple query parameters", () => {
		const url = getURL("/test", {
			query: {
				filterValue: ["admin", "user"],
			},
			baseURL: "http://localhost:4000",
		});

		expect(url.toString()).toBe(
			"http://localhost:4000/test?filterValue=admin&filterValue=user",
		);
	});

	it("should preserve objects as JSON strings", () => {
		const url = getURL("/test", {
			query: {
				options: { page: 1, limit: 10 },
			},
			baseURL: "http://localhost:4000",
		});

		expect(url.toString()).toBe(
			"http://localhost:4000/test?options=%7B%22page%22%3A1%2C%22limit%22%3A10%7D",
		);
	});

	it("should leave strings untouched", () => {
		const url = getURL("/test", {
			query: { foo: "bar" },
			baseURL: "http://localhost:4000",
		});

		expect(url.toString()).toBe("http://localhost:4000/test?foo=bar");
	});
});
