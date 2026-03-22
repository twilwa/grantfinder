---
name: x402
description: Use this skill to navigate and modify the x402 monorepo (TypeScript packages + Python + Go) to fix issues around payment middleware, clients, and protocol behavior, and to run the correct language-specific tests and builds before submitting changes.
---

## 1) Test commands

x402 is a multi-language monorepo; run tests in the subproject you touched.

- **Repository root (TypeScript workspace/monorepo):**
  - Install deps: `npm ci`
  - Run all TS tests (if configured): `npm test`
  - Run workspace build (commonly required even if tests are sparse): `npm run build`
  - Lint/format (if present): `npm run lint` and/or `npm run format`
- **Python package (if you edited `python/`):**
  - From `python/`: `python -m pytest -q`
  - If typing is enforced in CI, check for a `pyproject.toml`/`tox.ini`/`noxfile.py` in `python/` and run the matching command (e.g., `python -m tox`).
- **Go module (if you edited `go/`):**
  - From `go/`: `go test ./...`
  - If formatting matters: `gofmt -w .` before tests.

If root scripts differ (common in monorepos), open `package.json` at repo root and run exactly what it defines (prefer `npm run test -w <workspace>` when workspaces are used).

## 2) Code structure

Key areas you’ll likely modify:

- `typescript/` (main SDK surface):
  - `packages/core/`: protocol primitives, shared types, header parsing/serialization, scheme selection.
  - `packages/evm/` and `packages/svm/`: chain/network-specific payment implementations and signing/verification.
  - `packages/fetch/` and `packages/axios/`: client adapters that attach x402 payment flows to HTTP requests.
  - `packages/express/`, `packages/hono/`, `packages/next/`: server middleware integrations (e.g., `paymentMiddleware`), request/response hooks, route maps like `"GET /weather"`.
  - `packages/paywall/`: higher-level “protect endpoint” utilities (often where UX/redirect behavior lives).
- `python/`: Python SDK implementation and its tests.
- `go/`: Go SDK/module and tests.
- `examples/`: executable references for intended behavior; use these to confirm semantics when tests are unclear.
- `CONTRIBUTING.md`: acceptance criteria for new schemes/networks; helpful when an issue touches compatibility/security.

## 3) Conventions

- Route configuration commonly uses **string keys** like `"METHOD /path"`; ensure method casing and spacing match what the middleware expects.
- Keep **network-agnostic logic in `core`**; chain-specific signing/tx validation belongs in `evm`/`svm`.
- Prefer **pure functions** for header/protocol parsing and serialization; avoid coupling parsing to framework request objects.
- Maintain **backwards compatibility**: don’t rename exported symbols or change wire/header formats without a clear migration path; treat minor changes as non-breaking.

## 4) Common pitfalls

- **Editing the wrong package:** similar helpers exist across adapters (fetch/axios/express). Fix the shared logic in `core` when possible, then adjust adapters only for integration glue.
- **Breaking the on-the-wire protocol:** seemingly harmless changes to header casing, delimiter choices, or JSON shape can break clients. Search for tests/fixtures around headers and ensure they still pass.
- **Method/path matching bugs:** `"GET /foo"` vs `"GET /foo/"` and query strings can cause mismatches. Confirm how the middleware normalizes paths before changing matching logic.
- **Cross-language divergence:** if an issue is about protocol semantics (headers, fields, validation), check whether Python/Go mirror the same behavior and update them if the repository expects parity.

## 5) Workflow

1. **Reproduce** in the smallest surface area: use an `examples/` app or a minimal snippet calling the affected middleware/client. Capture the exact request/response headers involved.
2. **Locate ownership**: determine whether the bug is in `core` (protocol), a chain package (`evm`/`svm`), or an adapter (`express`/`fetch`/`axios`).
3. **Patch with minimal API churn**: keep exports stable; add new options/fields instead of changing existing ones when feasible.
4. **Add/adjust tests** near the owning package (e.g., `packages/core` for parsing/formatting; `packages/express` for route matching). Prefer golden/fixture-style tests for header serialization.
5. **Verify** by running the relevant test/build commands (Section 1) and re-running the minimal reproduction from step 1.
6. **Sanity-check examples**: if behavior is user-facing (middleware options, accepts/description fields), ensure examples still compile and reflect the intended standard behavior.