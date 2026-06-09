import { describe, expect, it } from "vitest";
import { getURL } from "../url";

describe("url", () => {
	it("interpolates a path param", () => {
		const url = getURL("param/:id", {
			params: { id: "1" },
			baseURL: "http://localhost:4001",
		});
		expect(url.toString()).toBe("http://localhost:4001/param/1");
	});

	it("uses the url's own origin when it starts with http", () => {
		const url = getURL("http://localhost:4001/param/:id", {
			params: { id: "1" },
		});
		expect(url.toString()).toBe("http://localhost:4001/param/1");
	});

	it("appends a query param", () => {
		const url = getURL("/query", {
			query: { id: "1" },
			baseURL: "http://localhost:4001",
		});
		expect(url.toString()).toBe("http://localhost:4001/query?id=1");
	});

	it("omits null and undefined query values", () => {
		const url = getURL("/query", {
			query: { id: "1", nullValue: null, undefinedValue: undefined },
			baseURL: "http://localhost:4001",
		});
		expect(url.toString()).toBe("http://localhost:4001/query?id=1");
	});

	it("merges query params already present on the url", () => {
		const url = getURL("/query?name=test&age=20", {
			query: { id: "1" },
			baseURL: "http://localhost:4001",
		});
		expect(url.toString()).toBe(
			"http://localhost:4001/query?name=test&age=20&id=1",
		);
	});

	it("orders query params by insertion", () => {
		const url = getURL("/query", {
			query: { id: "1", name: "test2" },
			baseURL: "http://localhost:4001",
		});
		expect(url.toString()).toBe("http://localhost:4001/query?id=1&name=test2");
	});

	it("encodes query param values", () => {
		const url = getURL("/query", {
			query: { id: "#20", name: "test 2" },
			baseURL: "http://localhost:4001",
		});
		expect(url.toString()).toBe(
			"http://localhost:4001/query?id=%2320&name=test%202",
		);
	});

	it("encodes dynamic path params", () => {
		const url = getURL("/param/:id/:space", {
			params: { id: "#test", space: "item 1" },
			baseURL: "http://localhost:4001",
		});
		expect(url.toString()).toBe("http://localhost:4001/param/%23test/item%201");
	});

	it("expands array query values into repeated params", () => {
		const url = getURL("/test", {
			query: { filterValue: ["admin", "user"] },
			baseURL: "http://localhost:4000",
		});
		expect(url.toString()).toBe(
			"http://localhost:4000/test?filterValue=admin&filterValue=user",
		);
	});

	it("serializes object query values as JSON strings", () => {
		const url = getURL("/test", {
			query: { options: { page: 1, limit: 10 } },
			baseURL: "http://localhost:4000",
		});
		expect(url.toString()).toBe(
			"http://localhost:4000/test?options=%7B%22page%22%3A1%2C%22limit%22%3A10%7D",
		);
	});

	it("leaves plain string query values untouched", () => {
		const url = getURL("/test", {
			query: { foo: "bar" },
			baseURL: "http://localhost:4000",
		});
		expect(url.toString()).toBe("http://localhost:4000/test?foo=bar");
	});
});
