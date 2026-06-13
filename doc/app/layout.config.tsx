import { pageTree } from "@/app/source";
import { GitHubLogoIcon } from "@radix-ui/react-icons";
import { type BaseLayoutProps, type DocsLayoutProps } from "fumadocs-ui/layout";
import Link from "next/link";

// shared configuration
export const baseOptions: BaseLayoutProps = {
	nav: {
		title: "Better-Fetch",
		transparentMode: "top",
	},
	links: [],
};

// docs layout configuration
export const docsOptions: DocsLayoutProps = {
	...baseOptions,
	tree: pageTree,
	nav: {
		title: "Better Fetch",
	},
	sidebar: {
		collapsible: false,
		footer: (
			<Link href="https://github.com/better-auth/better-fetch" target="_blank">
				<GitHubLogoIcon width={16} height={16} />
			</Link>
		),
		defaultOpenLevel: 1,
	},
};
