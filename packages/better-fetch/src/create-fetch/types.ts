import type { StandardSchemaV1 } from "../standard-schema";
import type { BetterFetchPlugin } from "../plugins";
import type { Prettify, StringLiteralUnion } from "../type-utils";
import type { BetterFetchOption, BetterFetchResponse } from "../types";
import type { FetchSchema, Schema } from "./schema";
export type CreateFetchOption = BetterFetchOption & {
	schema?: Schema;
	/**
	 * Catch all error including non api errors. Like schema validation, etc.
	 * @default false
	 */
	catchAllError?: boolean;
	defaultOutput?: StandardSchemaV1;
	defaultError?: StandardSchemaV1;
};

export type WithRequired<T, K extends keyof T | never> = T & {
	[P in K]-?: T[P];
};
export type InferBody<T> = T extends StandardSchemaV1
	? StandardSchemaV1.InferInput<T>
	: any;

export type RemoveEmptyString<T> = T extends string
	? "" extends T
		? never
		: T
	: T;

export type InferParamPath<Path> =
	Path extends `${infer _Start}:${infer Param}/${infer Rest}`
		? {
				[K in
					| Param
					| keyof InferParamPath<Rest> as RemoveEmptyString<K>]: string;
			}
		: Path extends `${infer _Start}:${infer Param}`
			? { [K in Param]: string }
			: Path extends `${infer _Start}/${infer Rest}`
				? InferParamPath<Rest>
				: {};

export type InferParam<Path, Param> = Param extends StandardSchemaV1
	? StandardSchemaV1.InferInput<Param>
	: InferParamPath<Path>;

export type InferOptions<T extends FetchSchema, Key, Res = any> = T["headers"] extends StandardSchemaV1
	? WithRequired<
			Omit<BetterFetchOption<
				InferBody<T["input"]>,
				InferQuery<T["query"]>,
				InferParam<Key, T["params"]>,
				Res
			>, "headers"> & {
				headers?: InferHeaders<T["headers"]>
			},
			RequiredOptionKeys<T, Key> extends keyof BetterFetchOption
				? RequiredOptionKeys<T, Key>
				: never
		>
	: WithRequired<
			BetterFetchOption<
				InferBody<T["input"]>,
				InferQuery<T["query"]>,
				InferParam<Key, T["params"]>,
				Res
			>,
			RequiredOptionKeys<T, Key> extends keyof BetterFetchOption
				? RequiredOptionKeys<T, Key>
				: never
		>;

export type InferQuery<Q> = Q extends StandardSchemaV1
	? StandardSchemaV1.InferInput<Q>
	: any;

export type InferHeaders<H> = H extends StandardSchemaV1
	? StandardSchemaV1.InferInput<H>
	: Record<string, string>;

export type IsFieldOptional<T> = T extends StandardSchemaV1
	? undefined extends T
		? true
		: false
	: true;

export type IsParamOptional<T, K> = IsFieldOptional<T> extends false
	? false
	: IsEmptyObject<InferParamPath<K>> extends false
		? false
		: true;

export type IsOptionRequired<T extends FetchSchema, Key> = IsFieldOptional<
	T["input"]
> extends false
	? true
	: IsFieldOptional<T["query"]> extends false
		? true
		: IsParamOptional<T["params"], Key> extends false
			? true
			: IsFieldOptional<T["headers"]> extends false
				? true
				: false;

export type RequiredOptionKeys<T extends FetchSchema, Key> =
	| (IsFieldOptional<T["input"]> extends false ? "body" : never)
	| (IsFieldOptional<T["query"]> extends false ? "query" : never)
	| (IsParamOptional<T["params"], Key> extends false ? "params" : never)
	| (IsFieldOptional<T["headers"]> extends false ? "headers" : never);

export type InferKey<S> = S extends Schema
	? S["config"]["strict"] extends true
		? S["config"]["prefix"] extends string
			? `${S["config"]["prefix"]}${keyof S["schema"] extends string
					? keyof S["schema"]
					: never}`
			: S["config"]["baseURL"] extends string
				? `${S["config"]["baseURL"]}${keyof S["schema"] extends string
						? keyof S["schema"]
						: never}`
				: keyof S["schema"] extends string
					? keyof S["schema"]
					: never
		: S["config"]["prefix"] extends string
			? StringLiteralUnion<`${S["config"]["prefix"]}${keyof S["schema"] extends string
					? keyof S["schema"]
					: never}`>
			: S["config"]["baseURL"] extends string
				? StringLiteralUnion<`${S["config"]["baseURL"]}${keyof S["schema"] extends string
						? keyof S["schema"]
						: never}`>
				: StringLiteralUnion<
						keyof S["schema"] extends string ? keyof S["schema"] : never
					>
	: string;

export type GetKey<S, K> = S extends Schema
	? S["config"]["baseURL"] extends string
		? K extends `${S["config"]["baseURL"]}${infer AK}`
			? AK extends string
				? AK
				: string
			: S["config"]["prefix"] extends string
				? K extends `${S["config"]["prefix"]}${infer AP}`
					? AP
					: string
				: string
		: S["config"]["prefix"] extends string
			? K extends `${S["config"]["prefix"]}${infer AP}`
				? AP
				: K
			: K
	: K;

export type UnionToIntersection<U> = (
	U extends any
		? (x: U) => void
		: never
) extends (x: infer I) => void
	? I
	: never;

export type PluginSchema<P> = P extends BetterFetchPlugin
	? P["schema"] extends Schema
		? P["schema"]
		: {}
	: {};

export type MergeSchema<Options extends CreateFetchOption> =
	Options["plugins"] extends Array<infer P>
		? PluginSchema<P> & Options["schema"]
		: Options["schema"];

export type InferPluginOptions<Options extends CreateFetchOption> =
	Options["plugins"] extends Array<infer P>
		? P extends BetterFetchPlugin<infer O>
			? O extends Record<string, any>
				? UnionToIntersection<O>
				: {}
			: {}
		: {};

export type BetterFetch<
	CreateOptions extends CreateFetchOption = CreateFetchOption,
	DefaultRes = CreateOptions["defaultOutput"] extends StandardSchemaV1
		? StandardSchemaV1.InferOutput<CreateOptions["defaultOutput"]>
		: unknown,
	DefaultErr = CreateOptions["defaultError"] extends StandardSchemaV1
		? StandardSchemaV1.InferOutput<CreateOptions["defaultError"]>
		: unknown,
	S extends MergeSchema<CreateOptions> = MergeSchema<CreateOptions>,
> = <
	Res = DefaultRes,
	Err = DefaultErr,
	U extends InferKey<S> = InferKey<S>,
	K extends GetKey<S, U> = GetKey<S, U>,
	F extends S extends Schema ? S["schema"][K] : unknown = S extends Schema
		? S["schema"][K]
		: unknown,
	O extends Omit<BetterFetchOption, "params"> = Omit<
		BetterFetchOption<any, any, any, Res>,
		"params"
	>,
	PluginOptions extends Partial<InferPluginOptions<CreateOptions>> = Partial<
		InferPluginOptions<CreateOptions>
	>,
	Result = BetterFetchResponse<
		O["output"] extends StandardSchemaV1
			? StandardSchemaV1.InferOutput<O["output"]>
			: F extends FetchSchema
				? F["output"] extends StandardSchemaV1
					? StandardSchemaV1.InferOutput<F["output"]>
					: Res
				: Res,
		Err,
		O["throw"] extends boolean
			? O["throw"]
			: CreateOptions["throw"] extends true
				? true
				: Err extends false
					? true
					: false
	>,
>(
	url: U,
	...options: F extends FetchSchema
		? IsOptionRequired<F, K> extends true
			? [
					Prettify<
						InferOptions<
							F,
							K,
							Result extends { data: any } ? NonNullable<Result["data"]> : any
						> &
							PluginOptions
					>,
				]
			: [
					Prettify<
						InferOptions<
							F,
							K,
							Result extends { data: any } ? NonNullable<Result["data"]> : any
						> &
							PluginOptions
					>?,
				]
		: [
				Prettify<
					PluginOptions &
						O & {
							params?: InferParamPath<K>;
						}
				>?,
			]
) => Promise<Result>;

declare const emptyObjectSymbol: unique symbol;
export type EmptyObject = { [emptyObjectSymbol]?: never };
export type IsEmptyObject<T> = T extends EmptyObject ? true : false;
