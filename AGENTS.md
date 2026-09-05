# AGENTS.md

This file is for AI coding agents working in this repository.

## Repository Purpose

Better Fetch is a TypeScript monorepo for an advanced `fetch` wrapper. The core package, `@better-fetch/fetch`, provides typed fetch responses, Standard Schema validation, route schemas, lifecycle hooks, plugin support, authorization helpers, timeout and retry behavior, and error-as-value handling. The repository also includes `@better-fetch/logger`, a documentation site, and a Bun playground.

Primary user-facing docs are published at <https://better-fetch.vercel.app/docs>. Local docs source lives in `doc/content/docs/`.

## Architecture Summary

The main package entry point is `packages/better-fetch/src/index.ts`.

Core flow in `packages/better-fetch/src/fetch.ts`:

1. `initializePlugins(url, options)`
2. Resolve fetch implementation with `getFetch`
3. Build `AbortController`, URL, headers, body, method, and request context
4. Run `onRequest` hooks
5. Execute `fetch(context.url, context)`
6. Run `onResponse` hooks
7. Parse success response, validate `output`, run `onSuccess`
8. Parse error response, run `onError`, retry when configured
9. Return `{ data, error }` unless `throw: true` is set

`createFetch` in `packages/better-fetch/src/create-fetch/index.ts` wraps `betterFetch` with default options, header merging, schema application, plugin options, and optional `catchAllError`.

## Important Directories

- `packages/better-fetch/src/`: core library source.
- `packages/better-fetch/src/create-fetch/`: typed client factory, schema helpers, and type inference.
- `packages/better-fetch/src/test/`: Vitest tests for core behavior.
- `packages/logger/src/`: logger plugin source.
- `packages/logger/test/`: logger plugin tests.
- `doc/app/`: Next.js app routes and layout for the docs site.
- `doc/content/docs/`: MDX documentation source.
- `dev/`: Bun playground.
- `.github/workflows/`: CI and release workflows.

## Coding Conventions

- Use TypeScript.
- Keep exports flowing through package entry points.
- Prefer existing helpers over duplicating behavior:
  - URL handling: `packages/better-fetch/src/url.ts`
  - Request/response utilities: `packages/better-fetch/src/utils.ts`
  - Auth headers: `packages/better-fetch/src/auth.ts`
  - Plugin contracts: `packages/better-fetch/src/plugins.ts`
  - Retry strategies: `packages/better-fetch/src/retry.ts`
- Preserve strict typing and type-level tests in Vitest.
- Biome is the configured formatter/import organizer.
- The Biome linter is disabled in `biome.json`; do not describe `pnpm lint` as a semantic lint pass.
- Avoid adding unrelated refactors while changing request behavior; the public API is type-heavy and easy to regress.

## Design Patterns

- Error-as-value is the default: successful calls return `{ data, error: null }`; failed HTTP responses return `{ data: null, error }`.
- `throw: true` changes successful return shape to parsed data and throws `BetterFetchError` on failed HTTP responses.
- Route schemas use Standard Schema V1 and are applied by an internal plugin created in `createFetch`.
- Plugins can mutate URL/options in `init`, add hooks, and optionally provide schemas.
- Hooks run in registration order.
- Request context identity is intentionally stable across replacing `onRequest` hooks. Tests cover this behavior.
- Headers passed as `Headers` are merged into a spreadable plain object before plugin initialization so plugins do not lose user headers.

## Dependency Management

- Package manager: pnpm `11.1.1`.
- Node version: `.nvmrc` specifies `24`.
- Workspaces are defined in `pnpm-workspace.yaml`: `packages/*`, `doc`, and `dev`.
- Package builds use `tsup`.
- Tests use Vitest.
- Docs use Next.js 14, React 18, Tailwind CSS, and Fumadocs.
- The dev playground uses Bun.

## Commands

Install:

```sh
pnpm install
```

Build packages:

```sh
pnpm build
```

Build docs:

```sh
pnpm --filter doc build
```

Typecheck:

```sh
pnpm typecheck
```

Test:

```sh
pnpm test
pnpm test:watch
```

Format/check:

```sh
pnpm lint
pnpm format
```

Run package watch mode:

```sh
pnpm dev
```

Run docs locally:

```sh
pnpm --filter doc dev
```

Run Bun playground:

```sh
pnpm --filter dev serve
pnpm --filter dev client
```

## Common Workflows

- Core fetch behavior change: update `packages/better-fetch/src/fetch.ts` or helper modules, then add tests in `packages/better-fetch/src/test/`.
- URL behavior change: update `packages/better-fetch/src/url.ts` and add coverage in `packages/better-fetch/src/test/url.test.ts`.
- Body/header parsing change: update `packages/better-fetch/src/utils.ts` and add coverage in `utils.test.ts` or `fetch.test.ts`.
- Type inference change: update files in `packages/better-fetch/src/create-fetch/` and add `expectTypeOf` coverage in `create.test.ts`.
- Plugin API change: update `packages/better-fetch/src/plugins.ts`, core hook wiring, and plugin tests.
- Logger change: update `packages/logger/src/` and `packages/logger/test/logger.test.ts`.
- Docs change: update MDX under `doc/content/docs/` and check the Next/Fumadocs app.

## Self-Improvement Protocol

Agents should keep this file accurate as the repository evolves.

- When you discover a durable repository fact that would help future agents, add it to `AGENTS.md` in the most relevant section.
- When existing guidance in `AGENTS.md` is wrong, stale, ambiguous, or contradicted by source files, correct it in the same change.
- Base updates on repository evidence such as source code, package manifests, tests, docs, or CI configuration.
- Do not add guesses, temporary observations, local machine details, or task-specific notes that will not help future work.
- Keep updates concise and actionable; prefer file paths and commands over broad advice.


## Debugging Tips

- Use `customFetchImpl` in tests to isolate behavior without network calls.
- Use H3/Listhen test servers when behavior depends on real request/response handling.
- Check `onRequest` context to confirm URL, method, headers, body, and signal before fetch executes.
- Check `hookOptions.cloneResponse` before reading a response body in hooks.
- Retry count tests expect the original failed request plus retry attempts.
- For validation failures, inspect `ValidationError.issues`.

## Files Requiring Extra Caution

- `packages/better-fetch/src/types.ts`: public option and response types.
- `packages/better-fetch/src/create-fetch/types.ts`: type inference for route schemas, plugin schemas, params, defaults, and `throw`.
- `packages/better-fetch/src/fetch.ts`: request lifecycle order.
- `packages/better-fetch/src/url.ts`: URL construction and encoding security.
- `packages/better-fetch/src/utils.ts`: serialization and parser behavior.
- `packages/better-fetch/src/plugins.ts`: public plugin and hook contracts.
- `.github/workflows/release.yml`: npm publishing behavior.
- `pnpm-lock.yaml`: dependency graph.

## Things Not To Modify Casually

- Do not change public type names, exported functions, or package exports without checking downstream impact.
- Do not remove Standard Schema compatibility or make Zod a hard runtime dependency of the core package.
- Do not change URL encoding rules without updating tests for path params, query params, and reserved path segments.
- Do not change hook order without updating docs and tests.
- Do not change package publishing fields (`main`, `module`, `types`, `exports`, `files`) without validating package output.
- Do not edit generated docs artifacts such as `doc/.map` if generated by Fumadocs tooling; update source MDX/config instead.

## PR Expectations

No PR template exists in the repository. Match CI expectations:

- Build succeeds with `pnpm build`.
- Typecheck succeeds with `pnpm typecheck`.
- Tests pass with `pnpm test`.
- Formatting/import organization passes with `pnpm lint`.
- Behavior changes include focused tests.
- Public API changes include docs updates under `doc/content/docs/` when applicable.

## Common Pitfalls

- Root `pnpm build` builds only `packages/*`; it does not build `doc`.
- `pnpm lint` is Biome check with the Biome linter disabled, so it mostly covers formatting/import organization.
- `getURL` exists in both `packages/better-fetch/src/url.ts` and `packages/better-fetch/src/utils.ts`; core `betterFetch` imports from `url.ts`.
- `errorSchema` exists in types/options but is not currently applied in `fetch.ts`.
- Published docs may describe features differently from current source; verify against local code before changing implementation.
- Docs production metadata uses `VERCEL_URL`, but no deployment config file is present.

## Glossary

- `betterFetch`: Direct async fetch wrapper exported from `@better-fetch/fetch`.
- `createFetch`: Factory for configured fetch clients.
- `createSchema`: Helper for route schemas.
- Standard Schema: Validator interface used for schema-agnostic validation and type inference.
- Fetch schema: Map of route keys to schemas for `input`, `output`, `query`, `params`, `headers`, and method.
- Method modifier: Route prefix such as `@get/`, `@post/`, `@put/`, `@patch/`, or `@delete/`.
- Hook: Lifecycle callback such as `onRequest`, `onResponse`, `onSuccess`, `onError`, or `onRetry`.
- Plugin: Object with `id`, `name`, optional `init`, hooks, schema, and plugin-specific options.
- `BetterFetchError`: Error thrown for failed HTTP responses when `throw: true`.
- `ValidationError`: Error thrown when Standard Schema validation fails.
