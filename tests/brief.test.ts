// ABOUTME: Validates deterministic scenario briefing for funding research inputs.
// ABOUTME: Ensures the agent starts from stable search tracks for the supported fixtures.

import { expect, test } from "bun:test";

import { buildResearchBrief } from "../src/brief.js";
import { loadScenario, listScenarioIds } from "../src/scenarios.js";

test("fixture identifiers are available for both requested business cases", async () => {
  const scenarioIds = await listScenarioIds();

  expect(scenarioIds).toContain("inverse-private-equity");
  expect(scenarioIds).toContain("logistics-cost-forecasting");
});

test("inverse private equity scenario produces succession and workforce research tracks", async () => {
  const scenario = await loadScenario("inverse-private-equity");
  const brief = buildResearchBrief(scenario);
  const trackNames = brief.researchTracks.map((track) => track.name);
  const queryText = brief.researchTracks.flatMap((track) => track.queries).join(" ").toLowerCase();

  expect(trackNames).toContain("succession");
  expect(trackNames).toContain("workforce-development");
  expect(trackNames).toContain("automation-adoption");
  expect(brief.priorityFundingTypes).toContain("grant");
  expect(queryText).toContain("employee ownership");
  expect(queryText).toContain("automation");
});

test("logistics forecasting scenario produces supply-chain and critical-minerals research tracks", async () => {
  const scenario = await loadScenario("logistics-cost-forecasting");
  const brief = buildResearchBrief(scenario);
  const trackNames = brief.researchTracks.map((track) => track.name);
  const queryText = brief.researchTracks.flatMap((track) => track.queries).join(" ").toLowerCase();

  expect(trackNames).toContain("supply-chain-resilience");
  expect(trackNames).toContain("fuel-and-energy");
  expect(trackNames).toContain("critical-minerals");
  expect(brief.priorityFundingTypes).toContain("tax-credit");
  expect(queryText).toContain("critical mineral");
  expect(queryText).toContain("fuel");
});
