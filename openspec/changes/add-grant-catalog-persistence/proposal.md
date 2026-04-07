## Why

Research runs already persist requests and derive tracked grants, but those
opportunities still behave like request-scoped output instead of durable grant
or RFP records. Users can promote individual results into the catalog today,
but that extra step fragments the workflow and makes it too easy to lose
enriched context, refreshed findings, and downstream proposal decisions across
separate requests.

## What Changes

- Persist grants and RFPs discovered by research runs into a durable catalog
  record instead of requiring manual promotion before they become reusable.
- Add enrichment support so users can keep a catalog record current with
  updated metadata, provenance, freshness notes, internal tags, and pursuit
  context over time.
- Add research loops that start from an existing catalog record, run additional
  targeted research, and attach refreshed findings back onto that same
  opportunity record.
- Let users select a durable catalog record as the source for proposal
  workspaces and proposal-marketplace jobs without reconstructing the
  opportunity from a single request run.
- Preserve request-scoped tracked grants as the per-run research output while
  linking those outputs back to the durable opportunity record they inform.

## Capabilities

### New Capabilities
- `opportunity-catalog`: durable grant and RFP records sourced from research
  runs, enriched by users, and reused across later pursuit workflows
- `opportunity-research-loops`: targeted follow-up research that starts from an
  existing opportunity record and writes refreshed findings back to that record

### Modified Capabilities
- `funding-research-api`: research completion must upsert durable opportunity
  records and keep request-scoped outputs linked to those records
- `grant-intelligence-hub`: catalog detail must support enrichment, refreshed
  research entry points, and durable opportunity selection
- `proposal-workspace-lifecycle`: proposal work must be able to start from a
  durable catalog opportunity, not only a tracked grant or manual entry
- `marketplace-workflows`: proposal-marketplace jobs must be creatable from a
  durable catalog opportunity while preserving source traceability

## Impact

- Platform types, persistence, and service orchestration for tracked grants,
  catalog entries, and research request linkage
- Browser and API flows for catalog enrichment, refreshed research, and direct
  proposal/workstream entry points from durable opportunity records
- Proposal workspace and marketplace flows that currently assume tracked grants
  are the only reusable opportunity source
- Focused tests and browser verification for the new durable opportunity loop
