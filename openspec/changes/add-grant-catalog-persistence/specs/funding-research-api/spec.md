## ADDED Requirements

### Requirement: Platform SHALL upsert durable opportunity records from research output
The system SHALL upsert durable opportunity records when research requests
complete so request-scoped tracked grants remain linked to a reusable catalog
record.

#### Scenario: Completed request creates or updates a durable opportunity
- **WHEN** a research request completes with one or more opportunities
- **THEN** the platform SHALL create or update a durable catalog record for
  each opportunity
- **THEN** each request-scoped tracked grant SHALL remain linked to the durable
  opportunity record it informed

### Requirement: Platform SHALL support catalog-seeded research requests
The system SHALL let authenticated clients create or run research requests from
an existing durable opportunity record over REST and JSON-RPC.

#### Scenario: REST client starts follow-up research from a durable opportunity
- **WHEN** an authenticated REST client requests additional research for a
  durable opportunity record
- **THEN** the platform SHALL create or run a research request seeded by that
  opportunity
- **THEN** the response SHALL expose the linkage between the request and the
  durable opportunity

#### Scenario: JSON-RPC client starts follow-up research from a durable opportunity
- **WHEN** an authenticated JSON-RPC client requests additional research for a
  durable opportunity record
- **THEN** the platform SHALL create or run the same linked research workflow
- **THEN** later request and workspace reads SHALL expose the refreshed
  opportunity context
