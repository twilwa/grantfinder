---
name: x402-rs
description: Rust workspace implementing the x402 “402 Payment Required” HTTP payment protocol (types, facilitator traits, Axum/Reqwest middleware, and local facilitator), used when fixing issues across protocol versions, chain backends, and middleware integration.
---

## 1) Test commands

- Run the full workspace test suite from the repo root:
  - `cargo test --workspace`
- Run tests for a specific crate (common during focused fixes):
  - `cargo test -p x402-types`
  - `cargo test -p x402-axum`
  - `cargo test -p x402-reqwest`
  - `cargo test -p x402-facilitator-local`
- If an issue is feature-gated (chain integrations or protocol versions), enumerate and test relevant feature combos:
  - `cargo test -p <crate> --features <feature1,feature2>`
- For faster iteration when you already know the failing test name:
  - `cargo test --workspace <test_name_substring>`
- Lint/format checks often expected in Rust workspaces (use if CI fails on style):
  - `cargo fmt --all`
  - `cargo clippy --workspace --all-targets -- -D warnings`

## 2) Code structure

- `Cargo.toml` (workspace root): member crates and shared dependency versions; check here first if a change requires enabling features or adjusting workspace dependency pins.
- `crates/x402-types/`: protocol core:
  - Defines protocol types and serialization formats used by all other crates.
  - Contains facilitator traits/interfaces and utilities shared by server/client middleware.
- `crates/x402-axum/`: server-side integration:
  - Axum middleware/extractors that enforce x402 payments and construct `402 Payment Required` responses with the right headers/body format for the protocol version.
- `crates/x402-reqwest/`: client-side integration:
  - Reqwest middleware that detects `402` responses, obtains/constructs payment, retries the request with appropriate payment proof/headers.
- `crates/x402-facilitator-local/`: a local facilitator implementation:
  - Useful for tests and examples; issues here often involve signing, verification, or deterministic fixtures.
- Look for crate-local `mod.rs`, `lib.rs`, and `tests/` directories for public API boundaries and integration tests. When changing types, verify downstream crates compile since `x402-types` is the foundation.

## 3) Conventions

- Workspace is modular: shared protocol types belong in `x402-types`; avoid duplicating request/response structures in middleware crates.
- Prefer strongly-typed protocol representations (enums/structs) with `serde` (de)serialization; changes to wire format must be reflected consistently across server (axum) and client (reqwest).
- Protocol versioning (V1/V2) is a first-class concern: keep version-specific logic explicit (e.g., enums or modules), and ensure any new behavior doesn’t silently change the other version.
- Public API stability matters: be cautious with breaking changes in `x402-types` exports; if unavoidable, update dependents in the same PR.

## 4) Common pitfalls

- **Updating types without updating middleware**: A change in `x402-types` (headers, fields, proof formats) usually requires corresponding updates in both `x402-axum` (response construction/validation) and `x402-reqwest` (parsing/retry logic). Always run `cargo test --workspace` after touching protocol types.
- **Feature-gated compilation failures**: Some chain/protocol implementations may be behind Cargo features. If CI fails but local tests pass, re-run with relevant `--features` and ensure code is gated consistently (`cfg(feature = "...")`) across crates.
- **402 semantics mismatch**: The protocol depends on using HTTP `402 Payment Required` precisely and attaching the correct payment challenge/proof metadata. Bugs often come from incorrect status/headers or retrying without preserving original request state.
- **Serde compatibility**: Small changes (renaming fields, changing enum tagging) can break interoperability. Prefer additive changes; if you must change serialization, add explicit `#[serde(...)]` attributes and tests.

## 5) Workflow

1. Reproduce with the smallest surface area: identify which crate the issue belongs to (types vs axum vs reqwest vs facilitator-local).
2. Run targeted tests first (`cargo test -p <crate>`), then confirm workspace-wide (`cargo test --workspace`) because protocol changes ripple.
3. Locate the protocol boundary: for server issues inspect `x402-axum` middleware response generation; for client issues inspect `x402-reqwest` 402-handling and replay logic; for format/verification issues inspect `x402-types` and `x402-facilitator-local`.
4. Patch with version awareness: implement changes behind explicit V1/V2 branching or types; avoid altering the other version unintentionally.
5. Add/adjust tests close to the failure mode (integration tests in the affected crate). For wire-format changes, add round-trip serde tests in `x402-types` and an end-to-end 402 challenge/payment retry test in `x402-reqwest`/`x402-axum` as appropriate.
6. Verify formatting/lints if needed (`cargo fmt --all`, `cargo clippy ...`) and re-run `cargo test --workspace` before finalizing.