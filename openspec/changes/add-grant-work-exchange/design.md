## Context

Grantfinder currently has two strong primitives:

- a research pipeline that produces durable research requests, grant reports,
  and tracked grant candidates
- a marketplace pipeline that supports jobs, offers, engagements, and x402
  funding

Those primitives are useful, but they are not yet composed into a full grant
platform. The current model is still centered on a research request, with
tracked grants acting as a thin derivative of report output. It does not yet
support a persistent organization identity, a durable grant catalog separate
from research output, or a structured application workspace that can be passed
between AI and marketplace actors.

This change introduces a new product architecture:

- `Organization` is the persistent knowledge base
- `Grant Report` is research output
- `Grant Catalog Entry` is a durable, curated, bookmarkable opportunity
- `Application Workspace` is a structured draft/proposal artifact
- `Service Engagement` is help requested on a grant, workspace, or section

The implementation needs to preserve existing research and marketplace
capabilities while expanding the data model and browser workflows around these
new artifacts.

## Goals / Non-Goals

**Goals:**
- Add a persistent organization profile with structured metadata, personnel, and
  invite-aware collaboration
- Separate research output from grant catalog state so reports and catalog
  entries can evolve independently
- Model application work as structured section data with document types and
  workspace lifecycle
- Support curated funder-specific schemas and user-created templates without
  forcing the generic path to drive the curated path
- Attach the marketplace directly to grants, workspaces, and sections
- Introduce scoped BYOK / OAuth provider connections as a first-class platform
  concept
- Keep the initial implementation additive so current research-request flows and
  marketplace slices continue to work while the new domain is introduced

**Non-Goals:**
- Building a rich block-based or WYSIWYG editor as the primary authoring model
- Building a standalone chat or inbox product beyond what is needed for artifact
  collaboration
- Building a broad no-code form builder before curated schemas prove out
- Replacing the existing research engine or x402 funding path
- Shipping the full subscription, continuous-match, and concierge-service layer
  in the first implementation slice

## Decisions

### Decision: Introduce a durable organization domain instead of extending scenarios

The current `PlatformResearchScenario` model is request-oriented and cannot act
as a reusable organization identity. We will add a separate persistent
organization model and use it as the source of truth for scouting inputs,
workspace prefills, personnel, and agent permissions.

Why this over extending scenarios:
- scenarios are useful as reusable research prompts, but they are not an
  organization record
- organization data has different lifecycle and access-control needs than a
  scenario
- prefills and collaboration require stable organization ownership, not
  per-request snapshots

Alternatives considered:
- Extend `PlatformResearchScenario` with organization fields. Rejected because it
  conflates research setup with organization identity and would make
  collaboration and permissions harder to reason about.

### Decision: Keep grant reports and grant catalog entries as separate artifacts

Research output and grant browse/apply targets will be separate models. A report
may reference many opportunities; a catalog entry is a durable, normalized
opportunity that can be bookmarked and attached to workspaces.

Why this over reusing tracked grants as the only durable object:
- reports are ephemeral and iterative by nature
- a catalog entry needs stable bookmark/apply semantics independent of a single
  run
- a curated entry may come from manual curation, not only a research run

Alternatives considered:
- Treat `PlatformTrackedGrant` as both report artifact and catalog entry.
  Rejected because it binds catalog lifecycle to request lifecycle and makes
  curation awkward.

### Decision: Use structured section workspaces instead of generic documents

Application workspaces will be modeled as ordered sections with document types,
saved inputs, generated outputs, examples, and validation metadata. Proposals
remain renderable documents, but the system of record is structured section
data.

Why this over a freeform document editor:
- funder-specific forms are naturally structured
- section-level AI generation and marketplace help depend on addressable section
  state
- validation, examples, and org-prefill are easier against structured fields

Alternatives considered:
- Rich document blocks as the source of truth. Rejected because it weakens
  schema-driven generation and makes section-targeted service exchange less
  precise.

### Decision: Attach curated schemas to catalog entries and keep custom templates separate

Curated grant catalog entries will optionally reference a funder-specific schema.
User-created templates will be a parallel capability, not the basis for curated
grant flows.

Why this over one unified template system:
- curated grants and custom templates have different trust and curation models
- the product value is strongest in curated, high-signal schemas
- a unified abstraction can still exist under the hood without making the
  curated path depend on end-user authoring features

Alternatives considered:
- Build a full template builder first and use it for curated grants. Rejected
  because it front-loads power-user complexity and delays the highest-value
  curated path.

### Decision: Marketplace requests target artifacts, not only jobs

Marketplace requests will support targets at three levels:
- grant catalog entry
- application workspace
- application workspace section

This lets the marketplace serve as a service exchange embedded in the grant
lifecycle.

Why this over preserving only generic proposal jobs:
- users often need targeted help, such as reviewing a budget narrative or
  filling a specific funder section
- artifact-scoped requests create clearer deliverables and pricing
- this is the main product differentiation from closed concierge flows

Alternatives considered:
- Keep one generic proposal job type. Rejected because it loses scope precision
  and makes marketplace handoff weaker.

### Decision: Model provider connections explicitly with ownership and policy

BYOK and OAuth-backed provider connections will be explicit platform objects with
scope (`organization` or `user`), policy metadata, and auditable execution logs.

Why this over reusing global environment keys:
- organizations need their own providers and approval rules
- user-level connections are distinct from org-wide automation
- auditability is required once agent actions affect grant reports or
  application workspaces

Alternatives considered:
- Keep provider configuration environment-only. Rejected because it cannot
  express org/user ownership, marketplace use, or approval controls.

### Decision: Build in additive slices with a compatibility bridge

The first implementation slice will introduce the new domain objects while
preserving current request, tracked grant, and marketplace workflows. Existing
tracked grants can continue to exist while report-backed promotion creates
catalog entries and new workspaces.

Why this over a hard rewrite:
- the current platform already works and provides verification surface
- the new model touches many services and browser views
- additive migration reduces risk and lets us test each artifact boundary in
  isolation

Alternatives considered:
- Rewrite the request/grant/workspace domain in one pass. Rejected because it
  would expand migration risk without improving the end state.

## Risks / Trade-offs

- [Domain overlap between tracked grants, reports, and catalog entries] →
  Introduce explicit identity and promotion rules so each object has one clear
  purpose and lifecycle.
- [Schema curation becomes labor-intensive] → Start with a small curated set and
  treat custom templates as a secondary path.
- [Structured sections feel rigid for long-form writing] → Keep section content
  rich enough for narrative editing while preserving section identity as the
  source of truth.
- [Organization prefills can drift from workspace-specific truth] → Store
  explicit copied values on the workspace and let users override them without
  mutating the organization record automatically.
- [Artifact-scoped marketplace requests add UI complexity] → Limit initial
  service-target types to grant, workspace, and section and reuse the existing
  engagement pipeline.
- [Provider connections introduce secret-handling and policy complexity] →
  Introduce owned connection records and audit logging before enabling broad
  automation actions.

## Migration Plan

1. Add new persistent models for organizations, personnel, catalog entries,
   bookmarks, application workspaces, workspace sections, and provider
   connections.
2. Keep existing research requests and tracked grants intact while adding a
   promotion flow from report/tracked-grant output into catalog entries.
3. Introduce organization-aware browser flows and prefills without removing the
   current scenario-backed research entry points.
4. Add workspace creation from curated catalog entries and generic document
   types.
5. Extend marketplace request targeting to artifact scopes while preserving the
   existing generic job path.
6. Add provider connections and audit logging behind explicit user actions and
   permission checks.

Rollback strategy:
- Because the new domain is additive, rollback can disable new browser routes
  and new creation paths while leaving research requests, tracked grants, and
  marketplace engagements operational.

## Open Questions

- Should the first organization model support multiple organizations per user,
  or should the initial slice assume one active organization per user account?
- Should catalog promotion preserve a live link back to the originating report
  opportunity for refresh/revalidation, or only store a snapshot?
- What minimum document types are required in the first slice beyond `grant` and
  `loi`?
- Which provider connections should be supported first for BYOK and OAuth-based
  agent workflows?
- Do we want marketplace pricing anchored to sections and artifacts in the data
  model immediately, or can section targeting resolve through a generic job
  abstraction in the first slice?
