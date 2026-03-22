## ADDED Requirements

### Requirement: Platform SHALL protect engagement funding with x402
The system SHALL require x402 payment on the accepted-offer funding route before
an engagement can be marked funded.

#### Scenario: Unpaid funding request receives a 402 challenge
- **WHEN** a client attempts to fund an accepted engagement without satisfying
  x402 payment requirements
- **THEN** the platform SHALL return an HTTP 402 response describing the payment
  requirement

#### Scenario: Successful payment funds the engagement
- **WHEN** a client satisfies the x402 payment requirement for an accepted
  engagement
- **THEN** the platform SHALL mark the engagement funded and store payment
  metadata

### Requirement: Platform SHALL associate payment with a specific offer
The system SHALL ensure each x402 funding action is tied to the accepted offer
and specialist being paid.

#### Scenario: Payment record references accepted offer
- **WHEN** the platform records a successful funding event
- **THEN** the stored payment record SHALL include the accepted offer identifier
  and the engagement identifier
