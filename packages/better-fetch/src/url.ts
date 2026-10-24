import { parseMethodModifier } from "./method";
import type { BetterFetchOption } from "./types";

/**
 * Matches the scheme, `//` and host at the start of a URL that names its own
 * host, such as `https://example.com` in `https://example.com/users`.
 *
 * @see https://www.rfc-editor.org/rfc/rfc3986#section-3
 */
const ORIGIN_RE = /^[a-z][a-z\d+.-]*:\/\/[^/?#]+/i;

/**
 * Matches the slashes at the start of a path, such as `///` in `///users`.
 */
const LEADING_SLASHES_RE = /^\/+/;

const withTrailingSlash = (value: string) =>
	value.endsWith("/") ? value : `${value}/`;

const isReservedPathSegment = (value: string) =>
	value === "." || value === "..";

const encodeLiteralPathSegment = (segment: string) =>
	segment
		.split(":")
		.map((part) => encodeURIComponent(part))
		.join(":");

const encodeLiteralPath = (path: string) =>
	path.split("/").map(encodeLiteralPathSegment).join("/");

function resolvePathSegment(segment: string, pathParams: Map<string, string>) {
	const pathParam = pathParams.get(segment);
	if (pathParam === undefined) {
		return segment;
	}
	if (isReservedPathSegment(pathParam)) {
		throw new TypeError("Path parameters cannot be reserved path segments");
	}
	return encodeURIComponent(pathParam);
}

function getPathParams(path: string, params: BetterFetchOption["params"]) {
	const pathParams = new Map<string, string>();
	if (params) {
		if (Array.isArray(params)) {
			const paramPaths = path.split("/").filter((p) => p.startsWith(":"));
			for (const [index, key] of paramPaths.entries()) {
				const value = params[index];
				pathParams.set(key, String(value));
			}
		} else {
			for (const [key, value] of Object.entries(params)) {
				pathParams.set(`:${key}`, String(value));
			}
		}
	}
	return pathParams;
}

/**
 * Replaces `:name` segments with their encoded params.
 */
function fillPath(path: string, params: BetterFetchOption["params"]) {
	const pathParams = getPathParams(path, params);
	return path
		.split("/")
		.map((segment) => resolvePathSegment(segment, pathParams))
		.join("/");
}

function serializeQuery(
	urlQuery: string | undefined,
	query: BetterFetchOption["query"],
) {
	const queryParams = new URLSearchParams(urlQuery);
	for (const [key, value] of Object.entries(query || {})) {
		if (value == null) continue;
		let serializedValue;
		if (typeof value === "string") {
			serializedValue = value;
		} else if (Array.isArray(value)) {
			for (const val of value) {
				queryParams.append(key, val);
			}
			continue;
		} else {
			serializedValue = JSON.stringify(value);
		}
		queryParams.set(key, serializedValue);
	}
	const queryParamString = queryParams.toString();
	return queryParamString.length > 0
		? `?${queryParamString}`.replaceAll("+", "%20")
		: "";
}

function withoutBase(input: string, baseURL: string | undefined) {
	if (!baseURL) {
		return input;
	}
	const basePath = withTrailingSlash(baseURL);
	return input.startsWith(basePath) ? input.slice(basePath.length) : input;
}

/**
 * Appends a path and query to a base as strings. The path never decides the
 * scheme or host. The base's own query comes first, and its fragment is
 * dropped as it belongs to the base document.
 */
function joinURL(
	base: string,
	path: string,
	urlQuery: string | undefined,
	query: BetterFetchOption["query"],
) {
	const [baseWithoutHash = ""] = base.split("#");
	const [basePath = "", baseQuery = ""] = baseWithoutHash.split("?");
	const relativePath = path.replace(LEADING_SLASHES_RE, "");
	const search = serializeQuery(`${baseQuery}&${urlQuery ?? ""}`, query);
	const href = `${withTrailingSlash(basePath)}${relativePath}${search}`;
	return ORIGIN_RE.test(href) ? new URL(href) : href;
}

/**
 * Normalize URL
 */
export function getURL(url: string, option?: BetterFetchOption) {
	const { baseURL, params, query } = option || {
		query: {},
		params: {},
		baseURL: "",
	};
	const { path: requestPath } = parseMethodModifier(url);
	const input = requestPath === url ? url : `/${requestPath}`;

	// A URL that names its own host keeps it. Anything else is a path under
	// baseURL.
	const origin = input.match(ORIGIN_RE)?.[0];
	const relative = origin
		? input.slice(origin.length)
		: withoutBase(input, baseURL);
	const [path, urlQuery] = relative.split("?");
	const filledPath = fillPath(encodeLiteralPath(path), params);
	return joinURL(origin ?? baseURL ?? "", filledPath, urlQuery, query);
}
