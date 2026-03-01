import { createFetch, createSchema } from "@better-fetch/fetch";
import { z } from "zod";
 
const $fetch = createFetch({
    baseURL: "https://jsonplaceholder.typicode.com",
    schema: createSchema({
        "/path": {
            input: z.object({
                userId: z.string(),
                id: z.number(),
                title: z.string(),
                completed: z.boolean(),
            }),
			headers: z.object({
				"x-custom-header": z.string(),
			}),
        },
    }), 
	auth: {
		type: "Bearer",
		token:"test-token",
	}
})
 
const { data, error } = await $fetch("/path", {
    body: {
        userId: "1",
        id: 1,
        title: "title",
        completed: true,
    },
	headers: {
		"x-custom-header": "custom-value",
	},
})

console.log(data, error);