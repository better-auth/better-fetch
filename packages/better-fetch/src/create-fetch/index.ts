import { betterFetch } from "../fetch";
import { BetterFetchPlugin } from "../plugins";
import type { BetterFetchOption } from "../types";
import { mergeHeaders, parseStandardSchema } from "../utils";
import { methods } from "./schema";
import type { BetterFetch, CreateFetchOption } from "./types";

export const applySchemaPlugin = (config: CreateFetchOption) =>
	({
		id: "apply-schema",
		name: "Apply Schema",
		version: "1.0.0",
		async init(url, options: BetterFetchOption | undefined) {
			let opts: BetterFetchOption = {
				...options,
				...(config.query !== undefined && {
					query: { ...config.query, ...options?.query },
				}),
			};
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

				const methodModifier = urlKey.startsWith("@")
					? urlKey.slice(1).split("/")[0]
					: undefined;
				const schemaMethod =
					methodModifier && methods.includes(methodModifier)
						? methodModifier
						: undefined;
				const keySchema = schema.schema[urlKey];
				if (keySchema) {
					if (schemaMethod) {
						url = url.replace(`@${schemaMethod}/`, "");
					}
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

						const validated = (await parseStandardSchema(
							keySchema.headers,
							normalizedHeaders,
						)) as Record<string, string | undefined>;

						const finalHeaders: Record<string, string | undefined> = {};
						for (const [key, value] of Object.entries(validated)) {
							finalHeaders[key.toLowerCase()] = value;
						}
						validatedHeaders = finalHeaders;
					}

					const method = keySchema.method ?? schemaMethod;
					opts = {
						...opts,
						...(method !== undefined && { method }),
						...(keySchema.output !== undefined && { output: keySchema.output }),
						...(validatedHeaders !== undefined && {
							headers: validatedHeaders,
						}),
					};

					if (!options?.disableValidation) {
						if (keySchema.query) {
							opts.query = await parseStandardSchema(
								keySchema.query,
								options?.query,
							);
							if (opts.query !== null && typeof opts.query === "object") {
								const defaults = { ...config.query };
								for (const key of Object.keys(defaults)) {
									if (
										options?.query &&
										Object.prototype.hasOwnProperty.call(options.query, key)
									) {
										defaults[key] = options.query[key];
									}
								}
								opts.query = { ...defaults, ...opts.query };
							}
						}

						opts = {
							...opts,
							body: keySchema.input
								? await parseStandardSchema(keySchema.input, options?.body)
								: options?.body,
							params: keySchema.params
								? await parseStandardSchema(keySchema.params, options?.params)
								: options?.params,
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
				...((options !== undefined || config.query !== undefined) && {
					options: opts,
				}),
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
