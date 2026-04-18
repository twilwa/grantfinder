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

### Requirement: Browser users can manage repository bindings
The system SHALL provide browser controls for authorized users to attach,
update, clear, open, and inspect GitHub repository bindings for eligible
grant-backed and manual RFP pursuits.

#### Scenario: Requester attaches a repository from a grant view
- **WHEN** an authenticated requester opens a tracked-grant or catalog-grant
  detail view for a grant without a repository binding
- **THEN** the browser SHALL offer an attach-repository control that captures
  repository URL, branch, root path, and provider connection configuration
- **THEN** saving that control SHALL persist the binding through the supported
  application API

#### Scenario: Requester inspects repository source from a proposal workspace
- **WHEN** an authenticated requester opens a proposal workspace with an
  effective repository binding
- **THEN** the browser SHALL show the linked repository and whether it is
  inherited from a grant, inherited from a catalog entry, or set directly on the
  workspace
- **THEN** the browser SHALL provide an open-repository action for the linked
  GitHub repository

#### Scenario: Requester clears a workspace-specific override
- **WHEN** an authenticated requester clears an explicitly overridden proposal
  workspace repository binding
- **THEN** the system SHALL remove the workspace-specific binding
- **THEN** later reads SHALL resolve the inherited grant or catalog repository
  binding when one is available
