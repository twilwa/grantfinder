## Why

Grantfinder already has a strong research engine and a first marketplace slice,
but it still treats research as the main product and application work as a thin
follow-on. To become a full grant platform, it needs persistent organization
knowledge, durable grant intelligence, structured application workspaces, and a
service exchange where researchers, writers, reviewers, and application
specialists can contribute directly to a grant outcome.

We also have a chance to differentiate from closed grant-writing SaaS tools by
making the platform agent-native: organizations should be able to bring their
own model providers and connected agents into research and application
workflows, while keeping human approval and marketplace handoff in the loop.

## What Changes

- Add a persistent organization knowledge base with structured profile fields,
  personnel records, invite flows, permission-aware collaboration, and reusable
  facts that prefill research and application work.
- Split grant intelligence into two durable products:
  - grant reports generated from research runs
  - curated, bookmarkable grant catalog entries that can be promoted from
    research output or managed directly
- Add structured application workspaces for grants and adjacent funding
  documents, including draft and proposal lifecycle states, document types, and
  per-section AI assistance.
- Add funder-specific application schemas for curated grants so each
  opportunity can carry its own structured application flow, guidance, and
  validation.
- Extend the marketplace so help can be requested for a grant, an application
  workspace, or an individual section instead of only generic proposal jobs.
- Add organization- and user-scoped provider connections for BYOK and OAuth-fed
  agent workflows, with auditable execution attached to reports and application
  workspaces.
- Keep notifications, subscriptions, and continuous matching in scope as
  follow-on platform layers, but anchor the initial architecture around the
  organization, catalog, workspace, and exchange models first.

## Capabilities

### New Capabilities
- `organization-knowledge-base`: Persist structured organization identity,
  personnel, invite permissions, and reusable organization facts that feed
  scouting, application prefills, and marketplace briefs.
- `grant-intelligence-hub`: Store research-generated grant reports, promote
  durable catalog entries, support bookmarks, and let operators browse grants
  separately from ephemeral research runs.
- `application-workspaces`: Create structured draft and proposal workspaces for
  grants, LOIs, and adjacent funding documents with section-based editing and
  AI generation.
- `funder-application-schemas`: Attach curated, funder-specific form schemas,
  examples, and validation rules to grant catalog entries and support
  user-created templates as a secondary path.
- `proposal-service-exchange`: Let organizations hire researchers, writers,
  reviewers, and submission specialists for a grant, workspace, or section with
  marketplace-native workflow state.
- `agent-provider-connections`: Support BYOK and OAuth-backed provider
  connections for organization and user agents, with policy-gated execution and
  audit trails.

### Modified Capabilities
- None.

## Impact

- New persistent domain models for organizations, personnel, invites, catalog
  entries, application workspaces, workspace sections, and agent connections
- New browser surfaces for organization setup, grant browsing, bookmarks,
  reports, application drafts, proposals, and service-request workflows
- Expanded service-layer orchestration between research requests, curated grant
  entries, workspaces, and marketplace engagements
- New tests for structured organization prefills, grant catalog promotion,
  workspace lifecycle, schema-driven application flows, and marketplace
  attachments to work artifacts
- Updated docs for organization onboarding, grant intelligence flows,
  workspace authoring, marketplace service exchange, and provider connection
  setup
