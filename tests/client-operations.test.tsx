// ABOUTME: Verifies the browser workspace views render the organization, catalog, application, and provider surfaces.
// ABOUTME: These tests keep the new browser-only tabs covered with a fast render pass in addition to the E2E harness.

import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import {
  ApplicationWorkspaceView,
  CatalogWorkspaceView,
  OrganizationWorkspaceView,
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
  sourceType: "report",
  sourceGrantId: null,
  sourceReportId: "report-1",
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
  isBookmarked: true,
  createdAt: "2026-03-24T12:20:00.000Z",
  updatedAt: "2026-03-24T12:30:00.000Z",
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
      selectedGrantDetail={{ grant: catalogGrant, schema }}
      busyAction={null}
      onSelectGrant={() => undefined}
      onToggleBookmark={() => undefined}
      onSaveSchema={() => undefined}
      onCreateWorkspaceFromGrant={() => undefined}
    />,
  );

  expect(markup).toContain("Grant catalog");
  expect(markup).toContain("State Automation Grant");
  expect(markup).toContain("Application schema");
  expect(markup).toContain("Create proposal workspace");
});

test("ApplicationWorkspaceView renders templates and workspaces", () => {
  const markup = renderToStaticMarkup(
    <ApplicationWorkspaceView
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
  expect(markup).toContain("LOI starter");
  expect(markup).toContain("State Automation Grant proposal");
});

test("ProviderWorkspaceView renders provider connections and execution history", () => {
  const markup = renderToStaticMarkup(
    <ProviderWorkspaceView
      organization={organization}
      connections={[providerConnection]}
      executions={[execution]}
      busyAction={null}
      onCreateConnection={() => undefined}
    />,
  );

  expect(markup).toContain("Provider connections");
  expect(markup).toContain("Execution history");
  expect(markup).toContain("Team OpenAI");
  expect(markup).toContain("generate_section");
});
