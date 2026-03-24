## ADDED Requirements

### Requirement: Browser schema detail and editing
The authenticated browser workspace SHALL display funder-specific schema
structure, prompts, examples, and validation guidance for curated grants, and
SHALL let authorized users update schema content from the browser.

#### Scenario: Operator reviews and updates a grant schema in the browser
- **WHEN** an authorized user opens schema detail for a curated grant entry
- **THEN** the system displays the ordered schema sections with prompts,
  examples, and validation metadata
- **THEN** schema edits submitted from the browser persist and are visible in
  subsequent catalog and workspace flows
