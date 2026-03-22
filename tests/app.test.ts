// ABOUTME: Verifies Privy-backed auth handoff, agent-token flows, marketplace APIs, and discovery routes.
// ABOUTME: These tests exercise the hosted auth and persistence shape without requiring live Privy credentials.

import { expect, test } from "bun:test";
import { newDb } from "pg-mem";
import type { AgentMessage } from "@mariozechner/pi-agent-core";

import { StaticAuthProvider } from "../src/auth.js";
import { createApp } from "../src/app.js";
import type { FundingResearchResult } from "../src/agent.js";

function createTestDatabase() {
  const database = newDb();
  const adapter = database.adapters.createPg();
  return new adapter.Pool();
}

function createResearchResult(scenarioId: string): FundingResearchResult {
  return {
    brief: {
      businessCaseId: scenarioId,
      fundingHypotheses: ["Regional innovation grants fit the submitted business case."],
      priorityFundingTypes: ["grant", "technical assistance"],
      sponsorCategories: ["state agency", "economic development"],
      searchDomains: ["example.gov"],
      eligibilityRisks: ["Requires entity registration before submission."],
      researchTracks: [
        {
          name: "innovation",
          goal: "Find high-fit public innovation programs.",
          sponsorTypes: ["state"],
          fundingTypes: ["grant"],
          queries: ["innovation grant"],
          domains: ["example.gov"],
        },
      ],
    },
    report: {
      businessCaseId: scenarioId,
      executiveSummary: "Two credible grant paths stand out for this business case.",
      searchSummary: "Reviewed state innovation and workforce funding sources.",
      opportunities: [
        {
          title: "State Automation Grant",
          sponsor: "State Economic Development Office",
          fundingType: "grant",
          fitScore: 91,
          whyFit: "Funds automation and capacity-building work for growing firms.",
          eligibilityNotes: ["Requires a domestic operating entity."],
          amountSummary: "$50,000 to $150,000",
          deadlineSummary: "Rolling intake with quarterly review",
          geography: "United States",
          status: "open",
          citations: ["https://example.gov/grants/automation"],
          nextActions: ["Prepare operating metrics and project budget."],
        },
        {
          title: "Applied Research Voucher",
          sponsor: "Regional Innovation Network",
          fundingType: "technical assistance",
          fitScore: 82,
          whyFit: "Pairs specialist support with a small non-dilutive award.",
          eligibilityNotes: ["Requires an implementation timeline."],
          amountSummary: "$25,000 voucher",
          deadlineSummary: "Applications due in 30 days",
          geography: "United States",
          status: "open",
          citations: ["https://example.gov/grants/research-voucher"],
          nextActions: ["Draft the implementation milestones."],
        },
      ],
      rejectedLeads: [],
      nextActions: ["Choose one program to activate in the queue."],
    },
    messages: [],
  };
}

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });

  return { promise, resolve, reject };
}

function createTestApp(overrides: Record<string, unknown> = {}) {
  return createApp({
    authProvider: new StaticAuthProvider({
      browser_requester: { privyUserId: "did:privy:requester" },
      browser_specialist: { privyUserId: "did:privy:specialist" },
      browser_requester_two: { privyUserId: "did:privy:requester-two" },
    }),
    ...overrides,
  });
}

async function createProfile(
  app: ReturnType<typeof createApp>,
  accessToken: string,
  profile: {
    name: string;
    role: "requester" | "specialist";
    walletAddress?: string;
    smartWalletAddress?: string;
  },
) {
  const response = await app.request("/api/auth/profile", {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(profile),
  });

  const payload = await response.json();
  return { response, payload } as const;
}

async function createAgentToken(app: ReturnType<typeof createApp>, accessToken: string, label = "cli") {
  const response = await app.request("/api/auth/tokens", {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ label }),
  });

  const payload = await response.json();
  return { response, payload } as const;
}

test("docs and skill discovery routes describe Privy auth and agent tokens", async () => {
  const app = createTestApp();

  const healthResponse = await app.request("/health");
  const docsResponse = await app.request("/docs");
  const skillResponse = await app.request("/skill.md");

  expect(healthResponse.status).toBe(200);
  expect(await healthResponse.json()).toEqual({ status: "ok" });
  expect(docsResponse.status).toBe(200);
  expect(await docsResponse.text()).toContain("Privy");
  expect(skillResponse.status).toBe(200);
  expect(await skillResponse.text()).toContain("agent token");
});

test("browser dashboard serves the client app shell", async () => {
  const app = createTestApp();

  const response = await app.request("/");
  const html = await response.text();

  expect(response.status).toBe(200);
  expect(html).toContain("Grantfinder");
  expect(html).toContain('id="app"');
  expect(html).toContain("/assets/client.js");
  expect(html).toContain("window.__GRANTFINDER_CONFIG__ = ");
  expect(html).toContain('"x402Mode":"challenge"');
  expect(html).not.toContain("&quot;privyAppId&quot;");
});

test("browser auth can resolve a Privy session, create a local profile, and mint an agent token", async () => {
  const app = createTestApp();

  const sessionBeforeProfile = await app.request("/api/auth/session", {
    headers: {
      authorization: "Bearer browser_requester",
    },
  });

  expect(sessionBeforeProfile.status).toBe(200);
  expect(await sessionBeforeProfile.json()).toMatchObject({
    authenticated: true,
    user: null,
    identity: {
      privyUserId: "did:privy:requester",
    },
  });

  const profileResult = await createProfile(app, "browser_requester", {
    name: "Requester",
    role: "requester",
    walletAddress: "0x0000000000000000000000000000000000000001",
    smartWalletAddress: "0x0000000000000000000000000000000000000101",
  });

  expect(profileResult.response.status).toBe(201);
  expect(profileResult.payload.user).toMatchObject({
    name: "Requester",
    role: "requester",
    privyUserId: "did:privy:requester",
  });

  const tokenResult = await createAgentToken(app, "browser_requester");

  expect(tokenResult.response.status).toBe(201);
  expect(tokenResult.payload.secret).toContain("gfpat_");

  const tokenListResponse = await app.request("/api/auth/tokens", {
    headers: {
      authorization: "Bearer browser_requester",
    },
  });

  expect(tokenListResponse.status).toBe(200);
  expect(await tokenListResponse.json()).toMatchObject({
    tokens: [
      {
        label: "cli",
      },
    ],
  });
});

test("browser user can switch between requester and specialist flows on one profile", async () => {
  const app = createTestApp();

  const requesterProfile = await createProfile(app, "browser_requester", {
    name: "Operator",
    role: "requester",
    walletAddress: "0x0000000000000000000000000000000000000001",
    smartWalletAddress: "0x0000000000000000000000000000000000000101",
  });

  const specialistProfile = await createProfile(app, "browser_requester", {
    name: "Operator",
    role: "specialist",
    walletAddress: "0x0000000000000000000000000000000000000001",
    smartWalletAddress: "0x0000000000000000000000000000000000000101",
  });

  const sessionResponse = await app.request("/api/auth/session", {
    headers: {
      authorization: "Bearer browser_requester",
    },
  });

  expect(requesterProfile.response.status).toBe(201);
  expect(specialistProfile.response.status).toBe(201);
  expect(specialistProfile.payload.user.id).toBe(requesterProfile.payload.user.id);
  expect(await sessionResponse.json()).toMatchObject({
    user: {
      role: "specialist",
    },
  });
});

test("requester can author scenarios, run research requests, manage tracked grants, and create proposal jobs", async () => {
  const app = createTestApp({
    researchRunner: async ({ scenario }: { scenario: { id: string } }) => createResearchResult(scenario.id),
  });

  await createProfile(app, "browser_requester", {
    name: "Requester",
    role: "requester",
    walletAddress: "0x0000000000000000000000000000000000000001",
    smartWalletAddress: "0x0000000000000000000000000000000000000101",
  });

  const scenarioResponse = await app.request("/api/research/scenarios", {
    method: "POST",
    headers: {
      authorization: "Bearer browser_requester",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      name: "Warehouse robotics",
      summary: "A mid-market warehouse operator wants grant funding for robotics and proposal support.",
      geography: "United States",
      businessModel: "B2B logistics",
      customers: ["regional manufacturers"],
      needs: ["warehouse automation", "proposal writing support"],
      tags: ["automation", "logistics"],
    }),
  });
  const scenarioPayload = await scenarioResponse.json();

  const scenariosListResponse = await app.request("/api/research/scenarios", {
    headers: {
      authorization: "Bearer browser_requester",
    },
  });

  const requestResponse = await app.request("/api/research/requests", {
    method: "POST",
    headers: {
      authorization: "Bearer browser_requester",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      scenarioId: scenarioPayload.scenario.id,
    }),
  });
  const requestPayload = await requestResponse.json();

  const runResponse = await app.request(`/api/research/requests/${requestPayload.request.id}/run`, {
    method: "POST",
    headers: {
      authorization: "Bearer browser_requester",
    },
  });
  const runPayload = await runResponse.json();

  const firstGrantId = runPayload.grants[0].id as string;

  const grantUpdateResponse = await app.request(`/api/grants/${firstGrantId}`, {
    method: "PATCH",
    headers: {
      authorization: "Bearer browser_requester",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      queueState: "inactive",
    }),
  });

  const proposalJobResponse = await app.request(`/api/grants/${firstGrantId}/proposal-job`, {
    method: "POST",
    headers: {
      authorization: "Bearer browser_requester",
    },
  });

  const workspaceResponse = await app.request("/api/workspace", {
    headers: {
      authorization: "Bearer browser_requester",
    },
  });

  expect(scenarioResponse.status).toBe(201);
  expect(await scenariosListResponse.json()).toMatchObject({
    scenarios: expect.arrayContaining([
      expect.objectContaining({
        id: scenarioPayload.scenario.id,
        sourceType: "custom",
      }),
    ]),
  });
  expect(requestResponse.status).toBe(201);
  expect(requestPayload.request.status).toBe("draft");
  expect(runResponse.status).toBe(200);
  expect(runPayload.request.status).toBe("completed");
  expect(runPayload.grants).toHaveLength(2);
  expect(grantUpdateResponse.status).toBe(200);
  expect(await grantUpdateResponse.json()).toMatchObject({
    grant: {
      id: firstGrantId,
      queueState: "inactive",
    },
  });
  expect(proposalJobResponse.status).toBe(201);
  expect(await proposalJobResponse.json()).toMatchObject({
    job: {
      type: "grant_proposal",
      grantId: firstGrantId,
    },
  });
  expect(workspaceResponse.status).toBe(200);
  expect(await workspaceResponse.json()).toMatchObject({
    requests: [
      expect.objectContaining({
        id: requestPayload.request.id,
        status: "completed",
      }),
    ],
    grants: expect.arrayContaining([
      expect.objectContaining({
        id: firstGrantId,
        queueState: "inactive",
      }),
    ]),
  });
});

test("requester can monitor and steer an active research request while it runs", async () => {
  const completionGate = createDeferred<void>();
  const scenarioResult = createResearchResult("inverse-private-equity");
  const steeringMessages: unknown[] = [];
  type ResearchEvent = {
    type: "agent_start" | "turn_start" | "tool_execution_start" | "tool_execution_end";
    toolCallId?: string;
    toolName?: string;
    args?: unknown;
    result?: unknown;
    isError?: boolean;
  };

  const app = createTestApp({
    researchSessionFactory: () => {
      const listeners = new Set<(event: ResearchEvent) => void>();
      let report: FundingResearchResult["report"] | null = null;

      return {
        brief: scenarioResult.brief,
        prompt: "Run the grant research request.",
        getReport: () => report,
        getReportOrThrow: () => {
          if (!report) {
            throw new Error("The report has not been published yet.");
          }

          return report;
        },
        agent: {
          subscribe(listener: (event: ResearchEvent) => void) {
            listeners.add(listener);
            return () => listeners.delete(listener);
          },
          steer(message: AgentMessage) {
            steeringMessages.push(message);
          },
          async prompt() {
            for (const event of [
              { type: "agent_start" as const },
              { type: "turn_start" as const },
              {
                type: "tool_execution_start" as const,
                toolCallId: "search-1",
                toolName: "search_web",
                args: { query: "warehouse automation grants" },
              },
              {
                type: "tool_execution_end" as const,
                toolCallId: "search-1",
                toolName: "search_web",
                result: { content: [{ type: "text", text: "search complete" }] },
                isError: false,
              },
            ]) {
              for (const listener of listeners) {
                listener(event);
              }
            }

            await completionGate.promise;
            for (const listener of listeners) {
              listener({ type: "turn_start" });
            }
            for (const listener of listeners) {
              listener({
                type: "tool_execution_start",
                toolCallId: "publish-1",
                toolName: "publish_report",
                args: {},
              });
            }
            report = scenarioResult.report;
            for (const listener of listeners) {
              listener({
                type: "tool_execution_end",
                toolCallId: "publish-1",
                toolName: "publish_report",
                result: { content: [{ type: "text", text: "report published" }] },
                isError: false,
              });
            }
          },
        },
      };
    },
  });

  await createProfile(app, "browser_requester", {
    name: "Requester",
    role: "requester",
    walletAddress: "0x0000000000000000000000000000000000000001",
    smartWalletAddress: "0x0000000000000000000000000000000000000101",
  });

  const requestResponse = await app.request("/api/research/requests", {
    method: "POST",
    headers: {
      authorization: "Bearer browser_requester",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      scenarioId: "inverse-private-equity",
    }),
  });
  const requestPayload = await requestResponse.json();
  const requestId = requestPayload.request.id as string;

  const runResponse = await app.request(`/api/research/requests/${requestId}/run`, {
    method: "POST",
    headers: {
      authorization: "Bearer browser_requester",
      "content-type": "application/json",
    },
    body: JSON.stringify({ awaitCompletion: false }),
  });
  const runPayload = await runResponse.json();

  const detailResponse = await app.request(`/api/research/requests/${requestId}`, {
    headers: {
      authorization: "Bearer browser_requester",
    },
  });
  const detailPayload = await detailResponse.json();

  const steerResponse = await app.request(`/api/research/requests/${requestId}/steer`, {
    method: "POST",
    headers: {
      authorization: "Bearer browser_requester",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      prompt: "Prioritize direct grant dollars with concrete deadlines.",
    }),
  });
  const steerPayload = await steerResponse.json();

  completionGate.resolve();

  let completedPayload: Awaited<ReturnType<typeof detailResponse.json>> | null = null;
  for (let attempt = 0; attempt < 25; attempt += 1) {
    const response = await app.request(`/api/research/requests/${requestId}`, {
      headers: {
        authorization: "Bearer browser_requester",
      },
    });
    const payload = await response.json();
    if (payload.request.status === "completed") {
      completedPayload = payload;
      break;
    }
    await Bun.sleep(20);
  }

  expect(requestResponse.status).toBe(201);
  expect(runResponse.status).toBe(202);
  expect(runPayload.request.status).toBe("running");
  expect(runPayload.request.activity.length).toBeGreaterThan(0);
  expect(detailResponse.status).toBe(200);
  expect(detailPayload.request.progressSummary).toContain("Searching the web");
  expect(steerResponse.status).toBe(201);
  expect(steerPayload.request.steeringNotes[0]).toMatchObject({
    prompt: "Prioritize direct grant dollars with concrete deadlines.",
    status: "queued",
  });
  expect(steeringMessages).toHaveLength(1);
  expect(completedPayload).not.toBeNull();
  expect(completedPayload?.request).toMatchObject({
    status: "completed",
    runPhase: "completed",
  });
  expect(completedPayload?.request.steeringNotes[0]).toMatchObject({
    prompt: "Prioritize direct grant dollars with concrete deadlines.",
    status: "applied",
  });
  expect(completedPayload?.request.activity).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ title: "Searching for opportunities" }),
      expect.objectContaining({ title: "Steering applied" }),
      expect.objectContaining({ title: "Research run completed" }),
    ]),
  );
  expect(completedPayload?.request.grantCount).toBe(2);
});

test("agent tokens and Privy browser tokens can both drive marketplace flows", async () => {
  const app = createTestApp();

  await createProfile(app, "browser_requester", {
    name: "Requester",
    role: "requester",
    walletAddress: "0x0000000000000000000000000000000000000001",
    smartWalletAddress: "0x0000000000000000000000000000000000000101",
  });
  await createProfile(app, "browser_specialist", {
    name: "Specialist",
    role: "specialist",
    walletAddress: "0x0000000000000000000000000000000000000002",
    smartWalletAddress: "0x0000000000000000000000000000000000000202",
  });

  const tokenResult = await createAgentToken(app, "browser_requester");
  const agentToken = tokenResult.payload.secret as string;

  const createJobResponse = await app.request("/api/jobs", {
    method: "POST",
    headers: {
      authorization: `Bearer ${agentToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      title: "Apply for automation grants",
      description: "Need an operator to prepare and submit high-fit grant applications.",
      fundingNeed: "automation and workforce development",
    }),
  });

  const jobPayload = await createJobResponse.json();

  const createOfferResponse = await app.request(`/api/jobs/${jobPayload.job.id}/offers`, {
    method: "POST",
    headers: {
      authorization: "Bearer browser_specialist",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      message: "I will shortlist programs and prepare the applications.",
      amountUsd: "250.00",
      payoutAddress: "0x0000000000000000000000000000000000000002",
    }),
  });

  const offerPayload = await createOfferResponse.json();

  const acceptResponse = await app.request(`/api/offers/${offerPayload.offer.id}/accept`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${agentToken}`,
    },
  });
  const acceptedPayload = await acceptResponse.json();

  const fundResponse = await app.request(`/api/engagements/${acceptedPayload.engagement.id}/fund`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${agentToken}`,
    },
  });

  expect(createJobResponse.status).toBe(201);
  expect(createOfferResponse.status).toBe(201);
  expect(acceptResponse.status).toBe(200);
  expect(fundResponse.status).toBe(402);
  expect(fundResponse.headers.get("x-payment-protocol")).toBe("x402");
});

test("marketplace state persists across app instances that share the same database", async () => {
  const database = createTestDatabase();
  const authProvider = new StaticAuthProvider({
    browser_requester: { privyUserId: "did:privy:requester" },
  });
  const firstApp = createApp({
    persist: true,
    database,
    authProvider,
  });

  await createProfile(firstApp, "browser_requester", {
    name: "Requester",
    role: "requester",
    walletAddress: "0x0000000000000000000000000000000000000001",
    smartWalletAddress: "0x0000000000000000000000000000000000000101",
  });
  const tokenResult = await createAgentToken(firstApp, "browser_requester");
  const agentToken = tokenResult.payload.secret as string;

  const createJobResponse = await firstApp.request("/api/jobs", {
    method: "POST",
    headers: {
      authorization: `Bearer ${agentToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      title: "Apply for resilient freight programs",
      description: "Need help submitting grant applications for freight resilience.",
      fundingNeed: "freight resilience",
    }),
  });

  expect(createJobResponse.status).toBe(201);

  const secondApp = createApp({
    persist: true,
    database,
    authProvider,
  });

  const jobsResponse = await secondApp.request("/api/jobs", {
    headers: {
      authorization: `Bearer ${agentToken}`,
    },
  });

  expect(jobsResponse.status).toBe(200);
  expect(await jobsResponse.json()).toMatchObject({
    jobs: [
      {
        title: "Apply for resilient freight programs",
      },
    ],
  });
});
