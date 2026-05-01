## Why

Grantfinder now exposes the same product through a browser UI, REST endpoints,
JSON-RPC methods, and `/skill.md`, but the project does not yet have one
regression contract proving agents can perform every browser-visible action.

That gap matters now because repository-backed grant work depends on agents
using the documented skill surface with the same authority and outcomes as a
human operating the site.

## What Changes

- Define a parity inventory for every browser-visible human action that changes
  or retrieves user work state.
- Map each action to at least one documented agent-accessible REST endpoint or
  JSON-RPC method in `/skill.md`.
- Add regression tests that exercise the real authenticated service path for
  each mapped agent action.
- Add documentation checks that fail when `/skill.md` omits a supported agent
  action or advertises an action that is not covered by tests.
- Use browser verification for representative human flows so the parity
  inventory remains grounded in the rendered product.
- Record discovered parity gaps as implementation tasks instead of silently
  reducing the action inventory.

## Capabilities

### New Capabilities

- `agent-action-parity`: define and verify the contract that browser-visible
  human actions have equivalent documented agent operations through REST or
  JSON-RPC.

### Modified Capabilities

No existing capabilities are registered in `openspec/specs/`, so this change
introduces a new capability rather than modifying an existing one.

## Impact

- `/skill.md` generation and documentation served by `src/app.ts`
- REST and JSON-RPC action coverage for authenticated agent operations
- Browser workflow coverage for the actions exposed by `src/client.tsx`
- Integration tests that exercise real application services and in-memory
  persistence
- `br` workstream tracking for any parity gaps found during inventory or test
  implementation
