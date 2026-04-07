## ADDED Requirements

### Requirement: Proposal workspaces reuse application workspaces as the canonical draft surface
The system SHALL let a proposal workspace create, attach, and reopen one
primary application workspace as the canonical place for proposal draft
content.

#### Scenario: Requester starts a draft workspace from proposal work
- **WHEN** an authenticated requester creates or opens draft content from a
  proposal workspace
- **THEN** the system SHALL create or reuse an application workspace instead of
  creating a second proposal document model
- **THEN** the linked application workspace SHALL remain reachable from the
  proposal workspace

### Requirement: Proposal workspace reads summarize linked draft state
The system SHALL expose enough linked application workspace state for the
proposal workspace to show current draft progress.

#### Scenario: Requester reviews draft progress from proposal work
- **WHEN** an authenticated requester fetches a proposal workspace with a
  linked application workspace
- **THEN** the system SHALL return the linked draft title, state, and recent
  update summary
- **THEN** the requester SHALL be able to tell whether drafting is still in
  progress or already finalized without leaving the proposal workspace
