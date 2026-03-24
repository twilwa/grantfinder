## ADDED Requirements

### Requirement: Organizations and users can connect external AI providers
The system SHALL support provider connections owned by an organization or an
individual user so research and writing workflows can run with BYOK or
OAuth-backed credentials.

#### Scenario: Organization connects a provider
- **WHEN** an authorized organization member connects a supported AI provider
- **THEN** the system stores a provider connection scoped to that organization
- **THEN** eligible research and application workflows can reference that
  provider connection

### Requirement: Agent execution is policy-gated and auditable
The system SHALL enforce policy checks before a connected agent acts on a grant
report or application workspace, and SHALL record an audit trail of the
execution.

#### Scenario: User runs a connected agent on a workspace
- **WHEN** a user starts an agent-backed action against an application
  workspace
- **THEN** the system verifies that the selected provider connection is allowed
  for that action
- **THEN** the system stores an execution record that identifies the actor, the
  provider connection, the target artifact, and the resulting output
