## ADDED Requirements

### Requirement: Platform SHALL support proposal jobs sourced from durable opportunity records
The system SHALL let a requester start proposal-marketplace collaboration from
a durable catalog opportunity record.

#### Scenario: Requester creates a proposal job from a durable opportunity
- **WHEN** an authenticated requester starts marketplace collaboration from a
  durable opportunity record
- **THEN** the platform SHALL create or attach a `grant_proposal` job that
  references that record
- **THEN** later job, workspace, and engagement reads SHALL expose the durable
  opportunity as the source context for that work
