// ABOUTME: Implements the shared auth, marketplace, research, and funding workflows for the web platform.
// ABOUTME: REST, JSON-RPC, and browser routes all call these services so behavior stays consistent.

import { listScenarioIds, loadScenario } from "./scenarios.js";
import {
  createFundingResearchAgent,
  runFundingResearch,
  type FundingResearchResult,
  type FundingResearchRunOptions,
  type FundingResearchSession,
  type FundingResearchSessionEvent,
} from "./agent.js";
import { InvalidAccessTokenError, type BrowserAuthProvider } from "./auth.js";
import type {
  AgentProviderAuthType,
  AgentProviderConnectionScope,
  ApplicationDocumentType,
  ApplicationWorkspaceState,
  PlatformAgentToken,
  PlatformAgentExecutionRecord,
  PlatformAgentProviderConnection,
  PlatformApplicationTemplate,
  PlatformApplicationWorkspace,
  PlatformApplicationWorkspaceSection,
  PlatformEngagement,
  PlatformGrantApplicationSchema,
  PlatformGrantCatalogEntry,
  PlatformGrantReport,
  PlatformJob,
  PlatformOffer,
  PlatformOrganization,
  PlatformOrganizationPersonnel,
  PlatformOrganizationPrefill,
  PlatformResearchActivity,
  PlatformResearchRequest,
  PlatformResearchScenario,
  PlatformResearchSteeringNote,
  PlatformSessionIdentity,
  PlatformState,
  PlatformTrackedGrant,
  PlatformUser,
  ResearchRunPhase,
  ServiceTargetType,
  SpecialistServiceRole,
  UserRole,
  X402Settings,
  FundingChallenge,
  GrantQueueState,
} from "./platform-types.js";
import { ApplicationStore } from "./store.js";
import type { FundingOpportunity } from "./report.js";
import type { BusinessScenario } from "./types.js";
import type { AgentMessage } from "@mariozechner/pi-agent-core";

interface UpsertBrowserProfileInput {
  name: string;
  role: UserRole;
  walletAddress?: string | null;
  smartWalletAddress?: string | null;
}

interface CreateAgentTokenInput {
  label?: string;
}

interface UpsertOrganizationInput {
  name: string;
  website?: string | null;
  registrationCountry: string;
  registrationRegion?: string | null;
  organizationType: PlatformOrganization["organizationType"];
  operatingScope: PlatformOrganization["operatingScope"];
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
    accessState?: PlatformOrganizationPersonnel["accessState"];
    canManageInvites?: boolean;
    invite?: {
      id: string;
      invitePath: string;
      createdAt: string;
      acceptedAt?: string | null;
    } | null;
  }>;
}

interface CreateOrganizationPersonnelInput {
  fullName: string;
  roleTitle: string;
  yearsExperience?: number | null;
  email?: string | null;
  platformAccessEnabled: boolean;
  canManageInvites: boolean;
}

interface CreateJobInput {
  title: string;
  description: string;
  fundingNeed: string;
  targetType?: ServiceTargetType | null;
  targetId?: string | null;
  specialistRole?: SpecialistServiceRole | null;
}

interface CreateResearchScenarioInput {
  name: string;
  summary: string;
  geography: string;
  businessModel: string;
  customers: string[];
  needs: string[];
  tags: string[];
}

interface CreateResearchRequestInput {
  scenarioId: string;
}

interface RunResearchRequestInput {
  awaitCompletion?: boolean;
}

interface CreateResearchSteeringInput {
  prompt: string;
}

interface CreateOfferInput {
  message: string;
  amountUsd: string;
  payoutAddress: string;
  specialistRole?: SpecialistServiceRole | null;
}

interface UpsertGrantApplicationSchemaInput {
  name: string;
  documentType: ApplicationDocumentType;
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
}

interface CreateApplicationTemplateInput extends UpsertGrantApplicationSchemaInput {}

interface CreateApplicationWorkspaceInput {
  catalogGrantId?: string | null;
  templateId?: string | null;
  documentType: ApplicationDocumentType;
}

interface GenerateWorkspaceSectionInput {
  providerConnectionId?: string | null;
}

interface CreateProviderConnectionInput {
  scope: AgentProviderConnectionScope;
  provider: string;
  label: string;
  authType: AgentProviderAuthType;
  allowedArtifactTypes: ServiceTargetType[];
}

interface DashboardJob extends PlatformJob {
  requesterName: string;
  offerCount: number;
}

interface DashboardOffer extends PlatformOffer {
  specialistName: string;
  jobTitle: string;
}

interface DashboardEngagement extends PlatformEngagement {
  requesterName: string;
  specialistName: string;
  jobTitle: string;
}

export interface DashboardData {
  users: Array<ReturnType<ApplicationServices["toPublicUser"]>>;
  jobs: DashboardJob[];
  offers: DashboardOffer[];
  engagements: DashboardEngagement[];
}

interface ResearchScenarioSummary {
  id: string;
  name: string;
  summary: string;
  sourceType: "fixture" | "custom";
}

interface WorkspaceRequest extends PlatformResearchRequest {
  scenarioName: string;
  grantCount: number;
  activeGrantCount: number;
}

interface WorkspaceGrant extends PlatformTrackedGrant {
  requestStatus: PlatformResearchRequest["status"];
  scenarioName: string;
}

export interface WorkspaceData {
  user: ReturnType<ApplicationServices["toPublicUser"]>;
  organization: ReturnType<ApplicationServices["toPublicOrganization"]> | null;
  marketplace: DashboardData;
  scenarios: ResearchScenarioSummary[];
  requests: WorkspaceRequest[];
  grants: WorkspaceGrant[];
  reports: Array<ReturnType<ApplicationServices["toPublicGrantReport"]>>;
  catalog: Array<ReturnType<ApplicationServices["toPublicGrantCatalogEntry"]>>;
  applicationTemplates: Array<ReturnType<ApplicationServices["toPublicApplicationTemplate"]>>;
  applicationWorkspaces: Array<ReturnType<ApplicationServices["toPublicApplicationWorkspace"]>>;
  providerConnections: Array<ReturnType<ApplicationServices["toPublicProviderConnection"]>>;
  executions: Array<ReturnType<ApplicationServices["toPublicAgentExecutionRecord"]>>;
}

export type FundingResearchRunner = (
  options: FundingResearchRunOptions,
) => Promise<FundingResearchResult>;
export type FundingResearchSessionFactory = (
  options: FundingResearchRunOptions,
) => FundingResearchSession;

interface ResearchRequestRunResult {
  request: PlatformResearchRequest;
  grants: PlatformTrackedGrant[];
}

export interface ResearchRequestDetail extends WorkspaceRequest {
  grants: WorkspaceGrant[];
}

interface ActiveResearchRun {
  session: FundingResearchSession | null;
  queuedSteeringIds: string[];
  updateChain: Promise<PlatformResearchRequest>;
  completion: Promise<ResearchRequestRunResult>;
  acceptsSteering: boolean;
}

export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

function now(): string {
  return new Date().toISOString();
}

function makeId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`;
}

function requireText(value: string | undefined | null, field: string): string {
  const trimmed = value?.trim();
  if (!trimmed) {
    throw new AppError(400, "invalid_input", `${field} is required.`);
  }

  return trimmed;
}

function normalizeUsd(value: string): string {
  const amount = Number.parseFloat(value);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new AppError(400, "invalid_amount", "amountUsd must be a positive dollar amount.");
  }

  return amount.toFixed(2);
}

function normalizeTextList(value: unknown, field: string): string[] {
  if (!Array.isArray(value)) {
    throw new AppError(400, "invalid_input", `${field} must be a list of strings.`);
  }

  return value.map((entry) => requireText(typeof entry === "string" ? entry : "", field));
}

function byCreatedAt<T extends { createdAt: string }>(left: T, right: T): number {
  return right.createdAt.localeCompare(left.createdAt);
}

export class ApplicationServices {
  private readonly activeResearchRuns = new Map<string, ActiveResearchRun>();

  constructor(
    private readonly store: ApplicationStore,
    private readonly authProvider?: BrowserAuthProvider,
    private readonly researchRunner: FundingResearchRunner = runFundingResearch,
    private readonly researchSessionFactory: FundingResearchSessionFactory | null = createFundingResearchAgent,
  ) {}

  toPublicUser(user: PlatformUser) {
    return {
      id: user.id,
      privyUserId: user.privyUserId,
      name: user.name,
      role: user.role,
      walletAddress: user.walletAddress,
      smartWalletAddress: user.smartWalletAddress,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  toPublicOrganization(organization: PlatformOrganization) {
    return {
      id: organization.id,
      ownerUserId: organization.ownerUserId,
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
      emailUpdatesEnabled: organization.emailUpdatesEnabled,
      personnel: organization.personnel.map((person) => ({
        id: person.id,
        fullName: person.fullName,
        roleTitle: person.roleTitle,
        yearsExperience: person.yearsExperience,
        email: person.email,
        userId: person.userId,
        platformAccessEnabled: person.platformAccessEnabled,
        accessState: person.accessState,
        canManageInvites: person.canManageInvites,
        invite: person.invite
          ? {
              id: person.invite.id,
              invitePath: person.invite.invitePath,
              createdAt: person.invite.createdAt,
              acceptedAt: person.invite.acceptedAt,
            }
          : null,
      })),
      createdAt: organization.createdAt,
      updatedAt: organization.updatedAt,
    };
  }

  toPublicGrantReport(report: PlatformGrantReport) {
    return {
      id: report.id,
      requestId: report.requestId,
      requesterId: report.requesterId,
      businessCaseId: report.businessCaseId,
      executiveSummary: report.executiveSummary,
      searchSummary: report.searchSummary,
      opportunityCount: report.opportunities.length,
      opportunities: report.opportunities.map((opportunity) => ({
        ...opportunity,
        eligibilityNotes: [...opportunity.eligibilityNotes],
        citations: [...opportunity.citations],
        nextActions: [...opportunity.nextActions],
      })),
      rejectedLeads: report.rejectedLeads.map((lead) => ({
        ...lead,
        citations: [...lead.citations],
      })),
      nextActions: [...report.nextActions],
      createdAt: report.createdAt,
      updatedAt: report.updatedAt,
    };
  }

  toPublicGrantCatalogEntry(grant: PlatformGrantCatalogEntry, isBookmarked: boolean) {
    return {
      id: grant.id,
      createdByUserId: grant.createdByUserId,
      sourceType: grant.sourceType,
      sourceGrantId: grant.sourceGrantId,
      sourceReportId: grant.sourceReportId,
      title: grant.title,
      sponsor: grant.sponsor,
      fundingType: grant.fundingType,
      fitScore: grant.fitScore,
      whyFit: grant.whyFit,
      eligibilityNotes: [...grant.eligibilityNotes],
      amountSummary: grant.amountSummary,
      deadlineSummary: grant.deadlineSummary,
      geography: grant.geography,
      status: grant.status,
      citations: [...grant.citations],
      nextActions: [...grant.nextActions],
      tags: [...grant.tags],
      isBookmarked,
      createdAt: grant.createdAt,
      updatedAt: grant.updatedAt,
    };
  }

  toPublicGrantApplicationSchema(schema: PlatformGrantApplicationSchema) {
    return {
      id: schema.id,
      catalogGrantId: schema.catalogGrantId,
      name: schema.name,
      documentType: schema.documentType,
      sections: schema.sections.map((section) => ({
        id: section.id,
        key: section.key,
        title: section.title,
        stepName: section.stepName,
        prompt: section.prompt,
        examples: [...section.examples],
        validation: { ...section.validation },
      })),
      createdAt: schema.createdAt,
      updatedAt: schema.updatedAt,
    };
  }

  toPublicApplicationTemplate(template: PlatformApplicationTemplate) {
    return {
      id: template.id,
      ownerUserId: template.ownerUserId,
      name: template.name,
      documentType: template.documentType,
      sections: template.sections.map((section) => ({
        id: section.id,
        key: section.key,
        title: section.title,
        stepName: section.stepName,
        prompt: section.prompt,
        examples: [...section.examples],
        validation: { ...section.validation },
      })),
      createdAt: template.createdAt,
      updatedAt: template.updatedAt,
    };
  }

  toPublicApplicationWorkspace(workspace: PlatformApplicationWorkspace) {
    return {
      id: workspace.id,
      requesterId: workspace.requesterId,
      catalogGrantId: workspace.catalogGrantId,
      templateId: workspace.templateId,
      organizationPrefill: workspace.organizationPrefill
        ? {
            ...workspace.organizationPrefill,
            localOperatingAreas: [...workspace.organizationPrefill.localOperatingAreas],
            programs: [...workspace.organizationPrefill.programs],
            targetDemographics: [...workspace.organizationPrefill.targetDemographics],
            thematicAreas: [...workspace.organizationPrefill.thematicAreas],
            strategicPriorities: [...workspace.organizationPrefill.strategicPriorities],
          }
        : null,
      documentType: workspace.documentType,
      title: workspace.title,
      state: workspace.state,
      sections: workspace.sections
        .map((section) => ({
          id: section.id,
          key: section.key,
          title: section.title,
          stepName: section.stepName,
          prompt: section.prompt,
          examples: [...section.examples],
          validation: { ...section.validation },
          orderIndex: section.orderIndex,
          content: section.content,
          createdAt: section.createdAt,
          updatedAt: section.updatedAt,
        }))
        .sort((left, right) => left.orderIndex - right.orderIndex),
      createdAt: workspace.createdAt,
      updatedAt: workspace.updatedAt,
      finalizedAt: workspace.finalizedAt,
    };
  }

  toPublicProviderConnection(connection: PlatformAgentProviderConnection) {
    return {
      id: connection.id,
      scope: connection.scope,
      ownerUserId: connection.ownerUserId,
      organizationId: connection.organizationId,
      provider: connection.provider,
      label: connection.label,
      authType: connection.authType,
      allowedArtifactTypes: [...connection.allowedArtifactTypes],
      createdAt: connection.createdAt,
      updatedAt: connection.updatedAt,
    };
  }

  toPublicAgentExecutionRecord(record: PlatformAgentExecutionRecord) {
    return {
      id: record.id,
      actorUserId: record.actorUserId,
      providerConnectionId: record.providerConnectionId,
      targetType: record.targetType,
      targetId: record.targetId,
      action: record.action,
      outputText: record.outputText,
      createdAt: record.createdAt,
    };
  }

  toPublicAgentToken(token: PlatformAgentToken) {
    return {
      id: token.id,
      label: token.label,
      createdAt: token.createdAt,
      lastUsedAt: token.lastUsedAt,
      revokedAt: token.revokedAt,
    };
  }

  async getBrowserSession(accessToken: string | null | undefined) {
    const identity = await this.verifyBrowserIdentity(accessToken);
    const user = await this.store.findUserByPrivyUserId(identity.privyUserId);

    return {
      authenticated: true,
      identity,
      user: user ? this.toPublicUser(user) : null,
    };
  }

  async upsertBrowserProfile(accessToken: string | null | undefined, input: UpsertBrowserProfileInput) {
    const identity = await this.verifyBrowserIdentity(accessToken);
    const user = await this.store.upsertUserProfile({
      privyUserId: identity.privyUserId,
      name: requireText(input.name, "name"),
      role: this.requireRoleValue(input.role),
      walletAddress: input.walletAddress?.trim() || null,
      smartWalletAddress: input.smartWalletAddress?.trim() || null,
    });

    return {
      identity,
      user: this.toPublicUser(user),
    };
  }

  async authenticate(token: string | null | undefined): Promise<PlatformUser> {
    if (!token) {
      throw new AppError(401, "missing_auth", "Authorization: Bearer <token> is required.");
    }

    const agentUser = await this.store.getUserByAgentToken(token);
    if (agentUser) {
      return agentUser;
    }

    const identity = await this.verifyBrowserIdentity(token);
    const browserUser = await this.store.findUserByPrivyUserId(identity.privyUserId);
    if (!browserUser) {
      throw new AppError(
        403,
        "profile_required",
        "Complete your Grantfinder profile before using protected routes.",
      );
    }

    return browserUser;
  }

  async createAgentToken(user: PlatformUser, input: CreateAgentTokenInput) {
    const result = await this.store.createAgentToken(user.id, requireText(input.label ?? "agent", "label"));
    return {
      token: this.toPublicAgentToken(result.token),
      secret: result.secret,
    };
  }

  async listAgentTokens(user: PlatformUser) {
    const tokens = await this.store.listAgentTokens(user.id);
    return {
      tokens: tokens.map((token) => this.toPublicAgentToken(token)),
    };
  }

  async revokeAgentToken(user: PlatformUser, tokenId: string) {
    await this.store.revokeAgentToken(user.id, requireText(tokenId, "tokenId"));
    return { ok: true };
  }

  async getOrganization(user: PlatformUser) {
    const organization = await this.findOrganizationForUser(user);
    return {
      organization: organization ? this.toPublicOrganization(organization) : null,
    };
  }

  async upsertOrganization(user: PlatformUser, input: UpsertOrganizationInput) {
    this.requireRole(user, "requester");

    const thematicAreas = normalizeTextList(input.thematicAreas, "thematicAreas");
    if (thematicAreas.length > 3) {
      throw new AppError(400, "invalid_input", "thematicAreas can contain at most 3 values.");
    }

    const existingOrganization = await this.findOrganizationForUser(user);
    const preservedPersonnel = existingOrganization?.personnel ?? [];
    const normalizedPersonnel = this.normalizeOrganizationPersonnel(input.personnel);
    const canManagePersonnel = existingOrganization
      ? this.canManageOrganizationInvites(existingOrganization, user.id)
      : true;
    if (!canManagePersonnel && !this.samePersonnelRecords(normalizedPersonnel, preservedPersonnel)) {
      throw new AppError(
        403,
        "forbidden",
        "You do not have permission to change organization personnel or invite settings.",
      );
    }

    const organization = await this.store.upsertOrganization({
      ownerUserId: existingOrganization?.ownerUserId ?? user.id,
      name: requireText(input.name, "name"),
      website: this.normalizeOptionalText(input.website),
      registrationCountry: requireText(input.registrationCountry, "registrationCountry"),
      registrationRegion: this.normalizeOptionalText(input.registrationRegion),
      organizationType: this.requireOrganizationTypeValue(input.organizationType),
      operatingScope: this.requireOrganizationOperatingScopeValue(input.operatingScope),
      localOperatingAreas: normalizeTextList(input.localOperatingAreas, "localOperatingAreas"),
      missionStatement: requireText(input.missionStatement, "missionStatement"),
      programs: normalizeTextList(input.programs, "programs"),
      targetDemographics: normalizeTextList(input.targetDemographics, "targetDemographics"),
      thematicAreas,
      annualOperatingBudget: requireText(input.annualOperatingBudget, "annualOperatingBudget"),
      strategicPriorities: normalizeTextList(input.strategicPriorities, "strategicPriorities"),
      emailUpdatesEnabled: Boolean(input.emailUpdatesEnabled),
      personnel: canManagePersonnel ? normalizedPersonnel : preservedPersonnel,
    });

    return {
      organization: this.toPublicOrganization(organization),
    };
  }

  async createOrganizationPersonnel(user: PlatformUser, input: CreateOrganizationPersonnelInput) {
    this.requireRole(user, "requester");

    const organization = await this.requireOrganizationInviteManager(user);
    const timestamp = now();
    const inviteId = makeId("invite");
    const personnel: PlatformOrganizationPersonnel = {
      id: makeId("person"),
      fullName: requireText(input.fullName, "fullName"),
      roleTitle: requireText(input.roleTitle, "roleTitle"),
      yearsExperience: this.normalizePersonnelYearsExperience(input.yearsExperience),
      email: this.normalizeOptionalText(input.email),
      userId: null,
      platformAccessEnabled: Boolean(input.platformAccessEnabled),
      accessState: input.platformAccessEnabled ? "invited" : "none",
      canManageInvites: Boolean(input.canManageInvites) && Boolean(input.platformAccessEnabled),
      invite: input.platformAccessEnabled
        ? {
            id: inviteId,
            invitePath: `/api/organization/invites/${inviteId}`,
            createdAt: timestamp,
            acceptedAt: null,
          }
        : null,
    };

    const savedOrganization = await this.saveOrganization({
      ...organization,
      personnel: [...organization.personnel, personnel],
      updatedAt: timestamp,
    });
    const savedPersonnel = savedOrganization.personnel.find((candidate) => candidate.id === personnel.id);
    if (!savedPersonnel) {
      throw new AppError(500, "personnel_missing", "The saved organization contact could not be loaded.");
    }

    return {
      organization: this.toPublicOrganization(savedOrganization),
      personnel: this.toPublicOrganization(savedOrganization).personnel.find(
        (candidate) => candidate.id === personnel.id,
      ),
    };
  }

  async acceptOrganizationInvite(user: PlatformUser, inviteId: string) {
    this.requireRole(user, "requester");

    const organization = await this.findOrganizationByInviteId(requireText(inviteId, "inviteId"));
    if (!organization) {
      throw new AppError(404, "invite_not_found", "The requested organization invite does not exist.");
    }

    const timestamp = now();
    let acceptedPersonnelId: string | null = null;
    const updatedPersonnel = organization.personnel.map((person) => {
      if (person.invite?.id !== inviteId) {
        return person;
      }

      if (person.accessState === "active" || person.invite?.acceptedAt) {
        throw new AppError(409, "invite_already_accepted", "This organization invite has already been accepted.");
      }

      acceptedPersonnelId = person.id;
      return {
        ...person,
        userId: user.id,
        accessState: "active" as const,
        invite: person.invite
          ? {
              ...person.invite,
              acceptedAt: timestamp,
            }
          : null,
      };
    });

    if (!acceptedPersonnelId) {
      throw new AppError(404, "invite_not_found", "The requested organization invite does not exist.");
    }

    const savedOrganization = await this.saveOrganization({
      ...organization,
      personnel: updatedPersonnel,
      updatedAt: timestamp,
    });
    const savedPersonnel = savedOrganization.personnel.find((person) => person.id === acceptedPersonnelId);
    if (!savedPersonnel) {
      throw new AppError(500, "invite_accept_failed", "The accepted collaborator record could not be loaded.");
    }

    return {
      organization: this.toPublicOrganization(savedOrganization),
      personnel: this.toPublicOrganization(savedOrganization).personnel.find(
        (person) => person.id === acceptedPersonnelId,
      ),
    };
  }

  async listScenarioIds(): Promise<string[]> {
    return listScenarioIds();
  }

  async listResearchScenarios(user: PlatformUser): Promise<{ scenarios: ResearchScenarioSummary[] }> {
    const builtInIds = await listScenarioIds();
    const builtInScenarios = await Promise.all(
      builtInIds.map(async (scenarioId) => {
        const scenario = await loadScenario(scenarioId);
        return {
          id: scenario.id,
          name: scenario.name,
          summary: scenario.summary,
          sourceType: "fixture" as const,
        };
      }),
    );
    const state = await this.store.readState();
    const customScenarios = state.researchScenarios
      .filter((scenario) => scenario.ownerUserId === user.id)
      .map((scenario) => ({
        id: scenario.id,
        name: scenario.name,
        summary: scenario.summary,
        sourceType: "custom" as const,
      }));

    return {
      scenarios: [...builtInScenarios, ...customScenarios].sort((left, right) =>
        left.name.localeCompare(right.name),
      ),
    };
  }

  async createResearchScenario(user: PlatformUser, input: CreateResearchScenarioInput) {
    this.requireRole(user, "requester");

    const timestamp = now();
    const scenario: PlatformResearchScenario = {
      id: makeId("scenario"),
      ownerUserId: user.id,
      sourceType: "custom",
      name: requireText(input.name, "name"),
      summary: requireText(input.summary, "summary"),
      geography: requireText(input.geography, "geography"),
      businessModel: requireText(input.businessModel, "businessModel"),
      customers: normalizeTextList(input.customers, "customers"),
      needs: normalizeTextList(input.needs, "needs"),
      tags: normalizeTextList(input.tags, "tags"),
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    return {
      scenario: await this.store.createResearchScenario(scenario),
    };
  }

  async createResearchRequest(user: PlatformUser, input: CreateResearchRequestInput) {
    this.requireRole(user, "requester");

    const scenario = await this.loadScenarioForUser(user, requireText(input.scenarioId, "scenarioId"));
    const organizationPrefill = this.buildOrganizationPrefill(await this.findOrganizationForUser(user));
    const timestamp = now();
    const request: PlatformResearchRequest = {
      id: makeId("request"),
      requesterId: user.id,
      scenarioId: scenario.id,
      organizationPrefill,
      status: "draft",
      runPhase: "idle",
      progressSummary: null,
      runStartedAt: null,
      latestBrief: null,
      latestReport: null,
      errorMessage: null,
      activity: [],
      steeringNotes: [],
      createdAt: timestamp,
      updatedAt: timestamp,
      lastRunAt: null,
    };

    return {
      request: await this.store.createResearchRequest(request),
    };
  }

  async runResearch(_user: PlatformUser, scenarioId: string) {
    const scenario = await this.loadScenarioForUser(_user, requireText(scenarioId, "scenarioId"));
    const scenarioWithPrefill = this.attachOrganizationPrefillToScenario(
      scenario,
      this.buildOrganizationPrefill(await this.findOrganizationForUser(_user)),
    );
    const result = await this.executeResearch(scenarioWithPrefill);

    return {
      scenario: scenarioWithPrefill,
      brief: result.brief,
      report: result.report,
    };
  }

  async runResearchRequest(
    user: PlatformUser,
    requestId: string,
    input: RunResearchRequestInput = {},
  ): Promise<ResearchRequestRunResult> {
    this.requireRole(user, "requester");

    const request = await this.requireResearchRequestOwner(user, requestId);
    const awaitCompletion = input.awaitCompletion ?? true;
    const existingRun = this.activeResearchRuns.get(request.id);
    if (existingRun) {
      if (awaitCompletion) {
        return existingRun.completion;
      }

      return {
        request: await this.requireResearchRequestOwner(user, request.id),
        grants: await this.listTrackedGrantsForRequest(request.id),
      };
    }

    const startedAt = now();
    const runningRequest = await this.store.saveResearchRequest({
      ...request,
      status: "running",
      runPhase: "briefing",
      progressSummary: "Preparing the research brief and execution plan.",
      runStartedAt: startedAt,
      errorMessage: null,
      activity: [
        this.createResearchActivity(
          "status",
          "Research run started",
          "Preparing the research brief and execution plan.",
          "warn",
          startedAt,
        ),
      ],
      steeringNotes: [],
      updatedAt: startedAt,
    });
    const scenario = this.attachOrganizationPrefillToScenario(
      await this.loadScenarioForUser(user, runningRequest.scenarioId),
      runningRequest.organizationPrefill,
    );
    this.activeResearchRuns.set(request.id, {
      session: null,
      queuedSteeringIds: [],
      updateChain: Promise.resolve(runningRequest),
      completion: Promise.resolve({ request: runningRequest, grants: [] }),
      acceptsSteering: Boolean(this.researchSessionFactory),
    });
    const activeRun = this.researchSessionFactory
      ? this.startInteractiveResearchRun(runningRequest, scenario)
      : this.startBlockingResearchRun(runningRequest, scenario);

    this.activeResearchRuns.set(request.id, activeRun);

    if (!awaitCompletion) {
      return {
        request: runningRequest,
        grants: await this.listTrackedGrantsForRequest(request.id),
      };
    }

    return activeRun.completion;
  }

  async getResearchRequest(user: PlatformUser, requestId: string): Promise<{ request: ResearchRequestDetail }> {
    this.requireRole(user, "requester");
    const request = await this.requireResearchRequestOwner(user, requestId);
    const detail = await this.buildResearchRequestDetail(user, request);
    return { request: detail };
  }

  async steerResearchRequest(
    user: PlatformUser,
    requestId: string,
    input: CreateResearchSteeringInput,
  ): Promise<{ request: ResearchRequestDetail }> {
    this.requireRole(user, "requester");

    const activeRun = this.activeResearchRuns.get(requestId);
    if (!activeRun || !activeRun.acceptsSteering || !activeRun.session) {
      throw new AppError(
        409,
        "research_not_running",
        "This request is not currently running, so there is nothing to steer.",
      );
    }

    const prompt = requireText(input.prompt, "prompt");
    const timestamp = now();
    const note: PlatformResearchSteeringNote = {
      id: makeId("steer"),
      prompt,
      status: "queued",
      createdAt: timestamp,
      appliedAt: null,
    };

    activeRun.queuedSteeringIds.push(note.id);
    await this.queueResearchRequestUpdate(requestId, (request) => ({
      ...request,
      progressSummary: "Queued a steering note for the next agent turn.",
      activity: this.appendResearchActivity(
        request.activity,
        this.createResearchActivity("steering", "Steering queued", prompt, "good", timestamp),
      ),
      steeringNotes: [note, ...request.steeringNotes].slice(0, 20),
      updatedAt: timestamp,
    }));

    const message: AgentMessage = {
      role: "user",
      content: [{ type: "text", text: prompt }],
      timestamp: Date.now(),
    };
    activeRun.session.agent.steer(message);

    return this.getResearchRequest(user, requestId);
  }

  async getWorkspace(user: PlatformUser): Promise<WorkspaceData> {
    const state = await this.store.readState();
    const scenarioNames = await this.getScenarioNameMap(user, state);
    const bookmarkIds = new Set(
      state.grantBookmarks
        .filter((bookmark) => bookmark.userId === user.id)
        .map((bookmark) => bookmark.grantId),
    );
    const organization =
      state.organizations.find((candidate) => this.userBelongsToOrganization(candidate, user.id)) ?? null;
    const requests = state.researchRequests
      .filter((request) => request.requesterId === user.id)
      .map((request) => {
        const grants = state.trackedGrants.filter((grant) => grant.requestId === request.id);
        return {
          ...request,
          scenarioName: scenarioNames.get(request.scenarioId) ?? request.scenarioId,
          grantCount: grants.length,
          activeGrantCount: grants.filter((grant) => grant.queueState === "active").length,
        };
      })
      .sort(byCreatedAt);
    const requestStatuses = new Map(requests.map((request) => [request.id, request.status]));
    const grants = state.trackedGrants
      .filter((grant) => grant.requesterId === user.id)
      .map((grant) => {
        const request = state.researchRequests.find((candidate) => candidate.id === grant.requestId);
        return {
          ...grant,
          requestStatus: requestStatuses.get(grant.requestId) ?? request?.status ?? "draft",
          scenarioName: scenarioNames.get(request?.scenarioId ?? "") ?? (request?.scenarioId ?? "Unknown scenario"),
        };
      })
      .sort(byCreatedAt);
    const reports = state.grantReports
      .filter((report) => report.requesterId === user.id)
      .map((report) => this.toPublicGrantReport(report))
      .sort(byCreatedAt);
    const catalog = state.grantCatalogEntries
      .map((grant) => this.toPublicGrantCatalogEntry(grant, bookmarkIds.has(grant.id)))
      .sort(byCreatedAt);
    const applicationTemplates = state.applicationTemplates
      .filter((template) => template.ownerUserId === user.id)
      .map((template) => this.toPublicApplicationTemplate(template))
      .sort(byCreatedAt);
    const applicationWorkspaces = state.applicationWorkspaces
      .filter((workspace) => workspace.requesterId === user.id)
      .map((workspace) => this.toPublicApplicationWorkspace(workspace))
      .sort(byCreatedAt);
    const providerConnections = state.agentProviderConnections
      .filter((connection) =>
        connection.scope === "user"
          ? connection.ownerUserId === user.id
          : organization
            ? connection.organizationId === organization.id
            : false,
      )
      .map((connection) => this.toPublicProviderConnection(connection))
      .sort(byCreatedAt);
    const executions = state.agentExecutionRecords
      .filter((record) => record.actorUserId === user.id)
      .map((record) => this.toPublicAgentExecutionRecord(record))
      .sort(byCreatedAt);

    return {
      user: this.toPublicUser(user),
      organization: organization ? this.toPublicOrganization(organization) : null,
      marketplace: {
        users: state.users.sort(byCreatedAt).map((candidate) => this.toPublicUser(candidate)),
        jobs: this.buildDashboardJobs(state),
        offers: this.buildDashboardOffers(state),
        engagements: this.buildDashboardEngagements(state),
      },
      scenarios: (await this.listResearchScenarios(user)).scenarios,
      requests,
      grants,
      reports,
      catalog,
      applicationTemplates,
      applicationWorkspaces,
      providerConnections,
      executions,
    };
  }

  private async buildResearchRequestDetail(
    user: PlatformUser,
    request: PlatformResearchRequest,
  ): Promise<ResearchRequestDetail> {
    const state = await this.store.readState();
    const scenarioNames = await this.getScenarioNameMap(user, state);
    const grants = state.trackedGrants
      .filter((grant) => grant.requestId === request.id)
      .map((grant) => ({
        ...grant,
        requestStatus: request.status,
        scenarioName: scenarioNames.get(request.scenarioId) ?? request.scenarioId,
      }))
      .sort(byCreatedAt);

    return {
      ...request,
      scenarioName: scenarioNames.get(request.scenarioId) ?? request.scenarioId,
      grantCount: grants.length,
      activeGrantCount: grants.filter((grant) => grant.queueState === "active").length,
      grants,
    };
  }

  async listGrantReports(user: PlatformUser) {
    const state = await this.store.readState();
    return {
      reports: state.grantReports
        .filter((report) => report.requesterId === user.id)
        .map((report) => this.toPublicGrantReport(report))
        .sort(byCreatedAt),
    };
  }

  async promoteGrantToCatalogEntry(user: PlatformUser, grantId: string) {
    this.requireRole(user, "requester");

    const grant = await this.requireGrantOwner(user, grantId);
    const report = await this.store.findGrantReportByRequestId(grant.requestId);
    if (!report) {
      throw new AppError(
        409,
        "grant_report_missing",
        "This tracked grant cannot be promoted until its research report is available.",
      );
    }

    const existingEntry = await this.store.findGrantCatalogEntryBySourceGrantId(grant.id);
    const catalogEntry: PlatformGrantCatalogEntry = {
      id: existingEntry?.id ?? makeId("catalog"),
      createdByUserId: existingEntry?.createdByUserId ?? user.id,
      sourceType: "promoted",
      sourceGrantId: grant.id,
      sourceReportId: report.id,
      title: grant.title,
      sponsor: grant.sponsor,
      fundingType: grant.fundingType,
      fitScore: grant.fitScore,
      whyFit: grant.whyFit,
      eligibilityNotes: [...grant.eligibilityNotes],
      amountSummary: grant.amountSummary,
      deadlineSummary: grant.deadlineSummary,
      geography: grant.geography,
      status: grant.status,
      citations: [...grant.citations],
      nextActions: [...grant.nextActions],
      tags: this.buildCatalogTags(grant),
      createdAt: existingEntry?.createdAt ?? now(),
      updatedAt: now(),
    };

    const savedEntry = await this.store.saveGrantCatalogEntry(catalogEntry);
    const bookmarked = await this.isCatalogGrantBookmarked(user.id, savedEntry.id);
    return {
      grant: this.toPublicGrantCatalogEntry(savedEntry, bookmarked),
    };
  }

  async listCatalogGrants(
    user: PlatformUser,
    filters: { bookmarked?: boolean } = {},
  ) {
    const state = await this.store.readState();
    const bookmarkIds = new Set(
      state.grantBookmarks
        .filter((bookmark) => bookmark.userId === user.id)
        .map((bookmark) => bookmark.grantId),
    );
    const bookmarkedOnly = filters.bookmarked ?? false;

    return {
      grants: state.grantCatalogEntries
        .filter((grant) => !bookmarkedOnly || bookmarkIds.has(grant.id))
        .map((grant) => this.toPublicGrantCatalogEntry(grant, bookmarkIds.has(grant.id)))
        .sort(byCreatedAt),
    };
  }

  async getCatalogGrant(user: PlatformUser, grantId: string) {
    const grant = await this.requireCatalogGrant(grantId);
    const schema = await this.store.findGrantApplicationSchemaByCatalogGrantId(grant.id);
    return {
      grant: this.toPublicGrantCatalogEntry(
        grant,
        await this.isCatalogGrantBookmarked(user.id, grant.id),
      ),
      schema: schema ? this.toPublicGrantApplicationSchema(schema) : null,
    };
  }

  async setCatalogGrantBookmark(user: PlatformUser, grantId: string, bookmarked: boolean) {
    await this.requireCatalogGrant(grantId);
    const isBookmarked = await this.store.setGrantBookmark(user.id, grantId, bookmarked);
    const grant = await this.requireCatalogGrant(grantId);
    return {
      grant: this.toPublicGrantCatalogEntry(grant, isBookmarked),
    };
  }

  async upsertGrantApplicationSchema(
    user: PlatformUser,
    grantId: string,
    input: UpsertGrantApplicationSchemaInput,
  ) {
    this.requireRole(user, "requester");
    await this.requireCatalogGrant(grantId);

    const existing = await this.store.findGrantApplicationSchemaByCatalogGrantId(grantId);
    const timestamp = now();
    const schema = await this.store.upsertGrantApplicationSchema({
      id: existing?.id ?? makeId("schema"),
      catalogGrantId: grantId,
      name: requireText(input.name, "name"),
      documentType: this.requireApplicationDocumentType(input.documentType),
      sections: this.normalizeSectionDefinitions(input.sections),
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
    });

    return {
      schema: this.toPublicGrantApplicationSchema(schema),
    };
  }

  async createApplicationTemplate(user: PlatformUser, input: CreateApplicationTemplateInput) {
    this.requireRole(user, "requester");

    const timestamp = now();
    const template = await this.store.createApplicationTemplate({
      id: makeId("template"),
      ownerUserId: user.id,
      name: requireText(input.name, "name"),
      documentType: this.requireApplicationDocumentType(input.documentType),
      sections: this.normalizeSectionDefinitions(input.sections),
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    return {
      template: this.toPublicApplicationTemplate(template),
    };
  }

  async createApplicationWorkspace(user: PlatformUser, input: CreateApplicationWorkspaceInput) {
    this.requireRole(user, "requester");

    const documentType = this.requireApplicationDocumentType(input.documentType);
    const timestamp = now();
    const organizationPrefill = this.buildOrganizationPrefill(await this.findOrganizationForUser(user));
    let catalogGrant: PlatformGrantCatalogEntry | null = null;
    let template: PlatformApplicationTemplate | null = null;
    let schema: PlatformGrantApplicationSchema | null = null;

    if (input.catalogGrantId) {
      catalogGrant = await this.requireCatalogGrant(input.catalogGrantId);
      schema = await this.store.findGrantApplicationSchemaByCatalogGrantId(catalogGrant.id);
    }

    if (input.templateId) {
      template = await this.requireApplicationTemplateOwner(user, input.templateId);
    }

    const sectionDefinitions =
      schema?.sections ??
      template?.sections ??
      this.buildDefaultWorkspaceSections(documentType);
    const workspace = await this.store.createApplicationWorkspace({
      id: makeId("workspace"),
      requesterId: user.id,
      catalogGrantId: catalogGrant?.id ?? null,
      templateId: template?.id ?? null,
      organizationPrefill,
      documentType,
      title:
        catalogGrant?.title ??
        template?.name ??
        `${documentType.replaceAll("_", " ")} workspace`,
      state: "draft",
      sections: this.instantiateWorkspaceSections(
        sectionDefinitions,
        organizationPrefill,
        catalogGrant,
        timestamp,
      ),
      createdAt: timestamp,
      updatedAt: timestamp,
      finalizedAt: null,
    });

    return {
      workspace: this.toPublicApplicationWorkspace(workspace),
    };
  }

  async getApplicationWorkspace(user: PlatformUser, workspaceId: string) {
    const workspace = await this.requireApplicationWorkspaceOwner(user, workspaceId);
    return {
      workspace: this.toPublicApplicationWorkspace(workspace),
    };
  }

  async updateApplicationWorkspaceSection(
    user: PlatformUser,
    workspaceId: string,
    sectionId: string,
    input: { content: string },
  ) {
    const workspace = await this.requireApplicationWorkspaceOwner(user, workspaceId);
    const sectionIndex = workspace.sections.findIndex((section) => section.id === sectionId);
    if (sectionIndex === -1) {
      throw new AppError(404, "workspace_section_not_found", "The requested workspace section does not exist.");
    }

    const updatedAt = now();
    const savedWorkspace = await this.store.saveApplicationWorkspace({
      ...workspace,
      sections: workspace.sections.map((section, index) =>
        index === sectionIndex ? { ...section, content: input.content, updatedAt } : section,
      ),
      updatedAt,
    });
    const savedSection = savedWorkspace.sections.find((section) => section.id === sectionId);
    if (!savedSection) {
      throw new AppError(500, "workspace_section_missing", "The saved workspace section could not be loaded.");
    }

    return {
      section: this.toPublicApplicationWorkspace(savedWorkspace).sections.find((section) => section.id === sectionId),
    };
  }

  async finalizeApplicationWorkspace(user: PlatformUser, workspaceId: string) {
    const workspace = await this.requireApplicationWorkspaceOwner(user, workspaceId);
    const finalizedAt = now();
    const saved = await this.store.saveApplicationWorkspace({
      ...workspace,
      state: "proposal",
      updatedAt: finalizedAt,
      finalizedAt,
    });

    return {
      workspace: this.toPublicApplicationWorkspace(saved),
    };
  }

  async generateApplicationWorkspaceSection(
    user: PlatformUser,
    workspaceId: string,
    sectionId: string,
    input: GenerateWorkspaceSectionInput = {},
  ) {
    const workspace = await this.requireApplicationWorkspaceOwner(user, workspaceId);
    const sectionIndex = workspace.sections.findIndex((section) => section.id === sectionId);
    if (sectionIndex === -1) {
      throw new AppError(404, "workspace_section_not_found", "The requested workspace section does not exist.");
    }

    const catalogGrant = workspace.catalogGrantId
      ? await this.store.findGrantCatalogEntryById(workspace.catalogGrantId)
      : null;
    const generatedContent = this.composeWorkspaceSectionContent(
      workspace.sections[sectionIndex],
      workspace.organizationPrefill,
      catalogGrant,
    );
    const updatedAt = now();
    const updatedSections = workspace.sections.map((section, index) =>
      index === sectionIndex ? { ...section, content: generatedContent, updatedAt } : section,
    );
    const savedWorkspace = await this.store.saveApplicationWorkspace({
      ...workspace,
      sections: updatedSections,
      updatedAt,
    });
    const savedSection = savedWorkspace.sections.find((section) => section.id === sectionId);
    if (!savedSection) {
      throw new AppError(500, "workspace_section_missing", "The saved workspace section could not be loaded.");
    }

    if (input.providerConnectionId) {
      const providerConnection = await this.requireProviderConnectionForAction(
        user,
        input.providerConnectionId,
        "workspace_section",
      );
      await this.store.createAgentExecutionRecord({
        id: makeId("execution"),
        actorUserId: user.id,
        providerConnectionId: providerConnection.id,
        targetType: "workspace_section",
        targetId: sectionId,
        action: "generate_section",
        outputText: generatedContent,
        createdAt: updatedAt,
      });
    }

    return {
      section: this.toPublicApplicationWorkspace(savedWorkspace).sections.find(
        (section) => section.id === sectionId,
      ),
    };
  }

  async createProviderConnection(user: PlatformUser, input: CreateProviderConnectionInput) {
    const scope = this.requireProviderConnectionScope(input.scope);
    const organization =
      scope === "organization" ? await this.requireOrganizationOwner(user) : null;
    const timestamp = now();
    const connection = await this.store.createAgentProviderConnection({
      id: makeId("provider"),
      scope,
      ownerUserId: scope === "user" ? user.id : null,
      organizationId: organization?.id ?? null,
      provider: requireText(input.provider, "provider"),
      label: requireText(input.label, "label"),
      authType: this.requireProviderAuthType(input.authType),
      allowedArtifactTypes: input.allowedArtifactTypes.map((value) => this.requireServiceTargetType(value)),
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    return {
      connection: this.toPublicProviderConnection(connection),
    };
  }

  async listAgentExecutions(user: PlatformUser) {
    const state = await this.store.readState();
    return {
      executions: state.agentExecutionRecords
        .filter((record) => record.actorUserId === user.id)
        .map((record) => this.toPublicAgentExecutionRecord(record))
        .sort(byCreatedAt),
    };
  }

  async updateGrantQueueState(
    user: PlatformUser,
    grantId: string,
    queueState: GrantQueueState,
  ) {
    this.requireRole(user, "requester");

    const grant = await this.requireGrantOwner(user, grantId);
    const updatedGrant = await this.store.saveTrackedGrant({
      ...grant,
      queueState: this.requireGrantQueueState(queueState),
      updatedAt: now(),
    });

    return { grant: updatedGrant };
  }

  async createProposalJobFromGrant(user: PlatformUser, grantId: string) {
    this.requireRole(user, "requester");

    const grant = await this.requireGrantOwner(user, grantId);
    if (grant.proposalJobId) {
      const existingJob = await this.store.findJobById(grant.proposalJobId);
      if (existingJob) {
        return { job: existingJob, grant };
      }
    }

    const job: PlatformJob = {
      id: makeId("job"),
      requesterId: user.id,
      type: "grant_proposal",
      grantId: grant.id,
      targetType: null,
      targetId: null,
      specialistRole: null,
      title: `Grant proposal for ${grant.title}`,
      description: [
        `Prepare and submit a proposal for ${grant.title}.`,
        `Sponsor: ${grant.sponsor}.`,
        `Why it fits: ${grant.whyFit}`,
      ].join(" "),
      fundingNeed: `${grant.fundingType} proposal and submission support`,
      status: "open",
      createdAt: now(),
    };
    const createdJob = await this.store.createJob(job);
    const updatedGrant = await this.store.saveTrackedGrant({
      ...grant,
      proposalJobId: createdJob.id,
      updatedAt: now(),
    });

    return {
      job: createdJob,
      grant: updatedGrant,
    };
  }

  async createJob(user: PlatformUser, input: CreateJobInput) {
    this.requireRole(user, "requester");

    const targetType =
      input.targetType === null || input.targetType === undefined
        ? null
        : this.requireServiceTargetType(input.targetType);
    const targetId = targetType ? requireText(input.targetId ?? "", "targetId") : null;
    if (targetType && targetId) {
      await this.requireServiceTargetOwner(user, targetType, targetId);
    }

    const job: PlatformJob = {
      id: makeId("job"),
      requesterId: user.id,
      type: "general",
      grantId: null,
      targetType,
      targetId,
      specialistRole:
        input.specialistRole === null || input.specialistRole === undefined
          ? null
          : this.requireSpecialistServiceRole(input.specialistRole),
      title: requireText(input.title, "title"),
      description: requireText(input.description, "description"),
      fundingNeed: requireText(input.fundingNeed, "fundingNeed"),
      status: "open",
      createdAt: now(),
    };

    return { job: await this.store.createJob(job) };
  }

  async listJobs(): Promise<{ jobs: DashboardJob[] }> {
    const state = await this.store.readState();
    return {
      jobs: this.buildDashboardJobs(state),
    };
  }

  async createOffer(user: PlatformUser, jobId: string, input: CreateOfferInput) {
    this.requireRole(user, "specialist");

    const job = await this.store.findJobById(jobId);
    if (!job) {
      throw new AppError(404, "job_not_found", "The requested job does not exist.");
    }

    if (job.status !== "open") {
      throw new AppError(409, "job_not_open", "Offers can only be submitted to open jobs.");
    }

    const offer: PlatformOffer = {
      id: makeId("offer"),
      jobId: job.id,
      specialistId: user.id,
      specialistRole:
        input.specialistRole === null || input.specialistRole === undefined
          ? job.specialistRole
          : this.requireSpecialistServiceRole(input.specialistRole),
      message: requireText(input.message, "message"),
      amountUsd: normalizeUsd(input.amountUsd),
      payoutAddress: requireText(input.payoutAddress, "payoutAddress"),
      status: "pending",
      createdAt: now(),
      acceptedAt: null,
    };

    return { offer: await this.store.createOffer(offer) };
  }

  async acceptOffer(user: PlatformUser, offerId: string) {
    this.requireRole(user, "requester");

    const offer = await this.store.findOfferById(offerId);
    if (!offer) {
      throw new AppError(404, "offer_not_found", "The requested offer does not exist.");
    }

    const job = await this.store.findJobById(offer.jobId);
    if (!job) {
      throw new AppError(404, "job_not_found", "The offer is attached to a missing job.");
    }

    if (job.requesterId !== user.id) {
      throw new AppError(403, "forbidden", "Only the requester who created the job can accept an offer.");
    }

    const engagement = await this.store.acceptOffer(user.id, offerId);
    if (!engagement) {
      throw new AppError(500, "accept_failed", "The offer could not be accepted.");
    }

    return { engagement };
  }

  async getEngagement(user: PlatformUser, engagementId: string) {
    const engagement = await this.requireEngagementViewer(user, engagementId);
    return { engagement };
  }

  async getFundingChallenge(
    user: PlatformUser,
    engagementId: string,
    settings: X402Settings,
  ): Promise<FundingChallenge> {
    const engagement = await this.requireEngagementOwner(user, engagementId);
    if (engagement.status === "funded") {
      throw new AppError(409, "already_funded", "This engagement has already been funded.");
    }

    return this.buildFundingChallenge(engagement, settings);
  }

  async getFundingChallengeForEngagement(
    engagementId: string,
    settings: X402Settings,
  ): Promise<FundingChallenge> {
    const engagement = await this.store.findEngagementById(engagementId);
    if (!engagement) {
      throw new AppError(404, "engagement_not_found", "The requested engagement does not exist.");
    }

    return this.buildFundingChallenge(engagement, settings);
  }

  async fundEngagement(
    user: PlatformUser,
    engagementId: string,
    settings: X402Settings,
    paymentHeader: string | null,
  ) {
    const challenge = await this.getFundingChallenge(user, engagementId, settings);
    const funded = await this.store.fundEngagement(engagementId, {
      protocol: "x402",
      amountUsd: challenge.amountUsd,
      network: challenge.network,
      payTo: challenge.payTo,
      facilitatorUrl: challenge.facilitatorUrl,
      paymentHeader,
      fundedByUserId: user.id,
    });

    if (!funded) {
      throw new AppError(500, "fund_failed", "The engagement funding record could not be stored.");
    }

    return { engagement: funded };
  }

  async getDashboardData(): Promise<DashboardData> {
    const state = await this.store.readState();
    return {
      users: state.users.sort(byCreatedAt).map((user) => this.toPublicUser(user)),
      jobs: this.buildDashboardJobs(state),
      offers: this.buildDashboardOffers(state),
      engagements: this.buildDashboardEngagements(state),
    };
  }

  private startInteractiveResearchRun(
    request: PlatformResearchRequest,
    scenario: BusinessScenario,
  ): ActiveResearchRun {
    const session = this.researchSessionFactory?.({
      scenario,
      thinkingLevel: (process.env.PI_THINKING_LEVEL as
        | "off"
        | "minimal"
        | "low"
        | "medium"
        | "high"
        | "xhigh"
        | undefined) ?? "medium",
    });
    if (!session) {
      return this.startBlockingResearchRun(request, scenario);
    }

    const activeRun: ActiveResearchRun = {
      session,
      queuedSteeringIds: [],
      updateChain: Promise.resolve(request),
      completion: Promise.resolve({ request, grants: [] }),
      acceptsSteering: true,
    };
    const unsubscribe = session.agent.subscribe((event) => {
      void this.handleResearchSessionEvent(request.id, event);
    });

    activeRun.completion = (async () => {
      try {
        await session.agent.prompt(session.prompt);
        return await this.finishResearchRun(request.id, {
          brief: session.brief,
          report: session.getReportOrThrow(),
          messages: [],
        });
      } catch (error) {
        throw await this.failResearchRun(request.id, error);
      } finally {
        unsubscribe();
        this.activeResearchRuns.delete(request.id);
      }
    })();

    return activeRun;
  }

  private startBlockingResearchRun(
    request: PlatformResearchRequest,
    scenario: BusinessScenario,
  ): ActiveResearchRun {
    const activeRun: ActiveResearchRun = {
      session: null,
      queuedSteeringIds: [],
      updateChain: Promise.resolve(request),
      completion: Promise.resolve({ request, grants: [] }),
      acceptsSteering: false,
    };

    activeRun.completion = (async () => {
      try {
        const startedAt = now();
        await this.queueResearchRequestUpdate(request.id, (current) => ({
          ...current,
          runPhase: "searching",
          progressSummary: "Running the research model and collecting source material.",
          activity: this.appendResearchActivity(
            current.activity,
            this.createResearchActivity(
              "status",
              "Research execution underway",
              "Running the research model and collecting source material.",
              "warn",
              startedAt,
            ),
          ),
          updatedAt: startedAt,
        }));

        const result = await this.executeResearch(scenario);
        return await this.finishResearchRun(request.id, result);
      } catch (error) {
        throw await this.failResearchRun(request.id, error);
      } finally {
        this.activeResearchRuns.delete(request.id);
      }
    })();

    return activeRun;
  }

  private async handleResearchSessionEvent(
    requestId: string,
    event: FundingResearchSessionEvent,
  ): Promise<void> {
    if (!this.activeResearchRuns.has(requestId)) {
      return;
    }

    switch (event.type) {
      case "agent_start":
        await this.queueResearchRequestUpdate(requestId, (request) => ({
          ...request,
          runPhase: "briefing",
          progressSummary: "Preparing the research brief and initial search plan.",
          updatedAt: now(),
        }));
        return;
      case "turn_start":
        await this.applyQueuedSteering(requestId);
        return;
      case "tool_execution_start": {
        const timestamp = now();
        await this.queueResearchRequestUpdate(requestId, (request) => ({
          ...request,
          runPhase: this.phaseForTool(event.toolName),
          progressSummary: this.progressSummaryForTool(event.toolName, event.args),
          activity: this.appendResearchActivity(
            request.activity,
            this.createResearchActivity(
              "tool",
              this.titleForTool(event.toolName),
              this.detailForTool(event.toolName, event.args),
              "warn",
              timestamp,
            ),
          ),
          updatedAt: timestamp,
        }));
        return;
      }
      case "tool_execution_end":
        if (!event.isError) {
          return;
        }

        await this.queueResearchRequestUpdate(requestId, (request) => ({
          ...request,
          progressSummary: `A ${event.toolName} step failed. The agent will recover or surface the error.`,
          activity: this.appendResearchActivity(
            request.activity,
            this.createResearchActivity(
              "tool",
              `${this.titleForTool(event.toolName)} failed`,
              this.summarizeValue(event.result?.content ?? event.result),
              "bad",
              now(),
            ),
          ),
          updatedAt: now(),
        }));
        return;
      default:
        return;
    }
  }

  private async applyQueuedSteering(requestId: string): Promise<void> {
    const activeRun = this.activeResearchRuns.get(requestId);
    const steeringId = activeRun?.queuedSteeringIds.shift();
    if (!steeringId) {
      return;
    }

    const appliedAt = now();
    await this.queueResearchRequestUpdate(requestId, (request) => {
      const note = request.steeringNotes.find((candidate) => candidate.id === steeringId);
      if (!note) {
        return request;
      }

      return {
        ...request,
        progressSummary: "Applying the latest steering note before the next research step.",
        steeringNotes: request.steeringNotes.map((candidate) =>
          candidate.id === steeringId
            ? { ...candidate, status: "applied", appliedAt }
            : candidate,
        ),
        activity: this.appendResearchActivity(
          request.activity,
          this.createResearchActivity("steering", "Steering applied", note.prompt, "good", appliedAt),
        ),
        updatedAt: appliedAt,
      };
    });
  }

  private async finishResearchRun(
    requestId: string,
    result: FundingResearchResult,
  ): Promise<ResearchRequestRunResult> {
    const completedAt = now();
    const completedRequest = await this.queueResearchRequestUpdate(requestId, (request) => ({
      ...request,
      status: "completed",
      runPhase: "completed",
      progressSummary: `Completed research and refreshed ${result.report.opportunities.length} tracked grants.`,
      latestBrief: result.brief,
      latestReport: result.report,
      errorMessage: null,
      lastRunAt: completedAt,
      activity: this.appendResearchActivity(
        request.activity,
        this.createResearchActivity(
          "status",
          "Research run completed",
          `Completed research and refreshed ${result.report.opportunities.length} tracked grants.`,
          "good",
          completedAt,
        ),
      ),
      updatedAt: completedAt,
    }));

    const state = await this.store.readState();
    const existingGrants = state.trackedGrants.filter((grant) => grant.requestId === completedRequest.id);
    const grants = result.report.opportunities.map((opportunity) =>
      this.toTrackedGrant(completedRequest, opportunity, existingGrants),
    );
    const savedGrants = await this.store.replaceTrackedGrants(completedRequest.id, grants);
    const existingReport = await this.store.findGrantReportByRequestId(completedRequest.id);
    await this.store.upsertGrantReport({
      id: existingReport?.id ?? makeId("report"),
      requestId: completedRequest.id,
      requesterId: completedRequest.requesterId,
      businessCaseId: result.report.businessCaseId,
      executiveSummary: result.report.executiveSummary,
      searchSummary: result.report.searchSummary,
      opportunities: result.report.opportunities.map((opportunity) => ({
        ...opportunity,
        eligibilityNotes: [...opportunity.eligibilityNotes],
        citations: [...opportunity.citations],
        nextActions: [...opportunity.nextActions],
      })),
      rejectedLeads: result.report.rejectedLeads.map((lead) => ({
        ...lead,
        citations: [...lead.citations],
      })),
      nextActions: [...result.report.nextActions],
      createdAt: existingReport?.createdAt ?? completedAt,
      updatedAt: completedAt,
    });

    return {
      request: completedRequest,
      grants: savedGrants,
    };
  }

  private async failResearchRun(requestId: string, error: unknown): Promise<AppError> {
    const failedAt = now();
    const message = error instanceof Error ? error.message : "Funding research failed.";
    await this.queueResearchRequestUpdate(requestId, (request) => ({
      ...request,
      status: "failed",
      runPhase: "failed",
      progressSummary: "The research run stopped before it could publish a report.",
      errorMessage: message,
      lastRunAt: failedAt,
      activity: this.appendResearchActivity(
        request.activity,
        this.createResearchActivity(
          "status",
          "Research run failed",
          message,
          "bad",
          failedAt,
        ),
      ),
      updatedAt: failedAt,
    }));

    return new AppError(502, "research_failed", message);
  }

  private async listTrackedGrantsForRequest(requestId: string): Promise<PlatformTrackedGrant[]> {
    const state = await this.store.readState();
    return state.trackedGrants.filter((grant) => grant.requestId === requestId).sort(byCreatedAt);
  }

  private queueResearchRequestUpdate(
    requestId: string,
    mutate: (request: PlatformResearchRequest) => PlatformResearchRequest,
  ): Promise<PlatformResearchRequest> {
    const activeRun = this.activeResearchRuns.get(requestId);
    if (!activeRun) {
      return this.store.findResearchRequestById(requestId).then(async (request) => {
        if (!request) {
          throw new AppError(404, "request_not_found", "The requested research request does not exist.");
        }

        return this.store.saveResearchRequest(mutate(request));
      });
    }

    const previousUpdate = activeRun.updateChain.catch(async () => {
      const recovered = await this.store.findResearchRequestById(requestId);
      if (!recovered) {
        throw new AppError(404, "request_not_found", "The requested research request does not exist.");
      }

      return recovered;
    });
    activeRun.updateChain = previousUpdate.then(async () => {
      const request = await this.store.findResearchRequestById(requestId);
      if (!request) {
        throw new AppError(404, "request_not_found", "The requested research request does not exist.");
      }

      return this.store.saveResearchRequest(mutate(request));
    });

    return activeRun.updateChain;
  }

  private phaseForTool(toolName: string): ResearchRunPhase {
    if (toolName === "plan_research_round") {
      return "briefing";
    }

    if (toolName === "search_web") {
      return "searching";
    }

    if (toolName === "read_source_page") {
      return "reading";
    }

    if (
      toolName === "review_research_round" ||
      toolName === "plan_report" ||
      toolName === "draft_report" ||
      toolName === "review_report" ||
      toolName === "rerank_report"
    ) {
      return "synthesizing";
    }

    if (toolName === "publish_report") {
      return "publishing";
    }

    return "synthesizing";
  }

  private titleForTool(toolName: string): string {
    if (toolName === "plan_research_round") {
      return "Planning source fan-out";
    }

    if (toolName === "search_web") {
      return "Searching for opportunities";
    }

    if (toolName === "read_source_page") {
      return "Reading source material";
    }

    if (toolName === "review_research_round") {
      return "Reviewing and ranking evidence";
    }

    if (toolName === "plan_report") {
      return "Planning the final brief";
    }

    if (toolName === "draft_report") {
      return "Writing the final brief";
    }

    if (toolName === "review_report") {
      return "Reviewing the final brief";
    }

    if (toolName === "rerank_report") {
      return "Re-ranking the recommendations";
    }

    if (toolName === "publish_report") {
      return "Publishing structured report";
    }

    return `Running ${toolName}`;
  }

  private detailForTool(toolName: string, args: unknown): string {
    if (toolName === "plan_research_round" && this.isRecord(args) && typeof args.round === "number") {
      return `Round ${args.round}: planning the next source collection pass.`;
    }

    if (toolName === "search_web" && this.isRecord(args) && typeof args.query === "string") {
      return `Query: ${args.query}`;
    }

    if (toolName === "read_source_page" && this.isRecord(args) && typeof args.url === "string") {
      return `Source: ${args.url}`;
    }

    if (toolName === "review_research_round" && this.isRecord(args) && typeof args.round === "number") {
      return `Round ${args.round}: scoring sources and grant candidates from the latest pass.`;
    }

    if (toolName === "plan_report") {
      return "Checking whether the evidence base is strong enough to draft the final report.";
    }

    if (toolName === "draft_report") {
      return "Drafting the ranked grant brief from the collected evidence.";
    }

    if (toolName === "review_report") {
      return "Checking the draft for coverage gaps, unsupported claims, and ranking issues.";
    }

    if (toolName === "rerank_report") {
      return "Applying the review feedback and final ranking adjustments.";
    }

    if (toolName === "publish_report") {
      return "Writing the final structured brief and opportunity report.";
    }

    return this.summarizeValue(args);
  }

  private progressSummaryForTool(toolName: string, args: unknown): string {
    if (toolName === "plan_research_round" && this.isRecord(args) && typeof args.round === "number") {
      return `Planning research round ${args.round}.`;
    }

    if (toolName === "search_web" && this.isRecord(args) && typeof args.query === "string") {
      return `Searching the web for: ${args.query}`;
    }

    if (toolName === "read_source_page" && this.isRecord(args) && typeof args.url === "string") {
      return `Reading and verifying: ${args.url}`;
    }

    if (toolName === "review_research_round" && this.isRecord(args) && typeof args.round === "number") {
      return `Reviewing and ranking evidence from round ${args.round}.`;
    }

    if (toolName === "plan_report") {
      return "Checking whether the collected evidence is ready for report writing.";
    }

    if (toolName === "draft_report") {
      return "Writing the ranked grant brief.";
    }

    if (toolName === "review_report") {
      return "Reviewing the draft for missing evidence and ranking mistakes.";
    }

    if (toolName === "rerank_report") {
      return "Applying review feedback and finalizing the ranking.";
    }

    if (toolName === "publish_report") {
      return "Compiling the final report and tracked grants.";
    }

    return `Running ${toolName}.`;
  }

  private createResearchActivity(
    kind: PlatformResearchActivity["kind"],
    title: string,
    detail: string,
    tone: PlatformResearchActivity["tone"],
    timestamp: string,
  ): PlatformResearchActivity {
    return {
      id: makeId("activity"),
      kind,
      title,
      detail,
      tone,
      timestamp,
    };
  }

  private appendResearchActivity(
    activity: PlatformResearchActivity[],
    entry: PlatformResearchActivity,
  ): PlatformResearchActivity[] {
    return [...activity, entry].slice(-40);
  }

  private summarizeValue(value: unknown): string {
    const text = typeof value === "string" ? value : JSON.stringify(value, null, 2);
    if (!text) {
      return "No details were provided for this step.";
    }

    return text.length > 180 ? `${text.slice(0, 177)}...` : text;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === "object";
  }

  private normalizeOptionalText(value: unknown): string | null {
    if (typeof value !== "string") {
      return null;
    }

    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }

  private normalizeOrganizationPersonnel(value: unknown): PlatformOrganizationPersonnel[] {
    if (!Array.isArray(value)) {
      throw new AppError(400, "invalid_input", "personnel must be a list of contacts.");
    }

    return value.map((entry) => {
      if (!this.isRecord(entry)) {
        throw new AppError(400, "invalid_input", "personnel entries must be objects.");
      }

      const platformAccessEnabled = Boolean(entry.platformAccessEnabled);
      const accessState = platformAccessEnabled
        ? this.normalizeOrganizationPersonnelAccessState(entry.accessState)
        : "none";
      const invite = platformAccessEnabled ? this.normalizeOrganizationInvite(entry.invite) : null;
      const userId = platformAccessEnabled ? this.normalizeOptionalText(entry.userId) : null;

      if (accessState === "active" && !userId) {
        throw new AppError(
          400,
          "invalid_input",
          "personnel.userId is required when accessState is active.",
        );
      }

      if (accessState === "invited" && !invite) {
        throw new AppError(
          400,
          "invalid_input",
          "personnel.invite is required when accessState is invited.",
        );
      }

      return {
        id: typeof entry.id === "string" && entry.id.trim() ? entry.id : makeId("person"),
        fullName: requireText(
          typeof entry.fullName === "string" ? entry.fullName : "",
          "personnel.fullName",
        ),
        roleTitle: requireText(
          typeof entry.roleTitle === "string" ? entry.roleTitle : "",
          "personnel.roleTitle",
        ),
        yearsExperience: this.normalizePersonnelYearsExperience(entry.yearsExperience),
        email: this.normalizeOptionalText(entry.email),
        userId,
        platformAccessEnabled,
        accessState,
        canManageInvites: Boolean(entry.canManageInvites) && platformAccessEnabled,
        invite,
      };
    });
  }

  private normalizePersonnelYearsExperience(value: unknown): number | null {
    const normalizedYears =
      value === null || value === undefined
        ? null
        : typeof value === "number" && Number.isFinite(value) && value >= 0
          ? value
          : Number.NaN;
    if (Number.isNaN(normalizedYears)) {
      throw new AppError(
        400,
        "invalid_input",
        "personnel.yearsExperience must be a non-negative number when provided.",
      );
    }

    return normalizedYears;
  }

  private normalizeOrganizationInvite(value: unknown) {
    if (value === null || value === undefined) {
      return null;
    }

    if (!this.isRecord(value)) {
      throw new AppError(400, "invalid_input", "personnel.invite must be an object when provided.");
    }

    return {
      id: requireText(typeof value.id === "string" ? value.id : "", "personnel.invite.id"),
      invitePath: requireText(
        typeof value.invitePath === "string" ? value.invitePath : "",
        "personnel.invite.invitePath",
      ),
      createdAt: requireText(
        typeof value.createdAt === "string" ? value.createdAt : "",
        "personnel.invite.createdAt",
      ),
      acceptedAt: this.normalizeOptionalText(value.acceptedAt),
    };
  }

  private normalizeOrganizationPersonnelAccessState(
    value: unknown,
  ): PlatformOrganizationPersonnel["accessState"] {
    return value === "active" ? "active" : value === "invited" ? "invited" : "none";
  }

  private samePersonnelRecords(
    left: PlatformOrganizationPersonnel[],
    right: PlatformOrganizationPersonnel[],
  ): boolean {
    return JSON.stringify(left) === JSON.stringify(right);
  }

  private async findOrganizationForUser(user: PlatformUser): Promise<PlatformOrganization | null> {
    const ownedOrganization = await this.store.findOrganizationByOwnerUserId(user.id);
    if (ownedOrganization) {
      return ownedOrganization;
    }

    const state = await this.store.readState();
    return state.organizations.find((organization) => this.userBelongsToOrganization(organization, user.id)) ?? null;
  }

  private async findOrganizationByInviteId(inviteId: string): Promise<PlatformOrganization | null> {
    const state = await this.store.readState();
    return (
      state.organizations.find((organization) =>
        organization.personnel.some((person) => person.invite?.id === inviteId),
      ) ?? null
    );
  }

  private userBelongsToOrganization(organization: PlatformOrganization, userId: string): boolean {
    return (
      organization.ownerUserId === userId ||
      organization.personnel.some(
        (person) =>
          person.userId === userId &&
          person.platformAccessEnabled &&
          person.accessState === "active",
      )
    );
  }

  private canManageOrganizationInvites(organization: PlatformOrganization, userId: string): boolean {
    return (
      organization.ownerUserId === userId ||
      organization.personnel.some(
        (person) =>
          person.userId === userId &&
          person.platformAccessEnabled &&
          person.accessState === "active" &&
          person.canManageInvites,
      )
    );
  }

  private async requireOrganizationInviteManager(user: PlatformUser): Promise<PlatformOrganization> {
    const organization = await this.findOrganizationForUser(user);
    if (!organization) {
      throw new AppError(409, "organization_required", "Create or join an organization before managing invites.");
    }

    if (!this.canManageOrganizationInvites(organization, user.id)) {
      throw new AppError(403, "forbidden", "You do not have permission to manage organization invites.");
    }

    return organization;
  }

  private buildOrganizationPrefill(
    organization: PlatformOrganization | null,
  ): PlatformOrganizationPrefill | null {
    if (!organization) {
      return null;
    }

    return {
      organizationName: organization.name,
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
      capturedAt: organization.updatedAt,
    };
  }

  private attachOrganizationPrefillToScenario(
    scenario: BusinessScenario,
    organizationPrefill: PlatformOrganizationPrefill | null,
  ): BusinessScenario & { organizationPrefill?: PlatformOrganizationPrefill | null } {
    if (!organizationPrefill) {
      return { ...scenario };
    }

    return {
      ...scenario,
      organizationPrefill: {
        ...organizationPrefill,
        localOperatingAreas: [...organizationPrefill.localOperatingAreas],
        programs: [...organizationPrefill.programs],
        targetDemographics: [...organizationPrefill.targetDemographics],
        thematicAreas: [...organizationPrefill.thematicAreas],
        strategicPriorities: [...organizationPrefill.strategicPriorities],
      },
    };
  }

  private async saveOrganization(organization: PlatformOrganization): Promise<PlatformOrganization> {
    return this.store.upsertOrganization({
      ownerUserId: organization.ownerUserId,
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
      emailUpdatesEnabled: organization.emailUpdatesEnabled,
      personnel: organization.personnel.map((person) => ({
        ...person,
        invite: person.invite ? { ...person.invite } : null,
      })),
    });
  }

  private async verifyBrowserIdentity(
    accessToken: string | null | undefined,
  ): Promise<PlatformSessionIdentity> {
    if (!accessToken) {
      throw new AppError(401, "missing_auth", "Authorization: Bearer <token> is required.");
    }

    if (!this.authProvider) {
      throw new AppError(503, "auth_unavailable", "Browser authentication is not configured.");
    }

    try {
      return await this.authProvider.verifyAccessToken(accessToken);
    } catch (error) {
      if (error instanceof InvalidAccessTokenError) {
        throw new AppError(401, "invalid_auth", error.message);
      }

      throw error;
    }
  }

  private buildFundingChallenge(engagement: PlatformEngagement, settings: X402Settings): FundingChallenge {
    return {
      protocol: "x402",
      engagementId: engagement.id,
      description: "Fund a specialist engagement to apply for grants on the requester's behalf.",
      facilitatorUrl: settings.facilitatorUrl,
      network: settings.network,
      payTo: engagement.payoutAddress || settings.payTo,
      amountUsd: engagement.amountUsd,
      route: `/api/engagements/${engagement.id}/fund`,
    };
  }

  private buildDashboardJobs(state: PlatformState): DashboardJob[] {
    const userNames = new Map(state.users.map((user) => [user.id, user.name]));
    return state.jobs
      .map((job) => ({
        ...job,
        requesterName: userNames.get(job.requesterId) ?? "Unknown requester",
        offerCount: state.offers.filter((offer) => offer.jobId === job.id).length,
      }))
      .sort(byCreatedAt);
  }

  private buildDashboardOffers(state: PlatformState): DashboardOffer[] {
    const userNames = new Map(state.users.map((user) => [user.id, user.name]));
    const jobTitles = new Map(state.jobs.map((job) => [job.id, job.title]));
    return state.offers
      .map((offer) => ({
        ...offer,
        specialistName: userNames.get(offer.specialistId) ?? "Unknown specialist",
        jobTitle: jobTitles.get(offer.jobId) ?? "Unknown job",
      }))
      .sort(byCreatedAt);
  }

  private buildDashboardEngagements(state: PlatformState): DashboardEngagement[] {
    const userNames = new Map(state.users.map((user) => [user.id, user.name]));
    const jobTitles = new Map(state.jobs.map((job) => [job.id, job.title]));
    return state.engagements
      .map((engagement) => ({
        ...engagement,
        requesterName: userNames.get(engagement.requesterId) ?? "Unknown requester",
        specialistName: userNames.get(engagement.specialistId) ?? "Unknown specialist",
        jobTitle: jobTitles.get(engagement.jobId) ?? "Unknown job",
      }))
      .sort(byCreatedAt);
  }

  private async executeResearch(scenario: BusinessScenario) {
    return this.researchRunner({
      scenario,
      thinkingLevel: (process.env.PI_THINKING_LEVEL as
        | "off"
        | "minimal"
        | "low"
        | "medium"
        | "high"
        | "xhigh"
        | undefined) ?? "medium",
    });
  }

  private async loadScenarioForUser(
    user: PlatformUser,
    scenarioId: string,
  ): Promise<BusinessScenario> {
    const customScenario = await this.store.findResearchScenarioById(scenarioId);
    if (customScenario) {
      if (customScenario.ownerUserId !== user.id) {
        throw new AppError(404, "scenario_not_found", "The requested scenario does not exist.");
      }

      return this.toBusinessScenario(customScenario);
    }

    try {
      return await loadScenario(scenarioId);
    } catch {
      throw new AppError(404, "scenario_not_found", "The requested scenario does not exist.");
    }
  }

  private toBusinessScenario(scenario: PlatformResearchScenario): BusinessScenario {
    return {
      id: scenario.id,
      name: scenario.name,
      summary: scenario.summary,
      geography: scenario.geography,
      businessModel: scenario.businessModel,
      customers: [...scenario.customers],
      needs: [...scenario.needs],
      tags: [...scenario.tags],
    };
  }

  private toTrackedGrant(
    request: PlatformResearchRequest,
    opportunity: FundingOpportunity,
    existingGrants: PlatformTrackedGrant[],
  ): PlatformTrackedGrant {
    const existingGrant = existingGrants.find(
      (candidate) =>
        candidate.title === opportunity.title && candidate.sponsor === opportunity.sponsor,
    );
    const timestamp = now();

    return {
      id: existingGrant?.id ?? makeId("grant"),
      requestId: request.id,
      requesterId: request.requesterId,
      title: opportunity.title,
      sponsor: opportunity.sponsor,
      fundingType: opportunity.fundingType,
      fitScore: opportunity.fitScore,
      whyFit: opportunity.whyFit,
      eligibilityNotes: [...opportunity.eligibilityNotes],
      amountSummary: opportunity.amountSummary,
      deadlineSummary: opportunity.deadlineSummary,
      geography: opportunity.geography,
      status: opportunity.status,
      citations: [...opportunity.citations],
      nextActions: [...opportunity.nextActions],
      queueState: existingGrant?.queueState ?? "active",
      proposalJobId: existingGrant?.proposalJobId ?? null,
      createdAt: existingGrant?.createdAt ?? timestamp,
      updatedAt: timestamp,
    };
  }

  private buildCatalogTags(grant: PlatformTrackedGrant): string[] {
    const tags = [grant.fundingType, grant.geography, grant.status]
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean);

    return [...new Set(tags)];
  }

  private buildDefaultWorkspaceSections(
    documentType: ApplicationDocumentType,
  ): PlatformApplicationWorkspaceSection[] {
    const definitions: Array<{
      key: string;
      title: string;
      prompt?: string;
    }> =
      documentType === "loi"
        ? [
            { key: "organization_profile", title: "Organization profile" },
            { key: "need_statement", title: "Need statement", prompt: "Describe the need and fit." },
          ]
        : [
            { key: "organization_profile", title: "Organization profile" },
            { key: "project_summary", title: "Project summary", prompt: "Describe the proposed work." },
          ];

    return definitions.map((definition, index) => ({
      id: makeId("section"),
      key: definition.key,
      title: definition.title,
      stepName: null,
      prompt: definition.prompt ?? null,
      examples: [],
      validation: { minWords: null, maxWords: null },
      orderIndex: index,
      content: "",
      createdAt: "",
      updatedAt: "",
    }));
  }

  private normalizeSectionDefinitions(
    sections: UpsertGrantApplicationSchemaInput["sections"],
  ) {
    if (!Array.isArray(sections) || sections.length === 0) {
      throw new AppError(400, "invalid_input", "sections must contain at least one section.");
    }

    return sections.map((section) => {
      const validation = section.validation ?? {};
      return {
        id: makeId("section_def"),
        key: requireText(section.key, "sections.key"),
        title: requireText(section.title, "sections.title"),
        stepName: this.normalizeOptionalText(section.stepName),
        prompt: this.normalizeOptionalText(section.prompt),
        examples: Array.isArray(section.examples) ? normalizeTextList(section.examples, "sections.examples") : [],
        validation: {
          minWords:
            typeof validation.minWords === "number" && Number.isFinite(validation.minWords)
              ? validation.minWords
              : null,
          maxWords:
            typeof validation.maxWords === "number" && Number.isFinite(validation.maxWords)
              ? validation.maxWords
              : null,
        },
      };
    });
  }

  private instantiateWorkspaceSections(
    definitions: Array<{
      id: string;
      key: string;
      title: string;
      stepName: string | null;
      prompt: string | null;
      examples: string[];
      validation: { minWords: number | null; maxWords: number | null };
    }>,
    organizationPrefill: PlatformOrganizationPrefill | null,
    grant: PlatformGrantCatalogEntry | null,
    timestamp: string,
  ): PlatformApplicationWorkspaceSection[] {
    return definitions.map((section, index) => ({
      ...section,
      orderIndex: index,
      content: this.prefillWorkspaceSection(section.key, organizationPrefill, grant),
      createdAt: timestamp,
      updatedAt: timestamp,
    }));
  }

  private prefillWorkspaceSection(
    sectionKey: string,
    organizationPrefill: PlatformOrganizationPrefill | null,
    grant: PlatformGrantCatalogEntry | null,
  ): string {
    if (!organizationPrefill) {
      return "";
    }

    if (sectionKey === "organization_profile") {
      const audience = organizationPrefill.targetDemographics.join(", ");
      return [
        `${organizationPrefill.organizationName} is a ${organizationPrefill.organizationType.replaceAll("_", " ")} organization focused on ${organizationPrefill.missionStatement}`,
        audience ? `It primarily serves ${audience}.` : "",
        grant ? `This application targets ${grant.title} from ${grant.sponsor}.` : "",
      ]
        .filter(Boolean)
        .join(" ");
    }

    return "";
  }

  private composeWorkspaceSectionContent(
    section: PlatformApplicationWorkspaceSection,
    organizationPrefill: PlatformOrganizationPrefill | null,
    grant: PlatformGrantCatalogEntry | null,
  ): string {
    const organizationName = organizationPrefill?.organizationName ?? "The organization";
    if (section.key === "project_summary") {
      return `${organizationName} will use ${grant?.title ?? "the selected grant"} to expand project delivery, document measurable outcomes, and align the proposal with ${grant?.sponsor ?? "the funder"} priorities.`;
    }

    if (section.key === "need_statement") {
      return `${organizationName} is positioned to address the stated need because ${organizationPrefill?.missionStatement ?? "it has the relevant operating context"}. This section connects the need to a concrete delivery plan and measurable community outcomes.`;
    }

    return section.content || this.prefillWorkspaceSection(section.key, organizationPrefill, grant);
  }

  private async getScenarioNameMap(
    user: PlatformUser,
    state: PlatformState,
  ): Promise<Map<string, string>> {
    const names = new Map<string, string>();
    const builtInIds = await listScenarioIds();
    const builtInScenarios = await Promise.all(builtInIds.map((scenarioId) => loadScenario(scenarioId)));
    for (const scenario of builtInScenarios) {
      names.set(scenario.id, scenario.name);
    }

    for (const scenario of state.researchScenarios) {
      if (scenario.ownerUserId === user.id) {
        names.set(scenario.id, scenario.name);
      }
    }

    return names;
  }

  private requireRole(user: PlatformUser, role: UserRole): void {
    if (user.role !== role) {
      throw new AppError(403, "forbidden", `${role} permissions are required for this action.`);
    }
  }

  private requireRoleValue(role: UserRole): UserRole {
    if (role !== "requester" && role !== "specialist") {
      throw new AppError(400, "invalid_role", "role must be requester or specialist.");
    }

    return role;
  }

  private requireOrganizationTypeValue(
    organizationType: PlatformOrganization["organizationType"],
  ): PlatformOrganization["organizationType"] {
    switch (organizationType) {
      case "nonprofit":
      case "fiscal_sponsor":
      case "school":
      case "government":
      case "tribal_entity":
      case "for_profit":
      case "other":
        return organizationType;
      default:
        throw new AppError(
          400,
          "invalid_organization_type",
          "organizationType is not recognized.",
        );
    }
  }

  private requireOrganizationOperatingScopeValue(
    operatingScope: PlatformOrganization["operatingScope"],
  ): PlatformOrganization["operatingScope"] {
    switch (operatingScope) {
      case "local":
      case "regional":
      case "national":
      case "international":
        return operatingScope;
      default:
        throw new AppError(
          400,
          "invalid_operating_scope",
          "operatingScope must be local, regional, national, or international.",
        );
    }
  }

  private requireGrantQueueState(queueState: GrantQueueState): GrantQueueState {
    if (queueState !== "active" && queueState !== "inactive") {
      throw new AppError(400, "invalid_queue_state", "queueState must be active or inactive.");
    }

    return queueState;
  }

  private requireApplicationDocumentType(documentType: ApplicationDocumentType): ApplicationDocumentType {
    switch (documentType) {
      case "grant_proposal":
      case "loi":
      case "budget_narrative":
      case "other":
        return documentType;
      default:
        throw new AppError(400, "invalid_document_type", "documentType is not recognized.");
    }
  }

  private requireServiceTargetType(targetType: ServiceTargetType): ServiceTargetType {
    switch (targetType) {
      case "grant_catalog_entry":
      case "application_workspace":
      case "workspace_section":
        return targetType;
      default:
        throw new AppError(400, "invalid_target_type", "targetType is not recognized.");
    }
  }

  private requireSpecialistServiceRole(role: SpecialistServiceRole): SpecialistServiceRole {
    switch (role) {
      case "researcher":
      case "writer":
      case "reviewer":
      case "submission_specialist":
        return role;
      default:
        throw new AppError(400, "invalid_specialist_role", "specialistRole is not recognized.");
    }
  }

  private requireProviderConnectionScope(
    scope: AgentProviderConnectionScope,
  ): AgentProviderConnectionScope {
    switch (scope) {
      case "user":
      case "organization":
        return scope;
      default:
        throw new AppError(400, "invalid_provider_scope", "scope must be user or organization.");
    }
  }

  private requireProviderAuthType(authType: AgentProviderAuthType): AgentProviderAuthType {
    switch (authType) {
      case "byok":
      case "oauth":
        return authType;
      default:
        throw new AppError(400, "invalid_provider_auth_type", "authType must be byok or oauth.");
    }
  }

  private async requireCatalogGrant(grantId: string): Promise<PlatformGrantCatalogEntry> {
    const grant = await this.store.findGrantCatalogEntryById(grantId);
    if (!grant) {
      throw new AppError(404, "catalog_grant_not_found", "The requested catalog grant does not exist.");
    }

    return grant;
  }

  private async isCatalogGrantBookmarked(userId: string, grantId: string): Promise<boolean> {
    const state = await this.store.readState();
    return state.grantBookmarks.some((bookmark) => bookmark.userId === userId && bookmark.grantId === grantId);
  }

  private async requireApplicationTemplateOwner(
    user: PlatformUser,
    templateId: string,
  ): Promise<PlatformApplicationTemplate> {
    const template = await this.store.findApplicationTemplateById(templateId);
    if (!template || template.ownerUserId !== user.id) {
      throw new AppError(404, "application_template_not_found", "The requested template does not exist.");
    }

    return template;
  }

  private async requireApplicationWorkspaceOwner(
    user: PlatformUser,
    workspaceId: string,
  ): Promise<PlatformApplicationWorkspace> {
    const workspace = await this.store.findApplicationWorkspaceById(workspaceId);
    if (!workspace) {
      throw new AppError(404, "application_workspace_not_found", "The requested workspace does not exist.");
    }

    if (workspace.requesterId !== user.id) {
      throw new AppError(403, "forbidden", "You do not have access to this application workspace.");
    }

    return workspace;
  }

  private async requireOrganizationOwner(user: PlatformUser): Promise<PlatformOrganization> {
    const organization = await this.store.findOrganizationByOwnerUserId(user.id);
    if (!organization) {
      throw new AppError(409, "organization_required", "Create an organization profile before using this scope.");
    }

    return organization;
  }

  private async requireProviderConnectionForAction(
    user: PlatformUser,
    connectionId: string,
    targetType: ServiceTargetType,
  ): Promise<PlatformAgentProviderConnection> {
    const connection = await this.store.findAgentProviderConnectionById(connectionId);
    if (!connection) {
      throw new AppError(404, "provider_connection_not_found", "The requested provider connection does not exist.");
    }

    const ownsConnection =
      (connection.scope === "user" && connection.ownerUserId === user.id) ||
      (connection.scope === "organization" &&
        connection.organizationId === (await this.store.findOrganizationByOwnerUserId(user.id))?.id);
    if (!ownsConnection) {
      throw new AppError(403, "forbidden", "You do not have access to this provider connection.");
    }

    if (!connection.allowedArtifactTypes.includes(targetType)) {
      throw new AppError(
        403,
        "provider_connection_forbidden",
        "This provider connection is not allowed to act on the requested artifact type.",
      );
    }

    return connection;
  }

  private async requireServiceTargetOwner(
    user: PlatformUser,
    targetType: ServiceTargetType,
    targetId: string,
  ): Promise<void> {
    if (targetType === "grant_catalog_entry") {
      await this.requireCatalogGrant(targetId);
      return;
    }

    if (targetType === "application_workspace") {
      await this.requireApplicationWorkspaceOwner(user, targetId);
      return;
    }

    const workspaceState = await this.store.readState();
    const ownerWorkspace = workspaceState.applicationWorkspaces.find((workspace) =>
      workspace.requesterId === user.id && workspace.sections.some((section) => section.id === targetId),
    );
    if (!ownerWorkspace) {
      throw new AppError(404, "workspace_section_not_found", "The requested workspace section does not exist.");
    }
  }

  private async requireResearchRequestOwner(
    user: PlatformUser,
    requestId: string,
  ): Promise<PlatformResearchRequest> {
    const request = await this.store.findResearchRequestById(requestId);
    if (!request) {
      throw new AppError(404, "request_not_found", "The requested research request does not exist.");
    }

    if (request.requesterId !== user.id) {
      throw new AppError(403, "forbidden", "You do not have access to this research request.");
    }

    return request;
  }

  private async requireGrantOwner(
    user: PlatformUser,
    grantId: string,
  ): Promise<PlatformTrackedGrant> {
    const grant = await this.store.findTrackedGrantById(grantId);
    if (!grant) {
      throw new AppError(404, "grant_not_found", "The requested grant does not exist.");
    }

    if (grant.requesterId !== user.id) {
      throw new AppError(403, "forbidden", "You do not have access to this grant.");
    }

    return grant;
  }

  private async requireEngagementOwner(user: PlatformUser, engagementId: string): Promise<PlatformEngagement> {
    const engagement = await this.store.findEngagementById(engagementId);
    if (!engagement) {
      throw new AppError(404, "engagement_not_found", "The requested engagement does not exist.");
    }

    if (engagement.requesterId !== user.id) {
      throw new AppError(
        403,
        "forbidden",
        "Only the requester who accepted the offer can fund this engagement.",
      );
    }

    return engagement;
  }

  private async requireEngagementViewer(user: PlatformUser, engagementId: string): Promise<PlatformEngagement> {
    const engagement = await this.store.findEngagementById(engagementId);
    if (!engagement) {
      throw new AppError(404, "engagement_not_found", "The requested engagement does not exist.");
    }

    if (engagement.requesterId !== user.id && engagement.specialistId !== user.id) {
      throw new AppError(403, "forbidden", "You do not have access to this engagement.");
    }

    return engagement;
  }
}
