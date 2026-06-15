import { methods } from "./create-fetch";
import type { BetterFetchOption } from "./types";

const isReservedPathSegment = (value: string) =>
	value === "." || value === "..";

function encodePathSegment(segment: string, pathParams: Map<string, string>) {
	let pathSegment = segment;
	for (const [key, value] of pathParams) {
		pathSegment = pathSegment.replace(key, value);
	}
	if (isReservedPathSegment(pathSegment)) {
		throw new TypeError("Path parameters cannot be reserved path segments");
	}
	return encodeURIComponent(pathSegment);
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
	let basePath = url.startsWith("http")
		? url.split("/").slice(0, 3).join("/")
		: baseURL || "";

	/**
	 * Remove method modifiers
	 */
	if (url.startsWith("@")) {
		const m = url.toString().split("@")[1].split("/")[0];
		if (methods.includes(m)) {
			url = url.replace(`@${m}/`, "/");
		}
	}

	if (!basePath.endsWith("/")) basePath += "/";
	let [path, urlQuery] = url.replace(basePath, "").split("?");
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

	path = path
		.split("/")
		.map((segment) => encodePathSegment(segment, pathParams))
		.join("/");
	path = path.replace(/^\/+/, "");
	let queryParamString = queryParams.toString();
	queryParamString =
		queryParamString.length > 0
			? `?${queryParamString}`.replace(/\+/g, "%20")
			: "";
	if (!basePath.startsWith("http")) {
		return `${basePath}${path}${queryParamString}`;
	}
	const _url = new URL(`${path}${queryParamString}`, basePath);
	return _url;
}
