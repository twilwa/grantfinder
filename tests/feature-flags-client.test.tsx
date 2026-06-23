// ABOUTME: Tests the browser-client feature-flag helpers, gate component, and administrator panel.
// ABOUTME: Renders the pure, prop-driven pieces to static markup and asserts on the visible output.

import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import {
  isFeatureEnabled,
  FeatureGate,
  FeatureFlagAdminPanel,
  type AdminFeatureFlag,
} from "../src/client-feature-flags.js";

const betaSidebarFlag: AdminFeatureFlag = {
  id: "flag_1",
  key: "beta-sidebar",
  description: "Beta sidebar tab",
  defaultEnabled: false,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
  targets: [
    {
      id: "target_1",
      flagId: "flag_1",
      audienceType: "organization",
      audienceId: "org_1",
      enabled: true,
      createdAt: "2026-01-03T00:00:00.000Z",
    },
  ],
};

test("isFeatureEnabled reflects membership in the enabled set", () => {
  expect(isFeatureEnabled(["beta-sidebar", "other"], "beta-sidebar")).toBe(true);
  expect(isFeatureEnabled(["other"], "beta-sidebar")).toBe(false);
  expect(isFeatureEnabled(undefined, "beta-sidebar")).toBe(false);
  expect(isFeatureEnabled([], "beta-sidebar")).toBe(false);
});

test("FeatureGate renders children when the feature is enabled", () => {
  const markup = renderToStaticMarkup(
    <FeatureGate enabledFeatures={["beta-sidebar"]} featureKey="beta-sidebar">
      <span>Beta Panel</span>
    </FeatureGate>,
  );

  expect(markup).toContain("Beta Panel");
});

test("FeatureGate renders the fallback when the feature is disabled", () => {
  const markup = renderToStaticMarkup(
    <FeatureGate
      enabledFeatures={["something-else"]}
      featureKey="beta-sidebar"
      fallback={<span>Fallback Content</span>}
    >
      <span>Beta Panel</span>
    </FeatureGate>,
  );

  expect(markup).not.toContain("Beta Panel");
  expect(markup).toContain("Fallback Content");
});

test("FeatureFlagAdminPanel renders the create form and empty state with no flags", () => {
  const markup = renderToStaticMarkup(
    <FeatureFlagAdminPanel
      flags={[]}
      onCreateFlag={() => undefined}
      onUpdateFlag={() => undefined}
      onDeleteFlag={() => undefined}
      onSetTarget={() => undefined}
      onDeleteTarget={() => undefined}
    />,
  );

  expect(markup).toContain("Flag key");
  expect(markup).toContain("Create flag");
  expect(markup).toContain("No feature flags yet");
});

test("FeatureFlagAdminPanel renders a flag with its targeting rules", () => {
  const markup = renderToStaticMarkup(
    <FeatureFlagAdminPanel
      flags={[betaSidebarFlag]}
      onCreateFlag={() => undefined}
      onUpdateFlag={() => undefined}
      onDeleteFlag={() => undefined}
      onSetTarget={() => undefined}
      onDeleteTarget={() => undefined}
    />,
  );

  expect(markup).toContain("beta-sidebar");
  expect(markup).toContain("Beta sidebar tab");
  expect(markup).toContain("Default off");
  expect(markup).toContain("Targeting rules");
  expect(markup).toContain("org_1");
  expect(markup).toContain("On");
  expect(markup).toContain("Save targeting rule");
  expect(markup).toContain("Delete flag");
});
