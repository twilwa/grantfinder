## ADDED Requirements

### Requirement: Durable opportunity records unify grants and RFPs across research runs
The system SHALL persist discovered grants and RFPs as durable opportunity
records so the same opportunity can be revisited, enriched, and reused across
multiple research runs and downstream pursuit workflows.

#### Scenario: Research run discovers a new opportunity
- **WHEN** a completed research request yields an opportunity that does not yet
  exist as a durable opportunity record
- **THEN** the system SHALL create a catalog record for that opportunity
- **THEN** later browser and API reads SHALL expose that record outside the
  originating request

#### Scenario: Research run rediscovers an existing opportunity
- **WHEN** a completed research request yields an opportunity that matches an
  existing durable opportunity record
- **THEN** the system SHALL update that record instead of creating a duplicate
- **THEN** the record SHALL preserve traceability to the newer research output

### Requirement: Durable opportunity records store current enrichment and freshness state
The system SHALL let authorized users maintain the current working view of a
grant or RFP record, including updated metadata, provenance, freshness, tags,
and internal pursuit context.

#### Scenario: Requester enriches a durable opportunity record
- **WHEN** an authenticated requester updates a durable opportunity record with
  current metadata, notes, or tags
- **THEN** the system SHALL persist those updates on the same record
- **THEN** later reads SHALL expose the enriched state as part of the current
  opportunity context

#### Scenario: Requester reviews current opportunity context
- **WHEN** an authenticated requester opens a durable opportunity record
- **THEN** the system SHALL expose the latest normalized metadata, source
  evidence, freshness state, and internal enrichment fields
- **THEN** the requester SHALL be able to judge whether more research or
  downstream action is needed without reopening the originating request
