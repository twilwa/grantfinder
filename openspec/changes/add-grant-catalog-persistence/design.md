## Context

Grantfinder already persists research scenarios, research requests, tracked
grants, grant reports, catalog entries, proposal workspaces, and
proposal-marketplace jobs. The current problem is not missing objects; it is
that the durable opportunity object is optional and late in the flow.

Today, a completed research request creates request-scoped tracked grants.
Those tracked grants can later be promoted into `grantCatalogEntries`, but the
catalog entry is still treated as a promoted snapshot rather than the canonical
opportunity record. That forces users to move opportunity context manually from
request output into the catalog, then again into proposal or marketplace work.
It also makes refreshed research and data enrichment awkward because the system
does not yet have one durable record that accumulates the latest opportunity
state over time.

This change should extend the existing catalog model rather than introducing a
second durable opportunity concept.

## Goals / Non-Goals

**Goals:**
- Make the existing catalog entry the durable grant or RFP record that research
  runs upsert automatically
- Preserve request-scoped tracked grants as per-run observations while linking
  them back to the canonical opportunity record
- Let users enrich durable opportunity records with current metadata, source
  context, freshness, tags, and internal pursuit notes
- Let users start additional research from a catalog record and attach the new
  findings back to that same record
- Let durable catalog records feed proposal workspaces and proposal-marketplace
  jobs directly

**Non-Goals:**
- Replacing research requests or tracked grants with a catalog-only model
- Building a generalized CRM or full grant pipeline beyond the opportunity
  record, refreshed research loop, and downstream proposal/marketplace entry
  points
- Solving every cross-sponsor deduplication edge case in the first version
- Reworking the current browser shell or auth model

## Decisions

### Decision: Reuse the existing catalog entry as the canonical durable opportunity record

The implementation should extend `grantCatalogEntries` instead of creating a
new `opportunity` model. Research runs, browser catalog views, bookmarks,
schemas, application workspaces, and proposal prefills already touch the
catalog entry shape, so promoting that object to canonical status is the
smallest coherent move.

Why this over a brand-new opportunity entity:
- the browser already exposes catalog detail and bookmark workflows
- application schemas already attach to catalog entries
- proposal and workspace flows already know how to consume catalog-derived
  context

Alternatives considered:
- Introduce a new opportunity aggregate and leave catalog entries as a browser
  projection. Rejected because it duplicates concepts and creates a second
  persistence path for the same domain object.

### Decision: Keep tracked grants as request-local observations linked to the canonical opportunity

Tracked grants remain useful because they preserve the exact output of a single
research run, its queue state, and its request-level history. The new model
should keep them, but each tracked grant should link to the catalog entry it
informed when a canonical opportunity exists.

Why this over deleting tracked grants:
- request detail still needs per-run output and queue management
- the current browser and API surfaces already depend on tracked grants
- preserving both views makes the lineage from research output to durable
  opportunity explicit

Alternatives considered:
- Collapse tracked grants into catalog entries immediately after each run.
  Rejected because it loses request-local context and would widen the browser
  changes more than necessary.

### Decision: Model follow-up research as a normal research request seeded from a catalog record

Additional research should create or reuse the existing research request flow
instead of inventing a separate refresh mechanism. A follow-up request can
store the source catalog entry, optional user focus note, and refreshed report
while still benefiting from the same request detail, steering, and activity
timeline surfaces already in the product.

Why this over a specialized “refresh catalog entry” endpoint:
- it preserves the current research orchestration path
- it keeps live activity, status, and rerun behavior consistent
- it gives users one place to monitor research regardless of whether the run
  starts from a scenario or an existing opportunity

Alternatives considered:
- Add a one-shot refresh action that bypasses research requests. Rejected
  because it would create a second research execution model with less
  observability.

### Decision: Downstream proposal and marketplace flows should accept catalog records directly

Proposal workspaces and `grant_proposal` jobs should be able to start from a
durable catalog record without forcing the user to route through a single
request-scoped tracked grant first. The downstream records should still retain
traceability to the catalog entry and, when available, the originating tracked
grant or report.

Why this over keeping the tracked-grant-only path:
- users are explicitly curating reusable opportunities in the catalog
- proposal and marketplace work should attach to the durable record, not to an
  ephemeral run output
- it reduces duplicate opportunity setup across repeated research cycles

Alternatives considered:
- Require catalog users to regenerate a tracked grant before starting proposal
  or marketplace work. Rejected because it adds ceremony without adding useful
  domain signal.

## Risks / Trade-offs

- [Duplicate opportunity records from imperfect matching] → Start with a
  deterministic upsert key derived from the strongest available source fields
  and keep manual cleanup as a later follow-up instead of blocking the first
  version on perfect deduplication.
- [Catalog enrichment drifts from the latest research evidence] → Track
  freshness and provenance on the durable record and always attach refreshed
  research outputs back to the same entry.
- [Dual model complexity between tracked grants and catalog records] → Treat
  the catalog entry as canonical for reuse and keep tracked grants explicitly
  request-scoped.
- [Downstream proposal or marketplace flows use stale opportunity context] →
  Resolve those flows from the latest catalog record when a catalog source is
  present instead of copying old request data blindly.

## Migration Plan

1. Extend the catalog entry model with the linkage and enrichment fields needed
   for canonical opportunity use.
2. Update research completion so discovered opportunities upsert catalog
   records and link tracked grants back to them.
3. Backfill existing promoted or curated catalog entries so they remain valid
   canonical records under the new model.
4. Add catalog-seeded research request creation and refreshed-read surfaces.
5. Add direct catalog entry points into proposal workspaces and marketplace
   proposal jobs.

Rollback strategy:
- Disable automatic research-to-catalog upsert and hide the new catalog
  enrichment and downstream actions while leaving tracked-grant research output
  intact.

## Open Questions

- What matching rule is strong enough for initial catalog upsert without
  introducing high-risk false merges for opportunities that share similar
  sponsor and title fields?
- Should follow-up research append to the same request thread when one already
  exists for a catalog record, or always create a new linked request to keep
  runs clearly separated?
