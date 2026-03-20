// ABOUTME: Builds deterministic funding research briefs from business-case fixtures.
// ABOUTME: The PI agent receives these briefs before live research so its search strategy is stable and testable.

import { selectCatalogEntries } from "./catalog.js";
import type { BusinessScenario, ResearchBrief, ResearchTrack } from "./types.js";

interface TrackTemplate {
  name: string;
  tags: string[];
  goal: string;
  sponsorTypes: string[];
  fundingTypes: string[];
  queryBuilders: Array<(scenario: BusinessScenario) => string>;
}

const trackTemplates: TrackTemplate[] = [
  {
    name: "succession",
    tags: ["succession", "employee-ownership"],
    goal: "Find funding and technical assistance for ownership transition, succession planning, and employee buyout pathways.",
    sponsorTypes: ["SBA", "state economic development", "CDFI", "employee ownership center"],
    fundingTypes: ["grant", "loan", "technical-assistance"],
    queryBuilders: [
      () => "small business succession planning grant employee ownership",
      () => "employee ownership transition technical assistance small business",
      (scenario) => `${scenario.name} owner retirement transition financing`,
    ],
  },
  {
    name: "workforce-development",
    tags: ["workforce-development", "automation"],
    goal: "Find workforce, apprenticeship, and upskilling funding tied to process change and automation adoption.",
    sponsorTypes: ["Department of Labor", "state workforce board", "regional intermediary"],
    fundingTypes: ["grant", "reimbursement"],
    queryBuilders: [
      () => "workforce development grant automation upskilling small business",
      () => "apprenticeship incumbent worker training grant automation",
      (scenario) => `${scenario.name} staff upskilling grant`,
    ],
  },
  {
    name: "automation-adoption",
    tags: ["automation", "process-mining", "artificial-intelligence"],
    goal: "Find modernization, digital adoption, and AI commercialization support that can underwrite the firm's automation work.",
    sponsorTypes: ["NIST MEP", "state innovation office", "federal innovation program"],
    fundingTypes: ["grant", "innovation-voucher", "pilot-funding"],
    queryBuilders: [
      () => "small business automation adoption grant ai digitalization",
      () => "process mining ai modernization voucher small business",
      (scenario) => `${scenario.name} AI automation grant`,
    ],
  },
  {
    name: "venture-formation",
    tags: ["venture-formation"],
    goal: "Find incubator, accelerator, founder-support, and spinout-friendly capital paths for staff ventures.",
    sponsorTypes: ["state innovation program", "EDA", "university incubator", "mission lender"],
    fundingTypes: ["grant", "pre-seed", "technical-assistance"],
    queryBuilders: [
      () => "employee venture studio grant small business spinout",
      () => "founder support grant worker startup program",
      (scenario) => `${scenario.name} staff venture funding`,
    ],
  },
  {
    name: "supply-chain-resilience",
    tags: ["logistics", "freight", "supply-chain", "forecasting"],
    goal: "Find programs that support freight efficiency, supply-chain resilience, and logistics intelligence.",
    sponsorTypes: ["DOT", "EDA", "Department of Commerce", "state freight office"],
    fundingTypes: ["grant", "contract", "pilot-funding"],
    queryBuilders: [
      () => "freight logistics analytics grant supply chain resilience",
      () => "supply chain resilience forecasting grant logistics",
      (scenario) => `${scenario.name} logistics forecasting pilot funding`,
    ],
  },
  {
    name: "fuel-and-energy",
    tags: ["fuel-costs", "energy-transition"],
    goal: "Find programs that underwrite fuel-efficiency planning, fleet energy transition, and related analytics adoption.",
    sponsorTypes: ["DOE", "state energy office", "utility", "DOT"],
    fundingTypes: ["grant", "tax-credit", "rebate", "pilot-funding"],
    queryBuilders: [
      () => "fleet fuel efficiency grant forecasting analytics",
      () => "energy transition freight analytics pilot grant",
      (scenario) => `${scenario.name} fuel cost forecasting incentive`,
    ],
  },
  {
    name: "critical-minerals",
    tags: ["critical-minerals", "rare-earth"],
    goal: "Find critical-minerals, industrial-policy, and domestic supply-chain programs where the niche focus improves fit.",
    sponsorTypes: ["DOE", "Department of Commerce", "Defense industrial base program"],
    fundingTypes: ["grant", "contract", "cooperative-agreement"],
    queryBuilders: [
      () => "critical minerals supply chain grant logistics analytics",
      () => "rare earth transport grant domestic supply chain",
      (scenario) => `${scenario.name} critical mineral supply chain funding`,
    ],
  },
  {
    name: "trade-and-tariff",
    tags: ["tariffs"],
    goal: "Find trade resilience, import/export assistance, and tariff mitigation programs tied to forecasting and planning tools.",
    sponsorTypes: ["Department of Commerce", "export assistance center", "state trade office"],
    fundingTypes: ["grant", "technical-assistance", "loan"],
    queryBuilders: [
      () => "tariff mitigation grant small business supply chain",
      () => "trade resilience funding logistics forecasting",
      (scenario) => `${scenario.name} tariff forecasting assistance`,
    ],
  },
];

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function inferEligibilityRisks(scenario: BusinessScenario): string[] {
  const risks = new Set<string>();
  const tags = new Set(scenario.tags);

  if (tags.has("automation") || tags.has("artificial-intelligence")) {
    risks.add("Many automation and AI programs prefer pilots, measurable adoption outcomes, or a productized offering rather than pure consulting services.");
  }
  if (tags.has("succession")) {
    risks.add("Succession programs often fund planning, employee ownership transition support, or mission-aligned debt rather than unrestricted acquisition capital.");
  }
  if (tags.has("critical-minerals") || tags.has("rare-earth")) {
    risks.add("Critical-minerals programs may require domestic supply-chain impact, consortium participation, or manufacturing relevance beyond software-only forecasting.");
  }
  if (tags.has("logistics")) {
    risks.add("Freight and logistics opportunities are frequently tied to public agencies, pilots, or operational partners instead of standalone software vendors.");
  }

  risks.add("State and local programs vary by geography, so active jurisdiction-specific verification is required before pursuit.");
  return [...risks];
}

function buildFundingHypotheses(scenario: BusinessScenario, tracks: ResearchTrack[]): string[] {
  const hypotheses = tracks.map(
    (track) =>
      `${scenario.name} is a fit for ${track.name} funding because it needs ${track.goal.toLowerCase()}`,
  );

  if (scenario.tags.includes("small-business")) {
    hypotheses.push("Adjacent small-business incentives, CDFI programs, and technical-assistance pathways may be easier to win than direct federal grants.");
  }

  return unique(hypotheses);
}

export function buildResearchBrief(scenario: BusinessScenario): ResearchBrief {
  const matchingTemplates = trackTemplates.filter((template) =>
    template.tags.some((tag) => scenario.tags.includes(tag)),
  );

  const selectedEntries = selectCatalogEntries([
    ...scenario.tags,
    ...matchingTemplates.flatMap((template) => template.tags),
  ]);

  const searchDomains = unique(selectedEntries.map((entry) => entry.domain));

  const researchTracks: ResearchTrack[] = matchingTemplates.map((template) => ({
    name: template.name,
    goal: template.goal,
    sponsorTypes: template.sponsorTypes,
    fundingTypes: template.fundingTypes,
    queries: unique(template.queryBuilders.map((builder) => builder(scenario))),
    domains: searchDomains,
  }));

  return {
    businessCaseId: scenario.id,
    fundingHypotheses: buildFundingHypotheses(scenario, researchTracks),
    priorityFundingTypes: unique(researchTracks.flatMap((track) => track.fundingTypes)),
    sponsorCategories: unique(researchTracks.flatMap((track) => track.sponsorTypes)),
    searchDomains,
    eligibilityRisks: inferEligibilityRisks(scenario),
    researchTracks,
  };
}
