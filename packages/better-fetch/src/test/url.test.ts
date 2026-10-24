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

	it("keeps the url's own origin when its path contains another url", () => {
		const url = getURL(
			"http://localhost:4001/https://other.example.com/resource",
		);
		expect(url.toString()).toBe(
			"http://localhost:4001/https://other.example.com/resource",
		);
	});

	it("keeps the base URL when the path contains another url", () => {
		const url = getURL("/https://other.example.com/resource", {
			baseURL: "https://api.example.com",
		});
		expect(url.toString()).toBe(
			"https://api.example.com/https://other.example.com/resource",
		);
	});

	it("resolves a path with a colon in its first segment against the base URL", () => {
		const url = getURL("v1:batch", {
			baseURL: "https://api.example.com",
		});
		expect(url.toString()).toBe("https://api.example.com/v1:batch");
	});

	it("places a relative path that starts with http under the base URL", () => {
		const url = getURL("httpbin/get", {
			baseURL: "https://api.example.com",
		});
		expect(url.toString()).toBe("https://api.example.com/httpbin/get");
	});

	it("keeps every slash of a relative path without a base URL", () => {
		const url = getURL("api/users");
		expect(url.toString()).toBe("/api/users");
	});

	it("removes the base URL only when the path starts with it", () => {
		const url = getURL("/x/api/y", {
			baseURL: "/api",
		});
		expect(url.toString()).toBe("/api/x/api/y");
	});

	it("keeps the base URL path and query when the base URL has a query", () => {
		const url = getURL("/users", {
			baseURL: "https://api.example.com/v1?key=1",
			query: { page: "2" },
		});
		expect(url.toString()).toBe(
			"https://api.example.com/v1/users?key=1&page=2",
		);
	});

	it("keeps a second question mark inside the query", () => {
		const url = getURL("/search?q=a?b", {
			baseURL: "https://api.example.com",
		});
		expect(url.toString()).toBe("https://api.example.com/search?q=a%3Fb");
	});

	it("keeps a second question mark inside the base URL query", () => {
		const url = getURL("/search", {
			baseURL: "https://api.example.com/v1?q=a?b",
		});
		expect(url.toString()).toBe("https://api.example.com/v1/search?q=a%3Fb");
	});

	it("matches path params before encoding literal segments", () => {
		const url = getURL("/users/:user id", {
			baseURL: "https://api.example.com",
			params: { "user id": "7" },
		});
		expect(url.toString()).toBe("https://api.example.com/users/7");
	});

	it("collapses repeated trailing slashes of the base URL", () => {
		const url = getURL("/users", {
			baseURL: "https://api.example.com/v1//",
		});
		expect(url.toString()).toBe("https://api.example.com/v1/users");
	});

	it("keeps empty segments inside the path", () => {
		const url = getURL("/a//b", {
			baseURL: "https://api.example.com/v1",
		});
		expect(url.toString()).toBe("https://api.example.com/v1/a//b");
	});

	it("drops the base URL fragment", () => {
		const url = getURL("/users", {
			baseURL: "https://api.example.com/v1#section",
		});
		expect(url.toString()).toBe("https://api.example.com/v1/users");
	});

	it("normalizes repeated leading slashes before joining with base URL", () => {
		const url = getURL("///accounts/list", {
			baseURL: "https://api.example.com",
		});
		expect(url.toString()).toBe("https://api.example.com/accounts/list");
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

	it("encodes dynamic path params as single path segments", () => {
		const url = getURL("/v1/users/:id", {
			params: { id: "teams/engineering" },
			baseURL: "https://api.example.com",
		});
		expect(url.toString()).toBe(
			"https://api.example.com/v1/users/teams%2Fengineering",
		);
	});

	it("encodes colons in dynamic path params", () => {
		const url = getURL("/v1/users/:id", {
			params: { id: "team:member" },
			baseURL: "https://api.example.com",
		});
		expect(url.toString()).toBe(
			"https://api.example.com/v1/users/team%3Amember",
		);
	});

	it("encodes fragment markers in literal path segments", () => {
		const url = getURL("/files/report#draft", {
			baseURL: "https://api.example.com",
		});
		expect(url.toString()).toBe("https://api.example.com/files/report%23draft");
	});

	it("encodes array path params as single path segments", () => {
		const url = getURL("/v1/:resource/:id", {
			params: ["teams/engineering", "current"],
			baseURL: "https://api.example.com",
		});
		expect(url.toString()).toBe(
			"https://api.example.com/v1/teams%2Fengineering/current",
		);
	});

	it("rejects reserved dynamic path params", () => {
		expect(() =>
			getURL("/v1/users/:id", {
				params: { id: ".." },
				baseURL: "https://api.example.com",
			}),
		).toThrow("reserved path segments");
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
