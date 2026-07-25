import { defineConfig } from "tsdown";

export default defineConfig({
	entry: ["./src/index.ts"],
	target: "es2017",
	platform: "neutral",
	sourcemap: true,
	format: ["esm", "cjs"],
	dts: true,
	deps: {
		neverBundle: ["@better-fetch/fetch"],
	},
});
