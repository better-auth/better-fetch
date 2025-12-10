import type { StandardSchemaV1 } from "../standard-schema";
import type { StringLiteralUnion } from "../type-utils";

export type FetchSchema = {
	input?: StandardSchemaV1;
	output?: StandardSchemaV1;
	query?: StandardSchemaV1;
	params?: StandardSchemaV1<Record<string, unknown>> | undefined;
	method?: Methods;
	headers?: StandardSchemaV1<Record<string, unknown>>;
};

export type Methods = "get" | "post" | "put" | "patch" | "delete";

export const methods = ["get", "post", "put", "patch", "delete"];

type RouteKey = StringLiteralUnion<`@${Methods}/`>;

export type FetchSchemaRoutes = {
	[key in RouteKey]?: FetchSchema;
};

export const createSchema = <
	F extends FetchSchemaRoutes,
	S extends SchemaConfig,
>(
	schema: F,
	config?: S,
) => {
	return {
		schema: schema as F,
		config: config as S,
	};
};

export type SchemaConfig = {
	strict?: boolean;
	/**
	 * A prefix that will be prepended when it's
	 * calling the schema.
	 *
	 * NOTE: Make sure to handle converting
	 * the prefix to the baseURL in the init
	 * function if you you are defining for a
	 * plugin.
	 */
	prefix?: "" | (string & Record<never, never>);
	/**
	 * The base url of the schema. By default it's the baseURL of the fetch instance.
	 */
	baseURL?: "" | (string & Record<never, never>);
};

export type Schema = {
	schema: FetchSchemaRoutes;
	config: SchemaConfig;
};
