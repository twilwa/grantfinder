// ABOUTME: Verifies repository publication hooks for research, proposal, and application artifact flows.
// ABOUTME: These tests exercise durable saves and the existing publication adapter without browser UI involvement.

import { expect, test } from "bun:test";
import { newDb } from "pg-mem";

import { ApplicationServices, type RepositoryBindingInput } from "../src/services.js";
import { ApplicationStore } from "../src/store.js";
import type { FundingResearchResult } from "../src/agent.js";
import type { RepositoryPublicationAdapter } from "../src/repository-publication.js";

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
      ],
      rejectedLeads: [],
      nextActions: ["Choose one program to activate in the queue."],
    },
    messages: [],
  };
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

  const grant = await store.replaceTrackedGrants(request.id, [
    {
      id: "grant_1",
      requestId: request.id,
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

  const catalogGrant = await store.saveGrantCatalogEntry({
    id: "catalog_1",
    createdByUserId: userId,
    sourceType: "research",
    sourceGrantId: grant[0].id,
    sourceReportId: null,
    lastResearchRequestId: request.id,
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

  return { scenario, request, grant: grant[0], catalogGrant };
}

function createPublicationRecorder(options: { failWrite?: boolean } = {}) {
  const commitCalls: any[] = [];
  const pullRequestCalls: any[] = [];
  const adapter: RepositoryPublicationAdapter = {
    async writeBranchCommit(input) {
      commitCalls.push(input);
      if (options.failWrite) {
        throw new Error("github is temporarily unavailable");
      }

      return { commitSha: `commit-${commitCalls.length}` };
    },
    async upsertPullRequest(input) {
      pullRequestCalls.push(input);
      return {
        pullRequestUrl: `https://github.com/example/grants/pull/${pullRequestCalls.length}`,
        action: pullRequestCalls.length === 1 ? "created" : "updated",
      };
    },
  };

  return { adapter, commitCalls, pullRequestCalls };
}

function createRepositoryBinding(connectionId: string, overrides: Partial<RepositoryBindingInput> = {}) {
  return {
    repositoryUrl: "https://github.com/example/grants",
    baseBranch: "main",
    privyGitHubAccountId: "github-user-1",
    providerConnectionId: connectionId,
    ...overrides,
  } satisfies RepositoryBindingInput;
}

test("repo-linked research runs publish brief, report, and supporting outputs", async () => {
  const store = new ApplicationStore({ database: createTestDatabase() });
  const user = await createRequester(store);
  const { catalogGrant, grant } = await createResearchContext(store, user.id);
  const recorder = createPublicationRecorder();
  const services = new ApplicationServices(
    store,
    undefined,
    async () => createResearchResult("scenario_1"),
    null,
    recorder.adapter,
  );

  const githubConnection = await services.createProviderConnection(user, {
    scope: "user",
    provider: "github",
    label: "GitHub",
    authType: "oauth",
    allowedArtifactTypes: [],
  });

  await services.updateTrackedGrantRepositoryBinding(
    user,
    grant.id,
    createRepositoryBinding(githubConnection.connection.id),
  );

  const result = await services.startCatalogGrantResearch(user, catalogGrant.id);
  const requestId = result.request.id;

  expect(result.request.status).toBe("completed");
  expect(result.grants).toHaveLength(1);
  expect(recorder.commitCalls).toHaveLength(3);
  expect(recorder.pullRequestCalls).toHaveLength(3);
  expect(recorder.commitCalls.map((call) => (call as { branchName: string }).branchName)).toEqual([
    "grantfinder/tracked_grant/grant_1",
    "grantfinder/tracked_grant/grant_1",
    "grantfinder/tracked_grant/grant_1",
  ]);
  expect(recorder.commitCalls.map((call) => (call as { files: Array<{ path: string }> }).files[0].path)).toEqual([
    `grantfinder/research/${requestId}/brief.md`,
    `grantfinder/research/${requestId}/report.md`,
    `grantfinder/research/${requestId}/supporting.md`,
  ]);

  const savedGrant = await store.findTrackedGrantById(grant.id);
  expect(savedGrant?.repositoryBinding?.latestPublication).toMatchObject({
    status: "published",
    branch: "grantfinder/tracked_grant/grant_1",
  });

  const catalogRead = await services.getCatalogGrant(user, catalogGrant.id);
  expect(catalogRead.grant.repositoryBinding).toMatchObject({
    repositoryUrl: "https://github.com/example/grants",
    baseBranch: "main",
    latestPublication: {
      status: "published",
      branch: "grantfinder/tracked_grant/grant_1",
    },
  });
  expect(catalogRead.grant.repositoryBindingSource).toEqual({
    kind: "tracked_grant",
    id: grant.id,
  });
});

test("failed research publication preserves the saved research output", async () => {
  const store = new ApplicationStore({ database: createTestDatabase() });
  const user = await createRequester(store);
  const { catalogGrant, grant } = await createResearchContext(store, user.id);
  const recorder = createPublicationRecorder({ failWrite: true });
  const services = new ApplicationServices(
    store,
    undefined,
    async () => createResearchResult("scenario_1"),
    null,
    recorder.adapter,
  );

  const githubConnection = await services.createProviderConnection(user, {
    scope: "user",
    provider: "github",
    label: "GitHub",
    authType: "oauth",
    allowedArtifactTypes: [],
  });

  await services.updateTrackedGrantRepositoryBinding(
    user,
    grant.id,
    createRepositoryBinding(githubConnection.connection.id),
  );

  const result = await services.startCatalogGrantResearch(user, catalogGrant.id);
  const requestDetails = await services.getResearchRequest(user, result.request.id);

  expect(result.request.status).toBe("completed");
  expect(requestDetails.request.latestBrief).not.toBeNull();
  expect(requestDetails.request.latestReport).not.toBeNull();
  expect(recorder.commitCalls).toHaveLength(3);
  expect(recorder.pullRequestCalls).toHaveLength(0);

  const savedGrant = await store.findTrackedGrantById(grant.id);
  expect(savedGrant?.repositoryBinding?.latestPublication).toMatchObject({
    status: "failed",
    branch: "grantfinder/tracked_grant/grant_1",
    errorMessage: "github is temporarily unavailable",
  });

  const catalogRead = await services.getCatalogGrant(user, catalogGrant.id);
  expect(catalogRead.grant.repositoryBinding).toMatchObject({
    latestPublication: {
      status: "failed",
      branch: "grantfinder/tracked_grant/grant_1",
      errorMessage: "github is temporarily unavailable",
    },
  });
});

test("proposal workspace actions publish durable artifact updates", async () => {
  const store = new ApplicationStore({ database: createTestDatabase() });
  const user = await createRequester(store);
  const { catalogGrant, grant } = await createResearchContext(store, user.id);
  const recorder = createPublicationRecorder();
  const services = new ApplicationServices(
    store,
    undefined,
    async () => createResearchResult("scenario_1"),
    null,
    recorder.adapter,
  );

  const githubConnection = await services.createProviderConnection(user, {
    scope: "user",
    provider: "github",
    label: "GitHub",
    authType: "oauth",
    allowedArtifactTypes: ["proposal_workspace"],
  });

  await services.updateTrackedGrantRepositoryBinding(
    user,
    grant.id,
    createRepositoryBinding(githubConnection.connection.id),
  );

  const proposalWorkspace = await services.createProposalWorkspaceFromCatalogGrant(user, catalogGrant.id);
  const actionResult = await services.runProposalWorkspaceAction(user, proposalWorkspace.workspace.id, {
    action: "discover_contacts",
    providerConnectionId: githubConnection.connection.id,
  });
  const updatedProposal = await services.getProposalWorkspace(user, proposalWorkspace.workspace.id);

  expect(actionResult.workspace.contacts).toHaveLength(1);
  expect(recorder.commitCalls.map((call) => (call as { files: Array<{ path: string }> }).files[0].path)).toEqual([
    `grantfinder/pursuits/${proposalWorkspace.workspace.id}/workspace.md`,
    `grantfinder/pursuits/${proposalWorkspace.workspace.id}/contacts.md`,
  ]);
  expect(updatedProposal.workspace.repositoryBinding).toMatchObject({
    latestPublication: {
      status: "published",
      branch: "grantfinder/tracked_grant/grant_1",
    },
  });
});

test("explicit proposal sync publishes the current workspace artifact", async () => {
  const store = new ApplicationStore({ database: createTestDatabase() });
  const user = await createRequester(store);
  const { catalogGrant, grant } = await createResearchContext(store, user.id);
  const recorder = createPublicationRecorder();
  const services = new ApplicationServices(
    store,
    undefined,
    async () => createResearchResult("scenario_1"),
    null,
    recorder.adapter,
  );

  const githubConnection = await services.createProviderConnection(user, {
    scope: "user",
    provider: "github",
    label: "GitHub",
    authType: "oauth",
    allowedArtifactTypes: ["proposal_workspace"],
  });

  await services.updateTrackedGrantRepositoryBinding(
    user,
    grant.id,
    createRepositoryBinding(githubConnection.connection.id),
  );

  const proposalWorkspace = await services.createProposalWorkspaceFromCatalogGrant(user, catalogGrant.id);
  const updateResult = await services.updateProposalWorkspace(user, proposalWorkspace.workspace.id, {
    stage: "drafting",
    summary: "Updated the proposal workspace summary.",
    nextSteps: ["Validate the next draft"],
    openQuestions: ["Need sponsor feedback."],
  });

  expect(updateResult.workspace.summary).toBe("Updated the proposal workspace summary.");
  expect(recorder.commitCalls).toHaveLength(1);
  expect(recorder.commitCalls[0]).toMatchObject({
    branchName: "grantfinder/tracked_grant/grant_1",
  });
  expect((recorder.commitCalls[0] as { files: Array<{ path: string }> }).files[0].path).toBe(
    `grantfinder/pursuits/${proposalWorkspace.workspace.id}/workspace.md`,
  );
});

test("manual RFP workspaces publish the durable proposal artifact when synced", async () => {
  const store = new ApplicationStore({ database: createTestDatabase() });
  const user = await createRequester(store);
  const recorder = createPublicationRecorder();
  const services = new ApplicationServices(
    store,
    undefined,
    async () => createResearchResult("scenario_1"),
    null,
    recorder.adapter,
  );

  const workspace = await services.createProposalWorkspace(user, {
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
  });
  const githubConnection = await services.createProviderConnection(user, {
    scope: "user",
    provider: "github",
    label: "GitHub",
    authType: "oauth",
    allowedArtifactTypes: ["proposal_workspace"],
  });

  await services.updateProposalWorkspaceRepositoryBinding(
    user,
    workspace.workspace.id,
    createRepositoryBinding(githubConnection.connection.id, { baseBranch: "develop", rootPath: "manual/" }),
  );

  await services.updateProposalWorkspace(user, workspace.workspace.id, {
    stage: "submitted",
    summary: "The response package is complete and has been submitted.",
    nextSteps: ["Monitor the procurement portal"],
  });

  expect(recorder.commitCalls).toHaveLength(1);
  expect(recorder.commitCalls[0]).toMatchObject({
    branchName: `grantfinder/proposal_workspace/${workspace.workspace.id}`,
  });
  expect((recorder.commitCalls[0] as { files: Array<{ path: string }> }).files[0].path).toBe(
    `manual/pursuits/${workspace.workspace.id}/workspace.md`,
  );
});

test("application section generations publish the section artifact", async () => {
  const store = new ApplicationStore({ database: createTestDatabase() });
  const user = await createRequester(store);
  const { catalogGrant, grant } = await createResearchContext(store, user.id);
  const recorder = createPublicationRecorder();
  const services = new ApplicationServices(
    store,
    undefined,
    async () => createResearchResult("scenario_1"),
    null,
    recorder.adapter,
  );

  const githubConnection = await services.createProviderConnection(user, {
    scope: "user",
    provider: "github",
    label: "GitHub",
    authType: "oauth",
    allowedArtifactTypes: ["proposal_workspace", "workspace_section"],
  });

  await services.updateTrackedGrantRepositoryBinding(
    user,
    grant.id,
    createRepositoryBinding(githubConnection.connection.id),
  );

  const proposalWorkspace = await services.createProposalWorkspaceFromCatalogGrant(user, catalogGrant.id);
  const state = await store.readState();
  const applicationWorkspace = state.applicationWorkspaces.find(
    (workspace) => workspace.id === proposalWorkspace.workspace.primaryApplicationWorkspace?.id,
  );
  const section = applicationWorkspace?.sections.find((candidate) => candidate.key === "project_summary");
  if (!applicationWorkspace || !section) {
    throw new Error("Application workspace section was not created.");
  }

  const generationResult = await services.generateApplicationWorkspaceSection(
    user,
    applicationWorkspace.id,
    section.id,
    { providerConnectionId: githubConnection.connection.id },
  );

  expect(generationResult.section?.content).not.toBe("");
  expect(recorder.commitCalls).toHaveLength(1);
  expect(recorder.commitCalls[0]).toMatchObject({
    branchName: "grantfinder/tracked_grant/grant_1",
  });
  expect((recorder.commitCalls[0] as { files: Array<{ path: string }> }).files[0].path).toBe(
    `grantfinder/applications/${applicationWorkspace.id}/${section.key}.md`,
  );
});

test("finalized application workspaces publish the final document", async () => {
  const store = new ApplicationStore({ database: createTestDatabase() });
  const user = await createRequester(store);
  const { catalogGrant, grant } = await createResearchContext(store, user.id);
  const recorder = createPublicationRecorder();
  const services = new ApplicationServices(
    store,
    undefined,
    async () => createResearchResult("scenario_1"),
    undefined,
    recorder.adapter,
  );

  const githubConnection = await services.createProviderConnection(user, {
    scope: "user",
    provider: "github",
    label: "GitHub",
    authType: "oauth",
    allowedArtifactTypes: ["proposal_workspace", "workspace_section"],
  });

  await services.updateTrackedGrantRepositoryBinding(
    user,
    grant.id,
    createRepositoryBinding(githubConnection.connection.id),
  );

  const proposalWorkspace = await services.createProposalWorkspaceFromCatalogGrant(user, catalogGrant.id);
  const state = await store.readState();
  const applicationWorkspace = state.applicationWorkspaces.find(
    (workspace) => workspace.id === proposalWorkspace.workspace.primaryApplicationWorkspace?.id,
  );
  if (!applicationWorkspace) {
    throw new Error("Application workspace was not created.");
  }

  await services.finalizeApplicationWorkspace(user, applicationWorkspace.id);

  expect(recorder.commitCalls).toHaveLength(1);
  expect(recorder.commitCalls[0]).toMatchObject({
    branchName: "grantfinder/tracked_grant/grant_1",
  });
  expect((recorder.commitCalls[0] as { files: Array<{ path: string }> }).files[0].path).toBe(
    `grantfinder/applications/${applicationWorkspace.id}/final.md`,
  );
});
