import { methods } from "./create-fetch/schema";

export function parseMethodModifier(path: string) {
	if (!path.startsWith("@")) {
		return { method: undefined, path };
	}

	const separator = path.indexOf("/");
	const method = path.slice(1, separator === -1 ? undefined : separator);
	if (!methods.includes(method)) {
		return { method: undefined, path };
	}

	return {
		method,
		path: separator === -1 ? path : path.slice(separator + 1),
	};
}
