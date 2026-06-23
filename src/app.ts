// ABOUTME: Builds the Hono application for browser, REST, JSON-RPC, and x402 funding workflows.
// ABOUTME: The same application shell serves human-facing pages and agent-friendly HTTP interfaces.

import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { paymentMiddleware, x402ResourceServer } from "@x402/hono";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";

import { PrivyAuthProvider, type BrowserAuthProvider } from "./auth.js";
import {
  ApplicationServices,
  AppError,
  type FundingResearchRunner,
  type FundingResearchSessionFactory,
  type RepositoryBindingInput,
} from "./services.js";
import { ApplicationStore, type ApplicationStoreOptions } from "./store.js";
import type { BrowserClientConfig, FundingChallenge, X402Settings } from "./platform-types.js";
import type { RepositoryPublicationAdapter } from "./repository-publication.js";

export interface AppOptions extends ApplicationStoreOptions {
  authProvider?: BrowserAuthProvider;
  researchRunner?: FundingResearchRunner;
  researchSessionFactory?: FundingResearchSessionFactory | null;
  publicationAdapter?: RepositoryPublicationAdapter | null;
  x402?: Partial<X402Settings>;
}

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

const clientBundlePath = fileURLToPath(new URL("../dist/public/client.js", import.meta.url));
let clientBundlePromise: Promise<void> | null = null;

function resolveX402Settings(override: Partial<X402Settings> | undefined): X402Settings {
  const envMode = process.env.X402_MODE;
  const mode = override?.mode ?? (envMode === "live" ? "live" : "challenge");
  const network =
    override?.network ??
    ((process.env.X402_NETWORK as `${string}:${string}` | undefined) ?? "eip155:84532");
  return {
    mode,
    facilitatorUrl:
      override?.facilitatorUrl ?? process.env.X402_FACILITATOR_URL ?? "https://x402.org/facilitator",
    network,
    payTo:
      override?.payTo ??
      process.env.X402_PAY_TO ??
      "0x0000000000000000000000000000000000000000",
  };
}

function resolveAuthProvider(override: BrowserAuthProvider | undefined): BrowserAuthProvider | undefined {
  if (override) {
    return override;
  }

  const appId = process.env.PRIVY_APP_ID;
  const appSecret = process.env.PRIVY_APP_SECRET;
  if (!appId || !appSecret) {
    return undefined;
  }

  return new PrivyAuthProvider({
    appId,
    appSecret,
    jwtVerificationKey: process.env.PRIVY_JWT_VERIFICATION_KEY,
  });
}

function parseAuthorizationHeader(header: string | undefined): string | null {
  if (!header) {
    return null;
  }

  const [scheme, token] = header.split(/\s+/u);
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  return token;
}

function parseRepositoryBindingInput(value: unknown): RepositoryBindingInput | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value !== "object") {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  return {
    repositoryUrl: String(record.repositoryUrl ?? ""),
    baseBranch: String(record.baseBranch ?? ""),
    rootPath:
      record.rootPath === undefined
        ? undefined
        : record.rootPath === null
          ? null
          : String(record.rootPath),
    privyGitHubAccountId:
      record.privyGitHubAccountId === undefined
        ? undefined
        : record.privyGitHubAccountId === null
          ? null
          : String(record.privyGitHubAccountId),
    providerConnectionId: String(record.providerConnectionId ?? ""),
  };
}

function extractFundingEngagementId(path: string): string {
  const match = path.match(/^\/api\/engagements\/([^/]+)\/fund$/u);
  if (!match) {
    throw new AppError(400, "invalid_path", "The funding route path is not valid.");
  }

  return match[1];
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeInlineScriptJson(value: unknown): string {
  return JSON.stringify(value)
    .replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e")
    .replaceAll("&", "\\u0026")
    .replaceAll("\u2028", "\\u2028")
    .replaceAll("\u2029", "\\u2029");
}

function pageShell(title: string, body: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(title)}</title>
    <style>
      :root {
        --bg: #f5f1e8;
        --panel: rgba(255, 252, 247, 0.92);
        --ink: #1f2a1f;
        --muted: #566154;
        --line: #d8ccb8;
        --accent: #24543a;
        --accent-soft: #d7e5d8;
        --warning: #8c5b1f;
        --warning-soft: #f4e1c8;
        --error: #8f2d1f;
        --error-soft: #f4d6d1;
        --success: #1f5b38;
        --success-soft: #d6e7db;
      }

      * { box-sizing: border-box; }
      body {
        margin: 0;
        color: var(--ink);
        background:
          radial-gradient(circle at top left, rgba(36, 84, 58, 0.14), transparent 34%),
          radial-gradient(circle at top right, rgba(140, 91, 31, 0.14), transparent 28%),
          linear-gradient(180deg, #f8f4ec 0%, var(--bg) 100%);
        font-family: "Iowan Old Style", "Palatino Linotype", "Book Antiqua", Palatino, serif;
      }

      a { color: var(--accent); }
      code, pre {
        font-family: "SFMono-Regular", "SF Mono", Consolas, "Liberation Mono", Menlo, monospace;
      }

      .page {
        width: min(1180px, calc(100vw - 2rem));
        margin: 0 auto;
        padding: 2rem 0 4rem;
      }

      .panel {
        background: var(--panel);
        backdrop-filter: blur(14px);
        border: 1px solid rgba(255, 255, 255, 0.52);
        border-radius: 20px;
        box-shadow: 0 20px 45px rgba(50, 45, 30, 0.08);
        overflow: hidden;
      }

      .hero {
        padding: 2rem;
        border-bottom: 1px solid rgba(255,255,255,0.45);
      }

      .eyebrow {
        letter-spacing: 0.12em;
        text-transform: uppercase;
        font-size: 0.78rem;
        color: var(--muted);
      }

      h1, h2, h3 {
        margin: 0 0 0.75rem;
        line-height: 1.08;
      }

      h1 { font-size: clamp(2.2rem, 4vw, 4rem); max-width: 13ch; }
      h2 { font-size: 1.5rem; }
      p { margin: 0 0 1rem; line-height: 1.55; }

      .lede {
        max-width: 58ch;
        color: var(--muted);
        font-size: 1.05rem;
      }

      .section {
        padding: 1.35rem;
        border-top: 1px solid var(--line);
      }

      .section:first-child {
        border-top: 0;
      }

      .nav {
        display: flex;
        gap: 0.75rem;
        flex-wrap: wrap;
        margin: 1rem 0 0;
      }

      .nav a {
        text-decoration: none;
        padding: 0.45rem 0.75rem;
        border-radius: 999px;
        background: rgba(255,255,255,0.65);
        border: 1px solid rgba(216, 204, 184, 0.95);
      }

      .grid {
        display: grid;
        gap: 1rem;
      }

      .grid.panels {
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        margin-top: 1rem;
      }

      pre {
        margin: 0;
        padding: 0.95rem;
        background: rgba(31, 42, 31, 0.92);
        color: #f3f0e8;
        border-radius: 16px;
        overflow: auto;
      }

      ol, ul {
        margin: 0;
        padding-left: 1.2rem;
      }

      @media (max-width: 720px) {
        .page {
          width: min(100vw, calc(100vw - 1rem));
        }

        .hero,
        .section {
          padding: 1.2rem;
        }
      }
    </style>
  </head>
  <body>
    <main class="page">
      ${body}
    </main>
  </body>
</html>`;
}

function renderAppShell(config: BrowserClientConfig, title = "Grantfinder"): string {
  const serializedConfig = escapeInlineScriptJson(config);

  return pageShell(
    title,
    `<section class="panel hero">
        <div class="eyebrow">Grantfinder Marketplace</div>
        <h1>Research grants, hire a specialist, fund the work over x402.</h1>
        <p class="lede">
          Humans sign in with Privy, receive embedded and smart wallets, and can mint agent tokens for curl or JSON-RPC workflows.
          The browser dashboard and the HTTP interfaces stay aligned on the same marketplace logic.
        </p>
        <nav class="nav" aria-label="Primary">
          <a href="/">Dashboard</a>
          <a href="/demo">Design Demo</a>
          <a href="/docs">Docs</a>
          <a href="/skill.md">skill.md</a>
        </nav>
      </section>
      <section class="panel section">
        <div id="app"></div>
      </section>
      <script>window.__GRANTFINDER_CONFIG__ = ${serializedConfig};</script>
      <script type="module" src="/assets/client.js"></script>`,
  );
}

function renderDesignDemoShell(config: BrowserClientConfig): string {
  const serializedConfig = escapeInlineScriptJson(config);

  return pageShell(
    "Grantfinder Design Demo",
    `<section class="panel section">
        <nav class="nav" aria-label="Primary" style="margin: 0 0 1rem;">
          <a href="/">Dashboard</a>
          <a href="/demo">Design Demo</a>
          <a href="/docs">Docs</a>
          <a href="/skill.md">skill.md</a>
        </nav>
        <div id="app"></div>
      </section>
      <script>window.__GRANTFINDER_CONFIG__ = ${serializedConfig};</script>
      <script type="module" src="/assets/client.js"></script>`,
  );
}

function renderDocsPage(baseUrl: string, x402: X402Settings, clientConfig: BrowserClientConfig): string {
  return pageShell(
    "Grantfinder Docs",
    `<section class="panel hero">
        <div class="eyebrow">HTTP Documentation</div>
        <h1>Grantfinder docs</h1>
        <p class="lede">
          Browser users authenticate with Privy. Headless clients should mint an agent token and then use it as a bearer token over REST or JSON-RPC.
        </p>
        <nav class="nav" aria-label="Primary">
          <a href="/">Dashboard</a>
          <a href="/docs">Docs</a>
          <a href="/skill.md">skill.md</a>
        </nav>
      </section>

      <section class="grid panels">
        <section class="panel">
          <div class="section">
            <h2>Deployed surface</h2>
            <p>The browser workspace lives at <code>${escapeHtml(baseUrl)}/</code>. The current deployment sees Privy as <code>${escapeHtml(clientConfig.privyAppId ?? "not configured")}</code>.</p>
            <ul>
              <li><code>GET /api/dashboard</code> exposes the public marketplace snapshot.</li>
              <li><code>GET /api/workspace</code> returns the authenticated workspace snapshot for agents and browser clients.</li>
              <li><code>/docs</code> and <code>/skill.md</code> publish the discovery surface for live agents.</li>
            </ul>
          </div>
          <div class="section">
            <h2>Browser auth</h2>
            <ol>
              <li>Sign in from the dashboard with Privy.</li>
              <li>Complete the Grantfinder profile by choosing requester or specialist.</li>
              <li>Requesters can save a structured organization profile for scout and application prefill.</li>
              <li>Mint an agent token if you need curl or JSON-RPC access.</li>
            </ol>
          </div>
          <div class="section">
            <h2>Create an agent token</h2>
            <pre>curl -s ${escapeHtml(baseUrl)}/api/auth/tokens \\
  -H 'Authorization: Bearer &lt;privyAccessToken&gt;' \\
  -H 'content-type: application/json' \\
  -d '{"label":"cli"}'</pre>
            <p>Revoke a minted token with <code>DELETE /api/auth/tokens/:id</code> when an agent no longer needs access.</p>
          </div>
        </section>

        <section class="panel">
          <div class="section">
            <h2>Research workflow</h2>
            <pre>curl -s ${escapeHtml(baseUrl)}/api/research \\
  -H 'Authorization: Bearer &lt;agentToken&gt;' \\
  -H 'content-type: application/json' \\
  -d '{"scenarioId":"inverse-private-equity"}'</pre>
            <p>Create a durable request by saving a custom scenario, creating a request, and then running that request so tracked grants and durable report artifacts appear in the workspace. The request detail view now keeps a live activity timeline and accepts steering notes during an active run.</p>
            <pre>curl -s ${escapeHtml(baseUrl)}/api/research/scenarios \\
  -H 'Authorization: Bearer &lt;agentToken&gt;' \\
  -H 'content-type: application/json' \\
  -d '{"name":"Warehouse robotics","summary":"Grant support for robotics rollout","geography":"United States","businessModel":"B2B logistics","customers":["regional manufacturers"],"needs":["warehouse automation"],"tags":["automation"]}'</pre>
          </div>
          <div class="section">
            <h2>Marketplace flow</h2>
            <ol>
              <li>Create a job as a requester via <code>POST /api/jobs</code>.</li>
              <li>Open a proposal workspace from a tracked grant via <code>POST /api/grants/:id/proposal-workspace</code> or from a catalog grant via <code>POST /api/catalog/grants/:id/proposal-workspace</code>.</li>
              <li>Run proposal workspace automation via <code>POST /api/proposal-workspaces/:id/actions</code>.</li>
              <li>Promote a tracked grant into the catalog via <code>POST /api/grants/:id/catalog-entry</code>.</li>
              <li>Refresh a catalog grant with follow-up research via <code>POST /api/catalog/grants/:id/research-requests</code> and curate it with <code>PATCH /api/catalog/grants/:id</code>.</li>
              <li>Create an application workspace via <code>POST /api/application-workspaces</code>, edit sections with <code>PATCH /api/application-workspaces/:id/sections/:sectionId</code>, generate section drafts with <code>POST /api/application-workspaces/:id/sections/:sectionId/generate</code>, and finalize with <code>POST /api/application-workspaces/:id/finalize</code>.</li>
              <li>Register provider credentials with <code>POST /api/provider-connections</code> before generation or proposal automation.</li>
              <li>Submit an offer as a specialist via <code>POST /api/jobs/:id/offers</code>.</li>
              <li>Accept the offer as the requester via <code>POST /api/offers/:id/accept</code>.</li>
              <li>Fund the engagement via <code>POST /api/engagements/:id/fund</code>.</li>
            </ol>
          </div>
          <div class="section">
            <h2>Repository bindings and publication</h2>
            <p>Repository bindings can be attached, updated, or cleared on tracked grants, catalog grants, and manual proposal workspaces with <code>PATCH /api/grants/:id</code>, <code>PATCH /api/catalog/grants/:id</code>, and <code>PATCH /api/proposal-workspaces/:id</code>. The same <code>repositoryBinding</code> payload is available through <code>grants.updateQueue</code>, <code>catalog.grants.update</code>, and <code>proposalWorkspaces.update</code>.</p>
            <p>Bindings default to the <code>grantfinder/</code> root path unless a different root is set. Reads surface the effective binding source so agents can tell whether a repository came from a tracked grant, a catalog grant, or a proposal workspace.</p>
            <p>Live GitHub publication requires an injected and configured <code>RepositoryPublicationAdapter</code>. Without it, platform artifacts still save and publication status reports the failure. Publication writes deterministic files such as <code>research/&lt;request-id&gt;/brief.md</code>, <code>research/&lt;request-id&gt;/report.md</code>, <code>research/&lt;request-id&gt;/supporting.md</code>, <code>pursuits/&lt;proposal-workspace-id&gt;/workspace.md</code>, contacts and outreach files, application section files, and final documents. Status surfaces include branch, commit, pull request URL, blocked or failed state, and stale-artifact messaging.</p>
          </div>
          <div class="section">
            <h2>Browser workspace</h2>
            <p>The authenticated browser surface currently exposes request marketplace, research dashboard, my requests, my grants, proposal workspaces, organization, catalog, applications, and providers.</p>
            <p>Privy sign-in, sign-out, and embedded wallet creation remain browser-only entry points. The post-auth workflows behind those tabs are available over REST and JSON-RPC.</p>
          </div>
          <div class="section">
            <h2>x402 funding</h2>
            <pre>X402_MODE=${escapeHtml(x402.mode)}
X402_FACILITATOR_URL=${escapeHtml(x402.facilitatorUrl)}
X402_NETWORK=${escapeHtml(x402.network)}
X402_PAY_TO=${escapeHtml(x402.payTo)}</pre>
          </div>
          <div class="section">
            <h2>JSON-RPC</h2>
            <pre>curl -s ${escapeHtml(baseUrl)}/rpc \\
  -H 'Authorization: Bearer &lt;agentToken&gt;' \\
  -H 'content-type: application/json' \\
  -d '{"jsonrpc":"2.0","id":"jobs","method":"jobs.list","params":{}}'</pre>
            <p>Available methods: <code>auth.session</code>, <code>auth.profile.upsert</code>, <code>auth.tokens.list</code>, <code>auth.tokens.create</code>, <code>organization.get</code>, <code>organization.upsert</code>, <code>organization.personnel.create</code>, <code>organization.invites.accept</code>, <code>workspace.get</code>, <code>research.scenarios.list</code>, <code>research.scenarios.create</code>, <code>research.requests.create</code>, <code>research.requests.get</code>, <code>research.requests.run</code>, <code>research.requests.steer</code>, <code>research.run</code>, <code>grantReports.list</code>, <code>catalog.grants.list</code>, <code>catalog.grants.get</code>, <code>catalog.grants.promote</code>, <code>catalog.grants.bookmark</code>, <code>catalog.grants.update</code>, <code>catalog.grants.startResearch</code>, <code>catalog.grants.createProposalWorkspace</code>, <code>catalog.grants.createProposalJob</code>, <code>proposalWorkspaces.list</code>, <code>proposalWorkspaces.create</code>, <code>proposalWorkspaces.get</code>, <code>proposalWorkspaces.update</code>, <code>proposalWorkspaces.runAction</code>, <code>proposalWorkspaces.createProposalJob</code>, <code>catalog.schemas.upsert</code>, <code>application.templates.create</code>, <code>application.workspaces.create</code>, <code>application.workspaces.get</code>, <code>application.workspaces.updateSection</code>, <code>application.workspaces.finalize</code>, <code>application.workspaces.generateSection</code>, <code>providerConnections.create</code>, <code>agentExecutions.list</code>, <code>grants.updateQueue</code>, <code>grants.createProposalJob</code>, <code>jobs.list</code>, <code>jobs.create</code>, <code>offers.create</code>, <code>offers.accept</code>, <code>engagements.get</code>, <code>engagements.fund</code>.</p>
          </div>
        </section>
      </section>`,
  );
}

function buildSkillDocument(baseUrl: string, x402: X402Settings): string {
  return `# Grantfinder Skill

Grantfinder exposes grant research and a paid specialist marketplace over browser HTML, REST, and JSON-RPC.

## Base URL

\`${baseUrl}\`

## Auth

- Browser users authenticate with Privy.
- Headless clients should mint an agent token from \`POST /api/auth/tokens\`.
- Use \`Authorization: Bearer <agentToken>\` on protected routes.

## REST endpoints

- \`GET /api/dashboard\`
- \`GET /api/auth/session\`
- \`POST /api/auth/profile\`
- \`GET /api/auth/tokens\`
- \`POST /api/auth/tokens\`
- \`DELETE /api/auth/tokens/:id\`
- \`GET /api/organization\`
- \`PUT /api/organization\`
- \`POST /api/organization/personnel\`
- \`POST /api/organization/invites/:inviteId/accept\`
- \`GET /api/workspace\`
- \`GET /api/research/scenarios\`
- \`POST /api/research/scenarios\`
- \`POST /api/research/requests\`
- \`GET /api/research/requests/:id\`
- \`POST /api/research/requests/:id/run\`
- \`POST /api/research/requests/:id/steer\`
- \`GET /api/grant-reports\`
- \`POST /api/research\`
- \`PATCH /api/grants/:id\`
- \`POST /api/grants/:id/catalog-entry\`
- \`POST /api/grants/:id/proposal-workspace\`
- \`POST /api/grants/:id/proposal-job\`
- \`GET /api/proposal-workspaces\`
- \`POST /api/proposal-workspaces\`
- \`GET /api/proposal-workspaces/:id\`
- \`PATCH /api/proposal-workspaces/:id\`
- \`POST /api/proposal-workspaces/:id/actions\`
- \`POST /api/proposal-workspaces/:id/proposal-job\`
- \`POST /api/catalog/grants/:id/proposal-workspace\`
- \`POST /api/catalog/grants/:id/proposal-job\`
- \`GET /api/catalog/grants\`
- \`GET /api/catalog/grants/:id\`
- \`PATCH /api/catalog/grants/:id\`
- \`POST /api/catalog/grants/:id/research-requests\`
- \`PUT /api/catalog/grants/:id/schema\`
- \`PUT /api/catalog/grants/:id/bookmark\`
- \`POST /api/application-templates\`
- \`POST /api/application-workspaces\`
- \`GET /api/application-workspaces/:id\`
- \`PATCH /api/application-workspaces/:id/sections/:sectionId\`
- \`POST /api/application-workspaces/:id/finalize\`
- \`POST /api/application-workspaces/:id/sections/:sectionId/generate\`
- \`POST /api/provider-connections\`
- \`GET /api/agent-executions\`
- \`GET /api/jobs\`
- \`POST /api/jobs\`
- \`POST /api/jobs/:id/offers\`
- \`POST /api/offers/:id/accept\`
- \`GET /api/engagements/:id\`
- \`POST /api/engagements/:id/fund\`

## JSON-RPC methods

- \`auth.session\`
- \`auth.profile.upsert\`
- \`auth.tokens.list\`
- \`auth.tokens.create\`
- \`organization.get\`
- \`organization.upsert\`
- \`organization.personnel.create\`
- \`organization.invites.accept\`
- \`workspace.get\`
- \`research.scenarios.list\`
- \`research.scenarios.create\`
- \`research.requests.create\`
- \`research.requests.get\`
- \`research.requests.run\`
- \`research.requests.steer\`
- \`research.run\`
- \`grantReports.list\`
- \`catalog.grants.list\`
- \`catalog.grants.get\`
- \`catalog.grants.promote\`
- \`catalog.grants.bookmark\`
- \`catalog.grants.update\`
- \`catalog.grants.startResearch\`
- \`catalog.grants.createProposalWorkspace\`
- \`catalog.grants.createProposalJob\`
- \`proposalWorkspaces.list\`
- \`proposalWorkspaces.create\`
- \`proposalWorkspaces.get\`
- \`proposalWorkspaces.update\`
- \`proposalWorkspaces.runAction\`
- \`proposalWorkspaces.createProposalJob\`
- \`catalog.schemas.upsert\`
- \`application.templates.create\`
- \`application.workspaces.create\`
- \`application.workspaces.get\`
- \`application.workspaces.updateSection\`
- \`application.workspaces.finalize\`
- \`application.workspaces.generateSection\`
- \`providerConnections.create\`
- \`agentExecutions.list\`
- \`grants.updateQueue\`
- \`grants.createProposalJob\`
- \`jobs.list\`
- \`jobs.create\`
- \`offers.create\`
- \`offers.accept\`
- \`engagements.get\`
- \`engagements.fund\`

## Repository bindings and publication

- Attach, update, or clear repository bindings with \`PATCH /api/grants/:id\`, \`PATCH /api/catalog/grants/:id\`, and \`PATCH /api/proposal-workspaces/:id\`.
- Send the same \`repositoryBinding\` payload through \`grants.updateQueue\`, \`catalog.grants.update\`, and \`proposalWorkspaces.update\`.
- Bindings default to the \`grantfinder/\` root path unless a different root path is provided.
- Reads return the effective repository binding source so agents can see whether a repository came from a tracked grant, a catalog grant, or a proposal workspace.
- Live GitHub publication requires an injected and configured \`RepositoryPublicationAdapter\`; without it, platform artifacts still save and publication status reports the failure.
- Publication writes deterministic files such as \`research/<request-id>/brief.md\`, \`research/<request-id>/report.md\`, \`research/<request-id>/supporting.md\`, \`pursuits/<proposal-workspace-id>/workspace.md\`, contacts and outreach files, application section files, and final documents.
- Publication status surfaces include branch, commit, pull request URL, blocked or failed state, and stale-artifact messaging.

## x402 funding

- Funding route: \`POST /api/engagements/:id/fund\`
- Challenge header: \`x-payment-protocol: x402\`
- Mode: \`${x402.mode}\`
- Network: \`${x402.network}\`
- Facilitator: \`${x402.facilitatorUrl}\`

## Browser UI

- Dashboard: \`${baseUrl}/\`
- Tabs: request marketplace, research dashboard, my requests, my grants, proposal workspaces, organization, catalog, applications, providers
- Browser-only entry points: Privy sign-in, sign-out, and embedded wallet creation
- Docs: \`${baseUrl}/docs\`
- Skill markdown: \`${baseUrl}/skill.md\`
`;
}

async function parseJson<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new AppError(400, "invalid_json", "Request body must be valid JSON.");
  }
}

async function ensureClientBundle(): Promise<void> {
  if (existsSync(clientBundlePath)) {
    return;
  }

  if (!clientBundlePromise) {
    clientBundlePromise = Bun.build({
      entrypoints: [fileURLToPath(new URL("./client.tsx", import.meta.url))],
      outdir: fileURLToPath(new URL("../dist/public", import.meta.url)),
      target: "browser",
      naming: {
        entry: "client.js",
      },
      minify: false,
      sourcemap: "linked",
    }).then((result) => {
      if (!result.success) {
        const message = result.logs.map((log) => log.message).join("\n");
        throw new Error(`Failed to build browser bundle.\n${message}`);
      }
    });
  }

  await clientBundlePromise;
}

function createLiveFundingMiddleware(services: ApplicationServices, x402: X402Settings) {
  const facilitator = new HTTPFacilitatorClient({ url: x402.facilitatorUrl });
  const resourceServer = new x402ResourceServer(facilitator).register(x402.network, new ExactEvmScheme());
  const middleware = paymentMiddleware(
    {
      "POST /api/engagements/:id/fund": {
        accepts: {
          scheme: "exact",
          network: x402.network,
          payTo: async (context) =>
            (await services.getFundingChallengeForEngagement(extractFundingEngagementId(context.path), x402)).payTo,
          price: async (context) => {
            const challenge = await services.getFundingChallengeForEngagement(
              extractFundingEngagementId(context.path),
              x402,
            );
            return `$${challenge.amountUsd}`;
          },
        },
        description: "Fund a specialist engagement to prepare and submit grant applications.",
        mimeType: "application/json",
        unpaidResponseBody: async (context) => ({
          contentType: "application/json",
          body: {
            paymentRequired: await services.getFundingChallengeForEngagement(
              extractFundingEngagementId(context.path),
              x402,
            ),
          },
        }),
      },
    },
    resourceServer,
    {
      appName: "Grantfinder",
      testnet: x402.network !== "eip155:8453",
    },
    undefined,
    false,
  );

  return async (c: any, next: () => Promise<void>) => {
    await middleware(c, next);
    if (c.res.status === 402) {
      c.header("x-payment-protocol", "x402");
    }
  };
}

export function createApp(options: AppOptions = {}) {
  const authProvider = resolveAuthProvider(options.authProvider);
  const store = new ApplicationStore(options);
  const researchSessionFactory =
    options.researchSessionFactory === undefined && options.researchRunner
      ? null
      : options.researchSessionFactory;
  const services = new ApplicationServices(
    store,
    authProvider,
    options.researchRunner,
    researchSessionFactory,
    options.publicationAdapter ?? null,
  );
  const x402 = resolveX402Settings(options.x402);
  const clientConfig: BrowserClientConfig = {
    privyAppId: process.env.PRIVY_APP_ID ?? null,
    x402Mode: x402.mode,
  };
  const app = new Hono();

  app.onError((error, c) => {
    if (error instanceof HTTPException) {
      return error.getResponse();
    }

    const appError =
      error instanceof AppError
        ? error
        : new AppError(500, "internal_error", error instanceof Error ? error.message : "Unexpected error.");

    return new Response(
      JSON.stringify({
        error: {
          code: appError.code,
          message: appError.message,
        },
      }),
      {
        status: appError.status,
        headers: { "content-type": "application/json" },
      },
    );
  });

  app.get("/", (c) => c.html(renderAppShell(clientConfig)));
  app.get("/demo", (c) => c.html(renderDesignDemoShell(clientConfig)));
  app.get("/health", (c) => c.json({ status: "ok" }));
  app.get("/favicon.ico", () => new Response(null, { status: 204 }));
  app.get("/docs", (c) => c.html(renderDocsPage(new URL(c.req.url).origin, x402, clientConfig)));
  app.get("/skill.md", (c) => c.text(buildSkillDocument(new URL(c.req.url).origin, x402)));
  app.get("/assets/client.js", async () => {
    await ensureClientBundle();
    return new Response(Bun.file(clientBundlePath), {
      headers: { "content-type": "text/javascript; charset=utf-8" },
    });
  });

  app.get("/api/dashboard", async (c) => c.json(await services.getDashboardData()));

  app.get("/api/auth/session", async (c) => {
    const token = parseAuthorizationHeader(c.req.header("authorization"));
    return c.json(await services.getBrowserSession(token));
  });

  app.post("/api/auth/profile", async (c) => {
    const token = parseAuthorizationHeader(c.req.header("authorization"));
    const payload = await parseJson<{
      name: string;
      role: "requester" | "specialist";
      walletAddress?: string | null;
      smartWalletAddress?: string | null;
    }>(c.req.raw);
    return c.json(await services.upsertBrowserProfile(token, payload), 201);
  });

  app.get("/api/auth/tokens", async (c) => {
    const user = await services.authenticate(parseAuthorizationHeader(c.req.header("authorization")));
    return c.json(await services.listAgentTokens(user));
  });

  app.post("/api/auth/tokens", async (c) => {
    const user = await services.authenticate(parseAuthorizationHeader(c.req.header("authorization")));
    const payload = await parseJson<{ label?: string }>(c.req.raw);
    return c.json(await services.createAgentToken(user, payload), 201);
  });

  app.delete("/api/auth/tokens/:id", async (c) => {
    const user = await services.authenticate(parseAuthorizationHeader(c.req.header("authorization")));
    return c.json(await services.revokeAgentToken(user, c.req.param("id")));
  });

  app.get("/api/admin/feature-flags", async (c) => {
    const token = parseAuthorizationHeader(c.req.header("authorization"));
    return c.json(await services.listFeatureFlags(token));
  });

  app.post("/api/admin/feature-flags", async (c) => {
    const token = parseAuthorizationHeader(c.req.header("authorization"));
    const payload = await parseJson<{ key: string; description?: string; defaultEnabled?: boolean }>(c.req.raw);
    return c.json(await services.createFeatureFlag(token, payload), 201);
  });

  app.patch("/api/admin/feature-flags/:id", async (c) => {
    const token = parseAuthorizationHeader(c.req.header("authorization"));
    const payload = await parseJson<{ description?: string; defaultEnabled?: boolean }>(c.req.raw);
    return c.json(await services.updateFeatureFlag(token, c.req.param("id"), payload));
  });

  app.delete("/api/admin/feature-flags/:id", async (c) => {
    const token = parseAuthorizationHeader(c.req.header("authorization"));
    return c.json(await services.deleteFeatureFlag(token, c.req.param("id")));
  });

  app.put("/api/admin/feature-flags/:id/targets", async (c) => {
    const token = parseAuthorizationHeader(c.req.header("authorization"));
    const payload = await parseJson<{ audienceType: string; audienceId: string; enabled?: boolean }>(c.req.raw);
    return c.json(await services.setFeatureFlagTarget(token, c.req.param("id"), payload), 201);
  });

  app.delete("/api/admin/feature-flags/targets/:targetId", async (c) => {
    const token = parseAuthorizationHeader(c.req.header("authorization"));
    return c.json(await services.deleteFeatureFlagTarget(token, c.req.param("targetId")));
  });

  app.get("/api/organization", async (c) => {
    const user = await services.authenticate(parseAuthorizationHeader(c.req.header("authorization")));
    return c.json(await services.getOrganization(user));
  });

  app.put("/api/organization", async (c) => {
    const user = await services.authenticate(parseAuthorizationHeader(c.req.header("authorization")));
    const payload = await parseJson<{
      name: string;
      website?: string | null;
      registrationCountry: string;
      registrationRegion?: string | null;
      organizationType:
        | "nonprofit"
        | "fiscal_sponsor"
        | "school"
        | "government"
        | "tribal_entity"
        | "for_profit"
        | "other";
      operatingScope: "local" | "regional" | "national" | "international";
      localOperatingAreas: string[];
      missionStatement: string;
      programs: string[];
      targetDemographics: string[];
      thematicAreas: string[];
      annualOperatingBudget: string;
      strategicPriorities: string[];
      emailUpdatesEnabled: boolean;
      personnel: Array<{
        id?: string;
        fullName: string;
        roleTitle: string;
        yearsExperience?: number | null;
        email?: string | null;
        userId?: string | null;
        platformAccessEnabled?: boolean;
        accessState?: "none" | "invited" | "active";
        canManageInvites?: boolean;
        invite?: {
          id: string;
          invitePath: string;
          createdAt: string;
          acceptedAt?: string | null;
        } | null;
      }>;
    }>(c.req.raw);
    return c.json(await services.upsertOrganization(user, payload), 201);
  });

  app.post("/api/organization/personnel", async (c) => {
    const user = await services.authenticate(parseAuthorizationHeader(c.req.header("authorization")));
    const payload = await parseJson<{
      fullName: string;
      roleTitle: string;
      yearsExperience?: number | null;
      email?: string | null;
      platformAccessEnabled: boolean;
      canManageInvites: boolean;
    }>(c.req.raw);
    return c.json(await services.createOrganizationPersonnel(user, payload), 201);
  });

  app.post("/api/organization/invites/:inviteId/accept", async (c) => {
    const user = await services.authenticate(parseAuthorizationHeader(c.req.header("authorization")));
    return c.json(await services.acceptOrganizationInvite(user, c.req.param("inviteId")));
  });

  app.get("/api/workspace", async (c) => {
    const user = await services.authenticate(parseAuthorizationHeader(c.req.header("authorization")));
    return c.json(await services.getWorkspace(user));
  });

  app.get("/api/grant-reports", async (c) => {
    const user = await services.authenticate(parseAuthorizationHeader(c.req.header("authorization")));
    return c.json(await services.listGrantReports(user));
  });

  app.get("/api/research/scenarios", async (c) => {
    const user = await services.authenticate(parseAuthorizationHeader(c.req.header("authorization")));
    return c.json(await services.listResearchScenarios(user));
  });

  app.post("/api/research/scenarios", async (c) => {
    const user = await services.authenticate(parseAuthorizationHeader(c.req.header("authorization")));
    const payload = await parseJson<{
      name: string;
      summary: string;
      geography: string;
      businessModel: string;
      customers: string[];
      needs: string[];
      tags: string[];
    }>(c.req.raw);
    return c.json(await services.createResearchScenario(user, payload), 201);
  });

  app.post("/api/research/requests", async (c) => {
    const user = await services.authenticate(parseAuthorizationHeader(c.req.header("authorization")));
    const payload = await parseJson<{ scenarioId: string }>(c.req.raw);
    return c.json(await services.createResearchRequest(user, payload), 201);
  });

  app.get("/api/research/requests/:id", async (c) => {
    const user = await services.authenticate(parseAuthorizationHeader(c.req.header("authorization")));
    return c.json(await services.getResearchRequest(user, c.req.param("id")));
  });

  app.post("/api/research/requests/:id/run", async (c) => {
    const user = await services.authenticate(parseAuthorizationHeader(c.req.header("authorization")));
    const payload = c.req.header("content-type")?.includes("application/json")
      ? await parseJson<{ awaitCompletion?: boolean }>(c.req.raw)
      : {};
    const result = await services.runResearchRequest(user, c.req.param("id"), payload);
    return c.json(result, payload.awaitCompletion === false ? 202 : 200);
  });

  app.post("/api/research/requests/:id/steer", async (c) => {
    const user = await services.authenticate(parseAuthorizationHeader(c.req.header("authorization")));
    const payload = await parseJson<{ prompt: string }>(c.req.raw);
    return c.json(await services.steerResearchRequest(user, c.req.param("id"), payload), 201);
  });

  app.patch("/api/grants/:id", async (c) => {
    const user = await services.authenticate(parseAuthorizationHeader(c.req.header("authorization")));
    const payload = await parseJson<{
      queueState?: "active" | "inactive";
      repositoryBinding?: RepositoryBindingInput | null;
    }>(c.req.raw);
    return c.json(await services.updateGrantQueueState(user, c.req.param("id"), payload));
  });

  app.post("/api/grants/:id/catalog-entry", async (c) => {
    const user = await services.authenticate(parseAuthorizationHeader(c.req.header("authorization")));
    return c.json(await services.promoteGrantToCatalogEntry(user, c.req.param("id")), 201);
  });

  app.post("/api/grants/:id/proposal-job", async (c) => {
    const user = await services.authenticate(parseAuthorizationHeader(c.req.header("authorization")));
    return c.json(await services.createProposalJobFromGrant(user, c.req.param("id")), 201);
  });

  app.post("/api/grants/:id/proposal-workspace", async (c) => {
    const user = await services.authenticate(parseAuthorizationHeader(c.req.header("authorization")));
    const result = await services.createProposalWorkspaceFromGrant(user, c.req.param("id"));
    return c.json({ workspace: result.workspace }, result.created ? 201 : 200);
  });

  app.get("/api/catalog/grants", async (c) => {
    const user = await services.authenticate(parseAuthorizationHeader(c.req.header("authorization")));
    const bookmarked = new URL(c.req.url).searchParams.get("bookmarked") === "true";
    return c.json(await services.listCatalogGrants(user, { bookmarked }));
  });

  app.get("/api/catalog/grants/:id", async (c) => {
    const user = await services.authenticate(parseAuthorizationHeader(c.req.header("authorization")));
    return c.json(await services.getCatalogGrant(user, c.req.param("id")));
  });

  app.patch("/api/catalog/grants/:id", async (c) => {
    const user = await services.authenticate(parseAuthorizationHeader(c.req.header("authorization")));
    const payload = await parseJson<{
      title?: string;
      sponsor?: string;
      fundingType?: string;
      fitScore?: number;
      whyFit?: string;
      eligibilityNotes?: string[];
      amountSummary?: string;
      deadlineSummary?: string;
      geography?: string;
      status?: string;
      citations?: string[];
      nextActions?: string[];
      tags?: string[];
      provenanceNotes?: string | null;
      freshnessNotes?: string | null;
      pursuitNotes?: string | null;
      lastValidatedAt?: string | null;
      repositoryBinding?: RepositoryBindingInput | null;
    }>(c.req.raw);
    return c.json(await services.updateCatalogGrant(user, c.req.param("id"), payload));
  });

  app.post("/api/catalog/grants/:id/research-requests", async (c) => {
    const user = await services.authenticate(parseAuthorizationHeader(c.req.header("authorization")));
    const payload = await parseJson<{
      researchFocus?: string | null;
      awaitCompletion?: boolean;
    }>(c.req.raw);
    return c.json(await services.startCatalogGrantResearch(user, c.req.param("id"), payload), 201);
  });

  app.post("/api/catalog/grants/:id/proposal-workspace", async (c) => {
    const user = await services.authenticate(parseAuthorizationHeader(c.req.header("authorization")));
    const result = await services.createProposalWorkspaceFromCatalogGrant(user, c.req.param("id"));
    return c.json({ workspace: result.workspace }, result.created ? 201 : 200);
  });

  app.post("/api/catalog/grants/:id/proposal-job", async (c) => {
    const user = await services.authenticate(parseAuthorizationHeader(c.req.header("authorization")));
    const result = await services.createProposalJobFromCatalogGrant(user, c.req.param("id"));
    return c.json(
      {
        job: result.job,
        grant: result.grant,
        workspace: result.workspace,
        engagement: result.engagement,
      },
      result.created ? 201 : 200,
    );
  });

  app.put("/api/catalog/grants/:id/schema", async (c) => {
    const user = await services.authenticate(parseAuthorizationHeader(c.req.header("authorization")));
    const payload = await parseJson<{
      name: string;
      documentType: "grant_proposal" | "loi" | "budget_narrative" | "other";
      sections: Array<{
        key: string;
        title: string;
        stepName?: string | null;
        prompt?: string | null;
        examples?: string[];
        validation?: {
          minWords?: number | null;
          maxWords?: number | null;
        };
      }>;
    }>(c.req.raw);
    return c.json(await services.upsertGrantApplicationSchema(user, c.req.param("id"), payload), 201);
  });

  app.put("/api/catalog/grants/:id/bookmark", async (c) => {
    const user = await services.authenticate(parseAuthorizationHeader(c.req.header("authorization")));
    const payload = await parseJson<{ bookmarked: boolean }>(c.req.raw);
    return c.json(await services.setCatalogGrantBookmark(user, c.req.param("id"), Boolean(payload.bookmarked)));
  });

  app.post("/api/application-templates", async (c) => {
    const user = await services.authenticate(parseAuthorizationHeader(c.req.header("authorization")));
    const payload = await parseJson<{
      name: string;
      documentType: "grant_proposal" | "loi" | "budget_narrative" | "other";
      sections: Array<{
        key: string;
        title: string;
        stepName?: string | null;
        prompt?: string | null;
        examples?: string[];
        validation?: {
          minWords?: number | null;
          maxWords?: number | null;
        };
      }>;
    }>(c.req.raw);
    return c.json(await services.createApplicationTemplate(user, payload), 201);
  });

  app.post("/api/application-workspaces", async (c) => {
    const user = await services.authenticate(parseAuthorizationHeader(c.req.header("authorization")));
    const payload = await parseJson<{
      catalogGrantId?: string | null;
      templateId?: string | null;
      documentType: "grant_proposal" | "loi" | "budget_narrative" | "other";
    }>(c.req.raw);
    return c.json(await services.createApplicationWorkspace(user, payload), 201);
  });

  app.get("/api/application-workspaces/:id", async (c) => {
    const user = await services.authenticate(parseAuthorizationHeader(c.req.header("authorization")));
    return c.json(await services.getApplicationWorkspace(user, c.req.param("id")));
  });

  app.patch("/api/application-workspaces/:id/sections/:sectionId", async (c) => {
    const user = await services.authenticate(parseAuthorizationHeader(c.req.header("authorization")));
    const payload = await parseJson<{ content: string }>(c.req.raw);
    return c.json(
      await services.updateApplicationWorkspaceSection(user, c.req.param("id"), c.req.param("sectionId"), payload),
    );
  });

  app.post("/api/application-workspaces/:id/finalize", async (c) => {
    const user = await services.authenticate(parseAuthorizationHeader(c.req.header("authorization")));
    return c.json(await services.finalizeApplicationWorkspace(user, c.req.param("id")));
  });

  app.post("/api/application-workspaces/:id/sections/:sectionId/generate", async (c) => {
    const user = await services.authenticate(parseAuthorizationHeader(c.req.header("authorization")));
    const payload = c.req.header("content-type")?.includes("application/json")
      ? await parseJson<{ providerConnectionId?: string | null }>(c.req.raw)
      : {};
    return c.json(
      await services.generateApplicationWorkspaceSection(
        user,
        c.req.param("id"),
        c.req.param("sectionId"),
        payload,
      ),
    );
  });

  app.get("/api/proposal-workspaces", async (c) => {
    const user = await services.authenticate(parseAuthorizationHeader(c.req.header("authorization")));
    return c.json(await services.listProposalWorkspaces(user));
  });

  app.post("/api/proposal-workspaces", async (c) => {
    const user = await services.authenticate(parseAuthorizationHeader(c.req.header("authorization")));
    const payload = await parseJson<{
      trackedGrantId?: string | null;
      catalogGrantId?: string | null;
      manualOpportunity?: {
        title: string;
        sponsor: string;
        fundingType: string;
        amountSummary?: string | null;
        deadlineSummary?: string | null;
        geography?: string | null;
        sourceUrl?: string | null;
        notes?: string | null;
      } | null;
    }>(c.req.raw);
    const result = await services.createProposalWorkspace(user, payload);
    return c.json({ workspace: result.workspace }, result.created ? 201 : 200);
  });

  app.get("/api/proposal-workspaces/:id", async (c) => {
    const user = await services.authenticate(parseAuthorizationHeader(c.req.header("authorization")));
    return c.json(await services.getProposalWorkspace(user, c.req.param("id")));
  });

  app.patch("/api/proposal-workspaces/:id", async (c) => {
    const user = await services.authenticate(parseAuthorizationHeader(c.req.header("authorization")));
    const payload = await parseJson<{
      stage?: "qualifying" | "drafting" | "outreach" | "submitted" | "awarded" | "declined" | "no_bid";
      summary?: string;
      nextSteps?: string[];
      openQuestions?: string[];
      feasibilitySnapshot?: {
        verdict: string;
        confidence: "high" | "medium" | "low";
        blockers?: string[];
        assumptions?: string[];
        requiredDocuments?: string[];
        recommendedNextStep: string;
      } | null;
      contacts?: Array<{
        name: string;
        roleTitle?: string | null;
        email?: string | null;
        phone?: string | null;
        organization?: string | null;
        notes?: string | null;
      }>;
      outreachEvents?: Array<{
        kind: "email" | "call" | "meeting" | "note" | "other";
        direction: "outbound" | "inbound";
        subject?: string | null;
        summary: string;
        occurredAt: string;
      }>;
      outcome?: {
        status: "submitted" | "awarded" | "declined" | "no_bid";
        summary: string;
        recordedAt: string;
      } | null;
      repositoryBinding?: RepositoryBindingInput | null;
    }>(c.req.raw);
    return c.json(await services.updateProposalWorkspace(user, c.req.param("id"), payload));
  });

  app.post("/api/proposal-workspaces/:id/actions", async (c) => {
    const user = await services.authenticate(parseAuthorizationHeader(c.req.header("authorization")));
    const payload = await parseJson<{
      action: "evaluate_feasibility" | "discover_contacts" | "draft_outreach" | "plan_next_steps" | "refresh_draft";
      providerConnectionId: string;
    }>(c.req.raw);
    return c.json(await services.runProposalWorkspaceAction(user, c.req.param("id"), payload));
  });

  app.post("/api/proposal-workspaces/:id/proposal-job", async (c) => {
    const user = await services.authenticate(parseAuthorizationHeader(c.req.header("authorization")));
    return c.json(await services.createProposalJobFromProposalWorkspace(user, c.req.param("id")), 201);
  });

  app.post("/api/provider-connections", async (c) => {
    const user = await services.authenticate(parseAuthorizationHeader(c.req.header("authorization")));
    const payload = await parseJson<{
      scope: "user" | "organization";
      provider: string;
      label: string;
      authType: "byok" | "oauth";
      allowedArtifactTypes: Array<
        "grant_catalog_entry" | "application_workspace" | "workspace_section" | "proposal_workspace"
      >;
    }>(c.req.raw);
    return c.json(await services.createProviderConnection(user, payload), 201);
  });

  app.get("/api/agent-executions", async (c) => {
    const user = await services.authenticate(parseAuthorizationHeader(c.req.header("authorization")));
    return c.json(await services.listAgentExecutions(user));
  });

  app.get("/api/jobs", async (c) => {
    await services.authenticate(parseAuthorizationHeader(c.req.header("authorization")));
    return c.json(await services.listJobs());
  });

  app.post("/api/research", async (c) => {
    const user = await services.authenticate(parseAuthorizationHeader(c.req.header("authorization")));
    const payload = await parseJson<{ scenarioId: string }>(c.req.raw);
    return c.json(await services.runResearch(user, payload.scenarioId));
  });

  app.post("/api/jobs", async (c) => {
    const user = await services.authenticate(parseAuthorizationHeader(c.req.header("authorization")));
    const payload = await parseJson<{
      title: string;
      description: string;
      fundingNeed: string;
      targetType?: "grant_catalog_entry" | "application_workspace" | "workspace_section" | null;
      targetId?: string | null;
      specialistRole?: "researcher" | "writer" | "reviewer" | "submission_specialist" | null;
    }>(c.req.raw);
    return c.json(await services.createJob(user, payload), 201);
  });

  app.post("/api/jobs/:id/offers", async (c) => {
    const user = await services.authenticate(parseAuthorizationHeader(c.req.header("authorization")));
    const payload = await parseJson<{
      message: string;
      amountUsd: string;
      payoutAddress: string;
      specialistRole?: "researcher" | "writer" | "reviewer" | "submission_specialist" | null;
    }>(c.req.raw);
    return c.json(await services.createOffer(user, c.req.param("id"), payload), 201);
  });

  app.post("/api/offers/:id/accept", async (c) => {
    const user = await services.authenticate(parseAuthorizationHeader(c.req.header("authorization")));
    return c.json(await services.acceptOffer(user, c.req.param("id")));
  });

  app.get("/api/engagements/:id", async (c) => {
    const user = await services.authenticate(parseAuthorizationHeader(c.req.header("authorization")));
    return c.json(await services.getEngagement(user, c.req.param("id")));
  });

  if (x402.mode === "live") {
    app.use("/api/engagements/:id/fund", createLiveFundingMiddleware(services, x402));
    app.post("/api/engagements/:id/fund", async (c) => {
      const user = await services.authenticate(parseAuthorizationHeader(c.req.header("authorization")));
      const paymentHeader = c.req.header("payment-signature") ?? c.req.header("x-payment") ?? null;
      return c.json(await services.fundEngagement(user, c.req.param("id"), x402, paymentHeader));
    });
  } else {
    app.post("/api/engagements/:id/fund", async (c) => {
      const user = await services.authenticate(parseAuthorizationHeader(c.req.header("authorization")));
      const challenge = await services.getFundingChallenge(user, c.req.param("id"), x402);
      c.header("x-payment-protocol", "x402");
      return c.json({ paymentRequired: challenge }, 402);
    });
  }

  app.post("/rpc", async (c) => {
    const request = await parseJson<JsonRpcRequest>(c.req.raw);
    if (request.jsonrpc !== "2.0" || !request.method) {
      return c.json(
        {
          jsonrpc: "2.0",
          id: request.id ?? null,
          error: {
            code: -32600,
            message: "Invalid JSON-RPC request.",
          },
        },
        400,
      );
    }

    try {
      const authToken = parseAuthorizationHeader(c.req.header("authorization"));
      const params = request.params ?? {};
      let result: unknown;

      switch (request.method) {
        case "auth.session":
          result = await services.getBrowserSession(authToken);
          break;
        case "auth.profile.upsert":
          result = await services.upsertBrowserProfile(authToken, {
            name: String(params.name ?? ""),
            role: params.role === "specialist" ? "specialist" : "requester",
            walletAddress: typeof params.walletAddress === "string" ? params.walletAddress : null,
            smartWalletAddress:
              typeof params.smartWalletAddress === "string" ? params.smartWalletAddress : null,
          });
          break;
        case "auth.tokens.list": {
          const user = await services.authenticate(authToken);
          result = await services.listAgentTokens(user);
          break;
        }
        case "auth.tokens.create": {
          const user = await services.authenticate(authToken);
          result = await services.createAgentToken(user, {
            label: typeof params.label === "string" ? params.label : "agent",
          });
          break;
        }
        case "admin.featureFlags.list":
          result = await services.listFeatureFlags(authToken);
          break;
        case "admin.featureFlags.create":
          result = await services.createFeatureFlag(authToken, {
            key: String(params.key ?? ""),
            description: typeof params.description === "string" ? params.description : undefined,
            defaultEnabled: typeof params.defaultEnabled === "boolean" ? params.defaultEnabled : undefined,
          });
          break;
        case "admin.featureFlags.update":
          result = await services.updateFeatureFlag(authToken, String(params.flagId ?? ""), {
            description: typeof params.description === "string" ? params.description : undefined,
            defaultEnabled: typeof params.defaultEnabled === "boolean" ? params.defaultEnabled : undefined,
          });
          break;
        case "admin.featureFlags.delete":
          result = await services.deleteFeatureFlag(authToken, String(params.flagId ?? ""));
          break;
        case "admin.featureFlags.targets.set":
          result = await services.setFeatureFlagTarget(authToken, String(params.flagId ?? ""), {
            audienceType: String(params.audienceType ?? ""),
            audienceId: String(params.audienceId ?? ""),
            enabled: typeof params.enabled === "boolean" ? params.enabled : undefined,
          });
          break;
        case "admin.featureFlags.targets.delete":
          result = await services.deleteFeatureFlagTarget(authToken, String(params.targetId ?? ""));
          break;
        case "organization.get": {
          const user = await services.authenticate(authToken);
          result = await services.getOrganization(user);
          break;
        }
        case "organization.upsert": {
          const user = await services.authenticate(authToken);
          result = await services.upsertOrganization(user, {
            name: String(params.name ?? ""),
            website: typeof params.website === "string" ? params.website : null,
            registrationCountry: String(params.registrationCountry ?? ""),
            registrationRegion:
              typeof params.registrationRegion === "string" ? params.registrationRegion : null,
            organizationType: String(params.organizationType ?? "") as
              | "nonprofit"
              | "fiscal_sponsor"
              | "school"
              | "government"
              | "tribal_entity"
              | "for_profit"
              | "other",
            operatingScope: String(params.operatingScope ?? "") as
              | "local"
              | "regional"
              | "national"
              | "international",
            localOperatingAreas: Array.isArray(params.localOperatingAreas)
              ? params.localOperatingAreas.map((value) => String(value))
              : [],
            missionStatement: String(params.missionStatement ?? ""),
            programs: Array.isArray(params.programs) ? params.programs.map((value) => String(value)) : [],
            targetDemographics: Array.isArray(params.targetDemographics)
              ? params.targetDemographics.map((value) => String(value))
              : [],
            thematicAreas: Array.isArray(params.thematicAreas)
              ? params.thematicAreas.map((value) => String(value))
              : [],
            annualOperatingBudget: String(params.annualOperatingBudget ?? ""),
            strategicPriorities: Array.isArray(params.strategicPriorities)
              ? params.strategicPriorities.map((value) => String(value))
              : [],
            emailUpdatesEnabled: Boolean(params.emailUpdatesEnabled),
            personnel: Array.isArray(params.personnel)
              ? params.personnel.map((entry) =>
                  typeof entry === "object" && entry !== null
                    ? {
                        id:
                          typeof (entry as Record<string, unknown>).id === "string"
                            ? ((entry as Record<string, unknown>).id as string)
                            : undefined,
                        fullName: String((entry as Record<string, unknown>).fullName ?? ""),
                        roleTitle: String((entry as Record<string, unknown>).roleTitle ?? ""),
                        yearsExperience:
                          typeof (entry as Record<string, unknown>).yearsExperience === "number"
                            ? ((entry as Record<string, unknown>).yearsExperience as number)
                            : null,
                        email:
                          typeof (entry as Record<string, unknown>).email === "string"
                            ? ((entry as Record<string, unknown>).email as string)
                            : null,
                        userId:
                          typeof (entry as Record<string, unknown>).userId === "string"
                            ? ((entry as Record<string, unknown>).userId as string)
                            : null,
                        platformAccessEnabled: Boolean(
                          (entry as Record<string, unknown>).platformAccessEnabled,
                        ),
                        accessState:
                          (entry as Record<string, unknown>).accessState === "active"
                            ? "active"
                            : (entry as Record<string, unknown>).accessState === "invited"
                              ? "invited"
                              : "none",
                        canManageInvites: Boolean((entry as Record<string, unknown>).canManageInvites),
                        invite:
                          typeof (entry as Record<string, unknown>).invite === "object" &&
                          (entry as Record<string, unknown>).invite !== null
                            ? {
                                id: String(
                                  ((entry as Record<string, unknown>).invite as Record<string, unknown>).id ?? "",
                                ),
                                invitePath: String(
                                  ((entry as Record<string, unknown>).invite as Record<string, unknown>).invitePath ??
                                    "",
                                ),
                                createdAt: String(
                                  ((entry as Record<string, unknown>).invite as Record<string, unknown>).createdAt ??
                                    "",
                                ),
                                acceptedAt:
                                  typeof ((entry as Record<string, unknown>).invite as Record<string, unknown>)
                                    .acceptedAt === "string"
                                    ? (((entry as Record<string, unknown>).invite as Record<string, unknown>)
                                        .acceptedAt as string)
                                    : null,
                              }
                            : null,
                      }
                    : {
                        id: undefined,
                        fullName: "",
                        roleTitle: "",
                        yearsExperience: null,
                        email: null,
                        userId: null,
                        platformAccessEnabled: false,
                        accessState: "none",
                        canManageInvites: false,
                        invite: null,
                      },
                )
              : [],
          });
          break;
        }
        case "organization.personnel.create": {
          const user = await services.authenticate(authToken);
          result = await services.createOrganizationPersonnel(user, {
            fullName: String(params.fullName ?? ""),
            roleTitle: String(params.roleTitle ?? ""),
            yearsExperience:
              typeof params.yearsExperience === "number" ? params.yearsExperience : null,
            email: typeof params.email === "string" ? params.email : null,
            platformAccessEnabled: Boolean(params.platformAccessEnabled),
            canManageInvites: Boolean(params.canManageInvites),
          });
          break;
        }
        case "organization.invites.accept": {
          const user = await services.authenticate(authToken);
          result = await services.acceptOrganizationInvite(user, String(params.inviteId ?? ""));
          break;
        }
        case "workspace.get": {
          const user = await services.authenticate(authToken);
          result = await services.getWorkspace(user);
          break;
        }
        case "research.scenarios.list": {
          const user = await services.authenticate(authToken);
          result = await services.listResearchScenarios(user);
          break;
        }
        case "research.scenarios.create": {
          const user = await services.authenticate(authToken);
          result = await services.createResearchScenario(user, {
            name: String(params.name ?? ""),
            summary: String(params.summary ?? ""),
            geography: String(params.geography ?? ""),
            businessModel: String(params.businessModel ?? ""),
            customers: Array.isArray(params.customers)
              ? params.customers.map((value) => String(value))
              : [],
            needs: Array.isArray(params.needs) ? params.needs.map((value) => String(value)) : [],
            tags: Array.isArray(params.tags) ? params.tags.map((value) => String(value)) : [],
          });
          break;
        }
        case "research.requests.create": {
          const user = await services.authenticate(authToken);
          result = await services.createResearchRequest(user, {
            scenarioId: String(params.scenarioId ?? ""),
          });
          break;
        }
        case "research.requests.get": {
          const user = await services.authenticate(authToken);
          result = await services.getResearchRequest(user, String(params.requestId ?? ""));
          break;
        }
        case "research.requests.run": {
          const user = await services.authenticate(authToken);
          result = await services.runResearchRequest(user, String(params.requestId ?? ""), {
            awaitCompletion:
              typeof params.awaitCompletion === "boolean" ? params.awaitCompletion : true,
          });
          break;
        }
        case "research.requests.steer": {
          const user = await services.authenticate(authToken);
          result = await services.steerResearchRequest(user, String(params.requestId ?? ""), {
            prompt: String(params.prompt ?? ""),
          });
          break;
        }
        case "research.run": {
          const user = await services.authenticate(authToken);
          result = await services.runResearch(user, String(params.scenarioId ?? ""));
          break;
        }
        case "grantReports.list": {
          const user = await services.authenticate(authToken);
          result = await services.listGrantReports(user);
          break;
        }
        case "catalog.grants.list": {
          const user = await services.authenticate(authToken);
          result = await services.listCatalogGrants(user, {
            bookmarked: params.bookmarked === true,
          });
          break;
        }
        case "catalog.grants.get": {
          const user = await services.authenticate(authToken);
          result = await services.getCatalogGrant(user, String(params.grantId ?? ""));
          break;
        }
        case "catalog.grants.promote": {
          const user = await services.authenticate(authToken);
          result = await services.promoteGrantToCatalogEntry(user, String(params.grantId ?? ""));
          break;
        }
        case "catalog.grants.bookmark": {
          const user = await services.authenticate(authToken);
          result = await services.setCatalogGrantBookmark(
            user,
            String(params.grantId ?? ""),
            Boolean(params.bookmarked),
          );
          break;
        }
        case "catalog.grants.createProposalWorkspace": {
          const user = await services.authenticate(authToken);
          result = await services.createProposalWorkspaceFromCatalogGrant(user, String(params.grantId ?? ""));
          break;
        }
        case "catalog.grants.createProposalJob": {
          const user = await services.authenticate(authToken);
          result = await services.createProposalJobFromCatalogGrant(user, String(params.grantId ?? ""));
          break;
        }
        case "catalog.grants.update": {
          const user = await services.authenticate(authToken);
          result = await services.updateCatalogGrant(user, String(params.grantId ?? ""), {
            title: typeof params.title === "string" ? params.title : undefined,
            sponsor: typeof params.sponsor === "string" ? params.sponsor : undefined,
            fundingType: typeof params.fundingType === "string" ? params.fundingType : undefined,
            fitScore:
              typeof params.fitScore === "number" && Number.isFinite(params.fitScore)
                ? params.fitScore
                : undefined,
            whyFit: typeof params.whyFit === "string" ? params.whyFit : undefined,
            eligibilityNotes: Array.isArray(params.eligibilityNotes)
              ? params.eligibilityNotes.map((entry) => String(entry))
              : undefined,
            amountSummary: typeof params.amountSummary === "string" ? params.amountSummary : undefined,
            deadlineSummary:
              typeof params.deadlineSummary === "string" ? params.deadlineSummary : undefined,
            geography: typeof params.geography === "string" ? params.geography : undefined,
            status: typeof params.status === "string" ? params.status : undefined,
            citations: Array.isArray(params.citations)
              ? params.citations.map((entry) => String(entry))
              : undefined,
            nextActions: Array.isArray(params.nextActions)
              ? params.nextActions.map((entry) => String(entry))
              : undefined,
            tags: Array.isArray(params.tags) ? params.tags.map((entry) => String(entry)) : undefined,
            provenanceNotes:
              params.provenanceNotes === null || typeof params.provenanceNotes === "string"
                ? (params.provenanceNotes as string | null | undefined)
                : undefined,
            freshnessNotes:
              params.freshnessNotes === null || typeof params.freshnessNotes === "string"
                ? (params.freshnessNotes as string | null | undefined)
                : undefined,
            pursuitNotes:
              params.pursuitNotes === null || typeof params.pursuitNotes === "string"
                ? (params.pursuitNotes as string | null | undefined)
                : undefined,
            lastValidatedAt:
              params.lastValidatedAt === null || typeof params.lastValidatedAt === "string"
                ? (params.lastValidatedAt as string | null | undefined)
                : undefined,
            repositoryBinding: parseRepositoryBindingInput(params.repositoryBinding),
          });
          break;
        }
        case "catalog.grants.startResearch": {
          const user = await services.authenticate(authToken);
          result = await services.startCatalogGrantResearch(user, String(params.grantId ?? ""), {
            researchFocus:
              params.researchFocus === null || typeof params.researchFocus === "string"
                ? (params.researchFocus as string | null | undefined)
                : undefined,
            awaitCompletion: params.awaitCompletion === false ? false : true,
          });
          break;
        }
        case "catalog.schemas.upsert": {
          const user = await services.authenticate(authToken);
          result = await services.upsertGrantApplicationSchema(user, String(params.grantId ?? ""), {
            name: String(params.name ?? ""),
            documentType: String(params.documentType ?? "") as
              | "grant_proposal"
              | "loi"
              | "budget_narrative"
              | "other",
            sections: Array.isArray(params.sections)
              ? params.sections.map((entry) => {
                  const record = typeof entry === "object" && entry !== null ? (entry as Record<string, unknown>) : {};
                  const validation =
                    typeof record.validation === "object" && record.validation !== null
                      ? (record.validation as Record<string, unknown>)
                      : {};
                  return {
                    key: String(record.key ?? ""),
                    title: String(record.title ?? ""),
                    stepName: typeof record.stepName === "string" ? record.stepName : null,
                    prompt: typeof record.prompt === "string" ? record.prompt : null,
                    examples: Array.isArray(record.examples) ? record.examples.map((value) => String(value)) : [],
                    validation: {
                      minWords: typeof validation.minWords === "number" ? validation.minWords : null,
                      maxWords: typeof validation.maxWords === "number" ? validation.maxWords : null,
                    },
                  };
                })
              : [],
          });
          break;
        }
        case "application.templates.create": {
          const user = await services.authenticate(authToken);
          result = await services.createApplicationTemplate(user, {
            name: String(params.name ?? ""),
            documentType: String(params.documentType ?? "") as
              | "grant_proposal"
              | "loi"
              | "budget_narrative"
              | "other",
            sections: Array.isArray(params.sections)
              ? params.sections.map((entry) => {
                  const record = typeof entry === "object" && entry !== null ? (entry as Record<string, unknown>) : {};
                  const validation =
                    typeof record.validation === "object" && record.validation !== null
                      ? (record.validation as Record<string, unknown>)
                      : {};
                  return {
                    key: String(record.key ?? ""),
                    title: String(record.title ?? ""),
                    stepName: typeof record.stepName === "string" ? record.stepName : null,
                    prompt: typeof record.prompt === "string" ? record.prompt : null,
                    examples: Array.isArray(record.examples) ? record.examples.map((value) => String(value)) : [],
                    validation: {
                      minWords: typeof validation.minWords === "number" ? validation.minWords : null,
                      maxWords: typeof validation.maxWords === "number" ? validation.maxWords : null,
                    },
                  };
                })
              : [],
          });
          break;
        }
        case "application.workspaces.create": {
          const user = await services.authenticate(authToken);
          result = await services.createApplicationWorkspace(user, {
            catalogGrantId: typeof params.catalogGrantId === "string" ? params.catalogGrantId : null,
            templateId: typeof params.templateId === "string" ? params.templateId : null,
            documentType: String(params.documentType ?? "") as
              | "grant_proposal"
              | "loi"
              | "budget_narrative"
              | "other",
          });
          break;
        }
        case "application.workspaces.get": {
          const user = await services.authenticate(authToken);
          result = await services.getApplicationWorkspace(user, String(params.workspaceId ?? ""));
          break;
        }
        case "application.workspaces.updateSection": {
          const user = await services.authenticate(authToken);
          result = await services.updateApplicationWorkspaceSection(
            user,
            String(params.workspaceId ?? ""),
            String(params.sectionId ?? ""),
            {
              content: String(params.content ?? ""),
            },
          );
          break;
        }
        case "application.workspaces.finalize": {
          const user = await services.authenticate(authToken);
          result = await services.finalizeApplicationWorkspace(user, String(params.workspaceId ?? ""));
          break;
        }
        case "application.workspaces.generateSection": {
          const user = await services.authenticate(authToken);
          result = await services.generateApplicationWorkspaceSection(
            user,
            String(params.workspaceId ?? ""),
            String(params.sectionId ?? ""),
            {
              providerConnectionId:
                typeof params.providerConnectionId === "string" ? params.providerConnectionId : null,
            },
          );
          break;
        }
        case "providerConnections.create": {
          const user = await services.authenticate(authToken);
          result = await services.createProviderConnection(user, {
            scope: String(params.scope ?? "") as "user" | "organization",
            provider: String(params.provider ?? ""),
            label: String(params.label ?? ""),
            authType: String(params.authType ?? "") as "byok" | "oauth",
            allowedArtifactTypes: Array.isArray(params.allowedArtifactTypes)
              ? params.allowedArtifactTypes.map((value) => String(value)) as Array<
                  "grant_catalog_entry" | "application_workspace" | "workspace_section" | "proposal_workspace"
                >
              : [],
          });
          break;
        }
        case "agentExecutions.list": {
          const user = await services.authenticate(authToken);
          result = await services.listAgentExecutions(user);
          break;
        }
        case "jobs.list": {
          await services.authenticate(authToken);
          result = await services.listJobs();
          break;
        }
        case "jobs.create": {
          const user = await services.authenticate(authToken);
          result = await services.createJob(user, {
            title: String(params.title ?? ""),
            description: String(params.description ?? ""),
            fundingNeed: String(params.fundingNeed ?? ""),
            targetType:
              typeof params.targetType === "string"
                ? (params.targetType as "grant_catalog_entry" | "application_workspace" | "workspace_section")
                : null,
            targetId: typeof params.targetId === "string" ? params.targetId : null,
            specialistRole:
              typeof params.specialistRole === "string"
                ? (params.specialistRole as
                    | "researcher"
                    | "writer"
                    | "reviewer"
                    | "submission_specialist")
                : null,
          });
          break;
        }
        case "offers.create": {
          const user = await services.authenticate(authToken);
          result = await services.createOffer(user, String(params.jobId ?? ""), {
            message: String(params.message ?? ""),
            amountUsd: String(params.amountUsd ?? ""),
            payoutAddress: String(params.payoutAddress ?? ""),
            specialistRole:
              typeof params.specialistRole === "string"
                ? (params.specialistRole as
                    | "researcher"
                    | "writer"
                    | "reviewer"
                    | "submission_specialist")
                : null,
          });
          break;
        }
        case "offers.accept": {
          const user = await services.authenticate(authToken);
          result = await services.acceptOffer(user, String(params.offerId ?? ""));
          break;
        }
        case "engagements.get": {
          const user = await services.authenticate(authToken);
          result = await services.getEngagement(user, String(params.engagementId ?? ""));
          break;
        }
        case "engagements.fund": {
          const user = await services.authenticate(authToken);
          const challenge = await services.getFundingChallenge(user, String(params.engagementId ?? ""), x402);
          return c.json(
            {
              jsonrpc: "2.0",
              id: request.id,
              error: {
                code: 402,
                message: "Payment required.",
                data: { paymentRequired: challenge },
              },
            },
            402,
          );
        }
        case "grants.updateQueue": {
          const user = await services.authenticate(authToken);
          result = await services.updateGrantQueueState(
            user,
            String(params.grantId ?? ""),
            {
              queueState:
                params.queueState === "inactive"
                  ? "inactive"
                  : params.queueState === "active"
                    ? "active"
                    : undefined,
              repositoryBinding: parseRepositoryBindingInput(params.repositoryBinding),
            },
          );
          break;
        }
        case "grants.createProposalJob": {
          const user = await services.authenticate(authToken);
          result = await services.createProposalJobFromGrant(user, String(params.grantId ?? ""));
          break;
        }
        case "proposalWorkspaces.createProposalJob": {
          const user = await services.authenticate(authToken);
          result = await services.createProposalJobFromProposalWorkspace(user, String(params.workspaceId ?? ""));
          break;
        }
        case "proposalWorkspaces.list": {
          const user = await services.authenticate(authToken);
          result = await services.listProposalWorkspaces(user);
          break;
        }
        case "proposalWorkspaces.create": {
          const user = await services.authenticate(authToken);
          result = await services.createProposalWorkspace(user, {
            trackedGrantId: typeof params.trackedGrantId === "string" ? params.trackedGrantId : null,
            catalogGrantId: typeof params.catalogGrantId === "string" ? params.catalogGrantId : null,
            manualOpportunity:
              params.manualOpportunity && typeof params.manualOpportunity === "object"
                ? {
                    title: String((params.manualOpportunity as Record<string, unknown>).title ?? ""),
                    sponsor: String((params.manualOpportunity as Record<string, unknown>).sponsor ?? ""),
                    fundingType: String((params.manualOpportunity as Record<string, unknown>).fundingType ?? ""),
                    amountSummary:
                      typeof (params.manualOpportunity as Record<string, unknown>).amountSummary === "string"
                        ? String((params.manualOpportunity as Record<string, unknown>).amountSummary)
                        : null,
                    deadlineSummary:
                      typeof (params.manualOpportunity as Record<string, unknown>).deadlineSummary === "string"
                        ? String((params.manualOpportunity as Record<string, unknown>).deadlineSummary)
                        : null,
                    geography:
                      typeof (params.manualOpportunity as Record<string, unknown>).geography === "string"
                        ? String((params.manualOpportunity as Record<string, unknown>).geography)
                        : null,
                    sourceUrl:
                      typeof (params.manualOpportunity as Record<string, unknown>).sourceUrl === "string"
                        ? String((params.manualOpportunity as Record<string, unknown>).sourceUrl)
                        : null,
                    notes:
                      typeof (params.manualOpportunity as Record<string, unknown>).notes === "string"
                        ? String((params.manualOpportunity as Record<string, unknown>).notes)
                        : null,
                  }
                : null,
          });
          break;
        }
        case "proposalWorkspaces.get": {
          const user = await services.authenticate(authToken);
          result = await services.getProposalWorkspace(user, String(params.workspaceId ?? ""));
          break;
        }
        case "proposalWorkspaces.update": {
          const user = await services.authenticate(authToken);
          result = await services.updateProposalWorkspace(user, String(params.workspaceId ?? ""), {
            stage:
              typeof params.stage === "string"
                ? (params.stage as "qualifying" | "drafting" | "outreach" | "submitted" | "awarded" | "declined" | "no_bid")
                : undefined,
            summary: typeof params.summary === "string" ? params.summary : undefined,
            nextSteps: Array.isArray(params.nextSteps) ? params.nextSteps.map((entry) => String(entry)) : undefined,
            openQuestions: Array.isArray(params.openQuestions)
              ? params.openQuestions.map((entry) => String(entry))
              : undefined,
            feasibilitySnapshot:
              params.feasibilitySnapshot === null
                ? null
                : params.feasibilitySnapshot && typeof params.feasibilitySnapshot === "object"
                  ? {
                      verdict: String((params.feasibilitySnapshot as Record<string, unknown>).verdict ?? ""),
                      confidence:
                        ((params.feasibilitySnapshot as Record<string, unknown>).confidence as
                          | "high"
                          | "medium"
                          | "low") ?? "medium",
                      blockers: Array.isArray((params.feasibilitySnapshot as Record<string, unknown>).blockers)
                        ? ((params.feasibilitySnapshot as Record<string, unknown>).blockers as unknown[]).map((entry) =>
                            String(entry),
                          )
                        : [],
                      assumptions: Array.isArray((params.feasibilitySnapshot as Record<string, unknown>).assumptions)
                        ? ((params.feasibilitySnapshot as Record<string, unknown>).assumptions as unknown[]).map((entry) =>
                            String(entry),
                          )
                        : [],
                      requiredDocuments: Array.isArray(
                        (params.feasibilitySnapshot as Record<string, unknown>).requiredDocuments,
                      )
                        ? ((params.feasibilitySnapshot as Record<string, unknown>).requiredDocuments as unknown[]).map(
                            (entry) => String(entry),
                          )
                        : [],
                      recommendedNextStep: String(
                        (params.feasibilitySnapshot as Record<string, unknown>).recommendedNextStep ?? "",
                      ),
                    }
                  : undefined,
            contacts: Array.isArray(params.contacts)
              ? params.contacts.map((contact) => {
                  const record = contact as Record<string, unknown>;
                  return {
                    name: String(record.name ?? ""),
                    roleTitle: typeof record.roleTitle === "string" ? record.roleTitle : null,
                    email: typeof record.email === "string" ? record.email : null,
                    phone: typeof record.phone === "string" ? record.phone : null,
                    organization: typeof record.organization === "string" ? record.organization : null,
                    notes: typeof record.notes === "string" ? record.notes : null,
                  };
                })
              : undefined,
            outreachEvents: Array.isArray(params.outreachEvents)
              ? params.outreachEvents.map((event) => {
                  const record = event as Record<string, unknown>;
                  return {
                    kind: (record.kind as "email" | "call" | "meeting" | "note" | "other") ?? "email",
                    direction: (record.direction as "outbound" | "inbound") ?? "outbound",
                    subject: typeof record.subject === "string" ? record.subject : null,
                    summary: String(record.summary ?? ""),
                    occurredAt: String(record.occurredAt ?? ""),
                  };
                })
              : undefined,
            outcome:
              params.outcome === null
                ? null
                : params.outcome && typeof params.outcome === "object"
                  ? {
                      status:
                        ((params.outcome as Record<string, unknown>).status as
                          | "submitted"
                          | "awarded"
                          | "declined"
                          | "no_bid") ?? "submitted",
                      summary: String((params.outcome as Record<string, unknown>).summary ?? ""),
                      recordedAt: String((params.outcome as Record<string, unknown>).recordedAt ?? ""),
                    }
                  : undefined,
            repositoryBinding: parseRepositoryBindingInput(params.repositoryBinding),
          });
          break;
        }
        case "proposalWorkspaces.runAction": {
          const user = await services.authenticate(authToken);
          result = await services.runProposalWorkspaceAction(user, String(params.workspaceId ?? ""), {
            action: String(params.action ?? "") as
              | "evaluate_feasibility"
              | "discover_contacts"
              | "draft_outreach"
              | "plan_next_steps"
              | "refresh_draft",
            providerConnectionId: String(params.providerConnectionId ?? ""),
          });
          break;
        }
        default:
          return c.json(
            {
              jsonrpc: "2.0",
              id: request.id,
              error: {
                code: -32601,
                message: `Method ${request.method} was not found.`,
              },
            },
            404,
          );
      }

      return c.json({
        jsonrpc: "2.0",
        id: request.id,
        result,
      });
    } catch (error) {
      const appError =
        error instanceof AppError
          ? error
          : new AppError(500, "internal_error", error instanceof Error ? error.message : "Unexpected error.");

      return new Response(
        JSON.stringify({
          jsonrpc: "2.0",
          id: request.id,
          error: {
            code: appError.status,
            message: appError.message,
            data: {
              errorCode: appError.code,
            },
          },
        }),
        {
          status: appError.status,
          headers: { "content-type": "application/json" },
        },
      );
    }
  });

  return app;
}
