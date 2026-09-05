import { createApp, toNodeListener } from "h3";
import { type Listener, listen } from "listhen";
import {
	afterAll,
	beforeAll,
	describe,
	expect,
	expectTypeOf,
	it,
} from "vitest";
import { z } from "zod";
import {
	BetterFetch,
	type FetchSchemaRoutes,
	type InferParamPath,
	createFetch,
	createSchema,
	methods,
} from "../create-fetch";
import type { BetterFetchResponse } from "../types";

import type { BetterFetchPlugin } from "../plugins";
import { ValidationError } from "../utils";
import { router } from "./test-router";

const schema = {
	"/": {
		output: z.object({
			message: z.string(),
		}),
	},
	"/signin": {
		input: z.object({
			username: z.string(),
			password: z.string(),
		}),
		output: z.object({
			token: z.string(),
		}),
	},
	"/signup": {
		input: z.object({
			username: z.string(),
			password: z.string(),
			optional: z.optional(z.string()),
		}),
		output: z.object({
			message: z.string(),
		}),
	},
	"/query": {
		query: z.object({
			term: z.string(),
		}),
	},
	"/user": {
		params: z.object({
			id: z.number(),
		}),
	},
	"/user/:id": {},
	"@post/method": {},
	"@get/method": {},
	"@delete/method": {},
	"@put/method": {},
	"@patch/method": {},
} satisfies FetchSchemaRoutes;

describe("create-fetch-runtime-test", () => {
	const $fetch = createFetch({
		baseURL: "http://localhost:4001",
		schema: createSchema(schema),
	});

	let listener: Listener;
	beforeAll(async () => {
		const app = createApp().use(router);
		listener = await listen(toNodeListener(app), {
			port: 4001,
		});
	});
	afterAll(async () => {
		await listener.close();
	});

	it("should merge baseURL and url", async () => {
		const $fetch = createFetch({
			baseURL: "http://localhost:4001",
			schema: createSchema(schema),
			customFetchImpl: async (req, init) => {
				return new Response(null, {
					status: 200,
				});
			},
		});
		await $fetch("/echo", {
			baseURL: "http://localhost:4001",
			body: { id: 1 },
			onRequest(context) {
				expect(context.url.toString()).toBe("http://localhost:4001/echo");
			},
		});
		await $fetch("/path", {
			baseURL: "http://localhost:4001/v1",
			body: { id: 1 },
			onRequest(context) {
				expect(context.url.toString()).toBe("http://localhost:4001/v1/path");
			},
		});

		await $fetch("/path", {
			baseURL: "http://localhost:4001/v1/",
			body: { id: 1 },
			onRequest(context) {
				expect(context.url.toString()).toBe("http://localhost:4001/v1/path");
			},
		});

		await $fetch("/path/", {
			baseURL: "http://localhost:4001/v1/",
			body: { id: 1 },
			onRequest(context) {
				expect(context.url.toString()).toBe("http://localhost:4001/v1/path/");
			},
		});
	});

	it("should validate response and throw if validation fails", async () => {
		const f = createFetch({
			schema: createSchema({
				"/post": {
					output: z.object({
						id: z.number(),
					}),
				},
			}),
			baseURL: "http://localhost:4001",
			customFetchImpl: async (url, req) => {
				return new Response();
			},
		});
		await expect(f("/post")).rejects.toThrowError(ValidationError);
	});

	it("should parse params and other inputs", async () => {
		const $fetch = createFetch({
			schema: createSchema({
				"/path/:code/:phone": {
					params: z.object({
						code: z.number().default(1),
						phone: z.string().default("123456789"),
					}),
					input: z.object({
						code: z.number().default(1),
						phone: z.string(),
					}),
					query: z.object({
						code: z.number(),
						phone: z.string().default("123"),
					}),
				},
			}),
			baseURL: "http://localhost:4001",
			customFetchImpl: async (url, req) => {
				return new Response();
			},
			onRequest(context) {
				expect(context.params).toEqual({ code: 1, phone: "123456789" });
				expect(JSON.parse(context.body)).toEqual({ code: 1, phone: "test" });
				expect(context.query).toEqual({ code: 1, phone: "123" });
			},
		});
		await $fetch("/path/:code/:phone", {
			params: {
				code: 1,
			},
			body: {
				phone: "test",
			},
			query: {
				code: 1,
			},
		});
	});

	it.each([
		{ name: "object", querySchema: z.object({ id: z.string() }) },
		{
			name: "strict object",
			querySchema: z.object({ id: z.string() }).strict(),
		},
	])(
		"merges instance query values with a $name schema",
		async ({ querySchema }) => {
			let requestURL = "";
			const fetch = createFetch({
				baseURL: "https://example.com",
				query: { apiKey: "secret" },
				schema: createSchema({
					"/movies": {
						query: querySchema,
					},
				}),
				customFetchImpl: async (input) => {
					requestURL = input.toString();
					return new Response();
				},
			});

			await fetch("/movies", { query: { id: "42" } });

			expect(requestURL).toBe("https://example.com/movies?apiKey=secret&id=42");
		},
	);

	it.each([
		{
			apiKey: "request",
			expected: "https://example.com/movies?apiKey=request&id=42",
		},
		{ apiKey: undefined, expected: "https://example.com/movies?id=42" },
		{ apiKey: null, expected: "https://example.com/movies?id=42" },
	])(
		"preserves an instance query override of $apiKey outside the schema",
		async ({ apiKey, expected }) => {
			let requestURL = "";
			const fetch = createFetch({
				baseURL: "https://example.com",
				query: { apiKey: "global" },
				schema: createSchema({
					"/movies": { query: z.object({ id: z.string() }) },
				}),
				customFetchImpl: async (input) => {
					requestURL = input.toString();
					return new Response();
				},
			});
			const query = { apiKey, id: "42", extra: "stripped" };

			await fetch("/movies", { query });

			expect(requestURL).toBe(expected);
			expect(query).toEqual({ apiKey, id: "42", extra: "stripped" });
		},
	);

	it("rejects unknown request keys in a strict query schema", async () => {
		let requestCount = 0;
		const fetch = createFetch({
			baseURL: "https://example.com",
			query: { apiKey: "global" },
			schema: createSchema({
				"/movies": { query: z.object({ id: z.string() }).strict() },
			}),
			customFetchImpl: async () => {
				requestCount++;
				return new Response();
			},
		});
		const query = { id: "42", extra: "invalid" };

		await expect(fetch("/movies", { query })).rejects.toBeInstanceOf(
			ValidationError,
		);
		expect(requestCount).toBe(0);
	});

	it.each([
		{ name: "no schema", schema: undefined },
		{ name: "unmatched route", schema: createSchema({ "/other": {} }) },
		{
			name: "route without query validation",
			schema: createSchema({ "/movies": {} }),
		},
	])("merges instance query with $name", async ({ schema }) => {
		let requestURL = "";
		const fetch = createFetch({
			baseURL: "https://example.com",
			query: { apiKey: "global", id: "default" },
			...(schema !== undefined && { schema }),
			customFetchImpl: async (input) => {
				requestURL = input.toString();
				return new Response();
			},
		});

		await fetch("/movies", { query: { id: "42" } });

		expect(requestURL).toBe("https://example.com/movies?apiKey=global&id=42");
	});

	it("validates instance query when request query is omitted", async () => {
		let requestURL = "";
		const fetch = createFetch({
			baseURL: "https://example.com",
			query: { id: "movie" },
			schema: createSchema({
				"/movies": {
					query: z
						.object({ id: z.string().transform((id) => id.toUpperCase()) })
						.optional(),
				},
			}),
			customFetchImpl: async (input) => {
				requestURL = input.toString();
				return new Response();
			},
		});

		await fetch("/movies");

		expect(requestURL).toBe("https://example.com/movies?id=MOVIE");
	});

	it("skips query validation when disabled and preserves merged values", async () => {
		let requestURL = "";
		const fetch = createFetch({
			baseURL: "https://example.com",
			query: { apiKey: "secret", id: "default" },
			schema: createSchema({
				"/movies": {
					query: z.object({ id: z.string().regex(/^valid-/) }),
				},
			}),
			customFetchImpl: async (input) => {
				requestURL = input.toString();
				return new Response();
			},
		});

		await fetch("/movies", { query: { id: "42" }, disableValidation: true });

		expect(requestURL).toBe("https://example.com/movies?apiKey=secret&id=42");
	});

	it("uses validated query values over instance defaults", async () => {
		let requestURL = "";
		const fetch = createFetch({
			baseURL: "https://example.com",
			query: { apiKey: "secret", id: "default" },
			schema: createSchema({
				"/movies": {
					query: z.object({
						id: z.string().transform((id) => id.toUpperCase()),
					}),
				},
			}),
			customFetchImpl: async (input) => {
				requestURL = input.toString();
				return new Response();
			},
		});

		await fetch("/movies", { query: { id: "movie" } });

		expect(requestURL).toBe(
			"https://example.com/movies?apiKey=secret&id=MOVIE",
		);
	});

	it.each([
		{ name: "undefined", output: undefined, expected: undefined },
		{ name: "null", output: null, expected: null },
		{ name: "string", output: "movie", expected: "movie" },
		{
			name: "array",
			output: ["movie"],
			expected: { apiKey: "secret", 0: "movie" },
		},
		{
			name: "object",
			output: { id: "42" },
			expected: { apiKey: "secret", id: "42" },
		},
	])(
		"preserves existing behavior for $name query outputs",
		async ({ output, expected }) => {
			let requestQuery: unknown;
			const fetch = createFetch({
				baseURL: "https://example.com",
				query: { apiKey: "secret" },
				schema: createSchema({
					"/movies": {
						query: z.object({ id: z.string() }).transform(() => output),
					},
				}),
				customFetchImpl: async () => new Response(),
				onRequest(context) {
					requestQuery = context.query;
				},
			});

			await fetch("/movies", { query: { id: "42" } });

			expect(requestQuery).toEqual(expected);
		},
	);

	it("applies a default query when options are omitted", async () => {
		let requestQuery: unknown;
		const fetch = createFetch({
			baseURL: "https://example.com",
			schema: createSchema({
				"/movies": {
					query: z
						.object({ include: z.array(z.string()) })
						.default({ include: ["recommendations"] }),
				},
			}),
			customFetchImpl: async () => new Response(),
			onRequest(context) {
				requestQuery = context.query;
			},
		});

		await fetch("/movies");

		expect(requestQuery).toEqual({ include: ["recommendations"] });
	});

	it("should validate response and return data if validation passes", async () => {
		const res = await $fetch("/echo", {
			output: z.object({
				path: z.any(),
				body: z.object({ id: z.number().transform((v) => v + 1) }),
				headers: z.any(),
			}),
			body: { id: 1 },
		});

		expect(res.data).toEqual({
			path: "/echo",
			body: { id: 2 },
			headers: expect.any(Object),
		});
	});

	it("should work with method modifiers", async () => {
		const $f = createFetch({
			baseURL: "http://localhost:4001",
			schema: createSchema({
				[`@put/method`]: {},
				[`@post/method`]: {},
				[`@delete/method`]: {},
				[`@get/method`]: {},
				[`@patch/method`]: {},
			}),
			customFetchImpl: async (req, init) => {
				return new Response(JSON.stringify({ method: init?.method }));
			},
		});
		for (const method of methods.slice(0, 4)) {
			const res = await $f(`@${method}/method`);
			expect(res.data).toEqual({ method: method.toUpperCase() });
		}
	});

	it("treats literal colons as path text", async () => {
		let requestURL = "";
		const fetch = createFetch({
			baseURL: "https://places.googleapis.com",
			schema: createSchema({
				"/v1/places:searchNearby": {},
			}),
			customFetchImpl: async (input) => {
				requestURL = input.toString();
				return new Response();
			},
		});

		await fetch("/v1/places:searchNearby");

		expect(requestURL).toBe(
			"https://places.googleapis.com/v1/places:searchNearby",
		);
	});

	it("should apply method", async () => {
		const $f = createFetch({
			baseURL: "http://localhost:4001",
			schema: createSchema({
				"/": {
					method: "put",
					input: z.object({
						userId: z.string(),
						id: z.number(),
						title: z.string(),
						completed: z.boolean(),
					}),
				},
			}),
			customFetchImpl: async (req, init) => {
				return new Response(
					JSON.stringify({
						method: init?.method,
					}),
				);
			},
		});
		const res = await $f("/", {
			body: {
				userId: "1",
				id: 1,
				title: "title",
				completed: true,
			},
		});
		expect(res.data).toMatchObject({
			method: "PUT",
		});
	});

	it("applies a method modifier after a schema prefix", async () => {
		let request: { method: string; url: string } | undefined;
		const fetch = createFetch({
			baseURL: "https://example.com",
			schema: createSchema(
				{ "@put/me/profile": {} },
				{ prefix: "/api/v1/", strict: true },
			),
			customFetchImpl: async (input, init) => {
				request = {
					method: init?.method ?? "",
					url: input.toString(),
				};
				return new Response();
			},
		});

		await fetch("/api/v1/@put/me/profile");

		expect(request).toEqual({
			method: "PUT",
			url: "https://example.com/api/v1/me/profile",
		});
	});

	it("keeps the request-context identity stable across replacing hooks", async () => {
		const seen: object[] = [];
		const capture = (id: string): BetterFetchPlugin => ({
			id,
			name: id,
			hooks: {
				// returning a replacement must not break per-request identity
				onRequest(context) {
					seen.push(context);
					return { ...context };
				},
			},
		});
		const $fetch = createFetch({
			baseURL: "http://localhost:4001",
			customFetchImpl: async () => new Response(null, { status: 200 }),
			plugins: [capture("a"), capture("b")],
		});

		let successRequest: object | undefined;
		await $fetch("/", {
			onSuccess(context) {
				successRequest = context.request;
			},
		});

		expect(seen).toHaveLength(2);
		expect(seen[1]).toBe(seen[0]);
		expect(successRequest).toBe(seen[0]);
	});
});

describe("create-fetch-type-test", () => {
	const $fetch = createFetch({
		baseURL: "http://localhost:4001",
		customFetchImpl: async (req, init) => {
			return new Response();
		},
		schema: createSchema(schema),
		catchAllError: true,
		disableValidation: true,
	});

	it("should be data when throw is true", async () => {
		const res = await $fetch("/", {
			throw: true,
		});
		expectTypeOf(res).toMatchTypeOf<{ message: string }>();
	});

	it("should return unknown if no output is defined", () => {
		const res = $fetch("/");
		expectTypeOf(res).toMatchTypeOf<Promise<BetterFetchResponse<unknown>>>();
	});

	it("should not require option/body and return message", () => {
		expectTypeOf($fetch("/")).toMatchTypeOf<
			Promise<BetterFetchResponse<{ message: string }>>
		>();
	});

	it("if output is defined it should be used", () => {
		const f = createFetch({
			baseURL: "http://localhost:4001",
			customFetchImpl: async (url, req) => {
				return new Response(JSON.stringify({ message: "ok" }));
			},
		});
		const res = f("/", {
			output: z.object({ message: z.string() }),
		});
		expectTypeOf(res).toMatchTypeOf<
			Promise<
				BetterFetchResponse<{
					message: string;
				}>
			>
		>();
		expectTypeOf(res).not.toMatchTypeOf<
			Promise<
				BetterFetchResponse<{
					message: number;
				}>
			>
		>();
	});

	it("should required body and return token", () => {
		expectTypeOf(
			$fetch("/signin", {
				body: {
					username: "",
					password: "",
				},
			}),
		).toMatchTypeOf<Promise<BetterFetchResponse<{ token: string }>>>();
	});

	it("should not require optional fields and return message", () => {
		expectTypeOf(
			$fetch("/signup", {
				body: {
					username: "",
					password: "",
				},
			}),
		).toMatchTypeOf<Promise<BetterFetchResponse<{ message: string }>>>();
	});

	it("should require query param", () => {
		expectTypeOf($fetch("/query", { query: { term: "" } })).toMatchTypeOf<
			Promise<BetterFetchResponse<unknown>>
		>();
	});

	it("should strictly allow only specified keys as url", () => {
		const f = createFetch({
			schema: createSchema(schema, {
				strict: true,
			}),
			baseURL: "http://localhost:4001",
			customFetchImpl: async (url, req) => {
				return new Response();
			},
			disableValidation: true,
		});
		f("/");
		//@ts-expect-error
		f("/not-allowed");
	});

	it("should infer params", () => {
		const f = createFetch({
			schema: createSchema(schema),
			baseURL: "http://localhost:4001",
			customFetchImpl: async (url, req) => {
				return new Response();
			},
		});

		expectTypeOf(
			f("/user", {
				params: { id: 1 },
			}),
		).toMatchTypeOf<Promise<BetterFetchResponse<unknown>>>();

		expectTypeOf(
			f("/user/:id", {
				params: {
					id: "1",
				},
			}),
		).toMatchTypeOf<Promise<BetterFetchResponse<unknown>>>();
	});

	it("infers a leading dynamic path segment", () => {
		expectTypeOf<InferParamPath<":id/details">>().toEqualTypeOf<{
			id: string;
		}>();
	});

	it("should infer default response and error types", () => {
		const $fetch = createFetch({
			baseURL: "http://localhost:4001",
			defaultOutput: z.object({
				data: z.string(),
			}),
			defaultError: z.object({
				error: z.string(),
			}),
			customFetchImpl: async (url, req) => {
				return new Response();
			},
		});

		expectTypeOf($fetch("/")).toMatchTypeOf<
			Promise<
				BetterFetchResponse<
					{
						data: string;
					},
					{
						error: string;
					}
				>
			>
		>();
	});

	it("should require params", async () => {
		const $fetch = createFetch({
			schema: createSchema(schema),
			customFetchImpl: async (url, req) => {
				return new Response();
			},
			baseURL: "http://localhost:4001",
		});
		//@ts-expect-error
		const f = $fetch("/user/:id", {});
		$fetch("/post/:id/:title", {
			//@ts-expect-error
			params: {},
		});
		$fetch("/post/:id/:title", {
			params: {
				//@ts-expect-error
				title: 1,
			},
		});
	});
	it("should infer response type inside a hook", async () => {
		const $fetch = createFetch({
			baseURL: "http://localhost:4001",
			customFetchImpl: async (url, req) => {
				return new Response(null);
			},
		});
		$fetch<{ foo: string; bar: number }>("/", {
			onSuccess(context) {
				expectTypeOf(context.data).toMatchTypeOf<{
					foo: string;
					bar: number;
				}>();
			},
		});
		const $fetch2 = createFetch({
			baseURL: "http://localhost:4001",
			schema: createSchema(schema),
			customFetchImpl: async (url, req) => {
				return new Response(JSON.stringify({ message: "hello" }));
			},
		});
		$fetch2("/", {
			onSuccess(context) {
				expectTypeOf(context.data).toMatchTypeOf<{
					message: string;
				}>();
			},
		});
	});
});

describe("plugin", () => {
	const plugin = {
		id: "test",
		name: "Test",
		schema: {
			schema: {
				"/path": {
					output: z.object({
						message: z.string(),
					}),
					input: z.object({
						param: z.string(),
					}),
				},
				"/path/:param": {
					output: z.object({
						message: z.string(),
					}),
				},
			},
			config: {
				prefix: "prefix",
				strict: true,
				baseURL: "http://localhost:4001",
			},
		},
	} satisfies BetterFetchPlugin;
	const plugin2 = {
		id: "test",
		name: "Test",
		schema: createSchema(
			{
				"/path": {
					output: z.object({
						message: z.string(),
					}),
				},
			},
			{
				baseURL: "http://localhost:4001",
				strict: true,
			},
		),
	} satisfies BetterFetchPlugin;

	const plugin3 = {
		id: "test",
		name: "Test",
	};

	it("should infer prefix", async () => {
		const $fetch = createFetch({
			plugins: [plugin],
			baseURL: "http://localhost:4001",
		});

		expectTypeOf($fetch.call)
			.parameter(1)
			.toMatchTypeOf<"prefix/path" | "prefix/path/:param">();
	});
	it("should infer baseURL", async () => {
		const $fetch = createFetch({
			plugins: [plugin2],
			baseURL: "http://localhost:4001",
		});

		expectTypeOf($fetch)
			.parameter(0)
			.toMatchTypeOf<"http://localhost:4001/path">();
	});

	it("should infer input and output", async () => {
		const $fetch = createFetch({
			plugins: [plugin],
			baseURL: "http://localhost:4001",
			customFetchImpl: async (url, req) => {
				return new Response();
			},
			disableValidation: true,
		});
		//@ts-expect-error
		const f = $fetch("prefix/path");
		expectTypeOf(f).toMatchTypeOf<
			Promise<
				BetterFetchResponse<{
					message: string;
				}>
			>
		>();
	});

	it("should replace baseURL", async () => {
		const $fetch = createFetch({
			plugins: [plugin],
			baseURL: "http://localhost:4001",
			customFetchImpl: async (url, req) => {
				return new Response();
			},
			disableValidation: true,
		});
		await $fetch("prefix/path", {
			body: {
				param: "1",
			},
			onResponse(context) {
				expect(context.request.url.toString()).toBe(
					"http://localhost:4001/path",
				);
			},
		});
		await $fetch("prefix/path/:param", {
			params: {
				param: "1",
			},
			onResponse(context) {
				expect(context.request.url.toString()).toBe(
					"http://localhost:4001/path/1",
				);
			},
		});
	});

	it("should not break if plugin is not define schema", async () => {
		const $fetch = createFetch({
			plugins: [plugin3],
			baseURL: "http://localhost:4001",
			customFetchImpl: async (url, req) => {
				return new Response();
			},
		});
		await $fetch("prefix/path", {
			body: {
				param: "1",
			},
			onResponse(context) {},
		});
	});

	it("passes modified options to subsequent plugins", async () => {
		let receivedTimeout: number | undefined;
		const setTimeoutPlugin = {
			id: "set-timeout",
			name: "Set timeout",
			init(url, options) {
				return { url, options: { ...options, timeout: 100 } };
			},
		} satisfies BetterFetchPlugin;
		const readTimeoutPlugin = {
			id: "read-timeout",
			name: "Read timeout",
			init(url, options) {
				receivedTimeout = options?.timeout;
				return { url };
			},
		} satisfies BetterFetchPlugin;
		const fetch = createFetch({
			plugins: [setTimeoutPlugin, readTimeoutPlugin],
			customFetchImpl: async () => new Response(),
		});

		await fetch("https://example.com");

		expect(receivedTimeout).toBe(100);
	});

	it("should infer additional options", async () => {
		const $fetch = createFetch({
			plugins: [
				{
					id: "test",
					name: "Test",
					schema: createSchema({
						"/path": {
							output: z.object({
								message: z.string(),
							}),
						},
					}),
					getOptions() {
						return z.object({
							onUpload: z.function(),
						});
					},
				},
			],
			baseURL: "http://localhost:4001",
			customFetchImpl: async (url, req) => {
				return new Response();
			},
		});
		expectTypeOf(
			$fetch("/path", {
				onUpload() {},
			}),
		);
	});

	it("shouldn't break the type on plugin with no schema plugin a schema defined", async () => {
		const f = createFetch({
			plugins: [
				{
					id: "test",
					name: "Test",
					getOptions() {
						return z.object({
							onUpload: z.function(),
						});
					},
				} satisfies BetterFetchPlugin,
			],
			schema: createSchema(
				{
					"/path": {
						output: z.object({
							message: z.string(),
						}),
					},
				},
				{
					strict: true,
				},
			),
		});
		expectTypeOf(f).parameter(0).toMatchTypeOf<"/path">();
	});
});

describe("create-fetch-headers", () => {
	const captureHeaders = () => {
		let received: Headers | undefined;
		const customFetchImpl = async (_url: any, init?: RequestInit) => {
			received = new Headers(init?.headers);
			return new Response(null, { status: 200 });
		};
		return { customFetchImpl, get: () => received };
	};

	it("preserves headers passed as a Headers instance", async () => {
		const { customFetchImpl, get } = captureHeaders();
		const $fetch = createFetch({
			baseURL: "http://localhost:4001",
			customFetchImpl,
		});
		await $fetch("/x", {
			headers: new Headers({ cookie: "session=abc", "x-test": "1" }),
		});
		expect(get()?.get("cookie")).toBe("session=abc");
		expect(get()?.get("x-test")).toBe("1");
	});

	it("preserves headers passed as a plain object", async () => {
		const { customFetchImpl, get } = captureHeaders();
		const $fetch = createFetch({
			baseURL: "http://localhost:4001",
			customFetchImpl,
		});
		await $fetch("/x", { headers: { cookie: "session=abc" } });
		expect(get()?.get("cookie")).toBe("session=abc");
	});

	it("merges config headers with per-call Headers instance", async () => {
		const { customFetchImpl, get } = captureHeaders();
		const $fetch = createFetch({
			baseURL: "http://localhost:4001",
			headers: { "x-base": "base" },
			customFetchImpl,
		});
		await $fetch("/x", { headers: new Headers({ cookie: "session=abc" }) });
		expect(get()?.get("x-base")).toBe("base");
		expect(get()?.get("cookie")).toBe("session=abc");
	});

	it("exposes options.headers to plugins as a spreadable plain object", async () => {
		// The electron/expo client plugins spread `options.headers`; a `Headers`
		// instance would spread to `{}` and drop the user's headers.
		let spread: Record<string, string> | undefined;
		const inspectPlugin: BetterFetchPlugin = {
			id: "inspect",
			name: "inspect",
			async init(url, options) {
				spread = { ...(options?.headers as Record<string, string>) };
				return { url, ...(options ? { options } : {}) };
			},
		};
		const $fetch = createFetch({
			baseURL: "http://localhost:4001",
			customFetchImpl: async () => new Response(null, { status: 200 }),
			plugins: [inspectPlugin],
		});
		await $fetch("/x", { headers: new Headers({ "x-user": "u" }) });
		expect(spread).toEqual({ "x-user": "u" });
	});
});
