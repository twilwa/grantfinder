## ADDED Requirements

### Requirement: Proposal workspaces can start from durable opportunity records
The system SHALL let an authenticated requester create or reopen a proposal
workspace from a durable catalog opportunity record.

#### Scenario: Requester starts proposal work from a durable opportunity
- **WHEN** an authenticated requester starts proposal work from a durable
  opportunity record
- **THEN** the system SHALL create or reuse a proposal workspace linked to
  that record
- **THEN** the workspace SHALL carry forward the current opportunity context
  needed for qualification and drafting

#### Scenario: Requester resumes proposal work from a durable opportunity
- **WHEN** an authenticated requester opens a durable opportunity record that
  already has linked proposal work
- **THEN** the system SHALL expose the current proposal workspace state for
  that record
- **THEN** the requester SHALL be able to continue into the existing pursuit
  instead of creating a duplicate workspace
