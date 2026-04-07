## ADDED Requirements

### Requirement: Proposal workspaces can start from tracked grants or manual opportunities
The system SHALL let an authenticated requester create a proposal workspace
from a tracked grant or from a manual opportunity entry when the pursuit does
not yet exist as a tracked grant.

#### Scenario: Requester creates a proposal workspace from a tracked grant
- **WHEN** an authenticated requester starts proposal work from a tracked grant
- **THEN** the system SHALL create a proposal workspace linked to that tracked
  grant
- **THEN** the workspace SHALL carry forward the available opportunity context
  needed to begin qualification and drafting

#### Scenario: Requester creates a proposal workspace for an RFP-style pursuit
- **WHEN** an authenticated requester creates a proposal workspace from a
  manual opportunity entry
- **THEN** the system SHALL persist that workspace without requiring a tracked
  grant link
- **THEN** the workspace SHALL remain available through the same browser and
  API surfaces as grant-backed proposal workspaces

### Requirement: Proposal workspaces persist pursuit stage and planning state
The system SHALL persist a proposal workspace as the durable operating record
for qualification, drafting, outreach, submission, and final outcome.

#### Scenario: Requester updates proposal stage and planning notes
- **WHEN** an authenticated requester updates the stage, next steps, open
  questions, or summary for a proposal workspace
- **THEN** the system SHALL persist those changes on that workspace
- **THEN** later reads of the workspace SHALL return the updated pursuit state

#### Scenario: Requester revisits an existing proposal workspace
- **WHEN** an authenticated requester opens a previously created proposal
  workspace
- **THEN** the system SHALL return the current stage, summary, next steps, and
  open questions for that pursuit
- **THEN** the workspace SHALL act as the canonical control room for the
  pursuit instead of forcing the user to reconstruct state from grants, drafts,
  and jobs separately

### Requirement: Proposal workspaces support organization-scoped collaboration
The system SHALL let the requester and authorized members of the same
organization access the same proposal workspace through the existing
organization membership model.

#### Scenario: Authorized collaborator opens shared proposal work
- **WHEN** an authenticated user belongs to the same organization as the
  proposal workspace owner
- **THEN** the system SHALL let that user read the shared proposal workspace
- **THEN** the visible pursuit state SHALL stay consistent for the requester
  and authorized collaborators

### Requirement: Proposal workspaces store a feasibility snapshot
The system SHALL let a proposal workspace store the latest feasibility snapshot
for the pursuit, including verdict, confidence, blockers, assumptions,
required documents, and recommended next step.

#### Scenario: Requester reviews the latest feasibility snapshot
- **WHEN** an authenticated requester fetches a proposal workspace with a saved
  feasibility snapshot
- **THEN** the system SHALL return the latest verdict, blockers, assumptions,
  required documents, and recommended next step
- **THEN** the requester SHALL be able to use that snapshot to decide whether
  to continue the pursuit

### Requirement: Proposal workspaces track contacts, outreach, and final outcome
The system SHALL let a proposal workspace store sponsor contacts, outreach
history, submission status, and final outcome so the pursuit remains durable
through award, decline, or no-bid decisions.

#### Scenario: Requester stores a contact and outreach history
- **WHEN** an authenticated requester records a sponsor contact or outreach
  event on a proposal workspace
- **THEN** the system SHALL persist that contact or event on the workspace
- **THEN** later reads SHALL expose the history needed to continue follow-up

#### Scenario: Requester records the final result of the pursuit
- **WHEN** an authenticated requester marks a proposal workspace as submitted,
  awarded, declined, or no-bid
- **THEN** the system SHALL persist that outcome on the workspace
- **THEN** the final state SHALL remain visible in later browser and API reads
