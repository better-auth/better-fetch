import { betterFetch } from "../fetch";
import { BetterFetchPlugin } from "../plugins";
import type { BetterFetchOption } from "../types";
import { parseStandardSchema } from "../utils";
import type { BetterFetch, CreateFetchOption } from "./types";

const mergeHeaders = (
	base?: Record<string, string | undefined>,
	override?: Record<string, string | undefined>,
): Record<string, string | undefined> => {
	const result: Record<string, string | undefined> = {};
	
	if (base) {
		for (const [key, value] of Object.entries(base)) {
			if (value !== null && value !== undefined) {
				result[key] = value;
			}
		}
	}
	
	if (override) {
		for (const [key, value] of Object.entries(override)) {
			if (value !== null && value !== undefined) {
				result[key] = value;
			}
		}
	}
	
	return result;
};

export const applySchemaPlugin = (config: CreateFetchOption) =>
	({
		id: "apply-schema",
		name: "Apply Schema",
		version: "1.0.0",
		async init(url, options) {
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
						const normalizedHeaders: Record<string, string> = {};
						if (options?.headers) {
							if (options.headers instanceof Headers) {
								options.headers.forEach((value, key) => {
									normalizedHeaders[key.toLowerCase()] = value;
								});
							} else if (typeof options.headers === "object") {
								for (const [key, value] of Object.entries(options.headers)) {
									if (value !== null && value !== undefined) {
										normalizedHeaders[key.toLowerCase()] = value;
									}
								}
							}
						}
						
						const validated = await parseStandardSchema(
							keySchema.headers,
							normalizedHeaders,
						) as Record<string, string | undefined>;
						
						const finalHeaders: Record<string, string | undefined> = {};
						for (const [key, value] of Object.entries(validated)) {
							finalHeaders[key.toLowerCase()] = value;
						}
						validatedHeaders = finalHeaders;
					}
					
					let opts = {
						...options,
						method: keySchema.method,
						output: keySchema.output,
						headers: validatedHeaders,
					};
					
					if (!options?.disableValidation) {
						opts = {
							...opts,
							body: keySchema.input
								? await parseStandardSchema(keySchema.input, options?.body)
								: options?.body,
							params: keySchema.params
								? await parseStandardSchema(keySchema.params, options?.params)
								: options?.params,
							query: keySchema.query
								? await parseStandardSchema(keySchema.query, options?.query)
								: options?.query,
						};
					}
					return {
						url,
						options: opts,
					};
				}
			}
			return {
				url,
				options,
			};
		},
	}) satisfies BetterFetchPlugin;

export const createFetch = <Option extends CreateFetchOption>(
	config?: Option,
) => {
	async function $fetch(url: string, options?: BetterFetchOption) {
		const opts = {
			...config,
			...options,
			headers: mergeHeaders(config?.headers, options?.headers),
			plugins: [...(config?.plugins || []), applySchemaPlugin(config || {}), ...(options?.plugins || [])],
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
