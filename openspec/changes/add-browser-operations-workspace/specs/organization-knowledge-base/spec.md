## ADDED Requirements

### Requirement: Browser organization management
The authenticated browser workspace SHALL let authorized members view and
update the organization profile and maintain personnel records without using
direct API calls.

#### Scenario: Organization admin manages profile and personnel in the browser
- **WHEN** an authorized organization member opens the organization workspace
- **THEN** the system displays the current organization profile and personnel
  roster
- **THEN** profile and personnel updates made in the browser persist and appear
  in the refreshed workspace state

### Requirement: Browser invite acceptance
The authenticated browser workspace SHALL expose collaborator invite acceptance
so a signed-in user can join an organization from the product UI instead of an
API-only flow.

#### Scenario: Collaborator accepts an invite token in the browser
- **WHEN** a signed-in user submits a valid invite token from the browser
  workspace
- **THEN** the system accepts the invite for that user
- **THEN** the updated organization membership state is visible in the browser
  session
