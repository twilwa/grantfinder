## ADDED Requirements

### Requirement: Follow-up research can start from a durable opportunity record
The system SHALL let an authenticated requester start additional research from
an existing durable opportunity record so new questions can be investigated
without rebuilding the opportunity context from scratch.

#### Scenario: Requester starts follow-up research from catalog detail
- **WHEN** an authenticated requester requests additional research for a
  durable opportunity record
- **THEN** the system SHALL create a research request linked to that record
- **THEN** the request SHALL carry forward the current opportunity context plus
  any user-supplied research focus

### Requirement: Refreshed research findings stay attached to the same durable opportunity
The system SHALL attach refreshed research outputs back to the durable
opportunity record that seeded the follow-up request.

#### Scenario: Follow-up research completes for an existing opportunity
- **WHEN** a linked follow-up research request completes
- **THEN** the system SHALL attach the refreshed findings and provenance to the
  same durable opportunity record
- **THEN** later reads of that opportunity SHALL expose the latest research
  state and the linked research history

#### Scenario: Requester revisits earlier research for a durable opportunity
- **WHEN** an authenticated requester reviews a durable opportunity with one or
  more linked research runs
- **THEN** the system SHALL expose the linked research requests or reports for
  that opportunity
- **THEN** the requester SHALL be able to continue from the latest refreshed
  state without losing earlier evidence
