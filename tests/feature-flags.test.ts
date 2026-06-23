// ABOUTME: Unit tests for the feature-flag engine: the platform-administrator allowlist predicate and pure targeting evaluation.
// ABOUTME: Covers admin allowlist parsing and most-specific-wins precedence (user > organization > role > default).

import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import {
  evaluate,
  isPlatformAdministrator,
  resolveEnabledFeatureKeys,
} from "../src/feature-flags.js";
import type { PlatformFeatureFlag, PlatformFeatureFlagTarget } from "../src/platform-types.js";

const flag: PlatformFeatureFlag = {
  id: "flag_sidebar",
  key: "beta-sidebar",
  description: "Beta sidebar tab",
  defaultEnabled: false,
  createdAt: "2026-06-23T10:00:00.000Z",
  updatedAt: "2026-06-23T10:00:00.000Z",
};

function target(overrides: Partial<PlatformFeatureFlagTarget>): PlatformFeatureFlagTarget {
  return {
    id: "target",
    flagId: "flag_sidebar",
    audienceType: "user",
    audienceId: "user_1",
    enabled: true,
    createdAt: "2026-06-23T11:00:00.000Z",
    ...overrides,
  };
}

describe("isPlatformAdministrator", () => {
  const original = process.env.PLATFORM_ADMIN_PRIVY_IDS;

  beforeEach(() => {
    delete process.env.PLATFORM_ADMIN_PRIVY_IDS;
  });

  afterEach(() => {
    if (original === undefined) {
      delete process.env.PLATFORM_ADMIN_PRIVY_IDS;
    } else {
      process.env.PLATFORM_ADMIN_PRIVY_IDS = original;
    }
  });

  test("returns false when the allowlist is unset or empty", () => {
    expect(isPlatformAdministrator("did:privy:abc")).toBe(false);
    process.env.PLATFORM_ADMIN_PRIVY_IDS = "   ";
    expect(isPlatformAdministrator("did:privy:abc")).toBe(false);
  });

  test("returns false for a null or empty privy user id", () => {
    process.env.PLATFORM_ADMIN_PRIVY_IDS = "did:privy:abc";
    expect(isPlatformAdministrator(null)).toBe(false);
    expect(isPlatformAdministrator("")).toBe(false);
  });

  test("matches an id in a comma-separated allowlist, tolerating whitespace", () => {
    process.env.PLATFORM_ADMIN_PRIVY_IDS = " did:privy:abc , did:privy:def ";
    expect(isPlatformAdministrator("did:privy:abc")).toBe(true);
    expect(isPlatformAdministrator("did:privy:def")).toBe(true);
    expect(isPlatformAdministrator("did:privy:xyz")).toBe(false);
  });
});

describe("evaluate (most-specific-wins precedence)", () => {
  const context = { userId: "user_1", orgId: "org_1", role: "requester" as const };

  test("falls back to the flag default when no target matches", () => {
    expect(evaluate(flag, [], context)).toBe(false);
    expect(evaluate({ ...flag, defaultEnabled: true }, [], context)).toBe(true);
  });

  test("a role target overrides the default", () => {
    const targets = [target({ id: "t_role", audienceType: "role", audienceId: "requester", enabled: true })];
    expect(evaluate(flag, targets, context)).toBe(true);
  });

  test("an organization target overrides a role target", () => {
    const targets = [
      target({ id: "t_role", audienceType: "role", audienceId: "requester", enabled: true }),
      target({ id: "t_org", audienceType: "organization", audienceId: "org_1", enabled: false }),
    ];
    expect(evaluate(flag, targets, context)).toBe(false);
  });

  test("a user target overrides organization and role targets", () => {
    const targets = [
      target({ id: "t_role", audienceType: "role", audienceId: "requester", enabled: false }),
      target({ id: "t_org", audienceType: "organization", audienceId: "org_1", enabled: false }),
      target({ id: "t_user", audienceType: "user", audienceId: "user_1", enabled: true }),
    ];
    expect(evaluate(flag, targets, context)).toBe(true);
  });

  test("ignores targets aimed at other audiences", () => {
    const targets = [
      target({ id: "t_user", audienceType: "user", audienceId: "other_user", enabled: true }),
      target({ id: "t_org", audienceType: "organization", audienceId: "other_org", enabled: true }),
    ];
    expect(evaluate(flag, targets, context)).toBe(false);
  });

  test("skips organization precedence when the user has no organization", () => {
    const targets = [
      target({ id: "t_role", audienceType: "role", audienceId: "requester", enabled: true }),
      target({ id: "t_org", audienceType: "organization", audienceId: "org_1", enabled: false }),
    ];
    expect(evaluate(flag, targets, { userId: "user_1", orgId: null, role: "requester" })).toBe(true);
  });
});

describe("resolveEnabledFeatureKeys", () => {
  const context = { userId: "user_1", orgId: "org_1", role: "requester" as const };
  const sidebar = flag;
  const panel: PlatformFeatureFlag = { ...flag, id: "flag_panel", key: "beta-panel", defaultEnabled: true };

  test("returns the keys of flags that resolve to enabled for the user", () => {
    const targets = [
      target({ id: "t_user", flagId: "flag_sidebar", audienceType: "user", audienceId: "user_1", enabled: true }),
      target({ id: "t_panel_off", flagId: "flag_panel", audienceType: "user", audienceId: "user_1", enabled: false }),
    ];
    expect(resolveEnabledFeatureKeys([sidebar, panel], targets, context)).toEqual(["beta-sidebar"]);
  });

  test("uses defaults when no targets are supplied", () => {
    expect(resolveEnabledFeatureKeys([sidebar, panel], [], context)).toEqual(["beta-panel"]);
  });
});
