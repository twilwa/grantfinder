## ADDED Requirements

### Requirement: Agent SHALL derive a funding research brief from a business case
The system SHALL convert a business case into a deterministic research brief that identifies likely funding tracks, relevant sponsor categories, eligibility concerns, and search seeds before live research begins.

#### Scenario: Inverse private equity case is normalized
- **WHEN** the system prepares research for the inverse private equity case
- **THEN** the research brief SHALL include search tracks for succession, workforce development, automation adoption, and staff venture funding

#### Scenario: Logistics forecasting case is normalized
- **WHEN** the system prepares research for the logistics forecasting case
- **THEN** the research brief SHALL include search tracks for freight efficiency, supply-chain resilience, critical minerals, tariff exposure, fuel economics, and forecasting commercialization

### Requirement: Agent SHALL research live funding opportunities with source-backed evidence
The system SHALL give the PI agent tools to search for funding opportunities and read source pages so that the final report is grounded in retrieved source material rather than unsupported claims.

#### Scenario: Agent finds candidate opportunities
- **WHEN** the agent runs for a business case
- **THEN** it SHALL be able to search public sources and retrieve source pages for candidate grants, incentives, or adjacent funding programs

#### Scenario: Reported opportunities include citations
- **WHEN** the agent includes an opportunity in the final report
- **THEN** that opportunity SHALL include one or more source URLs used to justify the recommendation

### Requirement: Agent SHALL publish a structured funding report
The system SHALL capture the final result as a structured report that includes opportunity ranking, fit reasoning, risks, and recommended next steps.

#### Scenario: Published report includes ranked opportunities
- **WHEN** the agent completes research
- **THEN** the published report SHALL include a ranked list of opportunities with sponsor, funding type, fit score, eligibility notes, and next actions

#### Scenario: Published report calls out uncertainty
- **WHEN** the agent cannot fully verify a deadline, amount, or eligibility condition
- **THEN** the published report SHALL mark that field as uncertain and describe the follow-up needed

### Requirement: Agent SHALL support fixture-driven execution for known scenarios
The system SHALL ship with fixture-driven execution so the initial scenarios can be run consistently from the CLI and tested without hand-entering business context.

#### Scenario: Built-in inverse private equity fixture can be selected
- **WHEN** the user runs the agent with the inverse private equity fixture identifier
- **THEN** the system SHALL load the corresponding business case and pass it into the research workflow

#### Scenario: Built-in logistics forecasting fixture can be selected
- **WHEN** the user runs the agent with the logistics forecasting fixture identifier
- **THEN** the system SHALL load the corresponding business case and pass it into the research workflow
