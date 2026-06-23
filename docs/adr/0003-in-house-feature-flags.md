---
status: accepted
---

# In-house feature flags (admin-gated, targeted, server-evaluated)

Grantfinder gains a **Feature flag** system so a **Platform administrator** can
show or hide a single new frontend feature (e.g. a sidebar tab or a `SectionCard`)
for a chosen audience without a deploy. Administration is in-house only and
additive: it does not change the **Requester**/**Specialist** identity model the
platform runs on, and a flag governs only its own feature—the rest of the
application is unaffected when no rule matches a user.

**Admin identity.** A request is treated as a **Platform administrator** when its
verified Privy user ID is listed in `PLATFORM_ADMIN_PRIVY_IDS` (env). No column is
added to `PlatformUser` and no new value joins the `requester`/`specialist` role
enum; the existing Privy verification path (`src/auth.ts`) is reused unchanged.
The allowlist also bootstraps the first administrator.

**Targeting and evaluation.** Each flag has a default state the administrator sets
at creation (off for a new feature; on when the flag instead restricts an existing
one) plus **Feature targeting** entries scoped to a specific **Organization**, a
specific user, or a role. Flags are resolved per user at the existing session
bootstrap (`GET /api/auth/session`) using most-specific-wins precedence (user, then
organization, then role, then the flag default). The browser receives only the
resolved set of enabled features, never the targeting rules.

**No statistical rollout.** Targeting is explicit, so evaluation is deterministic
and a user resolves the same way on every load; v1 has no percentage rollout and
persists no per-user assignment. Only flag definitions and their targeting rules
are stored.

**Considered options:** (1) An operator claim on `PlatformUser` (`isOperator`
column + session claim) — rejected because it modifies the customer identity and
session the platform depends on, where an env allowlist is purely additive.
(2) A fully separate admin credential independent of Privy — rejected as more
machinery than an in-house v1 needs. (3) An email allowlist — rejected because the
verified Privy JWT carries only the user ID; matching emails would require an extra
Privy lookup per admin check. (4) Percentage rollout with a persisted user-flag
assignment table (per the original PRD) — rejected: no analytics pipeline exists to
measure impact, and explicit targeting already yields stable, auditable behavior.
(5) Client-side rule evaluation — rejected because it would ship targeting rules to
the browser.

**Consequences:** New `feature_flags` and `feature_flag_targets` tables are added to
both `MemoryStore` and `PostgresStore` (inline `bootstrapSchema`). Admin-only
routes/RPC methods gate on the env allowlist. The session payload gains an
`enabledFeatures` set and the React client renders tabs/panels conditionally on it.
Measuring flag impact is out of scope—the platform has no analytics today. See
[CONTEXT.md](../../CONTEXT.md) for glossary and relationships.
