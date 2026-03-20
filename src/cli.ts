// ABOUTME: Exposes a small CLI for running the PI funding research agent against built-in or custom scenarios.
// ABOUTME: This gives the repository a runnable entrypoint for the two business cases requested by the user.

import { parseArgs } from "node:util";

import { runFundingResearch } from "./agent.js";
import { loadScenario, listScenarioIds } from "./scenarios.js";

function printUsage(): void {
  console.log(`Usage:
  bun run research --scenario <id> [--json]
  bun run research --scenario-file <path> [--json]
  bun run research --list

Environment:
  PI_PROVIDER        Provider name for @mariozechner/pi-ai (default: openai)
  PI_MODEL           Model name for the selected provider (default: gpt-4o-mini)
  PI_THINKING_LEVEL  off|minimal|low|medium|high|xhigh (default: medium)
`);
}

function formatReport(report: Awaited<ReturnType<typeof runFundingResearch>>["report"]): string {
  const sections = [
    `# ${report.businessCaseId}`,
    "",
    "## Executive Summary",
    report.executiveSummary,
    "",
    "## Search Summary",
    report.searchSummary,
    "",
    "## Opportunities",
    ...report.opportunities.flatMap((opportunity, index) => [
      `${index + 1}. ${opportunity.title} (${opportunity.fundingType})`,
      `   Sponsor: ${opportunity.sponsor}`,
      `   Fit Score: ${opportunity.fitScore}`,
      `   Status: ${opportunity.status}`,
      `   Geography: ${opportunity.geography}`,
      `   Why Fit: ${opportunity.whyFit}`,
      `   Eligibility Notes: ${opportunity.eligibilityNotes.join("; ")}`,
      `   Amount: ${opportunity.amountSummary}`,
      `   Deadline: ${opportunity.deadlineSummary}`,
      `   Next Actions: ${opportunity.nextActions.join("; ")}`,
      `   Citations: ${opportunity.citations.join(", ")}`,
      "",
    ]),
    "## Rejected Leads",
    ...report.rejectedLeads.flatMap((lead) => [
      `- ${lead.title}: ${lead.reason}`,
      `  Citations: ${lead.citations.join(", ")}`,
    ]),
    "",
    "## Next Actions",
    ...report.nextActions.map((step) => `- ${step}`),
  ];

  return sections.join("\n");
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      scenario: { type: "string" },
      "scenario-file": { type: "string" },
      json: { type: "boolean", default: false },
      list: { type: "boolean", default: false },
      help: { type: "boolean", default: false },
    },
    strict: true,
    allowPositionals: false,
  });

  if (values.help) {
    printUsage();
    return;
  }

  if (values.list) {
    const scenarioIds = await listScenarioIds();
    console.log(scenarioIds.join("\n"));
    return;
  }

  const scenarioReference = values["scenario-file"] ?? values.scenario;
  if (!scenarioReference) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const scenario = await loadScenario(scenarioReference);
  const result = await runFundingResearch({
    scenario,
    thinkingLevel: (process.env.PI_THINKING_LEVEL as
      | "off"
      | "minimal"
      | "low"
      | "medium"
      | "high"
      | "xhigh"
      | undefined) ?? "medium",
  });

  if (values.json) {
    console.log(JSON.stringify(result.report, null, 2));
    return;
  }

  console.log(formatReport(result.report));
}

await main();
