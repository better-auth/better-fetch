import { type BetterFetchOption, createFetch } from "@better-fetch/fetch";

declare const options: BetterFetchOption;

export const fetch = createFetch(options);
