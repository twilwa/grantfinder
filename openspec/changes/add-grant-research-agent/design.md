## Context

The repository currently provides process scaffolding but no application code. This change introduces the first domain feature: a PI-based research agent that can investigate grants, incentives, and adjacent funding options for a business case, then return a source-backed report for operators deciding where to spend business-development time.

The two initial target cases are deliberately hard:
- an "inverse private equity" services firm whose owner wants to retire and wants process mining, AI automation, and staff venture formation support
- a logistics forecasting business focused on quarterly tariff and fuel-cost forecasting, including a potential rare-earth transport niche

Both cases require more than keyword matching. The agent needs deterministic domain framing, live research tools, and a structured output contract.

## Goals / Non-Goals

**Goals:**
- Build a runnable PI agent using `@mariozechner/pi-agent-core` and `@mariozechner/pi-ai`.
- Give the agent live research tools for web search and source-page retrieval.
- Add deterministic case briefing so the agent starts with relevant funding hypotheses, search tracks, and authoritative source categories.
- Capture the final answer as a structured report with citations, fit reasoning, and next steps.
- Add tests that validate the deterministic parts of the workflow and the two target scenarios.

**Non-Goals:**
- Build a full web UI or long-lived backend service.
- Automate grant application drafting or submission.
- Guarantee comprehensive coverage of every state and local funding program.
- Introduce paid search APIs or external credentials beyond model-provider credentials.

## Decisions

### Use the PI `Agent` class instead of a raw loop

The implementation will use the `Agent` class from `@mariozechner/pi-agent-core` rather than the lower-level `agentLoop()` API.

Rationale:
- The `Agent` class provides stateful turns, tool execution, and a clear event model out of the box.
- It keeps the implementation closer to the framework’s supported abstraction.
- It gives a clean path to future terminal or web interfaces without redesigning the agent loop.

Alternative considered:
- Use `agentLoop()` directly for finer control. Rejected because the repository needs a working, maintainable first application, not a custom runtime.

### Combine deterministic case briefing with live web research

The agent will not start from only the raw business description. It will first receive a deterministic case brief derived from the scenario, including:
- funding theses
- search tracks
- relevant sponsor categories
- business risks and likely eligibility constraints
- query seeds and source categories

Rationale:
- Raw search alone is too noisy for niche business funding research.
- The deterministic brief makes the agent more stable and improves testability.
- It allows the two initial scenarios to encode domain knowledge without hardcoding final answers.

Alternative considered:
- Let the model infer all search strategy from scratch. Rejected because it weakens reproducibility and makes useful testing difficult.

### Force structured completion through a `publish_report` tool

The final report will be captured through a dedicated tool call with a validated schema instead of relying on prose parsing.

Rationale:
- Structured output is easier to test and safer to consume in later workflows.
- It reduces ambiguity around citations, scores, deadlines, and next actions.
- It preserves the agentic workflow while giving the controller a deterministic artifact.

Alternative considered:
- Parse markdown or plain text after the run. Rejected because it is brittle and encourages format drift.

### Start with a single Bun/TypeScript CLI package

The application will be a small TypeScript/Bun project with:
- a CLI entrypoint
- scenario fixtures
- deterministic briefing helpers
- PI agent assembly
- tests for fixture and report logic

Rationale:
- This is the smallest usable footprint for the repo’s first application.
- Bun fits the repo’s JavaScript preference and keeps setup minimal.
- A CLI is enough to validate the agent before any UI or service layer exists.

Alternative considered:
- Build a web app immediately. Rejected as unnecessary for the first slice.

### Use public web search and page extraction first

The first version will use public, no-key research tooling:
- a lightweight web-search integration
- page fetching and text extraction
- a curated source catalog of authoritative funding domains and sponsor types

Rationale:
- The repo has no established paid search provider.
- The user asked for an agent, not provider procurement.
- A source catalog plus search tool is good enough for a first working version.

Alternative considered:
- Depend on a paid search API or vendor-specific MCP from day one. Rejected because it increases setup cost and blocks basic usage.

## Risks / Trade-offs

- Public search results can be noisy or change format unexpectedly. → Mitigation: seed the agent with authoritative source categories and validate that every reported opportunity includes source URLs.
- Many business funding paths are not literal grants. → Mitigation: the agent will explicitly research grants, incentives, tax credits, subsidized loans, innovation programs, and adjacent non-dilutive funding rather than only literal grants.
- Model providers and credentials vary across environments. → Mitigation: provider and model selection will be environment-driven, and deterministic tests will not require live model access.
- Some opportunities may be geographically constrained or not currently open. → Mitigation: require the report to call out eligibility uncertainty, deadlines, and verification status.

## Migration Plan

1. Add the Bun/TypeScript project files and PI dependencies.
2. Add scenario fixtures and deterministic case-brief generation.
3. Add search, source-page, and report-publication tools.
4. Assemble the PI agent and CLI runner.
5. Add unit tests and an optional live integration path.
6. Document local usage and required environment variables.

Rollback is straightforward because the change is additive and isolated to new application files.

## Open Questions

- Which provider/model should become the recommended default once real usage data exists?
- Whether the next iteration should add jurisdiction filters for state-by-state funding discovery.
- Whether a future version should persist prior research sessions or opportunity snapshots for longitudinal tracking.
