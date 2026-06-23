// ABOUTME: Feature-flag engine — the platform-administrator allowlist predicate and pure targeting evaluation.
// ABOUTME: Evaluation is deterministic and most-specific-wins: a user rule beats an organization rule beats a role rule beats the flag default.

import type {
  PlatformFeatureFlag,
  PlatformFeatureFlagTarget,
  UserRole,
} from "./platform-types.js";

const ADMIN_ALLOWLIST_ENV = "PLATFORM_ADMIN_PRIVY_IDS";

// Identity attributes a feature flag is resolved against. `orgId` is null when the
// user has no resolvable organization.
export interface FeatureEvaluationContext {
  userId: string;
  orgId: string | null;
  role: UserRole;
}

// A verified Privy user id is a Platform administrator when it appears in the
// comma-separated PLATFORM_ADMIN_PRIVY_IDS allowlist. Configuration bootstraps the
// first administrator; there is no in-app grant.
export function isPlatformAdministrator(privyUserId: string | null | undefined): boolean {
  if (!privyUserId) {
    return false;
  }
  const allowlist = (process.env[ADMIN_ALLOWLIST_ENV] ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  return allowlist.includes(privyUserId);
}

// Resolves a single flag to enabled/disabled for one user, applying the most
// specific matching target rule and falling back to the flag's default.
export function evaluate(
  flag: PlatformFeatureFlag,
  targets: PlatformFeatureFlagTarget[],
  context: FeatureEvaluationContext,
): boolean {
  const flagTargets = targets.filter((target) => target.flagId === flag.id);

  const userRule = flagTargets.find(
    (target) => target.audienceType === "user" && target.audienceId === context.userId,
  );
  if (userRule) {
    return userRule.enabled;
  }

  if (context.orgId !== null) {
    const orgRule = flagTargets.find(
      (target) => target.audienceType === "organization" && target.audienceId === context.orgId,
    );
    if (orgRule) {
      return orgRule.enabled;
    }
  }

  const roleRule = flagTargets.find(
    (target) => target.audienceType === "role" && target.audienceId === context.role,
  );
  if (roleRule) {
    return roleRule.enabled;
  }

  return flag.defaultEnabled;
}

// Resolves every flag for one user and returns the keys that are enabled, preserving
// the order of the supplied flags. This is the set delivered to the browser; targeting
// rules themselves never leave the server.
export function resolveEnabledFeatureKeys(
  flags: PlatformFeatureFlag[],
  targets: PlatformFeatureFlagTarget[],
  context: FeatureEvaluationContext,
): string[] {
  return flags.filter((flag) => evaluate(flag, targets, context)).map((flag) => flag.key);
}
