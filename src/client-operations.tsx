// ABOUTME: Renders the browser workspace surfaces for organization, catalog, applications, providers, and execution history.
// ABOUTME: These views stay presentation-focused and delegate network mutations back to the main client shell.

import { useEffect, useState, type FormEvent } from "react";

import {
  SectionCard,
  StatusBadge,
  buttonStyle,
  formCardStyle,
  formatTimestamp,
  inputStyle,
  parseTextList,
  shellCardStyle,
  subtleCardStyle,
  textareaStyle,
} from "./client-shared.js";

export type ApplicationDocumentType = "grant_proposal" | "loi" | "budget_narrative" | "other";
export type ProviderConnectionScope = "user" | "organization";
export type ProviderAuthType = "byok" | "oauth";
export type ProviderArtifactType = "grant_catalog_entry" | "application_workspace" | "workspace_section" | "proposal_workspace";

export interface OrganizationInviteSummary {
  id: string;
  invitePath: string;
  createdAt: string;
  acceptedAt: string | null;
}

export interface OrganizationPersonnelSummary {
  id: string;
  fullName: string;
  roleTitle: string;
  yearsExperience: number | null;
  email: string | null;
  userId: string | null;
  platformAccessEnabled: boolean;
  accessState: string;
  canManageInvites: boolean;
  invite: OrganizationInviteSummary | null;
}

export interface OrganizationSummary {
  id: string;
  ownerUserId: string;
  name: string;
  website: string | null;
  registrationCountry: string;
  registrationRegion: string | null;
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
  personnel: OrganizationPersonnelSummary[];
  createdAt: string;
  updatedAt: string;
}

export interface CatalogGrantSummary {
  id: string;
  createdByUserId: string;
  sourceType: "promoted" | "curated" | "research";
  sourceGrantId: string | null;
  sourceReportId: string | null;
  lastResearchRequestId: string | null;
  title: string;
  sponsor: string;
  fundingType: string;
  fitScore: number;
  whyFit: string;
  eligibilityNotes: string[];
  amountSummary: string;
  deadlineSummary: string;
  geography: string;
  status: string;
  citations: string[];
  nextActions: string[];
  tags: string[];
  provenanceNotes: string | null;
  freshnessNotes: string | null;
  pursuitNotes: string | null;
  lastValidatedAt: string | null;
  isBookmarked: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CatalogReportSummary {
  id: string;
  requestId: string;
  requesterId: string;
  businessCaseId: string;
  executiveSummary: string;
  searchSummary: string;
  opportunityCount: number;
  opportunities: Array<{ title: string }>;
  rejectedLeads: Array<{ title: string }>;
  nextActions: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CatalogResearchActivity {
  id: string;
  kind: "status" | "tool" | "steering";
  title: string;
  detail: string;
  tone: "neutral" | "good" | "warn" | "bad";
  timestamp: string;
}

export interface CatalogResearchSteeringNote {
  id: string;
  prompt: string;
  status: "queued" | "applied";
  createdAt: string;
  appliedAt: string | null;
}

export interface CatalogResearchRequestSummary {
  id: string;
  requesterId: string;
  scenarioId: string;
  sourceCatalogGrantId: string | null;
  researchFocus: string | null;
  organizationPrefill: unknown | null;
  status: "draft" | "running" | "completed" | "failed";
  runPhase: "idle" | "briefing" | "searching" | "reading" | "synthesizing" | "publishing" | "completed" | "failed";
  progressSummary: string | null;
  runStartedAt: string | null;
  latestBrief: unknown | null;
  latestReport: {
    executiveSummary?: string;
    searchSummary?: string;
    opportunities?: Array<{ title: string }>;
  } | null;
  errorMessage: string | null;
  activity: CatalogResearchActivity[];
  steeringNotes: CatalogResearchSteeringNote[];
  createdAt: string;
  updatedAt: string;
  lastRunAt: string | null;
  grantCount: number;
  activeGrantCount: number;
}

export interface ApplicationSectionDefinition {
  id: string;
  key: string;
  title: string;
  stepName: string | null;
  prompt: string | null;
  examples: string[];
  validation: {
    minWords: number | null;
    maxWords: number | null;
  };
}

export interface CatalogGrantSchema {
  id: string;
  catalogGrantId: string;
  name: string;
  documentType: ApplicationDocumentType;
  sections: ApplicationSectionDefinition[];
  createdAt: string;
  updatedAt: string;
}

export interface CatalogGrantDetailPayload {
  grant: CatalogGrantSummary;
  schema: CatalogGrantSchema | null;
  latestReport: CatalogReportSummary | null;
  researchRequests: CatalogResearchRequestSummary[];
  proposalWorkspace: ProposalWorkspaceSummary | null;
  proposalJob: {
    id: string;
    title: string;
    status: string;
    offerCount: number;
    catalogGrantId: string | null;
  } | null;
  engagement: {
    id: string;
    status: string;
    amountUsd: string;
    specialistName: string;
    catalogGrantId: string | null;
  } | null;
}

export interface ApplicationTemplateSummary {
  id: string;
  ownerUserId: string;
  name: string;
  documentType: ApplicationDocumentType;
  sections: ApplicationSectionDefinition[];
  createdAt: string;
  updatedAt: string;
}

export interface ApplicationWorkspaceSummary {
  id: string;
  requesterId: string;
  catalogGrantId: string | null;
  templateId: string | null;
  organizationPrefill: {
    name: string;
    website: string | null;
    registrationCountry: string;
    registrationRegion: string | null;
    organizationType: string;
    operatingScope: string;
    localOperatingAreas: string[];
    missionStatement: string;
    programs: string[];
    targetDemographics: string[];
    thematicAreas: string[];
    annualOperatingBudget: string;
    strategicPriorities: string[];
  } | null;
  documentType: ApplicationDocumentType;
  title: string;
  state: "draft" | "proposal";
  sections: Array<
    ApplicationSectionDefinition & {
      orderIndex: number;
      content: string;
      createdAt: string;
      updatedAt: string;
    }
  >;
  createdAt: string;
  updatedAt: string;
  finalizedAt: string | null;
}

export interface ProposalGrantSummary {
  id: string;
  title: string;
  sponsor: string;
  fitScore: number;
  amountSummary: string;
  deadlineSummary: string;
  geography: string;
  queueState: "active" | "inactive";
  proposalWorkspaceId: string | null;
  proposalJobId: string | null;
  requestStatus: string;
  scenarioName: string;
  nextActions: string[];
}

export interface ProposalWorkspaceSummary {
  id: string;
  ownerUserId: string;
  organizationId: string | null;
  trackedGrantId: string | null;
  catalogGrantId: string | null;
  opportunity: {
    sourceType: "tracked_grant" | "catalog_grant" | "manual";
    title: string;
    sponsor: string;
    fundingType: string;
    amountSummary: string | null;
    deadlineSummary: string | null;
    geography: string | null;
    sourceUrl: string | null;
    notes: string | null;
  };
  stage: "qualifying" | "drafting" | "outreach" | "submitted" | "awarded" | "declined" | "no_bid";
  summary: string;
  nextSteps: string[];
  openQuestions: string[];
  primaryApplicationWorkspaceId: string | null;
  primaryApplicationWorkspace: {
    id: string;
    title: string;
    state: ApplicationWorkspaceSummary["state"];
    documentType: ApplicationDocumentType;
    updatedAt: string;
    finalizedAt: string | null;
  } | null;
  feasibilitySnapshot: {
    verdict: string;
    confidence: "high" | "medium" | "low";
    blockers: string[];
    assumptions: string[];
    requiredDocuments: string[];
    recommendedNextStep: string;
    updatedAt: string;
  } | null;
  contacts: Array<{
    id: string;
    name: string;
    roleTitle: string | null;
    email: string | null;
    phone: string | null;
    organization: string | null;
    notes: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
  outreachEvents: Array<{
    id: string;
    kind: "email" | "call" | "meeting" | "note" | "other";
    direction: "outbound" | "inbound";
    subject: string | null;
    summary: string;
    occurredAt: string;
    createdAt: string;
  }>;
  outcome: {
    status: "submitted" | "awarded" | "declined" | "no_bid";
    summary: string;
    recordedAt: string;
  } | null;
  proposalJobId: string | null;
  proposalJob: {
    id: string;
    title: string;
    status: string;
    offerCount: number;
    catalogGrantId: string | null;
  } | null;
  engagementId: string | null;
  engagement: {
    id: string;
    status: string;
    amountUsd: string;
    specialistName: string;
    catalogGrantId: string | null;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProposalWorkspaceUpdateInput {
  stage?: ProposalWorkspaceSummary["stage"];
  summary?: string;
  nextSteps?: string[];
  openQuestions?: string[];
  feasibilitySnapshot?: {
    verdict: string;
    confidence: "high" | "medium" | "low";
    blockers: string[];
    assumptions: string[];
    requiredDocuments: string[];
    recommendedNextStep: string;
  };
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
}

export interface ProviderConnectionSummary {
  id: string;
  scope: ProviderConnectionScope;
  ownerUserId: string | null;
  organizationId: string | null;
  provider: string;
  label: string;
  authType: ProviderAuthType;
  allowedArtifactTypes: ProviderArtifactType[];
  createdAt: string;
  updatedAt: string;
}

export interface AgentExecutionSummary {
  id: string;
  actorUserId: string;
  providerConnectionId: string;
  targetType: ProviderArtifactType;
  targetId: string;
  action: string;
  outputText: string;
  createdAt: string;
}

export interface OrganizationProfileInput {
  name: string;
  website: string | null;
  registrationCountry: string;
  registrationRegion: string | null;
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
}

export interface OrganizationPersonnelInput {
  fullName: string;
  roleTitle: string;
  yearsExperience: number | null;
  email: string | null;
  platformAccessEnabled: boolean;
  canManageInvites: boolean;
}

export interface SectionDefinitionInput {
  key: string;
  title: string;
  stepName?: string | null;
  prompt?: string | null;
  examples?: string[];
  validation?: {
    minWords?: number | null;
    maxWords?: number | null;
  };
}

function createSectionDefinitionsTemplate(): SectionDefinitionInput[] {
  return [
    {
      key: "organization_profile",
      title: "Organization profile",
      prompt: "Describe the organization, the mission, and why the team can deliver this work.",
      examples: ["Our nonprofit trains adults for automation careers across the East Bay."],
      validation: {
        minWords: 50,
        maxWords: 200,
      },
    },
    {
      key: "project_summary",
      title: "Project summary",
      prompt: "Describe the problem, the proposed project, and the grant-specific outcome.",
      examples: ["We will expand robotics training and employer pilots for warehouse operators."],
      validation: {
        minWords: 75,
        maxWords: 250,
      },
    },
  ];
}

function toSectionEditorText(sections: Array<SectionDefinitionInput | ApplicationSectionDefinition>): string {
  return JSON.stringify(
    sections.map((section) => ({
      key: section.key,
      title: section.title,
      stepName: section.stepName,
      prompt: section.prompt,
      examples: [...(section.examples ?? [])],
      validation: {
        minWords: section.validation?.minWords ?? null,
        maxWords: section.validation?.maxWords ?? null,
      },
    })),
    null,
    2,
  );
}

function parseSectionEditorText(input: string): SectionDefinitionInput[] {
  const parsed = JSON.parse(input) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error("Section definitions must be a JSON array.");
  }

  return parsed.map((entry, index) => {
    if (!entry || typeof entry !== "object") {
      throw new Error(`Section ${index + 1} must be an object.`);
    }

    const record = entry as Record<string, unknown>;
    if (typeof record.key !== "string" || typeof record.title !== "string") {
      throw new Error(`Section ${index + 1} must include string key and title values.`);
    }

    const validation =
      record.validation && typeof record.validation === "object"
        ? (record.validation as Record<string, unknown>)
        : {};

    return {
      key: record.key,
      title: record.title,
      stepName: typeof record.stepName === "string" ? record.stepName : null,
      prompt: typeof record.prompt === "string" ? record.prompt : null,
      examples: Array.isArray(record.examples) ? record.examples.map((value) => String(value)) : [],
      validation: {
        minWords: typeof validation.minWords === "number" ? validation.minWords : null,
        maxWords: typeof validation.maxWords === "number" ? validation.maxWords : null,
      },
    };
  });
}

function formatArtifactType(value: ProviderArtifactType): string {
  if (value === "grant_catalog_entry") {
    return "Grant catalog entry";
  }
  if (value === "application_workspace") {
    return "Application workspace";
  }
  if (value === "proposal_workspace") {
    return "Proposal workspace";
  }
  return "Workspace section";
}

function normalizeOptionalText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function generateLocalId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

export function ProposalWorkspaceView({
  grants,
  workspaces,
  applicationWorkspaces,
  providerConnections,
  selectedWorkspaceId: selectedWorkspaceIdProp,
  busyAction,
  onCreateWorkspaceFromGrant,
  onCreateProposalJob,
  onUpdateWorkspace,
  onRunWorkspaceAction,
}: {
  grants: ProposalGrantSummary[];
  workspaces: ProposalWorkspaceSummary[];
  applicationWorkspaces: ApplicationWorkspaceSummary[];
  providerConnections: ProviderConnectionSummary[];
  selectedWorkspaceId?: string | null;
  busyAction: string | null;
  onCreateWorkspaceFromGrant: (grantId: string) => void;
  onCreateProposalJob: (workspaceId: string) => void;
  onUpdateWorkspace: (workspaceId: string, input: ProposalWorkspaceUpdateInput) => void;
  onRunWorkspaceAction: (
    workspaceId: string,
    input: {
      action:
        | "evaluate_feasibility"
        | "discover_contacts"
        | "draft_outreach"
        | "plan_next_steps"
        | "refresh_draft";
      providerConnectionId: string;
    },
  ) => void;
}) {
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(
    () => selectedWorkspaceIdProp ?? workspaces[0]?.id ?? null,
  );
  const [stage, setStage] = useState<ProposalWorkspaceSummary["stage"]>("qualifying");
  const [summary, setSummary] = useState("");
  const [nextStepsText, setNextStepsText] = useState("");
  const [openQuestionsText, setOpenQuestionsText] = useState("");
  const [feasibilityVerdict, setFeasibilityVerdict] = useState("go");
  const [feasibilityConfidence, setFeasibilityConfidence] = useState<"high" | "medium" | "low">("medium");
  const [feasibilityBlockersText, setFeasibilityBlockersText] = useState("");
  const [feasibilityAssumptionsText, setFeasibilityAssumptionsText] = useState("");
  const [feasibilityDocumentsText, setFeasibilityDocumentsText] = useState("");
  const [feasibilityNextStep, setFeasibilityNextStep] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactRoleTitle, setContactRoleTitle] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactOrganization, setContactOrganization] = useState("");
  const [contactNotes, setContactNotes] = useState("");
  const [outreachKind, setOutreachKind] = useState<"email" | "call" | "meeting" | "note" | "other">("email");
  const [outreachDirection, setOutreachDirection] = useState<"outbound" | "inbound">("outbound");
  const [outreachSubject, setOutreachSubject] = useState("");
  const [outreachSummary, setOutreachSummary] = useState("");
  const [outreachOccurredAt, setOutreachOccurredAt] = useState(new Date().toISOString());
  const [outcomeStatus, setOutcomeStatus] = useState<"submitted" | "awarded" | "declined" | "no_bid">("submitted");
  const [outcomeSummary, setOutcomeSummary] = useState("");
  const [outcomeRecordedAt, setOutcomeRecordedAt] = useState(new Date().toISOString());

  useEffect(() => {
    if (selectedWorkspaceIdProp && workspaces.some((workspace) => workspace.id === selectedWorkspaceIdProp)) {
      setSelectedWorkspaceId(selectedWorkspaceIdProp);
      return;
    }

    if (!selectedWorkspaceId && workspaces[0]) {
      setSelectedWorkspaceId(workspaces[0].id);
      return;
    }

    if (selectedWorkspaceId && !workspaces.some((workspace) => workspace.id === selectedWorkspaceId)) {
      setSelectedWorkspaceId(workspaces[0]?.id ?? null);
    }
  }, [selectedWorkspaceIdProp, workspaces, selectedWorkspaceId]);

  const selectedWorkspace = workspaces.find((workspace) => workspace.id === selectedWorkspaceId) ?? null;
  const linkedApplicationWorkspace =
    selectedWorkspace?.primaryApplicationWorkspace ??
    applicationWorkspaces.find((workspace) => workspace.id === selectedWorkspace?.primaryApplicationWorkspaceId) ??
    null;
  const proposalActionConnections = providerConnections.filter((connection) =>
    connection.allowedArtifactTypes.includes("proposal_workspace"),
  );
  const [proposalActionProviderConnectionId, setProposalActionProviderConnectionId] = useState<string>("");

  useEffect(() => {
    if (
      proposalActionProviderConnectionId &&
      proposalActionConnections.some((connection) => connection.id === proposalActionProviderConnectionId)
    ) {
      return;
    }

    setProposalActionProviderConnectionId(proposalActionConnections[0]?.id ?? "");
  }, [proposalActionConnections, proposalActionProviderConnectionId]);

  useEffect(() => {
    if (!selectedWorkspace) {
      return;
    }

    setStage(selectedWorkspace.stage);
    setSummary(selectedWorkspace.summary);
    setNextStepsText(selectedWorkspace.nextSteps.join("\n"));
    setOpenQuestionsText(selectedWorkspace.openQuestions.join("\n"));
    setFeasibilityVerdict(selectedWorkspace.feasibilitySnapshot?.verdict ?? "go");
    setFeasibilityConfidence(selectedWorkspace.feasibilitySnapshot?.confidence ?? "medium");
    setFeasibilityBlockersText(selectedWorkspace.feasibilitySnapshot?.blockers.join("\n") ?? "");
    setFeasibilityAssumptionsText(selectedWorkspace.feasibilitySnapshot?.assumptions.join("\n") ?? "");
    setFeasibilityDocumentsText(selectedWorkspace.feasibilitySnapshot?.requiredDocuments.join("\n") ?? "");
    setFeasibilityNextStep(selectedWorkspace.feasibilitySnapshot?.recommendedNextStep ?? "");
    setContactName("");
    setContactRoleTitle("");
    setContactEmail("");
    setContactPhone("");
    setContactOrganization("");
    setContactNotes("");
    setOutreachKind("email");
    setOutreachDirection("outbound");
    setOutreachSubject("");
    setOutreachSummary("");
    setOutreachOccurredAt(new Date().toISOString());
    setOutcomeStatus(selectedWorkspace.outcome?.status ?? "submitted");
    setOutcomeSummary(selectedWorkspace.outcome?.summary ?? "");
    setOutcomeRecordedAt(selectedWorkspace.outcome?.recordedAt ?? new Date().toISOString());
  }, [selectedWorkspace?.id, selectedWorkspace?.updatedAt]);

  function submitPlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedWorkspace) {
      return;
    }

    onUpdateWorkspace(selectedWorkspace.id, {
      stage,
      summary,
      nextSteps: parseTextList(nextStepsText),
      openQuestions: parseTextList(openQuestionsText),
    });
  }

  function submitFeasibility(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedWorkspace) {
      return;
    }

    onUpdateWorkspace(selectedWorkspace.id, {
      feasibilitySnapshot: {
        verdict: feasibilityVerdict,
        confidence: feasibilityConfidence,
        blockers: parseTextList(feasibilityBlockersText),
        assumptions: parseTextList(feasibilityAssumptionsText),
        requiredDocuments: parseTextList(feasibilityDocumentsText),
        recommendedNextStep: feasibilityNextStep,
      },
    });
  }

  function submitContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedWorkspace) {
      return;
    }

    onUpdateWorkspace(selectedWorkspace.id, {
      contacts: [
        ...selectedWorkspace.contacts.map((contact) => ({
          name: contact.name,
          roleTitle: contact.roleTitle,
          email: contact.email,
          phone: contact.phone,
          organization: contact.organization,
          notes: contact.notes,
        })),
        {
          name: contactName,
          roleTitle: normalizeOptionalText(contactRoleTitle),
          email: normalizeOptionalText(contactEmail),
          phone: normalizeOptionalText(contactPhone),
          organization: normalizeOptionalText(contactOrganization),
          notes: normalizeOptionalText(contactNotes),
        },
      ],
    });
  }

  function submitOutreach(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedWorkspace) {
      return;
    }

    onUpdateWorkspace(selectedWorkspace.id, {
      outreachEvents: [
        ...selectedWorkspace.outreachEvents.map((entry) => ({
          kind: entry.kind,
          direction: entry.direction,
          subject: entry.subject,
          summary: entry.summary,
          occurredAt: entry.occurredAt,
        })),
        {
          kind: outreachKind,
          direction: outreachDirection,
          subject: normalizeOptionalText(outreachSubject),
          summary: outreachSummary,
          occurredAt: normalizeOptionalText(outreachOccurredAt) ?? new Date().toISOString(),
        },
      ],
    });
  }

  function submitOutcome(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedWorkspace) {
      return;
    }

    onUpdateWorkspace(selectedWorkspace.id, {
      outcome: {
        status: outcomeStatus,
        summary: outcomeSummary,
        recordedAt: normalizeOptionalText(outcomeRecordedAt) ?? new Date().toISOString(),
      },
    });
  }

  return (
    <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "minmax(0, 0.9fr) minmax(0, 1.1fr)" }}>
      <div style={{ display: "grid", gap: "1rem" }}>
        <SectionCard
          title="Tracked grants"
          description="Open a proposal workspace from any tracked grant in the active queue."
        >
          {grants.length ? (
            <div style={{ display: "grid", gap: "0.75rem" }}>
              {grants.map((grant) => (
                <div key={grant.id} style={subtleCardStyle}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", alignItems: "start" }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{grant.title}</div>
                      <div style={{ marginTop: "0.35rem", color: "#566154", lineHeight: 1.45 }}>
                        {grant.sponsor} · {grant.scenarioName}
                      </div>
                    </div>
                    <StatusBadge label={`${grant.fitScore}/100`} tone={grant.fitScore >= 85 ? "good" : "warn"} />
                  </div>
                  <div style={{ display: "flex", gap: "0.55rem", flexWrap: "wrap", marginTop: "0.75rem" }}>
                    <StatusBadge label={grant.queueState} tone={grant.queueState === "active" ? "good" : "neutral"} />
                    <StatusBadge label={grant.requestStatus} tone="neutral" />
                    {grant.proposalWorkspaceId ? <StatusBadge label="Proposal linked" tone="good" /> : null}
                  </div>
                  <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginTop: "0.75rem" }}>
                    <button
                      type="button"
                      onClick={() =>
                        grant.proposalWorkspaceId
                          ? setSelectedWorkspaceId(grant.proposalWorkspaceId)
                          : onCreateWorkspaceFromGrant(grant.id)
                      }
                      style={buttonStyle(busyAction === `proposal-create-${grant.id}`)}
                      disabled={busyAction === `proposal-create-${grant.id}`}
                    >
                      {grant.proposalWorkspaceId ? "Open proposal workspace" : "Create proposal workspace"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ margin: 0, color: "#566154" }}>No tracked grants are available yet.</p>
          )}
        </SectionCard>

        <SectionCard
          title="Proposal workspaces"
          description="Review qualification, drafting, outreach, and outcome state from one control room."
        >
          {workspaces.length ? (
            <div style={{ display: "grid", gap: "0.75rem" }}>
              {workspaces.map((workspace) => (
                <button
                  key={workspace.id}
                  type="button"
                  onClick={() => setSelectedWorkspaceId(workspace.id)}
                  style={{
                    ...subtleCardStyle,
                    border:
                      selectedWorkspaceId === workspace.id
                        ? "1px solid rgba(36, 84, 58, 0.3)"
                        : "1px solid rgba(216, 204, 184, 0.95)",
                    textAlign: "left",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "start" }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{workspace.opportunity.title}</div>
                      <div style={{ marginTop: "0.35rem", color: "#566154", lineHeight: 1.45 }}>
                        {workspace.opportunity.sponsor} · {workspace.opportunity.fundingType}
                      </div>
                    </div>
                    <StatusBadge label={workspace.stage} tone={workspace.stage === "submitted" ? "good" : "warn"} />
                  </div>
                  <div style={{ display: "flex", gap: "0.55rem", flexWrap: "wrap", marginTop: "0.75rem" }}>
                    {workspace.trackedGrantId ? <StatusBadge label="Tracked grant" tone="neutral" /> : <StatusBadge label="Manual" tone="neutral" />}
                    {workspace.primaryApplicationWorkspaceId ? <StatusBadge label="Linked draft" tone="good" /> : null}
                    {workspace.outcome ? <StatusBadge label={workspace.outcome.status} tone="neutral" /> : null}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <p style={{ margin: 0, color: "#566154" }}>Create a proposal workspace from a grant to start tracking pursuit state.</p>
          )}
        </SectionCard>
      </div>

      <SectionCard
        title={selectedWorkspace ? selectedWorkspace.opportunity.title : "Proposal detail"}
        description="Track the pursuit state, manage the sponsor contact set, and keep the linked draft aligned."
      >
        {selectedWorkspace ? (
          <div style={{ display: "grid", gap: "1rem" }}>
            <div style={{ display: "flex", gap: "0.55rem", flexWrap: "wrap" }}>
              <StatusBadge label={selectedWorkspace.stage} tone={selectedWorkspace.stage === "submitted" ? "good" : "warn"} />
              <StatusBadge label={selectedWorkspace.opportunity.sourceType} tone="neutral" />
              {selectedWorkspace.proposalJob ? <StatusBadge label={selectedWorkspace.proposalJob.title} tone="neutral" /> : null}
              {selectedWorkspace.engagement ? <StatusBadge label={selectedWorkspace.engagement.status} tone="good" /> : null}
            </div>

            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => onCreateProposalJob(selectedWorkspace.id)}
                style={buttonStyle(busyAction === `proposal-job-${selectedWorkspace.id}`)}
                disabled={busyAction === `proposal-job-${selectedWorkspace.id}`}
              >
                Create or attach proposal job
              </button>
            </div>

            <div style={subtleCardStyle}>
              <strong>Automation</strong>
              <div style={{ marginTop: "0.45rem", color: "#566154", lineHeight: 1.55 }}>
                Use a provider connection to evaluate feasibility, discover contacts, draft outreach, or refresh the linked draft.
              </div>
              <label style={{ display: "grid", gap: "0.35rem", marginTop: "0.75rem" }}>
                <span>Provider connection</span>
                <select
                  style={inputStyle}
                  value={proposalActionProviderConnectionId}
                  onChange={(event) => setProposalActionProviderConnectionId(event.target.value)}
                >
                  <option value="">Select a proposal workspace connection</option>
                  {proposalActionConnections.map((connection) => (
                    <option key={connection.id} value={connection.id}>
                      {connection.label} ({connection.provider})
                    </option>
                  ))}
                </select>
              </label>
              <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginTop: "0.75rem" }}>
                {[
                  ["evaluate_feasibility", "Evaluate feasibility"],
                  ["discover_contacts", "Discover contacts"],
                  ["draft_outreach", "Draft outreach"],
                  ["plan_next_steps", "Plan next steps"],
                  ["refresh_draft", "Refresh draft"],
                ].map(([action, label]) => (
                  <button
                    key={action}
                    type="button"
                    onClick={() =>
                      onRunWorkspaceAction(selectedWorkspace.id, {
                        action: action as
                          | "evaluate_feasibility"
                          | "discover_contacts"
                          | "draft_outreach"
                          | "plan_next_steps"
                          | "refresh_draft",
                        providerConnectionId: proposalActionProviderConnectionId,
                      })
                    }
                    style={buttonStyle(busyAction === `proposal-action-${selectedWorkspace.id}-${action}`, "secondary")}
                    disabled={
                      !proposalActionProviderConnectionId ||
                      busyAction === `proposal-action-${selectedWorkspace.id}-${action}`
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div style={subtleCardStyle}>
              <strong>Opportunity</strong>
              <p style={{ margin: "0.45rem 0 0", color: "#566154", lineHeight: 1.55 }}>
                {selectedWorkspace.opportunity.sponsor} · {selectedWorkspace.opportunity.fundingType}
              </p>
              <div style={{ marginTop: "0.55rem", color: "#566154", lineHeight: 1.55 }}>{selectedWorkspace.summary || "No summary yet."}</div>
            </div>

            <div style={subtleCardStyle}>
              <strong>Linked draft</strong>
              {linkedApplicationWorkspace ? (
                <div style={{ marginTop: "0.45rem", color: "#566154", lineHeight: 1.55 }}>
                  <div>{linkedApplicationWorkspace.title}</div>
                  <div>
                    {linkedApplicationWorkspace.documentType} · {linkedApplicationWorkspace.state} · Updated{" "}
                    {formatTimestamp(linkedApplicationWorkspace.updatedAt)}
                  </div>
                </div>
              ) : (
                <p style={{ margin: "0.45rem 0 0", color: "#566154" }}>No primary application workspace has been linked yet.</p>
              )}
            </div>

            <form onSubmit={submitPlan} style={formCardStyle}>
              <h3 style={{ margin: 0 }}>Stage and plan</h3>
              <label>
                <span>Stage</span>
                <select style={inputStyle} value={stage} onChange={(event) => setStage(event.target.value as ProposalWorkspaceSummary["stage"])}>
                  <option value="qualifying">qualifying</option>
                  <option value="drafting">drafting</option>
                  <option value="outreach">outreach</option>
                  <option value="submitted">submitted</option>
                  <option value="awarded">awarded</option>
                  <option value="declined">declined</option>
                  <option value="no_bid">no_bid</option>
                </select>
              </label>
              <label>
                <span>Summary</span>
                <textarea style={textareaStyle} value={summary} onChange={(event) => setSummary(event.target.value)} />
              </label>
              <label>
                <span>Next steps</span>
                <textarea style={textareaStyle} value={nextStepsText} onChange={(event) => setNextStepsText(event.target.value)} />
              </label>
              <label>
                <span>Open questions</span>
                <textarea style={textareaStyle} value={openQuestionsText} onChange={(event) => setOpenQuestionsText(event.target.value)} />
              </label>
              <button style={buttonStyle(busyAction === `proposal-plan-${selectedWorkspace.id}`)} disabled={busyAction === `proposal-plan-${selectedWorkspace.id}`} type="submit">
                Save pursuit plan
              </button>
            </form>

            <form onSubmit={submitFeasibility} style={formCardStyle}>
              <h3 style={{ margin: 0 }}>Feasibility review</h3>
              <label>
                <span>Verdict</span>
                <input style={inputStyle} value={feasibilityVerdict} onChange={(event) => setFeasibilityVerdict(event.target.value)} />
              </label>
              <label>
                <span>Confidence</span>
                <select
                  style={inputStyle}
                  value={feasibilityConfidence}
                  onChange={(event) => setFeasibilityConfidence(event.target.value as "high" | "medium" | "low")}
                >
                  <option value="high">high</option>
                  <option value="medium">medium</option>
                  <option value="low">low</option>
                </select>
              </label>
              <label>
                <span>Blockers</span>
                <textarea
                  style={textareaStyle}
                  value={feasibilityBlockersText}
                  onChange={(event) => setFeasibilityBlockersText(event.target.value)}
                />
              </label>
              <label>
                <span>Assumptions</span>
                <textarea
                  style={textareaStyle}
                  value={feasibilityAssumptionsText}
                  onChange={(event) => setFeasibilityAssumptionsText(event.target.value)}
                />
              </label>
              <label>
                <span>Required documents</span>
                <textarea
                  style={textareaStyle}
                  value={feasibilityDocumentsText}
                  onChange={(event) => setFeasibilityDocumentsText(event.target.value)}
                />
              </label>
              <label>
                <span>Recommended next step</span>
                <textarea
                  style={textareaStyle}
                  value={feasibilityNextStep}
                  onChange={(event) => setFeasibilityNextStep(event.target.value)}
                />
              </label>
              <button
                style={buttonStyle(busyAction === `proposal-feasibility-${selectedWorkspace.id}`)}
                disabled={busyAction === `proposal-feasibility-${selectedWorkspace.id}`}
                type="submit"
              >
                Save feasibility review
              </button>
            </form>

            <div style={{ display: "grid", gap: "0.75rem", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
              <form onSubmit={submitContact} style={formCardStyle}>
                <h3 style={{ margin: 0 }}>Contacts</h3>
                <label>
                  <span>Name</span>
                  <input style={inputStyle} value={contactName} onChange={(event) => setContactName(event.target.value)} />
                </label>
                <label>
                  <span>Role title</span>
                  <input style={inputStyle} value={contactRoleTitle} onChange={(event) => setContactRoleTitle(event.target.value)} />
                </label>
                <label>
                  <span>Email</span>
                  <input style={inputStyle} value={contactEmail} onChange={(event) => setContactEmail(event.target.value)} />
                </label>
                <label>
                  <span>Phone</span>
                  <input style={inputStyle} value={contactPhone} onChange={(event) => setContactPhone(event.target.value)} />
                </label>
                <label>
                  <span>Organization</span>
                  <input style={inputStyle} value={contactOrganization} onChange={(event) => setContactOrganization(event.target.value)} />
                </label>
                <label>
                  <span>Notes</span>
                  <textarea style={textareaStyle} value={contactNotes} onChange={(event) => setContactNotes(event.target.value)} />
                </label>
                <button
                  style={buttonStyle(busyAction === `proposal-contact-${selectedWorkspace.id}`)}
                  disabled={busyAction === `proposal-contact-${selectedWorkspace.id}`}
                  type="submit"
                >
                  Add contact
                </button>
                <div style={{ display: "grid", gap: "0.55rem" }}>
                  {selectedWorkspace.contacts.length ? (
                    selectedWorkspace.contacts.map((contact) => (
                      <div key={contact.id} style={subtleCardStyle}>
                        <div style={{ fontWeight: 700 }}>{contact.name}</div>
                        <div style={{ marginTop: "0.35rem", color: "#566154" }}>
                          {[contact.roleTitle, contact.organization].filter(Boolean).join(" · ") || "Contact"}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p style={{ margin: 0, color: "#566154" }}>No contacts captured yet.</p>
                  )}
                </div>
              </form>

              <form onSubmit={submitOutreach} style={formCardStyle}>
                <h3 style={{ margin: 0 }}>Outreach history</h3>
                <label>
                  <span>Kind</span>
                  <select style={inputStyle} value={outreachKind} onChange={(event) => setOutreachKind(event.target.value as typeof outreachKind)}>
                    <option value="email">email</option>
                    <option value="call">call</option>
                    <option value="meeting">meeting</option>
                    <option value="note">note</option>
                    <option value="other">other</option>
                  </select>
                </label>
                <label>
                  <span>Direction</span>
                  <select
                    style={inputStyle}
                    value={outreachDirection}
                    onChange={(event) => setOutreachDirection(event.target.value as typeof outreachDirection)}
                  >
                    <option value="outbound">outbound</option>
                    <option value="inbound">inbound</option>
                  </select>
                </label>
                <label>
                  <span>Subject</span>
                  <input style={inputStyle} value={outreachSubject} onChange={(event) => setOutreachSubject(event.target.value)} />
                </label>
                <label>
                  <span>Summary</span>
                  <textarea style={textareaStyle} value={outreachSummary} onChange={(event) => setOutreachSummary(event.target.value)} />
                </label>
                <label>
                  <span>Occurred at</span>
                  <input style={inputStyle} value={outreachOccurredAt} onChange={(event) => setOutreachOccurredAt(event.target.value)} />
                </label>
                <button
                  style={buttonStyle(busyAction === `proposal-outreach-${selectedWorkspace.id}`)}
                  disabled={busyAction === `proposal-outreach-${selectedWorkspace.id}`}
                  type="submit"
                >
                  Add outreach event
                </button>
                <div style={{ display: "grid", gap: "0.55rem" }}>
                  {selectedWorkspace.outreachEvents.length ? (
                    selectedWorkspace.outreachEvents.map((event) => (
                      <div key={event.id} style={subtleCardStyle}>
                        <div style={{ fontWeight: 700 }}>{event.subject ?? event.kind}</div>
                        <div style={{ marginTop: "0.35rem", color: "#566154" }}>{event.summary}</div>
                        <div style={{ marginTop: "0.35rem", color: "#566154", fontSize: "0.92rem" }}>
                          {event.direction} · {formatTimestamp(event.occurredAt)}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p style={{ margin: 0, color: "#566154" }}>No outreach activity recorded yet.</p>
                  )}
                </div>
              </form>
            </div>

            <form onSubmit={submitOutcome} style={formCardStyle}>
              <h3 style={{ margin: 0 }}>Outcome</h3>
              <label>
                <span>Status</span>
                <select style={inputStyle} value={outcomeStatus} onChange={(event) => setOutcomeStatus(event.target.value as typeof outcomeStatus)}>
                  <option value="submitted">submitted</option>
                  <option value="awarded">awarded</option>
                  <option value="declined">declined</option>
                  <option value="no_bid">no_bid</option>
                </select>
              </label>
              <label>
                <span>Summary</span>
                <textarea style={textareaStyle} value={outcomeSummary} onChange={(event) => setOutcomeSummary(event.target.value)} />
              </label>
              <label>
                <span>Recorded at</span>
                <input style={inputStyle} value={outcomeRecordedAt} onChange={(event) => setOutcomeRecordedAt(event.target.value)} />
              </label>
              <button
                style={buttonStyle(busyAction === `proposal-outcome-${selectedWorkspace.id}`)}
                disabled={busyAction === `proposal-outcome-${selectedWorkspace.id}`}
                type="submit"
              >
                Save outcome
              </button>
              {selectedWorkspace.outcome ? (
                <div style={subtleCardStyle}>
                  <div style={{ fontWeight: 700 }}>{selectedWorkspace.outcome.status}</div>
                  <div style={{ marginTop: "0.35rem", color: "#566154" }}>{selectedWorkspace.outcome.summary}</div>
                </div>
              ) : null}
            </form>
          </div>
        ) : (
          <p style={{ margin: 0, color: "#566154" }}>Pick or create a proposal workspace to inspect the pursuit state.</p>
        )}
      </SectionCard>
    </div>
  );
}

export function OrganizationWorkspaceView({
  organization,
  busyAction,
  onSaveProfile,
  onAddPersonnel,
  onAcceptInvite,
}: {
  organization: OrganizationSummary | null;
  busyAction: string | null;
  onSaveProfile: (input: OrganizationProfileInput) => void;
  onAddPersonnel: (input: OrganizationPersonnelInput) => void;
  onAcceptInvite: (inviteId: string) => void;
}) {
  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [registrationCountry, setRegistrationCountry] = useState("United States");
  const [registrationRegion, setRegistrationRegion] = useState("");
  const [organizationType, setOrganizationType] = useState("nonprofit");
  const [operatingScope, setOperatingScope] = useState("regional");
  const [localOperatingAreas, setLocalOperatingAreas] = useState("");
  const [missionStatement, setMissionStatement] = useState("");
  const [programs, setPrograms] = useState("");
  const [targetDemographics, setTargetDemographics] = useState("");
  const [thematicAreas, setThematicAreas] = useState("");
  const [annualOperatingBudget, setAnnualOperatingBudget] = useState("");
  const [strategicPriorities, setStrategicPriorities] = useState("");
  const [emailUpdatesEnabled, setEmailUpdatesEnabled] = useState(false);
  const [personFullName, setPersonFullName] = useState("");
  const [personRoleTitle, setPersonRoleTitle] = useState("");
  const [personYearsExperience, setPersonYearsExperience] = useState("");
  const [personEmail, setPersonEmail] = useState("");
  const [personPlatformAccessEnabled, setPersonPlatformAccessEnabled] = useState(true);
  const [personCanManageInvites, setPersonCanManageInvites] = useState(false);

  useEffect(() => {
    if (!organization) {
      return;
    }

    setName(organization.name);
    setWebsite(organization.website ?? "");
    setRegistrationCountry(organization.registrationCountry);
    setRegistrationRegion(organization.registrationRegion ?? "");
    setOrganizationType(organization.organizationType);
    setOperatingScope(organization.operatingScope);
    setLocalOperatingAreas(organization.localOperatingAreas.join("\n"));
    setMissionStatement(organization.missionStatement);
    setPrograms(organization.programs.join("\n"));
    setTargetDemographics(organization.targetDemographics.join("\n"));
    setThematicAreas(organization.thematicAreas.join("\n"));
    setAnnualOperatingBudget(organization.annualOperatingBudget);
    setStrategicPriorities(organization.strategicPriorities.join("\n"));
    setEmailUpdatesEnabled(organization.emailUpdatesEnabled);
  }, [organization?.id]);

  function submitProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSaveProfile({
      name,
      website: normalizeOptionalText(website),
      registrationCountry,
      registrationRegion: normalizeOptionalText(registrationRegion),
      organizationType,
      operatingScope,
      localOperatingAreas: parseTextList(localOperatingAreas),
      missionStatement,
      programs: parseTextList(programs),
      targetDemographics: parseTextList(targetDemographics),
      thematicAreas: parseTextList(thematicAreas),
      annualOperatingBudget,
      strategicPriorities: parseTextList(strategicPriorities),
      emailUpdatesEnabled,
    });
  }

  function submitPersonnel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onAddPersonnel({
      fullName: personFullName,
      roleTitle: personRoleTitle,
      yearsExperience: personYearsExperience.trim() ? Number.parseInt(personYearsExperience, 10) : null,
      email: normalizeOptionalText(personEmail),
      platformAccessEnabled: personPlatformAccessEnabled,
      canManageInvites: personCanManageInvites,
    });
    setPersonFullName("");
    setPersonRoleTitle("");
    setPersonYearsExperience("");
    setPersonEmail("");
    setPersonPlatformAccessEnabled(true);
    setPersonCanManageInvites(false);
  }

  return (
    <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "minmax(0, 1.05fr) minmax(0, 0.95fr)" }}>
      <SectionCard
        title="Organization profile"
        description="Capture the organizational context that will prefill applications, provider scopes, and invitation logic."
      >
        <form onSubmit={submitProfile} style={formCardStyle}>
          <label>
            <span>Name</span>
            <input style={inputStyle} value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label>
            <span>Website</span>
            <input style={inputStyle} value={website} onChange={(event) => setWebsite(event.target.value)} />
          </label>
          <div style={{ display: "grid", gap: "0.75rem", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
            <label>
              <span>Country</span>
              <input
                style={inputStyle}
                value={registrationCountry}
                onChange={(event) => setRegistrationCountry(event.target.value)}
              />
            </label>
            <label>
              <span>Region</span>
              <input
                style={inputStyle}
                value={registrationRegion}
                onChange={(event) => setRegistrationRegion(event.target.value)}
              />
            </label>
            <label>
              <span>Type</span>
              <input
                style={inputStyle}
                value={organizationType}
                onChange={(event) => setOrganizationType(event.target.value)}
              />
            </label>
            <label>
              <span>Scope</span>
              <input
                style={inputStyle}
                value={operatingScope}
                onChange={(event) => setOperatingScope(event.target.value)}
              />
            </label>
          </div>
          <label>
            <span>Mission statement</span>
            <textarea
              style={textareaStyle}
              value={missionStatement}
              onChange={(event) => setMissionStatement(event.target.value)}
            />
          </label>
          <label>
            <span>Local operating areas</span>
            <textarea
              style={textareaStyle}
              value={localOperatingAreas}
              onChange={(event) => setLocalOperatingAreas(event.target.value)}
            />
          </label>
          <label>
            <span>Programs</span>
            <textarea style={textareaStyle} value={programs} onChange={(event) => setPrograms(event.target.value)} />
          </label>
          <label>
            <span>Target demographics</span>
            <textarea
              style={textareaStyle}
              value={targetDemographics}
              onChange={(event) => setTargetDemographics(event.target.value)}
            />
          </label>
          <label>
            <span>Thematic areas</span>
            <textarea
              style={textareaStyle}
              value={thematicAreas}
              onChange={(event) => setThematicAreas(event.target.value)}
            />
          </label>
          <label>
            <span>Strategic priorities</span>
            <textarea
              style={textareaStyle}
              value={strategicPriorities}
              onChange={(event) => setStrategicPriorities(event.target.value)}
            />
          </label>
          <label>
            <span>Annual operating budget</span>
            <input
              style={inputStyle}
              value={annualOperatingBudget}
              onChange={(event) => setAnnualOperatingBudget(event.target.value)}
            />
          </label>
          <label style={{ display: "flex", gap: "0.55rem", alignItems: "center" }}>
            <input
              checked={emailUpdatesEnabled}
              type="checkbox"
              onChange={(event) => setEmailUpdatesEnabled(event.target.checked)}
            />
            <span>Email updates enabled</span>
          </label>
          <button style={buttonStyle(busyAction === "organization-profile")} disabled={busyAction === "organization-profile"} type="submit">
            Save organization profile
          </button>
        </form>
      </SectionCard>

      <div style={{ display: "grid", gap: "1rem" }}>
        <SectionCard
          title="Personnel and invites"
          description="Keep named operators attached to the organization and drive platform access from invite state."
        >
          <form onSubmit={submitPersonnel} style={formCardStyle}>
            <label>
              <span>Full name</span>
              <input
                style={inputStyle}
                value={personFullName}
                onChange={(event) => setPersonFullName(event.target.value)}
              />
            </label>
            <label>
              <span>Role title</span>
              <input
                style={inputStyle}
                value={personRoleTitle}
                onChange={(event) => setPersonRoleTitle(event.target.value)}
              />
            </label>
            <div style={{ display: "grid", gap: "0.75rem", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
              <label>
                <span>Years experience</span>
                <input
                  style={inputStyle}
                  value={personYearsExperience}
                  onChange={(event) => setPersonYearsExperience(event.target.value)}
                />
              </label>
              <label>
                <span>Email</span>
                <input style={inputStyle} value={personEmail} onChange={(event) => setPersonEmail(event.target.value)} />
              </label>
            </div>
            <label style={{ display: "flex", gap: "0.55rem", alignItems: "center" }}>
              <input
                checked={personPlatformAccessEnabled}
                type="checkbox"
                onChange={(event) => setPersonPlatformAccessEnabled(event.target.checked)}
              />
              <span>Platform access enabled</span>
            </label>
            <label style={{ display: "flex", gap: "0.55rem", alignItems: "center" }}>
              <input
                checked={personCanManageInvites}
                type="checkbox"
                onChange={(event) => setPersonCanManageInvites(event.target.checked)}
              />
              <span>Can manage invites</span>
            </label>
            <button style={buttonStyle(busyAction === "organization-personnel", "secondary")} disabled={busyAction === "organization-personnel"} type="submit">
              Add personnel record
            </button>
          </form>

          <div style={{ display: "grid", gap: "0.75rem", marginTop: "1rem" }}>
            {organization?.personnel.length ? (
              organization.personnel.map((person) => (
                <div key={person.id} style={subtleCardStyle}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", alignItems: "start" }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{person.fullName}</div>
                      <div style={{ marginTop: "0.35rem", color: "#566154" }}>
                        {person.roleTitle}
                        {person.email ? ` · ${person.email}` : ""}
                      </div>
                    </div>
                    <StatusBadge label={person.accessState} tone={person.userId ? "good" : "neutral"} />
                  </div>
                  <div style={{ display: "flex", gap: "0.55rem", flexWrap: "wrap", marginTop: "0.75rem" }}>
                    <StatusBadge
                      label={person.platformAccessEnabled ? "Platform access" : "No access"}
                      tone={person.platformAccessEnabled ? "good" : "neutral"}
                    />
                    {person.canManageInvites ? <StatusBadge label="Invite manager" tone="neutral" /> : null}
                    {person.yearsExperience !== null ? (
                      <StatusBadge label={`${person.yearsExperience} years`} tone="neutral" />
                    ) : null}
                  </div>
                  {person.invite ? (
                    <div style={{ marginTop: "0.85rem", display: "grid", gap: "0.5rem" }}>
                      <div style={{ color: "#566154", fontSize: "0.92rem" }}>
                        Invite created {formatTimestamp(person.invite.createdAt)}
                      </div>
                      <code>{person.invite.invitePath}</code>
                      {person.invite.acceptedAt ? (
                        <StatusBadge label={`Accepted ${formatTimestamp(person.invite.acceptedAt)}`} tone="good" />
                      ) : (
                        <button
                          type="button"
                          onClick={() => onAcceptInvite(person.invite!.id)}
                          style={buttonStyle(busyAction === `organization-invite-${person.invite.id}`, "secondary")}
                          disabled={busyAction === `organization-invite-${person.invite.id}`}
                        >
                          Accept invite
                        </button>
                      )}
                    </div>
                  ) : null}
                </div>
              ))
            ) : (
              <p style={{ margin: 0, color: "#566154" }}>
                No personnel records yet. Add the people who need invitation and provider access.
              </p>
            )}
          </div>
        </SectionCard>

        <section style={shellCardStyle}>
          <h2 style={{ margin: 0, fontSize: "1.15rem" }}>Current organization signal</h2>
          {organization ? (
            <div style={{ display: "grid", gap: "0.55rem", marginTop: "0.85rem" }}>
              <StatusBadge label={organization.organizationType} tone="neutral" />
              <StatusBadge label={organization.operatingScope} tone="neutral" />
              <div style={{ color: "#566154", lineHeight: 1.55 }}>{organization.missionStatement}</div>
            </div>
          ) : (
            <p style={{ margin: "0.85rem 0 0", color: "#566154" }}>
              Save the profile once to unlock organization-scoped providers and application prefills.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}

export function CatalogWorkspaceView({
  grants,
  selectedGrantId,
  selectedGrantDetail,
  busyAction,
  onSelectGrant,
  onToggleBookmark,
  onSaveGrant,
  onStartResearch,
  onSaveSchema,
  onCreateProposalWorkspace,
  onCreateProposalJob,
}: {
  grants: CatalogGrantSummary[];
  selectedGrantId: string | null;
  selectedGrantDetail: CatalogGrantDetailPayload | null;
  busyAction: string | null;
  onSelectGrant: (grantId: string) => void;
  onToggleBookmark: (grantId: string, bookmarked: boolean) => void;
  onSaveGrant: (
    grantId: string,
    input: {
      title: string;
      sponsor: string;
      fundingType: string;
      fitScore: number;
      whyFit: string;
      eligibilityNotes: string[];
      amountSummary: string;
      deadlineSummary: string;
      geography: string;
      status: string;
      citations: string[];
      nextActions: string[];
      tags: string[];
      provenanceNotes: string | null;
      freshnessNotes: string | null;
      pursuitNotes: string | null;
      lastValidatedAt: string | null;
    },
  ) => void;
  onStartResearch: (grantId: string, input: { researchFocus: string }) => void;
  onSaveSchema: (
    grantId: string,
    input: {
      name: string;
      documentType: ApplicationDocumentType;
      sections: SectionDefinitionInput[];
    },
  ) => void;
  onCreateProposalWorkspace: (grantId: string) => void;
  onCreateProposalJob: (grantId: string) => void;
}) {
  const selectedGrant = grants.find((grant) => grant.id === selectedGrantId) ?? null;
  const detailGrant = selectedGrantDetail?.grant.id === selectedGrantId ? selectedGrantDetail.grant : selectedGrant;
  const detailSchema = selectedGrantDetail?.grant.id === selectedGrantId ? selectedGrantDetail.schema : null;
  const detailLatestReport = selectedGrantDetail?.grant.id === selectedGrantId ? selectedGrantDetail.latestReport : null;
  const detailResearchRequests =
    selectedGrantDetail?.grant.id === selectedGrantId ? selectedGrantDetail.researchRequests : [];
  const detailProposalWorkspace =
    selectedGrantDetail?.grant.id === selectedGrantId ? selectedGrantDetail.proposalWorkspace : null;
  const detailProposalJob = selectedGrantDetail?.grant.id === selectedGrantId ? selectedGrantDetail.proposalJob : null;
  const detailEngagement = selectedGrantDetail?.grant.id === selectedGrantId ? selectedGrantDetail.engagement : null;
  const [schemaName, setSchemaName] = useState("Grant application draft");
  const [schemaDocumentType, setSchemaDocumentType] = useState<ApplicationDocumentType>("grant_proposal");
  const [schemaSectionsText, setSchemaSectionsText] = useState(toSectionEditorText(createSectionDefinitionsTemplate()));
  const [schemaError, setSchemaError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [sponsor, setSponsor] = useState("");
  const [fundingType, setFundingType] = useState("");
  const [fitScoreText, setFitScoreText] = useState("");
  const [whyFit, setWhyFit] = useState("");
  const [eligibilityNotesText, setEligibilityNotesText] = useState("");
  const [amountSummary, setAmountSummary] = useState("");
  const [deadlineSummary, setDeadlineSummary] = useState("");
  const [geography, setGeography] = useState("");
  const [status, setStatus] = useState("");
  const [citationsText, setCitationsText] = useState("");
  const [nextActionsText, setNextActionsText] = useState("");
  const [tagsText, setTagsText] = useState("");
  const [provenanceNotes, setProvenanceNotes] = useState("");
  const [freshnessNotes, setFreshnessNotes] = useState("");
  const [pursuitNotes, setPursuitNotes] = useState("");
  const [lastValidatedAt, setLastValidatedAt] = useState("");
  const [researchFocus, setResearchFocus] = useState("");

  useEffect(() => {
    if (!detailGrant) {
      return;
    }

    setSchemaName(detailSchema?.name ?? `${detailGrant.title} application`);
    setSchemaDocumentType(detailSchema?.documentType ?? "grant_proposal");
    setSchemaSectionsText(
      detailSchema
        ? toSectionEditorText(detailSchema.sections)
        : toSectionEditorText(createSectionDefinitionsTemplate()),
    );
    setSchemaError(null);
  }, [detailGrant?.id, detailSchema?.updatedAt]);

  useEffect(() => {
    if (!detailGrant) {
      return;
    }

    setTitle(detailGrant.title);
    setSponsor(detailGrant.sponsor);
    setFundingType(detailGrant.fundingType);
    setFitScoreText(String(detailGrant.fitScore));
    setWhyFit(detailGrant.whyFit);
    setEligibilityNotesText(detailGrant.eligibilityNotes.join("\n"));
    setAmountSummary(detailGrant.amountSummary);
    setDeadlineSummary(detailGrant.deadlineSummary);
    setGeography(detailGrant.geography);
    setStatus(detailGrant.status);
    setCitationsText(detailGrant.citations.join("\n"));
    setNextActionsText(detailGrant.nextActions.join("\n"));
    setTagsText(detailGrant.tags.join(", "));
    setProvenanceNotes(detailGrant.provenanceNotes ?? "");
    setFreshnessNotes(detailGrant.freshnessNotes ?? "");
    setPursuitNotes(detailGrant.pursuitNotes ?? "");
    setLastValidatedAt(detailGrant.lastValidatedAt ?? "");
    setResearchFocus(detailResearchRequests[0]?.researchFocus ?? detailGrant.pursuitNotes ?? "");
  }, [detailGrant?.id, detailGrant?.updatedAt, detailResearchRequests[0]?.updatedAt]);

  function submitSchema(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!detailGrant) {
      return;
    }

    try {
      const sections = parseSectionEditorText(schemaSectionsText);
      setSchemaError(null);
      onSaveSchema(detailGrant.id, {
        name: schemaName,
        documentType: schemaDocumentType,
        sections,
      });
    } catch (error) {
      setSchemaError(error instanceof Error ? error.message : "The section definition JSON is invalid.");
    }
  }

  function submitGrantUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!detailGrant) {
      return;
    }

    const fitScore = Number.parseInt(fitScoreText, 10);
    onSaveGrant(detailGrant.id, {
      title,
      sponsor,
      fundingType,
      fitScore: Number.isNaN(fitScore) ? detailGrant.fitScore : fitScore,
      whyFit,
      eligibilityNotes: parseTextList(eligibilityNotesText),
      amountSummary,
      deadlineSummary,
      geography,
      status,
      citations: parseTextList(citationsText),
      nextActions: parseTextList(nextActionsText),
      tags: parseTextList(tagsText),
      provenanceNotes: provenanceNotes.trim() ? provenanceNotes.trim() : null,
      freshnessNotes: freshnessNotes.trim() ? freshnessNotes.trim() : null,
      pursuitNotes: pursuitNotes.trim() ? pursuitNotes.trim() : null,
      lastValidatedAt: lastValidatedAt.trim() ? lastValidatedAt.trim() : null,
    });
  }

  function submitResearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!detailGrant) {
      return;
    }

    onStartResearch(detailGrant.id, {
      researchFocus: researchFocus.trim(),
    });
  }

  return (
    <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "minmax(0, 0.95fr) minmax(0, 1.05fr)" }}>
      <SectionCard
        title="Grant catalog"
        description="Review promoted opportunities, bookmark the best fits, and attach a structured application schema."
      >
        {grants.length ? (
          <div style={{ display: "grid", gap: "0.75rem" }}>
            {grants.map((grant) => (
              <button
                key={grant.id}
                type="button"
                onClick={() => onSelectGrant(grant.id)}
                style={{
                  ...subtleCardStyle,
                  border:
                    selectedGrantId === grant.id
                      ? "1px solid rgba(36, 84, 58, 0.3)"
                      : "1px solid rgba(216, 204, 184, 0.95)",
                  textAlign: "left",
                  cursor: "pointer",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "start" }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{grant.title}</div>
                    <div style={{ marginTop: "0.35rem", color: "#566154", lineHeight: 1.45 }}>{grant.sponsor}</div>
                  </div>
                  <StatusBadge
                    label={`${grant.fitScore}/100`}
                    tone={grant.fitScore >= 85 ? "good" : grant.fitScore >= 70 ? "warn" : "neutral"}
                  />
                </div>
                <div style={{ display: "flex", gap: "0.55rem", flexWrap: "wrap", marginTop: "0.75rem" }}>
                  <StatusBadge label={grant.fundingType} tone="neutral" />
                  <StatusBadge label={grant.isBookmarked ? "Bookmarked" : "Unbookmarked"} tone={grant.isBookmarked ? "good" : "neutral"} />
                  <StatusBadge label={grant.deadlineSummary} tone="neutral" />
                  <StatusBadge label={grant.sourceType} tone="neutral" />
                </div>
              </button>
            ))}
          </div>
        ) : (
          <p style={{ margin: 0, color: "#566154" }}>Promote a tracked grant into the catalog to work on it here.</p>
        )}
      </SectionCard>

      <SectionCard
        title={detailGrant ? detailGrant.title : "Catalog detail"}
        description="Use one place to bookmark the opportunity, curate the schema, steer follow-up research, and spawn proposal work."
      >
        {detailGrant ? (
          <div style={{ display: "grid", gap: "1rem" }}>
            <div style={{ display: "flex", gap: "0.55rem", flexWrap: "wrap" }}>
              <StatusBadge label={detailGrant.fundingType} tone="neutral" />
              <StatusBadge label={detailGrant.amountSummary} tone="neutral" />
              <StatusBadge label={detailGrant.status} tone="neutral" />
              <StatusBadge label={detailGrant.sourceType} tone="neutral" />
              {detailGrant.lastValidatedAt ? (
                <StatusBadge label={`Validated ${formatTimestamp(detailGrant.lastValidatedAt)}`} tone="good" />
              ) : null}
            </div>
            <div style={subtleCardStyle}>
              <strong>Why it fits</strong>
              <p style={{ margin: "0.45rem 0 0", color: "#566154", lineHeight: 1.55 }}>{detailGrant.whyFit}</p>
            </div>
            <div style={{ display: "grid", gap: "0.75rem", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
              <div style={subtleCardStyle}>
                <strong>Eligibility notes</strong>
                <ul style={{ marginTop: "0.55rem" }}>
                  {detailGrant.eligibilityNotes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              </div>
              <div style={subtleCardStyle}>
                <strong>Next actions</strong>
                <ul style={{ marginTop: "0.55rem" }}>
                  {detailGrant.nextActions.map((action) => (
                    <li key={action}>{action}</li>
                  ))}
                </ul>
              </div>
            </div>
            <form onSubmit={submitGrantUpdate} style={formCardStyle}>
              <h3 style={{ margin: 0 }}>Enrichment</h3>
              <label>
                <span>Title</span>
                <input style={inputStyle} value={title} onChange={(event) => setTitle(event.target.value)} />
              </label>
              <label>
                <span>Sponsor</span>
                <input style={inputStyle} value={sponsor} onChange={(event) => setSponsor(event.target.value)} />
              </label>
              <div style={{ display: "grid", gap: "0.75rem", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
                <label>
                  <span>Funding type</span>
                  <input style={inputStyle} value={fundingType} onChange={(event) => setFundingType(event.target.value)} />
                </label>
                <label>
                  <span>Fit score</span>
                  <input
                    style={inputStyle}
                    type="number"
                    min={0}
                    max={100}
                    value={fitScoreText}
                    onChange={(event) => setFitScoreText(event.target.value)}
                  />
                </label>
              </div>
              <label>
                <span>Why it fits</span>
                <textarea style={textareaStyle} value={whyFit} onChange={(event) => setWhyFit(event.target.value)} />
              </label>
              <label>
                <span>Eligibility notes</span>
                <textarea
                  style={textareaStyle}
                  value={eligibilityNotesText}
                  onChange={(event) => setEligibilityNotesText(event.target.value)}
                />
              </label>
              <div style={{ display: "grid", gap: "0.75rem", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
                <label>
                  <span>Amount summary</span>
                  <input style={inputStyle} value={amountSummary} onChange={(event) => setAmountSummary(event.target.value)} />
                </label>
                <label>
                  <span>Deadline summary</span>
                  <input
                    style={inputStyle}
                    value={deadlineSummary}
                    onChange={(event) => setDeadlineSummary(event.target.value)}
                  />
                </label>
              </div>
              <div style={{ display: "grid", gap: "0.75rem", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
                <label>
                  <span>Geography</span>
                  <input style={inputStyle} value={geography} onChange={(event) => setGeography(event.target.value)} />
                </label>
                <label>
                  <span>Status</span>
                  <input style={inputStyle} value={status} onChange={(event) => setStatus(event.target.value)} />
                </label>
              </div>
              <label>
                <span>Citations</span>
                <textarea style={textareaStyle} value={citationsText} onChange={(event) => setCitationsText(event.target.value)} />
              </label>
              <label>
                <span>Next actions</span>
                <textarea
                  style={textareaStyle}
                  value={nextActionsText}
                  onChange={(event) => setNextActionsText(event.target.value)}
                />
              </label>
              <label>
                <span>Tags</span>
                <input style={inputStyle} value={tagsText} onChange={(event) => setTagsText(event.target.value)} />
              </label>
              <label>
                <span>Provenance notes</span>
                <textarea
                  style={textareaStyle}
                  value={provenanceNotes}
                  onChange={(event) => setProvenanceNotes(event.target.value)}
                />
              </label>
              <label>
                <span>Freshness notes</span>
                <textarea
                  style={textareaStyle}
                  value={freshnessNotes}
                  onChange={(event) => setFreshnessNotes(event.target.value)}
                />
              </label>
              <label>
                <span>Pursuit notes</span>
                <textarea
                  style={textareaStyle}
                  value={pursuitNotes}
                  onChange={(event) => setPursuitNotes(event.target.value)}
                />
              </label>
              <label>
                <span>Last validation timestamp</span>
                <input style={inputStyle} value={lastValidatedAt} onChange={(event) => setLastValidatedAt(event.target.value)} />
              </label>
              <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => onToggleBookmark(detailGrant.id, !detailGrant.isBookmarked)}
                  style={buttonStyle(busyAction === `catalog-bookmark-${detailGrant.id}`, "secondary")}
                  disabled={busyAction === `catalog-bookmark-${detailGrant.id}`}
                >
                  {detailGrant.isBookmarked ? "Remove bookmark" : "Bookmark grant"}
                </button>
                <button
                  type="submit"
                  style={buttonStyle(busyAction === `catalog-update-${detailGrant.id}`)}
                  disabled={busyAction === `catalog-update-${detailGrant.id}`}
                >
                  Save enrichment
                </button>
              </div>
            </form>

            <form onSubmit={submitResearch} style={formCardStyle}>
              <h3 style={{ margin: 0 }}>Follow-up research</h3>
              <label>
                <span>Research focus</span>
                <textarea
                  style={textareaStyle}
                  value={researchFocus}
                  onChange={(event) => setResearchFocus(event.target.value)}
                  placeholder="Ask for a narrower fit check, deadline verification, or sponsor research."
                />
              </label>
              <button
                type="submit"
                style={buttonStyle(busyAction === `catalog-research-${detailGrant.id}`)}
                disabled={busyAction === `catalog-research-${detailGrant.id}` || !researchFocus.trim()}
              >
                Start follow-up research
              </button>
            </form>

            <div style={{ display: "grid", gap: "0.75rem", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
              <div style={subtleCardStyle}>
                <strong>Latest report</strong>
                {detailLatestReport ? (
                  <div style={{ marginTop: "0.5rem", color: "#566154", lineHeight: 1.55 }}>
                    <div>{detailLatestReport.executiveSummary}</div>
                    {detailLatestReport.searchSummary ? (
                      <div style={{ marginTop: "0.45rem" }}>{detailLatestReport.searchSummary}</div>
                    ) : null}
                    <div style={{ marginTop: "0.45rem" }}>
                      {detailLatestReport.opportunityCount} opportunities · {detailLatestReport.rejectedLeads.length} rejected leads
                    </div>
                    <div style={{ marginTop: "0.45rem" }}>Updated {formatTimestamp(detailLatestReport.updatedAt)}</div>
                  </div>
                ) : (
                  <p style={{ margin: "0.45rem 0 0", color: "#566154" }}>No report has been attached yet.</p>
                )}
              </div>

              <div style={subtleCardStyle}>
                <strong>Linked proposal workspace</strong>
                {detailProposalWorkspace ? (
                  <div style={{ marginTop: "0.5rem", color: "#566154", lineHeight: 1.55 }}>
                    <div>{detailProposalWorkspace.opportunity.title}</div>
                    <div>
                      {detailProposalWorkspace.stage} · {detailProposalWorkspace.opportunity.sourceType}
                    </div>
                    <div style={{ marginTop: "0.45rem" }}>{detailProposalWorkspace.summary || "No summary yet."}</div>
                    <button
                      type="button"
                      onClick={() => onCreateProposalWorkspace(detailGrant.id)}
                      style={{ ...buttonStyle(busyAction === `catalog-proposal-workspace-${detailGrant.id}`), marginTop: "0.75rem" }}
                      disabled={busyAction === `catalog-proposal-workspace-${detailGrant.id}`}
                    >
                      Open proposal workspace
                    </button>
                  </div>
                ) : (
                  <div style={{ marginTop: "0.5rem" }}>
                    <p style={{ margin: "0 0 0.75rem", color: "#566154" }}>No proposal workspace is linked yet.</p>
                    <button
                      type="button"
                      onClick={() => onCreateProposalWorkspace(detailGrant.id)}
                      style={buttonStyle(busyAction === `catalog-proposal-workspace-${detailGrant.id}`)}
                      disabled={busyAction === `catalog-proposal-workspace-${detailGrant.id}`}
                    >
                      Create proposal workspace
                    </button>
                  </div>
                )}
              </div>

              <div style={subtleCardStyle}>
                <strong>Linked proposal job</strong>
                {detailProposalJob ? (
                  <div style={{ marginTop: "0.5rem", color: "#566154", lineHeight: 1.55 }}>
                    <div>{detailProposalJob.title}</div>
                    <div>
                      {detailProposalJob.status} · {detailProposalJob.offerCount} offers
                    </div>
                    <button
                      type="button"
                      onClick={() => onCreateProposalJob(detailGrant.id)}
                      style={{ ...buttonStyle(busyAction === `catalog-proposal-job-${detailGrant.id}`), marginTop: "0.75rem" }}
                      disabled={busyAction === `catalog-proposal-job-${detailGrant.id}`}
                    >
                      Open proposal job
                    </button>
                  </div>
                ) : (
                  <div style={{ marginTop: "0.5rem" }}>
                    <p style={{ margin: "0 0 0.75rem", color: "#566154" }}>No proposal job is linked yet.</p>
                    <button
                      type="button"
                      onClick={() => onCreateProposalJob(detailGrant.id)}
                      style={buttonStyle(busyAction === `catalog-proposal-job-${detailGrant.id}`)}
                      disabled={busyAction === `catalog-proposal-job-${detailGrant.id}`}
                    >
                      Create proposal job
                    </button>
                  </div>
                )}
              </div>

              <div style={subtleCardStyle}>
                <strong>Linked engagement</strong>
                {detailEngagement ? (
                  <div style={{ marginTop: "0.5rem", color: "#566154", lineHeight: 1.55 }}>
                    <div>{detailEngagement.specialistName}</div>
                    <div>
                      {detailEngagement.status} · ${detailEngagement.amountUsd}
                    </div>
                    <div>Catalog grant {detailEngagement.catalogGrantId ?? "not set"}</div>
                  </div>
                ) : (
                  <p style={{ margin: "0.45rem 0 0", color: "#566154" }}>No engagement is linked yet.</p>
                )}
              </div>
            </div>

            <div style={subtleCardStyle}>
              <strong>Research history</strong>
              {detailResearchRequests.length ? (
                <div style={{ display: "grid", gap: "0.75rem", marginTop: "0.55rem" }}>
                  {detailResearchRequests.map((request) => (
                    <div key={request.id} style={{ ...subtleCardStyle, background: "rgba(255,255,255,0.72)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap" }}>
                        <strong>{request.status}</strong>
                        <span style={{ color: "#566154" }}>{formatTimestamp(request.updatedAt)}</span>
                      </div>
                      <div style={{ marginTop: "0.35rem", color: "#566154", lineHeight: 1.5 }}>
                        {request.progressSummary ?? "No progress summary yet."}
                      </div>
                      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.5rem" }}>
                        <StatusBadge label={request.runPhase} tone="neutral" />
                        <StatusBadge label={`${request.grantCount} grants`} tone="neutral" />
                        <StatusBadge label={`${request.activeGrantCount} active`} tone="good" />
                        {request.researchFocus ? <StatusBadge label={request.researchFocus} tone="neutral" /> : null}
                      </div>
                      {request.latestReport ? (
                        <div style={{ marginTop: "0.55rem", color: "#566154", lineHeight: 1.5 }}>
                          <div>{request.latestReport.executiveSummary ?? "No executive summary yet."}</div>
                          {request.latestReport.searchSummary ? (
                            <div style={{ marginTop: "0.35rem" }}>{request.latestReport.searchSummary}</div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ margin: "0.45rem 0 0", color: "#566154" }}>No follow-up research has been recorded yet.</p>
              )}
            </div>

            <form onSubmit={submitSchema} style={formCardStyle}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "center" }}>
                <h3 style={{ margin: 0 }}>Application schema</h3>
                {detailSchema ? (
                  <StatusBadge label={`Updated ${formatTimestamp(detailSchema.updatedAt)}`} tone="neutral" />
                ) : (
                  <StatusBadge label="No saved schema yet" tone="warn" />
                )}
              </div>
              <label>
                <span>Schema name</span>
                <input style={inputStyle} value={schemaName} onChange={(event) => setSchemaName(event.target.value)} />
              </label>
              <label>
                <span>Document type</span>
                <select
                  style={inputStyle}
                  value={schemaDocumentType}
                  onChange={(event) => setSchemaDocumentType(event.target.value as ApplicationDocumentType)}
                >
                  <option value="grant_proposal">grant proposal</option>
                  <option value="loi">letter of intent</option>
                  <option value="budget_narrative">budget narrative</option>
                  <option value="other">other</option>
                </select>
              </label>
              <label>
                <span>Sections JSON</span>
                <textarea
                  style={{ ...textareaStyle, minHeight: "18rem", fontFamily: "ui-monospace, SFMono-Regular, monospace" }}
                  value={schemaSectionsText}
                  onChange={(event) => setSchemaSectionsText(event.target.value)}
                />
              </label>
              {schemaError ? <StatusBadge label={schemaError} tone="bad" /> : null}
              <button
                style={buttonStyle(busyAction === `catalog-schema-${detailGrant.id}`)}
                disabled={busyAction === `catalog-schema-${detailGrant.id}`}
                type="submit"
              >
                Save schema
              </button>
            </form>
          </div>
        ) : (
          <p style={{ margin: 0, color: "#566154" }}>Choose a catalog entry to inspect the opportunity and schema.</p>
        )}
      </SectionCard>
    </div>
  );
}

export function ApplicationWorkspaceView({
  templates,
  workspaces,
  catalogGrants,
  providerConnections,
  busyAction,
  onCreateTemplate,
  onCreateWorkspace,
  onUpdateSection,
  onGenerateSection,
  onFinalizeWorkspace,
}: {
  templates: ApplicationTemplateSummary[];
  workspaces: ApplicationWorkspaceSummary[];
  catalogGrants: CatalogGrantSummary[];
  providerConnections: ProviderConnectionSummary[];
  busyAction: string | null;
  onCreateTemplate: (input: {
    name: string;
    documentType: ApplicationDocumentType;
    sections: SectionDefinitionInput[];
  }) => void;
  onCreateWorkspace: (input: {
    catalogGrantId?: string | null;
    templateId: string | null;
    documentType: ApplicationDocumentType;
  }) => void;
  onUpdateSection: (workspaceId: string, sectionId: string, content: string) => void;
  onGenerateSection: (workspaceId: string, sectionId: string, providerConnectionId: string | null) => void;
  onFinalizeWorkspace: (workspaceId: string) => void;
}) {
  const [templateName, setTemplateName] = useState("Proposal starter");
  const [templateDocumentType, setTemplateDocumentType] = useState<ApplicationDocumentType>("grant_proposal");
  const [templateSectionsText, setTemplateSectionsText] = useState(
    toSectionEditorText(createSectionDefinitionsTemplate()),
  );
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [workspaceTemplateId, setWorkspaceTemplateId] = useState<string>("");
  const [workspaceCatalogGrantId, setWorkspaceCatalogGrantId] = useState<string>("");
  const [workspaceDocumentType, setWorkspaceDocumentType] = useState<ApplicationDocumentType>("grant_proposal");
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);
  const [sectionDrafts, setSectionDrafts] = useState<Record<string, string>>({});
  const [selectedProviderConnectionId, setSelectedProviderConnectionId] = useState<string>("");

  useEffect(() => {
    if (!workspaceTemplateId && templates[0]) {
      setWorkspaceTemplateId(templates[0].id);
      setWorkspaceDocumentType(templates[0].documentType);
    }
    if (workspaceTemplateId && !templates.some((template) => template.id === workspaceTemplateId)) {
      setWorkspaceTemplateId(templates[0]?.id ?? "");
      setWorkspaceDocumentType(templates[0]?.documentType ?? "grant_proposal");
    }
  }, [templates, workspaceTemplateId]);

  useEffect(() => {
    if (!selectedWorkspaceId && workspaces[0]) {
      setSelectedWorkspaceId(workspaces[0].id);
      return;
    }

    if (selectedWorkspaceId && !workspaces.some((workspace) => workspace.id === selectedWorkspaceId)) {
      setSelectedWorkspaceId(workspaces[0]?.id ?? null);
    }
  }, [workspaces, selectedWorkspaceId]);

  useEffect(() => {
    if (!workspaceCatalogGrantId) {
      return;
    }

    if (!catalogGrants.some((grant) => grant.id === workspaceCatalogGrantId)) {
      setWorkspaceCatalogGrantId("");
    }
  }, [catalogGrants, workspaceCatalogGrantId]);

  const selectedWorkspace = workspaces.find((workspace) => workspace.id === selectedWorkspaceId) ?? null;

  useEffect(() => {
    if (!selectedWorkspace) {
      setSectionDrafts({});
      return;
    }

    setSectionDrafts(
      Object.fromEntries(selectedWorkspace.sections.map((section) => [section.id, section.content])),
    );
  }, [selectedWorkspace?.id, selectedWorkspace?.updatedAt]);

  function submitTemplate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const sections = parseSectionEditorText(templateSectionsText);
      setTemplateError(null);
      onCreateTemplate({
        name: templateName,
        documentType: templateDocumentType,
        sections,
      });
    } catch (error) {
      setTemplateError(error instanceof Error ? error.message : "The template sections JSON is invalid.");
    }
  }

  function submitWorkspace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onCreateWorkspace({
      catalogGrantId: workspaceCatalogGrantId || null,
      templateId: workspaceTemplateId || null,
      documentType: workspaceDocumentType,
    });
  }

  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
        <SectionCard
          title="Reusable templates"
          description="Capture your default structure once, then seed proposal workspaces from it."
        >
          <form onSubmit={submitTemplate} style={formCardStyle}>
            <label>
              <span>Template name</span>
              <input style={inputStyle} value={templateName} onChange={(event) => setTemplateName(event.target.value)} />
            </label>
            <label>
              <span>Document type</span>
              <select
                style={inputStyle}
                value={templateDocumentType}
                onChange={(event) => setTemplateDocumentType(event.target.value as ApplicationDocumentType)}
              >
                <option value="grant_proposal">grant proposal</option>
                <option value="loi">letter of intent</option>
                <option value="budget_narrative">budget narrative</option>
                <option value="other">other</option>
              </select>
            </label>
            <label>
              <span>Sections JSON</span>
              <textarea
                style={{ ...textareaStyle, minHeight: "16rem", fontFamily: "ui-monospace, SFMono-Regular, monospace" }}
                value={templateSectionsText}
                onChange={(event) => setTemplateSectionsText(event.target.value)}
              />
            </label>
            {templateError ? <StatusBadge label={templateError} tone="bad" /> : null}
            <button style={buttonStyle(busyAction === "application-template")} disabled={busyAction === "application-template"} type="submit">
              Save template
            </button>
          </form>
        </SectionCard>

        <SectionCard
          title="New workspace"
          description="Launch a working draft from a saved template or start from an empty document type."
        >
          <form onSubmit={submitWorkspace} style={formCardStyle}>
            <label>
              <span>Catalog-backed source</span>
              <select
                style={inputStyle}
                value={workspaceCatalogGrantId}
                onChange={(event) => setWorkspaceCatalogGrantId(event.target.value)}
              >
                <option value="">No catalog grant</option>
                {catalogGrants.map((grant) => (
                  <option key={grant.id} value={grant.id}>
                    {grant.title} ({grant.sponsor})
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Template</span>
              <select
                style={inputStyle}
                value={workspaceTemplateId}
                onChange={(event) => {
                  setWorkspaceTemplateId(event.target.value);
                  const nextTemplate = templates.find((template) => template.id === event.target.value);
                  if (nextTemplate) {
                    setWorkspaceDocumentType(nextTemplate.documentType);
                  }
                }}
              >
                <option value="">No template</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Document type</span>
              <select
                style={inputStyle}
                value={workspaceDocumentType}
                onChange={(event) => setWorkspaceDocumentType(event.target.value as ApplicationDocumentType)}
              >
                <option value="grant_proposal">grant proposal</option>
                <option value="loi">letter of intent</option>
                <option value="budget_narrative">budget narrative</option>
                <option value="other">other</option>
              </select>
            </label>
            <button style={buttonStyle(busyAction === "application-workspace")} disabled={busyAction === "application-workspace"} type="submit">
              Create workspace
            </button>
          </form>

          <div style={{ display: "grid", gap: "0.75rem", marginTop: "1rem" }}>
            {templates.length ? (
              templates.map((template) => (
                <div key={template.id} style={subtleCardStyle}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", alignItems: "start" }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{template.name}</div>
                      <div style={{ marginTop: "0.35rem", color: "#566154" }}>
                        {template.sections.length} sections · {template.documentType}
                      </div>
                    </div>
                    <StatusBadge label={formatTimestamp(template.updatedAt)} tone="neutral" />
                  </div>
                </div>
              ))
            ) : (
              <p style={{ margin: 0, color: "#566154" }}>
                No templates yet. Save one on the left if you want a reusable starting point.
              </p>
            )}
          </div>
        </SectionCard>
      </div>

      <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "minmax(0, 0.9fr) minmax(0, 1.1fr)" }}>
        <SectionCard
          title="Application workspaces"
          description="Select a workspace to edit the live draft, generate sections, and finalize the proposal."
        >
          {workspaces.length ? (
            <div style={{ display: "grid", gap: "0.75rem" }}>
              {workspaces.map((workspace) => (
                <button
                  key={workspace.id}
                  type="button"
                  onClick={() => setSelectedWorkspaceId(workspace.id)}
                  style={{
                    ...subtleCardStyle,
                    border:
                      selectedWorkspaceId === workspace.id
                        ? "1px solid rgba(36, 84, 58, 0.3)"
                        : "1px solid rgba(216, 204, 184, 0.95)",
                    textAlign: "left",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", alignItems: "start" }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{workspace.title}</div>
                      <div style={{ marginTop: "0.35rem", color: "#566154" }}>
                        {workspace.documentType} · {workspace.sections.length} sections
                      </div>
                    </div>
                    <StatusBadge label={workspace.state} tone={workspace.state === "proposal" ? "good" : "warn"} />
                  </div>
                  <div style={{ display: "flex", gap: "0.55rem", flexWrap: "wrap", marginTop: "0.75rem" }}>
                    {workspace.catalogGrantId ? <StatusBadge label="Catalog-backed" tone="neutral" /> : null}
                    {workspace.templateId ? <StatusBadge label="Template-backed" tone="neutral" /> : null}
                    <StatusBadge label={`Updated ${formatTimestamp(workspace.updatedAt)}`} tone="neutral" />
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <p style={{ margin: 0, color: "#566154" }}>
              No application workspaces yet. Create one from a catalog grant or a reusable template.
            </p>
          )}
        </SectionCard>

        <SectionCard
          title={selectedWorkspace ? selectedWorkspace.title : "Workspace detail"}
          description="Edit sections directly, use a provider-backed generation step where needed, and finalize when the draft is ready."
        >
          {selectedWorkspace ? (
            <div style={{ display: "grid", gap: "1rem" }}>
              <div style={{ display: "flex", gap: "0.55rem", flexWrap: "wrap" }}>
                <StatusBadge label={selectedWorkspace.documentType} tone="neutral" />
                <StatusBadge label={selectedWorkspace.state} tone={selectedWorkspace.state === "proposal" ? "good" : "warn"} />
                {selectedWorkspace.finalizedAt ? (
                  <StatusBadge label={`Finalized ${formatTimestamp(selectedWorkspace.finalizedAt)}`} tone="good" />
                ) : null}
              </div>

              {selectedWorkspace.organizationPrefill ? (
                <div style={subtleCardStyle}>
                  <strong>Organization prefill</strong>
                  <p style={{ margin: "0.45rem 0 0", color: "#566154", lineHeight: 1.55 }}>
                    {selectedWorkspace.organizationPrefill.name} · {selectedWorkspace.organizationPrefill.organizationType}
                  </p>
                  <div style={{ marginTop: "0.5rem", color: "#566154" }}>
                    {selectedWorkspace.organizationPrefill.missionStatement}
                  </div>
                </div>
              ) : null}

              <label>
                <span>Provider for section generation</span>
                <select
                  style={inputStyle}
                  value={selectedProviderConnectionId}
                  onChange={(event) => setSelectedProviderConnectionId(event.target.value)}
                >
                  <option value="">No provider connection</option>
                  {providerConnections
                    .filter((connection) => connection.allowedArtifactTypes.includes("workspace_section"))
                    .map((connection) => (
                      <option key={connection.id} value={connection.id}>
                        {connection.label} ({connection.provider})
                      </option>
                    ))}
                </select>
              </label>

              <div style={{ display: "grid", gap: "0.85rem" }}>
                {selectedWorkspace.sections.map((section) => (
                  <div key={section.id} style={subtleCardStyle}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", alignItems: "start" }}>
                      <div>
                        <div style={{ fontWeight: 700 }}>{section.title}</div>
                        <div style={{ marginTop: "0.35rem", color: "#566154" }}>
                          {section.stepName ?? section.key}
                        </div>
                      </div>
                      <StatusBadge label={`Updated ${formatTimestamp(section.updatedAt)}`} tone="neutral" />
                    </div>
                    {section.prompt ? (
                      <p style={{ margin: "0.65rem 0 0", color: "#566154", lineHeight: 1.5 }}>{section.prompt}</p>
                    ) : null}
                    <textarea
                      style={{ ...textareaStyle, marginTop: "0.75rem", minHeight: "12rem" }}
                      value={sectionDrafts[section.id] ?? section.content}
                      onChange={(event) =>
                        setSectionDrafts((current) => ({
                          ...current,
                          [section.id]: event.target.value,
                        }))
                      }
                    />
                    <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginTop: "0.75rem" }}>
                      <button
                        type="button"
                        onClick={() => onUpdateSection(selectedWorkspace.id, section.id, sectionDrafts[section.id] ?? section.content)}
                        style={buttonStyle(busyAction === `application-section-${section.id}`, "secondary")}
                        disabled={busyAction === `application-section-${section.id}`}
                      >
                        Save section
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          onGenerateSection(
                            selectedWorkspace.id,
                            section.id,
                            selectedProviderConnectionId || null,
                          )
                        }
                        style={buttonStyle(busyAction === `application-generate-${section.id}`)}
                        disabled={busyAction === `application-generate-${section.id}`}
                      >
                        Generate draft
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() => onFinalizeWorkspace(selectedWorkspace.id)}
                style={buttonStyle(
                  busyAction === `application-finalize-${selectedWorkspace.id}` || selectedWorkspace.state === "proposal",
                )}
                disabled={busyAction === `application-finalize-${selectedWorkspace.id}` || selectedWorkspace.state === "proposal"}
              >
                {selectedWorkspace.state === "proposal" ? "Proposal finalized" : "Finalize proposal"}
              </button>
            </div>
          ) : (
            <p style={{ margin: 0, color: "#566154" }}>
              Choose a workspace to edit the live proposal draft and section content.
            </p>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

export function ProviderWorkspaceView({
  organization,
  connections,
  executions,
  busyAction,
  onCreateConnection,
}: {
  organization: OrganizationSummary | null;
  connections: ProviderConnectionSummary[];
  executions: AgentExecutionSummary[];
  busyAction: string | null;
  onCreateConnection: (input: {
    scope: ProviderConnectionScope;
    provider: string;
    label: string;
    authType: ProviderAuthType;
    allowedArtifactTypes: ProviderArtifactType[];
  }) => void;
}) {
  const [scope, setScope] = useState<ProviderConnectionScope>("user");
  const [provider, setProvider] = useState("openai");
  const [label, setLabel] = useState("Primary OpenAI connection");
  const [authType, setAuthType] = useState<ProviderAuthType>("byok");
  const [allowedArtifactTypes, setAllowedArtifactTypes] = useState<ProviderArtifactType[]>(["workspace_section"]);

  useEffect(() => {
    if (!organization && scope === "organization") {
      setScope("user");
    }
  }, [organization?.id, scope]);

  function toggleArtifactType(value: ProviderArtifactType, checked: boolean) {
    setAllowedArtifactTypes((current) =>
      checked ? [...new Set([...current, value])] : current.filter((entry) => entry !== value),
    );
  }

  function submitConnection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onCreateConnection({
      scope,
      provider,
      label,
      authType,
      allowedArtifactTypes,
    });
  }

  return (
    <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "minmax(0, 0.9fr) minmax(0, 1.1fr)" }}>
      <SectionCard
        title="Provider connections"
        description="Register the providers that can write drafts or operate on catalog and application artifacts."
      >
        <form onSubmit={submitConnection} style={formCardStyle}>
          <label>
            <span>Scope</span>
            <select style={inputStyle} value={scope} onChange={(event) => setScope(event.target.value as ProviderConnectionScope)}>
              <option value="user">user</option>
              <option disabled={!organization} value="organization">
                organization
              </option>
            </select>
          </label>
          <label>
            <span>Provider</span>
            <input style={inputStyle} value={provider} onChange={(event) => setProvider(event.target.value)} />
          </label>
          <label>
            <span>Label</span>
            <input style={inputStyle} value={label} onChange={(event) => setLabel(event.target.value)} />
          </label>
          <label>
            <span>Auth type</span>
            <select style={inputStyle} value={authType} onChange={(event) => setAuthType(event.target.value as ProviderAuthType)}>
              <option value="byok">byok</option>
              <option value="oauth">oauth</option>
            </select>
          </label>
          <div style={{ display: "grid", gap: "0.5rem" }}>
            <strong>Allowed artifact types</strong>
            {(["grant_catalog_entry", "application_workspace", "workspace_section", "proposal_workspace"] as ProviderArtifactType[]).map((artifactType) => (
              <label key={artifactType} style={{ display: "flex", gap: "0.55rem", alignItems: "center" }}>
                <input
                  checked={allowedArtifactTypes.includes(artifactType)}
                  type="checkbox"
                  onChange={(event) => toggleArtifactType(artifactType, event.target.checked)}
                />
                <span>{formatArtifactType(artifactType)}</span>
              </label>
            ))}
          </div>
          <button style={buttonStyle(busyAction === "provider-connection")} disabled={busyAction === "provider-connection"} type="submit">
            Save provider connection
          </button>
        </form>

        <div style={{ display: "grid", gap: "0.75rem", marginTop: "1rem" }}>
          {connections.length ? (
            connections.map((connection) => (
              <div key={connection.id} style={subtleCardStyle}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", alignItems: "start" }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{connection.label}</div>
                    <div style={{ marginTop: "0.35rem", color: "#566154" }}>
                      {connection.provider} · {connection.scope} · {connection.authType}
                    </div>
                  </div>
                  <StatusBadge label={formatTimestamp(connection.updatedAt)} tone="neutral" />
                </div>
                <div style={{ display: "flex", gap: "0.55rem", flexWrap: "wrap", marginTop: "0.75rem" }}>
                  {connection.allowedArtifactTypes.map((artifactType) => (
                    <StatusBadge key={artifactType} label={formatArtifactType(artifactType)} tone="neutral" />
                  ))}
                </div>
              </div>
            ))
          ) : (
            <p style={{ margin: 0, color: "#566154" }}>
              No provider connections yet. Save one so section generation can be associated with a provider record.
            </p>
          )}
        </div>
      </SectionCard>

      <SectionCard
        title="Execution history"
        description="Every provider-backed generation call is recorded here so you can audit what wrote which artifact."
      >
        {executions.length ? (
          <div style={{ display: "grid", gap: "0.75rem" }}>
            {executions.map((execution) => (
              <div key={execution.id} style={subtleCardStyle}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", alignItems: "start" }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{execution.action}</div>
                    <div style={{ marginTop: "0.35rem", color: "#566154" }}>
                      {formatArtifactType(execution.targetType)} · {execution.targetId}
                    </div>
                  </div>
                  <StatusBadge label={formatTimestamp(execution.createdAt)} tone="neutral" />
                </div>
                <pre
                  style={{
                    marginTop: "0.75rem",
                    padding: "0.85rem",
                    borderRadius: "14px",
                    background: "rgba(255,255,255,0.75)",
                    overflowX: "auto",
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {execution.outputText}
                </pre>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ margin: 0, color: "#566154" }}>
            No provider-backed execution records yet. Generate a workspace section with a provider connection to populate this view.
          </p>
        )}
      </SectionCard>
    </div>
  );
}
