# Design — In-house feature flags

Implements [ADR-0003](../../../docs/adr/0003-in-house-feature-flags.md). See
[CONTEXT.md](../../../CONTEXT.md) for the **Platform administrator**, **Feature
flag**, and **Feature targeting** glossary terms.

## Data model

Two new tables, added to both `MemoryStore` and `PostgresStore` via the existing
inline `bootstrapSchema` pattern (`CREATE TABLE IF NOT EXISTS` + `ALTER TABLE ADD
COLUMN IF NOT EXISTS`):

- `feature_flags`: `id`, `key` (unique), `description`, `default_enabled`
  (boolean), `created_at`, `updated_at`.
- `feature_flag_targets`: `id`, `flag_id` (fk, cascade delete), `audience_type`
  (`user` | `organization` | `role`), `audience_id` (a user id, organization id,
  or role string), `enabled` (boolean), `created_at`.

Deleting a flag cascades to its targets. Only definitions and targeting rules are
stored — there is no per-user assignment table.

## Admin identity

A request is a **Platform administrator** iff its verified `privyUserId` is in
`PLATFORM_ADMIN_PRIVY_IDS` (comma-separated env). The check is a small additive
predicate layered on the existing `authenticate` path (`src/auth.ts`,
`src/services.ts`); `PlatformUser` and the `requester`/`specialist` role enum are
untouched. The allowlist also bootstraps the first administrator (chicken-and-egg
solved by configuration, not by an in-app grant).

## Evaluation

For each flag, resolve a user to enabled/disabled by precedence:

1. a `user` target matching the user's id,
2. else an `organization` target matching the user's resolved **Organization**,
3. else a `role` target matching the user's role,
4. else the flag's `default_enabled`.

The resolved set of enabled flag keys is computed server-side in the service layer
and attached to the session bootstrap (`GET /api/auth/session`) as
`enabledFeatures: string[]`. Because targeting is explicit, the result is
deterministic and stable across loads without storing assignments.

## Client integration

The client already reads the session payload on load. It exposes `enabledFeatures`
to render functions; flagged sidebar tabs and `SectionCard`s render only when their
key is present. Targeting rules never reach the browser. An administrator-only
management surface (list/create/update/delete flags and their targets) is gated by
the same admin predicate on its API/RPC.

## Decisions resolved during design

- **Flag keys** are free-form strings chosen by the administrator; the client
  references the keys it knows about. No central key registry in v1.
- **Anonymous visitors** (public dashboard) receive no flags and see the baseline
  experience; resolution requires an authenticated user with a resolvable
  **Organization**/role.
- **Admin allowlist** is keyed by Privy user ID, not email — the verified Privy JWT
  carries only the user id, so id matching needs no extra Privy lookup.

## Non-goals (explicit)

- No percentage/statistical rollout, no assignment persistence.
- No analytics / impact measurement (no event pipeline exists).
- No change to platform auth or the role model.
