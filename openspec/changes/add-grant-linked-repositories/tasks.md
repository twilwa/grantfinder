## 1. Repository binding domain model

- [ ] 1.1 Extend platform types, persistence, and public projections for GitHub
  repository bindings and publication status on tracked grants, catalog grants,
  and manual proposal workspaces
- [ ] 1.2 Add service helpers that resolve the effective repository binding for
  proposal and application workspaces without duplicating repository state

## 2. API and workspace exposure

- [ ] 2.1 Add REST and JSON-RPC flows to attach, update, clear, and read GitHub
  repository bindings for eligible grant and RFP pursuit records
- [ ] 2.2 Expose effective repository binding metadata and sync status in the
  workspace aggregates returned to browser, REST, and JSON-RPC clients

## 3. GitHub publication plumbing

- [ ] 3.1 Add GitHub publication helpers that use provider connections, target a
  deterministic repository root, and return commit or failure metadata
- [ ] 3.2 Record repository publication attempts through the existing execution
  audit model and persist the latest sync status on the bound pursuit record

## 4. Research-side repository publication

- [ ] 4.1 Publish research brief, report, and supporting outputs for repo-linked
  grant and opportunity research runs
- [ ] 4.2 Surface latest research publication results on tracked-grant and
  catalog-grant reads so users can tell whether the repo is current

## 5. Proposal and application publication

- [ ] 5.1 Publish proposal workspace artifacts, proposal-side agent action
  outputs, and application section generations into the effective repository
- [ ] 5.2 Publish finalized proposal or application documents into the same
  repository and support the manual RFP path through proposal workspaces

## 6. Browser, docs, and verification

- [ ] 6.1 Add browser controls and detail views for attaching repositories,
  opening them, and understanding sync state across grant and proposal surfaces
- [ ] 6.2 Update `/docs` and `/skill.md`, add focused tests, and run OpenSpec
  plus targeted verification for repository binding and publication flows
