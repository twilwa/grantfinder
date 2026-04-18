## ADDED Requirements

### Requirement: Eligible grant and RFP records can attach GitHub repositories
The system SHALL let authorized users attach, update, and clear a GitHub
repository binding for tracked grants, durable catalog grants, and manual
proposal workspaces used for RFP-style pursuits.

#### Scenario: Requester links a repository to a tracked grant
- **WHEN** an authenticated requester attaches a GitHub repository URL and write
  configuration to a tracked grant
- **THEN** the system SHALL persist that repository binding on the tracked grant
- **THEN** later reads of that tracked grant SHALL expose the current binding

#### Scenario: Requester links a repository to a durable catalog grant
- **WHEN** an authenticated requester attaches a GitHub repository URL and write
  configuration to a durable catalog grant
- **THEN** the system SHALL persist that repository binding on the catalog grant
- **THEN** later reads of that catalog grant SHALL expose the current binding

#### Scenario: Requester links a repository to a manual RFP pursuit
- **WHEN** an authenticated requester attaches a GitHub repository URL and write
  configuration to a manual proposal workspace that is not backed by a grant
- **THEN** the system SHALL persist that repository binding on the proposal
  workspace
- **THEN** later reads of that workspace SHALL expose the current binding

### Requirement: Downstream workspaces expose one effective repository binding
The system SHALL resolve one effective repository binding for downstream
proposal and application workspaces by using the nearest linked pursuit record.

#### Scenario: Proposal workspace inherits a linked grant repository
- **WHEN** an authenticated requester creates or opens a proposal workspace from
  a tracked grant or durable catalog grant with a repository binding
- **THEN** the system SHALL expose that repository binding as the effective
  repository for the proposal workspace
- **THEN** the workspace response SHALL indicate which source record supplied
  the binding

#### Scenario: Application workspace exposes the effective pursuit repository
- **WHEN** an authenticated requester opens an application workspace created for
  a repository-linked pursuit
- **THEN** the system SHALL expose the effective repository binding on that
  application workspace read
- **THEN** the requester SHALL not need to resolve the repository manually from
  a separate grant or proposal record

### Requirement: Repository bindings stay collaborative and traceable
The system SHALL preserve repository binding metadata needed for organization
collaboration and auditability, including the actor and latest update state.

#### Scenario: Authorized collaborator reviews a shared repository binding
- **WHEN** an authenticated organization collaborator opens a shared
  repository-linked proposal workspace
- **THEN** the system SHALL expose the same effective repository binding that
  the requester sees
- **THEN** the collaborator SHALL be able to continue work from the same linked
  repository context

#### Scenario: Requester replaces an existing repository binding
- **WHEN** an authenticated requester updates the GitHub repository binding on a
  linked pursuit record
- **THEN** the system SHALL persist the replacement binding and its updated
  actor or timestamp metadata
- **THEN** later reads SHALL expose only the current effective binding while
  retaining the latest traceability fields
