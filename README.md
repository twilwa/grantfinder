# Bootstrap Team Guide

This repository is a reusable template for human + agent software delivery.

## What Humans Should Expect

- Agents default to **Strict Mode**.
- Agents use **OpenSpec** for planning unless you explicitly request **Full Yolo**.
- Agents use **`br`** for task tracking and dependency-aware execution.
- Agents plan first, then parallelize, then fan out bounded tasks to smaller models when that helps.
- Agents follow **TDD** and should report what they actually verified.
- Agents should prefer **`sem diff`** over raw `git diff` for code review.
- Agents should use **GitButler** rather than `jj` in this repo.

## Quick Start

```bash
./bootstrap.sh
mise tasks ls
```

If Entire is not already enabled for the repo, enable it at project start:

```bash
entire enable --project
```

## Tool Shortlist

### Always / default tools

- **OpenSpec** — spec-driven planning and change control. Use by default unless you explicitly request **Full Yolo**.
- **`br`** — task tracking and dependency graph. Use always.
- **`mise`** — toolchain, tasks, and environment manager. Use always.
- **`sg` (ast-grep)** — code search and structural rewrites. Prefer this over grep for code.
- **`sem diff`** — semantic review of code changes. Prefer this over raw `git diff` whenever possible.
- **GitButler** — parallel branch orchestration for this repo.

### Use when appropriate

- **`bv`** — visual/TUI view of the `br` task graph, blockers, and critical path.
- **`linctl`** — higher-level human/team tracking and Linear workflows.
- **`agent-brief` / `robots`** — deeper planning and multi-agent orchestration commands, if your active harness exposes them.
- **`entire`** — agent-session traces and context recovery.

## Daily Commands

```bash
# Toolchain + task list
mise install
mise tasks ls

# Work tracking
br ready
br create "Add feature X"
br show <id>
br update <id> --status in_progress
br dep add <issue> <depends-on>
br close <id>
br sync --flush-only

# Review and quality
sem diff
trunk check --all
trunk fmt
```

## Expected Workflow

1. Update or create OpenSpec artifacts unless the task is explicitly **Full Yolo**.
2. Create/update `br` tasks and dependencies.
3. Plan the work before coding.
4. Parallelize and fan out independent work.
5. Write failing tests first.
6. Implement the minimum code to pass.
7. Refactor while keeping tests green.
8. Review with `sem diff` and run the required checks.

## Funding Research Agent

This repo now includes a Bun/TypeScript application that uses the PI agent framework to research grants and adjacent funding sources for a business case, and a Hono-based web platform for hiring and funding specialists to apply for those grants.

### Install

```bash
bun install
```

### List built-in scenarios

```bash
bun run research --list
```

Current fixtures:
- `inverse-private-equity`
- `logistics-cost-forecasting`

### Run a scenario

Set provider credentials for a PI-supported model first. By default the CLI uses `openai` with `gpt-4o-mini`.

```bash
export OPENAI_API_KEY=...
bun run research --scenario inverse-private-equity
```

Print raw JSON instead of the formatted report:

```bash
bun run research --scenario logistics-cost-forecasting --json
```

Use a custom scenario file:

```bash
bun run research --scenario-file ./path/to/scenario.json --json
```

## Web Platform

Start the browser, REST, and JSON-RPC application:

```bash
bun run serve
```

Default URL:

```text
http://localhost:3000
```

Key surfaces:

- `/` browser dashboard for Privy login, wallet provisioning, profile creation, agent-token minting, research, jobs, offers, acceptance, and funding
- `/health` health endpoint for container platforms
- `/docs` HTTP usage guide with curl examples
- `/skill.md` agent-facing markdown discovery document
- `/api/*` REST endpoints
- `/rpc` JSON-RPC endpoint

### Runtime environment

```bash
export OPENAI_API_KEY=...
export DATABASE_URL=postgres://postgres:postgres@localhost:5432/grantfinder
export PRIVY_APP_ID=...
export PRIVY_APP_SECRET=...
# optional when Privy access tokens should be verified against an explicit key
export PRIVY_JWT_VERIFICATION_KEY=...
```

### Browser auth and local profile

1. Open `http://localhost:3000`.
2. Sign in with Privy.
3. Create an embedded wallet if the user does not have one yet.
4. Complete the Grantfinder profile as a `requester` or `specialist`.
5. Mint an agent token for CLI, REST, or JSON-RPC access.

### Run research over HTTP

```bash
curl -s http://localhost:3000/api/research \
  -H 'Authorization: Bearer <agentToken>' \
  -H 'content-type: application/json' \
  -d '{"scenarioId":"inverse-private-equity"}'
```

### Create a job

```bash
curl -s http://localhost:3000/api/jobs \
  -H 'Authorization: Bearer <agentToken>' \
  -H 'content-type: application/json' \
  -d '{"title":"Apply for automation grants","description":"Need a specialist to run the process.","fundingNeed":"automation and workforce development"}'
```

### JSON-RPC example

```bash
curl -s http://localhost:3000/rpc \
  -H 'Authorization: Bearer <agentToken>' \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":"jobs","method":"jobs.list","params":{}}'
```

### x402 funding mode

The accepted-offer funding route is `POST /api/engagements/:id/fund`.

By default the app runs in challenge mode and returns an x402-shaped payment challenge with:

- `x-payment-protocol: x402`
- pay-to address
- amount
- facilitator URL
- network

To switch to live x402 middleware, start the server with:

```bash
X402_MODE=live \
X402_FACILITATOR_URL=https://x402.org/facilitator \
X402_NETWORK=eip155:84532 \
X402_PAY_TO=0xYourFallbackAddress \
bun run serve
```

## Container Deployment

This repo now includes a production container at [Dockerfile](/Users/anon/Projects/grantfinder/Dockerfile).

### One-command local stack

If you want the app plus Postgres in containers, run the compose stack from the
repo root:

```bash
docker compose up
```

This starts:

- `app` on `http://localhost:3000`
- `postgres` on the internal compose network with a persistent named volume
  called `grantfinder-postgres`

The stack is ready without extra secrets, but some features stay limited until
you provide real credentials:

- Without `PRIVY_APP_ID` and `PRIVY_APP_SECRET`, the browser dashboard loads
  but login stays disabled.
- Without `OPENAI_API_KEY`, research calls start but the model-backed work
  cannot complete successfully.

To enable those features, export the variables in your shell or define them in
your local `.env` file before you run `docker compose up`.

Build and run it locally:

```bash
docker build -t grantfinder .
docker run --rm -p 3000:3000 \
  -e OPENAI_API_KEY=... \
  -e DATABASE_URL=postgres://postgres:postgres@host.docker.internal:5432/grantfinder \
  -e PRIVY_APP_ID=... \
  -e PRIVY_APP_SECRET=... \
  grantfinder
```

Quick smoke test:

```bash
curl -fsS http://localhost:3000/health
curl -fsS http://localhost:3000/skill.md | head
```

For Coolify, use the `Dockerfile` build pack, port `3000`, and provide a reachable Postgres instance plus Privy credentials through environment variables.

### Environment

- `PI_PROVIDER` selects the provider for `@mariozechner/pi-ai`
- `PI_MODEL` selects the model for the chosen provider
- `PI_THINKING_LEVEL` controls reasoning effort: `off|minimal|low|medium|high|xhigh`
- `OPENAI_API_KEY` authenticates the default PI model provider used by the research agent
- `PORT` overrides the web server port
- `DATABASE_URL` points the application at Postgres for durable marketplace state
- `PRIVY_APP_ID` enables browser login through Privy
- `PRIVY_APP_SECRET` lets the server verify Privy access tokens
- `PRIVY_JWT_VERIFICATION_KEY` optionally pins verification to an explicit JWT key
- `X402_MODE` selects `challenge` or `live` funding behavior
- `X402_FACILITATOR_URL` points the x402 middleware at a facilitator
- `X402_NETWORK` selects the target chain in CAIP-2 form such as `eip155:84532`
- `X402_PAY_TO` provides the fallback pay-to address used when an engagement lacks a payout address

### Checks

```bash
bun test
bun run typecheck
bun run build
```

## Notes

- This repo prefers **GitButler** over `jj`.
- `br` is the repo-local execution log; `linctl` is for team/human reporting.
- Bootstrap installs repo tools, but language/runtime choices should be managed through `mise` rather than ad-hoc installers.
- Use `scratchpad/` for temporary artifacts and `docs/` for durable documentation.
