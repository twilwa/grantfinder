## ADDED Requirements

### Requirement: Platform SHALL support job and offer workflows
The system SHALL let authenticated requesters create grant-application jobs and
authenticated specialists submit offers for those jobs.

#### Scenario: Requester creates a job
- **WHEN** an authenticated requester submits a valid job description
- **THEN** the platform SHALL create a new job and make it available for
  browsing

#### Scenario: Specialist submits an offer
- **WHEN** an authenticated specialist submits an offer for an open job
- **THEN** the platform SHALL store the offer and associate it with that job

### Requirement: Platform SHALL support grant-proposal jobs sourced from tracked grants
The system SHALL let a requester promote a tracked grant into a marketplace job
that carries the selected grant context forward as proposal-writing work.

#### Scenario: Requester creates a proposal job from a tracked grant
- **WHEN** an authenticated requester promotes a tracked grant into a job
- **THEN** the platform SHALL create a `grant_proposal` job that references the
  selected grant and is visible in the marketplace

### Requirement: Platform SHALL support offer acceptance and engagement
The system SHALL let a requester accept one offer and create a corresponding
engagement record that can later be funded.

#### Scenario: Requester accepts an offer
- **WHEN** the job owner accepts a specific offer
- **THEN** the platform SHALL mark that offer accepted and create an engagement
  awaiting funding

#### Scenario: Accepted engagement appears in platform views
- **WHEN** a job has an accepted offer
- **THEN** the HTML and API surfaces SHALL expose the engagement as awaiting
  payment or funded, depending on payment state

### Requirement: Platform SHALL provide a browser-accessible marketplace
The system SHALL render HTML pages that expose jobs, offers, accepted
engagements, and research actions for human users.

#### Scenario: Browser loads marketplace dashboard
- **WHEN** a user visits the root marketplace page
- **THEN** the platform SHALL render a dashboard that lists jobs and available
  actions

#### Scenario: Browser shows workspace tabs for core flows
- **WHEN** an authenticated user opens the browser workspace
- **THEN** the platform SHALL expose separate tabs for request marketplace,
  research dashboard, my requests, and my grants

#### Scenario: Browser request detail acts as a research control room
- **WHEN** an authenticated requester opens the my requests workspace for an
  active research request
- **THEN** the platform SHALL render current progress, recent activity, and
  steering controls in a clean request-detail layout

### Requirement: Platform SHALL persist marketplace data in Postgres
The system SHALL persist marketplace users, jobs, offers, engagements, and
payment records in Postgres so state survives process restarts and hosted
deployments.

#### Scenario: Stored marketplace records remain queryable
- **WHEN** the platform reloads against the same Postgres database
- **THEN** previously created users, jobs, offers, and engagements SHALL still
  be available through the platform APIs
