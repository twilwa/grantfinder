// ABOUTME: Exercises the structured funding report capture path used by the PI agent.
// ABOUTME: Confirms the report collector stores a validated report payload for later consumption.

import { expect, test } from "bun:test";

import { createReportCollector } from "../src/report.js";

test("publish_report collector stores the final structured report", async () => {
  const collector = createReportCollector();

  await collector.tool.execute(
    "tool-report-1",
    {
      businessCaseId: "inverse-private-equity",
      executiveSummary: "A mix of succession, workforce, and automation programs is worth pursuing.",
      searchSummary: "Look at succession, workforce, automation, and venture formation funding paths.",
      opportunities: [
        {
          title: "Example Workforce Grant",
          sponsor: "State Workforce Board",
          fundingType: "grant",
          fitScore: 82,
          whyFit: "Supports staff upskilling tied to automation projects.",
          eligibilityNotes: ["State-specific eligibility must be verified."],
          amountSummary: "Varies by state program",
          deadlineSummary: "Rolling or periodic",
          geography: "State-level",
          status: "needs-verification",
          citations: ["https://example.com/workforce-grant"],
          nextActions: ["Verify current open cycle", "Confirm employer match requirements"]
        }
      ],
      rejectedLeads: [
        {
          title: "Example Misfit Program",
          reason: "Program only funds academic institutions.",
          citations: ["https://example.com/rejected"]
        }
      ],
      nextActions: ["Verify the most promising programs with current state administrators."]
    },
    new AbortController().signal,
  );

  const report = collector.getReportOrThrow();

  expect(report.businessCaseId).toBe("inverse-private-equity");
  expect(report.opportunities).toHaveLength(1);
  expect(report.opportunities[0]?.citations).toContain("https://example.com/workforce-grant");
  expect(report.rejectedLeads[0]?.reason).toContain("academic institutions");
});
