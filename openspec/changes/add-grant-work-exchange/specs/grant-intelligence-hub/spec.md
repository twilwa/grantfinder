## ADDED Requirements

### Requirement: Grant reports and grant catalog are distinct artifacts
The system SHALL store research outputs as grant reports separate from durable
grant catalog entries so users can review scouting output without immediately
creating a persistent application target.

#### Scenario: Research run produces a report without creating catalog entries
- **WHEN** a research request finishes
- **THEN** the system stores the resulting grant report with its ranked
  opportunities and supporting evidence
- **THEN** no durable catalog entry is created until a user or curation flow
  promotes one

### Requirement: Report opportunities can be promoted to catalog entries
The system SHALL allow a report-backed opportunity to become a durable grant
catalog entry with normalized metadata, source links, and apply-ready state.

#### Scenario: User promotes a tracked opportunity
- **WHEN** a user promotes a report opportunity into the grant catalog
- **THEN** the system creates or updates a durable catalog entry with sponsor,
  geography, deadlines, amount, tags, and evidence links
- **THEN** the catalog entry is available for bookmarks and application
  workspaces

### Requirement: Users can bookmark and browse catalog grants
The system SHALL support searchable catalog browsing and per-user bookmark state
for durable grant catalog entries.

#### Scenario: User bookmarks a catalog entry
- **WHEN** a signed-in user bookmarks a grant catalog entry
- **THEN** the system records that bookmark for that user
- **THEN** the bookmarked entry appears in the user’s saved grant views
