# Vitest coverage-v8 with Cloudflare Vite + Workers pool

This repository is a minimal repro for testing whether `@vitest/coverage-v8` can be used with:

- a basic Cloudflare Worker built by `@cloudflare/vite-plugin`
- Vitest 4
- `@cloudflare/vitest-pool-workers`, which runs tests inside `workerd`

Result: **the Worker builds and the Workers-pool tests pass, but `@vitest/coverage-v8` does not currently work for this setup.** The current working option is Istanbul instrumentation via `@vitest/coverage-istanbul`.

## Package versions tested

Checked on 2026-06-27:

- `@cloudflare/vite-plugin@1.42.3`
- `@cloudflare/vitest-pool-workers@0.16.20`
- `@vitest/coverage-v8@4.1.9`
- `@vitest/coverage-istanbul@4.1.9`
- `vite@8.1.0`
- `vitest@4.1.9`
- `wrangler@4.105.0`

The repo is pinned to Node `22.12.0` in `.nvmrc` because current Vitest 4.1.x supports Node 20, 22, and 24+. This machine's default Node was `v23.6.0`, which produced expected `EBADENGINE` warnings but did not change the repro result.

## Files of interest

- `vite.config.ts` uses `@cloudflare/vite-plugin` for the Worker build.
- `vitest.config.ts` uses `cloudflareTest()` from `@cloudflare/vitest-pool-workers`.
- `src/index.ts` is a tiny module Worker with one branch.
- `test/index.test.ts` has both direct module tests and an integration-style `exports.default.fetch()` test through `cloudflare:workers`.

## Repro commands

Install:

```sh
npm install
```

Build with the Cloudflare Vite plugin:

```sh
npm run build
```

Observed result: passes and writes a Worker bundle under `dist/vitest_coverage_workerd`.

Run plain Workers-pool tests:

```sh
npm test
```

Observed result:

```text
Test Files  1 passed (1)
Tests       4 passed (4)
```

Try V8 coverage:

```sh
npm run test:coverage:v8
```

Observed result: fails before running tests.

```text
Coverage enabled with v8

[vitest-pool-workers] Failed to import "/node:inspector/promises" from ".../node_modules/@vitest/coverage-v8/dist/index.js".
Error: No such module "node:inspector/promises".
  imported from ".../node_modules/@vitest/coverage-v8/dist/index.js"

Test Files  no tests
Tests       no tests
Errors      1 error
```

Run Istanbul coverage as a control:

```sh
npm run test:coverage:istanbul
```

Observed result: passes. `coverage/coverage-summary.json` reports `src/index.ts` at 100% statements, branches, functions, and lines.

## Why V8 coverage gets stuck

`@vitest/coverage-v8` depends on V8's runtime profiler surface. In this repro it tries to import `node:inspector/promises`, but tests are running in `workerd`, not Node, and that module is unavailable there.

This matches the upstream docs:

- Cloudflare's Workers Vitest known issues say native V8 coverage is not supported and Istanbul coverage must be used instead: <https://developers.cloudflare.com/workers/testing/vitest-integration/known-issues/#coverage>
- Vitest's coverage guide says the V8 provider does not work in environments that do not expose V8 coverage through the profiler, explicitly including Cloudflare Workers: <https://vitest.dev/guide/coverage>
- Cloudflare's Vite plugin docs state Worker code runs inside `workerd`: <https://developers.cloudflare.com/workers/vite-plugin/>

## What would need to change

For `@vitest/coverage-v8` to work with the Workers pool, the Workers testing stack would need a real V8 coverage/profiler path from `workerd` isolates back to Vitest. A module-resolution shim for `node:inspector/promises` is not enough; the coverage provider needs profiler data.

Concretely, this likely means:

1. `workerd` or the Workers test harness exposes V8 coverage data for test isolates.
2. `@cloudflare/vitest-pool-workers` brokers that coverage data back into Vitest's coverage lifecycle.
3. `@vitest/coverage-v8` can either run its Node inspector-dependent parts outside the Worker isolate or receive compatible coverage payloads from the custom pool.

Until those pieces exist, use `@vitest/coverage-istanbul` for Worker tests, or split tests so pure Node/Vite unit tests use `coverage-v8` while Worker-runtime tests use Istanbul or no coverage.
