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
const DETERMINISTIC_RESULTS_PER_TRACK = 4;
const DETERMINISTIC_PAGE_LIMIT = 6;
const MIN_RESEARCH_ROUNDS = 2;
const MAX_RESEARCH_ROUNDS = 4;
const SOURCE_DELTA_THRESHOLD = 2;
const OPPORTUNITY_DELTA_THRESHOLD = 2;
const MIN_HIGH_QUALITY_SOURCES = 3;
const HIGH_QUALITY_SOURCE_SCORE = 70;
const HIGH_CONFIDENCE_OPPORTUNITY_SCORE = 70;
const DEFAULT_TOP_OPPORTUNITY_COUNT = 5;

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

interface SearchQueryPlan {
  query: string;
  domains: string[];
  reason: string;
}

interface SearchOutcome {
  round: number;
  plan: SearchQueryPlan;
  results: SearchResult[];
}

interface SourceCandidate {
  round: number;
  query: string;
  domains: string[];
  title: string;
  url: string;
  snippet: string;
}

interface SourceEvidence {
  round: number;
  query: string;
  title: string;
  url: string;
  snippet: string;
  page: SourcePage;
  readSucceeded: boolean;
}

interface EvaluatedSource {
  url: string;
  title: string;
  sourceType: "official" | "administering_partner" | "intermediary" | "news" | "other";
  authorityScore: number;
  relevanceScore: number;
  noveltyScore: number;
  actionabilityScore: number;
  totalScore: number;
  keep: boolean;
  reason: string;
}

interface EvaluatedOpportunity extends FundingReport["opportunities"][number] {
  evidenceScore: number;
}

interface RoundEvaluation {
  summary: string;
  sources: EvaluatedSource[];
  opportunities: EvaluatedOpportunity[];
  rejectedLeads: FundingReport["rejectedLeads"];
  informationGaps: string[];
  recommendedQueries: SearchQueryPlan[];
  continueResearch: boolean;
}

interface ReportPlan {
  summary: string;
  selectedOpportunityTitles: string[];
  sourceCoverageScore: number;
  evidenceSufficient: boolean;
  missingEvidenceTopics: string[];
}

interface ReportReview {
  verdict: "approve" | "revise" | "research_more";
  summary: string;
  issues: string[];
  rerankedOpportunityTitles: string[];
  missingEvidenceTopics: string[];
}

interface ResearchCollectionState {
  searches: SearchOutcome[];
  sources: SourceEvidence[];
  evaluatedSources: EvaluatedSource[];
  evaluatedOpportunities: EvaluatedOpportunity[];
  rejectedLeads: FundingReport["rejectedLeads"];
  informationGaps: string[];
}

interface ResearchProgressObserver {
  onAgentStart?(): void;
  onTurnStart?(): void;
  onToolStart?(toolName: string, args: unknown): string;
  onToolEnd?(toolName: string, toolCallId: string, result: unknown, isError: boolean): void;
}

interface ResearchSteeringSource {
  consume(): string[];
}

interface StructuredResponseRequest<T> {
  model: string;
  name: string;
  schema: Record<string, unknown>;
  instructions: string;
  input: unknown;
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

const searchQueryPlanSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    summary: { type: "string" },
    queries: {
      type: "array",
      minItems: 1,
      maxItems: 6,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          query: { type: "string" },
          domains: {
            type: "array",
            items: { type: "string" },
          },
          reason: { type: "string" },
        },
        required: ["query", "domains", "reason"],
      },
    },
  },
  required: ["summary", "queries"],
} as const;

const evaluatedSourceSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    url: { type: "string" },
    title: { type: "string" },
    sourceType: {
      type: "string",
      enum: ["official", "administering_partner", "intermediary", "news", "other"],
    },
    authorityScore: { type: "number", minimum: 0, maximum: 100 },
    relevanceScore: { type: "number", minimum: 0, maximum: 100 },
    noveltyScore: { type: "number", minimum: 0, maximum: 100 },
    actionabilityScore: { type: "number", minimum: 0, maximum: 100 },
    totalScore: { type: "number", minimum: 0, maximum: 100 },
    keep: { type: "boolean" },
    reason: { type: "string" },
  },
  required: [
    "url",
    "title",
    "sourceType",
    "authorityScore",
    "relevanceScore",
    "noveltyScore",
    "actionabilityScore",
    "totalScore",
    "keep",
    "reason",
  ],
} as const;

const evaluatedOpportunitySchema = {
  ...fundingReportFormatSchema.properties.opportunities.items,
  additionalProperties: false,
  properties: {
    ...fundingReportFormatSchema.properties.opportunities.items.properties,
    evidenceScore: { type: "number", minimum: 0, maximum: 100 },
  },
  required: [...fundingReportFormatSchema.properties.opportunities.items.required, "evidenceScore"],
} as const;

const roundEvaluationSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    summary: { type: "string" },
    sources: {
      type: "array",
      items: evaluatedSourceSchema,
    },
    opportunities: {
      type: "array",
      items: evaluatedOpportunitySchema,
    },
    rejectedLeads: fundingReportFormatSchema.properties.rejectedLeads,
    informationGaps: {
      type: "array",
      items: { type: "string" },
    },
    recommendedQueries: {
      type: "array",
      items: searchQueryPlanSchema.properties.queries.items,
    },
    continueResearch: { type: "boolean" },
  },
  required: [
    "summary",
    "sources",
    "opportunities",
    "rejectedLeads",
    "informationGaps",
    "recommendedQueries",
    "continueResearch",
  ],
} as const;

const reportPlanSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    summary: { type: "string" },
    selectedOpportunityTitles: {
      type: "array",
      items: { type: "string" },
    },
    sourceCoverageScore: { type: "number", minimum: 0, maximum: 100 },
    evidenceSufficient: { type: "boolean" },
    missingEvidenceTopics: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: [
    "summary",
    "selectedOpportunityTitles",
    "sourceCoverageScore",
    "evidenceSufficient",
    "missingEvidenceTopics",
  ],
} as const;

const reportReviewSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    verdict: {
      type: "string",
      enum: ["approve", "revise", "research_more"],
    },
    summary: { type: "string" },
    issues: {
      type: "array",
      items: { type: "string" },
    },
    rerankedOpportunityTitles: {
      type: "array",
      items: { type: "string" },
    },
    missingEvidenceTopics: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: ["verdict", "summary", "issues", "rerankedOpportunityTitles", "missingEvidenceTopics"],
} as const;

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

function normalizeUrlHost(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function normalizeOpportunityKey(title: string, sponsor: string): string {
  return `${title}::${sponsor}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, " ")
    .trim();
}

function isPreferredHost(url: string, preferredHosts: string[]): boolean {
  const host = normalizeUrlHost(url);
  return preferredHosts.some((preferredHost) => host === preferredHost || host.endsWith(`.${preferredHost}`));
}

function scoreSourceCandidate(candidate: SourceCandidate, preferredHosts: string[], seenHosts: Set<string>): number {
  const combinedText = `${candidate.title} ${candidate.snippet}`.toLowerCase();
  let score = 0;

  if (isPreferredHost(candidate.url, preferredHosts)) {
    score += 28;
  }

  const host = normalizeUrlHost(candidate.url);
  if (host.endsWith(".gov")) {
    score += 26;
  } else if (host.endsWith(".edu")) {
    score += 12;
  } else if (host.endsWith(".org")) {
    score += 8;
  }

  if (!seenHosts.has(host)) {
    score += 8;
  }

  for (const keyword of [
    "grant",
    "funding",
    "program",
    "award",
    "application",
    "eligibility",
    "subsid",
    "voucher",
    "credit",
    "loan",
    "succession",
    "workforce",
    "automation",
    "innovation",
    "training",
  ]) {
    if (combinedText.includes(keyword)) {
      score += 4;
    }
  }

  if (candidate.url.includes("/grants") || candidate.url.includes("/funding") || candidate.url.includes("/program")) {
    score += 8;
  }

  return score;
}

function selectSourceCandidatesToRead(
  outcomes: SearchOutcome[],
  brief: ResearchBrief,
  priorSources: SourceEvidence[],
  limit: number,
): SourceCandidate[] {
  const seenUrls = new Set(priorSources.map((source) => source.url));
  const seenHosts = new Set(priorSources.map((source) => normalizeUrlHost(source.url)));
  const preferredHosts = brief.searchDomains.map((domain) => domain.toLowerCase());
  const candidates = dedupeSearchResults(outcomes.flatMap((outcome) => outcome.results))
    .map((result) => {
      const originatingOutcome = outcomes.find((outcome) => outcome.results.some((candidate) => candidate.url === result.url));
      return {
        round: originatingOutcome?.round ?? 1,
        query: originatingOutcome?.plan.query ?? "",
        domains: originatingOutcome?.plan.domains ?? [],
        title: result.title,
        url: result.url,
        snippet: result.snippet,
      } satisfies SourceCandidate;
    })
    .filter((candidate) => !seenUrls.has(candidate.url))
    .map((candidate) => ({
      candidate,
      score: scoreSourceCandidate(candidate, preferredHosts, seenHosts),
    }))
    .sort((left, right) => right.score - left.score);

  const selected: SourceCandidate[] = [];
  const selectedHosts = new Map<string, number>();

  for (const entry of candidates) {
    const host = normalizeUrlHost(entry.candidate.url);
    const hostCount = selectedHosts.get(host) ?? 0;
    if (hostCount >= 2) {
      continue;
    }

    selected.push(entry.candidate);
    selectedHosts.set(host, hostCount + 1);

    if (selected.length >= limit) {
      break;
    }
  }

  return selected;
}

async function createStructuredResponse<T>(
  client: OpenAI,
  request: StructuredResponseRequest<T>,
): Promise<T> {
  const response = await client.responses.create({
    model: request.model,
    instructions: request.instructions,
    input: JSON.stringify(request.input, null, 2),
    text: {
      format: {
        type: "json_schema",
        name: request.name,
        strict: true,
        schema: request.schema,
      },
    },
  });

  if (!response.output_text) {
    throw new Error(`The model did not return structured output for ${request.name}.`);
  }

  return JSON.parse(response.output_text) as T;
}

async function deriveSearchPlan(
  options: FundingResearchRunOptions,
  brief: ResearchBrief,
  state: ResearchCollectionState,
  steeringNotes: string[],
  round: number,
  forcedTopics: string[],
): Promise<SearchQueryPlan[]> {
  const client = getOpenAIClient();
  const fallbackQueries = brief.researchTracks
    .slice(0, DETERMINISTIC_TRACK_LIMIT)
    .flatMap((track) => track.queries.slice(0, 2).map((query) => ({ query, domains: track.domains.slice(0, 4), reason: track.goal })))
    .slice(0, 4);

  if (!client) {
    return fallbackQueries;
  }

  try {
    const plan = await createStructuredResponse<{
      summary: string;
      queries: SearchQueryPlan[];
    }>(client, {
      model: resolveModelName(options.model),
      name: "funding_search_query_plan",
      schema: searchQueryPlanSchema,
      instructions: [
        "You plan the next web-search fan-out for a funding research workflow.",
        "Prefer official sponsor pages, administering agencies, and primary program material.",
        "Use the current gaps and already-seen evidence to avoid redundant searches.",
        "Generate 3 to 6 diverse queries that can uncover new grant programs, incentives, or adjacent non-dilutive paths.",
        "If the business case is underspecified, keep the search broad instead of inventing constraints.",
      ].join(" "),
      input: {
        scenario: options.scenario,
        brief,
        round,
        forcedTopics,
        steeringNotes,
        priorQueries: state.searches.map((search) => search.plan.query),
        existingOpportunities: state.evaluatedOpportunities.map((opportunity) => ({
          title: opportunity.title,
          sponsor: opportunity.sponsor,
          evidenceScore: opportunity.evidenceScore,
        })),
        informationGaps: state.informationGaps,
      },
    });

    const plannedQueries = plan.queries
      .map((query) => ({
        query: query.query.trim(),
        domains: query.domains.slice(0, 4).map((domain) => domain.trim()).filter(Boolean),
        reason: query.reason.trim(),
      }))
      .filter((query) => query.query.length >= 3);

    return plannedQueries.length > 0 ? plannedQueries.slice(0, 6) : fallbackQueries;
  } catch {
    return fallbackQueries;
  }
}

async function reviewResearchRound(
  options: FundingResearchRunOptions,
  brief: ResearchBrief,
  state: ResearchCollectionState,
  outcomes: SearchOutcome[],
  roundSources: SourceEvidence[],
  steeringNotes: string[],
): Promise<RoundEvaluation> {
  const client = getOpenAIClient();
  if (!client) {
    throw new Error("OpenAI API key is required for deep research evaluation.");
  }

  return createStructuredResponse<RoundEvaluation>(client, {
    model: resolveModelName(options.model),
    name: "funding_research_round_review",
    schema: roundEvaluationSchema,
    instructions: [
      "You review a single round of funding research.",
      "Evaluate which sources are authoritative, relevant, novel, and actionable.",
      "Extract only source-backed grant programs or adjacent non-dilutive funding paths.",
      "Do not invent award amounts, deadlines, or eligibility; mark uncertainty explicitly in eligibilityNotes or summaries.",
      "Recommend additional queries only when they are likely to uncover meaningfully new evidence.",
      "Prefer official sponsor or administering pages over commentary and summaries.",
    ].join(" "),
    input: {
      scenario: options.scenario,
      brief,
      steeringNotes,
      roundSearches: outcomes,
      roundSources,
      priorAcceptedSources: state.evaluatedSources
        .filter((source) => source.keep && source.totalScore >= HIGH_QUALITY_SOURCE_SCORE)
        .map((source) => ({
          url: source.url,
          title: source.title,
          totalScore: source.totalScore,
        })),
      priorOpportunities: state.evaluatedOpportunities.map((opportunity) => ({
        title: opportunity.title,
        sponsor: opportunity.sponsor,
        evidenceScore: opportunity.evidenceScore,
        citations: opportunity.citations,
      })),
    },
  });
}

async function planFundingReport(
  options: FundingResearchRunOptions,
  brief: ResearchBrief,
  state: ResearchCollectionState,
  steeringNotes: string[],
  topOpportunityCount: number,
): Promise<ReportPlan> {
  const client = getOpenAIClient();
  if (!client) {
    throw new Error("OpenAI API key is required for funding report planning.");
  }

  return createStructuredResponse<ReportPlan>(client, {
    model: resolveModelName(options.model),
    name: "funding_report_plan",
    schema: reportPlanSchema,
    instructions: [
      "You decide whether the evidence base is strong enough to draft the final funding report.",
      "Use the source quality scores and evidence-backed opportunities to decide whether more collection is required.",
      "Only mark evidenceSufficient true when the report can confidently rank the top opportunities with citations.",
      `Target the top ${topOpportunityCount} opportunities unless the evidence supports fewer.`,
    ].join(" "),
    input: {
      scenario: options.scenario,
      brief,
      steeringNotes,
      highQualitySources: state.evaluatedSources.filter(
        (source) => source.keep && source.totalScore >= HIGH_QUALITY_SOURCE_SCORE,
      ),
      opportunities: state.evaluatedOpportunities.map((opportunity) => ({
        title: opportunity.title,
        sponsor: opportunity.sponsor,
        fitScore: opportunity.fitScore,
        evidenceScore: opportunity.evidenceScore,
        citations: opportunity.citations,
      })),
      rejectedLeads: state.rejectedLeads,
      informationGaps: state.informationGaps,
    },
  });
}

async function draftFundingReport(
  options: FundingResearchRunOptions,
  brief: ResearchBrief,
  state: ResearchCollectionState,
  steeringNotes: string[],
  topOpportunityCount: number,
): Promise<FundingReport> {
  const client = getOpenAIClient();
  if (!client) {
    throw new Error("OpenAI API key is required for funding report drafting.");
  }

  return createStructuredResponse<FundingReport>(client, {
    model: resolveModelName(options.model),
    name: "draft_funding_report",
    schema: fundingReportFormatSchema,
    instructions: [
      "You draft the funding report for a completed research workflow.",
      "Use only the supplied evidence and opportunities.",
      "Rank opportunities from strongest to weakest using fit, evidence quality, and practicality.",
      "Every opportunity must include at least one citation URL.",
      "Be explicit about uncertainty when eligibility, deadlines, or award amounts remain incomplete.",
      `Return between 1 and ${topOpportunityCount} opportunities.`,
    ].join(" "),
    input: {
      scenario: options.scenario,
      brief,
      steeringNotes,
      sources: state.evaluatedSources.filter((source) => source.keep),
      opportunities: state.evaluatedOpportunities,
      rejectedLeads: state.rejectedLeads,
      informationGaps: state.informationGaps,
    },
  });
}

async function reviewFundingReport(
  options: FundingResearchRunOptions,
  brief: ResearchBrief,
  state: ResearchCollectionState,
  draft: FundingReport,
): Promise<ReportReview> {
  const client = getOpenAIClient();
  if (!client) {
    throw new Error("OpenAI API key is required for funding report review.");
  }

  return createStructuredResponse<ReportReview>(client, {
    model: resolveModelName(options.model),
    name: "funding_report_review",
    schema: reportReviewSchema,
    instructions: [
      "You review a draft funding report for unsupported claims, weak citations, missing evidence, and ranking errors.",
      "Return research_more only when another collection round is necessary to produce a reliable report.",
      "Return revise when the current evidence is sufficient but the write-up or ordering needs work.",
      "Return approve when the draft is already strong enough to ship.",
    ].join(" "),
    input: {
      scenario: options.scenario,
      brief,
      draft,
      highQualitySources: state.evaluatedSources.filter(
        (source) => source.keep && source.totalScore >= HIGH_QUALITY_SOURCE_SCORE,
      ),
      opportunities: state.evaluatedOpportunities.map((opportunity) => ({
        title: opportunity.title,
        sponsor: opportunity.sponsor,
        fitScore: opportunity.fitScore,
        evidenceScore: opportunity.evidenceScore,
        citations: opportunity.citations,
      })),
      informationGaps: state.informationGaps,
    },
  });
}

async function finalizeFundingReport(
  options: FundingResearchRunOptions,
  brief: ResearchBrief,
  state: ResearchCollectionState,
  draft: FundingReport,
  review: ReportReview,
): Promise<FundingReport> {
  const client = getOpenAIClient();
  if (!client) {
    throw new Error("OpenAI API key is required for funding report finalization.");
  }

  return createStructuredResponse<FundingReport>(client, {
    model: resolveModelName(options.model),
    name: "final_funding_report",
    schema: fundingReportFormatSchema,
    instructions: [
      "You finalize a funding report after editorial review.",
      "Fix unsupported claims, tighten the writing, and rerank opportunities if the review indicates a better order.",
      "Use only the supplied draft, review notes, and research evidence.",
      "Keep every claim source-backed and preserve citations.",
    ].join(" "),
    input: {
      scenario: options.scenario,
      brief,
      draft,
      review,
      highQualitySources: state.evaluatedSources.filter((source) => source.keep),
      opportunities: state.evaluatedOpportunities,
    },
  });
}

function mergeEvaluatedSources(
  existing: EvaluatedSource[],
  incoming: EvaluatedSource[],
): { merged: EvaluatedSource[]; addedHighQuality: number } {
  const byUrl = new Map(existing.map((source) => [source.url, source]));
  let addedHighQuality = 0;

  for (const source of incoming) {
    const previous = byUrl.get(source.url);
    if (!previous || source.totalScore > previous.totalScore) {
      byUrl.set(source.url, source);
    }

    if (
      source.keep &&
      source.totalScore >= HIGH_QUALITY_SOURCE_SCORE &&
      (!previous || previous.totalScore < HIGH_QUALITY_SOURCE_SCORE || !previous.keep)
    ) {
      addedHighQuality += 1;
    }
  }

  return {
    merged: [...byUrl.values()].sort((left, right) => right.totalScore - left.totalScore),
    addedHighQuality,
  };
}

function mergeEvaluatedOpportunities(
  existing: EvaluatedOpportunity[],
  incoming: EvaluatedOpportunity[],
): { merged: EvaluatedOpportunity[]; addedHighConfidence: number } {
  const byKey = new Map(existing.map((opportunity) => [normalizeOpportunityKey(opportunity.title, opportunity.sponsor), opportunity]));
  let addedHighConfidence = 0;

  for (const opportunity of incoming) {
    const key = normalizeOpportunityKey(opportunity.title, opportunity.sponsor);
    const previous = byKey.get(key);
    if (!previous || opportunity.evidenceScore > previous.evidenceScore) {
      byKey.set(key, opportunity);
    }

    if (
      opportunity.evidenceScore >= HIGH_CONFIDENCE_OPPORTUNITY_SCORE &&
      (!previous || previous.evidenceScore < HIGH_CONFIDENCE_OPPORTUNITY_SCORE)
    ) {
      addedHighConfidence += 1;
    }
  }

  return {
    merged: [...byKey.values()].sort(
      (left, right) => right.evidenceScore - left.evidenceScore || right.fitScore - left.fitScore,
    ),
    addedHighConfidence,
  };
}

function mergeRejectedLeads(
  existing: FundingReport["rejectedLeads"],
  incoming: FundingReport["rejectedLeads"],
): FundingReport["rejectedLeads"] {
  const byKey = new Map(existing.map((lead) => [normalizeOpportunityKey(lead.title, lead.reason), lead]));
  for (const lead of incoming) {
    byKey.set(normalizeOpportunityKey(lead.title, lead.reason), lead);
  }
  return [...byKey.values()];
}

function extractSteeringText(message: AgentMessage): string {
  return message.content
    .filter((entry): entry is { type: "text"; text: string } => entry.type === "text" && typeof entry.text === "string")
    .map((entry) => entry.text.trim())
    .filter(Boolean)
    .join("\n\n");
}

function createResultPayload(text: string) {
  return {
    content: [{ type: "text", text }],
  };
}

async function runObservedTool<T>(
  observer: ResearchProgressObserver | undefined,
  toolName: string,
  args: unknown,
  work: () => Promise<T>,
  summarize: (result: T) => string,
): Promise<T> {
  const toolCallId = observer?.onToolStart?.(toolName, args) ?? crypto.randomUUID();

  try {
    const result = await work();
    observer?.onToolEnd?.(toolName, toolCallId, createResultPayload(summarize(result)), false);
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "The tool execution failed.";
    observer?.onToolEnd?.(toolName, toolCallId, createResultPayload(message), true);
    throw error;
  }
}

async function collectResearchRound(
  options: FundingResearchRunOptions,
  brief: ResearchBrief,
  state: ResearchCollectionState,
  round: number,
  steeringNotes: string[],
  observer: ResearchProgressObserver | undefined,
  forcedTopics: string[],
): Promise<{ nextState: ResearchCollectionState; addedHighQualitySources: number; addedHighConfidenceOpportunities: number }> {
  const queryPlans = await runObservedTool(
    observer,
    "plan_research_round",
    { round, forcedTopics, steeringNotes },
    () => deriveSearchPlan(options, brief, state, steeringNotes, round, forcedTopics),
    (result) => `Prepared ${result.length} search queries for round ${round}.`,
  );

  const outcomes = await Promise.all(
    queryPlans.map(async (plan) => {
      const results = await runObservedTool(
        observer,
        "search_web",
        { query: plan.query, domains: plan.domains, limit: DETERMINISTIC_RESULTS_PER_TRACK },
        () =>
          searchWeb(plan.query, {
            domains: plan.domains,
            limit: DETERMINISTIC_RESULTS_PER_TRACK,
          }),
        (result) => `Found ${result.length} search results for ${plan.query}.`,
      );

      return {
        round,
        plan,
        results,
      } satisfies SearchOutcome;
    }),
  );

  const selectedSources = selectSourceCandidatesToRead(outcomes, brief, state.sources, DETERMINISTIC_PAGE_LIMIT);
  const readSources = await Promise.all(
    selectedSources.map(async (candidate) => {
      const page = await runObservedTool(
        observer,
        "read_source_page",
        { url: candidate.url, maxChars: 6000 },
        async () => {
          try {
            const readPage = await readWebPage(candidate.url, { maxChars: 6000 });
            return { page: readPage, readSucceeded: true };
          } catch {
            return {
              page: {
                url: candidate.url,
                title: candidate.title,
                text: candidate.snippet,
                contentType: "text/plain",
              },
              readSucceeded: false,
            };
          }
        },
        (result) => (result.readSucceeded ? `Read ${result.page.url}` : `Used fallback snippet for ${result.page.url}`),
      );

      return {
        round,
        query: candidate.query,
        title: candidate.title,
        url: candidate.url,
        snippet: candidate.snippet,
        page: page.page,
        readSucceeded: page.readSucceeded,
      } satisfies SourceEvidence;
    }),
  );

  const evaluation = await runObservedTool(
    observer,
    "review_research_round",
    {
      round,
      searches: outcomes.length,
      sources: readSources.length,
    },
    () => reviewResearchRound(options, brief, state, outcomes, readSources, steeringNotes),
    (result) => `Reviewed ${result.sources.length} sources and ${result.opportunities.length} opportunities.`,
  );

  const mergedSources = mergeEvaluatedSources(state.evaluatedSources, evaluation.sources);
  const mergedOpportunities = mergeEvaluatedOpportunities(state.evaluatedOpportunities, evaluation.opportunities);

  return {
    nextState: {
      searches: [...state.searches, ...outcomes],
      sources: [...state.sources, ...readSources],
      evaluatedSources: mergedSources.merged,
      evaluatedOpportunities: mergedOpportunities.merged,
      rejectedLeads: mergeRejectedLeads(state.rejectedLeads, evaluation.rejectedLeads),
      informationGaps: evaluation.informationGaps,
    },
    addedHighQualitySources: mergedSources.addedHighQuality,
    addedHighConfidenceOpportunities: mergedOpportunities.addedHighConfidence,
  };
}

async function collectIterativeResearch(
  options: FundingResearchRunOptions,
  brief: ResearchBrief,
  observer: ResearchProgressObserver | undefined,
  steeringSource: ResearchSteeringSource | undefined,
): Promise<ResearchCollectionState> {
  let state: ResearchCollectionState = {
    searches: [],
    sources: [],
    evaluatedSources: [],
    evaluatedOpportunities: [],
    rejectedLeads: [],
    informationGaps: [],
  };
  let forcedTopics: string[] = [];

  for (let round = 1; round <= MAX_RESEARCH_ROUNDS; round += 1) {
    observer?.onTurnStart?.();
    const steeringNotes = steeringSource?.consume() ?? [];
    const roundResult = await collectResearchRound(options, brief, state, round, steeringNotes, observer, forcedTopics);
    state = roundResult.nextState;
    forcedTopics = state.informationGaps.slice(0, 4);

    const highQualitySourceCount = state.evaluatedSources.filter(
      (source) => source.keep && source.totalScore >= HIGH_QUALITY_SOURCE_SCORE,
    ).length;
    const shouldContinue =
      round < MIN_RESEARCH_ROUNDS ||
      highQualitySourceCount < MIN_HIGH_QUALITY_SOURCES ||
      roundResult.addedHighQualitySources >= SOURCE_DELTA_THRESHOLD ||
      roundResult.addedHighConfidenceOpportunities >= OPPORTUNITY_DELTA_THRESHOLD;

    if (!shouldContinue) {
      break;
    }
  }

  return state;
}

async function buildFundingReportFromState(
  options: FundingResearchRunOptions,
  brief: ResearchBrief,
  state: ResearchCollectionState,
  observer: ResearchProgressObserver | undefined,
  steeringSource: ResearchSteeringSource | undefined,
): Promise<FundingReport> {
  const topOpportunityCount = Math.max(1, options.topN ?? DEFAULT_TOP_OPPORTUNITY_COUNT);
  let workingState = state;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    observer?.onTurnStart?.();
    const steeringNotes = steeringSource?.consume() ?? [];
    const plan = await runObservedTool(
      observer,
      "plan_report",
      { topOpportunityCount, steeringNotes },
      () => planFundingReport(options, brief, workingState, steeringNotes, topOpportunityCount),
      (result) => result.summary,
    );

    if (!plan.evidenceSufficient && attempt === 0 && plan.missingEvidenceTopics.length > 0) {
      const expandedState = await collectResearchRound(
        options,
        brief,
        workingState,
        MAX_RESEARCH_ROUNDS + attempt + 1,
        steeringNotes,
        observer,
        plan.missingEvidenceTopics.slice(0, 4),
      );
      workingState = expandedState.nextState;
    }

    const draft = await runObservedTool(
      observer,
      "draft_report",
      { topOpportunityCount },
      () => draftFundingReport(options, brief, workingState, steeringNotes, topOpportunityCount),
      (result) => `Drafted report with ${result.opportunities.length} ranked opportunities.`,
    );

    const review = await runObservedTool(
      observer,
      "review_report",
      { opportunityCount: draft.opportunities.length },
      () => reviewFundingReport(options, brief, workingState, draft),
      (result) => result.summary,
    );

    if (review.verdict === "research_more" && attempt === 0 && review.missingEvidenceTopics.length > 0) {
      const expandedState = await collectResearchRound(
        options,
        brief,
        workingState,
        MAX_RESEARCH_ROUNDS + attempt + 2,
        steeringNotes,
        observer,
        review.missingEvidenceTopics.slice(0, 4),
      );
      workingState = expandedState.nextState;
      continue;
    }

    if (review.verdict === "approve") {
      return draft;
    }

    return runObservedTool(
      observer,
      "rerank_report",
      { verdict: review.verdict, issues: review.issues },
      () => finalizeFundingReport(options, brief, workingState, draft, review),
      (result) => `Finalized report with ${result.opportunities.length} ranked opportunities.`,
    );
  }

  throw new Error("The funding report could not be finalized after iterative review.");
}

async function runDeepFundingResearch(
  options: FundingResearchRunOptions,
  observer?: ResearchProgressObserver,
  steeringSource?: ResearchSteeringSource,
): Promise<FundingResearchResult> {
  const client = getOpenAIClient();
  if (!client) {
    throw new Error("OpenAI API key is required for deterministic funding research runs.");
  }

  observer?.onAgentStart?.();
  const brief = buildResearchBrief(options.scenario);
  const state = await collectIterativeResearch(options, brief, observer, steeringSource);
  const report = await buildFundingReportFromState(options, brief, state, observer, steeringSource);

  return {
    brief,
    report,
    messages: [],
  };
}

function createDeterministicFundingResearchSession(options: FundingResearchRunOptions): FundingResearchSession {
  const listeners = new Set<(event: AgentEvent) => void>();
  const steeringNotes: string[] = [];
  const brief = buildResearchBrief(options.scenario);
  let report: FundingReport | null = null;
  let toolCounter = 0;

  const emit = (event: AgentEvent) => {
    for (const listener of listeners) {
      listener(event);
    }
  };

  const observer: ResearchProgressObserver = {
    onAgentStart() {
      emit({ type: "agent_start" } as AgentEvent);
    },
    onTurnStart() {
      emit({ type: "turn_start" } as AgentEvent);
    },
    onToolStart(toolName, args) {
      const toolCallId = `deterministic_${toolCounter += 1}`;
      emit({
        type: "tool_execution_start",
        toolName,
        toolCallId,
        args,
      } as AgentEvent);
      return toolCallId;
    },
    onToolEnd(toolName, toolCallId, result, isError) {
      emit({
        type: "tool_execution_end",
        toolName,
        toolCallId,
        result,
        isError,
      } as AgentEvent);
    },
  };

  const steeringSource: ResearchSteeringSource = {
    consume() {
      const pending = [...steeringNotes];
      steeringNotes.length = 0;
      return pending;
    },
  };

  const subscribe: Agent["subscribe"] = (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };

  const steer: Agent["steer"] = (message) => {
    const text = extractSteeringText(message);
    if (text) {
      steeringNotes.push(text);
    }
  };

  const prompt: Agent["prompt"] = async () => {
    const result = await runDeepFundingResearch(options, observer, steeringSource);
    report = result.report;
    return [];
  };

  return {
    agent: {
      prompt,
      steer,
      subscribe,
    },
    brief,
    prompt: buildResearchPrompt(options.scenario, brief),
    getReport: () => report,
    getReportOrThrow: () => {
      if (!report) {
        throw new Error("Deep research completed without a final funding report.");
      }
      return report;
    },
  };
}

export function createFundingResearchAgent(options: FundingResearchRunOptions): FundingResearchSession {
  if (resolveProvider(options.provider) === "openai" && getOpenAIClient()) {
    return createDeterministicFundingResearchSession(options);
  }

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
  const provider = resolveProvider(options.provider);

  if (provider === "openai" && getOpenAIClient()) {
    return runDeepFundingResearch(options);
  }

  const session = createFundingResearchAgent(options);
  await session.agent.prompt(session.prompt);

  return {
    brief: session.brief,
    report: session.getReportOrThrow(),
    messages: [],
  };
}
