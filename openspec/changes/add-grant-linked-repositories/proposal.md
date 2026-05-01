## Why

Grantfinder can already discover grants and RFPs, persist durable opportunity
state, and coordinate proposal work. What it cannot do yet is carry that work
into the repository where the user actually wants agents to keep moving.

Users need to attach a GitHub repository to the grant or RFP they are most
likely to pursue so research notes, proposal drafts, supporting documents, and
starter project artifacts land in a real working repo that they can grab and go
from.

## What Changes

- Add a GitHub repository binding to eligible grant and RFP pursuit records so
  each pursuit can resolve one effective working repository.
- Expose repository binding metadata and sync state through browser, REST, and
  JSON-RPC reads and update flows.
- Publish research-agent outputs into the attached repository through a
  Grantfinder-managed branch and pull request using stable file layout
  conventions.
- Publish proposal-workspace artifacts, application drafts, finalized proposal
  documents, and related supporting files into that same repository.
- Use GitHub accounts linked through the Privy login flow for GitHub write
  access, while preserving provider/execution records for auditability.

## Capabilities

### New Capabilities
- `grant-repository-binding`: attach and resolve the effective GitHub
  repository for grant-backed and RFP-style pursuits.
- `repository-backed-artifacts`: publish research and proposal outputs into the
  attached repository and track sync state.

### Modified Capabilities
<!-- Existing capabilities whose REQUIREMENTS are changing (not just implementation).
     Only list here if spec-level behavior changes. Each needs a delta spec file.
     Use existing spec names from openspec/specs/. Leave empty if no requirement changes. -->

## Impact

- Platform types, persistence, and service resolution for repository bindings
  and publication status
- Tracked-grant, catalog-grant, proposal-workspace, and application-workspace
  browser and API surfaces
- Provider-connection and execution logging support for GitHub repository
  publication
- Research and proposal artifact generation flows that need to write files into
  the attached repository
- New tests for binding resolution, repository publication, audit trails, and
  failure handling
