## Context

The current authenticated browser product is centered on four tabs:

- request marketplace
- research dashboard
- my requests
- my grants

That shell already talks to a broader platform API surface than the browser
actually renders. The service layer and platform types already model
organizations, personnel, invite acceptance, durable catalog entries,
bookmarks, funder schemas, application workspaces, custom templates, provider
connections, and agent execution records. The browser simply does not surface
those objects yet.

This change adds the missing browser affordances without changing the core
domain architecture introduced by the earlier grant-work-exchange wave.

## Goals / Non-Goals

**Goals:**
- Make the shipped organization, catalog, workspace, template, provider, and
  execution capabilities operable from the authenticated browser app
- Keep the new UI additive to the current workspace shell
- Reuse the existing service and JSON-RPC methods instead of inventing new
  backend workflows
- Organize the implementation into independent browser slices that can be built
  and tested in parallel

**Non-Goals:**
- Redesigning the overall product navigation beyond what is required to expose
  the missing surfaces
- Reworking the backend storage or domain models for these capabilities
- Adding a new client-side router when the existing stateful workspace shell is
  sufficient
- Expanding marketplace scope beyond the browser affordances already in flight

## Decisions

### Decision: Add an operations workspace instead of separate standalone pages

The missing UI surfaces all belong to the same authenticated operator context,
so they will live inside the existing browser workspace rather than in a
separate app shell.

Why this over a new standalone area:
- it preserves the current signed-in flow and browser verification harness
- the existing app already owns the authenticated API client and state
- it minimizes integration risk while making the missing capabilities visible

Alternatives considered:
- Create a second app shell or route tree. Rejected because it adds navigation
  complexity without changing the underlying data needs.

### Decision: Keep the implementation additive and state-driven

The current client is already organized around workspace tabs and derived state.
The new surfaces will extend that pattern rather than introducing a new routing
stack or modal-only workflow.

Why this over a route-first refactor:
- the missing capabilities can be reached through additive tab and detail-panel
  state
- it keeps the code change smaller for this wave
- it lets the verification harness keep using the same browser entry point

Alternatives considered:
- Refactor to a route-driven client before adding the new surfaces. Rejected
  because it would widen scope and delay the user-visible fix.

### Decision: Split the browser work into four parallel slices

The implementation will be grouped into these disjoint browser slices:

- organization and collaboration
- catalog and schema detail
- workspace and template studio
- provider connections and execution history

Why this split:
- each slice has mostly separate UI state and API calls
- the slices can be implemented by parallel subagents with minimal file
  contention if extraction is used carefully
- it maps directly to the missing browser affordances observed in the last
  end-to-end sweep

Alternatives considered:
- One monolithic browser rewrite. Rejected because it increases merge risk and
  removes clear verification boundaries.

### Decision: Show schema and workspace data in detail-first views

Grant schemas, workspace sections, provider connections, and execution records
will be shown in detail-first panels tied to selected records rather than in a
deep nested navigation tree.

Why this over nested navigation:
- it matches the current client’s workspace-oriented interaction model
- it keeps context visible while the user edits related artifacts
- it reduces navigation churn for operators comparing grants, schemas, and
  workspaces

Alternatives considered:
- Deep page nesting for every artifact. Rejected because the current app is not
  structured around that model.

## Risks / Trade-offs

- [Client state becomes harder to follow] → keep the new surfaces grouped by
  slice and extract view helpers when the existing file boundary becomes too
  noisy.
- [Mutation-heavy surfaces can show stale data] → centralize refresh and
  invalidation patterns for the new operations views.
- [New operations tabs could overwhelm the current shell] → keep the new
  navigation explicit and scoped to the missing operational capabilities rather
  than mixing them into existing research tabs.
- [Schema editing and workspace editing can overlap conceptually] → keep schema
  management attached to catalog detail and keep workspace editing attached to
  concrete drafts/proposals.

## Migration Plan

1. Extend the authenticated browser shell with new operations state.
2. Add organization/profile/personnel/invite views.
3. Add catalog browsing, bookmarks, and schema detail views.
4. Add workspace and template creation/editing views.
5. Add provider connection and execution-history views.
6. Verify the new surfaces with focused browser tests using the existing local
   harness.

Rollback strategy:
- Disable the new browser navigation and operations views while leaving the
  existing API surface and current research/marketplace tabs untouched.

## Open Questions

- Should schema editing live on the catalog detail view only, or also be
  reachable from workspace creation? This change will treat catalog detail as
  the source of truth unless implementation friction proves otherwise.
