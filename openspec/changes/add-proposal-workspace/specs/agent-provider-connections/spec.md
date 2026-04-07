## ADDED Requirements

### Requirement: Provider-backed proposal actions are auditable against proposal artifacts
The authenticated workspace SHALL record provider-backed proposal actions
against proposal artifacts so feasibility, contact discovery, outreach
drafting, next-step planning, and draft refreshes remain auditable.

#### Scenario: Provider-backed proposal action records an execution entry
- **WHEN** an authenticated user runs a provider-backed proposal action from a
  proposal workspace or its linked draft surface
- **THEN** the system SHALL persist an execution record for that action
- **THEN** the record SHALL identify the proposal artifact that the action was
  performed against

#### Scenario: Requester reviews proposal-related provider activity
- **WHEN** an authenticated requester opens execution history for proposal work
- **THEN** the system SHALL expose provider-backed actions related to proposal
  workspaces and linked draft artifacts
- **THEN** the requester SHALL be able to audit what provider action produced
  the visible feasibility, outreach, or draft update state
