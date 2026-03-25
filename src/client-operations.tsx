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
export type ProviderArtifactType = "grant_catalog_entry" | "application_workspace" | "workspace_section";

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
  sourceType: string;
  sourceGrantId: string | null;
  sourceReportId: string | null;
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
  isBookmarked: boolean;
  createdAt: string;
  updatedAt: string;
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
  return "Workspace section";
}

function normalizeOptionalText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
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
  onSaveSchema,
  onCreateWorkspaceFromGrant,
}: {
  grants: CatalogGrantSummary[];
  selectedGrantId: string | null;
  selectedGrantDetail: CatalogGrantDetailPayload | null;
  busyAction: string | null;
  onSelectGrant: (grantId: string) => void;
  onToggleBookmark: (grantId: string, bookmarked: boolean) => void;
  onSaveSchema: (
    grantId: string,
    input: {
      name: string;
      documentType: ApplicationDocumentType;
      sections: SectionDefinitionInput[];
    },
  ) => void;
  onCreateWorkspaceFromGrant: (grantId: string, documentType: ApplicationDocumentType) => void;
}) {
  const selectedGrant = grants.find((grant) => grant.id === selectedGrantId) ?? null;
  const detailGrant = selectedGrantDetail?.grant.id === selectedGrantId ? selectedGrantDetail.grant : selectedGrant;
  const detailSchema = selectedGrantDetail?.grant.id === selectedGrantId ? selectedGrantDetail.schema : null;
  const [schemaName, setSchemaName] = useState("Grant application draft");
  const [schemaDocumentType, setSchemaDocumentType] = useState<ApplicationDocumentType>("grant_proposal");
  const [schemaSectionsText, setSchemaSectionsText] = useState(toSectionEditorText(createSectionDefinitionsTemplate()));
  const [schemaError, setSchemaError] = useState<string | null>(null);

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
        description="Use one place to bookmark the opportunity, curate the schema, and spawn a proposal workspace."
      >
        {detailGrant ? (
          <div style={{ display: "grid", gap: "1rem" }}>
            <div style={{ display: "flex", gap: "0.55rem", flexWrap: "wrap" }}>
              <StatusBadge label={detailGrant.fundingType} tone="neutral" />
              <StatusBadge label={detailGrant.amountSummary} tone="neutral" />
              <StatusBadge label={detailGrant.status} tone="neutral" />
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
                type="button"
                onClick={() => onCreateWorkspaceFromGrant(detailGrant.id, schemaDocumentType)}
                style={buttonStyle(busyAction === `catalog-workspace-${detailGrant.id}`)}
                disabled={busyAction === `catalog-workspace-${detailGrant.id}`}
              >
                Create proposal workspace
              </button>
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
  providerConnections: ProviderConnectionSummary[];
  busyAction: string | null;
  onCreateTemplate: (input: {
    name: string;
    documentType: ApplicationDocumentType;
    sections: SectionDefinitionInput[];
  }) => void;
  onCreateWorkspace: (input: {
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
            {(["grant_catalog_entry", "application_workspace", "workspace_section"] as ProviderArtifactType[]).map((artifactType) => (
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
