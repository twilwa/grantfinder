---
name: x402-openai-python
description: Add or modify transparent x402-payment retry behavior for the OpenAI Python client wrapper (sync/async/streaming) and its wallet/policy integration, including fixing request/response handling around HTTP 402 and ensuring pytest coverage passes.
---

## 1) Test commands

Run the unit tests with pytest (project uses `pytest` and `pytest-asyncio` in dev deps):

- Full suite: `pytest`
- Verbose (useful when debugging async/streaming failures): `pytest -vv`
- Run a single test file: `pytest tests/test_<name>.py`
- Run a single test by keyword: `pytest -k x402` (or another feature keyword)

If you add async tests, ensure they are discovered by pytest and use the existing async configuration (typically `pytest.mark.asyncio`).

## 2) Code structure

Key paths you’ll likely touch:

- `src/x402_openai/`: main library package.
  - Look for client wrapper entry points such as `X402OpenAI` and `AsyncX402OpenAI` (these mirror the upstream `openai.OpenAI` API shape).
  - Modules related to HTTP request handling, retries, and x402 signing logic (often named around “transport”, “client”, “middleware”, “retry”, or “payments”).
- `src/x402_openai/wallets/`: chain-specific wallet implementations.
  - `EvmWallet` (EVM chains) and `SvmWallet` (Solana) are the public API types referenced in the README.
  - Wallets typically provide signing or payment-authorization material used when a 402 challenge is returned.
- Policy utilities (per README): functions like `prefer_network`, `prefer_scheme`, `max_amount` should live in the top-level package or a `policies` module.
- Packaging metadata:
  - `pyproject.toml` defines Python >=3.11, core deps `openai` and `httpx`, and optional extras `evm`, `svm`, `all`.

When diagnosing failures, prioritize the wrapper layer that intercepts HTTP 402 responses and the code that replays the original request with x402 headers.

## 3) Conventions

- This is intended as a **drop-in replacement** for the upstream OpenAI Python client: preserve method names and return types expected by `openai>=1.0.0`, including streaming iterators and async variants.
- Keep sync and async behavior aligned: if you change 402 handling in the sync client, mirror it in the async client and streaming paths.
- Prefer explicit typing and stable public API: exported names (`X402OpenAI`, `AsyncX402OpenAI`, `EvmWallet`, `SvmWallet`, policy helpers) should remain import-compatible with README examples.
- Optional chain dependencies: do not import EVM/SVM-only packages at import time unless guarded. Wallet modules may depend on extras; structure imports so `pip install x402-openai` (without `[evm]`/`[svm]`) doesn’t crash on import of unrelated components.

## 4) Common pitfalls

- **Breaking “transparent” retries**: when replaying after a 402, ensure the retried request is semantically identical (method, URL, query/body, timeouts) plus required x402 headers/signature. Losing request body or changing streaming flags is a frequent bug.
- **Streaming edge cases**: streaming responses can’t always be replayed the same way if the original request body was an iterator/stream. Ensure the code buffers or reconstructs the payload before first send if a retry may be needed.
- **Async iterator protocol**: async streaming should return an async iterable consistent with upstream OpenAI client expectations; don’t wrap it in a way that changes chunk types or ordering.
- **Wallet selection/policy ordering**: when multiple wallets are provided, policy evaluation must be deterministic. Avoid “first wallet wins” shortcuts that ignore `prefer_network`, `prefer_scheme`, or `max_amount`.
- **Import-time extras**: referencing `eth-account`/`solders` in top-level imports will break users without extras and can break tests in minimal environments.

## 5) Workflow

1. Reproduce with the smallest failing test or add a focused test under `tests/` that simulates an HTTP 402 then success (mock `httpx` responses). Cover both sync and async if applicable.
2. Trace the request path: identify where responses are intercepted and where x402 signing/headers are added; confirm the 402 branch reuses the original request payload correctly.
3. Patch minimally in the transport/retry layer; avoid changing public method signatures. If you must add new parameters, keep them internal/private.
4. Add/adjust tests for: (a) single 402 then retry success, (b) policy-driven wallet selection, (c) streaming/async behavior if the issue touches those paths.
5. Run `pytest -vv` and ensure failures aren’t due to optional-dependency imports. Validate that README import patterns still work (at least via lightweight import tests).