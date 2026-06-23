## 1. Feature flag persistence

- [x] 1.1 Add `PlatformFeatureFlag` and `PlatformFeatureFlagTarget` types and
  extend `PlatformState` / `createEmptyPlatformState` in `src/platform-types.ts`
- [x] 1.2 Add `feature_flags` and `feature_flag_targets` schema to
  `bootstrapSchema` and implement create/list/update/delete + target read/write in
  both `MemoryStore` and `PostgresStore`, with a test asserting parity across both
  stores

## 2. Platform administrator gate and flag management API

- [x] 2.1 Add an `isPlatformAdministrator` predicate over the verified
  `privyUserId` against `PLATFORM_ADMIN_PRIVY_IDS`, wired through the existing
  `authenticate` path without changing the role model
- [x] 2.2 Add admin-only REST routes and JSON-RPC methods to create, list, update,
  and delete flags and their targeting rules, returning forbidden for
  non-administrators and unauthorized for anonymous requests

## 3. Targeting evaluation and session bootstrap

- [x] 3.1 Implement most-specific-wins evaluation (user → organization → role →
  default) in the service layer with focused precedence tests
- [x] 3.2 Extend the `GET /api/auth/session` payload with the resolved
  `enabledFeatures` set; verify targeting rules are never included and anonymous
  visitors receive none

## 4. Browser conditional rendering

- [x] 4.1 Thread `enabledFeatures` from the session payload into the client and
  gate flagged sidebar tabs / `SectionCard`s on feature-key membership
- [x] 4.2 Add an administrator-only flag management surface (list/create/update/
  delete flags and targets), gated by the admin predicate

## 5. Validation

- [ ] 5.1 Add/extend tests for the administrator gate, evaluation precedence,
  store parity, and session resolution; ensure pristine test output
- [ ] 5.2 Run `bun run check` and `openspec validate add-feature-flags --strict`,
  and verify the flagged-UI behavior in the browser
