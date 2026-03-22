---
name: x402-go
description: Go library skill for modifying and testing x402-go, covering its payment requirement primitives, HTTP middleware/client integration, and signer/token configuration so an agent can implement fixes or features for paywalled HTTP endpoints and multi-chain USDC payment flows.
---

## 1) Test commands

Run tests from the repo root in the container at `/testbed`:

- Full test suite (all packages):
  - `go test ./...`
- With verbose output (useful when diagnosing HTTP/middleware failures):
  - `go test -v ./...`
- Run a single package’s tests while iterating:
  - `go test ./http/...`
  - `go test ./signers/...`
- If you add/change network constants or USDC helpers, ensure compile + vet:
  - `go test ./...`
  - `go vet ./...`

If the repo includes examples that must compile (common in Go libs), also sanity-check builds:
- `go test ./...` already compiles all packages, but you can additionally `go test` the specific example packages if present.

## 2) Code structure

Expect these key areas:

- Root package (`/testbed`, module `github.com/mark3labs/x402-go`): core types and helpers:
  - Payment requirement models (e.g., `PaymentRequirement`)
  - USDC helpers like `NewUSDCPaymentRequirement` and `NewUSDCTokenConfig`
  - Chain/network constants (Base, Polygon, Avalanche, Solana; mainnet/testnet variants)
- `http/`: HTTP integration layer:
  - Middleware for `net/http` (e.g., `NewX402Middleware`, `Config`)
  - HTTP client wrapper that auto-handles payments (e.g., `NewClient`, options like `WithSigner`)
  - Anything related to facilitator interactions and request/response headers
- `signers/`: signing backends:
  - `signers/evm`: EVM wallet signing + network selection + token config
  - `signers/solana` (if present): Solana signing flow
  - Managed wallet integration (e.g., Coinbase CDP) may exist as another signer package
- Look for chain/token tables/constants: USDC contract addresses, decimals, and EIP-3009 domain parameters for EVM chains (these are easy to break if edited inconsistently).

## 3) Conventions

- Options pattern is used heavily: constructors accept `WithX(...)` functional options (e.g., HTTP client and signers). When adding configuration, follow this pattern and keep defaults sensible.
- Chain identifiers: constants like `BaseMainnet`, `BaseSepolia`, etc. When adding a chain or changing addresses, update both requirement helpers and token config helpers consistently.
- Amount handling: USDC helpers accept human-readable strings (e.g., `"0.01"`) and convert to atomic units using token decimals. Preserve string-to-decimal conversion behavior; avoid `float64`.
- Middleware behavior: x402 flows are header- and status-code sensitive. Preserve expected HTTP semantics (e.g., challenge/requirement responses vs. authorized responses).

## 4) Common pitfalls

- Breaking atomic unit conversion: using floats, rounding incorrectly, or assuming 18 decimals. USDC is typically 6 decimals on EVM; Solana USDC is also commonly 6 but verify per config. Use integer/big-int safe conversions already present in the helpers.
- Inconsistent USDC metadata: updating an address without updating symbol/decimals/EIP-3009 domain parameters can cause signatures to validate on one chain but fail elsewhere.
- Middleware/client mismatch: changing header names, facilitator request formats, or payment requirement encoding can break interoperability. When touching `/http`, search for corresponding parsing/serialization on both client and server sides.
- Network naming: EVM signer `WithNetwork("base")` style strings must align with whatever mapping the signer uses. Don’t introduce new names without wiring them through.

## 5) Workflow

1. Reproduce with a focused test: identify the failing package and run `go test -v` for that subtree (often `./http/...` or `./signers/...`).
2. Trace the x402 flow end-to-end: for HTTP issues, locate where the server builds payment requirements, where the client detects the challenge, and where it signs/submits payment via the facilitator.
3. Patch minimally in the responsible layer:
   - Core types/helpers for amount/chain/token correctness
   - `/http` for protocol, headers, middleware/client orchestration
   - `/signers` for signing, network selection, token metadata
4. Add/adjust a unit test near the bug’s source package (prefer table-driven tests for multiple chains and amounts).
5. Verify `go test ./...` and `go vet ./...` pass, then re-run the originally failing package tests with `-v` to ensure behavior and logs align with x402 expectations.