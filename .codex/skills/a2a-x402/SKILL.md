---
name: a2a-x402
description: Implements and specifies the A2A x402 “Payment Required” extension (spec + multi-language libraries and examples) for on-chain payment negotiation between agents; use this skill when fixing protocol message formats, payment signing/verification logic, or executor middleware behavior.
---

## 1) Test commands

This repo is multi-language; tests live under each language implementation. From `/testbed`, prefer running tests in the affected language directory.

- **Python (most common):**
  - Run all tests:
    - `cd python && pytest -q`
  - Run a focused test module (fast iteration):
    - `cd python && pytest -q -k x402`
  - If the project uses `pyproject.toml` with optional extras, ensure dependencies are installed in the container before testing (look for `python/pyproject.toml` or `python/requirements*.txt`).  
- **TypeScript (if present):**
  - `cd typescript && npm test` (or `pnpm test` if the lockfile indicates pnpm)
- **Spec validation:** there may be no formal tests for `spec/`; treat spec changes as requiring updates to all language implementations and examples. If any markdown linting exists, it will usually be run via a repo-level CI script (search for `.github/workflows/*`).

If unsure which commands exist, inspect `python/README.md`, `typescript/package.json`, and CI workflows, then mirror the CI command locally.

## 2) Code structure

Key paths to understand before editing:

- `spec/v0.1/spec.md`: normative behavior and message schemas for x402. If you change anything here, you likely must update the libraries and examples to match.
- `schemes/`: experimental payment schemes; do not “fix” behavior here unless the issue explicitly targets a scheme.
- `python/x402_a2a/`: Python core library implementing the extension.
  - Expect “functional core” modules defining data structures (payment-required/submitted/completed messages), signing, verification, and serialization.
  - Expect “executors” or middleware utilities that wrap an agent runtime to automate the 402 flow.
- `python/examples/**`: runnable demos showing end-to-end negotiation; these are often the quickest reproduction harness for protocol bugs.
- Parallel structure may exist for `typescript/` with its own `x402_a2a`-equivalent package and `examples/`.

## 3) Conventions

- **Functional core, imperative shell:** keep pure functions (message construction, signature creation/verification, hashing, validation) deterministic and side-effect-free; isolate network calls / chain settlement / agent I/O inside executor/middleware layers.
- **Protocol naming:** message types and fields should mirror the spec terminology (e.g., `payment-required`, `payment-submitted`, `payment-completed`). Avoid inventing new field names in code unless also updating the spec and examples.
- **Version awareness:** spec is versioned (`v0.1`). Code should either implement that version explicitly or gate changes so older flows don’t silently break.
- **Serialization:** be strict and stable about JSON field names and canonicalization expectations used for signing. Small changes (ordering, encoding) can invalidate signatures.

## 4) Common pitfalls

- **Breaking spec-library parity:** updating only `spec.md` (or only one language implementation) causes examples and other languages to diverge. If you touch message shapes, audit all implementations and examples.
- **Signature mismatch due to non-canonical JSON:** signing “pretty JSON” vs canonical bytes is a frequent source of failures. Always follow the library’s canonicalization/encoding utility rather than re-dumping JSON ad hoc.
- **Mixing settlement with verification:** verification should be possible without chain side effects; settlement should happen in executor/merchant logic after verification passes.
- **Editing `schemes/` as if normative:** schemes are experimental; fixes should usually target `spec/v0.1` and the core libs instead.

## 5) Workflow

1. **Locate the failing layer:** determine whether the issue is (a) spec ambiguity, (b) core protocol functions (construct/sign/verify/validate), (c) executor flow orchestration, or (d) example wiring.
2. **Reproduce quickly:** run the smallest demo or unit test that exercises the payment flow (often in `python/examples/` or focused pytest with `-k`).
3. **Cross-check with `spec/v0.1/spec.md`:** confirm the expected message types, required fields, and flow ordering (required → submitted → completed).
4. **Patch with minimal surface area:** prefer changing core helper functions used by both executors and examples, rather than patching individual call sites.
5. **Update all dependents:** if a message schema/field changes, update examples and any other language implementation touched by CI.
6. **Verify:** rerun the language test suite (`pytest -q` / `npm test`) and execute the relevant example(s) to ensure the end-to-end handshake still completes.