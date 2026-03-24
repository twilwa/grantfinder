## ADDED Requirements

### Requirement: Service requests can target grants, workspaces, or sections
The system SHALL allow organizations to request marketplace help for a grant
catalog entry, an application workspace, or an individual workspace section.

#### Scenario: User requests section review help
- **WHEN** a user opens a service request for a specific application section
- **THEN** the system records the service target as that section
- **THEN** specialists can see which artifact and scope they are being asked to
  help with

### Requirement: Service exchange supports role-targeted specialist work
The system SHALL support marketplace requests and offers for distinct service
roles including researcher, writer, reviewer, and submission specialist.

#### Scenario: Reviewer offers help on a proposal
- **WHEN** a specialist submits an offer for a proposal review request
- **THEN** the offer records the specialist role and targeted artifact scope
- **THEN** the resulting engagement keeps that role information attached to the
  funded work
