import { describe, expect, it } from "vitest";
import { getBody } from "../utils";

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

	it("encodes a form-urlencoded body", () => {
		const body = getBody(
			{ body: { a: "1", b: "2" } },
			new Headers({ "content-type": "application/x-www-form-urlencoded" }),
		);
		expect(body).toBe("a=1&b=2");
	});

	it("matches form-urlencoded when the content-type carries parameters", () => {
		const body = getBody(
			{ body: { a: "1" } },
			new Headers({
				"content-type": "application/x-www-form-urlencoded; charset=utf-8",
			}),
		);
		expect(body).toBe("a=1");
	});

	it("matches a mixed-case form-urlencoded content-type value", () => {
		const body = getBody(
			{ body: { a: "1" } },
			new Headers({ "content-type": "Application/X-WWW-Form-Urlencoded" }),
		);
		expect(body).toBe("a=1");
	});

	it("reads content-type case-insensitively (Headers normalizes the name)", () => {
		const body = getBody(
			{ body: { a: "1" } },
			new Headers({ "Content-Type": "application/x-www-form-urlencoded" }),
		);
		expect(body).toBe("a=1");
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
