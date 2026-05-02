// ABOUTME: Verifies Privy-backed auth handoff, agent-token flows, marketplace APIs, and discovery routes.
// ABOUTME: These tests exercise the hosted auth and persistence shape without requiring live Privy credentials.

import { expect, test } from "bun:test";
import { newDb } from "pg-mem";
import type { AgentMessage } from "@mariozechner/pi-agent-core";

import { StaticAuthProvider } from "../src/auth.js";
import { createApp } from "../src/app.js";
import type { FundingResearchResult } from "../src/agent.js";
import type { RepositoryPublicationAdapter } from "../src/repository-publication.js";

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

function createPublicationRecorder() {
  const commitCalls: Array<{ branchName: string; files: Array<{ path: string; content: string }> }> = [];
  const adapter = {
    async writeBranchCommit(input) {
      commitCalls.push(input);
      return { commitSha: `commit-${commitCalls.length}` };
    },
    async upsertPullRequest() {
      return {
        pullRequestUrl: "https://github.com/example/grants/pull/1",
        action: "created",
      } as const;
    },
  } satisfies RepositoryPublicationAdapter;

  return { adapter, commitCalls };
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

async function upsertOrganization(
  app: ReturnType<typeof createApp>,
  accessToken: string,
  organization: {
    name: string;
    website?: string | null;
    registrationCountry: string;
    registrationRegion?: string | null;
    organizationType: string;
    operatingScope: string;
    localOperatingAreas: string[];
    missionStatement: string;
    programs: string[];
    targetDemographics: string[];
    thematicAreas: string[];
    annualOperatingBudget: string;
    strategicPriorities: string[];
    emailUpdatesEnabled: boolean;
      personnel: Array<{
        fullName: string;
        roleTitle: string;
        yearsExperience?: number | null;
        email?: string | null;
      }>;
  },
) {
  const response = await app.request("/api/organization", {
    method: "PUT",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(organization),
  });

  const payload = await response.json();
  return { response, payload } as const;
}

async function createOrganizationPersonnel(
  app: ReturnType<typeof createApp>,
  accessToken: string,
  personnel: {
    fullName: string;
    roleTitle: string;
    yearsExperience?: number | null;
    email?: string | null;
    platformAccessEnabled: boolean;
    canManageInvites: boolean;
  },
) {
  const response = await app.request("/api/organization/personnel", {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(personnel),
  });

  const payload = await response.json();
  return { response, payload } as const;
}

async function acceptOrganizationInvite(
  app: ReturnType<typeof createApp>,
  accessToken: string,
  inviteId: string,
) {
  const response = await app.request(`/api/organization/invites/${inviteId}/accept`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
  });

  const payload = await response.json();
  return { response, payload } as const;
}

async function callJsonRpc(
  app: ReturnType<typeof createApp>,
  accessToken: string,
  method: string,
  params: Record<string, unknown> = {},
  id: string | number = "rpc-test",
) {
  const response = await app.request("/rpc", {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id,
      method,
      params,
    }),
  });

  const payload = await response.json();
  return { response, payload } as const;
}

test("docs and skill discovery routes describe deployed agent surfaces", async () => {
  const app = createTestApp();

  const healthResponse = await app.request("/health");
  const docsResponse = await app.request("/docs");
  const skillResponse = await app.request("/skill.md");

  expect(healthResponse.status).toBe(200);
  expect(await healthResponse.json()).toEqual({ status: "ok" });
  expect(docsResponse.status).toBe(200);
  const docsText = await docsResponse.text();
  expect(docsText).toContain("Privy");
  expect(docsText).toContain("GET /api/dashboard");
  expect(docsText).toContain("POST /api/grants/:id/catalog-entry");
  expect(docsText).toContain("POST /api/catalog/grants/:id/research-requests");
  expect(docsText).toContain("PATCH /api/application-workspaces/:id/sections/:sectionId");
  expect(docsText).toContain("application.workspaces.updateSection");
  expect(docsText).toContain("proposal workspaces, organization, catalog, applications, and providers");
  expect(docsText).toContain("POST /api/proposal-workspaces/:id/actions");
  expect(docsText).toContain("Repository bindings and publication");
  expect(docsText).toContain("RepositoryPublicationAdapter");
  expect(docsText).not.toContain("bun install");
  expect(docsText).not.toContain("DATABASE_URL");
  expect(skillResponse.status).toBe(200);
  const skillText = await skillResponse.text();
  expect(skillText).toContain("agent token");
  expect(skillText).toContain("GET /api/dashboard");
  expect(skillText).toContain("DELETE /api/auth/tokens/:id");
  expect(skillText).toContain("POST /api/catalog/grants/:id/research-requests");
  expect(skillText).toContain("PATCH /api/application-workspaces/:id/sections/:sectionId");
  expect(skillText).toContain("catalog.grants.update");
  expect(skillText).toContain("catalog.grants.startResearch");
  expect(skillText).toContain("application.workspaces.updateSection");
  expect(skillText).toContain("POST /api/proposal-workspaces/:id/actions");
  expect(skillText).toContain("proposalWorkspaces.runAction");
  expect(skillText).toContain("Repository bindings and publication");
  expect(skillText).toContain("grantfinder/");
  expect(skillText).toContain(
    "request marketplace, research dashboard, my requests, my grants, proposal workspaces, organization, catalog, applications, providers",
  );
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

test("requester can save a structured organization profile and see it in the workspace", async () => {
  const app = createTestApp();

  await createProfile(app, "browser_requester", {
    name: "Requester",
    role: "requester",
    walletAddress: "0x0000000000000000000000000000000000000001",
    smartWalletAddress: "0x0000000000000000000000000000000000000101",
  });

  const firstOrganizationResponse = await upsertOrganization(app, "browser_requester", {
    name: "Oak Harbor Community Labs",
    website: "https://oakharbor.example",
    registrationCountry: "United States",
    registrationRegion: "California",
    organizationType: "nonprofit",
    operatingScope: "regional",
    localOperatingAreas: ["Oakland", "Berkeley"],
    missionStatement: "Expand workforce access to applied robotics and technical training.",
    programs: ["Robotics bootcamps", "Small business automation clinics"],
    targetDemographics: ["low-income adults", "community college learners"],
    thematicAreas: ["workforce development", "stem education", "economic mobility"],
    annualOperatingBudget: "$500k-$1m",
    strategicPriorities: ["equipment access", "employer placement"],
    emailUpdatesEnabled: true,
    personnel: [
      {
        fullName: "Avery Stone",
        roleTitle: "Executive Director",
        yearsExperience: 12,
        email: "avery@oakharbor.example",
      },
      {
        fullName: "Jordan Lee",
        roleTitle: "Programs Director",
        yearsExperience: 8,
        email: "jordan@oakharbor.example",
      },
    ],
  });

  const secondOrganizationResponse = await upsertOrganization(app, "browser_requester", {
    name: "Oak Harbor Community Labs",
    website: "https://oakharbor.example",
    registrationCountry: "United States",
    registrationRegion: "California",
    organizationType: "nonprofit",
    operatingScope: "regional",
    localOperatingAreas: ["Oakland", "Berkeley", "Richmond"],
    missionStatement: "Expand workforce access to robotics, automation, and technical training.",
    programs: ["Robotics bootcamps", "Small business automation clinics"],
    targetDemographics: ["low-income adults", "community college learners"],
    thematicAreas: ["workforce development", "stem education", "economic mobility"],
    annualOperatingBudget: "$500k-$1m",
    strategicPriorities: ["equipment access", "employer placement", "grant readiness"],
    emailUpdatesEnabled: false,
    personnel: [
      {
        fullName: "Avery Stone",
        roleTitle: "Executive Director",
        yearsExperience: 12,
        email: "avery@oakharbor.example",
      },
    ],
  });

  const organizationResponse = await app.request("/api/organization", {
    headers: {
      authorization: "Bearer browser_requester",
    },
  });
  const workspaceResponse = await app.request("/api/workspace", {
    headers: {
      authorization: "Bearer browser_requester",
    },
  });

  expect(firstOrganizationResponse.response.status).toBe(201);
  expect(firstOrganizationResponse.payload.organization).toMatchObject({
    name: "Oak Harbor Community Labs",
    organizationType: "nonprofit",
    operatingScope: "regional",
    localOperatingAreas: ["Oakland", "Berkeley"],
    emailUpdatesEnabled: true,
    personnel: [
      expect.objectContaining({
        fullName: "Avery Stone",
        roleTitle: "Executive Director",
        yearsExperience: 12,
      }),
      expect.objectContaining({
        fullName: "Jordan Lee",
        roleTitle: "Programs Director",
        yearsExperience: 8,
      }),
    ],
  });
  expect(secondOrganizationResponse.response.status).toBe(201);
  expect(secondOrganizationResponse.payload.organization.id).toBe(
    firstOrganizationResponse.payload.organization.id,
  );
  expect(secondOrganizationResponse.payload.organization).toMatchObject({
    missionStatement: "Expand workforce access to robotics, automation, and technical training.",
    localOperatingAreas: ["Oakland", "Berkeley", "Richmond"],
    strategicPriorities: ["equipment access", "employer placement", "grant readiness"],
    emailUpdatesEnabled: false,
    personnel: [
      expect.objectContaining({
        fullName: "Avery Stone",
      }),
    ],
  });
  expect(organizationResponse.status).toBe(200);
  expect(await organizationResponse.json()).toMatchObject({
    organization: expect.objectContaining({
      id: firstOrganizationResponse.payload.organization.id,
      name: "Oak Harbor Community Labs",
      personnel: [
        expect.objectContaining({
          fullName: "Avery Stone",
          roleTitle: "Executive Director",
        }),
      ],
    }),
  });
  expect(workspaceResponse.status).toBe(200);
  expect(await workspaceResponse.json()).toMatchObject({
    organization: expect.objectContaining({
      id: firstOrganizationResponse.payload.organization.id,
      name: "Oak Harbor Community Labs",
      missionStatement: "Expand workforce access to robotics, automation, and technical training.",
      personnel: [
        expect.objectContaining({
          fullName: "Avery Stone",
          roleTitle: "Executive Director",
        }),
      ],
    }),
  });
});

test("organization invites create collaborator access and enforce invite permissions", async () => {
  const app = createTestApp();

  await createProfile(app, "browser_requester", {
    name: "Owner",
    role: "requester",
    walletAddress: "0x0000000000000000000000000000000000000001",
    smartWalletAddress: "0x0000000000000000000000000000000000000101",
  });
  await createProfile(app, "browser_requester_two", {
    name: "Collaborator",
    role: "requester",
    walletAddress: "0x0000000000000000000000000000000000000003",
    smartWalletAddress: "0x0000000000000000000000000000000000000303",
  });

  await upsertOrganization(app, "browser_requester", {
    name: "Oak Harbor Community Labs",
    website: "https://oakharbor.example",
    registrationCountry: "United States",
    registrationRegion: "California",
    organizationType: "nonprofit",
    operatingScope: "regional",
    localOperatingAreas: ["Oakland", "Berkeley"],
    missionStatement: "Expand workforce access to robotics, automation, and technical training.",
    programs: ["Robotics bootcamps", "Small business automation clinics"],
    targetDemographics: ["low-income adults", "community college learners"],
    thematicAreas: ["workforce development", "stem education", "economic mobility"],
    annualOperatingBudget: "$500k-$1m",
    strategicPriorities: ["equipment access", "employer placement", "grant readiness"],
    emailUpdatesEnabled: true,
    personnel: [],
  });

  const inviteResponse = await createOrganizationPersonnel(app, "browser_requester", {
    fullName: "Collaborator",
    roleTitle: "Grant Writer",
    yearsExperience: 6,
    email: "collaborator@oakharbor.example",
    platformAccessEnabled: true,
    canManageInvites: false,
  });
  const inviteId = inviteResponse.payload.personnel.invite.id as string;

  const acceptResponse = await acceptOrganizationInvite(app, "browser_requester_two", inviteId);

  const organizationResponse = await app.request("/api/organization", {
    headers: {
      authorization: "Bearer browser_requester_two",
    },
  });

  const forbiddenInviteResponse = await createOrganizationPersonnel(app, "browser_requester_two", {
    fullName: "Blocked Invite",
    roleTitle: "Program Manager",
    yearsExperience: 4,
    email: "blocked@oakharbor.example",
    platformAccessEnabled: true,
    canManageInvites: false,
  });

  expect(inviteResponse.response.status).toBe(201);
  expect(inviteResponse.payload.personnel).toMatchObject({
    fullName: "Collaborator",
    accessState: "invited",
    platformAccessEnabled: true,
    canManageInvites: false,
    invite: {
      id: inviteId,
      invitePath: expect.stringContaining(inviteId),
      acceptedAt: null,
    },
  });
  expect(acceptResponse.response.status).toBe(200);
  expect(acceptResponse.payload.personnel).toMatchObject({
    fullName: "Collaborator",
    accessState: "active",
    userId: expect.any(String),
    invite: {
      id: inviteId,
      acceptedAt: expect.any(String),
    },
  });
  expect(organizationResponse.status).toBe(200);
  expect(await organizationResponse.json()).toMatchObject({
    organization: expect.objectContaining({
      name: "Oak Harbor Community Labs",
      personnel: [
        expect.objectContaining({
          fullName: "Collaborator",
          accessState: "active",
          canManageInvites: false,
        }),
      ],
    }),
  });
  expect(forbiddenInviteResponse.response.status).toBe(403);
  expect(forbiddenInviteResponse.payload).toMatchObject({
    error: {
      code: "forbidden",
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

test("organization prefills are captured on research requests and application workspaces", async () => {
  let capturedScenario: Record<string, unknown> | null = null;
  const app = createTestApp({
    researchRunner: async ({ scenario }: { scenario: Record<string, unknown> }) => {
      capturedScenario = scenario;
      return createResearchResult(String(scenario.id));
    },
  });

  await createProfile(app, "browser_requester", {
    name: "Requester",
    role: "requester",
    walletAddress: "0x0000000000000000000000000000000000000001",
    smartWalletAddress: "0x0000000000000000000000000000000000000101",
  });
  await upsertOrganization(app, "browser_requester", {
    name: "Oak Harbor Community Labs",
    website: "https://oakharbor.example",
    registrationCountry: "United States",
    registrationRegion: "California",
    organizationType: "nonprofit",
    operatingScope: "regional",
    localOperatingAreas: ["Oakland", "Berkeley"],
    missionStatement: "Expand workforce access to robotics, automation, and technical training.",
    programs: ["Robotics bootcamps", "Small business automation clinics"],
    targetDemographics: ["low-income adults", "community college learners"],
    thematicAreas: ["workforce development", "stem education", "economic mobility"],
    annualOperatingBudget: "$500k-$1m",
    strategicPriorities: ["equipment access", "employer placement", "grant readiness"],
    emailUpdatesEnabled: true,
    personnel: [],
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

  const workspaceResponse = await app.request("/api/application-workspaces", {
    method: "POST",
    headers: {
      authorization: "Bearer browser_requester",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      documentType: "loi",
    }),
  });
  const workspacePayload = await workspaceResponse.json();

  await upsertOrganization(app, "browser_requester", {
    name: "Oak Harbor Community Labs",
    website: "https://oakharbor.example",
    registrationCountry: "United States",
    registrationRegion: "California",
    organizationType: "nonprofit",
    operatingScope: "regional",
    localOperatingAreas: ["Oakland", "Berkeley", "Richmond"],
    missionStatement: "Updated mission statement that should not overwrite saved snapshots.",
    programs: ["Robotics bootcamps", "Small business automation clinics"],
    targetDemographics: ["low-income adults", "community college learners"],
    thematicAreas: ["workforce development", "stem education", "economic mobility"],
    annualOperatingBudget: "$500k-$1m",
    strategicPriorities: ["equipment access", "employer placement", "grant readiness"],
    emailUpdatesEnabled: true,
    personnel: [],
  });

  const workspaceDetailResponse = await app.request(`/api/application-workspaces/${workspacePayload.workspace.id}`, {
    headers: {
      authorization: "Bearer browser_requester",
    },
  });

  expect(requestResponse.status).toBe(201);
  expect(requestPayload.request.organizationPrefill).toMatchObject({
    organizationName: "Oak Harbor Community Labs",
    missionStatement: "Expand workforce access to robotics, automation, and technical training.",
    localOperatingAreas: ["Oakland", "Berkeley"],
  });
  expect(runResponse.status).toBe(200);
  expect(capturedScenario).toMatchObject({
    organizationPrefill: {
      organizationName: "Oak Harbor Community Labs",
      missionStatement: "Expand workforce access to robotics, automation, and technical training.",
      localOperatingAreas: ["Oakland", "Berkeley"],
    },
  });
  expect(workspaceResponse.status).toBe(201);
  expect(workspacePayload.workspace).toMatchObject({
    organizationPrefill: {
      organizationName: "Oak Harbor Community Labs",
      missionStatement: "Expand workforce access to robotics, automation, and technical training.",
    },
    sections: [
      expect.objectContaining({
        key: "organization_profile",
        content: expect.stringContaining("Oak Harbor Community Labs"),
      }),
      expect.objectContaining({
        key: "need_statement",
        content: "",
      }),
    ],
  });
  expect(workspaceDetailResponse.status).toBe(200);
  expect(await workspaceDetailResponse.json()).toMatchObject({
    workspace: {
      id: workspacePayload.workspace.id,
      organizationPrefill: {
        organizationName: "Oak Harbor Community Labs",
        missionStatement: "Expand workforce access to robotics, automation, and technical training.",
        localOperatingAreas: ["Oakland", "Berkeley"],
      },
      sections: expect.arrayContaining([
        expect.objectContaining({
          key: "organization_profile",
          content: expect.stringContaining("Expand workforce access to robotics, automation, and technical training."),
        }),
      ]),
    },
  });
});

test("completed research requests create durable catalog entries and link tracked grants", async () => {
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
  const reportsResponse = await app.request("/api/grant-reports", {
    headers: {
      authorization: "Bearer browser_requester",
    },
  });
  const catalogResponse = await app.request("/api/catalog/grants", {
    headers: {
      authorization: "Bearer browser_requester",
    },
  });
  const workspaceResponse = await app.request("/api/workspace", {
    headers: {
      authorization: "Bearer browser_requester",
    },
  });

  expect(runResponse.status).toBe(200);
  expect(runPayload.grants).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        requestId: requestPayload.request.id,
        catalogGrantId: expect.any(String),
      }),
    ]),
  );
  expect(reportsResponse.status).toBe(200);
  expect(await reportsResponse.json()).toMatchObject({
    reports: [
      expect.objectContaining({
        requestId: requestPayload.request.id,
        opportunityCount: 2,
        opportunities: [
          expect.objectContaining({
            title: "State Automation Grant",
          }),
          expect.objectContaining({
            title: "Applied Research Voucher",
          }),
        ],
      }),
    ],
  });
  expect(catalogResponse.status).toBe(200);
  expect(await catalogResponse.json()).toMatchObject({
    grants: expect.arrayContaining([
      expect.objectContaining({
        sourceType: "research",
        sourceGrantId: runPayload.grants[0].id,
        sourceReportId: expect.any(String),
        lastResearchRequestId: requestPayload.request.id,
        title: "State Automation Grant",
      }),
      expect.objectContaining({
        sourceType: "research",
        sourceGrantId: runPayload.grants[1].id,
        sourceReportId: expect.any(String),
        lastResearchRequestId: requestPayload.request.id,
        title: "Applied Research Voucher",
      }),
    ]),
  });
  expect(workspaceResponse.status).toBe(200);
  expect(await workspaceResponse.json()).toMatchObject({
    reports: [
      expect.objectContaining({
        requestId: requestPayload.request.id,
        opportunityCount: 2,
      }),
    ],
    catalog: expect.arrayContaining([
      expect.objectContaining({
        sourceType: "research",
        lastResearchRequestId: requestPayload.request.id,
      }),
    ]),
  });
});

test("rediscovered opportunities update the same durable catalog entries across research requests", async () => {
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

  const firstRequestResponse = await app.request("/api/research/requests", {
    method: "POST",
    headers: {
      authorization: "Bearer browser_requester",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      scenarioId: scenarioPayload.scenario.id,
    }),
  });
  const firstRequestPayload = await firstRequestResponse.json();
  const firstRunResponse = await app.request(`/api/research/requests/${firstRequestPayload.request.id}/run`, {
    method: "POST",
    headers: {
      authorization: "Bearer browser_requester",
    },
  });
  const firstRunPayload = await firstRunResponse.json();

  const secondRequestResponse = await app.request("/api/research/requests", {
    method: "POST",
    headers: {
      authorization: "Bearer browser_requester",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      scenarioId: scenarioPayload.scenario.id,
    }),
  });
  const secondRequestPayload = await secondRequestResponse.json();
  const secondRunResponse = await app.request(`/api/research/requests/${secondRequestPayload.request.id}/run`, {
    method: "POST",
    headers: {
      authorization: "Bearer browser_requester",
    },
  });
  const secondRunPayload = await secondRunResponse.json();
  const catalogResponse = await app.request("/api/catalog/grants", {
    headers: {
      authorization: "Bearer browser_requester",
    },
  });
  const catalogPayload = await catalogResponse.json();
  const automationGrant = (catalogPayload.grants as Array<Record<string, unknown>>).find(
    (grant) => grant.title === "State Automation Grant",
  );

  expect(firstRunResponse.status).toBe(200);
  expect(secondRunResponse.status).toBe(200);
  expect(catalogResponse.status).toBe(200);
  expect(catalogPayload.grants).toHaveLength(2);
  expect(firstRunPayload.grants[0].catalogGrantId).toBe(secondRunPayload.grants[0].catalogGrantId);
  expect(automationGrant).toMatchObject({
    sourceGrantId: secondRunPayload.grants[0].id,
    lastResearchRequestId: secondRequestPayload.request.id,
  });
});

test("durable catalog entries can be enriched over REST and JSON-RPC", async () => {
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
  const catalogGrantId = String(runPayload.grants[0].catalogGrantId);

  const restUpdateResponse = await app.request(`/api/catalog/grants/${catalogGrantId}`, {
    method: "PATCH",
    headers: {
      authorization: "Bearer browser_requester",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      fitScore: 94,
      whyFit: "Confirmed fit after sponsor review.",
      eligibilityNotes: ["Requires a domestic operating entity.", "Needs a 1:1 equipment match."],
      amountSummary: "$75,000 to $175,000",
      deadlineSummary: "Applications close May 31, 2026",
      geography: "California",
      status: "validated",
      citations: ["https://example.gov/grants/automation", "https://example.gov/grants/faq"],
      nextActions: ["Gather the matching-funds letter.", "Prepare the project timeline."],
      tags: ["automation", "priority"],
      provenanceNotes: "Confirmed against the program guide and sponsor FAQ.",
      freshnessNotes: "Deadline reviewed this week.",
      pursuitNotes: "Strong fit for the next application cycle.",
      lastValidatedAt: "2026-04-07T12:00:00.000Z",
    }),
  });
  const rpcUpdateResponse = await callJsonRpc(app, "browser_requester", "catalog.grants.update", {
    grantId: catalogGrantId,
    freshnessNotes: "Deadline rechecked during proposal triage.",
    pursuitNotes: "Advance after confirming matching funds.",
  });
  const detailResponse = await app.request(`/api/catalog/grants/${catalogGrantId}`, {
    headers: {
      authorization: "Bearer browser_requester",
    },
  });
  const rpcDetailResponse = await callJsonRpc(app, "browser_requester", "catalog.grants.get", {
    grantId: catalogGrantId,
  });

  expect(runResponse.status).toBe(200);
  expect(restUpdateResponse.status).toBe(200);
  expect(rpcUpdateResponse.response.status).toBe(200);
  expect(detailResponse.status).toBe(200);
  expect(await detailResponse.json()).toMatchObject({
    grant: {
      id: catalogGrantId,
      title: "State Automation Grant",
      sponsor: "State Economic Development Office",
      fundingType: "grant",
      fitScore: 94,
      whyFit: "Confirmed fit after sponsor review.",
      eligibilityNotes: ["Requires a domestic operating entity.", "Needs a 1:1 equipment match."],
      amountSummary: "$75,000 to $175,000",
      deadlineSummary: "Applications close May 31, 2026",
      geography: "California",
      status: "validated",
      citations: ["https://example.gov/grants/automation", "https://example.gov/grants/faq"],
      nextActions: ["Gather the matching-funds letter.", "Prepare the project timeline."],
      tags: ["automation", "priority"],
      provenanceNotes: "Confirmed against the program guide and sponsor FAQ.",
      freshnessNotes: "Deadline rechecked during proposal triage.",
      pursuitNotes: "Advance after confirming matching funds.",
      lastValidatedAt: "2026-04-07T12:00:00.000Z",
    },
  });
  expect(rpcDetailResponse.payload).toMatchObject({
    result: {
      grant: {
        id: catalogGrantId,
        title: "State Automation Grant",
        sponsor: "State Economic Development Office",
        fundingType: "grant",
        fitScore: 94,
        whyFit: "Confirmed fit after sponsor review.",
        eligibilityNotes: ["Requires a domestic operating entity.", "Needs a 1:1 equipment match."],
        amountSummary: "$75,000 to $175,000",
        deadlineSummary: "Applications close May 31, 2026",
        geography: "California",
        status: "validated",
        citations: ["https://example.gov/grants/automation", "https://example.gov/grants/faq"],
        nextActions: ["Gather the matching-funds letter.", "Prepare the project timeline."],
        tags: ["automation", "priority"],
        provenanceNotes: "Confirmed against the program guide and sponsor FAQ.",
        freshnessNotes: "Deadline rechecked during proposal triage.",
        pursuitNotes: "Advance after confirming matching funds.",
        lastValidatedAt: "2026-04-07T12:00:00.000Z",
      },
    },
  });
});

test("durable catalog entries can start follow-up research and expose linked history", async () => {
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

  const initialRequestResponse = await app.request("/api/research/requests", {
    method: "POST",
    headers: {
      authorization: "Bearer browser_requester",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      scenarioId: scenarioPayload.scenario.id,
    }),
  });
  const initialRequestPayload = await initialRequestResponse.json();
  const initialRunResponse = await app.request(`/api/research/requests/${initialRequestPayload.request.id}/run`, {
    method: "POST",
    headers: {
      authorization: "Bearer browser_requester",
    },
  });
  const initialRunPayload = await initialRunResponse.json();
  const catalogGrantId = String(initialRunPayload.grants[0].catalogGrantId);

  const followUpResponse = await app.request(`/api/catalog/grants/${catalogGrantId}/research-requests`, {
    method: "POST",
    headers: {
      authorization: "Bearer browser_requester",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      researchFocus: "Verify whether matching funds are mandatory.",
      awaitCompletion: true,
    }),
  });
  const followUpPayload = await followUpResponse.json();
  const detailResponse = await app.request(`/api/catalog/grants/${catalogGrantId}`, {
    headers: {
      authorization: "Bearer browser_requester",
    },
  });

  expect(initialRunResponse.status).toBe(200);
  expect(followUpResponse.status).toBe(201);
  expect(followUpPayload.request).toMatchObject({
    sourceCatalogGrantId: catalogGrantId,
    researchFocus: "Verify whether matching funds are mandatory.",
    status: "completed",
  });
  expect(followUpPayload.grants).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        catalogGrantId,
      }),
    ]),
  );
  expect(detailResponse.status).toBe(200);
  expect(await detailResponse.json()).toMatchObject({
    grant: {
      id: catalogGrantId,
      lastResearchRequestId: followUpPayload.request.id,
    },
    latestReport: {
      requestId: followUpPayload.request.id,
      opportunityCount: 2,
    },
    researchRequests: expect.arrayContaining([
      expect.objectContaining({
        id: initialRequestPayload.request.id,
      }),
      expect.objectContaining({
        id: followUpPayload.request.id,
        sourceCatalogGrantId: catalogGrantId,
        researchFocus: "Verify whether matching funds are mandatory.",
      }),
    ]),
  });
});

test("durable catalog follow-up research is available over JSON-RPC", async () => {
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

  const initialRequestResponse = await app.request("/api/research/requests", {
    method: "POST",
    headers: {
      authorization: "Bearer browser_requester",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      scenarioId: scenarioPayload.scenario.id,
    }),
  });
  const initialRequestPayload = await initialRequestResponse.json();
  const initialRunResponse = await app.request(`/api/research/requests/${initialRequestPayload.request.id}/run`, {
    method: "POST",
    headers: {
      authorization: "Bearer browser_requester",
    },
  });
  const initialRunPayload = await initialRunResponse.json();
  const catalogGrantId = String(initialRunPayload.grants[0].catalogGrantId);

  const rpcRunResponse = await callJsonRpc(app, "browser_requester", "catalog.grants.startResearch", {
    grantId: catalogGrantId,
    researchFocus: "Look for updated cost-share language.",
    awaitCompletion: true,
  });
  const rpcDetailResponse = await callJsonRpc(app, "browser_requester", "catalog.grants.get", {
    grantId: catalogGrantId,
  });

  expect(initialRunResponse.status).toBe(200);
  expect(rpcRunResponse.response.status).toBe(200);
  expect(rpcRunResponse.payload).toMatchObject({
    result: {
      request: {
        sourceCatalogGrantId: catalogGrantId,
        researchFocus: "Look for updated cost-share language.",
        status: "completed",
      },
      grants: expect.arrayContaining([
        expect.objectContaining({
          catalogGrantId,
        }),
      ]),
    },
  });
  expect(rpcDetailResponse.payload).toMatchObject({
    result: {
      grant: {
        id: catalogGrantId,
        lastResearchRequestId: rpcRunResponse.payload.result.request.id,
      },
      researchRequests: expect.arrayContaining([
        expect.objectContaining({
          id: rpcRunResponse.payload.result.request.id,
          sourceCatalogGrantId: catalogGrantId,
        }),
      ]),
    },
  });
});

test("durable catalog entries can create and reopen proposal workspaces", async () => {
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
  const firstGrantId = String(runPayload.grants[0].id);
  const catalogGrantId = String(runPayload.grants[0].catalogGrantId);

  const createResponse = await app.request(`/api/catalog/grants/${catalogGrantId}/proposal-workspace`, {
    method: "POST",
    headers: {
      authorization: "Bearer browser_requester",
    },
  });
  const createPayload = await createResponse.json();

  const resumeResponse = await app.request(`/api/catalog/grants/${catalogGrantId}/proposal-workspace`, {
    method: "POST",
    headers: {
      authorization: "Bearer browser_requester",
    },
  });
  const resumePayload = await resumeResponse.json();

  const catalogDetailResponse = await app.request(`/api/catalog/grants/${catalogGrantId}`, {
    headers: {
      authorization: "Bearer browser_requester",
    },
  });

  expect(runResponse.status).toBe(200);
  expect(createResponse.status).toBe(201);
  expect(createPayload.workspace).toMatchObject({
    catalogGrantId,
    trackedGrantId: firstGrantId,
    opportunity: {
      sourceType: "catalog_grant",
      title: "State Automation Grant",
    },
  });
  expect(resumeResponse.status).toBe(200);
  expect(resumePayload.workspace).toMatchObject({
    id: createPayload.workspace.id,
    catalogGrantId,
  });
  expect(catalogDetailResponse.status).toBe(200);
  expect(await catalogDetailResponse.json()).toMatchObject({
    grant: {
      id: catalogGrantId,
    },
    proposalWorkspace: {
      id: createPayload.workspace.id,
      catalogGrantId,
    },
  });
});

test("durable catalog entries can create or attach proposal jobs and expose source context", async () => {
  const app = createTestApp({
    researchRunner: async ({ scenario }: { scenario: { id: string } }) => createResearchResult(scenario.id),
  });

  await createProfile(app, "browser_requester", {
    name: "Requester",
    role: "requester",
    walletAddress: "0x0000000000000000000000000000000000000001",
    smartWalletAddress: "0x0000000000000000000000000000000000000101",
  });
  await createProfile(app, "browser_specialist", {
    name: "Reviewer",
    role: "specialist",
    walletAddress: "0x0000000000000000000000000000000000000002",
    smartWalletAddress: "0x0000000000000000000000000000000000000202",
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
  const firstGrantId = String(runPayload.grants[0].id);
  const catalogGrantId = String(runPayload.grants[0].catalogGrantId);

  const createWorkspaceResponse = await app.request(`/api/catalog/grants/${catalogGrantId}/proposal-workspace`, {
    method: "POST",
    headers: {
      authorization: "Bearer browser_requester",
    },
  });
  const createWorkspacePayload = await createWorkspaceResponse.json();

  const firstJobResponse = await app.request(`/api/catalog/grants/${catalogGrantId}/proposal-job`, {
    method: "POST",
    headers: {
      authorization: "Bearer browser_requester",
    },
  });
  const firstJobPayload = await firstJobResponse.json();

  const secondJobResponse = await app.request(`/api/catalog/grants/${catalogGrantId}/proposal-job`, {
    method: "POST",
    headers: {
      authorization: "Bearer browser_requester",
    },
  });
  const secondJobPayload = await secondJobResponse.json();

  const jobsResponse = await app.request("/api/jobs", {
    headers: {
      authorization: "Bearer browser_requester",
    },
  });
  const catalogDetailResponse = await app.request(`/api/catalog/grants/${catalogGrantId}`, {
    headers: {
      authorization: "Bearer browser_requester",
    },
  });

  const offerResponse = await app.request(`/api/jobs/${firstJobPayload.job.id}/offers`, {
    method: "POST",
    headers: {
      authorization: "Bearer browser_specialist",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      message: "I can help draft the proposal and coordinate the submission.",
      amountUsd: "2500",
      payoutAddress: "0x0000000000000000000000000000000000000abc",
    }),
  });
  const offerPayload = await offerResponse.json();

  const acceptResponse = await app.request(`/api/offers/${offerPayload.offer.id}/accept`, {
    method: "POST",
    headers: {
      authorization: "Bearer browser_requester",
    },
  });
  const acceptPayload = await acceptResponse.json();

  const engagementResponse = await app.request(`/api/engagements/${acceptPayload.engagement.id}`, {
    headers: {
      authorization: "Bearer browser_requester",
    },
  });

  expect(runResponse.status).toBe(200);
  expect(createWorkspaceResponse.status).toBe(201);
  expect(firstJobResponse.status).toBe(201);
  expect(firstJobPayload).toMatchObject({
    job: {
      type: "grant_proposal",
      grantId: firstGrantId,
      catalogGrantId,
      targetType: "proposal_workspace",
      targetId: createWorkspacePayload.workspace.id,
    },
    workspace: {
      id: createWorkspacePayload.workspace.id,
      catalogGrantId,
    },
  });
  expect(secondJobResponse.status).toBe(200);
  expect(secondJobPayload).toMatchObject({
    job: {
      id: firstJobPayload.job.id,
      catalogGrantId,
    },
  });
  expect(jobsResponse.status).toBe(200);
  expect(await jobsResponse.json()).toMatchObject({
    jobs: expect.arrayContaining([
      expect.objectContaining({
        id: firstJobPayload.job.id,
        catalogGrantId,
        grantId: firstGrantId,
        targetType: "proposal_workspace",
        targetId: createWorkspacePayload.workspace.id,
      }),
    ]),
  });
  expect(catalogDetailResponse.status).toBe(200);
  expect(await catalogDetailResponse.json()).toMatchObject({
    grant: {
      id: catalogGrantId,
    },
    proposalWorkspace: {
      id: createWorkspacePayload.workspace.id,
      catalogGrantId,
      proposalJob: {
        id: firstJobPayload.job.id,
        catalogGrantId,
      },
    },
    proposalJob: {
      id: firstJobPayload.job.id,
      catalogGrantId,
    },
  });
  expect(acceptResponse.status).toBe(200);
  expect(engagementResponse.status).toBe(200);
  expect(await engagementResponse.json()).toMatchObject({
    engagement: {
      id: acceptPayload.engagement.id,
      catalogGrantId,
    },
  });
});

test("tracked opportunities can be promoted into catalog entries and bookmarked", async () => {
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

  const promoteResponse = await app.request(`/api/grants/${firstGrantId}/catalog-entry`, {
    method: "POST",
    headers: {
      authorization: "Bearer browser_requester",
    },
  });
  const promotePayload = await promoteResponse.json();

  const bookmarkResponse = await app.request(`/api/catalog/grants/${promotePayload.grant.id}/bookmark`, {
    method: "PUT",
    headers: {
      authorization: "Bearer browser_requester",
      "content-type": "application/json",
    },
    body: JSON.stringify({ bookmarked: true }),
  });
  const detailResponse = await app.request(`/api/catalog/grants/${promotePayload.grant.id}`, {
    headers: {
      authorization: "Bearer browser_requester",
    },
  });
  const catalogResponse = await app.request("/api/catalog/grants?bookmarked=true", {
    headers: {
      authorization: "Bearer browser_requester",
    },
  });
  const workspaceResponse = await app.request("/api/workspace", {
    headers: {
      authorization: "Bearer browser_requester",
    },
  });

  expect(promoteResponse.status).toBe(201);
  expect(promotePayload.grant).toMatchObject({
    sourceGrantId: firstGrantId,
    sourceReportId: expect.any(String),
    sourceType: "promoted",
    lastResearchRequestId: requestPayload.request.id,
    title: "State Automation Grant",
    isBookmarked: false,
  });
  expect(bookmarkResponse.status).toBe(200);
  expect(await bookmarkResponse.json()).toMatchObject({
    grant: {
      id: promotePayload.grant.id,
      isBookmarked: true,
    },
  });
  expect(detailResponse.status).toBe(200);
  expect(await detailResponse.json()).toMatchObject({
    grant: {
      id: promotePayload.grant.id,
      isBookmarked: true,
      title: "State Automation Grant",
    },
  });
  expect(catalogResponse.status).toBe(200);
  expect(await catalogResponse.json()).toMatchObject({
    grants: [
      expect.objectContaining({
        id: promotePayload.grant.id,
        isBookmarked: true,
      }),
    ],
  });
  expect(workspaceResponse.status).toBe(200);
  expect(await workspaceResponse.json()).toMatchObject({
    catalog: expect.arrayContaining([
      expect.objectContaining({
        id: promotePayload.grant.id,
        isBookmarked: true,
      }),
    ]),
  });
});

test("requester can create a schema-backed application workspace, generate sections, and finalize a proposal", async () => {
  const app = createTestApp({
    researchRunner: async ({ scenario }: { scenario: { id: string } }) => createResearchResult(scenario.id),
  });

  await createProfile(app, "browser_requester", {
    name: "Requester",
    role: "requester",
    walletAddress: "0x0000000000000000000000000000000000000001",
    smartWalletAddress: "0x0000000000000000000000000000000000000101",
  });
  await upsertOrganization(app, "browser_requester", {
    name: "Oak Harbor Community Labs",
    website: "https://oakharbor.example",
    registrationCountry: "United States",
    registrationRegion: "California",
    organizationType: "nonprofit",
    operatingScope: "regional",
    localOperatingAreas: ["Oakland", "Berkeley"],
    missionStatement: "Expand workforce access to robotics, automation, and technical training.",
    programs: ["Robotics bootcamps", "Small business automation clinics"],
    targetDemographics: ["low-income adults", "community college learners"],
    thematicAreas: ["workforce development", "stem education", "economic mobility"],
    annualOperatingBudget: "$500k-$1m",
    strategicPriorities: ["equipment access", "employer placement", "grant readiness"],
    emailUpdatesEnabled: true,
    personnel: [
      {
        fullName: "Avery Stone",
        roleTitle: "Executive Director",
        yearsExperience: 12,
        email: "avery@oakharbor.example",
      },
    ],
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

  const promoteResponse = await app.request(`/api/grants/${runPayload.grants[0].id}/catalog-entry`, {
    method: "POST",
    headers: {
      authorization: "Bearer browser_requester",
    },
  });
  const promotePayload = await promoteResponse.json();

  const schemaResponse = await app.request(`/api/catalog/grants/${promotePayload.grant.id}/schema`, {
    method: "PUT",
    headers: {
      authorization: "Bearer browser_requester",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      name: "Automation grant application",
      documentType: "grant_proposal",
      sections: [
        {
          key: "organization_profile",
          title: "Organization profile",
          prompt: "Describe the applicant organization and mission fit.",
          examples: ["Our nonprofit trains adults for automation careers."],
          validation: {
            minWords: 50,
            maxWords: 200,
          },
        },
        {
          key: "project_summary",
          title: "Project summary",
          prompt: "Describe the proposed automation project.",
          examples: ["We will expand robotics training and employer pilots."],
          validation: {
            minWords: 75,
            maxWords: 250,
          },
        },
      ],
    }),
  });
  const schemaPayload = await schemaResponse.json();
  const catalogDetailResponse = await app.request(`/api/catalog/grants/${promotePayload.grant.id}`, {
    headers: {
      authorization: "Bearer browser_requester",
    },
  });

  const workspaceResponse = await app.request("/api/application-workspaces", {
    method: "POST",
    headers: {
      authorization: "Bearer browser_requester",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      catalogGrantId: promotePayload.grant.id,
      documentType: "grant_proposal",
    }),
  });
  const workspacePayload = await workspaceResponse.json();
  const editableSection = workspacePayload.workspace.sections[0];
  const generatedSection = workspacePayload.workspace.sections[1];
  const updateResponse = await app.request(
    `/api/application-workspaces/${workspacePayload.workspace.id}/sections/${editableSection.id}`,
    {
      method: "PATCH",
      headers: {
        authorization: "Bearer browser_requester",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        content: "Updated organization narrative tailored to the automation grant opportunity.",
      }),
    },
  );

  const generateResponse = await app.request(
    `/api/application-workspaces/${workspacePayload.workspace.id}/sections/${generatedSection.id}/generate`,
    {
      method: "POST",
      headers: {
        authorization: "Bearer browser_requester",
        "content-type": "application/json",
      },
      body: JSON.stringify({}),
    },
  );
  const finalizeResponse = await app.request(`/api/application-workspaces/${workspacePayload.workspace.id}/finalize`, {
    method: "POST",
    headers: {
      authorization: "Bearer browser_requester",
    },
  });
  const detailResponse = await app.request(`/api/application-workspaces/${workspacePayload.workspace.id}`, {
    headers: {
      authorization: "Bearer browser_requester",
    },
  });

  expect(schemaResponse.status).toBe(201);
  expect(schemaPayload.schema).toMatchObject({
    name: "Automation grant application",
    documentType: "grant_proposal",
    sections: [
      expect.objectContaining({
        key: "organization_profile",
        title: "Organization profile",
      }),
      expect.objectContaining({
        key: "project_summary",
        title: "Project summary",
      }),
    ],
  });
  expect(catalogDetailResponse.status).toBe(200);
  expect(await catalogDetailResponse.json()).toMatchObject({
    grant: expect.objectContaining({
      id: promotePayload.grant.id,
      title: "State Automation Grant",
    }),
    schema: expect.objectContaining({
      name: "Automation grant application",
      sections: [
        expect.objectContaining({
          key: "organization_profile",
        }),
        expect.objectContaining({
          key: "project_summary",
        }),
      ],
    }),
  });
  expect(workspaceResponse.status).toBe(201);
  expect(workspacePayload.workspace).toMatchObject({
    catalogGrantId: promotePayload.grant.id,
    documentType: "grant_proposal",
    state: "draft",
    sections: [
      expect.objectContaining({
        key: "organization_profile",
        content: expect.stringContaining("Oak Harbor Community Labs"),
      }),
      expect.objectContaining({
        key: "project_summary",
        content: "",
      }),
    ],
  });
  expect(updateResponse.status).toBe(200);
  expect(await updateResponse.json()).toMatchObject({
    section: {
      id: editableSection.id,
      content: "Updated organization narrative tailored to the automation grant opportunity.",
    },
  });
  expect(generateResponse.status).toBe(200);
  expect(await generateResponse.json()).toMatchObject({
    section: {
      id: generatedSection.id,
      content: expect.stringContaining("State Automation Grant"),
    },
  });
  expect(finalizeResponse.status).toBe(200);
  expect(await finalizeResponse.json()).toMatchObject({
    workspace: {
      id: workspacePayload.workspace.id,
      state: "proposal",
    },
  });
  expect(detailResponse.status).toBe(200);
  expect(await detailResponse.json()).toMatchObject({
    workspace: {
      id: workspacePayload.workspace.id,
      state: "proposal",
      sections: [
        expect.objectContaining({
          key: "organization_profile",
          content: "Updated organization narrative tailored to the automation grant opportunity.",
        }),
        expect.objectContaining({
          id: generatedSection.id,
          content: expect.stringContaining("State Automation Grant"),
        }),
      ],
    },
  });
});

test("custom templates, scoped service requests, and provider-backed generation stay attached to the targeted artifact", async () => {
  const app = createTestApp();

  await createProfile(app, "browser_requester", {
    name: "Requester",
    role: "requester",
    walletAddress: "0x0000000000000000000000000000000000000001",
    smartWalletAddress: "0x0000000000000000000000000000000000000101",
  });
  await createProfile(app, "browser_specialist", {
    name: "Reviewer",
    role: "specialist",
    walletAddress: "0x0000000000000000000000000000000000000002",
    smartWalletAddress: "0x0000000000000000000000000000000000000202",
  });
  await upsertOrganization(app, "browser_requester", {
    name: "Oak Harbor Community Labs",
    website: "https://oakharbor.example",
    registrationCountry: "United States",
    registrationRegion: "California",
    organizationType: "nonprofit",
    operatingScope: "regional",
    localOperatingAreas: ["Oakland", "Berkeley"],
    missionStatement: "Expand workforce access to robotics, automation, and technical training.",
    programs: ["Robotics bootcamps", "Small business automation clinics"],
    targetDemographics: ["low-income adults", "community college learners"],
    thematicAreas: ["workforce development", "stem education", "economic mobility"],
    annualOperatingBudget: "$500k-$1m",
    strategicPriorities: ["equipment access", "employer placement", "grant readiness"],
    emailUpdatesEnabled: true,
    personnel: [
      {
        fullName: "Avery Stone",
        roleTitle: "Executive Director",
        yearsExperience: 12,
        email: "avery@oakharbor.example",
      },
    ],
  });

  const templateResponse = await app.request("/api/application-templates", {
    method: "POST",
    headers: {
      authorization: "Bearer browser_requester",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      name: "LOI starter",
      documentType: "loi",
      sections: [
        {
          key: "organization_profile",
          title: "Organization profile",
        },
        {
          key: "need_statement",
          title: "Need statement",
          prompt: "Explain the problem and why the organization is well positioned to solve it.",
        },
      ],
    }),
  });
  const templatePayload = await templateResponse.json();

  const workspaceResponse = await app.request("/api/application-workspaces", {
    method: "POST",
    headers: {
      authorization: "Bearer browser_requester",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      templateId: templatePayload.template.id,
      documentType: "loi",
    }),
  });
  const workspacePayload = await workspaceResponse.json();
  const targetedSection = workspacePayload.workspace.sections[1];

  const providerResponse = await app.request("/api/provider-connections", {
    method: "POST",
    headers: {
      authorization: "Bearer browser_requester",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      scope: "user",
      provider: "openai",
      label: "Team OpenAI",
      authType: "byok",
      allowedArtifactTypes: ["workspace_section"],
    }),
  });
  const providerPayload = await providerResponse.json();

  const generateResponse = await app.request(
    `/api/application-workspaces/${workspacePayload.workspace.id}/sections/${targetedSection.id}/generate`,
    {
      method: "POST",
      headers: {
        authorization: "Bearer browser_requester",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        providerConnectionId: providerPayload.connection.id,
      }),
    },
  );

  const executionResponse = await app.request("/api/agent-executions", {
    headers: {
      authorization: "Bearer browser_requester",
    },
  });
  const workspaceAggregateResponse = await app.request("/api/workspace", {
    headers: {
      authorization: "Bearer browser_requester",
    },
  });

  const createJobResponse = await app.request("/api/jobs", {
    method: "POST",
    headers: {
      authorization: "Bearer browser_requester",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      title: "Review the need statement",
      description: "Request a specialist review for the LOI need statement section.",
      fundingNeed: "Section review support",
      targetType: "workspace_section",
      targetId: targetedSection.id,
      specialistRole: "reviewer",
    }),
  });
  const jobPayload = await createJobResponse.json();

  const offerResponse = await app.request(`/api/jobs/${jobPayload.job.id}/offers`, {
    method: "POST",
    headers: {
      authorization: "Bearer browser_specialist",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      message: "I can review the section and tighten the case for funding.",
      amountUsd: "175",
      payoutAddress: "0x0000000000000000000000000000000000000abc",
      specialistRole: "reviewer",
    }),
  });
  const offerPayload = await offerResponse.json();

  const acceptResponse = await app.request(`/api/offers/${offerPayload.offer.id}/accept`, {
    method: "POST",
    headers: {
      authorization: "Bearer browser_requester",
    },
  });
  const engagementPayload = await acceptResponse.json();

  expect(templateResponse.status).toBe(201);
  expect(templatePayload.template).toMatchObject({
    name: "LOI starter",
    documentType: "loi",
  });
  expect(workspaceResponse.status).toBe(201);
  expect(workspacePayload.workspace.sections).toEqual([
    expect.objectContaining({
      key: "organization_profile",
      content: expect.stringContaining("Oak Harbor Community Labs"),
    }),
    expect.objectContaining({
      key: "need_statement",
      content: "",
    }),
  ]);
  expect(providerResponse.status).toBe(201);
  expect(providerPayload.connection).toMatchObject({
    provider: "openai",
    allowedArtifactTypes: ["workspace_section"],
  });
  expect(generateResponse.status).toBe(200);
  expect(await generateResponse.json()).toMatchObject({
    section: {
      id: targetedSection.id,
      content: expect.stringContaining("Oak Harbor Community Labs"),
    },
  });
  expect(executionResponse.status).toBe(200);
  expect(await executionResponse.json()).toMatchObject({
    executions: [
      expect.objectContaining({
        providerConnectionId: providerPayload.connection.id,
        targetType: "workspace_section",
        targetId: targetedSection.id,
      }),
    ],
  });
  expect(workspaceAggregateResponse.status).toBe(200);
  expect(await workspaceAggregateResponse.json()).toMatchObject({
    applicationTemplates: [
      expect.objectContaining({
        id: templatePayload.template.id,
        name: "LOI starter",
      }),
    ],
    applicationWorkspaces: [
      expect.objectContaining({
        id: workspacePayload.workspace.id,
        templateId: templatePayload.template.id,
      }),
    ],
    providerConnections: [
      expect.objectContaining({
        id: providerPayload.connection.id,
        provider: "openai",
      }),
    ],
    executions: [
      expect.objectContaining({
        providerConnectionId: providerPayload.connection.id,
        targetId: targetedSection.id,
      }),
    ],
  });
  expect(createJobResponse.status).toBe(201);
  expect(jobPayload.job).toMatchObject({
    targetType: "workspace_section",
    targetId: targetedSection.id,
    specialistRole: "reviewer",
  });
  expect(offerResponse.status).toBe(201);
  expect(offerPayload.offer).toMatchObject({
    specialistRole: "reviewer",
  });
  expect(acceptResponse.status).toBe(200);
  expect(engagementPayload.engagement).toMatchObject({
    targetType: "workspace_section",
    targetId: targetedSection.id,
    specialistRole: "reviewer",
  });
});

test("grant-backed proposal workspaces persist pursuit state and stay readable to organization collaborators", async () => {
  const app = createTestApp({
    researchRunner: async ({ scenario }: { scenario: { id: string } }) => createResearchResult(scenario.id),
  });

  await createProfile(app, "browser_requester", {
    name: "Owner",
    role: "requester",
    walletAddress: "0x0000000000000000000000000000000000000001",
    smartWalletAddress: "0x0000000000000000000000000000000000000101",
  });
  await createProfile(app, "browser_requester_two", {
    name: "Collaborator",
    role: "requester",
    walletAddress: "0x0000000000000000000000000000000000000003",
    smartWalletAddress: "0x0000000000000000000000000000000000000303",
  });
  await upsertOrganization(app, "browser_requester", {
    name: "Oak Harbor Community Labs",
    website: "https://oakharbor.example",
    registrationCountry: "United States",
    registrationRegion: "California",
    organizationType: "nonprofit",
    operatingScope: "regional",
    localOperatingAreas: ["Oakland", "Berkeley"],
    missionStatement: "Expand workforce access to robotics, automation, and technical training.",
    programs: ["Robotics bootcamps", "Small business automation clinics"],
    targetDemographics: ["low-income adults", "community college learners"],
    thematicAreas: ["workforce development", "stem education", "economic mobility"],
    annualOperatingBudget: "$500k-$1m",
    strategicPriorities: ["equipment access", "employer placement", "grant readiness"],
    emailUpdatesEnabled: true,
    personnel: [],
  });
  const inviteResponse = await createOrganizationPersonnel(app, "browser_requester", {
    fullName: "Collaborator",
    roleTitle: "Grant Writer",
    yearsExperience: 6,
    email: "collaborator@oakharbor.example",
    platformAccessEnabled: true,
    canManageInvites: false,
  });
  const inviteId = inviteResponse.payload.personnel.invite.id as string;
  const acceptResponse = await acceptOrganizationInvite(app, "browser_requester_two", inviteId);

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
  const grantId = runPayload.grants[0].id as string;

  const createResponse = await app.request(`/api/grants/${grantId}/proposal-workspace`, {
    method: "POST",
    headers: {
      authorization: "Bearer browser_requester",
    },
  });
  const createPayload = await createResponse.json();

  const resumeResponse = await app.request(`/api/grants/${grantId}/proposal-workspace`, {
    method: "POST",
    headers: {
      authorization: "Bearer browser_requester",
    },
  });
  const resumePayload = await resumeResponse.json();

  const updateResponse = await app.request(`/api/proposal-workspaces/${createPayload.workspace.id}`, {
    method: "PATCH",
    headers: {
      authorization: "Bearer browser_requester",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      stage: "drafting",
      summary: "Qualified the opportunity and started the first proposal draft.",
      nextSteps: ["Draft the project narrative", "Confirm the budget assumptions"],
      openQuestions: ["Does the sponsor require employer commitment letters?"],
      feasibilitySnapshot: {
        verdict: "go",
        confidence: "high",
        blockers: ["Need updated program metrics for the budget narrative."],
        assumptions: ["The sponsor will accept our current nonprofit registration."],
        requiredDocuments: ["Project budget", "Organization financials"],
        recommendedNextStep: "Draft the narrative and collect supporting documents.",
      },
    }),
  });

  const collaboratorListResponse = await app.request("/api/proposal-workspaces", {
    headers: {
      authorization: "Bearer browser_requester_two",
    },
  });
  const collaboratorDetailResponse = await app.request(`/api/proposal-workspaces/${createPayload.workspace.id}`, {
    headers: {
      authorization: "Bearer browser_requester_two",
    },
  });
  const collaboratorWorkspaceResponse = await app.request("/api/workspace", {
    headers: {
      authorization: "Bearer browser_requester_two",
    },
  });

  expect(inviteResponse.response.status).toBe(201);
  expect(acceptResponse.response.status).toBe(200);
  expect(createResponse.status).toBe(201);
  expect(createPayload.workspace).toMatchObject({
    trackedGrantId: grantId,
    stage: "qualifying",
    opportunity: {
      sourceType: "tracked_grant",
      title: "State Automation Grant",
      sponsor: "State Economic Development Office",
    },
  });
  expect(resumeResponse.status).toBe(200);
  expect(resumePayload.workspace.id).toBe(createPayload.workspace.id);
  expect(updateResponse.status).toBe(200);
  expect(await updateResponse.json()).toMatchObject({
    workspace: {
      id: createPayload.workspace.id,
      stage: "drafting",
      summary: "Qualified the opportunity and started the first proposal draft.",
      nextSteps: ["Draft the project narrative", "Confirm the budget assumptions"],
      openQuestions: ["Does the sponsor require employer commitment letters?"],
      feasibilitySnapshot: {
        verdict: "go",
        confidence: "high",
      },
    },
  });
  expect(collaboratorListResponse.status).toBe(200);
  expect(await collaboratorListResponse.json()).toMatchObject({
    workspaces: [
      expect.objectContaining({
        id: createPayload.workspace.id,
        trackedGrantId: grantId,
        stage: "drafting",
      }),
    ],
  });
  expect(collaboratorDetailResponse.status).toBe(200);
  expect(await collaboratorDetailResponse.json()).toMatchObject({
    workspace: {
      id: createPayload.workspace.id,
      stage: "drafting",
      summary: "Qualified the opportunity and started the first proposal draft.",
      feasibilitySnapshot: {
        blockers: ["Need updated program metrics for the budget narrative."],
        recommendedNextStep: "Draft the narrative and collect supporting documents.",
      },
    },
  });
  expect(collaboratorWorkspaceResponse.status).toBe(200);
  expect(await collaboratorWorkspaceResponse.json()).toMatchObject({
    proposalWorkspaces: [
      expect.objectContaining({
        id: createPayload.workspace.id,
        stage: "drafting",
      }),
    ],
  });
});

test("manual proposal workspaces can be updated through JSON-RPC with feasibility, contacts, outreach, and outcome state", async () => {
  const app = createTestApp();

  await createProfile(app, "browser_requester", {
    name: "Requester",
    role: "requester",
    walletAddress: "0x0000000000000000000000000000000000000001",
    smartWalletAddress: "0x0000000000000000000000000000000000000101",
  });

  const createResponse = await app.request("/api/proposal-workspaces", {
    method: "POST",
    headers: {
      authorization: "Bearer browser_requester",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      manualOpportunity: {
        title: "Port modernization robotics RFP",
        sponsor: "Port Authority",
        fundingType: "rfp",
        amountSummary: "$250,000 fixed bid",
        deadlineSummary: "2026-05-01",
        geography: "United States",
        sourceUrl: "https://example.gov/rfps/robotics",
        notes: "Manual pursuit created without a tracked grant.",
      },
    }),
  });
  const createPayload = await createResponse.json();
  const workspaceId = createPayload.workspace.id as string;

  const updateResponse = await callJsonRpc(app, "browser_requester", "proposalWorkspaces.update", {
    workspaceId,
    stage: "submitted",
    summary: "The response package is complete and has been submitted.",
    nextSteps: ["Monitor the procurement portal", "Prepare follow-up clarifications"],
    openQuestions: ["Will the sponsor request an interview round?"],
    feasibilitySnapshot: {
      verdict: "conditional_go",
      confidence: "medium",
      blockers: ["Pending final legal review before sponsor questions arrive."],
      assumptions: ["The sponsor will keep the published timeline."],
      requiredDocuments: ["Signed cost sheet", "Technical response", "Insurance certificate"],
      recommendedNextStep: "Monitor the portal and prepare follow-up materials.",
    },
    contacts: [
      {
        name: "Dana Kim",
        roleTitle: "Procurement lead",
        email: "dana@example.gov",
      },
    ],
    outreachEvents: [
      {
        kind: "email",
        direction: "outbound",
        subject: "Submission confirmation",
        summary: "Sent a confirmation note after filing the response package.",
        occurredAt: "2026-04-07T18:30:00.000Z",
      },
    ],
    outcome: {
      status: "submitted",
      summary: "Submitted before the deadline and awaiting sponsor review.",
      recordedAt: "2026-04-07T18:35:00.000Z",
    },
  });

  const detailResponse = await app.request(`/api/proposal-workspaces/${workspaceId}`, {
    headers: {
      authorization: "Bearer browser_requester",
    },
  });
  const listResponse = await callJsonRpc(app, "browser_requester", "proposalWorkspaces.list");

  expect(createResponse.status).toBe(201);
  expect(createPayload.workspace).toMatchObject({
    trackedGrantId: null,
    stage: "qualifying",
    opportunity: {
      sourceType: "manual",
      title: "Port modernization robotics RFP",
      sponsor: "Port Authority",
    },
  });
  expect(updateResponse.response.status).toBe(200);
  expect(updateResponse.payload).toMatchObject({
    result: {
      workspace: {
        id: workspaceId,
        stage: "submitted",
        summary: "The response package is complete and has been submitted.",
        contacts: [
          expect.objectContaining({
            name: "Dana Kim",
            roleTitle: "Procurement lead",
          }),
        ],
        outreachEvents: [
          expect.objectContaining({
            subject: "Submission confirmation",
            direction: "outbound",
          }),
        ],
        outcome: {
          status: "submitted",
          summary: "Submitted before the deadline and awaiting sponsor review.",
        },
      },
    },
  });
  expect(detailResponse.status).toBe(200);
  expect(await detailResponse.json()).toMatchObject({
    workspace: {
      id: workspaceId,
      feasibilitySnapshot: {
        verdict: "conditional_go",
        confidence: "medium",
        requiredDocuments: ["Signed cost sheet", "Technical response", "Insurance certificate"],
      },
      contacts: [
        expect.objectContaining({
          email: "dana@example.gov",
        }),
      ],
      outreachEvents: [
        expect.objectContaining({
          occurredAt: "2026-04-07T18:30:00.000Z",
        }),
      ],
      outcome: {
        status: "submitted",
        recordedAt: "2026-04-07T18:35:00.000Z",
      },
    },
  });
  expect(listResponse.response.status).toBe(200);
  expect(listResponse.payload).toMatchObject({
    result: {
      workspaces: [
        expect.objectContaining({
          id: workspaceId,
          stage: "submitted",
        }),
      ],
    },
  });
});

test("proposal workspaces persist across app instances that share the same database", async () => {
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

  const createResponse = await firstApp.request("/api/proposal-workspaces", {
    method: "POST",
    headers: {
      authorization: "Bearer browser_requester",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      manualOpportunity: {
        title: "State logistics innovation RFP",
        sponsor: "State Logistics Office",
        fundingType: "rfp",
      },
    }),
  });
  const createPayload = await createResponse.json();

  const secondApp = createApp({
    persist: true,
    database,
    authProvider,
  });

  const detailResponse = await secondApp.request(`/api/proposal-workspaces/${createPayload.workspace.id}`, {
    headers: {
      authorization: "Bearer browser_requester",
    },
  });
  const workspaceResponse = await secondApp.request("/api/workspace", {
    headers: {
      authorization: "Bearer browser_requester",
    },
  });

  expect(createResponse.status).toBe(201);
  expect(detailResponse.status).toBe(200);
  expect(await detailResponse.json()).toMatchObject({
    workspace: {
      id: createPayload.workspace.id,
      opportunity: {
        title: "State logistics innovation RFP",
        sponsor: "State Logistics Office",
      },
    },
  });
  expect(workspaceResponse.status).toBe(200);
  expect(await workspaceResponse.json()).toMatchObject({
    proposalWorkspaces: [
      expect.objectContaining({
        id: createPayload.workspace.id,
        opportunity: expect.objectContaining({
          title: "State logistics innovation RFP",
        }),
      }),
    ],
  });
});

test("proposal workspaces link a primary draft and record provider-backed actions against the proposal artifact", async () => {
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
      name: "Public works robotics",
      summary: "A public agency wants a robotics proposal with a linked draft workspace.",
      geography: "United States",
      businessModel: "Government",
      customers: ["public agencies"],
      needs: ["proposal drafting", "outreach planning"],
      tags: ["public-works", "robotics"],
    }),
  });
  const scenarioPayload = await scenarioResponse.json();

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
  const grantId = runPayload.grants[0].id as string;

  const createResponse = await app.request(`/api/grants/${grantId}/proposal-workspace`, {
    method: "POST",
    headers: {
      authorization: "Bearer browser_requester",
    },
  });
  const createPayload = await createResponse.json();

  const providerResponse = await app.request("/api/provider-connections", {
    method: "POST",
    headers: {
      authorization: "Bearer browser_requester",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      scope: "user",
      provider: "openai",
      label: "Proposal actions",
      authType: "byok",
      allowedArtifactTypes: ["proposal_workspace"],
    }),
  });
  const providerPayload = await providerResponse.json();

  const actionResponse = await callJsonRpc(app, "browser_requester", "proposalWorkspaces.runAction", {
    workspaceId: createPayload.workspace.id,
    action: "refresh_draft",
    providerConnectionId: providerPayload.connection.id,
  });

  const detailResponse = await app.request(`/api/proposal-workspaces/${createPayload.workspace.id}`, {
    headers: {
      authorization: "Bearer browser_requester",
    },
  });
  const executionResponse = await app.request("/api/agent-executions", {
    headers: {
      authorization: "Bearer browser_requester",
    },
  });

  expect(createResponse.status).toBe(201);
  expect(createPayload.workspace).toMatchObject({
    trackedGrantId: grantId,
    primaryApplicationWorkspace: expect.objectContaining({
      state: "draft",
      title: expect.stringContaining("Proposal"),
    }),
  });
  expect(actionResponse.response.status).toBe(200);
  expect(actionResponse.payload).toMatchObject({
    result: {
      workspace: {
        id: createPayload.workspace.id,
        primaryApplicationWorkspace: expect.objectContaining({
          state: "draft",
          updatedAt: expect.any(String),
        }),
      },
    },
  });
  expect(detailResponse.status).toBe(200);
  expect(await detailResponse.json()).toMatchObject({
    workspace: {
      id: createPayload.workspace.id,
      primaryApplicationWorkspace: expect.objectContaining({
        state: "draft",
      }),
    },
  });
  expect(executionResponse.status).toBe(200);
  expect(await executionResponse.json()).toMatchObject({
    executions: [
      expect.objectContaining({
        providerConnectionId: providerPayload.connection.id,
        targetType: "proposal_workspace",
        targetId: createPayload.workspace.id,
        action: "refresh_draft",
      }),
    ],
  });
});

test("proposal workspaces can create marketplace jobs and keep accepted engagements visible", async () => {
  const app = createTestApp({
    researchRunner: async ({ scenario }: { scenario: { id: string } }) => createResearchResult(scenario.id),
  });

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

  const scenarioResponse = await app.request("/api/research/scenarios", {
    method: "POST",
    headers: {
      authorization: "Bearer browser_requester",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      name: "Municipal robotics",
      summary: "A city agency wants a grant proposal workspace with marketplace collaboration.",
      geography: "United States",
      businessModel: "Government",
      customers: ["public agencies"],
      needs: ["proposal drafting", "specialist collaboration"],
      tags: ["municipal", "robotics"],
    }),
  });
  const scenarioPayload = await scenarioResponse.json();

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
  const grantId = runPayload.grants[0].id as string;

  const createWorkspaceResponse = await app.request(`/api/grants/${grantId}/proposal-workspace`, {
    method: "POST",
    headers: {
      authorization: "Bearer browser_requester",
    },
  });
  const createWorkspacePayload = await createWorkspaceResponse.json();

  const firstJobResponse = await app.request(`/api/proposal-workspaces/${createWorkspacePayload.workspace.id}/proposal-job`, {
    method: "POST",
    headers: {
      authorization: "Bearer browser_requester",
    },
  });
  const firstJobPayload = await firstJobResponse.json();

  const secondJobResponse = await app.request(`/api/proposal-workspaces/${createWorkspacePayload.workspace.id}/proposal-job`, {
    method: "POST",
    headers: {
      authorization: "Bearer browser_requester",
    },
  });
  const secondJobPayload = await secondJobResponse.json();

  const offerResponse = await app.request(`/api/jobs/${firstJobPayload.job.id}/offers`, {
    method: "POST",
    headers: {
      authorization: "Bearer browser_specialist",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      message: "I can help draft the proposal and coordinate the submission.",
      amountUsd: "2500",
      payoutAddress: "0x0000000000000000000000000000000000000abc",
    }),
  });
  const offerPayload = await offerResponse.json();

  const acceptResponse = await app.request(`/api/offers/${offerPayload.offer.id}/accept`, {
    method: "POST",
    headers: {
      authorization: "Bearer browser_requester",
    },
  });
  const acceptPayload = await acceptResponse.json();

  const detailResponse = await app.request(`/api/proposal-workspaces/${createWorkspacePayload.workspace.id}`, {
    headers: {
      authorization: "Bearer browser_requester",
    },
  });
  const detailPayload = await detailResponse.json();

  expect(firstJobResponse.status).toBe(201);
  expect(firstJobPayload).toMatchObject({
    job: {
      type: "grant_proposal",
      grantId,
      targetType: "proposal_workspace",
      targetId: createWorkspacePayload.workspace.id,
    },
    workspace: expect.objectContaining({
      id: createWorkspacePayload.workspace.id,
      proposalJob: expect.objectContaining({
        id: firstJobPayload.job.id,
      }),
    }),
  });
  expect(secondJobResponse.status).toBe(201);
  expect(secondJobPayload.job.id).toBe(firstJobPayload.job.id);
  expect(offerResponse.status).toBe(201);
  expect(acceptResponse.status).toBe(200);
  expect(acceptPayload.engagement).toMatchObject({
    targetType: "proposal_workspace",
    targetId: createWorkspacePayload.workspace.id,
    status: "pending_funding",
  });
  expect(detailResponse.status).toBe(200);
  expect(detailPayload).toMatchObject({
    workspace: {
      id: createWorkspacePayload.workspace.id,
      proposalJob: expect.objectContaining({
        id: firstJobPayload.job.id,
      }),
      engagement: expect.objectContaining({
        status: "pending_funding",
      }),
    },
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

test("interactive research runs expose staged deep-research activity in the request timeline", async () => {
  const scenarioResult = createResearchResult("inverse-private-equity");
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
          steer() {},
          async prompt() {
            const events: ResearchEvent[] = [
              { type: "agent_start" },
              {
                type: "tool_execution_start",
                toolCallId: "plan-1",
                toolName: "plan_research_round",
                args: { round: 1 },
              },
              {
                type: "tool_execution_end",
                toolCallId: "plan-1",
                toolName: "plan_research_round",
                result: { content: [{ type: "text", text: "planned" }] },
                isError: false,
              },
              {
                type: "tool_execution_start",
                toolCallId: "search-1",
                toolName: "search_web",
                args: { query: "warehouse automation grants" },
              },
              {
                type: "tool_execution_end",
                toolCallId: "search-1",
                toolName: "search_web",
                result: { content: [{ type: "text", text: "search complete" }] },
                isError: false,
              },
              {
                type: "tool_execution_start",
                toolCallId: "read-1",
                toolName: "read_source_page",
                args: { url: "https://example.gov/grants/automation" },
              },
              {
                type: "tool_execution_end",
                toolCallId: "read-1",
                toolName: "read_source_page",
                result: { content: [{ type: "text", text: "read complete" }] },
                isError: false,
              },
              {
                type: "tool_execution_start",
                toolCallId: "review-round-1",
                toolName: "review_research_round",
                args: { round: 1 },
              },
              {
                type: "tool_execution_end",
                toolCallId: "review-round-1",
                toolName: "review_research_round",
                result: { content: [{ type: "text", text: "review complete" }] },
                isError: false,
              },
              {
                type: "tool_execution_start",
                toolCallId: "plan-report-1",
                toolName: "plan_report",
                args: {},
              },
              {
                type: "tool_execution_end",
                toolCallId: "plan-report-1",
                toolName: "plan_report",
                result: { content: [{ type: "text", text: "plan report complete" }] },
                isError: false,
              },
              {
                type: "tool_execution_start",
                toolCallId: "draft-1",
                toolName: "draft_report",
                args: {},
              },
              {
                type: "tool_execution_end",
                toolCallId: "draft-1",
                toolName: "draft_report",
                result: { content: [{ type: "text", text: "draft complete" }] },
                isError: false,
              },
              {
                type: "tool_execution_start",
                toolCallId: "review-report-1",
                toolName: "review_report",
                args: {},
              },
              {
                type: "tool_execution_end",
                toolCallId: "review-report-1",
                toolName: "review_report",
                result: { content: [{ type: "text", text: "report review complete" }] },
                isError: false,
              },
              {
                type: "tool_execution_start",
                toolCallId: "rerank-1",
                toolName: "rerank_report",
                args: {},
              },
              {
                type: "tool_execution_end",
                toolCallId: "rerank-1",
                toolName: "rerank_report",
                result: { content: [{ type: "text", text: "rerank complete" }] },
                isError: false,
              },
              {
                type: "tool_execution_start",
                toolCallId: "publish-1",
                toolName: "publish_report",
                args: {},
              },
            ];

            for (const event of events) {
              for (const listener of listeners) {
                listener(event);
              }
            }

            await Bun.sleep(20);

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

            await Bun.sleep(20);
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
    body: JSON.stringify({ awaitCompletion: true }),
  });
  const runPayload = await runResponse.json();

  expect(requestResponse.status).toBe(201);
  expect(runResponse.status).toBe(200);
  expect(runPayload.request.activity).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        title: "Planning source fan-out",
        detail: "Round 1: planning the next source collection pass.",
      }),
      expect.objectContaining({
        title: "Reviewing and ranking evidence",
        detail: "Round 1: scoring sources and grant candidates from the latest pass.",
      }),
      expect.objectContaining({
        title: "Planning the final brief",
        detail: "Checking whether the evidence base is strong enough to draft the final report.",
      }),
      expect.objectContaining({
        title: "Writing the final brief",
        detail: "Drafting the ranked grant brief from the collected evidence.",
      }),
      expect.objectContaining({
        title: "Reviewing the final brief",
        detail: "Checking the draft for coverage gaps, unsupported claims, and ranking issues.",
      }),
      expect.objectContaining({
        title: "Re-ranking the recommendations",
        detail: "Applying the review feedback and final ranking adjustments.",
      }),
      expect.objectContaining({
        title: "Publishing structured report",
      }),
    ]),
  );
  expect(runPayload.request.activity.map((entry: { title: string }) => entry.title)).not.toEqual(
    expect.arrayContaining(["Running plan_report", "Running review_report"]),
  );
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

test("organization state persists across app instances that share the same database", async () => {
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

  const saveResponse = await upsertOrganization(firstApp, "browser_requester", {
    name: "Bay Area Makers Fund",
    website: "https://makersfund.example",
    registrationCountry: "United States",
    registrationRegion: "California",
    organizationType: "nonprofit",
    operatingScope: "local",
    localOperatingAreas: ["Oakland"],
    missionStatement: "Back neighborhood fabrication and workforce programs.",
    programs: ["Youth fabrication labs"],
    targetDemographics: ["youth", "first-generation founders"],
    thematicAreas: ["stem education", "economic mobility"],
    annualOperatingBudget: "$250k-$500k",
    strategicPriorities: ["maker access"],
    emailUpdatesEnabled: true,
    personnel: [
      {
        fullName: "Sam Rivera",
        roleTitle: "Program Lead",
        yearsExperience: 6,
        email: "sam@makersfund.example",
      },
    ],
  });

  expect(saveResponse.response.status).toBe(201);

  const secondApp = createApp({
    persist: true,
    database,
    authProvider,
  });

  const organizationResponse = await secondApp.request("/api/organization", {
    headers: {
      authorization: "Bearer browser_requester",
    },
  });
  const workspaceResponse = await secondApp.request("/api/workspace", {
    headers: {
      authorization: "Bearer browser_requester",
    },
  });

  expect(organizationResponse.status).toBe(200);
  expect(await organizationResponse.json()).toMatchObject({
    organization: expect.objectContaining({
      name: "Bay Area Makers Fund",
      operatingScope: "local",
      personnel: [
        expect.objectContaining({
          fullName: "Sam Rivera",
          roleTitle: "Program Lead",
        }),
      ],
    }),
  });
  expect(workspaceResponse.status).toBe(200);
  expect(await workspaceResponse.json()).toMatchObject({
    organization: expect.objectContaining({
      name: "Bay Area Makers Fund",
      thematicAreas: ["stem education", "economic mobility"],
    }),
  });
});

test("tracked grants can attach, update, clear, and read repository bindings through REST and workspace aggregates", async () => {
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
  const grantId = runPayload.grants[0].id as string;

  const attachResponse = await app.request(`/api/grants/${grantId}`, {
    method: "PATCH",
    headers: {
      authorization: "Bearer browser_requester",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      repositoryBinding: {
        repositoryUrl: "https://github.com/example/grantfinder",
        baseBranch: "main",
        privyGitHubAccountId: "did:privy:github-account",
        providerConnectionId: "github-connection",
      },
    }),
  });

  const workspaceResponse = await app.request("/api/workspace", {
    headers: {
      authorization: "Bearer browser_requester",
    },
  });

  const updateResponse = await app.request(`/api/grants/${grantId}`, {
    method: "PATCH",
    headers: {
      authorization: "Bearer browser_requester",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      repositoryBinding: {
        repositoryUrl: "https://github.com/example/grantfinder",
        baseBranch: "develop",
        rootPath: "ops/",
        privyGitHubAccountId: "did:privy:github-account",
        providerConnectionId: "github-connection",
      },
    }),
  });

  const clearResponse = await app.request(`/api/grants/${grantId}`, {
    method: "PATCH",
    headers: {
      authorization: "Bearer browser_requester",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      repositoryBinding: null,
    }),
  });

  const blockedResponse = await app.request(`/api/grants/${grantId}`, {
    method: "PATCH",
    headers: {
      authorization: "Bearer browser_requester",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      repositoryBinding: {
        repositoryUrl: "https://github.com/example/grantfinder",
        baseBranch: "main",
        providerConnectionId: "github-connection",
      },
    }),
  });

  expect(attachResponse.status).toBe(200);
  expect(await attachResponse.json()).toMatchObject({
    grant: {
      id: grantId,
      repositoryBinding: {
        repositoryUrl: "https://github.com/example/grantfinder",
        baseBranch: "main",
        rootPath: "grantfinder/",
        privyGitHubAccountId: "did:privy:github-account",
        providerConnectionId: "github-connection",
        latestPublication: null,
      },
    },
  });
  expect(workspaceResponse.status).toBe(200);
  const workspaceJson = await workspaceResponse.json();
  const trackedGrant = workspaceJson.grants.find((grant: { id: string }) => grant.id === grantId);
  expect(trackedGrant).toMatchObject({
    id: grantId,
    repositoryBinding: {
      repositoryUrl: "https://github.com/example/grantfinder",
      baseBranch: "main",
      rootPath: "grantfinder/",
      latestPublication: null,
    },
    repositoryBindingSource: {
      kind: "tracked_grant",
      id: grantId,
    },
  });
  expect(updateResponse.status).toBe(200);
  expect(await updateResponse.json()).toMatchObject({
    grant: {
      repositoryBinding: {
        repositoryUrl: "https://github.com/example/grantfinder",
        baseBranch: "develop",
        rootPath: "ops/",
      },
    },
  });
  expect(clearResponse.status).toBe(200);
  expect(await clearResponse.json()).toMatchObject({
    grant: {
      id: grantId,
      repositoryBinding: null,
    },
  });
  expect(blockedResponse.status).toBe(409);
  expect(await blockedResponse.json()).toMatchObject({
    error: {
      code: "github_account_required",
    },
  });
});

test("catalog grants can attach, update, clear, and read repository bindings through JSON-RPC and proposal workspaces", async () => {
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
  const grantId = runPayload.grants[0].id as string;

  const promoteResponse = await app.request(`/api/grants/${grantId}/catalog-entry`, {
    method: "POST",
    headers: {
      authorization: "Bearer browser_requester",
    },
  });
  const catalogGrantId = (await promoteResponse.json()).grant.id as string;

  const attachResponse = await callJsonRpc(app, "browser_requester", "catalog.grants.update", {
    grantId: catalogGrantId,
    repositoryBinding: {
      repositoryUrl: "https://github.com/example/catalog-grant",
      baseBranch: "main",
      privyGitHubAccountId: "did:privy:github-account",
      providerConnectionId: "github-connection",
    },
  });

  const detailResponse = await app.request(`/api/catalog/grants/${catalogGrantId}`, {
    headers: {
      authorization: "Bearer browser_requester",
    },
  });

  const proposalCreateResponse = await app.request(`/api/catalog/grants/${catalogGrantId}/proposal-workspace`, {
    method: "POST",
    headers: {
      authorization: "Bearer browser_requester",
    },
  });
  const proposalCreateJson = await proposalCreateResponse.json();
  const proposalWorkspaceId = proposalCreateJson.workspace.id as string;

  const proposalWorkspaceReadResponse = await app.request(`/api/proposal-workspaces/${proposalWorkspaceId}`, {
    headers: {
      authorization: "Bearer browser_requester",
    },
  });
  const proposalWorkspaceJson = await proposalWorkspaceReadResponse.json();

  const updateResponse = await callJsonRpc(app, "browser_requester", "catalog.grants.update", {
    grantId: catalogGrantId,
    repositoryBinding: {
      repositoryUrl: "https://github.com/example/catalog-grant",
      baseBranch: "develop",
      rootPath: "catalog/",
      privyGitHubAccountId: "did:privy:github-account",
      providerConnectionId: "github-connection",
    },
  });

  const clearResponse = await callJsonRpc(app, "browser_requester", "catalog.grants.update", {
    grantId: catalogGrantId,
    repositoryBinding: null,
  });

  expect(attachResponse.response.status).toBe(200);
  expect(attachResponse.payload).toMatchObject({
    result: {
      grant: {
        id: catalogGrantId,
        repositoryBinding: {
          repositoryUrl: "https://github.com/example/catalog-grant",
          baseBranch: "main",
          rootPath: "grantfinder/",
          latestPublication: null,
        },
      },
    },
  });
  expect(detailResponse.status).toBe(200);
  expect(await detailResponse.json()).toMatchObject({
    grant: {
      repositoryBinding: {
        repositoryUrl: "https://github.com/example/catalog-grant",
        baseBranch: "main",
        rootPath: "grantfinder/",
        latestPublication: null,
      },
    },
  });
  expect(proposalCreateResponse.status).toBe(201);
  expect(proposalCreateJson.workspace.repositoryBindingSource).toEqual({
    kind: "catalog_grant",
    id: catalogGrantId,
  });
  expect(proposalWorkspaceJson.workspace.repositoryBinding).toMatchObject({
    rootPath: "grantfinder/",
    latestPublication: null,
  });
  expect(proposalWorkspaceJson.workspace.repositoryBindingSource).toEqual({
    kind: "catalog_grant",
    id: catalogGrantId,
  });
  expect(updateResponse.response.status).toBe(200);
  expect(updateResponse.payload).toMatchObject({
    result: {
      grant: {
        repositoryBinding: {
          repositoryUrl: "https://github.com/example/catalog-grant",
          baseBranch: "develop",
          rootPath: "catalog/",
        },
      },
    },
  });
  expect(clearResponse.response.status).toBe(200);
  expect(clearResponse.payload).toMatchObject({
    result: {
      grant: {
        repositoryBinding: null,
      },
    },
  });

  const clearedProposalWorkspaceReadResponse = await app.request(`/api/proposal-workspaces/${proposalWorkspaceId}`, {
    headers: {
      authorization: "Bearer browser_requester",
    },
  });
  const clearedProposalWorkspaceJson = await clearedProposalWorkspaceReadResponse.json();
  expect(clearedProposalWorkspaceJson.workspace.repositoryBinding).toBeNull();
  expect(clearedProposalWorkspaceJson.workspace.repositoryBindingSource).toBeNull();
});

test("manual proposal workspaces can attach, update, clear, and read repository bindings through REST and JSON-RPC", async () => {
  const app = createTestApp();

  await createProfile(app, "browser_requester", {
    name: "Requester",
    role: "requester",
    walletAddress: "0x0000000000000000000000000000000000000001",
    smartWalletAddress: "0x0000000000000000000000000000000000000101",
  });

  const providerResponse = await app.request("/api/provider-connections", {
    method: "POST",
    headers: {
      authorization: "Bearer browser_requester",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      scope: "user",
      provider: "github",
      label: "GitHub",
      authType: "oauth",
      allowedArtifactTypes: ["proposal_workspace"],
    }),
  });
  const providerPayload = await providerResponse.json();

  const createResponse = await app.request("/api/proposal-workspaces", {
    method: "POST",
    headers: {
      authorization: "Bearer browser_requester",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      manualOpportunity: {
        title: "Port modernization robotics RFP",
        sponsor: "Port Authority",
        fundingType: "rfp",
        amountSummary: "$250,000 fixed bid",
        deadlineSummary: "2026-05-01",
        geography: "United States",
        sourceUrl: "https://example.gov/rfps/robotics",
        notes: "Manual pursuit created without a tracked grant.",
      },
    }),
  });
  const workspaceId = (await createResponse.json()).workspace.id as string;

  const attachResponse = await app.request(`/api/proposal-workspaces/${workspaceId}`, {
    method: "PATCH",
    headers: {
      authorization: "Bearer browser_requester",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      repositoryBinding: {
        repositoryUrl: "https://github.com/example/manual-rfp",
        baseBranch: "main",
        privyGitHubAccountId: "did:privy:github-account",
        providerConnectionId: providerPayload.connection.id,
      },
    }),
  });

  const updateResponse = await callJsonRpc(app, "browser_requester", "proposalWorkspaces.update", {
    workspaceId,
    repositoryBinding: {
      repositoryUrl: "https://github.com/example/manual-rfp",
      baseBranch: "develop",
      rootPath: "manual/",
      privyGitHubAccountId: "did:privy:github-account",
      providerConnectionId: "github-connection",
    },
  });

  const detailResponse = await callJsonRpc(app, "browser_requester", "proposalWorkspaces.get", {
    workspaceId,
  });

  const clearResponse = await app.request(`/api/proposal-workspaces/${workspaceId}`, {
    method: "PATCH",
    headers: {
      authorization: "Bearer browser_requester",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      repositoryBinding: null,
    }),
  });

  const workspaceResponse = await app.request("/api/workspace", {
    headers: {
      authorization: "Bearer browser_requester",
    },
  });

  expect(createResponse.status).toBe(201);
  expect(attachResponse.status).toBe(200);
  expect(await attachResponse.json()).toMatchObject({
    workspace: {
      id: workspaceId,
      repositoryBinding: {
        repositoryUrl: "https://github.com/example/manual-rfp",
        baseBranch: "main",
        rootPath: "grantfinder/",
        latestPublication: null,
      },
      repositoryBindingSource: {
        kind: "proposal_workspace",
        id: workspaceId,
      },
    },
  });
  expect(updateResponse.response.status).toBe(200);
  expect(updateResponse.payload).toMatchObject({
    result: {
      workspace: {
        repositoryBinding: {
          repositoryUrl: "https://github.com/example/manual-rfp",
          baseBranch: "develop",
          rootPath: "manual/",
        },
      },
    },
  });
  expect(detailResponse.response.status).toBe(200);
  expect(detailResponse.payload).toMatchObject({
    result: {
      workspace: {
        repositoryBindingSource: {
          kind: "proposal_workspace",
          id: workspaceId,
        },
      },
    },
  });
  expect(clearResponse.status).toBe(200);
  expect(await clearResponse.json()).toMatchObject({
    workspace: {
      repositoryBinding: null,
      repositoryBindingSource: null,
    },
  });
  expect(workspaceResponse.status).toBe(200);
  expect(await workspaceResponse.json()).toMatchObject({
    proposalWorkspaces: [
      expect.objectContaining({
        id: workspaceId,
        repositoryBinding: null,
        repositoryBindingSource: null,
      }),
    ],
  });
});

test("repository-linked proposal workspaces publish through the injected adapter when updated", async () => {
  const recorder = createPublicationRecorder();
  const app = createTestApp({
    publicationAdapter: recorder.adapter,
  });

  await createProfile(app, "browser_requester", {
    name: "Requester",
    role: "requester",
    walletAddress: "0x0000000000000000000000000000000000000001",
    smartWalletAddress: "0x0000000000000000000000000000000000000101",
  });

  const providerResponse = await app.request("/api/provider-connections", {
    method: "POST",
    headers: {
      authorization: "Bearer browser_requester",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      scope: "user",
      provider: "github",
      label: "GitHub",
      authType: "oauth",
      allowedArtifactTypes: ["proposal_workspace"],
    }),
  });
  const providerPayload = await providerResponse.json();

  const createResponse = await app.request("/api/proposal-workspaces", {
    method: "POST",
    headers: {
      authorization: "Bearer browser_requester",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      manualOpportunity: {
        title: "Port modernization robotics RFP",
        sponsor: "Port Authority",
        fundingType: "rfp",
        amountSummary: "$250,000 fixed bid",
        deadlineSummary: "2026-05-01",
        geography: "United States",
        sourceUrl: "https://example.gov/rfps/robotics",
        notes: "Manual pursuit created without a tracked grant.",
      },
    }),
  });
  const createPayload = await createResponse.json();
  const workspaceId = createPayload.workspace.id as string;

  const attachResponse = await app.request(`/api/proposal-workspaces/${workspaceId}`, {
    method: "PATCH",
    headers: {
      authorization: "Bearer browser_requester",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      repositoryBinding: {
        repositoryUrl: "https://github.com/example/manual-rfp",
        baseBranch: "main",
        privyGitHubAccountId: "did:privy:github-account",
        providerConnectionId: providerPayload.connection.id,
      },
    }),
  });
  expect(attachResponse.status).toBe(200);

  const updateResponse = await app.request(`/api/proposal-workspaces/${workspaceId}`, {
    method: "PATCH",
    headers: {
      authorization: "Bearer browser_requester",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      stage: "drafting",
      summary: "Updated the proposal workspace summary.",
      nextSteps: ["Validate the next draft"],
    }),
  });
  const updatePayload = await updateResponse.json();

  expect(updateResponse.status).toBe(200);
  expect(recorder.commitCalls).toHaveLength(2);
  expect(recorder.commitCalls[0]).toMatchObject({
    branchName: "grantfinder/proposal_workspace/" + workspaceId,
  });
  expect(recorder.commitCalls[1]).toMatchObject({
    branchName: "grantfinder/proposal_workspace/" + workspaceId,
  });
  expect((recorder.commitCalls[1] as { files: Array<{ path: string }> }).files[0].path).toBe(
    `grantfinder/pursuits/${workspaceId}/workspace.md`,
  );
  expect(updatePayload).toMatchObject({
    workspace: {
      repositoryBinding: {
        latestPublication: {
          status: "published",
          branch: `grantfinder/proposal_workspace/${workspaceId}`,
          errorMessage: null,
        },
      },
    },
  });
});
