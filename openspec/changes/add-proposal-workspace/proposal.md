## Why

The platform can already discover grants, persist tracked opportunities, draft
application sections, and hand proposal work to specialists through the
marketplace. What it cannot do yet is coordinate the in-between work: qualify
an opportunity, decide whether to bid, capture sponsor contacts, track
outreach, keep proposal next steps visible, and carry the pursuit through
submission and outcome.

We need a durable proposal workspace so the product closes the loop from "find
grant" to "write proposal" to "reach the right contact" to "win the grant or
secure the RFP" without forcing users back into ad hoc spreadsheets and notes.

## What Changes

- Add a durable proposal workspace that can be created from a tracked grant or
  a manual opportunity entry for RFP-style work.
- Make the proposal workspace the coordination layer for qualification,
  drafting, outreach, submission, and final outcome.
- Let the requester and authorized organization collaborators work from the
  same proposal workspace instead of splitting pursuit state across private
  notes.
- Store a lightweight feasibility snapshot, workspace stage, next-step plan,
  sponsor contacts, outreach history, and submission outcome on each proposal
  workspace.
- Reuse the existing application workspace as the canonical draft surface
  instead of creating a second proposal document model.
- Reuse provider-backed execution logging for proposal actions such as
  feasibility evaluation, contact discovery, outreach drafting, next-step
  planning, and section refreshes.
- Keep proposal-origin collaboration inside the current marketplace job, offer,
  and engagement flows rather than inventing a separate proposal staffing
  subsystem.

## Capabilities

### New Capabilities
- `proposal-workspace-lifecycle`: durable proposal workspaces that coordinate
  qualification, drafting, outreach, submission, and outcome for tracked
  grants and manually entered opportunities.

### Modified Capabilities
- `grant-intelligence-hub`: tracked grant surfaces need proposal workspace
  create/open entry points and linked pursuit state.
- `application-workspaces`: proposal workspaces need to create, reopen, and
  summarize the canonical draft workspace.
- `agent-provider-connections`: provider-backed proposal actions need auditable
  execution records against proposal artifacts.
- `marketplace-workflows`: proposal workspaces need to stay linked to the
  existing job, offer, and engagement flow.

## Impact

- New proposal workspace state in the platform types, persistence layer, and
  service aggregate returned to the browser workspace shell
- New browser list/detail surfaces for proposal workspaces plus tracked-grant
  entry points
- New APIs for proposal workspace lifecycle, feasibility snapshots, contact and
  outreach management, and outcome tracking
- Extended provider execution targeting so proposal actions remain auditable
- Extended marketplace linkage so a proposal workspace can continue through
  specialist offers and funded engagements
- New tests for proposal workspace persistence, linked drafting, provider
  action logging, outreach history, and outcome lifecycle
