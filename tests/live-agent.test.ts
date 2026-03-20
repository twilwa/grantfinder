// ABOUTME: Provides an optional end-to-end check for the live PI funding research agent.
// ABOUTME: It only runs when model provider credentials are available in the environment.

import { expect, test } from "bun:test";

import { runFundingResearch } from "../src/agent.js";
import { loadScenario } from "../src/scenarios.js";

const hasProviderCredentials =
  Boolean(process.env.OPENAI_API_KEY) ||
  Boolean(process.env.ANTHROPIC_API_KEY) ||
  Boolean(process.env.GOOGLE_API_KEY);

(hasProviderCredentials ? test : test.skip)(
  "live agent produces at least one cited opportunity for the inverse private equity case",
  async () => {
    const scenario = await loadScenario("inverse-private-equity");
    const result = await runFundingResearch({ scenario });

    expect(result.report.opportunities.length).toBeGreaterThan(0);
    expect(result.report.opportunities.every((opportunity) => opportunity.citations.length > 0)).toBe(true);
  },
);
