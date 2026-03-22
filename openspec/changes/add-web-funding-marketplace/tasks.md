## 1. Application shell

- [x] 1.1 Add the Hono server and browser bundle entrypoints for dashboard and API traffic
- [x] 1.2 Replace the file-backed store with a Postgres-backed persistence layer and schema bootstrap

## 2. Auth and discovery

- [x] 2.1 Add Privy token verification, local-user upsert, and agent-token auth for protected routes
- [x] 2.2 Update `/skill.md` and `/docs` with browser login, agent-token, and hosted setup guidance

## 3. Research and marketplace APIs

- [x] 3.1 Expose the funding research workflow over REST and JSON-RPC
- [x] 3.2 Add Postgres-backed job creation, offer submission, offer acceptance, engagement queries, and token management APIs
- [x] 3.3 Add persisted research scenarios, research requests, tracked grants, and grant-proposal job promotion APIs

## 4. Browser frontend

- [x] 4.1 Add a React + Privy dashboard for jobs, offers, engagements, research actions, and token management
- [x] 4.2 Add accessible browser flows for login, job creation, offer submission, offer acceptance, and funding
- [x] 4.3 Add a role-aware sidebar workspace for request marketplace, research dashboard, my requests, and my grants
- [x] 4.4 Add browser flows for scenario authoring, request reruns, grant queue management, and proposal-job creation

## 5. x402 funding

- [x] 5.1 Add x402-protected engagement funding routes and payment state updates
- [x] 5.2 Add environment-driven x402 configuration and fallback handling for local development
- [x] 5.3 Add a `docker compose up` local stack for the app plus Postgres

## 6. Validation

- [x] 6.1 Add tests for Privy auth handoff, agent tokens, REST/JSON-RPC parity, marketplace persistence, and x402 challenges
- [x] 6.2 Add compose validation for the local container stack
- [x] 6.3 Run the full checks and validate the OpenSpec change
- [x] 6.4 Add tests for research request persistence, grant tracking, role switching, and proposal-job creation
