// ABOUTME: Provides an optional end-to-end check for the live PI funding research agent.
// ABOUTME: It only runs when model provider credentials are available in the environment.

import { expect, jest, test } from "bun:test";

import { runFundingResearch } from "../src/agent.js";
import { loadScenario } from "../src/scenarios.js";

function resolveLiveTestProvider() {
  if (process.env.PI_PROVIDER) {
    return process.env.PI_PROVIDER;
  }

  if (process.env.OPENAI_API_KEY) {
    return "openai";
  }

  if (process.env.ANTHROPIC_API_KEY) {
    return "anthropic";
  }

  if (process.env.GOOGLE_API_KEY) {
    return "google";
  }

  return null;
}

function hasCredentialsForProvider(provider: string | null) {
  switch (provider) {
    case "openai":
      return Boolean(process.env.OPENAI_API_KEY);
    case "anthropic":
      return Boolean(process.env.ANTHROPIC_API_KEY);
    case "google":
      return Boolean(process.env.GOOGLE_API_KEY);
    default:
      return false;
  }
}

const selectedProvider = resolveLiveTestProvider();
const shouldRunLiveTest =
  process.env.RUN_LIVE_PROVIDER_TESTS === "1" &&
  hasCredentialsForProvider(selectedProvider);

jest.setTimeout(180_000);

(shouldRunLiveTest ? test : test.skip)(
  "live agent produces at least one cited opportunity for the inverse private equity case",
  async () => {
    const scenario = await loadScenario("inverse-private-equity");
    const result = await runFundingResearch({
      scenario,
      provider: selectedProvider ?? undefined,
      thinkingLevel: "minimal",
      minResearchRounds: 1,
      maxResearchRounds: 1,
      minHighQualitySources: 1,
      sourceDeltaThreshold: 99,
      opportunityDeltaThreshold: 99,
      topN: 1,
    });

    expect(result.report.opportunities.length).toBeGreaterThan(0);
    expect(result.report.opportunities.every((opportunity) => opportunity.citations.length > 0)).toBe(true);
  },
);
