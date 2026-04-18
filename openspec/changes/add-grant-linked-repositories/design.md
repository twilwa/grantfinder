## Context

Grantfinder already has the right operating records for this feature: tracked
grants, durable catalog grants, proposal workspaces, application workspaces,
provider connections, and auditable execution records. The missing piece is a
repository target that lets agent-created outputs leave the platform and land
in the project space where the user wants to continue working.

The request is broader than storing a bare URL. The system needs to know which
grant or RFP owns the repository context, how downstream proposal work resolves
that context, how agents obtain write access, and how repository publication
behaves when a write succeeds or fails.

## Goals / Non-Goals

**Goals:**
- Let authorized users attach a GitHub repository to the grant or RFP pursuit
  they want agents to work from
- Resolve one effective repository binding for downstream proposal and
  application workspaces
- Publish research and proposal artifacts into that repository using
  deterministic paths
- Keep repository publication auditable and visible through the existing
  provider execution model
- Preserve platform state as the durable system of record even when repository
  publication fails

**Non-Goals:**
- Replacing the platform data model with a repo-only workflow
- Building a general-purpose source control manager beyond GitHub repository
  attachment and artifact publication
- Designing a full software-project scaffolding system for every grant type
- Solving arbitrary bidirectional sync from GitHub back into platform records in
  the first version

## Decisions

### Decision: Store repository bindings on pursuit records and resolve an effective binding downstream

Repository bindings should live on the records that anchor pursuit context:
tracked grants, durable catalog grants, and manual proposal workspaces for
RFP-style pursuits. Downstream reads should resolve an effective repository
binding instead of copying repository fields onto every derived object.

Resolution order:
1. Proposal workspace binding when the workspace is manual or explicitly
   overridden
2. Linked catalog grant binding when present
3. Linked tracked grant binding

Application workspaces should expose the effective repository from their linked
catalog or proposal context rather than persisting a second independent
repository attachment.

Why this over a proposal-workspace-only model:
- research outputs happen before proposal work exists
- the user asked for repository attachment on the grant or RFP itself
- durable grant and RFP records already act as the handoff point into proposal
  work

Alternatives considered:
- Attach repositories only to proposal workspaces. Rejected because it misses
  research-agent output and makes grant-first pursuit setup awkward.
- Attach repositories only to durable catalog grants. Rejected because manual
  RFP pursuits need the same behavior.

### Decision: Model the repository binding as structured GitHub configuration, not a bare URL

The binding should include enough metadata to support deterministic writes and
clear audit trails:
- GitHub repository URL
- default branch
- optional repository root path for Grantfinder-managed files
- provider connection identifier used for write access
- actor and timestamp metadata for who attached or updated the binding
- latest publication status metadata such as last publish time, commit SHA, and
  most recent error

Why this over a single string URL:
- write operations need branch, path, and credential context
- the browser needs to show whether the repository is current or blocked
- audit logs need to point back to the connection used for publication

Alternatives considered:
- Store only the URL and infer everything else later. Rejected because it
  pushes critical configuration into hidden service heuristics.

### Decision: Keep platform records authoritative and treat the repository as a synchronized artifact surface

Research reports, proposal workspace state, application section content, and
finalized proposal documents should still be saved in platform persistence
first. Repository publication should happen after the platform artifact exists,
and a publication failure should not discard the saved artifact.

Why this over repo-first writes:
- platform reads, browser views, and existing proposal flows already depend on
  local persistence
- repository writes can fail for auth, branch, or network reasons
- the user still needs the latest artifact in the product even when GitHub is
  temporarily unavailable

Alternatives considered:
- Make GitHub publication the only write path. Rejected because it would make
  the whole product brittle on repository access.

### Decision: Publish into deterministic repository paths using stable IDs

Grantfinder-managed files should land under a predictable root so users and
agents know where to look and later automation can update the same files
without fuzzy matching.

Initial layout:
- `<root>/research/<request-id>/brief.md`
- `<root>/research/<request-id>/report.md`
- `<root>/pursuits/<proposal-workspace-id>/workspace.md`
- `<root>/pursuits/<proposal-workspace-id>/contacts.md`
- `<root>/pursuits/<proposal-workspace-id>/outreach.md`
- `<root>/applications/<application-workspace-id>/<section-key>.md`
- `<root>/applications/<application-workspace-id>/final.md`

Stable IDs should drive the path shape so repository updates remain safe even if
titles or sponsor names change later.

Why this over title-based file naming:
- grant titles and sponsor names are editable enrichment fields
- stable IDs avoid path churn and accidental overwrites
- it keeps later sync logic simple

### Decision: Reuse provider connections and execution records for GitHub publication

GitHub publication should use the existing provider-connection mechanism so the
system can scope credentials to the user or organization and continue recording
execution history with a single audit model. Repository writes should appear as
execution records tied to the originating tracked grant, catalog grant,
proposal workspace, or application workspace action.

Why this over a dedicated GitHub secret store:
- provider connections already model scoped external access
- proposal and generation actions already log executions there
- it avoids inventing a second credential and auditing path

Alternatives considered:
- Add repository write secrets directly to the repository binding. Rejected
  because it duplicates credential handling and weakens audit clarity.

## Risks / Trade-offs

- [Binding drift across tracked grants, catalog grants, and proposal workspaces]
  → Use explicit effective-binding resolution rules and show the source record
  in browser and API reads.
- [Repository writes fail after the platform has already saved an artifact] →
  Keep platform state authoritative, record the publish failure, and expose the
  error so users can retry.
- [GitHub auth configuration is missing or scoped incorrectly] → Require a
  compatible provider connection on the repository binding and report blocked
  publication clearly.
- [Deterministic repository paths become noisy over long pursuits] → Keep the
  first version stable and transparent, then revisit compaction or archival
  rules as follow-up work.

## Migration Plan

1. Extend pursuit records with repository binding and publication-status fields.
2. Add resolution helpers so downstream proposal and application reads expose
   the effective repository.
3. Add GitHub publication helpers using provider connections and execution
   logging.
4. Hook publication into research completion, proposal actions, section
   generation, and proposal finalization.
5. Add browser and docs surfaces for attaching repositories and inspecting sync
   state.

Rollback strategy:
- Disable repository publication while leaving the stored binding fields in
  place, so users keep their configuration and platform artifacts remain intact.

## Open Questions

- Should proposal workspaces be allowed to override a linked grant repository
  after the grant already has one, or should the grant remain canonical once the
  pursuit exists?
- Should repository publication run inline with the existing request or action,
  or should a later follow-up move publication into a retryable async queue?
