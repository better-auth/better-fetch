import { defineConfig } from "tsdown";

export default defineConfig({
	entry: ["./src/index.ts"],
	target: "es2017",
	platform: "neutral",
	sourcemap: true,
	format: ["esm", "cjs"],
	dts: true,
	outExtensions({ format }) {
		return format === "es"
			? { js: ".js", dts: ".d.ts" }
			: { js: ".cjs", dts: ".d.cts" };
	},
	deps: {
		neverBundle: ["zod"],
	},
});
