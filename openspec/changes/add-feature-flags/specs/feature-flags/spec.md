## ADDED Requirements

### Requirement: Platform administrator is gated by an environment allowlist
The system SHALL treat a request as a **Platform administrator** only when its
verified Privy user ID is present in the configured administrator allowlist, and
SHALL NOT add any administrator state to the **Requester**/**Specialist** identity
model.

#### Scenario: Allowlisted user is recognized as administrator
- **WHEN** an authenticated request arrives whose verified Privy user ID is in the
  configured administrator allowlist
- **THEN** the system SHALL permit feature flag management operations for that
  request

#### Scenario: Non-allowlisted user is denied administration
- **WHEN** an authenticated request whose Privy user ID is not in the administrator
  allowlist attempts a feature flag management operation
- **THEN** the system SHALL reject the operation as forbidden
- **THEN** the system SHALL NOT change the user's **Requester**/**Specialist** role

#### Scenario: Unauthenticated request is denied administration
- **WHEN** a request without a valid access token attempts a feature flag
  management operation
- **THEN** the system SHALL reject the operation as unauthorized

### Requirement: Administrators manage feature flag definitions
The system SHALL let a **Platform administrator** create, update, and delete
**Feature flags**, where each flag has a unique key, a description, and a default
state set at creation.

#### Scenario: Administrator creates a flag
- **WHEN** a **Platform administrator** creates a flag with a unique key, a
  description, and a default state
- **THEN** the system SHALL persist the flag definition
- **THEN** the flag SHALL be available for **Feature targeting** and resolution

#### Scenario: Administrator deletes a flag
- **WHEN** a **Platform administrator** deletes an existing flag
- **THEN** the system SHALL remove the flag and its targeting rules
- **THEN** later session resolutions SHALL no longer include that flag's feature

#### Scenario: Non-administrator cannot manage flags
- **WHEN** a non-administrator user attempts to create, update, or delete a flag
- **THEN** the system SHALL reject the operation as forbidden

### Requirement: Feature targeting resolves most-specific-wins
The system SHALL evaluate a flag's **Feature targeting** for a given user by
precedence — a user rule overrides an **Organization** rule, which overrides a role
rule, which overrides the flag default.

#### Scenario: User rule overrides organization rule
- **WHEN** a flag has an organization rule enabling the feature for a user's
  **Organization** and a user rule disabling it for that user
- **THEN** the system SHALL resolve the feature as disabled for that user

#### Scenario: Organization rule overrides role rule
- **WHEN** a flag has a role rule enabling the feature for the user's role and an
  organization rule disabling it for the user's **Organization**
- **THEN** the system SHALL resolve the feature as disabled for that user

#### Scenario: Default applies when no rule matches
- **WHEN** no user, organization, or role rule on a flag matches a given user
- **THEN** the system SHALL resolve the feature to the flag's default state

### Requirement: Flags are resolved per user at session bootstrap
The system SHALL resolve all flags for the authenticated user during the session
bootstrap and SHALL expose only the resolved set of enabled feature keys to the
browser, never the targeting rules.

#### Scenario: Session returns the resolved enabled features
- **WHEN** an authenticated user loads their session
- **THEN** the session payload SHALL include the set of feature keys enabled for
  that user
- **THEN** the payload SHALL NOT include any flag targeting rules or other users'
  assignments

#### Scenario: Resolution is deterministic across loads
- **WHEN** the same authenticated user loads their session more than once without
  any flag or targeting change
- **THEN** the system SHALL return the same set of enabled feature keys each time

#### Scenario: Unauthenticated visitor receives no flags
- **WHEN** an unauthenticated visitor loads the public surface
- **THEN** the system SHALL NOT resolve feature flags for that visitor
- **THEN** the visitor SHALL see the baseline experience

### Requirement: The client renders flagged features from resolved flags only
The browser SHALL render a flagged tab or panel only when its feature key is
present in the session's resolved enabled features, and SHALL render the baseline
experience otherwise.

#### Scenario: Enabled feature renders
- **WHEN** the session's resolved enabled features include a flagged feature's key
- **THEN** the client SHALL render that feature

#### Scenario: Disabled or unknown feature is hidden
- **WHEN** a flagged feature's key is absent from the session's resolved enabled
  features
- **THEN** the client SHALL render the baseline experience without that feature
