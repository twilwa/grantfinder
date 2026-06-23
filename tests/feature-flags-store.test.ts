// ABOUTME: Verifies feature flag and targeting-rule persistence and parity across both store drivers.
// ABOUTME: Covers create/list/find/update/delete for flags, target upsert/read/delete, and cascade deletion.

import { expect, test } from "bun:test";
import { newDb } from "pg-mem";

import { ApplicationStore } from "../src/store.js";
import type { PlatformFeatureFlag, PlatformFeatureFlagTarget } from "../src/platform-types.js";

function createTestDatabase() {
  const database = newDb();
  const adapter = database.adapters.createPg();
  return new adapter.Pool();
}

const baseFlag: PlatformFeatureFlag = {
  id: "flag_sidebar",
  key: "beta-sidebar",
  description: "Beta sidebar tab",
  defaultEnabled: false,
  createdAt: "2026-06-23T10:00:00.000Z",
  updatedAt: "2026-06-23T10:00:00.000Z",
};

function byId<T extends { id: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

async function runFlagScenario(store: ApplicationStore) {
  const created = await store.createFeatureFlag({ ...baseFlag });
  const listedAfterCreate = await store.listFeatureFlags();
  const byIdLookup = await store.findFeatureFlagById("flag_sidebar");
  const byKeyLookup = await store.findFeatureFlagByKey("beta-sidebar");
  const missingByKey = await store.findFeatureFlagByKey("does-not-exist");

  const updated = await store.updateFeatureFlag({
    ...baseFlag,
    description: "Beta sidebar tab (pilot)",
    defaultEnabled: true,
    updatedAt: "2026-06-23T11:00:00.000Z",
  });

  const userTarget = await store.setFeatureFlagTarget({
    id: "target_user",
    flagId: "flag_sidebar",
    audienceType: "user",
    audienceId: "user_1",
    enabled: true,
    createdAt: "2026-06-23T11:01:00.000Z",
  });
  await store.setFeatureFlagTarget({
    id: "target_org",
    flagId: "flag_sidebar",
    audienceType: "organization",
    audienceId: "org_1",
    enabled: false,
    createdAt: "2026-06-23T11:02:00.000Z",
  });
  // Re-targeting the same audience replaces the rule in place (keeps id + createdAt).
  const orgReplaced = await store.setFeatureFlagTarget({
    id: "target_org_ignored",
    flagId: "flag_sidebar",
    audienceType: "organization",
    audienceId: "org_1",
    enabled: true,
    createdAt: "2026-06-23T11:03:00.000Z",
  });
  const targetsAfterUpsert = await store.listFeatureFlagTargets("flag_sidebar");

  await store.deleteFeatureFlagTarget(userTarget.id);
  const targetsAfterDelete = await store.listFeatureFlagTargets("flag_sidebar");

  const state = await store.readState();

  await store.deleteFeatureFlag("flag_sidebar");
  const flagsAfterFlagDelete = await store.listFeatureFlags();
  const targetsAfterCascade = await store.listFeatureFlagTargets("flag_sidebar");

  return {
    created,
    listedAfterCreate: byId(listedAfterCreate),
    byIdLookup,
    byKeyLookup,
    missingByKey,
    updated,
    orgReplaced,
    targetsAfterUpsert: byId(targetsAfterUpsert),
    targetsAfterDelete: byId(targetsAfterDelete),
    stateFlags: byId(state.featureFlags),
    stateTargets: byId(state.featureFlagTargets),
    flagsAfterFlagDelete,
    targetsAfterCascade,
  };
}

test("feature flag CRUD and targeting persist identically across both store drivers", async () => {
  const memory = await runFlagScenario(new ApplicationStore());
  const postgres = await runFlagScenario(new ApplicationStore({ database: createTestDatabase() }));

  expect(memory).toEqual(postgres);
});

test("feature flag store enforces targeting precedence primitives", async () => {
  const store = new ApplicationStore();
  const result = await runFlagScenario(store);

  expect(result.created).toEqual(baseFlag);
  expect(result.byIdLookup?.key).toBe("beta-sidebar");
  expect(result.byKeyLookup?.id).toBe("flag_sidebar");
  expect(result.missingByKey).toBeNull();

  expect(result.updated.description).toBe("Beta sidebar tab (pilot)");
  expect(result.updated.defaultEnabled).toBe(true);
  expect(result.updated.updatedAt).toBe("2026-06-23T11:00:00.000Z");

  // Re-targeting the same audience keeps a single rule with the original id.
  const orgTargets = result.targetsAfterUpsert.filter(
    (target) => target.audienceType === "organization" && target.audienceId === "org_1",
  );
  expect(orgTargets).toHaveLength(1);
  expect(orgTargets[0]?.id).toBe("target_org");
  expect(orgTargets[0]?.enabled).toBe(true);
  expect(result.orgReplaced.id).toBe("target_org");

  expect(result.targetsAfterUpsert).toHaveLength(2);
  expect(result.targetsAfterDelete).toHaveLength(1);
  expect(result.targetsAfterDelete[0]?.audienceType).toBe("organization");

  // Deleting a flag cascades to its targeting rules.
  expect(result.flagsAfterFlagDelete).toHaveLength(0);
  expect(result.targetsAfterCascade).toHaveLength(0);
});
