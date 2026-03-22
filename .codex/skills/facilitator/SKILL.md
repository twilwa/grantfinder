---
name: facilitator
description: Rust workspace for an x402 HTTP 402 “facilitator” service/CLI that verifies payment payloads (r402) and submits on-chain settlements; use this skill to navigate the server/CLI, config, features, and to run the correct Cargo/Makefile checks before fixing issues.
---

## 1) Test commands

Run checks the same way CI/Makefile expects (workspace + all features):

- Full test suite (preferred):
  - `make test`
  - Equivalent: `cargo test --workspace --all-features`
- Compile-only sanity:
  - `make check`
  - Equivalent: `cargo check --workspace --all-features`
- Lint (CI uses nightly + warnings as errors):
  - `make clippy`
  - Equivalent: `cargo +nightly clippy --workspace --all-targets --all-features -- -D warnings`
- Auto-fix clippy (use only after tests pass):
  - `make clippy-fix`
- Formatting:
  - `make fmt` (runs `cargo +nightly fmt`)

When iterating on a single crate/test, you can narrow scope with Cargo patterns, but ensure final verification uses `--workspace --all-features`.

## 2) Code structure

Key items to locate quickly:

- `Cargo.toml` (workspace config, shared lints, features such as chain-specific support like EIP-155/EVM).
- `src/` (main crate code; expect a CLI entry point and server wiring).
- HTTP API surface: handlers/routes for `GET /supported`, `POST /verify`, `POST /settle`, `GET /health`. Look for modules named like `server`, `http`, `routes`, `handlers`, or `api`.
- CLI commands: subcommands `init` (writes commented TOML template) and `serve` (loads config and starts server). Look for `cli.rs` / `main.rs` using `clap`.
- Config: TOML parsing + template generation; likely a `config` module and a `config.toml` template embedded or generated.
- Docker: `Dockerfile` and build args (notably `FEATURES=...`); keep feature-gating in mind when changing dependencies/APIs.

## 3) Conventions

- Rust edition 2024; keep idioms modern (e.g., `Result<T, E>` with `thiserror`, `anyhow`-style error propagation if used).
- Workspace lints are enforced via Clippy with `-D warnings`; avoid introducing unused imports, dead code, or needless clones.
- Feature-gating matters: chain/network support may be behind Cargo features (e.g., EVM-only builds). Keep new code behind existing feature flags when touching chain-specific modules, and avoid unconditional imports of feature-gated crates.
- CLI output and config template are part of user-facing UX; preserve stable flags (`init --output/--force`, `serve --config`) and keep TOML keys consistent with README expectations.

## 4) Common pitfalls

- Passing tests without `--all-features`: a change may compile for default features but fail in CI/all-features builds. Always run `cargo test --workspace --all-features`.
- Breaking `cargo +nightly clippy` due to warnings: even a minor unused variable will fail CI. Prefer `_unused` bindings or remove code paths cleanly.
- Accidentally requiring a chain feature in core server code (e.g., importing an EVM type in a non-gated module). Keep trait/object boundaries clean so core HTTP logic doesn’t depend on optional backends.
- Config/template drift: changing config structs without updating the generated template or README-adjacent defaults can break `facilitator init` expectations.

## 5) Workflow

1. Reproduce: run the failing command from the issue context; otherwise start with `make test` and/or `cargo test --workspace --all-features`.
2. Localize: identify whether failure is in CLI (`init`/`serve`), HTTP routes (`/verify`, `/settle`), config parsing, or feature-gated chain code. Use module names and route paths to jump to the right file.
3. Patch: implement the smallest change that preserves feature boundaries; if touching chain-specific logic, add/adjust `#[cfg(feature = "...")]` and keep core interfaces unchanged.
4. Verify: run `make fmt`, `make clippy`, then `make test`. If Docker/build args are implicated, confirm `cargo build --workspace --release --all-features` (or `make build`) still succeeds.
5. Final check: ensure CLI help text, config defaults, and API behavior remain consistent; add/adjust tests if a regression was fixed.