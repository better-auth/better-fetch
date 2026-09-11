import { describe, expect, it } from "vitest";
import { getURL } from "../url";
import { getBody, getURL as getLegacyURL, getMethod } from "../utils";

describe("method modifiers", () => {
	it.each(["get", "post", "put", "patch", "delete"])(
		"resolves @%s consistently for method and URL",
		(method) => {
			const path = `@${method}/users`;
			const options = { baseURL: "https://example.com" };
			expect(getMethod(path)).toBe(method.toUpperCase());
			expect(getURL(path, options).toString()).toBe(
				"https://example.com/users",
			);
			expect(getLegacyURL(path, options).toString()).toBe(
				"https://example.com/users",
			);
		},
	);

	it("prefers an explicit method over the modifier", () => {
		expect(getMethod("@put/users", { method: "patch" })).toBe("PATCH");
	});

	it.each(["@unknown/users", "/users/@put/profile", "@PUT/users"])(
		"preserves an unrecognized modifier in %s",
		(path) => {
			expect(getMethod(path)).toBe("GET");
			expect(getMethod(path, { body: { id: "1" } })).toBe("POST");
			expect(getURL(path, { baseURL: "https://example.com" }).toString()).toBe(
				`https://example.com/${path.replace(/^\//, "").replace(/@/g, "%40")}`,
			);
		},
	);

	it("preserves a bare modifier's existing method and path behavior", () => {
		expect(getMethod("@put")).toBe("PUT");
		expect(getURL("@put", { baseURL: "https://example.com" }).toString()).toBe(
			"https://example.com/%40put",
		);
	});
});

describe("getBody", () => {
	it("returns null when there is no body", () => {
		expect(getBody({}, new Headers())).toBeNull();
	});

	it("JSON-stringifies a serializable body by default", () => {
		const body = getBody({ body: { a: 1 } }, new Headers());
		expect(body).toBe(JSON.stringify({ a: 1 }));
	});

	it("JSON-stringifies when content-type is explicitly application/json", () => {
		const body = getBody(
			{ body: { a: 1 } },
			new Headers({ "content-type": "application/json" }),
		);
		expect(body).toBe(JSON.stringify({ a: 1 }));
	});

	it("serializes Date values to ISO 8601 via JSON.stringify", () => {
		const date = new Date("2026-06-06T00:00:00.000Z");
		const body = getBody({ body: { at: date } }, new Headers());
		expect(body).toBe(JSON.stringify({ at: date.toISOString() }));
	});

	it.each([
		{
			case: "the canonical value",
			name: "content-type",
			value: "application/x-www-form-urlencoded",
		},
		{
			case: "a charset parameter",
			name: "content-type",
			value: "application/x-www-form-urlencoded; charset=utf-8",
		},
		{
			case: "a mixed-case value",
			name: "content-type",
			value: "Application/X-WWW-Form-Urlencoded",
		},
		{
			case: "a mixed-case header name",
			name: "Content-Type",
			value: "application/x-www-form-urlencoded",
		},
	])("encodes a form-urlencoded body given $case", ({ name, value }) => {
		const body = getBody(
			{ body: { a: "1", b: "2" } },
			new Headers({ [name]: value }),
		);
		expect(body).toBe("a=1&b=2");
	});

	it("passes a string body through untouched", () => {
		const body = getBody({ body: "raw" }, new Headers());
		expect(body).toBe("raw");
	});

	it("passes non-serializable bodies (FormData) through untouched", () => {
		const form = new FormData();
		form.set("a", "1");
		expect(getBody({ body: form }, new Headers())).toBe(form);
	});
});
