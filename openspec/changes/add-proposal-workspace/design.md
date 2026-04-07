## Context

The current platform already has most of the pieces needed to pursue work after
research:
- durable research requests and tracked grants
- durable catalog entries
- section-based application workspaces
- proposal-job creation from tracked grants
- provider-backed execution records

What is missing is the durable record between "this is a promising grant" and
"this pursuit was submitted, awarded, declined, or dropped." Right now that
operational state has no home in the product, so users have to manage it
outside the platform.

The first version should stay thin. It should add a proposal workspace as the
orchestration layer and reuse the existing grant, drafting, provider, and
marketplace systems instead of introducing a second drafting subsystem or a new
standalone app shell.

## Goals / Non-Goals

**Goals:**
- Add a durable proposal workspace that can start from a tracked grant or a
  manually entered opportunity for RFP-style pursuits.
- Persist a simple pursuit stage, feasibility snapshot, next-step plan,
  contacts, outreach history, and outcome on the workspace.
- Let authorized organization collaborators access the same proposal workspace
  through the existing organization membership model.
- Reuse one primary application workspace as the canonical draft surface for
  the proposal workspace.
- Reuse provider-backed execution logging for proposal actions such as
  feasibility evaluation, contact discovery, outreach drafting, next-step
  planning, and draft refreshes.
- Link proposal workspaces to existing proposal jobs and funded engagements.
- Surface proposal workspaces inside the existing authenticated browser shell.

**Non-Goals:**
- Build a second document model separate from application workspaces.
- Add real-time collaborative editing or per-workspace ACLs beyond the current
  authenticated user and organization model.
- Send email or messages directly from the platform in the first version.
- Generalize every grant concept to a broader "opportunity" domain in this
  change.
- Rebuild proposal work as a long-running steerable agent runtime before the
  workspace itself exists.

## Decisions

### Decision: Add one proposal workspace record as the orchestration layer

The system will introduce a durable proposal workspace that owns the pursuit
state for one opportunity. It will carry:
- the source tracked grant when present
- optional manual opportunity metadata for RFP-style work
- shared access through the existing organization membership model when the
  requester belongs to an organization
- one primary application workspace reference
- feasibility, contacts, outreach, next-step, and outcome state
- linked marketplace job and engagement state when present

Why this over overloading tracked grants or application workspaces:
- tracked grants are discovery output, not pursuit records
- application workspaces are draft artifacts, not the full operating context
- one orchestration object keeps the product state legible and auditable

Alternatives considered:
- Add more fields directly to tracked grants. Rejected because the discovery
  record and the pursuit record have different lifecycles.
- Treat application workspaces as the proposal control room. Rejected because
  drafting is only one part of the pursuit.

### Decision: Reuse existing organization membership for collaborative access

Proposal workspaces will be visible to the requester and to authorized members
of the same organization through the access rules the platform already uses for
organization-scoped state.

Why this over requester-only ownership:
- the product intent is collaborative proposal pursuit, not a private note
  field on a tracked grant
- the platform already has organization membership and invite acceptance
  behavior
- it avoids introducing a second permission model before the workspace shape is
  proven

Alternatives considered:
- Keep proposal work requester-owned in v1. Rejected because it would not
  satisfy the shared-workspace goal.
- Add per-workspace role and comment systems immediately. Rejected because it
  is broader than the first useful collaboration slice.

### Decision: Support tracked-grant and manual-entry starts in v1

Proposal workspaces will support two creation paths:
- create from an existing tracked grant
- create from a manual opportunity entry when there is no tracked grant, which
  covers RFP-style pursuits without renaming the whole domain

Why this over tracked-grant-only starts:
- the product goal explicitly includes securing RFP-style work
- manual opportunity entry keeps the first version useful without designing a
  full parallel discovery model
- the rest of the workspace behavior is the same once the pursuit exists

Alternatives considered:
- Limit the feature to tracked grants only. Rejected because it would leave the
  RFP half of the loop outside the product.

### Decision: Reuse application workspaces as the canonical draft surface

Each proposal workspace will reference one primary application workspace. Draft
content remains in that existing section-based workspace model. The proposal
workspace will only store the link plus a small summary such as draft state,
updated time, and finalized status.

Why this over a second proposal document model:
- drafting already has the right persistence and browser editing flow
- duplicating sections or generated content would create merge and ownership
  problems
- the workspace can stay focused on coordination instead of document storage

Alternatives considered:
- Add a second proposal document structure to the proposal workspace. Rejected
  because it duplicates application workspace behavior and widens scope.

### Decision: Keep proposal actions as auditable provider-backed operations

The first version will model proposal actions as discrete provider-backed
operations, not as a second full research-request runtime. Actions such as
feasibility evaluation, contact discovery, outreach drafting, next-step
planning, and draft refresh will be recorded through the existing execution-log
pattern and targeted at proposal artifacts.

Why this over a new long-running run model:
- the thinnest useful product change is durable coordination, not a second
  agent console
- provider-backed one-shot actions already fit the current platform
- execution logging keeps the result auditable without new runtime machinery

Alternatives considered:
- Clone the research request model for proposal work immediately. Rejected for
  v1 because it adds substantial runtime complexity before the workspace shape
  is proven.

### Decision: Keep contacts and outreach lightweight and workspace-scoped

The proposal workspace will store a small contact record plus an outreach event
ledger. That is enough to answer:
- who the team should talk to
- what has already been sent
- whether a reply happened
- what the next follow-up is

Why this over a generic CRM:
- the proposal workspace only needs pursuit-scoped coordination
- a lightweight model is easier to surface in the browser and service layer
- it prevents the change from becoming a broad contact-management project

Alternatives considered:
- Build a reusable CRM subsystem. Rejected because it is not necessary to close
  the loop for proposal pursuit.

### Decision: Keep marketplace linkage additive to existing flows

The proposal workspace will link to the current `grant_proposal` job, offer,
and engagement flow instead of creating a separate collaboration or staffing
path. The workspace should be able to create or attach a proposal job and show
accepted or funded engagement status.

Why this over a separate proposal staffing model:
- jobs, offers, acceptances, and funding already exist
- the product should keep one specialist collaboration path
- users need the proposal workspace to stay connected to downstream work, not
  duplicate it

Alternatives considered:
- Add a proposal-only staffing subsystem. Rejected because it duplicates the
  marketplace model.

### Decision: Add the proposal surface inside the existing browser shell

The browser will expose proposal workspaces through the existing authenticated
workspace shell and shared data aggregate rather than introducing a new app or
router boundary.

Why this over a second app shell:
- the current signed-in dashboard already owns auth, data refresh, and
  navigation state
- the proposal workspace is an additive operator surface, like the existing
  research and applications views
- it keeps browser verification and integration scope contained

Alternatives considered:
- Build a separate proposal workspace app. Rejected because it adds navigation
  complexity without changing the underlying data model.

## Risks / Trade-offs

- [Proposal workspaces add another durable record to an already broad platform]
  -> Keep the workspace thin and make it a coordinator over existing grant,
  draft, provider, and marketplace entities instead of a replacement for them.
- [Manual RFP entry can drift from normalized grant metadata] -> Require a
  small set of manual fields up front and let provider-backed actions enrich
  the workspace later.
- [Execution logging against proposal artifacts requires a new artifact target]
  -> Extend target typing once and reuse the same audit path for future
  proposal actions.
- [Contacts and outreach can sprawl toward CRM behavior] -> Keep the data model
  pursuit-scoped, lightweight, and additive to workspace history.
- [Collaboration rules could drift from existing organization behavior] ->
  Reuse the current organization membership model first and only add
  proposal-specific roles if the shared-access model proves too coarse.
- [Users may expect full live proposal-agent steering because research has a
  control room] -> Document that v1 uses auditable discrete actions, and leave
  a later upgrade path to durable steerable runs.

## Migration Plan

1. Add proposal workspace, feasibility, contact, outreach, and outcome models
   to the platform types and persistence layer.
2. Add service-layer lifecycle methods plus REST and JSON-RPC routes for
   proposal workspaces and related updates, including organization-scoped
   access checks.
3. Link proposal workspaces to tracked grants, application workspaces, provider
   execution records, jobs, and engagements.
4. Extend the browser workspace aggregate and add a proposal workspace list and
   detail view to the authenticated shell.
5. Add tests for persistence, APIs, linked drafting, provider action logging,
   marketplace linkage, and browser flows.

Rollback is additive:
- hide the proposal workspace browser tab and entry points
- stop returning proposal workspace state from the shared workspace aggregate
- leave grant discovery, drafting, and marketplace flows intact

## Open Questions

- Should the first stage taxonomy be fixed to `qualifying`, `drafting`,
  `outreach`, `submitted`, `awarded`, `declined`, and `no_bid`, or should the
  service allow a smaller configurable set?
- Should the first version support one primary application workspace only, or
  should it immediately allow multiple linked drafts such as proposal plus
  budget narrative?
- Should provider-backed proposal actions target the proposal workspace
  directly, or should some actions attach to the linked application workspace
  or section when they materially update draft content?
- When specialists are linked through marketplace engagements, should they
  eventually see the full proposal workspace or only the linked draft/job
  surfaces?
