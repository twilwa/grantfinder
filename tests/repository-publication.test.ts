// ABOUTME: Verifies repository publication plumbing for deterministic paths, branch naming, and sync status.
// ABOUTME: These tests cover the publication helper surface and the service-level audit/status persistence.

import { expect, test } from "bun:test";
import { newDb } from "pg-mem";

import { ApplicationServices, type RepositoryBindingInput } from "../src/services.js";
import { ApplicationStore } from "../src/store.js";
import {
  buildGrantfinderBranchName,
  buildRepositoryPath,
  readLatestPublicationStatus,
  resolveRepositoryPublicationTarget,
  type RepositoryPublicationAdapter,
} from "../src/repository-publication.js";
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

test("repository helpers build deterministic paths and stable Grantfinder branch names", () => {
  expect(buildRepositoryPath(undefined, "research", "request_1", "brief.md")).toBe(
    "grantfinder/research/request_1/brief.md",
  );
  expect(buildRepositoryPath("custom-root/", "applications", "workspace_1", "final.md")).toBe(
    "custom-root/applications/workspace_1/final.md",
  );
  expect(buildGrantfinderBranchName({ kind: "tracked_grant", id: "grant_1" })).toBe(
    "grantfinder/tracked_grant/grant_1",
  );

  const target = resolveRepositoryPublicationTarget(
    {
      repositoryUrl: "https://github.com/example/grants",
      baseBranch: "main",
      rootPath: DEFAULT_REPOSITORY_ROOT_PATH,
      privyGitHubAccountId: "github-user-1",
      providerConnectionId: "provider_1",
      attachedByUserId: "user_1",
      attachedAt: "2026-04-18T12:05:00.000Z",
      updatedAt: "2026-04-18T12:05:00.000Z",
      latestPublication: null,
    },
    { kind: "tracked_grant", id: "grant_1" },
    "research/request_1/brief.md",
  );

  expect(target).toMatchObject({
    repositoryUrl: "https://github.com/example/grants",
    baseBranch: "main",
    rootPath: DEFAULT_REPOSITORY_ROOT_PATH,
    branchName: "grantfinder/tracked_grant/grant_1",
    repositoryPath: "grantfinder/research/request_1/brief.md",
  });
});

test("repository publication succeeds, updates the same pull request, and persists latest status", async () => {
  const store = new ApplicationStore({ database: createTestDatabase() });
  const user = await createRequester(store);
  const { request } = await createResearchContext(store, user.id);
  const grant = await createTrackedGrant(store, user.id, request.id);
  const catalogGrant = await createCatalogGrant(store, user.id, request.id, grant.id);
  const services = new ApplicationServices(store, undefined, undefined, undefined, {
    async writeBranchCommit(input) {
      expect(input.branchName).toBe("grantfinder/catalog_grant/catalog_1");
      expect(input.files).toEqual([
        {
          path: "grantfinder/research/request_1/report.md",
          content: "report v1",
        },
      ]);
      return { commitSha: "commit-123" };
    },
    async upsertPullRequest(input) {
      expect(input.branchName).toBe("grantfinder/catalog_grant/catalog_1");
      expect(input.existingPullRequestUrl).toBeNull();
      return {
        pullRequestUrl: "https://github.com/example/grants/pull/1",
        action: "created",
      };
    },
  } satisfies RepositoryPublicationAdapter);

  const githubConnection = await services.createProviderConnection(user, {
    scope: "user",
    provider: "github",
    label: "GitHub",
    authType: "oauth",
    allowedArtifactTypes: [],
  });

  const binding = {
    repositoryUrl: "https://github.com/example/grants",
    baseBranch: "main",
    rootPath: null,
    privyGitHubAccountId: "github-user-1",
    providerConnectionId: githubConnection.connection.id,
  } satisfies RepositoryBindingInput;

  await services.updateGrantCatalogEntryRepositoryBinding(user, catalogGrant.id, binding);
  const proposalWorkspace = await services.createProposalWorkspaceFromGrant(user, grant.id);

  const firstPublication = await services.publishRepositoryArtifact(
    user,
    { kind: "proposal_workspace", id: proposalWorkspace.workspace.id },
    {
      path: "research/request_1/report.md",
      content: "report v1",
      summary: "Published the first research report",
    },
  );

  expect(firstPublication.publication).toMatchObject({
    status: "published",
    branch: "grantfinder/catalog_grant/catalog_1",
    commitSha: "commit-123",
    pullRequestUrl: "https://github.com/example/grants/pull/1",
    errorMessage: null,
  });

  const currentGrant = await store.findGrantCatalogEntryById(catalogGrant.id);
  expect(readLatestPublicationStatus(currentGrant?.repositoryBinding ?? null)).toMatchObject({
    status: "published",
    branch: "grantfinder/catalog_grant/catalog_1",
    commitSha: "commit-123",
    pullRequestUrl: "https://github.com/example/grants/pull/1",
  });

  const loadedProposal = await services.getProposalWorkspace(user, proposalWorkspace.workspace.id);
  expect(loadedProposal.workspace.repositoryBindingSource).toMatchObject({
    kind: "catalog_grant",
    id: catalogGrant.id,
  });
  expect(loadedProposal.workspace.repositoryBinding?.latestPublication).toMatchObject({
    status: "published",
    branch: "grantfinder/catalog_grant/catalog_1",
    commitSha: "commit-123",
  });

  const stateAfterFirstPublish = await store.readState();
  expect(stateAfterFirstPublish.agentExecutionRecords).toHaveLength(1);
  expect(stateAfterFirstPublish.agentExecutionRecords[0]).toMatchObject({
    actorUserId: user.id,
    providerConnectionId: githubConnection.connection.id,
    targetType: "grant_catalog_entry",
    targetId: catalogGrant.id,
    action: "publish_repository_artifact",
  });

  const updateCalls: Array<Record<string, unknown>> = [];
  const updateServices = new ApplicationServices(store, undefined, undefined, undefined, {
    async writeBranchCommit(input) {
      updateCalls.push({ kind: "commit", ...input });
      expect(input.branchName).toBe("grantfinder/catalog_grant/catalog_1");
      return { commitSha: "commit-456" };
    },
    async upsertPullRequest(input) {
      updateCalls.push({ kind: "pull_request", ...input });
      expect(input.existingPullRequestUrl).toBe("https://github.com/example/grants/pull/1");
      return {
        pullRequestUrl: "https://github.com/example/grants/pull/1",
        action: "updated",
      };
    },
  } satisfies RepositoryPublicationAdapter);

  const secondPublication = await updateServices.publishRepositoryArtifact(
    user,
    { kind: "proposal_workspace", id: proposalWorkspace.workspace.id },
    {
      path: "research/request_1/report.md",
      content: "report v2",
      summary: "Refreshed the research report",
    },
  );

  expect(secondPublication.publication).toMatchObject({
    status: "published",
    branch: "grantfinder/catalog_grant/catalog_1",
    commitSha: "commit-456",
    pullRequestUrl: "https://github.com/example/grants/pull/1",
  });
  expect(updateCalls).toHaveLength(2);

  const refreshedGrant = await store.findGrantCatalogEntryById(catalogGrant.id);
  expect(refreshedGrant?.repositoryBinding?.latestPublication).toMatchObject({
    status: "published",
    branch: "grantfinder/catalog_grant/catalog_1",
    commitSha: "commit-456",
    pullRequestUrl: "https://github.com/example/grants/pull/1",
  });
});

test("repository publication is blocked when the Privy-linked GitHub connection is incompatible", async () => {
  const store = new ApplicationStore({ database: createTestDatabase() });
  const user = await createRequester(store);
  const { request } = await createResearchContext(store, user.id);
  const grant = await createTrackedGrant(store, user.id, request.id);
  const services = new ApplicationServices(store, undefined, undefined, undefined, {
    async writeBranchCommit() {
      throw new Error("publication should not have started");
    },
    async upsertPullRequest() {
      throw new Error("publication should not have started");
    },
  } satisfies RepositoryPublicationAdapter);

  const incompatibleConnection = await services.createProviderConnection(user, {
    scope: "user",
    provider: "github",
    label: "GitHub",
    authType: "byok",
    allowedArtifactTypes: [],
  });

  await services.updateTrackedGrantRepositoryBinding(user, grant.id, {
    repositoryUrl: "https://github.com/example/grants",
    baseBranch: "main",
    privyGitHubAccountId: "github-user-1",
    providerConnectionId: incompatibleConnection.connection.id,
  });

  const result = await services.publishRepositoryArtifact(
    user,
    { kind: "tracked_grant", id: grant.id },
    {
      path: "research/request_1/brief.md",
      content: "brief",
      summary: "Attempted publication without compatible GitHub access",
    },
  );

  expect(result.publication).toMatchObject({
    status: "blocked",
    branch: "grantfinder/tracked_grant/grant_1",
    commitSha: null,
    pullRequestUrl: null,
    errorMessage: "GitHub publication access is not available for this repository binding.",
  });

  const savedGrant = await store.findTrackedGrantById(grant.id);
  expect(savedGrant?.repositoryBinding?.latestPublication).toMatchObject({
    status: "blocked",
    errorMessage: "GitHub publication access is not available for this repository binding.",
  });

  const state = await store.readState();
  expect(state.agentExecutionRecords).toHaveLength(1);
  expect(state.agentExecutionRecords[0]).toMatchObject({
    actorUserId: user.id,
    providerConnectionId: incompatibleConnection.connection.id,
    targetType: "tracked_grant",
    targetId: grant.id,
    action: "publish_repository_artifact",
  });
});

test("repository publication failure preserves the latest failure metadata", async () => {
  const store = new ApplicationStore({ database: createTestDatabase() });
  const user = await createRequester(store);
  const { request } = await createResearchContext(store, user.id);
  const grant = await createTrackedGrant(store, user.id, request.id);
  const services = new ApplicationServices(store, undefined, undefined, undefined, {
    async writeBranchCommit() {
      throw new Error("github is temporarily unavailable");
    },
    async upsertPullRequest() {
      return {
        pullRequestUrl: "https://github.com/example/grants/pull/1",
        action: "created",
      };
    },
  } satisfies RepositoryPublicationAdapter);

  const githubConnection = await services.createProviderConnection(user, {
    scope: "user",
    provider: "github",
    label: "GitHub",
    authType: "oauth",
    allowedArtifactTypes: [],
  });

  await services.updateTrackedGrantRepositoryBinding(user, grant.id, {
    repositoryUrl: "https://github.com/example/grants",
    baseBranch: "main",
    privyGitHubAccountId: "github-user-1",
    providerConnectionId: githubConnection.connection.id,
  });

  const result = await services.publishRepositoryArtifact(
    user,
    { kind: "tracked_grant", id: grant.id },
    {
      path: "research/request_1/brief.md",
      content: "brief",
      summary: "Attempted publication with a failing GitHub write",
    },
  );

  expect(result.publication).toMatchObject({
    status: "failed",
    branch: "grantfinder/tracked_grant/grant_1",
    commitSha: null,
    pullRequestUrl: null,
    errorMessage: "github is temporarily unavailable",
  });

  const savedGrant = await store.findTrackedGrantById(grant.id);
  expect(savedGrant?.repositoryBinding?.latestPublication).toMatchObject({
    status: "failed",
    branch: "grantfinder/tracked_grant/grant_1",
    errorMessage: "github is temporarily unavailable",
  });

  const state = await store.readState();
  expect(state.agentExecutionRecords).toHaveLength(1);
  expect(state.agentExecutionRecords[0]).toMatchObject({
    actorUserId: user.id,
    providerConnectionId: githubConnection.connection.id,
    targetType: "tracked_grant",
    targetId: grant.id,
    action: "publish_repository_artifact",
  });
});
