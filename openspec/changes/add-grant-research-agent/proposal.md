## Why

This repository currently contains bootstrap and workflow scaffolding but no domain application. We need a first working artifact: a PI-based research agent that can investigate grants and adjacent funding sources for real business cases and produce source-backed recommendations.

## What Changes

- Add a PI agent runtime that performs iterative funding research with tool calling.
- Add web research tools for searching funding opportunities and reading source pages.
- Add a domain prompt and output contract tuned for grant research, non-dilutive funding, incentives, and adjacent capital sources.
- Add runnable fixtures for two target scenarios:
  - an "inverse private equity" services firm focused on process mining, AI automation, owner retirement, and staff venture formation
  - a logistics cost-forecasting business, including a rare-earth transport niche, focused on tariff and fuel forecasting
- Add tests for fixture handling, opportunity ranking, and source-backed report generation behavior.

## Capabilities

### New Capabilities
- `funding-opportunity-research`: Research and rank grants, incentives, and adjacent funding options for a business case, with explicit fit reasoning, source citations, and next-step guidance.

### Modified Capabilities
- None.

## Impact

- New TypeScript/Bun application code for the PI agent and research tools
- New tests and scenario fixtures
- New runtime dependencies for the PI framework and HTML/content extraction
- New documentation for running the agent locally with model provider credentials
