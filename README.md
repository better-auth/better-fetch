# Better Fetch

Better Fetch is an advanced `fetch` wrapper for TypeScript. It supports Standard Schema-compatible runtime validation and type inference, pre-defined route schemas, hooks, plugins, authorization helpers, retry behavior, and error-as-value responses.

The primary package is `@better-fetch/fetch` (`packages/better-fetch`). The repository also contains `@better-fetch/logger` (`packages/logger`), a Next.js/Fumadocs documentation site (`doc`), and a Bun playground (`dev`).

Documentation: <https://better-fetch.vercel.app/docs>

## Features

- `betterFetch` for direct requests with typed `data` and `error` responses.
- `createFetch` for configured clients with defaults such as `baseURL`, `headers`, `auth`, `retry`, plugins, and schemas.
- Standard Schema V1 validation for request body, query, params, headers, and output data.
- Route schemas through `createSchema`, including strict route inference and method modifiers such as `@post/path`.
- Hooks for request lifecycle stages: `onRequest`, `onResponse`, `onSuccess`, `onError`, and `onRetry`.
- Plugin API for request/response behavior and plugin-provided route schemas.
- Built-in Bearer, Basic, and Custom authorization header helpers.
- Timeout support through `AbortController`.
- Numeric, linear, and exponential retry strategies.
- Automatic response parsing for JSON, text, and binary responses.
- Cross-runtime fetch support when a global `fetch` implementation is available, with `customFetchImpl` for custom runtimes and tests.

## Packages

| Package | Location | Purpose |
| --- | --- | --- |
| `@better-fetch/fetch` | `packages/better-fetch` | Core fetch wrapper, typed client factory, schema helpers, hooks, plugins, retry, and utility types. |
| `@better-fetch/logger` | `packages/logger` | Better Fetch plugin that logs request, success, error, and retry events using `consola` by default. |
| `doc` | `doc` | Next.js 14 and Fumadocs documentation site. |
| `dev` | `dev` | Bun playground used for local examples. |

## Architecture Overview

The public exports for `@better-fetch/fetch` are collected in `packages/better-fetch/src/index.ts`.

Core request flow lives in `packages/better-fetch/src/fetch.ts`:

1. Initialize plugins with `initializePlugins`.
2. Resolve the fetch implementation with `getFetch`.
3. Normalize URL, headers, body, method, timeout, and abort signal.
4. Run `onRequest` hooks.
5. Execute `fetch`.
6. Run `onResponse` hooks.
7. Parse successful responses and optionally validate `output`.
8. Run `onSuccess`, or parse error responses and run `onError`.
9. Retry when configured.
10. Return `{ data, error }` or throw `BetterFetchError` when `throw: true`.

Important modules:

- `packages/better-fetch/src/create-fetch/` implements `createFetch`, route schema typing, schema application, strict schema inference, and plugin option inference.
- `packages/better-fetch/src/url.ts` handles `baseURL`, absolute URLs, query serialization, dynamic path params, path segment encoding, and method modifier cleanup.
- `packages/better-fetch/src/utils.ts` handles headers, body serialization, response type detection, custom fetch lookup, JSON parsing, timeout wiring, and Standard Schema validation.
- `packages/better-fetch/src/auth.ts` builds authorization headers.
- `packages/better-fetch/src/plugins.ts` defines hook and plugin contracts.
- `packages/better-fetch/src/retry.ts` defines retry options and strategies.
- `packages/logger/src/index.ts` implements the logger plugin.

## Technology Stack

- TypeScript
- pnpm workspaces
- `tsdown` for package builds
- Vitest for tests
- Biome for formatting and import organization
- Next.js 14, React 18, Tailwind CSS, and Fumadocs for the docs site
- Bun for the `dev` playground
- GitHub Actions for CI and npm release workflows

## Prerequisites

- Node.js `24`, from `.nvmrc`.
- pnpm `11.1.1`, from `package.json`.
- Bun is needed only for the `dev` workspace scripts.
- A Standard Schema-compatible validator, such as Zod, Valibot, or ArkType, is needed only if you use runtime validation.

## Installation

For consumers:

```sh
pnpm add @better-fetch/fetch
```

With runtime validation:

```sh
pnpm add @better-fetch/fetch zod
```

Logger plugin:

```sh
pnpm add @better-fetch/logger
```

## Local Development

Install dependencies from the repository root:

```sh
pnpm install
```

Start the core package in watch mode:

```sh
pnpm dev
```

Start the documentation site:

```sh
pnpm --filter doc dev
```

Run the Bun playground:

```sh
pnpm --filter dev serve
pnpm --filter dev client
```

## Build

Build publishable packages:

```sh
pnpm build
```

Build the docs site:

```sh
pnpm --filter doc build
```

The root `build` script only builds `packages/*`; it does not build `doc`.

## Tests

Run all package tests:

```sh
pnpm test
```

Run tests in watch mode:

```sh
pnpm test:watch
```

Tests are configured by `vitest.workspace.ts` and run against `packages/*`.

## Typechecking

```sh
pnpm typecheck
```

This runs `typecheck` across workspaces with `pnpm -r typecheck`.

## Linting and Formatting

Check formatting/import organization:

```sh
pnpm lint
```

Apply Biome fixes:

```sh
pnpm format
```

`biome.json` enables formatting and import organization. The Biome linter is disabled.

## Environment Variables

No repository-wide required environment variables are documented in source.

The docs app reads `VERCEL_URL` outside development in `doc/lib/metadata.ts` and `doc/lib/utils.ts`. `.env` files are ignored by `.gitignore`.

## Project Structure

```text
.
├── .github/workflows/        # CI and release workflows
├── dev/                      # Bun playground
├── doc/                      # Next.js/Fumadocs documentation site
├── packages/
│   ├── better-fetch/         # Core @better-fetch/fetch package
│   └── logger/               # @better-fetch/logger plugin package
├── biome.json                # Biome formatting/import organization config
├── bump.config.ts            # bumpp package version targets
├── package.json              # Root workspace scripts
├── pnpm-workspace.yaml       # Workspace definitions
└── vitest.workspace.ts       # Vitest workspace config
```

## CI and Release

CI is defined in `.github/workflows/ci.yml`. It runs on pull requests, pushes to `main`, and merge queue events. The workflow installs dependencies with pnpm, builds packages, typechecks, and runs tests.

Releases are defined in `.github/workflows/release.yml`. Tags matching `v*` trigger a build and `pnpm -r publish --provenance --access public --no-git-checks`. Tags containing `alpha` or `beta` publish with the matching npm dist tag; other release tags require the commit to be on `main` and publish as `latest`.

## Contributing

No dedicated contributing guide or pull request template is present in the repository. Based on CI and scripts, contributors should:

1. Install with `pnpm install`.
2. Make focused changes in the relevant workspace.
3. Run `pnpm build`, `pnpm typecheck`, and `pnpm test`.
4. Run `pnpm lint` or `pnpm format` for Biome formatting/import organization.
5. Add or update Vitest coverage when behavior changes.

## Troubleshooting

- `No fetch implementation found`: provide `customFetchImpl` or run in a runtime with global `fetch`.
- Relative URL errors: pass `baseURL` when calling relative paths.
- Validation errors: Standard Schema validation throws `ValidationError`; use `disableValidation` only when intentionally bypassing validation.
- Type inference with `throw: true` and generics: prefer `createFetch({ throw: true })` or follow the documented generic workaround.
- Docs production metadata: ensure `VERCEL_URL` exists when deploying the docs app in a Vercel-style environment.

## Unknowns

- No deployment configuration file was found for the docs site.
- No security policy was found.
- No repository-specific contributing guide was found.
- No `.env.example` was found.

## License

MIT. See `LICENSE.md` and `packages/better-fetch/LICENSE`.
