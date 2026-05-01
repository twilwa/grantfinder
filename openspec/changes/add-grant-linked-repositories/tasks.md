## 1. Repository binding domain model

- [x] 1.1 Write failing domain tests for GitHub repository binding persistence,
  replacement, clearing, default `grantfinder/` root path, Privy-linked GitHub
  credential requirement, and effective binding resolution
- [x] 1.2 Extend platform types, persistence, and public projections for GitHub
  repository bindings and publication status on tracked grants, catalog grants,
  and manual proposal workspaces
- [x] 1.3 Add service helpers that resolve the effective repository binding for
  proposal and application workspaces without duplicating repository state

## 2. API and workspace exposure

- [x] 2.1 Write failing REST and JSON-RPC tests for attach, update, clear, read,
  and effective-binding workspace aggregate flows
- [x] 2.2 Add REST and JSON-RPC flows to attach, update, clear, and read GitHub
  repository bindings for eligible grant and RFP pursuit records
- [x] 2.3 Expose effective repository binding metadata and sync status in the
  workspace aggregates returned to browser, REST, and JSON-RPC clients

## 3. GitHub publication plumbing

- [x] 3.1 Write failing publication-plumbing tests for deterministic paths,
  Grantfinder branch naming, pull request creation/update, Privy-linked GitHub
  credential gating, success metadata, failure metadata, and audit records
- [x] 3.2 Add GitHub publication helpers that use Privy-linked GitHub credentials
  and provider connections, target a deterministic repository root, update a
  Grantfinder branch, and open or update a pull request
- [x] 3.3 Record repository publication attempts through the existing execution
  audit model and persist the latest sync status on the bound pursuit record

## 4. Research-side repository publication

- [x] 4.1 Write failing research-flow tests for successful publication and
  failed-publication preservation of platform research output
- [x] 4.2 Publish research brief, report, and supporting outputs for repo-linked
  grant and opportunity research runs
- [x] 4.3 Surface latest research publication results on tracked-grant and
  catalog-grant reads so users can tell whether the repo is current

## 5. Proposal and application publication

- [x] 5.1 Write failing proposal/application tests for durable proposal artifact
  publication, explicit proposal sync, application section publication,
  final-document publication, and manual RFP workspace publication
- [x] 5.2 Publish proposal-side agent outputs, explicit proposal sync outputs, and
  application section generations into the effective repository
- [x] 5.3 Publish finalized proposal or application documents into the same
  repository and support the manual RFP path through proposal workspaces

## 6. Browser attach/open controls

- [x] 6.1 Write failing browser tests for attach, update, clear, binding source,
  default `grantfinder/` root path, GitHub account-link prompt, and
  open-repository controls across grant and proposal surfaces
- [x] 6.2 Add browser controls and detail views for attaching, updating,
  clearing, and opening repositories across grant and proposal surfaces

## 7. Browser sync visibility, docs, and verification

- [x] 7.1 Write failing browser tests for latest published commit/path,
  branch and pull request links, blocked-publication state, failed-publication
  state, and stale-platform-artifact messaging
- [x] 7.2 Add browser sync-state views across grant, proposal, and application
  surfaces
- [x] 7.3 Update `/docs` and `/skill.md`, run OpenSpec
  plus targeted verification for repository binding and publication flows
