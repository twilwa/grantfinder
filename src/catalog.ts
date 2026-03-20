// ABOUTME: Provides a curated catalog of authoritative funding and incentive source domains.
// ABOUTME: The research brief uses these domains to keep live web search focused on credible sponsors.

import type { SourceCatalogEntry } from "./types.js";

export const sourceCatalog: SourceCatalogEntry[] = [
  {
    name: "Grants.gov",
    domain: "grants.gov",
    sponsorType: "Federal grant portal",
    tags: ["small-business", "automation", "logistics", "workforce-development", "critical-minerals"],
  },
  {
    name: "SBIR/STTR",
    domain: "sbir.gov",
    sponsorType: "Federal innovation funding",
    tags: ["artificial-intelligence", "automation", "forecasting", "logistics", "critical-minerals"],
  },
  {
    name: "Small Business Administration",
    domain: "sba.gov",
    sponsorType: "Small business finance and technical assistance",
    tags: ["small-business", "succession", "employee-ownership", "automation", "venture-formation"],
  },
  {
    name: "Economic Development Administration",
    domain: "eda.gov",
    sponsorType: "Regional economic development",
    tags: ["small-business", "supply-chain", "workforce-development", "critical-minerals", "venture-formation"],
  },
  {
    name: "Minority Business Development Agency",
    domain: "mbda.gov",
    sponsorType: "Business growth and commercialization support",
    tags: ["small-business", "venture-formation", "logistics", "workforce-development"],
  },
  {
    name: "Department of Labor",
    domain: "dol.gov",
    sponsorType: "Workforce and apprenticeship funding",
    tags: ["workforce-development", "automation", "small-business"],
  },
  {
    name: "Department of Transportation",
    domain: "transportation.gov",
    sponsorType: "Freight, logistics, and transportation programs",
    tags: ["logistics", "freight", "supply-chain", "fuel-costs"],
  },
  {
    name: "Department of Energy",
    domain: "energy.gov",
    sponsorType: "Energy transition and critical materials funding",
    tags: ["fuel-costs", "energy-transition", "critical-minerals", "rare-earth", "forecasting"],
  },
  {
    name: "Department of Commerce",
    domain: "commerce.gov",
    sponsorType: "Industrial competitiveness and supply-chain programs",
    tags: ["supply-chain", "critical-minerals", "rare-earth", "forecasting"],
  },
  {
    name: "CDFI Fund",
    domain: "cdfifund.gov",
    sponsorType: "Community finance and mission-driven capital",
    tags: ["succession", "venture-formation", "small-business", "workforce-development"],
  },
  {
    name: "USDA Rural Development",
    domain: "rd.usda.gov",
    sponsorType: "Rural business and energy support",
    tags: ["small-business", "energy-transition", "workforce-development", "logistics"],
  },
  {
    name: "Manufacturing Extension Partnership",
    domain: "nist.gov",
    sponsorType: "Operational modernization and adoption support",
    tags: ["automation", "artificial-intelligence", "process-mining", "supply-chain"],
  },
];

export function selectCatalogEntries(tags: string[]): SourceCatalogEntry[] {
  const tagSet = new Set(tags);
  return sourceCatalog.filter((entry) => entry.tags.some((tag) => tagSet.has(tag)));
}
