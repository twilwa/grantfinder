## Why

There is no way to ship a new frontend feature to a subset of users. Every UI
change is all-or-nothing at deploy time, so we cannot pilot a new sidebar tab or
panel with one beta **Organization**, a single user, or one role before releasing
it widely. The platform also has no in-house control surface: identities are only
**Requester** or **Specialist**, with no staff actor who could manage such a
rollout.

## What Changes

- Add a **Platform administrator** actor: an in-house staff identity recognized
  when its verified Privy user ID is in an environment allowlist
  (`PLATFORM_ADMIN_PRIVY_IDS`). This is additive — it does not change the
  **Requester**/**Specialist** identity model, the Privy verification path, or any
  auth the platform depends on.
- Add **Feature flags**: named toggles that show or hide a single new frontend
  feature. Each flag carries a default state the administrator sets at creation
  (off for a new feature, on when the flag restricts an existing one).
- Add **Feature targeting**: per **Organization**, per user, or per role rules on
  a flag, each setting the feature on or off, resolved most-specific-wins (user,
  then organization, then role, then the flag default).
- Resolve flags server-side at the existing session bootstrap and deliver only the
  resolved set of enabled features to the browser; targeting rules never reach the
  client. The React client renders flagged tabs and panels conditionally.
- Restrict all flag create/modify/delete operations to a **Platform administrator**.

## Non-Goals

- No percentage / statistical rollout and no persisted per-user assignment;
  targeting is explicit and evaluation is deterministic.
- No analytics or impact measurement — the platform has no event pipeline today
  (see [CONTEXT.md](../../../CONTEXT.md) flagged ambiguities).
- No flag resolution for unauthenticated visitors (the public dashboard shows the
  baseline experience in v1).
- No change to the `requester`/`specialist` role model or the `PlatformUser`
  record.

## Capabilities

### New Capabilities
- `feature-flags`: administrator-managed, audience-targeted toggles that show or
  hide individual frontend features, resolved per user at session bootstrap

## Impact

- Platform types and persistence: new `feature_flags` and `feature_flag_targets`
  tables added to both the in-memory and Postgres stores via the inline
  `bootstrapSchema` pattern.
- Auth/services: a **Platform administrator** check against the env allowlist;
  admin-only API routes and JSON-RPC methods for flag management.
- Session bootstrap: the `GET /api/auth/session` payload gains a resolved
  `enabledFeatures` set; service-layer evaluation of targeting rules.
- Browser client: conditional rendering of flagged tabs/panels from
  `enabledFeatures`; an administrator-only flag management surface.
- Decision recorded in [ADR-0003](../../../docs/adr/0003-in-house-feature-flags.md).
- Focused tests for evaluation precedence, the administrator gate, and persistence
  parity across both stores.
