import {
	type BetterFetchOption,
	betterFetch,
	createFetch,
} from "@better-fetch/fetch";

declare const options: BetterFetchOption;

export const fetch = createFetch(options);
export const response = betterFetch("https://example.com");
