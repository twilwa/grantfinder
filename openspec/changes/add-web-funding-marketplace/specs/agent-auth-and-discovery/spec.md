## ADDED Requirements

### Requirement: Platform SHALL authenticate browser users with Privy
The system SHALL accept Privy-authenticated browser users, verify their Privy
access tokens on the backend, and resolve those identities to local platform
users.

#### Scenario: Browser user exchanges a Privy token for a platform session
- **WHEN** a signed-in browser client sends a valid Privy access token to the
  platform
- **THEN** the platform SHALL verify the token and return the corresponding
  local user profile

#### Scenario: Invalid Privy token is rejected
- **WHEN** a client sends an invalid or expired Privy access token
- **THEN** the platform SHALL return an unauthorized response

### Requirement: Platform SHALL let one browser user switch between requester and specialist flows
The system SHALL let an authenticated browser user update the role on their
local Grantfinder profile without creating a second account.

#### Scenario: Browser user changes role
- **WHEN** an authenticated browser user updates their profile role
- **THEN** the platform SHALL persist the new role on the existing local user
  profile and expose the matching workflow in the browser

### Requirement: Platform SHALL issue and honor agent tokens
The system SHALL let authenticated users mint agent tokens and use those tokens
on protected REST and JSON-RPC routes.

#### Scenario: Authenticated user creates an agent token
- **WHEN** an authenticated user requests a new agent token
- **THEN** the platform SHALL return a token secret that can be used for later
  authenticated requests

#### Scenario: Protected route accepts a valid agent token
- **WHEN** a client calls a protected route with a valid agent token
- **THEN** the platform SHALL authorize the request as that token's owner

### Requirement: Platform SHALL publish agent discovery surfaces
The system SHALL publish a machine-readable skill document and human-readable
usage docs so agents and operators can discover how to use the platform.

#### Scenario: Agent fetches skill document
- **WHEN** a client requests `/skill.md`
- **THEN** the platform SHALL return markdown that describes browser
  authentication, agent-token issuance, core endpoints, and JSON-RPC usage

#### Scenario: Human opens docs page
- **WHEN** a browser requests `/docs`
- **THEN** the platform SHALL render usage documentation for the research,
  marketplace, auth, and payment flows
