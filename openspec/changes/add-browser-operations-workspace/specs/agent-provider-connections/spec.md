## ADDED Requirements

### Requirement: Browser provider connection management
The authenticated browser workspace SHALL expose provider connection
management for organization-scoped and user-scoped AI providers.

#### Scenario: User connects a provider from the browser
- **WHEN** an authorized user opens the provider connection area in the browser
- **THEN** the system displays existing provider connections and the supported
  connection flow
- **THEN** a successful browser submission creates or updates the provider
  connection state without direct API calls

### Requirement: Browser execution history
The authenticated browser workspace SHALL display execution records for
provider-backed research and writing actions so users can inspect recent agent
runs from the product UI.

#### Scenario: User reviews provider-backed execution history
- **WHEN** a user opens the execution history view in the browser workspace
- **THEN** the system displays recent execution records with target artifact,
  provider connection, actor, and result summary
- **THEN** the visible history reflects provider-backed actions that were
  previously only accessible through API inspection
