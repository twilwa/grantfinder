## ADDED Requirements

### Requirement: Platform SHALL expose funding research over REST and JSON-RPC
The system SHALL expose the existing funding research workflow through both a
REST endpoint and a JSON-RPC method so browser, curl, and agent clients can run
the same research capability.

#### Scenario: REST client runs research
- **WHEN** an authenticated client sends a valid research request to the REST
  endpoint
- **THEN** the platform SHALL return a structured funding report with source
  citations

#### Scenario: JSON-RPC client runs research
- **WHEN** an authenticated client invokes the funding research JSON-RPC method
- **THEN** the platform SHALL return the same report shape as the REST surface

### Requirement: Platform SHALL support built-in scenarios and persisted custom scenarios
The system SHALL let clients run research against the built-in fixtures and
against persisted custom scenarios authored through the browser or API.

#### Scenario: Built-in scenario runs through HTTP
- **WHEN** a client references a built-in scenario identifier over HTTP
- **THEN** the platform SHALL load the fixture and execute research for it

#### Scenario: Client creates a custom scenario
- **WHEN** an authenticated client submits a valid business-case payload
- **THEN** the platform SHALL persist that scenario and make it available for
  later request creation and reruns

### Requirement: Platform SHALL model research as durable requests
The system SHALL persist research requests with scenario references, execution
status, and the latest structured report so the browser can revisit and rerun
research instead of relying on one-shot responses.

#### Scenario: Requester creates and runs a research request
- **WHEN** an authenticated requester creates a request for a scenario and runs
  it
- **THEN** the platform SHALL store the request, update its status as it
  executes, and keep the resulting report on that request

#### Scenario: Request can be rerun later
- **WHEN** an authenticated client reruns an existing research request
- **THEN** the platform SHALL update the same request record instead of forcing
  the client to create a new scenario or use a hidden fixture identifier

### Requirement: Platform SHALL expose steerable live request detail
The system SHALL expose enough durable request state for a client to monitor an
active research run and steer it while the agent is still working.

#### Scenario: Request detail shows live activity
- **WHEN** an authenticated requester fetches a running research request
- **THEN** the platform SHALL return the current phase, a progress summary, and
  a bounded activity timeline describing recent agent or tool steps

#### Scenario: Requester queues a steering note for a running request
- **WHEN** an authenticated requester submits a steering prompt for an active
  research request
- **THEN** the platform SHALL store that note on the request, expose it as
  queued, and mark it applied once the next agent turn consumes it

### Requirement: Platform SHALL derive tracked grants from research output
The system SHALL normalize funding opportunities from a completed report into
tracked grant records owned by the related research request.

#### Scenario: Completed request produces tracked grants
- **WHEN** a research request completes with one or more opportunities
- **THEN** the platform SHALL expose those opportunities as tracked grants that
  can be viewed from both the request and grant surfaces

#### Scenario: Tracked grant can be queued as active or inactive
- **WHEN** a user updates the queue state of a tracked grant
- **THEN** the platform SHALL persist that state and expose it in later browser
  and API reads
