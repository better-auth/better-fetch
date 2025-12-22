import type { StandardSchemaV1 } from "./standard-schema";
import type { Schema } from "./create-fetch";
import type { BetterFetchError } from "./error";
import type { BetterFetchOption } from "./types";

export type RequestContext<T extends Record<string, any> = any> = {
	url: URL | string;
	headers: Headers;
	body: any;
	method: string;
	signal: AbortSignal;
} & BetterFetchOption<any, any, any, T>;
export type ResponseContext = {
	response: Response;
	request: RequestContext;
};
export type SuccessContext<Res = any> = {
	data: Res;
	response: Response;
	request: RequestContext;
};
export type ErrorContext = {
	response: Response;
	request: RequestContext;
	error: BetterFetchError & Record<string, any>;
};
export interface FetchHooks<Res = any> {
	/**
	 * a callback function that will be called when a
	 * request is made.
	 *
	 * The returned context object will be reassigned to
	 * the original request context.
	 */
	onRequest?: <T extends Record<string, any>>(
		context: RequestContext<T>,
	) => Promise<RequestContext | void> | RequestContext | void;
	/**
	 * a callback function that will be called when
	 * response is received. This will be called before
	 * the response is parsed and returned.
	 *
	 * The returned response will be reassigned to the
	 * original response if it's changed.
	 */
	onResponse?: (
		context: ResponseContext,
	) =>
		| Promise<Response | void | ResponseContext>
		| Response
		| ResponseContext
		| void;
	/**
	 * a callback function that will be called when a
	 * response is successful.
	 */
	onSuccess?: (context: SuccessContext<Res>) => Promise<void> | void;
	/**
	 * a callback function that will be called when an
	 * error occurs.
	 */
	onError?: (context: ErrorContext) => Promise<void> | void;
	/**
	 * a callback function that will be called when a
	 * request is retried.
	 */
	onRetry?: (response: ResponseContext) => Promise<void> | void;
	/**
	 * Options for the hooks
	 */
	hookOptions?: {
		/**
		 * Clone the response
		 * @see https://developer.mozilla.org/en-US/docs/Web/API/Response/clone
		 */
		cloneResponse?: boolean;
	};
}

/**
 * A plugin that returns an id and hooks
 */
export type BetterFetchPlugin<
	ExtraOptions extends Record<string, any> = Record<string, any>,
> = {
	/**
	 * A unique id for the plugin
	 */
	id: string;
	/**
	 * A name for the plugin
	 */
	name: string;
	/**
	 * A description for the plugin
	 */
	description?: string;
	/**
	 * A version for the plugin
	 */
	version?: string;
	/**
	 * Hooks for the plugin
	 */
	hooks?: FetchHooks;
	/**
	 * A function that will be called when the plugin is
	 * initialized. This will be called before the any
	 * of the other internal functions.
	 *
	 * The returned options will be merged with the
	 * original options.
	 */
	init?: (
		url: string,
		options?: BetterFetchOption & ExtraOptions,
	) =>
		| Promise<{
				url: string;
				options?: BetterFetchOption;
		  }>
		| {
				url: string;
				options?: BetterFetchOption;
		  };
	/**
	 * A schema for the plugin
	 */
	schema?: Schema;
	/**
	 * Additional options that can be passed to the plugin
	 *
	 * @deprecated Use type inference through direct typescript instead
	 * ```ts
	 * const plugin = {
	 *
	 * } satisfies BetterFetchPlugin<{
	 *  myCustomOptions: string;
	 * }>
	 * ```
	 */
	getOptions?: () => StandardSchemaV1;
};

export const initializePlugins = async (
	url: string,
	options?: BetterFetchOption,
) => {
	let opts = options || {};
	const hooks: {
		onRequest: Array<FetchHooks["onRequest"]>;
		onResponse: Array<FetchHooks["onResponse"]>;
		onSuccess: Array<FetchHooks["onSuccess"]>;
		onError: Array<FetchHooks["onError"]>;
		onRetry: Array<FetchHooks["onRetry"]>;
	} = {
		onRequest: [options?.onRequest],
		onResponse: [options?.onResponse],
		onSuccess: [options?.onSuccess],
		onError: [options?.onError],
		onRetry: [options?.onRetry],
	};
	if (!options || !options?.plugins) {
		return {
			url,
			options: opts,
			hooks,
		};
	}
	for (const plugin of options?.plugins || []) {
		if (plugin.init) {
			const pluginRes = await plugin.init?.(url.toString(), opts);
			opts = pluginRes.options || opts;
			url = pluginRes.url;
		}
		hooks.onRequest.push(plugin.hooks?.onRequest);
		hooks.onResponse.push(plugin.hooks?.onResponse);
		hooks.onSuccess.push(plugin.hooks?.onSuccess);
		hooks.onError.push(plugin.hooks?.onError);
		hooks.onRetry.push(plugin.hooks?.onRetry);
	}

	return {
		url,
		options: opts,
		hooks,
	};
};
