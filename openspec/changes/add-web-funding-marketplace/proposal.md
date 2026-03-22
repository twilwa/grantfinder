## Why

The repository now has a CLI funding researcher and a first-pass web surface,
but the platform still relies on local JSON storage and first-party API keys as
its primary identity model. That is enough for a vertical slice, but it is not
the right base for a hosted marketplace where humans should log in with a real
auth provider, receive embedded + smart wallets, and then mint agent-friendly
credentials for curl and JSON-RPC use.

We need to re-architecture the shared platform so:
- humans authenticate with Privy in the browser
- Privy can create embedded wallets and smart wallets for those users
- the backend persists marketplace state in Postgres
- agents still get a clean bearer-token workflow without depending on browser
  sessions
- operators can create and rerun research requests from the browser instead of
  relying on hidden fixture identifiers
- operators can see what an active research run is doing and steer it while the
  agent is still working
- research output becomes durable grant records that a requester can manage,
  queue, and turn into proposal-writing jobs on the marketplace

## What Changes

- Keep the Bun + Hono application as the shared HTTP shell for browser, REST,
  JSON-RPC, docs, and payment routes.
- Replace file-backed JSON persistence with Postgres-backed relational storage.
- Replace browser registration + API-key auth with Privy-based browser login,
  embedded wallet creation, and smart wallet support.
- Add server-issued personal agent tokens so curl and autonomous clients can
  use every protected feature without a browser session.
- Add a grant-application marketplace where requesters create jobs and
  specialists submit offers to apply on their behalf.
- Add a role-aware browser workspace with sidebar navigation for marketplace,
  research, requests, and grants.
- Add persisted research scenarios, persisted research requests, and persisted
  grant tracking records derived from research output.
- Add a live request detail console with research activity timeline, current
  progress summary, and steerable notes for active runs.
- Let a requester turn a tracked grant into a proposal-writing marketplace job.
- Add x402 payment support for accepted offers so a requester can fund an
  engagement through an HTTP 402 payment challenge.
- Publish machine-readable platform guidance at `/skill.md` and human-readable
  docs at `/docs`.

## Capabilities

### New Capabilities
- `funding-research-api`: Expose the funding research workflow over HTTP and
  JSON-RPC so humans and agents can run research through the platform, store
  requests, and manage custom scenarios.
- `marketplace-workflows`: Support job creation, offer submission, offer
  acceptance, funded engagement tracking, grant-proposal job creation, and
  durable Postgres persistence.
- `agent-auth-and-discovery`: Provide Privy browser authentication, agent-token
  issuance, and `/skill.md` plus `/docs` discovery surfaces for human and agent
  clients.
- `x402-engagement-payments`: Protect accepted-offer funding routes with x402
  payment requirements and record successful funding events.

### Modified Capabilities
- None.

## Impact

- Updated browser runtime to include a Privy-backed frontend shell
- New Postgres schema/bootstrap path and persistence layer
- New browser workspace views for request marketplace, research dashboard, my
  requests, and my grants
- New browser request-detail controls for live research monitoring and mid-run
  steering
- New dependencies for Privy, React, and Postgres access in addition to Hono
  and x402
- New tests for browser auth handoff, agent-token flows, marketplace
  persistence, JSON-RPC parity, and x402 payment challenges
- Updated docs for browser login, agent-token issuance, curl, and JSON-RPC
  usage
