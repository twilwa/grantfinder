## ADDED Requirements

### Requirement: Proposal workspaces stay linked to proposal-marketplace collaboration
The system SHALL let proposal workspaces continue through the existing
grant-proposal job, offer, and engagement workflow so external collaboration
stays attached to the same pursuit record.

#### Scenario: Requester creates or attaches a proposal job from proposal work
- **WHEN** an authenticated requester starts marketplace collaboration from a
  proposal workspace
- **THEN** the system SHALL create or attach a `grant_proposal` job for that
  workspace
- **THEN** later reads of the proposal workspace SHALL expose the linked job
  state

#### Scenario: Accepted or funded engagement remains visible on proposal work
- **WHEN** a proposal workspace has a linked accepted or funded engagement
- **THEN** the system SHALL expose that engagement status on the proposal
  workspace
- **THEN** the requester SHALL be able to follow the pursuit through specialist
  collaboration without reconstructing the job state from the marketplace
