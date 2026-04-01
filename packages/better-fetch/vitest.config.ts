import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
	resolve: {
		alias: {
			"@better-fetch/logger": path.resolve(
				__dirname,
				"../logger/src/index.ts",
			),
		},
	},
	test: {
		environment: "happy-dom",
	},
});
