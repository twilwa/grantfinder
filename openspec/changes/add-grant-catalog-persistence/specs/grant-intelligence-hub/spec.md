## ADDED Requirements

### Requirement: Durable opportunity detail supports enrichment and refreshed research
The authenticated workspace SHALL let requesters enrich a durable opportunity
record and start refreshed research directly from catalog detail.

#### Scenario: Requester updates durable opportunity detail
- **WHEN** an authenticated requester saves enrichment on a durable
  opportunity record
- **THEN** the system SHALL persist the updated metadata, notes, freshness, or
  tag state on that record
- **THEN** refreshed browser and API reads SHALL show the updated opportunity
  context

#### Scenario: Requester starts refreshed research from durable opportunity detail
- **WHEN** an authenticated requester opens durable opportunity detail in the
  browser workspace
- **THEN** the system SHALL expose an action to start additional research for
  that opportunity
- **THEN** the resulting research run SHALL stay linked to the selected
  durable opportunity

### Requirement: Durable opportunity detail exposes downstream pursuit entry points
The authenticated workspace SHALL let requesters take a durable opportunity
record directly into proposal or marketplace workflows.

#### Scenario: Requester selects a durable opportunity for downstream work
- **WHEN** an authenticated requester opens a durable opportunity record
- **THEN** the system SHALL expose direct actions to create or resume proposal
  work and start marketplace collaboration
- **THEN** the durable opportunity record SHALL remain the visible source
  context for those actions
