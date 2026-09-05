import { defineConfig } from "bumpp";
import { globSync } from "tinyglobby";

export const releaseConfig = {
	branch: "main",
	npmTag: "latest",
} as const;

export default defineConfig({
	commit: "chore: release {tag}",
	files: globSync(["./packages/*/package.json"], { expandDirectories: false }),
	pr: {
		base: releaseConfig.branch,
		branch: "release/v{version}",
		title: "chore: release {tag}",
	},
});
