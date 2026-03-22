---
name: coolify-grantfinder-deploy
description: Use this skill when deploying the Grantfinder repository to Coolify. It captures the repo-specific Dockerfile, exposed port, runtime environment variables, persistent storage path, and post-deploy verification steps for the browser, REST, JSON-RPC, and x402 funding surfaces.
---

# Coolify Deploy For Grantfinder

Use this skill when the task is to deploy, update, or troubleshoot this repository on Coolify.

## What this repo needs

- Build pack: `Dockerfile`
- Dockerfile path: `/Dockerfile`
- Exposed port: `3000`
- Health check path: `/health`
- Persistent storage destination inside the container: `/app/scratchpad`

Grantfinder stores its local state in a JSON file. In production on Coolify, mount persistent storage and set:

```text
GRANTFINDER_DATA_PATH=/app/scratchpad/grantfinder-platform-state.json
```

## Why this shape

- Coolify deploys applications as Docker containers and supports a Dockerfile build pack for full control.
- Coolify’s docs note that the first exposed port is used for `PORT` if you do not set it yourself.
- Coolify persistent storage mounts under the container base directory `/app`, so this repo should persist under `/app/scratchpad`.
- Coolify can health-check a path and mark unhealthy containers accordingly, so this repo exposes `/health`.

## Runtime environment variables

Set these in Coolify as runtime environment variables:

```text
OPENAI_API_KEY=...
PI_PROVIDER=openai
PI_MODEL=gpt-4o-mini
PI_THINKING_LEVEL=medium
PORT=3000
GRANTFINDER_DATA_PATH=/app/scratchpad/grantfinder-platform-state.json
X402_MODE=challenge
X402_FACILITATOR_URL=https://x402.org/facilitator
X402_NETWORK=eip155:84532
X402_PAY_TO=0x...
```

If the deployment uses live x402 settlement, switch:

```text
X402_MODE=live
```

Do not use build variables for runtime secrets unless the app genuinely needs them at build time. This repo does not.

## Coolify setup checklist

1. Create a new application resource from the Git repository.
2. Choose the `Dockerfile` build pack.
3. Confirm the published port is `3000`.
4. Add persistent storage:
   - destination path: `/app/scratchpad`
5. Add runtime environment variables from the list above.
6. Configure health checks:
   - path: `/health`
   - expected status: `200`
7. Deploy.

## Post-deploy verification

Verify these URLs after each deploy:

```bash
curl -fsS https://<domain>/health
curl -fsS https://<domain>/docs | head
curl -fsS https://<domain>/skill.md | head
```

Then verify an authenticated flow:

```bash
API_KEY=$(curl -fsS https://<domain>/api/auth/register \
  -H 'content-type: application/json' \
  -d '{"name":"Deploy Check","role":"requester"}' | jq -r .apiKey)

curl -fsS https://<domain>/rpc \
  -H "Authorization: Bearer ${API_KEY}" \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":"jobs","method":"jobs.list","params":{}}'
```

## Things to keep in mind

- The current auth model is API-key based and the current persistence model is file-backed JSON.
- That is acceptable for first deployment, but not the long-term architecture for multi-user production.
- If/when Privy is added, keep x402 focused on payment and use Privy for identity + wallet provisioning.
- If/when a real database is added, prefer a managed Postgres service and remove business-critical dependence on the filesystem.
