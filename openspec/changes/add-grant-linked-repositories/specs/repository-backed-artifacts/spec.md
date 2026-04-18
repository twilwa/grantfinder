## ADDED Requirements

### Requirement: Research outputs publish into the effective repository
The system SHALL publish generated research artifacts into the effective
repository for a repository-linked grant or opportunity pursuit when a research
run produces durable output.

#### Scenario: Follow-up research publishes into a linked catalog repository
- **WHEN** an authenticated requester runs follow-up research from a durable
  catalog grant that has an effective GitHub repository binding
- **THEN** the system SHALL publish the resulting brief or report artifacts into
  deterministic research paths in that repository
- **THEN** the system SHALL expose the latest publication result on later reads

#### Scenario: Repository publication failure does not discard research output
- **WHEN** a repository-linked research run saves platform output but the GitHub
  publication step fails
- **THEN** the system SHALL keep the saved research artifacts in platform state
- **THEN** later reads SHALL expose that repository publication failed and why

### Requirement: Proposal and application outputs publish into the effective repository
The system SHALL publish durable proposal artifacts, application drafts, and
finalized proposal documents into the effective repository for the pursuit.

#### Scenario: Generated application section publishes into the linked repository
- **WHEN** an authenticated requester generates or refreshes an application
  workspace section for a repository-linked pursuit
- **THEN** the system SHALL publish that section artifact into the deterministic
  application path in the effective repository
- **THEN** later reads SHALL expose the latest repository publication result

#### Scenario: Durable proposal artifacts publish into the linked repository
- **WHEN** an authenticated requester or collaborator runs a proposal-side agent
  action that produces durable output or explicitly syncs proposal artifacts for
  a repository-linked pursuit
- **THEN** the system SHALL publish the resulting proposal artifacts into the
  deterministic proposal path in the effective repository
- **THEN** the repository SHALL remain the same effective working surface for
  subsequent proposal and application work

### Requirement: Repository publication uses GitHub write access and audit records
The system SHALL require compatible GitHub write access for repository
publication and SHALL record each publication attempt with success or failure
metadata.

#### Scenario: Publication succeeds with auditable commit metadata
- **WHEN** the system successfully publishes a research or proposal artifact into
  the effective repository
- **THEN** the system SHALL record the publication attempt as an auditable
  execution with repository path and commit metadata
- **THEN** later reads SHALL expose the latest successful publication state

#### Scenario: Publication is blocked because GitHub write access is missing
- **WHEN** a repository-linked artifact is ready to publish but no compatible
  GitHub write connection is available
- **THEN** the system SHALL leave the platform artifact available for normal
  reads
- **THEN** the system SHALL expose that repository publication is blocked until
  GitHub write access is configured

### Requirement: Browser users can inspect repository publication state
The system SHALL expose repository publication state in browser views where
users and agents coordinate repository-backed grant work.

#### Scenario: Browser shows successful repository publication
- **WHEN** an authenticated requester opens a repository-linked grant, proposal,
  or application view after a successful publication
- **THEN** the browser SHALL show the latest published path and commit metadata
- **THEN** the browser SHALL provide a path to open the repository target

#### Scenario: Browser shows blocked repository publication
- **WHEN** an authenticated requester opens a repository-linked grant, proposal,
  or application view after publication is blocked or failed
- **THEN** the browser SHALL show the blocked or failed state with the latest
  actionable error message
- **THEN** the browser SHALL not imply that GitHub contains the latest platform
  artifact
