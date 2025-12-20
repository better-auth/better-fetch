import { BetterFetchError } from "./error";
import {
	type ErrorContext,
	type FetchHooks,
	type RequestContext,
	initializePlugins,
} from "./plugins";
import { createRetryStrategy } from "./retry";
import type { StandardSchemaV1 } from "./standard-schema";
import type { BetterFetchOption, BetterFetchResponse } from "./types";
import { getURL } from "./url";
import {
	detectResponseType,
	getBody,
	getFetch,
	getHeaders,
	getMethod,
	getTimeout,
	isJSONParsable,
	jsonParse,
	parseStandardSchema,
} from "./utils";

type ErrorHandlerParams = {
	errorContext: ErrorContext & { responseText?: string };
	hooks: {
		onError: Array<FetchHooks["onError"]>;
		onRetry: Array<FetchHooks["onRetry"]>;
	};
	options?: BetterFetchOption;
	url: string;
	fetchFn: typeof betterFetch;
	cloneResponse?: boolean;
	throwError?: unknown;
};

async function handleError({
	errorContext,
	hooks,
	options,
	url,
	fetchFn,
	cloneResponse,
	throwError,
}: ErrorHandlerParams): Promise<{ data: null; error: unknown }> {
	for (const onError of hooks.onError) {
		if (onError) {
			await onError({
				...errorContext,
				response:
					cloneResponse && errorContext.response
						? errorContext.response.clone()
						: errorContext.response,
			});
		}
	}

	if (options?.retry) {
		const retryStrategy = createRetryStrategy(options.retry);
		const _retryAttempt = options.retryAttempt ?? 0;
		if (
			await retryStrategy.shouldAttemptRetry(
				_retryAttempt,
				errorContext.response ?? null,
			)
		) {
			for (const onRetry of hooks.onRetry) {
				if (onRetry && errorContext.response) {
					await onRetry({
						response: errorContext.response,
						request: errorContext.request,
					});
				}
			}
			const delay = retryStrategy.getDelay(_retryAttempt);
			await new Promise((resolve) => setTimeout(resolve, delay));
			return await fetchFn(url, {
				...options,
				retryAttempt: _retryAttempt + 1,
			});
		}
	}

	if (options?.throw) {
		throw new BetterFetchError(
			errorContext.error.status,
			errorContext.error.statusText,
			throwError ?? errorContext.error,
		);
	}

	return {
		data: null,
		error: errorContext.error,
	};
}

export const betterFetch = async <
	TRes extends Option["output"] extends StandardSchemaV1
		? StandardSchemaV1.InferOutput<Option["output"]>
		: unknown,
	TErr = unknown,
	Option extends BetterFetchOption = BetterFetchOption<any, any, any, TRes>,
>(
	url: string,
	options?: Option,
): Promise<
	BetterFetchResponse<
		TRes,
		TErr,
		Option["throw"] extends true ? true : TErr extends false ? true : false
	>
> => {
	const {
		hooks,
		url: __url,
		options: opts,
	} = await initializePlugins(url, options);
	const fetch = getFetch(opts);
	const controller = new AbortController();
	const signal = opts.signal ?? controller.signal;
	const _url = getURL(__url, opts);
	const body = getBody(opts);
	const headers = await getHeaders(opts);
	const method = getMethod(__url, opts);
	let context = {
		...opts,
		url: _url,
		headers,
		body,
		method,
		signal,
	};
	/**
	 * Run all on request hooks
	 */
	for (const onRequest of hooks.onRequest) {
		if (onRequest) {
			const res = await onRequest(context);
			if (typeof res === "object" && res !== null) {
				context = res;
			}
		}
	}
	if (
		("pipeTo" in context && typeof context.pipeTo === "function") ||
		typeof options?.body?.pipe === "function"
	) {
		if (!("duplex" in context)) {
			context.duplex = "half";
		}
	}

	const { clearTimeout } = getTimeout(opts, controller);

	let response: Response;
	try {
		response = await fetch(context.url, context);
	} catch (fetchError) {
		clearTimeout();

		const isAbortError =
			fetchError instanceof DOMException && fetchError.name === "AbortError";
		if (isAbortError) {
			throw fetchError;
		}

		const networkError = {
			status: 0,
			statusText: "Network Error",
			message:
				fetchError instanceof Error ? fetchError.message : String(fetchError),
			cause: fetchError,
		};

		return handleError({
			errorContext: {
				response: undefined,
				request: context,
				error: networkError,
			},
			hooks,
			options,
			url,
			fetchFn: betterFetch,
		}) as any;
	}

	clearTimeout();

	const responseContext = {
		response,
		request: context,
	};

	for (const onResponse of hooks.onResponse) {
		if (onResponse) {
			const r = await onResponse({
				...responseContext,
				response: options?.hookOptions?.cloneResponse
					? response.clone()
					: response,
			});
			if (r instanceof Response) {
				response = r;
			} else if (typeof r === "object" && r !== null) {
				response = r.response;
			}
		}
	}

	/**
	 * OK Branch
	 */
	if (response.ok) {
		const hasBody = context.method !== "HEAD";
		if (!hasBody) {
			return {
				data: "" as any,
				error: null,
			} as any;
		}
		const responseType = detectResponseType(response);
		const successContext = {
			data: null as any,
			response,
			request: context,
		};
		if (responseType === "json" || responseType === "text") {
			const text = await response.text();
			const parser = context.jsonParser ?? jsonParse;
			successContext.data = await parser(text);
		} else {
			successContext.data = await response[responseType]();
		}

		/**
		 * Parse the data if the output schema is defined
		 */
		if (context?.output) {
			if (context.output && !context.disableValidation) {
				successContext.data = await parseStandardSchema(
					context.output as StandardSchemaV1,
					successContext.data,
				);
			}
		}

		for (const onSuccess of hooks.onSuccess) {
			if (onSuccess) {
				await onSuccess({
					...successContext,
					response: options?.hookOptions?.cloneResponse
						? response.clone()
						: response,
				});
			}
		}

		if (options?.throw) {
			return successContext.data;
		}

		return {
			data: successContext.data,
			error: null,
		} as any;
	}
	const parser = options?.jsonParser ?? jsonParse;
	const responseText = await response.text();
	const isJSONResponse = isJSONParsable(responseText);
	const errorObject = isJSONResponse ? await parser(responseText) : null;

	return handleError({
		errorContext: {
			response,
			responseText,
			request: context,
			error: {
				...errorObject,
				status: response.status,
				statusText: response.statusText,
			},
		},
		hooks,
		options,
		url,
		fetchFn: betterFetch,
		cloneResponse: options?.hookOptions?.cloneResponse,
		throwError: isJSONResponse ? errorObject : responseText,
	}) as any;
};
