## Why

The current browser workspace exposes research and marketplace flows, but the
latest end-to-end browser sweep showed several shipped capabilities still
require authenticated API calls from the harness instead of visible UI:
organization profile management, collaborator invite acceptance, catalog
browsing and bookmarks, application workspaces and templates, provider
connections, and agent execution history.

Those capabilities already exist in the platform types and service layer, so
the gap is not domain support. The gap is browser affordance. As a result, the
platform cannot yet be operated end-to-end from the authenticated app even
though the underlying workflows are present.

## What Changes

- Add an authenticated browser operations area for organization profile,
  personnel, and invite acceptance.
- Add grant intelligence browsing for durable catalog entries, grant detail,
  bookmarks, and schema metadata.
- Add browser entry points for creating, editing, and finalizing structured
  application workspaces from curated grants or saved templates.
- Add provider connection management and execution-history views for
  provider-backed actions.
- Keep the change additive to the existing browser product and reuse current
  platform APIs rather than expanding backend domain scope.

## Capabilities

### Modified Capabilities
- `organization-knowledge-base`
- `grant-intelligence-hub`
- `application-workspaces`
- `funder-application-schemas`
- `agent-provider-connections`

## Impact

- Expanded browser navigation and state for the existing authenticated
  workspace
- Browser-driven access to organization, catalog, workspace, provider, and
  execution surfaces that currently only exist through API calls
- New or updated tests for the added browser workflows
- Focused browser verification for the newly surfaced operations paths
