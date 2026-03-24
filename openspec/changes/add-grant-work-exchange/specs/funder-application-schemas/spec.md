## ADDED Requirements

### Requirement: Catalog entries can carry funder-specific application schemas
The system SHALL allow curated grant catalog entries to define their own
application schema with ordered sections and step structure for that grant.

#### Scenario: Grant workspace uses its funder schema
- **WHEN** a user starts an application workspace from a catalog entry that has
  a funder-specific schema
- **THEN** the system creates the workspace from that grant’s schema instead of
  a generic document template
- **THEN** the workspace preserves the section order and step grouping defined
  by the schema

### Requirement: Schemas include guidance and validation metadata
The system SHALL support per-section prompts, examples, validation rules, and
word or length guidance as schema metadata.

#### Scenario: User opens a guided section
- **WHEN** a user opens a section defined by a funder-specific schema
- **THEN** the system displays that section’s prompt, examples, and validation
  guidance
- **THEN** the system can evaluate the saved section content against the
  section’s validation metadata

### Requirement: Users can create custom application templates
The system SHALL support user-created application templates as a separate path
from curated funder schemas.

#### Scenario: User creates a custom application template
- **WHEN** a user defines a custom application template with a document type and
  section list
- **THEN** the system stores that schema as a reusable template for that user
- **THEN** new application workspaces can be created from that template
