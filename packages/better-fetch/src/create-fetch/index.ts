import { betterFetch } from "../fetch";
import { BetterFetchPlugin } from "../plugins";
import type { BetterFetchOption } from "../types";
import { mergeHeaders, parseStandardSchema } from "../utils";
import type { BetterFetch, CreateFetchOption } from "./types";

const normalizeHeaders = (
	headers: BetterFetchOption["headers"],
): Record<string, string> | undefined => {
	if (headers === undefined) {
		return undefined;
	}

	const normalizedHeaders: Record<string, string> = {};
	for (const [key, value] of Object.entries(mergeHeaders(headers))) {
		normalizedHeaders[key.toLowerCase()] = value;
	}
	return normalizedHeaders;
};

export const applySchemaPlugin = (config: CreateFetchOption) =>
	({
		id: "apply-schema",
		name: "Apply Schema",
		version: "1.0.0",
		async init(url, options: BetterFetchOption | undefined) {
			const schema =
				config.plugins?.find((plugin) =>
					plugin.schema?.config
						? url.startsWith(plugin.schema.config.baseURL || "") ||
							url.startsWith(plugin.schema.config.prefix || "")
						: false,
				)?.schema || config.schema;
			if (schema) {
				let urlKey = url;
				if (schema.config?.prefix) {
					if (urlKey.startsWith(schema.config.prefix)) {
						urlKey = urlKey.replace(schema.config.prefix, "");
						if (schema.config.baseURL) {
							url = url.replace(schema.config.prefix, schema.config.baseURL);
						}
					}
				}
				if (schema.config?.baseURL) {
					if (urlKey.startsWith(schema.config.baseURL)) {
						urlKey = urlKey.replace(schema.config.baseURL, "");
					}
				}

				if (urlKey.startsWith("/") && urlKey.charAt(1) === "@") {
					urlKey = urlKey.substring(1);
				}

				const keySchema = schema.schema[urlKey];
				if (keySchema) {
					let validatedHeaders = options?.headers;
					if (keySchema.headers && !options?.disableValidation) {
						const validated = (await parseStandardSchema(
							keySchema.headers,
							normalizeHeaders(options?.headers),
						)) as Record<string, string | undefined> | undefined;
						validatedHeaders = normalizeHeaders(validated);
					}

					const opts = {
						...options,
						...(keySchema.method !== undefined && {
							method: keySchema.method,
						}),
						...(keySchema.output !== undefined && {
							output: keySchema.output,
						}),
						...(!options?.disableValidation && {
							body: keySchema.input
								? await parseStandardSchema(keySchema.input, options?.body)
								: options?.body,
							params: keySchema.params
								? await parseStandardSchema(keySchema.params, options?.params)
								: options?.params,
							query: keySchema.query
								? await parseStandardSchema(keySchema.query, options?.query)
								: options?.query,
						}),
					};
					if (validatedHeaders === undefined) {
						delete opts.headers;
					} else {
						opts.headers = validatedHeaders;
					}
					return {
						url,
						options: opts,
					};
				}
			}
			return {
				url,
				...(options !== undefined && { options }),
			};
		},
	}) satisfies BetterFetchPlugin;

export const createFetch = <Option extends CreateFetchOption>(
	config?: Option,
) => {
	async function $fetch(url: string, options?: BetterFetchOption) {
		const headers =
			config?.headers === undefined && options?.headers === undefined
				? undefined
				: mergeHeaders(config?.headers, options?.headers);
		const opts = {
			...config,
			...options,
			...(headers !== undefined && { headers }),
			plugins: [
				...(config?.plugins || []),
				applySchemaPlugin(config || {}),
				...(options?.plugins || []),
			],
		} as BetterFetchOption;

		if (config?.catchAllError) {
			try {
				return await betterFetch(url, opts);
			} catch (error) {
				return {
					data: null,
					error: {
						status: 500,
						statusText: "Fetch Error",
						message:
							"Fetch related error. Captured by catchAllError option. See error property for more details.",
						error,
					},
				};
			}
		}
		return await betterFetch(url, opts);
	}
	return $fetch as BetterFetch<Option>;
};

export * from "./schema";
export * from "./types";
