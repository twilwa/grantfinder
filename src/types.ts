// ABOUTME: Defines the core business-case and research-brief types for grant discovery.
// ABOUTME: These types keep the deterministic planning layer separate from the PI runtime.

export interface BusinessScenario {
  id: string;
  name: string;
  summary: string;
  geography: string;
  businessModel: string;
  customers: string[];
  needs: string[];
  tags: string[];
}

export interface SourceCatalogEntry {
  name: string;
  domain: string;
  sponsorType: string;
  tags: string[];
}

export interface ResearchTrack {
  name: string;
  goal: string;
  sponsorTypes: string[];
  fundingTypes: string[];
  queries: string[];
  domains: string[];
}

export interface ResearchBrief {
  businessCaseId: string;
  fundingHypotheses: string[];
  priorityFundingTypes: string[];
  sponsorCategories: string[];
  searchDomains: string[];
  eligibilityRisks: string[];
  researchTracks: ResearchTrack[];
}

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export interface SourcePage {
  url: string;
  title: string;
  text: string;
  contentType: string;
}
