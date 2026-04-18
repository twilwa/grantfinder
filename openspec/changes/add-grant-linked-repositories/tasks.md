## 1. Repository binding domain model

- [ ] 1.1 Write failing domain tests for GitHub repository binding persistence,
  replacement, clearing, and effective binding resolution
- [ ] 1.2 Extend platform types, persistence, and public projections for GitHub
  repository bindings and publication status on tracked grants, catalog grants,
  and manual proposal workspaces
- [ ] 1.3 Add service helpers that resolve the effective repository binding for
  proposal and application workspaces without duplicating repository state

## 2. API and workspace exposure

- [ ] 2.1 Write failing REST and JSON-RPC tests for attach, update, clear, read,
  and effective-binding workspace aggregate flows
- [ ] 2.2 Add REST and JSON-RPC flows to attach, update, clear, and read GitHub
  repository bindings for eligible grant and RFP pursuit records
- [ ] 2.3 Expose effective repository binding metadata and sync status in the
  workspace aggregates returned to browser, REST, and JSON-RPC clients

## 3. GitHub publication plumbing

- [ ] 3.1 Write failing publication-plumbing tests for deterministic paths,
  provider-connection gating, success metadata, failure metadata, and audit
  records
- [ ] 3.2 Add GitHub publication helpers that use provider connections, target a
  deterministic repository root, and return commit or failure metadata
- [ ] 3.3 Record repository publication attempts through the existing execution
  audit model and persist the latest sync status on the bound pursuit record

## 4. Research-side repository publication

- [ ] 4.1 Write failing research-flow tests for successful publication and
  failed-publication preservation of platform research output
- [ ] 4.2 Publish research brief, report, and supporting outputs for repo-linked
  grant and opportunity research runs
- [ ] 4.3 Surface latest research publication results on tracked-grant and
  catalog-grant reads so users can tell whether the repo is current

## 5. Proposal and application publication

- [ ] 5.1 Write failing proposal/application tests for durable proposal artifact
  publication, explicit proposal sync, application section publication,
  final-document publication, and manual RFP workspace publication
- [ ] 5.2 Publish proposal-side agent outputs, explicit proposal sync outputs, and
  application section generations into the effective repository
- [ ] 5.3 Publish finalized proposal or application documents into the same
  repository and support the manual RFP path through proposal workspaces

## 6. Browser attach/open controls

- [ ] 6.1 Write failing browser tests for attach, update, clear, binding source,
  and open-repository controls across grant and proposal surfaces
- [ ] 6.2 Add browser controls and detail views for attaching, updating,
  clearing, and opening repositories across grant and proposal surfaces

## 7. Browser sync visibility, docs, and verification

- [ ] 7.1 Write failing browser tests for latest published commit/path,
  blocked-publication state, failed-publication state, and stale-platform-artifact
  messaging
- [ ] 7.2 Add browser sync-state views across grant, proposal, and application
  surfaces
- [ ] 7.3 Update `/docs` and `/skill.md`, run OpenSpec
  plus targeted verification for repository binding and publication flows
