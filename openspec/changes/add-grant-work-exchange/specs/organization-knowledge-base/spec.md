## ADDED Requirements

### Requirement: Persistent organization profile
The system SHALL store a reusable organization profile for each organization
workspace with structured fields for legal name, website, registration
location, organization type, operating scope, local operating areas, mission
statement, programs, target demographics, thematic areas, annual operating
budget range, strategic priorities, and notification preferences.

#### Scenario: Organization profile is saved for reuse
- **WHEN** an authorized organization member updates the structured profile
- **THEN** the system stores the new values as the current organization profile
- **THEN** the saved profile is available to later research and application
  workflows

### Requirement: Personnel and invite access
The system SHALL let an organization maintain personnel records with role,
experience, contact details, access state, and invite permissions, and SHALL
support permission-gated invite links for collaborators.

#### Scenario: Organization admin invites a collaborator
- **WHEN** an authorized organization admin creates a personnel record with
  platform access enabled
- **THEN** the system stores the collaborator metadata with its access state
- **THEN** the system provides an invite path that can be shared with that
  collaborator

### Requirement: Organization profile feeds reusable prefills
The system SHALL expose reusable organization facts from the organization
profile to scouting and application workflows so supported sections can be
prefilled instead of rewritten for each grant.

#### Scenario: New workspace uses organization prefills
- **WHEN** a user creates a new application workspace for an organization
- **THEN** the system preloads supported organization facts into matching
  sections
- **THEN** the user can review and edit those prefills before generation or
  submission
