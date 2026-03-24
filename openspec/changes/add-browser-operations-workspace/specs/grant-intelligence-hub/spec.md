## ADDED Requirements

### Requirement: Browser catalog browsing and bookmarks
The authenticated browser workspace SHALL expose searchable catalog browsing,
grant detail, and bookmark actions for durable grant catalog entries.

#### Scenario: User browses and bookmarks a grant from the browser
- **WHEN** a signed-in user opens the grant catalog in the browser workspace
- **THEN** the system displays durable catalog entries with searchable grant
  metadata
- **THEN** bookmark actions taken from the browser persist and are reflected in
  the visible grant state

### Requirement: Browser catalog detail shows apply-ready context
The authenticated browser workspace SHALL show catalog-entry detail that
includes evidence links, normalized metadata, and entry points into schema or
workspace actions.

#### Scenario: User opens a catalog grant detail panel
- **WHEN** a user selects a catalog entry in the browser workspace
- **THEN** the system displays that grant’s metadata, evidence, and available
  apply-ready actions
- **THEN** the user can continue into the supported application workflow from
  that detail view
