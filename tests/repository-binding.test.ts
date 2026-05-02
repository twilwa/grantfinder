// ABOUTME: Verifies repository binding persistence and effective resolution for grantfinder records.
// ABOUTME: These tests cover the domain slice for tracked grants, catalog grants, proposal workspaces, and application workspaces.

import { expect, test } from "bun:test";
import { newDb } from "pg-mem";

import { ApplicationServices, type RepositoryBindingInput } from "../src/services.js";
import { ApplicationStore } from "../src/store.js";
import { DEFAULT_REPOSITORY_ROOT_PATH } from "../src/platform-types.js";

function createTestDatabase() {
  const database = newDb();
  const adapter = database.adapters.createPg();
  return new adapter.Pool();
}

async function createRequester(store: ApplicationStore) {
  return store.upsertUserProfile({
    privyUserId: "did:privy:requester",
    name: "Requester",
    role: "requester",
    walletAddress: "0x0000000000000000000000000000000000000001",
    smartWalletAddress: "0x0000000000000000000000000000000000000101",
  });
}

async function createResearchContext(store: ApplicationStore, userId: string) {
  const scenario = await store.createResearchScenario({
    id: "scenario_1",
    ownerUserId: userId,
    sourceType: "custom",
    name: "Scenario",
    summary: "Scenario summary",
    geography: "United States",
    businessModel: "Services",
    customers: ["customers"],
    needs: ["needs"],
    tags: ["tag"],
    createdAt: "2026-04-18T12:00:00.000Z",
    updatedAt: "2026-04-18T12:00:00.000Z",
  });

  const request = await store.createResearchRequest({
    id: "request_1",
    requesterId: userId,
    scenarioId: scenario.id,
    sourceCatalogGrantId: null,
    researchFocus: null,
    organizationPrefill: null,
    status: "draft",
    runPhase: "idle",
    progressSummary: null,
    runStartedAt: null,
    latestBrief: null,
    latestReport: null,
    errorMessage: null,
    activity: [],
    steeringNotes: [],
    createdAt: "2026-04-18T12:01:00.000Z",
    updatedAt: "2026-04-18T12:01:00.000Z",
    lastRunAt: null,
  });

  return { scenario, request };
}

async function createTrackedGrant(store: ApplicationStore, userId: string, requestId: string) {
  const grants = await store.replaceTrackedGrants(requestId, [
    {
      id: "grant_1",
      requestId,
      requesterId: userId,
      catalogGrantId: null,
      repositoryBinding: null,
      title: "Community Grant",
      sponsor: "Community Sponsor",
      fundingType: "rfp",
      fitScore: 88,
      whyFit: "A strong fit.",
      eligibilityNotes: [],
      amountSummary: "$10,000",
      deadlineSummary: "Rolling",
      geography: "United States",
      status: "open",
      citations: [],
      nextActions: [],
      queueState: "active",
      proposalWorkspaceId: null,
      proposalJobId: null,
      createdAt: "2026-04-18T12:03:00.000Z",
      updatedAt: "2026-04-18T12:03:00.000Z",
    },
  ]);

  return grants[0];
}

async function createCatalogGrant(store: ApplicationStore, userId: string, requestId: string, sourceGrantId: string) {
  return store.saveGrantCatalogEntry({
    id: "catalog_1",
    createdByUserId: userId,
    sourceType: "research",
    sourceGrantId,
    sourceReportId: null,
    lastResearchRequestId: requestId,
    repositoryBinding: null,
    title: "Community Grant",
    sponsor: "Community Sponsor",
    fundingType: "rfp",
    fitScore: 88,
    whyFit: "A strong fit.",
    eligibilityNotes: [],
    amountSummary: "$10,000",
    deadlineSummary: "Rolling",
    geography: "United States",
    status: "open",
    citations: [],
    nextActions: [],
    tags: [],
    provenanceNotes: null,
    freshnessNotes: null,
    pursuitNotes: null,
    lastValidatedAt: null,
    createdAt: "2026-04-18T12:04:00.000Z",
    updatedAt: "2026-04-18T12:04:00.000Z",
  });
}

test("tracked grant repository bindings persist, replace, clear, and default the root path", async () => {
  const store = new ApplicationStore({ database: createTestDatabase() });
  const services = new ApplicationServices(store);
  const user = await createRequester(store);
  const { request } = await createResearchContext(store, user.id);
  const grant = await createTrackedGrant(store, user.id, request.id);
  const initialBinding = {
    repositoryUrl: "https://github.com/example/grants",
    baseBranch: "main",
    privyGitHubAccountId: "github-user-1",
    providerConnectionId: "provider_1",
  } satisfies RepositoryBindingInput;

  await services.updateTrackedGrantRepositoryBinding(user, grant.id, initialBinding);

  const saved = await store.findTrackedGrantById(grant.id);
  expect(saved?.repositoryBinding).toMatchObject({
    repositoryUrl: "https://github.com/example/grants",
    baseBranch: "main",
    rootPath: DEFAULT_REPOSITORY_ROOT_PATH,
    privyGitHubAccountId: "github-user-1",
    providerConnectionId: "provider_1",
    attachedByUserId: user.id,
  });

  const replacedBinding = {
    repositoryUrl: "https://github.com/example/grants-v2",
    baseBranch: "release",
    rootPath: "pursuits/",
    privyGitHubAccountId: "github-user-1",
    providerConnectionId: "provider_2",
  } satisfies RepositoryBindingInput;

  await services.updateTrackedGrantRepositoryBinding(user, grant.id, replacedBinding);

  const replaced = await store.findTrackedGrantById(grant.id);
  expect(replaced?.repositoryBinding).toMatchObject({
    repositoryUrl: "https://github.com/example/grants-v2",
    baseBranch: "release",
    rootPath: "pursuits/",
    providerConnectionId: "provider_2",
  });

  await services.updateTrackedGrantRepositoryBinding(user, grant.id, null);

  const cleared = await store.findTrackedGrantById(grant.id);
  expect(cleared?.repositoryBinding).toBeNull();
});

test("repository bindings require a Privy-linked GitHub account before enabling publication", async () => {
  const store = new ApplicationStore({ database: createTestDatabase() });
  const services = new ApplicationServices(store);
  const user = await createRequester(store);
  const { request } = await createResearchContext(store, user.id);
  const grant = await createTrackedGrant(store, user.id, request.id);

  await expect(
    services.updateTrackedGrantRepositoryBinding(user, grant.id, {
      repositoryUrl: "https://github.com/example/grants",
      baseBranch: "main",
      privyGitHubAccountId: null,
      providerConnectionId: "provider_1",
    } satisfies RepositoryBindingInput),
  ).rejects.toMatchObject({
    code: "github_account_required",
  });

  const unchanged = await store.findTrackedGrantById(grant.id);
  expect(unchanged?.repositoryBinding).toBeNull();
});

test("manual proposal workspaces expose their own binding and source metadata", async () => {
  const store = new ApplicationStore({ database: createTestDatabase() });
  const services = new ApplicationServices(store);
  const user = await createRequester(store);

  const created = await services.createProposalWorkspace(user, {
    manualOpportunity: {
      title: "Manual Pursuit",
      sponsor: "Manual Sponsor",
      fundingType: "grant",
      amountSummary: "$50,000",
      deadlineSummary: "Rolling",
      geography: "United States",
      sourceUrl: "https://github.com/example/manual",
      notes: "Manual pursuit",
    },
  });

  const manualBinding = {
    repositoryUrl: "https://github.com/example/manual",
    baseBranch: "main",
    rootPath: "manual/",
    privyGitHubAccountId: "github-user-1",
    providerConnectionId: "provider_1",
  } satisfies RepositoryBindingInput;

  await services.updateProposalWorkspaceRepositoryBinding(user, created.workspace.id, manualBinding);

  const loaded = await services.getProposalWorkspace(user, created.workspace.id);
  expect(loaded.workspace.repositoryBinding).toMatchObject({
    repositoryUrl: "https://github.com/example/manual",
    baseBranch: "main",
    rootPath: "manual/",
  });
  expect(loaded.workspace.repositoryBindingSource).toMatchObject({
    kind: "proposal_workspace",
    id: created.workspace.id,
  });
});

test("proposal workspaces inherit catalog bindings, override explicitly, and fall back to tracked grant bindings", async () => {
  const store = new ApplicationStore({ database: createTestDatabase() });
  const services = new ApplicationServices(store);
  const user = await createRequester(store);
  const { request } = await createResearchContext(store, user.id);
  const trackedGrant = await createTrackedGrant(store, user.id, request.id);
  const catalogGrant = await createCatalogGrant(store, user.id, request.id, trackedGrant.id);

  const trackedBinding = {
    repositoryUrl: "https://github.com/example/tracked",
    baseBranch: "main",
    privyGitHubAccountId: "github-user-1",
    providerConnectionId: "provider_tracked",
  } satisfies RepositoryBindingInput;
  const catalogBinding = {
    repositoryUrl: "https://github.com/example/catalog",
    baseBranch: "release",
    rootPath: "catalog/",
    privyGitHubAccountId: "github-user-1",
    providerConnectionId: "provider_catalog",
  } satisfies RepositoryBindingInput;

  await services.updateTrackedGrantRepositoryBinding(user, trackedGrant.id, trackedBinding);
  await services.updateGrantCatalogEntryRepositoryBinding(user, catalogGrant.id, catalogBinding);

  const created = await services.createProposalWorkspaceFromGrant(user, trackedGrant.id);
  const inherited = await services.getProposalWorkspace(user, created.workspace.id);
  expect(inherited.workspace.repositoryBinding).toMatchObject({
    repositoryUrl: "https://github.com/example/catalog",
    baseBranch: "release",
    rootPath: "catalog/",
  });
  expect(inherited.workspace.repositoryBindingSource).toMatchObject({
    kind: "catalog_grant",
    id: catalogGrant.id,
  });

  const overrideBinding = {
    repositoryUrl: "https://github.com/example/override",
    baseBranch: "develop",
    rootPath: "workspace/",
    privyGitHubAccountId: "github-user-1",
    providerConnectionId: "provider_override",
  } satisfies RepositoryBindingInput;

  await services.updateProposalWorkspaceRepositoryBinding(user, created.workspace.id, overrideBinding);

  const overridden = await services.getProposalWorkspace(user, created.workspace.id);
  expect(overridden.workspace.repositoryBinding).toMatchObject({
    repositoryUrl: "https://github.com/example/override",
    baseBranch: "develop",
    rootPath: "workspace/",
  });
  expect(overridden.workspace.repositoryBindingSource).toMatchObject({
    kind: "proposal_workspace",
    id: created.workspace.id,
  });

  await services.updateProposalWorkspaceRepositoryBinding(user, created.workspace.id, null);
  await services.updateGrantCatalogEntryRepositoryBinding(user, catalogGrant.id, null);

  const trackedFallback = await services.getProposalWorkspace(user, created.workspace.id);
  expect(trackedFallback.workspace.repositoryBinding).toMatchObject({
    repositoryUrl: "https://github.com/example/tracked",
    baseBranch: "main",
    rootPath: DEFAULT_REPOSITORY_ROOT_PATH,
  });
  expect(trackedFallback.workspace.repositoryBindingSource).toMatchObject({
    kind: "tracked_grant",
    id: trackedGrant.id,
  });
});

test("application workspaces expose the effective repository binding from linked proposal context", async () => {
  const store = new ApplicationStore({ database: createTestDatabase() });
  const services = new ApplicationServices(store);
  const user = await createRequester(store);
  const { request } = await createResearchContext(store, user.id);
  const trackedGrant = await createTrackedGrant(store, user.id, request.id);

  const trackedBinding = {
    repositoryUrl: "https://github.com/example/tracked",
    baseBranch: "main",
    privyGitHubAccountId: "github-user-1",
    providerConnectionId: "provider_1",
  } satisfies RepositoryBindingInput;

  await services.updateTrackedGrantRepositoryBinding(user, trackedGrant.id, trackedBinding);

  const created = await services.createProposalWorkspaceFromGrant(user, trackedGrant.id);
  const proposalBinding = {
    repositoryUrl: "https://github.com/example/proposal",
    baseBranch: "release",
    rootPath: "proposal/",
    privyGitHubAccountId: "github-user-1",
    providerConnectionId: "provider_2",
  } satisfies RepositoryBindingInput;

  await services.updateProposalWorkspaceRepositoryBinding(user, created.workspace.id, proposalBinding);

  const primaryApplicationWorkspace = created.workspace.primaryApplicationWorkspace;
  if (!primaryApplicationWorkspace) {
    throw new Error("Expected a linked application workspace.");
  }

  const application = await services.getApplicationWorkspace(
    user,
    primaryApplicationWorkspace.id,
  );

  expect(application.workspace.repositoryBinding).toMatchObject({
    repositoryUrl: "https://github.com/example/proposal",
    baseBranch: "release",
    rootPath: "proposal/",
  });
  expect(application.workspace.repositoryBindingSource).toMatchObject({
    kind: "proposal_workspace",
    id: created.workspace.id,
  });
});
