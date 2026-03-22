## Context

The repository now exposes funding research through a CLI and a working web
surface. The current web slice proves the product shape, but it is still using
file-backed JSON storage and locally-issued API keys as its primary auth model.
That is not a stable hosting architecture for a multi-user marketplace.

The new product surface needs to satisfy two audiences at once:
- humans who want a simple browser workflow
- agents that need stable, documented, scriptable access over HTTP

Privy is a better fit for the browser identity layer because it can authenticate
users, provision embedded wallets, and generate smart wallets without forcing
the whole platform into an onchain-first auth model. The x402 protocol still
fits the funding step well because it turns HTTP 402 into a structured payment
challenge and already provides server middleware for Hono.

## Goals / Non-Goals

**Goals:**
- Add a single Bun + Hono application that serves HTML, REST, and JSON-RPC.
- Keep the existing funding research agent and expose it through the new app.
- Add Privy-backed browser login with embedded-wallet and smart-wallet support.
- Add server-issued agent tokens so agents can use every protected feature
  without a browser session.
- Add a grant-application marketplace flow: job, offer, acceptance, funding.
- Persist marketplace state in Postgres.
- Persist browser-authored research scenarios, research requests, and tracked
  grant records in Postgres.
- Let one authenticated user switch between requester and specialist flows
  without creating a second account.
- Add a sidebar workspace for request marketplace, research dashboard, my
  requests, and my grants.
- Add a steerable request-detail console so an active research run exposes its
  progress, recent tool activity, and queued steering notes.
- Let a requester turn a tracked grant into a proposal-writing marketplace job.
- Add x402 payment challenges to accepted-offer funding routes.
- Publish `/skill.md` and `/docs` so automated clients can discover the system.

**Non-Goals:**
- Build a production-grade escrow system or dispute workflow.
- Replace all non-browser auth with Privy tokens only.
- Add a full admin backoffice or team-management surface.
- Add wallet-based signing requirements to non-payment routes.

## Decisions

### Use Hono on Bun as the single application shell

The platform will use Hono for routing and Bun as the runtime. Hono will serve:
- the browser app shell and static assets
- REST endpoints under `/api/*`
- a JSON-RPC endpoint
- `/docs` and `/skill.md`

Rationale:
- Hono is lightweight and fits Bun well.
- x402 has first-party Hono middleware.
- A single process keeps the first full-stack slice small and testable.

Alternative considered:
- Next.js. Rejected because the current repo needs a compact, curl-friendly
  server first, not a framework-heavy app shell.

### Keep business logic in a shared service layer

The server routes will call plain service functions for:
- user registration and key issuance
- job and offer workflows
- funding research execution
- research scenario and request lifecycle
- tracked grant lifecycle
- payment state updates

Rationale:
- REST, JSON-RPC, and HTML handlers can share the same logic.
- Tests can target workflows directly and through HTTP.
- The codebase avoids duplicating marketplace rules across interfaces.

Alternative considered:
- Put business logic directly in route handlers. Rejected because it would make
  REST and JSON-RPC parity harder to maintain.

### Use Postgres as the system of record

Application state will be stored in Postgres and accessed through a thin
repository layer. The database will own users, agent tokens, jobs, offers,
engagements, payment records, research scenarios, research requests, and tracked
grants.

Rationale:
- The marketplace now needs durable hosted persistence.
- Coolify can provide a managed Postgres service and inject `DATABASE_URL`.
- Relational storage is a better fit for linked entities like jobs, offers,
  engagements, and auth records.

Alternative considered:
- Keep file-backed JSON. Rejected because hosted multi-user state should not be
  serialized through a single local file.

### Model research as scenarios, requests, and tracked grants

The browser and API will stop treating research as a stateless "run scenario"
button. Instead, the system will store:
- reusable scenarios that capture the business case
- research requests that reference a scenario and track execution state
- tracked grants derived from report opportunities

Each research run will update one durable request record, and the resulting
opportunities will be normalized into tracked grant records that users can keep
active, archive, or promote into a marketplace job.

Each running request will also store a lightweight activity timeline and a list
of steering notes. The browser can poll this durable state to render a clean
"deep research"-style console instead of a blank waiting view.

Rationale:
- Human operators need something they can revisit, monitor, and edit.
- The current one-shot report response does not provide a usable browser
  workflow.
- Grant records are the bridge between research and the marketplace.

Alternative considered:
- Keep research output ephemeral and leave organization to the human. Rejected
  because it makes the browser experience feel broken and hides the actual
  product workflow.

### Persist request activity and steering on the request record

Research requests will store:
- the current execution phase
- a short progress summary
- a bounded activity timeline for agent and tool milestones
- a bounded list of steering notes with queued or applied status

When the live PI agent session is available, the service layer will subscribe to
agent events, project them onto the durable request record, and deliver queued
steering notes through the agent's steering interface. When only a simple
blocking research runner is injected, the service will keep the old synchronous
path so tests and non-interactive callers still behave deterministically.

Rationale:
- Humans need visibility into long-running research instead of a blank spinner.
- The same request detail should survive reloads and remain inspectable after a
  run completes or fails.
- Steering should be durable enough that the UI can show whether the agent has
  only queued a note or already applied it.

Alternative considered:
- Keep live progress only in browser memory. Rejected because refreshes would
  destroy the operator view and the API would not expose the same behavior.

### Use Privy for browser identity and wallet provisioning

The browser application will use Privy’s React SDK for human login. The root
client will mount `PrivyProvider` and `SmartWalletsProvider`, configure
automatic embedded-wallet creation, and rely on Privy to generate smart wallets
once an embedded wallet exists.

The browser will request a Privy access token and send it to the backend. The
backend will verify that token with Privy’s server SDK, derive the user’s
Privy DID, and upsert a local platform user record in Postgres.

Rationale:
- Privy is designed for browser auth plus embedded and smart wallets.
- Human login should not depend on a locally-issued secret or manual copy step.
- x402 payment and auth stay separable while still giving users wallet-native
  identities.

Alternative considered:
- Use API keys as the browser auth primitive. Rejected because the hosted UI
  should have a real user identity provider.

### Use server-issued agent tokens for curl and JSON-RPC

Authenticated users will be able to mint personal agent tokens from the
platform. Protected REST and JSON-RPC routes will accept either:
- a verified Privy bearer access token from the browser
- a platform-issued agent token for curl, scripts, or autonomous agents

Rationale:
- Agent workflows need long-lived, non-browser credentials.
- The backend can keep authorization logic uniform after identity resolution.
- This preserves the user requirement that every feature remain accessible over
  curl or JSON-RPC.

Alternative considered:
- Force agents to forward Privy browser tokens. Rejected because it makes
  headless automation awkward and couples agent workflows to browser sessions.

### Use x402 only for funding actions, not for general login

The accepted-offer funding route will return an x402 payment challenge when the
engagement is not yet funded. On successful payment verification, the platform
will mark the engagement funded and store the payment metadata.

The first implementation will target direct funding of a specific accepted
offer. The payment descriptor will be derived from the engagement so the route
can express who is being paid, what is being funded, and for how much.

Rationale:
- x402 is strongest where payment is the core action.
- This keeps the auth and payment models clean.
- It satisfies the requirement that users can pay other users to apply for
  grants on their behalf.

Alternative considered:
- Use x402 across all routes. Rejected because most routes are not purchases.

### Build a small React frontend for the authenticated dashboard

The browser UI will be a small client bundle served by Hono. It will use React
because Privy’s browser SDK and smart-wallet support are React-native. The UI
must still expose the same workflows as the API:
- log in with Privy
- sync the authenticated browser user to a local platform profile
- switch the profile role between requester and specialist
- mint and revoke agent tokens
- create and edit research scenarios
- create, run, and revisit research requests
- inspect tracked grants and manage an active grant queue
- promote a tracked grant into a proposal-writing marketplace job
- create jobs
- browse open jobs
- submit offers
- accept an offer
- fund an accepted engagement
- run research

Rationale:
- The repo needs a working human surface, not a placeholder.
- Privy smart-wallet support requires a React-based browser integration.
- Hono can still serve the bundle, docs, skill file, and API from one process.

Alternative considered:
- Keep the whole dashboard server-rendered. Rejected because it would fight the
  Privy SDK instead of using the supported integration path.

### Reuse the marketplace job model for grant proposal work

Tracked grants will be promotable into a marketplace job with a distinct
`grant_proposal` job type. The proposal job will carry the selected grant
context forward so specialists can bid on a concrete proposal-writing or
submission engagement rather than a generic request.

Rationale:
- It keeps proposal-writing inside the same offer and funding workflow.
- Humans can move from discovery to execution without retyping the opportunity.
- The job type makes grant-sourced work explicit in both browser and API
  surfaces.

Alternative considered:
- Create a separate proposal-only subsystem. Rejected because it would duplicate
  job, offer, acceptance, and funding behaviors we already have.

## Risks / Trade-offs

- Privy browser auth adds a client bundle and external identity dependency. →
  Mitigation: keep the frontend small, verify tokens only on the backend, and
  keep agent tokens as the fallback automation surface.
- Local development now requires Postgres in addition to Bun. → Mitigation:
  document `DATABASE_URL`, use schema bootstrap at startup, and make tests use a
  disposable database.
- x402 live settlement requires chain-specific environment setup. → Mitigation:
  support local verification of 402 responses and guard live settlement tests
  behind environment variables.
- Agent tokens are convenient but require careful redaction in docs and UI. →
  Mitigation: show raw token secrets only at creation time and store only
  hashed values at rest.
- Human and agent surfaces can drift. → Mitigation: keep workflow logic in one
  service layer and mirror actions across REST and JSON-RPC.
- Research requests can accumulate stale grant records after reruns. →
  Mitigation: treat one request as the owner of its tracked grants and replace
  or update those records on each run.

## Migration Plan

1. Replace the file-backed store with Postgres-backed repositories and schema
   bootstrap.
2. Add Privy server verification and local-user upsert flows.
3. Add agent-token issuance, storage, and bearer-token authentication.
4. Expose research, marketplace, auth, and token-management routes through REST
   and JSON-RPC.
5. Add persisted scenarios, research requests, and tracked grant records.
6. Replace the server-rendered dashboard with a small React + Privy client
   bundle and sidebar workspace.
7. Keep x402 funding routes and document the required auth, database, and x402
   environment variables.
8. Publish updated `/skill.md` and `/docs`.
9. Add tests for auth handoff, agent tokens, persistence, HTTP flows,
   JSON-RPC, and x402 challenge responses.

Rollback is straightforward because the new platform surface is additive and
can be removed without affecting the existing CLI.

## Open Questions

- Whether the x402 funding route should pay directly to the specialist wallet
  or to a platform wallet with later payout settlement if the library surface
  makes per-engagement configuration awkward.
- Whether we should later support server-side Privy cookie mode once the hosted
  custom domain is stable.
- Whether tracked grants should keep manual notes and attachments in the first
  implementation or stay limited to queue state plus proposal-job promotion.
