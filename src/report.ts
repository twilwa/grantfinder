// ABOUTME: Defines the structured funding report schema and the collector tool that stores it.
// ABOUTME: The PI agent must call publish_report so downstream code can consume a stable artifact.

import type { AgentTool } from "@mariozechner/pi-agent-core";
import { Type } from "@mariozechner/pi-ai";
import type { Static } from "@mariozechner/pi-ai";

export const opportunitySchema = Type.Object({
  title: Type.String(),
  sponsor: Type.String(),
  fundingType: Type.String(),
  fitScore: Type.Number({ minimum: 0, maximum: 100 }),
  whyFit: Type.String(),
  eligibilityNotes: Type.Array(Type.String()),
  amountSummary: Type.String(),
  deadlineSummary: Type.String(),
  geography: Type.String(),
  status: Type.String(),
  citations: Type.Array(Type.String({ format: "uri" }), { minItems: 1 }),
  nextActions: Type.Array(Type.String(), { minItems: 1 }),
});

export const rejectedLeadSchema = Type.Object({
  title: Type.String(),
  reason: Type.String(),
  citations: Type.Array(Type.String({ format: "uri" }), { minItems: 1 }),
});

export const reportSchema = Type.Object({
  businessCaseId: Type.String(),
  executiveSummary: Type.String(),
  searchSummary: Type.String(),
  opportunities: Type.Array(opportunitySchema, { minItems: 1 }),
  rejectedLeads: Type.Array(rejectedLeadSchema),
  nextActions: Type.Array(Type.String(), { minItems: 1 }),
});

export type FundingOpportunity = Static<typeof opportunitySchema>;
export type RejectedLead = Static<typeof rejectedLeadSchema>;
export type FundingReport = Static<typeof reportSchema>;

export interface ReportCollector {
  tool: AgentTool;
  getReport(): FundingReport | null;
  getReportOrThrow(): FundingReport;
}

export function createReportCollector(): ReportCollector {
  let report: FundingReport | null = null;

  const tool: AgentTool = {
    name: "publish_report",
    label: "Publish Report",
    description:
      "Submit the final structured funding report after you have finished live research and source review.",
    parameters: reportSchema,
    execute: async (_toolCallId, params) => {
      report = params as FundingReport;
      return {
        content: [
          {
            type: "text",
            text: `Stored structured report for ${report.businessCaseId} with ${report.opportunities.length} opportunities.`,
          },
        ],
        details: {
          businessCaseId: report.businessCaseId,
          opportunityCount: report.opportunities.length,
        },
      };
    },
  };

  return {
    tool,
    getReport: () => report,
    getReportOrThrow: () => {
      if (!report) {
        throw new Error("Agent completed without calling publish_report.");
      }
      return report;
    },
  };
}
