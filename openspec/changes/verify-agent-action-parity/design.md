## Context

Grantfinder serves one product through a rendered browser app, REST routes,
JSON-RPC methods, and `/skill.md`. The browser app centralizes authenticated
network calls through `authedFetch()` in `src/client.tsx`, and most human
actions are named functions that call a concrete API route.

The server in `src/app.ts` exposes the browser app, documentation, REST routes,
and JSON-RPC dispatch. Existing tests cover many route behaviors, but coverage
is distributed across scenario tests and the `/skill.md` test only checks a set
of important substrings. There is no single contract that says each
browser-visible action has an equivalent documented agent operation.

OAuth consent flows, including Privy login and GitHub account linking, are
human approval boundaries. Automated parity tests must not bypass those consent
screens. They can verify the application behavior before and after
authenticated identity state exists.

## Goals / Non-Goals

**Goals:**

- Define a finite inventory of browser-visible actions that read or mutate user
  work state.
- Map every inventoried action to a documented REST endpoint or JSON-RPC
  method in `/skill.md`.
- Exercise mapped agent operations through the real app service path in tests.
- Verify representative browser flows render and trigger the expected app
  affordances.
- Fail tests when a new browser action is added without an agent mapping, or
  when `/skill.md` documents an action without test coverage.

**Non-Goals:**

- Do not require every action to have both REST and JSON-RPC coverage when one
  documented agent-accessible path is sufficient.
- Do not automate live Privy, GitHub OAuth, or x402 settlement in the default
  test suite.
- Do not add dependencies, migrations, or a new API framework.
- Do not replace existing behavior-specific tests that already validate domain
  logic.

## Decisions

1. Use a test-owned action parity manifest.

   The implementation will add a table-driven manifest in the test surface, not
   production code. Each row will name the human action, the browser entry point
   or UI area, the agent operation, the expected documentation entry, and the
   verification scenario that proves the operation works.

   This keeps the parity contract visible and reviewable without coupling
   production code to test-only metadata. Deriving the manifest entirely from
   JSX or route registration would miss product intent, while embedding the
   manifest in `/skill.md` would make documentation drive implementation.

2. Treat parity as action equivalence, not protocol duplication.

   A browser action passes parity when an authenticated agent can perform the
   same user-visible operation through at least one documented API path. JSON-RPC
   is preferred for agent workflows when it exists, and REST remains valid for
   routes that are already documented as agent-accessible.

   If inventory finds a human action with no documented agent operation, the
   implementation must either add the missing agent operation or record an
   explicit task explaining why the action is intentionally human-only.

3. Keep tests on real in-process application paths.

   Parity tests will use the existing test app and in-memory persistence. They
   will authenticate with the same test token path already used by integration
   tests, then call REST or JSON-RPC through `app.request()`. This exercises the
   route parsing, auth, service methods, and response contracts without live
   network dependencies.

   Browser verification will stay representative rather than exhaustive. It
   will confirm that the rendered UI exposes the action groups that the parity
   manifest covers, and that critical flows such as repository connection
   affordances remain reachable.

4. Make `/skill.md` a tested contract.

   The parity test must fetch `/skill.md` from the app and assert that each
   manifest row has the documented endpoint or method name present. A separate
   check will prevent documented agent operations in the parity section from
   lacking a manifest row once that section exists.

   This keeps the docs useful to agents and prevents stale documentation from
   claiming capabilities that tests no longer cover.

5. Partition action groups by product workflow.

   The inventory will group actions by account/session, organization,
   research, tracked grants, catalog grants, applications, proposal workspaces,
   provider connections, agent executions, marketplace jobs/offers/engagements,
   repository bindings, and repository-backed publication.

   Grouping by workflow keeps test failures actionable and lets future work add
   focused `br` follow-ups when a gap appears.

## Risks / Trade-offs

- Human-only consent flows could be mistaken for missing agent parity.
  Mitigation: mark OAuth consent as a human approval boundary and test only the
  app state and actions available after consent.
- A manually maintained manifest can drift from the UI.
  Mitigation: keep browser-rendered checks for action groups and require new UI
  actions to add manifest rows.
- Table-driven parity tests can become too broad and hard to debug.
  Mitigation: group rows by workflow and keep each scenario focused on one
  state transition or read path.
- Requiring both REST and JSON-RPC for every action would add API surface
  without clear product value.
  Mitigation: require one documented agent operation per action, then add
  protocol-specific coverage only where the workflow already exposes both.

## Migration Plan

1. Add the `agent-action-parity` spec and task list before implementation.
2. Write failing parity tests for the manifest, `/skill.md`, and representative
   browser affordances.
3. Fill or correct missing mappings, tests, and documentation with the smallest
   code changes needed.
4. Run targeted tests during development, then run `bun test`, `bun run
   typecheck`, `bun run build`, `openspec validate`, and `sem diff` before
   handoff.

No data migration or rollback step is required because this change adds tests
and documentation coverage first. If implementation requires route or method
changes, they must remain additive unless a later approved spec says otherwise.

## Open Questions

- Which actions, if any, are intentionally human-only besides OAuth consent?
- Do we want the final parity manifest to live only in tests, or also render a
  compact action matrix in `/skill.md` for agent readers?
- Should the default browser verification stay in component-level tests, or
  should it add a Playwright smoke test once the action inventory is complete?
