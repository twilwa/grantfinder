# Grantfinder fitness review (2026-04-14)

## Scope
Evaluate existing app at `~/Projects/grantfinder` for fitness with current company goals:
- build grantfinder MVP landing + waitlist funnel
- ship applicant workspace MVP
- design grant ingestion + canonical grant data model
- set up analytics + feedback + weekly reporting

## Evidence collected
- Read architecture and docs: `README.md`, `src/app.ts`, `src/store.ts`, `src/client.tsx`, `src/client-operations.tsx`, `src/web.ts`
- Ran quality checks:
  - `bun test` (41 pass, 2 fail, 2 skip)
  - `bun run typecheck` (pass)
  - `bun run build` (pass)
- Attempted local serve:
  - `bun src/server.ts` fails without `DATABASE_URL`

## What is already strong (good fit)
1. Backend/API surface is broad and mostly mature
   - REST + JSON-RPC + skill discovery are implemented.
   - Rich domain model exists for research requests, tracked grants, catalog, proposal workspaces, application workspaces, provider connections, jobs/offers/engagements.
2. Canonical data model groundwork is already present
   - Durable entities and relationships in `src/store.ts` cover most of ingestion/catalog/applicant lifecycle needed by XWA-3 and XWA-4.
3. Applicant workspace foundations are real
   - Application templates, schema-backed sections, section generation, and finalize flows exist.
4. Build and type safety baseline is healthy
   - Typecheck/build pass; code compiles cleanly.

## Gaps and risks (poor fit / immediate blockers)
1. UX is over-concentrated and likely hard to use
   - Browser client is very large monolithic surfaces:
     - `src/client.tsx`: 2364 lines
     - `src/client-operations.tsx`: 2712 lines
   - High feature density in one shell increases cognitive load and slows onboarding.
2. Reliability is not production-ready yet
   - Test suite has active failures:
     - `durable catalog entries can start follow-up research and expose linked history`
     - `docker compose config renders the app and postgres stack`
   - Live tests are skipped (agent/http), so end-to-end confidence is partial.
3. Local run defaults are brittle
   - Server entrypoint currently requires `DATABASE_URL` when persistence is enabled, causing immediate startup failure without explicit DB config.
   - This conflicts with a smooth MVP demo/dev path.
4. Landing/waitlist and analytics are not first-class
   - Existing product is a deep authenticated operations workspace, not a focused top-of-funnel landing/waitlist funnel.
   - No clear built-in analytics/feedback/reporting loop yet for weekly product learning.
5. Maintainability risk from oversized core files
   - `src/app.ts` (1910 lines), `src/store.ts` (3237 lines), `tests/app.test.ts` (3720 lines) indicate high coupling and slower iteration risk.

## Fitness verdict
- Backend/platform fitness: HIGH as a starting point.
- UX/product-funnel fitness: LOW-MEDIUM for current company goals.
- Overall: USE AS BASE, but reposition as backend/platform foundation and build a focused MVP front-end/funnel on top.

## Recommended path for current issue stack
1. XWA-2 (landing + waitlist): implement a separate, lightweight marketing funnel surface first (clear CTA, waitlist capture, analytics events).
2. XWA-4 (applicant workspace MVP): keep existing backend routes; create a narrower guided UI for requester journey only.
3. XWA-3 (grant ingestion/model): keep existing catalog schema as canonical seed; add explicit ingestion normalization + freshness/revalidation workflow.
4. XWA-5 (analytics/reporting): add event instrumentation and weekly KPI report job early (activation, request creation, grant saved, proposal started, offer accepted).
5. Stabilization before scale: fix 2 failing tests + unskip at least one live path before major UX expansion.

## Suggested near-term acceptance criteria
- Green CI on current suite (no failing tests, skips justified).
- One clean local demo path with documented env bootstrap.
- Dedicated landing/waitlist page with analytics events.
- Guided applicant path from signup -> scenario -> request -> shortlist -> proposal draft.
- Weekly metrics snapshot generated from instrumented events.
