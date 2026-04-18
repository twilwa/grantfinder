// ABOUTME: Verifies the browser workspace views render the organization, catalog, application, and provider surfaces.
// ABOUTME: These tests keep the new browser-only tabs covered with a fast render pass in addition to the E2E harness.

import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import {
  ApplicationWorkspaceView,
  CatalogWorkspaceView,
  OrganizationWorkspaceView,
  ProposalWorkspaceView,
  ProviderWorkspaceView,
} from "../src/client-operations.js";

const organization = {
  id: "organization-1",
  ownerUserId: "user-1",
  name: "Oak Harbor Community Labs",
  website: "https://oakharbor.example",
  registrationCountry: "United States",
  registrationRegion: "CA",
  organizationType: "nonprofit",
  operatingScope: "regional",
  localOperatingAreas: ["Oakland", "San Leandro"],
  missionStatement: "Train adults for automation roles and fund local employer pilots.",
  programs: ["Robotics training"],
  targetDemographics: ["Adult learners"],
  thematicAreas: ["Workforce development"],
  annualOperatingBudget: "$500k-$1m",
  strategicPriorities: ["Equipment access"],
  emailUpdatesEnabled: true,
  personnel: [
    {
      id: "person-1",
      fullName: "Jamie Rivera",
      roleTitle: "Programs Director",
      yearsExperience: 8,
      email: "jamie@oakharbor.example",
      userId: "user-2",
      platformAccessEnabled: true,
      accessState: "active",
      canManageInvites: false,
      invite: {
        id: "invite-1",
        invitePath: "/accept/invite-1",
        createdAt: "2026-03-24T12:00:00.000Z",
        acceptedAt: "2026-03-24T12:10:00.000Z",
      },
    },
  ],
  createdAt: "2026-03-24T11:00:00.000Z",
  updatedAt: "2026-03-24T12:15:00.000Z",
} as const;

const catalogGrant = {
  id: "catalog-1",
  createdByUserId: "user-1",
  sourceType: "research",
  sourceGrantId: null,
  sourceReportId: "report-1",
  lastResearchRequestId: "research-request-1",
  title: "State Automation Grant",
  sponsor: "State Economic Development Office",
  fundingType: "grant",
  fitScore: 91,
  whyFit: "Funds automation and workforce capacity-building work.",
  eligibilityNotes: ["Requires a domestic operating entity."],
  amountSummary: "$50,000 to $150,000",
  deadlineSummary: "Rolling intake",
  geography: "United States",
  status: "open",
  citations: ["https://example.gov/grants/automation"],
  nextActions: ["Prepare operating metrics and project budget."],
  tags: ["automation", "workforce"],
  provenanceNotes: "Promoted from the latest research brief.",
  freshnessNotes: "Validated after the March 2026 sponsor update.",
  pursuitNotes: "Move this into a proposal workspace once the LOI outline is ready.",
  lastValidatedAt: "2026-03-24T12:31:00.000Z",
  isBookmarked: true,
  createdAt: "2026-03-24T12:20:00.000Z",
  updatedAt: "2026-03-24T12:30:00.000Z",
} as const;

const catalogLatestReport = {
  id: "report-1",
  requestId: "request-1",
  requesterId: "user-1",
  businessCaseId: "business-case-1",
  executiveSummary: "The sponsor is a good match for automation capacity-building work.",
  searchSummary: "Three relevant opportunities were reviewed and one was promoted.",
  opportunityCount: 1,
  opportunities: [{ title: "State Automation Grant" }],
  rejectedLeads: [{ title: "Local operations grant" }],
  nextActions: ["Draft the first proposal outline."],
  createdAt: "2026-03-24T12:28:00.000Z",
  updatedAt: "2026-03-24T12:29:00.000Z",
} as const;

const catalogResearchRequest = {
  id: "research-request-1",
  requesterId: "user-1",
  scenarioId: "scenario-1",
  sourceCatalogGrantId: "catalog-1",
  researchFocus: "Check the sponsor's current funding window and eligibility details.",
  organizationPrefill: null,
  status: "completed" as const,
  runPhase: "completed" as const,
  progressSummary: "Research completed and the grant was promoted into the catalog.",
  runStartedAt: "2026-03-24T12:22:00.000Z",
  latestBrief: null,
  latestReport: {
    executiveSummary: "The grant is still a strong fit.",
    searchSummary: "Sponsor guidance confirms the program is active.",
    opportunities: [{ title: "State Automation Grant" }],
  },
  errorMessage: null,
  activity: [
    {
      id: "activity-1",
      kind: "status" as const,
      title: "Completed",
      detail: "The research run reached the publishing phase.",
      tone: "good" as const,
      timestamp: "2026-03-24T12:27:00.000Z",
    },
  ],
  steeringNotes: [
    {
      id: "steering-1",
      prompt: "Verify the current deadline and sponsor contact details.",
      status: "applied" as const,
      createdAt: "2026-03-24T12:23:00.000Z",
      appliedAt: "2026-03-24T12:24:00.000Z",
    },
  ],
  createdAt: "2026-03-24T12:21:00.000Z",
  updatedAt: "2026-03-24T12:27:00.000Z",
  lastRunAt: "2026-03-24T12:27:00.000Z",
  grantCount: 1,
  activeGrantCount: 1,
} as const;

const schema = {
  id: "schema-1",
  catalogGrantId: "catalog-1",
  name: "Automation grant application",
  documentType: "grant_proposal" as const,
  sections: [
    {
      id: "section-template-1",
      key: "organization_profile",
      title: "Organization profile",
      stepName: null,
      prompt: "Describe the organization and mission fit.",
      examples: ["Our nonprofit trains adults for automation careers."],
      validation: {
        minWords: 50,
        maxWords: 200,
      },
    },
  ],
  createdAt: "2026-03-24T12:25:00.000Z",
  updatedAt: "2026-03-24T12:35:00.000Z",
} as const;

const template = {
  id: "template-1",
  ownerUserId: "user-1",
  name: "LOI starter",
  documentType: "loi" as const,
  sections: [
    {
      id: "template-section-1",
      key: "need_statement",
      title: "Need statement",
      stepName: null,
      prompt: "Explain the problem and why the team is positioned to solve it.",
      examples: [],
      validation: {
        minWords: 75,
        maxWords: 250,
      },
    },
  ],
  createdAt: "2026-03-24T12:40:00.000Z",
  updatedAt: "2026-03-24T12:40:00.000Z",
} as const;

const workspace = {
  id: "workspace-1",
  requesterId: "user-1",
  catalogGrantId: "catalog-1",
  templateId: "template-1",
  organizationPrefill: {
    name: organization.name,
    website: organization.website,
    registrationCountry: organization.registrationCountry,
    registrationRegion: organization.registrationRegion,
    organizationType: organization.organizationType,
    operatingScope: organization.operatingScope,
    localOperatingAreas: [...organization.localOperatingAreas],
    missionStatement: organization.missionStatement,
    programs: [...organization.programs],
    targetDemographics: [...organization.targetDemographics],
    thematicAreas: [...organization.thematicAreas],
    annualOperatingBudget: organization.annualOperatingBudget,
    strategicPriorities: [...organization.strategicPriorities],
  },
  documentType: "grant_proposal" as const,
  title: "State Automation Grant proposal",
  state: "draft" as const,
  sections: [
    {
      id: "workspace-section-1",
      key: "organization_profile",
      title: "Organization profile",
      stepName: null,
      prompt: "Describe the organization and mission fit.",
      examples: [],
      validation: {
        minWords: 50,
        maxWords: 200,
      },
      orderIndex: 0,
      content: "Oak Harbor Community Labs serves adult learners across the East Bay.",
      createdAt: "2026-03-24T12:45:00.000Z",
      updatedAt: "2026-03-24T12:45:00.000Z",
    },
  ],
  createdAt: "2026-03-24T12:45:00.000Z",
  updatedAt: "2026-03-24T12:45:00.000Z",
  finalizedAt: null,
} as const;

const proposalApplicationWorkspace = {
  id: "proposal-application-1",
  requesterId: "user-1",
  catalogGrantId: null,
  templateId: null,
  organizationPrefill: null,
  documentType: "grant_proposal" as const,
  title: "State Automation Grant proposal draft",
  state: "draft" as const,
  sections: [],
  createdAt: "2026-03-24T12:45:00.000Z",
  updatedAt: "2026-03-24T13:05:00.000Z",
  finalizedAt: null,
} as const;

const proposalWorkspace = {
  id: "proposal-1",
  ownerUserId: "user-1",
  organizationId: "organization-1",
  trackedGrantId: "grant-1",
  catalogGrantId: "catalog-1",
  opportunity: {
    sourceType: "catalog_grant" as const,
    title: "State Automation Grant",
    sponsor: "State Economic Development Office",
    fundingType: "grant",
    amountSummary: "$50,000 to $150,000",
    deadlineSummary: "Rolling intake",
    geography: "United States",
    sourceUrl: null,
    notes: "Qualified from the grant queue.",
  },
  stage: "drafting" as const,
  summary: "Qualified the opportunity and started the first draft.",
  nextSteps: ["Draft the narrative", "Confirm the budget"],
  openQuestions: ["Does the sponsor require employer commitment letters?"],
  primaryApplicationWorkspaceId: proposalApplicationWorkspace.id,
  primaryApplicationWorkspace: {
    id: proposalApplicationWorkspace.id,
    title: proposalApplicationWorkspace.title,
    state: proposalApplicationWorkspace.state,
    documentType: proposalApplicationWorkspace.documentType,
    updatedAt: proposalApplicationWorkspace.updatedAt,
    finalizedAt: proposalApplicationWorkspace.finalizedAt,
  },
  feasibilitySnapshot: {
    verdict: "go",
    confidence: "high" as const,
    blockers: ["Need updated program metrics."],
    assumptions: ["The sponsor accepts our nonprofit registration."],
    requiredDocuments: ["Project budget", "Organization financials"],
    recommendedNextStep: "Draft the narrative and collect supporting documents.",
    updatedAt: "2026-03-24T13:10:00.000Z",
  },
  contacts: [
    {
      id: "contact-1",
      name: "Dana Kim",
      roleTitle: "Procurement lead",
      email: "dana@example.gov",
      phone: null,
      organization: "State Economic Development Office",
      notes: "Prefers email follow-up.",
      createdAt: "2026-03-24T13:15:00.000Z",
      updatedAt: "2026-03-24T13:15:00.000Z",
    },
  ],
  outreachEvents: [
    {
      id: "outreach-1",
      kind: "email" as const,
      direction: "outbound" as const,
      subject: "Submission check-in",
      summary: "Sent a note with the first proposal outline.",
      occurredAt: "2026-03-24T13:20:00.000Z",
      createdAt: "2026-03-24T13:20:00.000Z",
    },
  ],
  outcome: {
    status: "submitted" as const,
    summary: "Submission prepared and awaiting sponsor review.",
    recordedAt: "2026-03-24T13:30:00.000Z",
  },
  proposalJobId: "job-1",
  proposalJob: {
    id: "job-1",
    title: "Grant proposal for State Automation Grant",
    status: "open",
    offerCount: 1,
    catalogGrantId: "catalog-1",
  },
  engagementId: "engagement-1",
  engagement: {
    id: "engagement-1",
    status: "funded",
    amountUsd: "2500.00",
    specialistName: "Jordan Lee",
    catalogGrantId: "catalog-1",
  },
  createdAt: "2026-03-24T13:00:00.000Z",
  updatedAt: "2026-03-24T13:30:00.000Z",
} as const;

const proposalGrant = {
  id: "grant-1",
  requestId: "request-1",
  requesterId: "user-1",
  catalogGrantId: "catalog-1",
  title: "State Automation Grant",
  sponsor: "State Economic Development Office",
  fundingType: "grant",
  fitScore: 91,
  whyFit: "Funds automation and workforce capacity-building work.",
  eligibilityNotes: ["Requires a domestic operating entity."],
  amountSummary: "$50,000 to $150,000",
  deadlineSummary: "Rolling intake",
  geography: "United States",
  status: "open",
  citations: ["https://example.gov/grants/automation"],
  nextActions: ["Prepare operating metrics and project budget."],
  queueState: "active" as const,
  proposalWorkspaceId: proposalWorkspace.id,
  proposalJobId: proposalWorkspace.proposalJobId,
  createdAt: "2026-03-24T12:55:00.000Z",
  updatedAt: "2026-03-24T13:00:00.000Z",
  requestStatus: "completed" as const,
  scenarioName: "Automation expansion",
} as const;

const providerConnection = {
  id: "provider-1",
  scope: "user" as const,
  ownerUserId: "user-1",
  organizationId: null,
  provider: "openai",
  label: "Team OpenAI",
  authType: "byok" as const,
  allowedArtifactTypes: ["workspace_section"] as const,
  createdAt: "2026-03-24T12:50:00.000Z",
  updatedAt: "2026-03-24T12:50:00.000Z",
};

const providerConnectionWithProposalWorkspace = {
  ...providerConnection,
  allowedArtifactTypes: ["workspace_section", "proposal_workspace"] as const,
};

const execution = {
  id: "execution-1",
  actorUserId: "user-1",
  providerConnectionId: "provider-1",
  targetType: "workspace_section" as const,
  targetId: "workspace-section-1",
  action: "generate_section",
  outputText: "Generated application draft text.",
  createdAt: "2026-03-24T12:55:00.000Z",
};

test("OrganizationWorkspaceView renders the organization profile and invite surface", () => {
  const markup = renderToStaticMarkup(
    <OrganizationWorkspaceView
      organization={organization}
      busyAction={null}
      onSaveProfile={() => undefined}
      onAddPersonnel={() => undefined}
      onAcceptInvite={() => undefined}
    />,
  );

  expect(markup).toContain("Organization profile");
  expect(markup).toContain("Personnel and invites");
  expect(markup).toContain("Jamie Rivera");
  expect(markup).toContain("Train adults for automation roles and fund local employer pilots.");
  expect(markup).toContain("Accepted");
});

test("CatalogWorkspaceView renders the grant detail and schema controls", () => {
  const markup = renderToStaticMarkup(
    <CatalogWorkspaceView
      grants={[catalogGrant]}
      selectedGrantId={catalogGrant.id}
      selectedGrantDetail={{
        grant: catalogGrant,
        schema,
        latestReport: catalogLatestReport,
        researchRequests: [catalogResearchRequest],
        proposalWorkspace,
        proposalJob: proposalWorkspace.proposalJob,
        engagement: proposalWorkspace.engagement,
      }}
      busyAction={null}
      onSelectGrant={() => undefined}
      onToggleBookmark={() => undefined}
      onSaveGrant={() => undefined}
      onStartResearch={() => undefined}
      onSaveSchema={() => undefined}
      onCreateProposalWorkspace={() => undefined}
      onCreateProposalJob={() => undefined}
    />,
  );

  expect(markup).toContain("Grant catalog");
  expect(markup).toContain("State Automation Grant");
  expect(markup).toContain("Enrichment");
  expect(markup).toContain("Follow-up research");
  expect(markup).toContain("Latest report");
  expect(markup).toContain("Research history");
  expect(markup).toContain("Linked proposal workspace");
  expect(markup).toContain("Linked proposal job");
  expect(markup).toContain("Linked engagement");
  expect(markup).toContain("Application schema");
  expect(markup).toContain("Review promoted opportunities, bookmark the best fits, and attach a structured application schema.");
  expect(markup).toContain("Open proposal workspace");
});

test("ApplicationWorkspaceView renders templates and workspaces", () => {
  const markup = renderToStaticMarkup(
    <ApplicationWorkspaceView
      catalogGrants={[catalogGrant]}
      templates={[template]}
      workspaces={[workspace]}
      providerConnections={[providerConnection]}
      busyAction={null}
      onCreateTemplate={() => undefined}
      onCreateWorkspace={() => undefined}
      onUpdateSection={() => undefined}
      onGenerateSection={() => undefined}
      onFinalizeWorkspace={() => undefined}
    />,
  );

  expect(markup).toContain("Reusable templates");
  expect(markup).toContain("New workspace");
  expect(markup).toContain("Create workspace");
  expect(markup).toContain("Launch a working draft from a saved template or start from an empty document type.");
  expect(markup).toContain("Catalog-backed source");
  expect(markup).toContain("LOI starter");
  expect(markup).toContain("State Automation Grant proposal");
});

test("ProposalWorkspaceView renders the proposal control room and linked pursuit state", () => {
  const markup = renderToStaticMarkup(
    <ProposalWorkspaceView
      grants={[proposalGrant]}
      workspaces={[proposalWorkspace]}
      applicationWorkspaces={[proposalApplicationWorkspace]}
      providerConnections={[providerConnectionWithProposalWorkspace]}
      busyAction={null}
      onCreateWorkspaceFromGrant={() => undefined}
      onCreateProposalJob={() => undefined}
      onUpdateWorkspace={() => undefined}
      onRunWorkspaceAction={() => undefined}
    />,
  );

  expect(markup).toContain("Proposal workspaces");
  expect(markup).toContain("State Automation Grant");
  expect(markup).toContain("Stage");
  expect(markup).toContain("Feasibility review");
  expect(markup).toContain("Contacts");
  expect(markup).toContain("Outreach history");
  expect(markup).toContain("Outcome");
  expect(markup).toContain("State Automation Grant proposal draft");
  expect(markup).toContain("Create or attach proposal job");
  expect(markup).toContain("Automation");
  expect(markup).toContain("Evaluate feasibility");
});

test("ProviderWorkspaceView renders provider connections and execution history", () => {
  const markup = renderToStaticMarkup(
    <ProviderWorkspaceView
      organization={organization}
      connections={[providerConnectionWithProposalWorkspace]}
      executions={[execution]}
      busyAction={null}
      onCreateConnection={() => undefined}
    />,
  );

  expect(markup).toContain("Provider connections");
  expect(markup).toContain("Execution history");
  expect(markup).toContain("Team OpenAI");
  expect(markup).toContain("generate_section");
  expect(markup).toContain("Proposal workspace");
});
