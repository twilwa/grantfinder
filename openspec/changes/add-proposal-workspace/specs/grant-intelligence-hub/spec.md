## ADDED Requirements

### Requirement: Tracked grant surfaces expose proposal workspace entry points
The authenticated workspace SHALL let requesters create or resume a proposal
workspace directly from tracked grant surfaces.

#### Scenario: Requester opens proposal work from a tracked grant
- **WHEN** an authenticated requester opens a tracked grant that does not yet
  have a proposal workspace
- **THEN** the system SHALL expose an action to create a proposal workspace for
  that tracked grant
- **THEN** the resulting workspace SHALL stay linked to the originating tracked
  grant

#### Scenario: Requester resumes proposal work from a tracked grant
- **WHEN** an authenticated requester opens a tracked grant that already has a
  linked proposal workspace
- **THEN** the system SHALL expose the current pursuit state for that link
- **THEN** the requester SHALL be able to continue into the existing proposal
  workspace instead of creating a duplicate pursuit
