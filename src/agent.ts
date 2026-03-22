// ABOUTME: Assembles the PI funding research agent and runs end-to-end research for a business case.
// ABOUTME: The app path uses a bounded search-and-summarize workflow while the interactive agent remains available.

import { Agent, type AgentEvent, type AgentMessage, type AgentTool } from "@mariozechner/pi-agent-core";
import { Type, getModel } from "@mariozechner/pi-ai";
import type { Static } from "@mariozechner/pi-ai";
import OpenAI from "openai";

import { buildResearchBrief } from "./brief.js";
import { createReportCollector, type FundingReport } from "./report.js";
import type { BusinessScenario, ResearchBrief, SearchResult, SourcePage } from "./types.js";
import { readWebPage, searchWeb } from "./web.js";

type ThinkingLevel = "off" | "minimal" | "low" | "medium" | "high" | "xhigh";

const SEARCH_CALL_BUDGET = 3;
const READ_SOURCE_CALL_BUDGET = 3;
const DETERMINISTIC_TRACK_LIMIT = 3;
const DETERMINISTIC_RESULTS_PER_TRACK = 1;
const DETERMINISTIC_PAGE_LIMIT = 2;

const fundingReportFormatSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    businessCaseId: { type: "string" },
    executiveSummary: { type: "string" },
    searchSummary: { type: "string" },
    opportunities: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          sponsor: { type: "string" },
          fundingType: { type: "string" },
          fitScore: { type: "number", minimum: 0, maximum: 100 },
          whyFit: { type: "string" },
          eligibilityNotes: {
            type: "array",
            items: { type: "string" },
          },
          amountSummary: { type: "string" },
          deadlineSummary: { type: "string" },
          geography: { type: "string" },
          status: { type: "string" },
          citations: {
            type: "array",
            minItems: 1,
            items: { type: "string" },
          },
          nextActions: {
            type: "array",
            minItems: 1,
            items: { type: "string" },
          },
        },
        required: [
          "title",
          "sponsor",
          "fundingType",
          "fitScore",
          "whyFit",
          "eligibilityNotes",
          "amountSummary",
          "deadlineSummary",
          "geography",
          "status",
          "citations",
          "nextActions",
        ],
      },
    },
    rejectedLeads: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          reason: { type: "string" },
          citations: {
            type: "array",
            minItems: 1,
            items: { type: "string" },
          },
        },
        required: ["title", "reason", "citations"],
      },
    },
    nextActions: {
      type: "array",
      minItems: 1,
      items: { type: "string" },
    },
  },
  required: [
    "businessCaseId",
    "executiveSummary",
    "searchSummary",
    "opportunities",
    "rejectedLeads",
    "nextActions",
  ],
} as const;

let openAIClient: OpenAI | null | undefined;
let openAIClientApiKey: string | null | undefined;

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

export interface FundingResearchSession {
  agent: Pick<Agent, "prompt" | "steer" | "subscribe">;
  brief: ResearchBrief;
  prompt: string;
  getReport: () => FundingReport | null;
  getReportOrThrow: () => FundingReport;
}

export type FundingResearchSessionEvent = AgentEvent;

interface SearchEvidence {
  query: string;
  domains: string[];
  results: SearchResult[];
}

function resolveProvider(provider?: string) {
  return (provider ?? process.env.PI_PROVIDER ?? "openai") as Parameters<typeof getModel>[0];
}

function resolveModel(provider?: string, model?: string) {
  const selectedProvider = resolveProvider(provider);
  const selectedModel = (model ?? process.env.PI_MODEL ?? "gpt-4o-mini") as never;
  return getModel(selectedProvider, selectedModel);
}

function resolveModelName(model?: string): string {
  return model ?? process.env.PI_MODEL ?? "gpt-4o-mini";
}

function getOpenAIClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY ?? null;
  if (!apiKey) {
    openAIClient = null;
    openAIClientApiKey = null;
    return null;
  }

  if (openAIClient && openAIClientApiKey === apiKey) {
    return openAIClient;
  }

  openAIClient = new OpenAI({ apiKey });
  openAIClientApiKey = apiKey;
  return openAIClient;
}

function buildSystemPrompt(): string {
  return [
    "You are a funding research specialist for small and mid-market business operators.",
    "You research grants, incentives, tax credits, subsidized loans, innovation pilots, cooperative agreements, procurement-like pilots, and adjacent non-dilutive capital paths.",
    "Research efficiently and prioritize the strongest evidence over exhaustive coverage.",
    `You have a limited research budget: at most ${SEARCH_CALL_BUDGET} search_web calls and ${READ_SOURCE_CALL_BUDGET} read_source_page calls.`,
    "You must use tools to search and read source pages before recommending an opportunity.",
    "Never invent deadlines, award amounts, or eligibility criteria.",
    "If information is uncertain, say so explicitly in the published report.",
    "Prefer authoritative sponsor pages and clearly labeled intermediaries over secondary summaries.",
    "Do not end with a plain-text answer.",
    "When your tool budget is exhausted, use the evidence you already gathered and publish_report.",
    "When you have at least one cited opportunity or adjacent funding path, call publish_report exactly once with the final structured report.",
  ].join(" ");
}

function buildResearchPrompt(scenario: BusinessScenario, brief: ResearchBrief): string {
  return [
    `Research the following business case: ${scenario.name}.`,
    "Goal: identify the strongest grants and adjacent funding sources worth pursuing in the next quarter.",
    "You may recommend non-grant sources when direct grants are weak, but you must say why they are relevant.",
    "Use search_web to find candidate programs and read_source_page to verify shortlisted opportunities.",
    "Do not publish an opportunity unless it has at least one citation URL.",
    "Focus on the best 1-4 opportunities instead of trying to cover every possible lead.",
    "Limit yourself to the smallest tool set that can support a credible report.",
    `You may use at most ${SEARCH_CALL_BUDGET} search_web calls and ${READ_SOURCE_CALL_BUDGET} read_source_page calls.`,
    "Your final response must be a publish_report tool call, not prose.",
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

function createSearchTool(maxCalls: number): AgentTool {
  let callCount = 0;

  return {
    name: "search_web",
    label: "Search Web",
    description:
      "Search the public web for active funding opportunities, sponsor pages, and intermediary program pages.",
    parameters: searchToolParameters,
    execute: async (_toolCallId, params, signal) => {
      const typedParams = params as SearchToolParameters;
      if (callCount >= maxCalls) {
        return {
          content: [
            {
              type: "text",
              text: "Search budget exhausted. Use the evidence you already gathered and call publish_report.",
            },
          ],
          details: { budgetReached: true, maxCalls },
        };
      }

      callCount += 1;
      const results = await searchWeb(typedParams.query, {
        domains: typedParams.domains,
        limit: Math.min(typedParams.limit ?? 3, 3),
        signal,
      });

      return {
        content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
        details: { query: typedParams.query, resultCount: results.length },
      };
    },
  };
}

function createReadSourceTool(maxCalls: number): AgentTool {
  let callCount = 0;

  return {
    name: "read_source_page",
    label: "Read Source Page",
    description: "Read a funding program source page and extract a compact text summary.",
    parameters: readSourceToolParameters,
    execute: async (_toolCallId, params, signal) => {
      const typedParams = params as ReadSourceToolParameters;
      if (callCount >= maxCalls) {
        return {
          content: [
            {
              type: "text",
              text: "Source-reading budget exhausted. Use the citations and notes you already have and call publish_report.",
            },
          ],
          details: { budgetReached: true, maxCalls },
        };
      }

      callCount += 1;
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

function dedupeSearchResults(results: SearchResult[]): SearchResult[] {
  const seenUrls = new Set<string>();
  const deduped: SearchResult[] = [];

  for (const result of results) {
    if (seenUrls.has(result.url)) {
      continue;
    }

    seenUrls.add(result.url);
    deduped.push(result);
  }

  return deduped;
}

async function collectFundingEvidence(brief: ResearchBrief): Promise<{
  searches: SearchEvidence[];
  pages: SourcePage[];
}> {
  const selectedTracks = brief.researchTracks.slice(0, DETERMINISTIC_TRACK_LIMIT);
  const searches = await Promise.all(
    selectedTracks.map(async (track) => {
      const query = track.queries[0] ?? track.goal;
      const domains = track.domains.slice(0, 4);
      const results = await searchWeb(query, {
        domains,
        limit: DETERMINISTIC_RESULTS_PER_TRACK,
      });

      return {
        query,
        domains,
        results,
      } satisfies SearchEvidence;
    }),
  );

  const pages: SourcePage[] = [];
  const candidateResults = dedupeSearchResults(searches.flatMap((search) => search.results)).slice(
    0,
    DETERMINISTIC_PAGE_LIMIT,
  );

  for (const result of candidateResults) {
    try {
      pages.push(
        await readWebPage(result.url, {
          maxChars: 5000,
        }),
      );
    } catch {
      pages.push({
        url: result.url,
        title: result.title,
        text: result.snippet,
        contentType: "text/plain",
      });
    }
  }

  return { searches, pages };
}

async function synthesizeFundingReport(
  options: FundingResearchRunOptions,
  brief: ResearchBrief,
  evidence: { searches: SearchEvidence[]; pages: SourcePage[] },
): Promise<FundingReport> {
  const client = getOpenAIClient();
  if (!client) {
    throw new Error("OpenAI API key is required for deterministic funding research runs.");
  }

  const response = await client.responses.create({
    model: resolveModelName(options.model),
    instructions: [
      "You create the final structured funding report for a grant research workflow.",
      "Use only the evidence provided in the input. Do not invent facts.",
      "Prefer sponsor pages and clearly explain uncertainty in eligibilityNotes when fit is imperfect.",
      "Adjacent funding paths are allowed when direct grants are weak, but every opportunity must include at least one citation URL from the evidence.",
      "Return 1-4 opportunities when credible evidence exists.",
    ].join(" "),
    input: JSON.stringify(
      {
        scenario: options.scenario,
        brief,
        evidence,
      },
      null,
      2,
    ),
    text: {
      format: {
        type: "json_schema",
        name: "funding_report",
        strict: true,
        schema: fundingReportFormatSchema,
      },
    },
  });

  return JSON.parse(response.output_text) as FundingReport;
}

export function createFundingResearchAgent(options: FundingResearchRunOptions): FundingResearchSession {
  const brief = buildResearchBrief(options.scenario);
  const reportCollector = createReportCollector();
  const tools = [
    createSearchTool(SEARCH_CALL_BUDGET),
    createReadSourceTool(READ_SOURCE_CALL_BUDGET),
    reportCollector.tool,
  ];

  const agent = new Agent({
    initialState: {
      systemPrompt: buildSystemPrompt(),
      model: resolveModel(options.provider, options.model),
      thinkingLevel: options.thinkingLevel ?? "low",
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
  const brief = buildResearchBrief(options.scenario);
  const provider = resolveProvider(options.provider);

  if (provider === "openai" && getOpenAIClient()) {
    const evidence = await collectFundingEvidence(brief);
    const report = await synthesizeFundingReport(options, brief, evidence);

    return {
      brief,
      report,
      messages: [],
    };
  }

  const session = createFundingResearchAgent(options);
  await session.agent.prompt(session.prompt);

  return {
    brief: session.brief,
    report: session.getReportOrThrow(),
    messages: [],
  };
}
