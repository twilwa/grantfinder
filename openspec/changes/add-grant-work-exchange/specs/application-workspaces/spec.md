## ADDED Requirements

### Requirement: Application workspaces are structured by document type
The system SHALL create application workspaces as ordered, section-based forms
for a specific document type such as grant proposal, LOI, budget narrative, or
other funding document.

#### Scenario: Workspace is created for a grant application
- **WHEN** a user starts an application workspace for a grant and document type
- **THEN** the system creates an ordered set of sections for that workspace
- **THEN** each section is addressable as structured workspace data rather than
  only freeform document text

### Requirement: Workspaces support draft and proposal lifecycle states
The system SHALL track application workspaces through at least draft and
proposal states so in-progress work is separate from finalized outputs.

#### Scenario: Draft becomes a proposal
- **WHEN** a user finalizes a completed application workspace
- **THEN** the system moves the workspace from draft state to proposal state
- **THEN** the proposal appears in finalized proposal views without removing its
  structured section history

### Requirement: Workspace sections support prefills and section-level AI work
The system SHALL support organization-prefilled section content and section-level
AI generation or revision actions for supported application sections.

#### Scenario: User generates a section from prefills
- **WHEN** a user requests AI help for a section with organization prefills and
  workspace context
- **THEN** the system runs generation against that section’s structured context
- **THEN** the generated content is stored back on that section for review
