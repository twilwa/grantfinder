// ABOUTME: Assembles the PI funding research agent and runs end-to-end research for a business case.
// ABOUTME: The agent combines deterministic briefing, live web tools, and a structured report publication step.

import { Agent, type AgentMessage, type AgentTool } from "@mariozechner/pi-agent-core";
import { Type, getModel } from "@mariozechner/pi-ai";
import type { Static } from "@mariozechner/pi-ai";

import { buildResearchBrief } from "./brief.js";
import { createReportCollector, type FundingReport } from "./report.js";
import type { BusinessScenario, ResearchBrief } from "./types.js";
import { readWebPage, searchWeb } from "./web.js";

type ThinkingLevel = "off" | "minimal" | "low" | "medium" | "high" | "xhigh";

export interface FundingResearchRunOptions {
  scenario: BusinessScenario;
  provider?: string;
  model?: string;
  thinkingLevel?: ThinkingLevel;
}

export interface FundingResearchResult {
  brief: ResearchBrief;
  report: FundingReport;
  messages: AgentMessage[];
}

function resolveModel(provider?: string, model?: string) {
  const selectedProvider = (provider ?? process.env.PI_PROVIDER ?? "openai") as Parameters<
    typeof getModel
  >[0];
  const selectedModel = (model ?? process.env.PI_MODEL ?? "gpt-4o-mini") as never;
  return getModel(selectedProvider, selectedModel);
}

function buildSystemPrompt(): string {
  return [
    "You are a funding research specialist for small and mid-market business operators.",
    "You research grants, incentives, tax credits, subsidized loans, innovation pilots, cooperative agreements, procurement-like pilots, and adjacent non-dilutive capital paths.",
    "You must use tools to search and read source pages before recommending an opportunity.",
    "Never invent deadlines, award amounts, or eligibility criteria.",
    "If information is uncertain, say so explicitly in the published report.",
    "Prefer authoritative sponsor pages and clearly labeled intermediaries over secondary summaries.",
    "When you have enough evidence, call publish_report exactly once with the final structured report.",
  ].join(" ");
}

function buildResearchPrompt(scenario: BusinessScenario, brief: ResearchBrief): string {
  return [
    `Research the following business case: ${scenario.name}.`,
    "Goal: identify the strongest grants and adjacent funding sources worth pursuing in the next quarter.",
    "You may recommend non-grant sources when direct grants are weak, but you must say why they are relevant.",
    "Use search_web to find candidate programs and read_source_page to verify shortlisted opportunities.",
    "Do not publish an opportunity unless it has at least one citation URL.",
    "Return 3-7 opportunities when the evidence supports them. If fewer are credible, return fewer and explain why.",
    "Business case JSON:",
    JSON.stringify(scenario, null, 2),
    "Deterministic research brief JSON:",
    JSON.stringify(brief, null, 2),
  ].join("\n\n");
}

const searchToolParameters = Type.Object({
  query: Type.String({ minLength: 3 }),
  domains: Type.Optional(Type.Array(Type.String())),
  limit: Type.Optional(Type.Number({ minimum: 1, maximum: 10 })),
});

type SearchToolParameters = Static<typeof searchToolParameters>;

const readSourceToolParameters = Type.Object({
  url: Type.String({ format: "uri" }),
  maxChars: Type.Optional(Type.Number({ minimum: 500, maximum: 20000 })),
});

type ReadSourceToolParameters = Static<typeof readSourceToolParameters>;

function createSearchTool(): AgentTool {
  return {
    name: "search_web",
    label: "Search Web",
    description:
      "Search the public web for active funding opportunities, sponsor pages, and intermediary program pages.",
    parameters: searchToolParameters,
    execute: async (_toolCallId, params, signal) => {
      const typedParams = params as SearchToolParameters;
      const results = await searchWeb(typedParams.query, {
        domains: typedParams.domains,
        limit: typedParams.limit ?? 5,
        signal,
      });

      return {
        content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
        details: { query: typedParams.query, resultCount: results.length },
      };
    },
  };
}

function createReadSourceTool(): AgentTool {
  return {
    name: "read_source_page",
    label: "Read Source Page",
    description: "Read a funding program source page and extract a compact text summary.",
    parameters: readSourceToolParameters,
    execute: async (_toolCallId, params, signal) => {
      const typedParams = params as ReadSourceToolParameters;
      const page = await readWebPage(typedParams.url, {
        maxChars: typedParams.maxChars ?? 6000,
        signal,
      });

      return {
        content: [{ type: "text", text: JSON.stringify(page, null, 2) }],
        details: { url: page.url, title: page.title },
      };
    },
  };
}

export function createFundingResearchAgent(options: FundingResearchRunOptions) {
  const brief = buildResearchBrief(options.scenario);
  const reportCollector = createReportCollector();
  const tools = [createSearchTool(), createReadSourceTool(), reportCollector.tool];

  const agent = new Agent({
    initialState: {
      systemPrompt: buildSystemPrompt(),
      model: resolveModel(options.provider, options.model),
      thinkingLevel: options.thinkingLevel ?? "medium",
      tools,
    },
  });

  return {
    agent,
    brief,
    prompt: buildResearchPrompt(options.scenario, brief),
    getReport: reportCollector.getReport,
    getReportOrThrow: reportCollector.getReportOrThrow,
  };
}

export async function runFundingResearch(
  options: FundingResearchRunOptions,
): Promise<FundingResearchResult> {
  const session = createFundingResearchAgent(options);
  await session.agent.prompt(session.prompt);

  return {
    brief: session.brief,
    report: session.getReportOrThrow(),
    messages: [...session.agent.state.messages],
  };
}
