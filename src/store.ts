// ABOUTME: Persists Grantfinder users, agent tokens, marketplace records, and payments in memory or Postgres.
// ABOUTME: Tests use the in-memory path or an injected pg-compatible adapter while hosted runtime uses DATABASE_URL.

import { createHash } from "node:crypto";

import { Pool, type QueryResult, type QueryResultRow } from "pg";

import type {
  PlatformAgentToken,
  PlatformAgentExecutionRecord,
  PlatformAgentProviderConnection,
  PlatformApplicationTemplate,
  PlatformApplicationWorkspace,
  PlatformProposalContact,
  PlatformProposalFeasibilitySnapshot,
  PlatformProposalOpportunity,
  PlatformProposalOutcome,
  PlatformProposalOutreachEvent,
  PlatformProposalWorkspace,
  PlatformGrantBookmark,
  PlatformGrantApplicationSchema,
  PlatformGrantCatalogEntry,
  PlatformGrantReport,
  PlatformEngagement,
  PlatformJob,
  PlatformOffer,
  PlatformOrganization,
  PlatformOrganizationInvite,
  PlatformOrganizationPersonnel,
  PlatformOrganizationPrefill,
  PlatformResearchActivity,
  PlatformPaymentRecord,
  PlatformResearchRequest,
  PlatformResearchScenario,
  PlatformResearchSteeringNote,
  PlatformRepositoryBinding,
  PlatformRepositoryPublication,
  PlatformState,
  PlatformTrackedGrant,
  PlatformUser,
  RepositoryPublicationStatus,
} from "./platform-types.js";
import { createEmptyPlatformState } from "./platform-types.js";
import { DEFAULT_REPOSITORY_ROOT_PATH } from "./platform-types.js";

interface Queryable {
  query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: readonly unknown[],
  ): Promise<QueryResult<T>>;
}

interface QueryableClient extends Queryable {
  release(): void;
}

interface TransactionalQueryable extends Queryable {
  connect(): Promise<QueryableClient>;
}

interface StoredAgentToken extends PlatformAgentToken {
  tokenHash: string;
}

export interface ApplicationStoreOptions {
  database?: TransactionalQueryable;
  databaseUrl?: string;
  persist?: boolean;
  state?: PlatformState;
}

export interface UpsertUserProfileInput {
  privyUserId: string;
  name: string;
  role: PlatformUser["role"];
  walletAddress: string | null;
  smartWalletAddress: string | null;
}

export interface UpsertOrganizationInput {
  ownerUserId: string;
  name: string;
  website: string | null;
  registrationCountry: string;
  registrationRegion: string | null;
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
  personnel: PlatformOrganizationPersonnel[];
}

export interface CreateAgentTokenResult {
  token: PlatformAgentToken;
  secret: string;
}

function parseJsonText<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string" || !value) {
    return fallback;
  }

  return JSON.parse(value) as T;
}

function isRepositoryPublicationStatus(value: unknown): value is RepositoryPublicationStatus {
  return value === "blocked" || value === "failed" || value === "published";
}

function toRepositoryPublication(value: unknown): PlatformRepositoryPublication | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  return {
    status: isRepositoryPublicationStatus(record.status) ? record.status : "blocked",
    branch: typeof record.branch === "string" ? record.branch : null,
    commitSha: typeof record.commitSha === "string" ? record.commitSha : null,
    pullRequestUrl: typeof record.pullRequestUrl === "string" ? record.pullRequestUrl : null,
    publishedAt: typeof record.publishedAt === "string" ? record.publishedAt : null,
    errorMessage: typeof record.errorMessage === "string" ? record.errorMessage : null,
  };
}

function toRepositoryBinding(value: unknown): PlatformRepositoryBinding | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const rootPath = typeof record.rootPath === "string" && record.rootPath.trim() ? record.rootPath : DEFAULT_REPOSITORY_ROOT_PATH;
  const repositoryUrl = typeof record.repositoryUrl === "string" ? record.repositoryUrl : "";
  const baseBranch = typeof record.baseBranch === "string" ? record.baseBranch : "";
  const privyGitHubAccountId = typeof record.privyGitHubAccountId === "string" ? record.privyGitHubAccountId : "";
  const providerConnectionId = typeof record.providerConnectionId === "string" ? record.providerConnectionId : "";
  const attachedByUserId = typeof record.attachedByUserId === "string" ? record.attachedByUserId : "";
  const attachedAt = typeof record.attachedAt === "string" ? record.attachedAt : "";
  const updatedAt = typeof record.updatedAt === "string" ? record.updatedAt : attachedAt;
  if (!repositoryUrl || !baseBranch || !privyGitHubAccountId || !providerConnectionId || !attachedByUserId || !attachedAt) {
    return null;
  }

  return {
    repositoryUrl,
    baseBranch,
    rootPath,
    privyGitHubAccountId,
    providerConnectionId,
    attachedByUserId,
    attachedAt,
    updatedAt,
    latestPublication: toRepositoryPublication(record.latestPublication),
  };
}

function now(): string {
  return new Date().toISOString();
}

function makeId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`;
}

function hashToken(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

function toUser(row: Record<string, unknown>): PlatformUser {
  return {
    id: String(row.id),
    privyUserId: row.privy_user_id ? String(row.privy_user_id) : null,
    name: String(row.name),
    role: row.role === "specialist" ? "specialist" : "requester",
    walletAddress: row.wallet_address ? String(row.wallet_address) : null,
    smartWalletAddress: row.smart_wallet_address ? String(row.smart_wallet_address) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function toOrganizationInvite(value: unknown): PlatformOrganizationInvite | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const invite = value as Record<string, unknown>;
  const id = typeof invite.id === "string" ? invite.id : "";
  const invitePath = typeof invite.invitePath === "string" ? invite.invitePath : "";
  const createdAt = typeof invite.createdAt === "string" ? invite.createdAt : "";
  if (!id || !invitePath || !createdAt) {
    return null;
  }

  return {
    id,
    invitePath,
    createdAt,
    acceptedAt: typeof invite.acceptedAt === "string" ? invite.acceptedAt : null,
  };
}

function toOrganizationPersonnel(value: unknown): PlatformOrganizationPersonnel {
  const record = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const platformAccessEnabled = Boolean(record.platformAccessEnabled);
  const invite = toOrganizationInvite(record.invite);

  return {
    id: typeof record.id === "string" ? record.id : makeId("person"),
    fullName: typeof record.fullName === "string" ? record.fullName : "",
    roleTitle: typeof record.roleTitle === "string" ? record.roleTitle : "",
    yearsExperience:
      typeof record.yearsExperience === "number" && Number.isFinite(record.yearsExperience)
        ? record.yearsExperience
        : null,
    email: typeof record.email === "string" ? record.email : null,
    userId: typeof record.userId === "string" ? record.userId : null,
    platformAccessEnabled,
    accessState:
      record.accessState === "active"
        ? "active"
        : record.accessState === "invited"
          ? "invited"
          : "none",
    canManageInvites: Boolean(record.canManageInvites) && platformAccessEnabled,
    invite,
  };
}

function toOrganizationPrefill(value: unknown): PlatformOrganizationPrefill | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const organizationName = typeof record.organizationName === "string" ? record.organizationName : "";
  const registrationCountry =
    typeof record.registrationCountry === "string" ? record.registrationCountry : "";
  const missionStatement = typeof record.missionStatement === "string" ? record.missionStatement : "";
  const annualOperatingBudget =
    typeof record.annualOperatingBudget === "string" ? record.annualOperatingBudget : "";
  const capturedAt = typeof record.capturedAt === "string" ? record.capturedAt : "";

  if (!organizationName || !registrationCountry || !missionStatement || !annualOperatingBudget || !capturedAt) {
    return null;
  }

  return {
    organizationName,
    website: typeof record.website === "string" ? record.website : null,
    registrationCountry,
    registrationRegion: typeof record.registrationRegion === "string" ? record.registrationRegion : null,
    organizationType: String(record.organizationType) as PlatformOrganization["organizationType"],
    operatingScope: String(record.operatingScope) as PlatformOrganization["operatingScope"],
    localOperatingAreas: Array.isArray(record.localOperatingAreas)
      ? record.localOperatingAreas.map((entry) => String(entry))
      : [],
    missionStatement,
    programs: Array.isArray(record.programs) ? record.programs.map((entry) => String(entry)) : [],
    targetDemographics: Array.isArray(record.targetDemographics)
      ? record.targetDemographics.map((entry) => String(entry))
      : [],
    thematicAreas: Array.isArray(record.thematicAreas)
      ? record.thematicAreas.map((entry) => String(entry))
      : [],
    annualOperatingBudget,
    strategicPriorities: Array.isArray(record.strategicPriorities)
      ? record.strategicPriorities.map((entry) => String(entry))
      : [],
    capturedAt,
  };
}

function toOrganization(row: Record<string, unknown>): PlatformOrganization {
  return {
    id: String(row.id),
    ownerUserId: String(row.owner_user_id),
    name: String(row.name),
    website: row.website ? String(row.website) : null,
    registrationCountry: String(row.registration_country),
    registrationRegion: row.registration_region ? String(row.registration_region) : null,
    organizationType: String(row.organization_type) as PlatformOrganization["organizationType"],
    operatingScope: String(row.operating_scope) as PlatformOrganization["operatingScope"],
    localOperatingAreas: parseJsonText<string[]>(row.local_operating_areas_json, []),
    missionStatement: String(row.mission_statement),
    programs: parseJsonText<string[]>(row.programs_json, []),
    targetDemographics: parseJsonText<string[]>(row.target_demographics_json, []),
    thematicAreas: parseJsonText<string[]>(row.thematic_areas_json, []),
    annualOperatingBudget: String(row.annual_operating_budget),
    strategicPriorities: parseJsonText<string[]>(row.strategic_priorities_json, []),
    emailUpdatesEnabled: Boolean(row.email_updates_enabled),
    personnel: parseJsonText<unknown[]>(row.personnel_json, []).map((entry) => toOrganizationPersonnel(entry)),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function toAgentToken(row: Record<string, unknown>): PlatformAgentToken {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    label: String(row.label),
    createdAt: String(row.created_at),
    lastUsedAt: row.last_used_at ? String(row.last_used_at) : null,
    revokedAt: row.revoked_at ? String(row.revoked_at) : null,
  };
}

function toJob(row: Record<string, unknown>): PlatformJob {
  return {
    id: String(row.id),
    requesterId: String(row.requester_id),
    type: row.type === "grant_proposal" ? "grant_proposal" : "general",
    grantId: row.grant_id ? String(row.grant_id) : null,
    catalogGrantId: row.catalog_grant_id ? String(row.catalog_grant_id) : null,
    targetType:
      row.target_type === "application_workspace"
        ? "application_workspace"
        : row.target_type === "workspace_section"
          ? "workspace_section"
          : row.target_type === "grant_catalog_entry"
            ? "grant_catalog_entry"
            : row.target_type === "proposal_workspace"
              ? "proposal_workspace"
            : null,
    targetId: row.target_id ? String(row.target_id) : null,
    specialistRole:
      row.specialist_role === "researcher"
        ? "researcher"
        : row.specialist_role === "writer"
          ? "writer"
          : row.specialist_role === "reviewer"
            ? "reviewer"
            : row.specialist_role === "submission_specialist"
              ? "submission_specialist"
              : null,
    title: String(row.title),
    description: String(row.description),
    fundingNeed: String(row.funding_need),
    status: row.status === "matched" ? "matched" : "open",
    createdAt: String(row.created_at),
  };
}

function toOffer(row: Record<string, unknown>): PlatformOffer {
  return {
    id: String(row.id),
    jobId: String(row.job_id),
    specialistId: String(row.specialist_id),
    specialistRole:
      row.specialist_role === "researcher"
        ? "researcher"
        : row.specialist_role === "writer"
          ? "writer"
          : row.specialist_role === "reviewer"
            ? "reviewer"
            : row.specialist_role === "submission_specialist"
              ? "submission_specialist"
              : null,
    message: String(row.message),
    amountUsd: String(row.amount_usd),
    payoutAddress: String(row.payout_address),
    status:
      row.status === "accepted" ? "accepted" : row.status === "rejected" ? "rejected" : "pending",
    createdAt: String(row.created_at),
    acceptedAt: row.accepted_at ? String(row.accepted_at) : null,
  };
}

function toPayment(row: Record<string, unknown>): PlatformPaymentRecord {
  return {
    protocol: "x402",
    amountUsd: String(row.amount_usd),
    network: String(row.network),
    payTo: String(row.pay_to),
    facilitatorUrl: String(row.facilitator_url),
    paymentHeader: row.payment_header ? String(row.payment_header) : null,
    fundedByUserId: String(row.funded_by_user_id),
  };
}

function toEngagement(
  row: Record<string, unknown>,
  payment: PlatformPaymentRecord | null,
): PlatformEngagement {
  return {
    id: String(row.id),
    jobId: String(row.job_id),
    offerId: String(row.offer_id),
    requesterId: String(row.requester_id),
    specialistId: String(row.specialist_id),
    targetType:
      row.target_type === "application_workspace"
        ? "application_workspace"
        : row.target_type === "workspace_section"
          ? "workspace_section"
          : row.target_type === "grant_catalog_entry"
            ? "grant_catalog_entry"
            : row.target_type === "proposal_workspace"
              ? "proposal_workspace"
            : null,
    targetId: row.target_id ? String(row.target_id) : null,
    specialistRole:
      row.specialist_role === "researcher"
        ? "researcher"
        : row.specialist_role === "writer"
          ? "writer"
          : row.specialist_role === "reviewer"
            ? "reviewer"
            : row.specialist_role === "submission_specialist"
              ? "submission_specialist"
              : null,
    amountUsd: String(row.amount_usd),
    payoutAddress: String(row.payout_address),
    status: row.status === "funded" ? "funded" : "pending_funding",
    createdAt: String(row.created_at),
    fundedAt: row.funded_at ? String(row.funded_at) : null,
    payment,
  };
}

function toResearchScenario(row: Record<string, unknown>): PlatformResearchScenario {
  return {
    id: String(row.id),
    ownerUserId: row.owner_user_id ? String(row.owner_user_id) : null,
    sourceType: "custom",
    name: String(row.name),
    summary: String(row.summary),
    geography: String(row.geography),
    businessModel: String(row.business_model),
    customers: parseJsonText<string[]>(row.customers_json, []),
    needs: parseJsonText<string[]>(row.needs_json, []),
    tags: parseJsonText<string[]>(row.tags_json, []),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function toResearchRequest(row: Record<string, unknown>): PlatformResearchRequest {
  return {
    id: String(row.id),
    requesterId: String(row.requester_id),
    scenarioId: String(row.scenario_id),
    sourceCatalogGrantId: row.source_catalog_grant_id ? String(row.source_catalog_grant_id) : null,
    researchFocus: row.research_focus ? String(row.research_focus) : null,
    organizationPrefill: toOrganizationPrefill(row.organization_prefill_json),
    status:
      row.status === "running"
        ? "running"
        : row.status === "completed"
          ? "completed"
          : row.status === "failed"
            ? "failed"
            : "draft",
    runPhase:
      row.run_phase === "briefing"
        ? "briefing"
        : row.run_phase === "searching"
          ? "searching"
          : row.run_phase === "reading"
            ? "reading"
            : row.run_phase === "synthesizing"
              ? "synthesizing"
              : row.run_phase === "publishing"
                ? "publishing"
                : row.run_phase === "completed"
                  ? "completed"
                  : row.run_phase === "failed"
                    ? "failed"
                    : "idle",
    progressSummary: row.progress_summary ? String(row.progress_summary) : null,
    runStartedAt: row.run_started_at ? String(row.run_started_at) : null,
    latestBrief: parseJsonText(row.brief_json, null),
    latestReport: parseJsonText(row.report_json, null),
    errorMessage: row.error_message ? String(row.error_message) : null,
    activity: parseJsonText<PlatformResearchActivity[]>(row.activity_json, []),
    steeringNotes: parseJsonText<PlatformResearchSteeringNote[]>(row.steering_json, []),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    lastRunAt: row.last_run_at ? String(row.last_run_at) : null,
  };
}

function toTrackedGrant(row: Record<string, unknown>): PlatformTrackedGrant {
  return {
    id: String(row.id),
    requestId: String(row.request_id),
    requesterId: String(row.requester_id),
    catalogGrantId: row.catalog_grant_id ? String(row.catalog_grant_id) : null,
    title: String(row.title),
    sponsor: String(row.sponsor),
    fundingType: String(row.funding_type),
    fitScore: Number(row.fit_score),
    whyFit: String(row.why_fit),
    eligibilityNotes: parseJsonText<string[]>(row.eligibility_notes_json, []),
    amountSummary: String(row.amount_summary),
    deadlineSummary: String(row.deadline_summary),
    geography: String(row.geography),
    status: String(row.status),
    citations: parseJsonText<string[]>(row.citations_json, []),
    nextActions: parseJsonText<string[]>(row.next_actions_json, []),
    queueState: row.queue_state === "inactive" ? "inactive" : "active",
    repositoryBinding: toRepositoryBinding(parseJsonText(row.repository_binding_json, null)),
    proposalWorkspaceId: row.proposal_workspace_id ? String(row.proposal_workspace_id) : null,
    proposalJobId: row.proposal_job_id ? String(row.proposal_job_id) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function toGrantReport(row: Record<string, unknown>): PlatformGrantReport {
  return {
    id: String(row.id),
    requestId: String(row.request_id),
    requesterId: String(row.requester_id),
    businessCaseId: String(row.business_case_id),
    executiveSummary: String(row.executive_summary),
    searchSummary: String(row.search_summary),
    opportunities: parseJsonText(row.opportunities_json, []),
    rejectedLeads: parseJsonText(row.rejected_leads_json, []),
    nextActions: parseJsonText(row.next_actions_json, []),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function toGrantCatalogEntry(row: Record<string, unknown>): PlatformGrantCatalogEntry {
  return {
    id: String(row.id),
    createdByUserId: String(row.created_by_user_id),
    sourceType:
      row.source_type === "research"
        ? "research"
        :
      row.source_type === "curated"
        ? "curated"
        : "promoted",
    sourceGrantId: row.source_grant_id ? String(row.source_grant_id) : null,
    sourceReportId: row.source_report_id ? String(row.source_report_id) : null,
    lastResearchRequestId: row.last_research_request_id ? String(row.last_research_request_id) : null,
    title: String(row.title),
    sponsor: String(row.sponsor),
    fundingType: String(row.funding_type),
    fitScore: Number(row.fit_score),
    whyFit: String(row.why_fit),
    eligibilityNotes: parseJsonText<string[]>(row.eligibility_notes_json, []),
    amountSummary: String(row.amount_summary),
    deadlineSummary: String(row.deadline_summary),
    geography: String(row.geography),
    status: String(row.status),
    citations: parseJsonText<string[]>(row.citations_json, []),
    nextActions: parseJsonText<string[]>(row.next_actions_json, []),
    tags: parseJsonText<string[]>(row.tags_json, []),
    repositoryBinding: toRepositoryBinding(parseJsonText(row.repository_binding_json, null)),
    provenanceNotes: row.provenance_notes ? String(row.provenance_notes) : null,
    freshnessNotes: row.freshness_notes ? String(row.freshness_notes) : null,
    pursuitNotes: row.pursuit_notes ? String(row.pursuit_notes) : null,
    lastValidatedAt: row.last_validated_at ? String(row.last_validated_at) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function toGrantBookmark(row: Record<string, unknown>): PlatformGrantBookmark {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    grantId: String(row.grant_catalog_entry_id),
    createdAt: String(row.created_at),
  };
}

function toGrantApplicationSchema(row: Record<string, unknown>): PlatformGrantApplicationSchema {
  return {
    id: String(row.id),
    catalogGrantId: String(row.catalog_grant_id),
    name: String(row.name),
    documentType:
      row.document_type === "loi"
        ? "loi"
        : row.document_type === "budget_narrative"
          ? "budget_narrative"
          : row.document_type === "other"
            ? "other"
            : "grant_proposal",
    sections: parseJsonText(row.sections_json, []),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function toApplicationTemplate(row: Record<string, unknown>): PlatformApplicationTemplate {
  return {
    id: String(row.id),
    ownerUserId: String(row.owner_user_id),
    name: String(row.name),
    documentType:
      row.document_type === "loi"
        ? "loi"
        : row.document_type === "budget_narrative"
          ? "budget_narrative"
          : row.document_type === "other"
            ? "other"
            : "grant_proposal",
    sections: parseJsonText(row.sections_json, []),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function toApplicationWorkspace(row: Record<string, unknown>): PlatformApplicationWorkspace {
  return {
    id: String(row.id),
    requesterId: String(row.requester_id),
    catalogGrantId: row.catalog_grant_id ? String(row.catalog_grant_id) : null,
    templateId: row.template_id ? String(row.template_id) : null,
    organizationPrefill: toOrganizationPrefill(row.organization_prefill_json),
    documentType:
      row.document_type === "loi"
        ? "loi"
        : row.document_type === "budget_narrative"
          ? "budget_narrative"
          : row.document_type === "other"
            ? "other"
            : "grant_proposal",
    title: String(row.title),
    state: row.state === "proposal" ? "proposal" : "draft",
    sections: parseJsonText(row.sections_json, []),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    finalizedAt: row.finalized_at ? String(row.finalized_at) : null,
  };
}

function toProposalOpportunity(value: unknown): PlatformProposalOpportunity {
  const record = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    sourceType:
      record.sourceType === "manual"
        ? "manual"
        : record.sourceType === "catalog_grant"
          ? "catalog_grant"
          : "tracked_grant",
    title: typeof record.title === "string" ? record.title : "",
    sponsor: typeof record.sponsor === "string" ? record.sponsor : "",
    fundingType: typeof record.fundingType === "string" ? record.fundingType : "",
    amountSummary: typeof record.amountSummary === "string" ? record.amountSummary : null,
    deadlineSummary: typeof record.deadlineSummary === "string" ? record.deadlineSummary : null,
    geography: typeof record.geography === "string" ? record.geography : null,
    sourceUrl: typeof record.sourceUrl === "string" ? record.sourceUrl : null,
    notes: typeof record.notes === "string" ? record.notes : null,
  };
}

function toProposalFeasibilitySnapshot(value: unknown): PlatformProposalFeasibilitySnapshot | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const verdict = typeof record.verdict === "string" ? record.verdict : "";
  const recommendedNextStep =
    typeof record.recommendedNextStep === "string" ? record.recommendedNextStep : "";
  const updatedAt = typeof record.updatedAt === "string" ? record.updatedAt : "";
  if (!verdict || !recommendedNextStep || !updatedAt) {
    return null;
  }

  return {
    verdict,
    confidence: record.confidence === "low" ? "low" : record.confidence === "medium" ? "medium" : "high",
    blockers: Array.isArray(record.blockers) ? record.blockers.map((entry) => String(entry)) : [],
    assumptions: Array.isArray(record.assumptions) ? record.assumptions.map((entry) => String(entry)) : [],
    requiredDocuments: Array.isArray(record.requiredDocuments)
      ? record.requiredDocuments.map((entry) => String(entry))
      : [],
    recommendedNextStep,
    updatedAt,
  };
}

function toProposalContact(value: unknown): PlatformProposalContact {
  const record = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    id: typeof record.id === "string" ? record.id : makeId("contact"),
    name: typeof record.name === "string" ? record.name : "",
    roleTitle: typeof record.roleTitle === "string" ? record.roleTitle : null,
    email: typeof record.email === "string" ? record.email : null,
    phone: typeof record.phone === "string" ? record.phone : null,
    organization: typeof record.organization === "string" ? record.organization : null,
    notes: typeof record.notes === "string" ? record.notes : null,
    createdAt: typeof record.createdAt === "string" ? record.createdAt : now(),
    updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : now(),
  };
}

function toProposalOutreachEvent(value: unknown): PlatformProposalOutreachEvent {
  const record = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    id: typeof record.id === "string" ? record.id : makeId("outreach"),
    kind:
      record.kind === "call"
        ? "call"
        : record.kind === "meeting"
          ? "meeting"
          : record.kind === "note"
            ? "note"
            : record.kind === "other"
              ? "other"
              : "email",
    direction: record.direction === "inbound" ? "inbound" : "outbound",
    subject: typeof record.subject === "string" ? record.subject : null,
    summary: typeof record.summary === "string" ? record.summary : "",
    occurredAt: typeof record.occurredAt === "string" ? record.occurredAt : now(),
    createdAt: typeof record.createdAt === "string" ? record.createdAt : now(),
  };
}

function toProposalOutcome(value: unknown): PlatformProposalOutcome | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const summary = typeof record.summary === "string" ? record.summary : "";
  const recordedAt = typeof record.recordedAt === "string" ? record.recordedAt : "";
  if (!summary || !recordedAt) {
    return null;
  }

  return {
    status:
      record.status === "awarded"
        ? "awarded"
        : record.status === "declined"
          ? "declined"
          : record.status === "no_bid"
            ? "no_bid"
            : "submitted",
    summary,
    recordedAt,
  };
}

function toProposalWorkspace(row: Record<string, unknown>): PlatformProposalWorkspace {
  return {
    id: String(row.id),
    ownerUserId: String(row.owner_user_id),
    organizationId: row.organization_id ? String(row.organization_id) : null,
    trackedGrantId: row.tracked_grant_id ? String(row.tracked_grant_id) : null,
    catalogGrantId: row.catalog_grant_id ? String(row.catalog_grant_id) : null,
    repositoryBinding: toRepositoryBinding(parseJsonText(row.repository_binding_json, null)),
    opportunity: toProposalOpportunity(parseJsonText(row.opportunity_json, null)),
    stage:
      row.stage === "drafting"
        ? "drafting"
        : row.stage === "outreach"
          ? "outreach"
          : row.stage === "submitted"
            ? "submitted"
            : row.stage === "awarded"
              ? "awarded"
              : row.stage === "declined"
                ? "declined"
                : row.stage === "no_bid"
                  ? "no_bid"
                  : "qualifying",
    summary: String(row.summary ?? ""),
    nextSteps: parseJsonText<string[]>(row.next_steps_json, []),
    openQuestions: parseJsonText<string[]>(row.open_questions_json, []),
    primaryApplicationWorkspaceId: row.primary_application_workspace_id
      ? String(row.primary_application_workspace_id)
      : null,
    feasibilitySnapshot: toProposalFeasibilitySnapshot(parseJsonText(row.feasibility_snapshot_json, null)),
    contacts: parseJsonText<unknown[]>(row.contacts_json, []).map((entry) => toProposalContact(entry)),
    outreachEvents: parseJsonText<unknown[]>(row.outreach_events_json, []).map((entry) =>
      toProposalOutreachEvent(entry),
    ),
    outcome: toProposalOutcome(parseJsonText(row.outcome_json, null)),
    proposalJobId: row.proposal_job_id ? String(row.proposal_job_id) : null,
    engagementId: row.engagement_id ? String(row.engagement_id) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function toAgentProviderConnection(row: Record<string, unknown>): PlatformAgentProviderConnection {
  return {
    id: String(row.id),
    scope: row.scope === "organization" ? "organization" : "user",
    ownerUserId: row.owner_user_id ? String(row.owner_user_id) : null,
    organizationId: row.organization_id ? String(row.organization_id) : null,
    provider: String(row.provider),
    label: String(row.label),
    authType: row.auth_type === "oauth" ? "oauth" : "byok",
    allowedArtifactTypes: parseJsonText(row.allowed_artifact_types_json, []),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function toAgentExecutionRecord(row: Record<string, unknown>): PlatformAgentExecutionRecord {
  return {
    id: String(row.id),
    actorUserId: String(row.actor_user_id),
    providerConnectionId: String(row.provider_connection_id),
    targetType:
      row.target_type === "tracked_grant"
        ? "tracked_grant"
        : row.target_type === "grant_catalog_entry"
          ? "grant_catalog_entry"
        : row.target_type === "application_workspace"
          ? "application_workspace"
          : row.target_type === "proposal_workspace"
            ? "proposal_workspace"
          : "workspace_section",
    targetId: String(row.target_id),
    action: String(row.action),
    outputText: String(row.output_text),
    createdAt: String(row.created_at),
  };
}

class MemoryStore {
  private readonly state: PlatformState;
  private readonly agentTokenSecrets = new Map<string, StoredAgentToken>();

  constructor(initialState: PlatformState | undefined) {
    this.state = initialState ? structuredClone(initialState) : createEmptyPlatformState();
  }

  async readState(): Promise<PlatformState> {
    return structuredClone(this.state);
  }

  async findUserById(userId: string): Promise<PlatformUser | null> {
    return this.state.users.find((user) => user.id === userId) ?? null;
  }

  async findUserByPrivyUserId(privyUserId: string): Promise<PlatformUser | null> {
    return this.state.users.find((user) => user.privyUserId === privyUserId) ?? null;
  }

  async upsertUserProfile(input: UpsertUserProfileInput): Promise<PlatformUser> {
    const existing = this.state.users.find((user) => user.privyUserId === input.privyUserId);
    const timestamp = now();

    if (existing) {
      existing.name = input.name;
      existing.role = input.role;
      existing.walletAddress = input.walletAddress;
      existing.smartWalletAddress = input.smartWalletAddress;
      existing.updatedAt = timestamp;
      return structuredClone(existing);
    }

    const user: PlatformUser = {
      id: makeId("user"),
      privyUserId: input.privyUserId,
      name: input.name,
      role: input.role,
      walletAddress: input.walletAddress,
      smartWalletAddress: input.smartWalletAddress,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    this.state.users.push(user);
    return structuredClone(user);
  }

  async findOrganizationByOwnerUserId(ownerUserId: string): Promise<PlatformOrganization | null> {
    return this.state.organizations.find((organization) => organization.ownerUserId === ownerUserId) ?? null;
  }

  async upsertOrganization(input: UpsertOrganizationInput): Promise<PlatformOrganization> {
    const existing = this.state.organizations.find(
      (organization) => organization.ownerUserId === input.ownerUserId,
    );
    const timestamp = now();

    if (existing) {
      existing.name = input.name;
      existing.website = input.website;
      existing.registrationCountry = input.registrationCountry;
      existing.registrationRegion = input.registrationRegion;
      existing.organizationType = input.organizationType;
      existing.operatingScope = input.operatingScope;
      existing.localOperatingAreas = [...input.localOperatingAreas];
      existing.missionStatement = input.missionStatement;
      existing.programs = [...input.programs];
      existing.targetDemographics = [...input.targetDemographics];
      existing.thematicAreas = [...input.thematicAreas];
      existing.annualOperatingBudget = input.annualOperatingBudget;
      existing.strategicPriorities = [...input.strategicPriorities];
      existing.emailUpdatesEnabled = input.emailUpdatesEnabled;
      existing.personnel = structuredClone(input.personnel);
      existing.updatedAt = timestamp;
      return structuredClone(existing);
    }

    const organization: PlatformOrganization = {
      id: makeId("organization"),
      ownerUserId: input.ownerUserId,
      name: input.name,
      website: input.website,
      registrationCountry: input.registrationCountry,
      registrationRegion: input.registrationRegion,
      organizationType: input.organizationType,
      operatingScope: input.operatingScope,
      localOperatingAreas: [...input.localOperatingAreas],
      missionStatement: input.missionStatement,
      programs: [...input.programs],
      targetDemographics: [...input.targetDemographics],
      thematicAreas: [...input.thematicAreas],
      annualOperatingBudget: input.annualOperatingBudget,
      strategicPriorities: [...input.strategicPriorities],
      emailUpdatesEnabled: input.emailUpdatesEnabled,
      personnel: structuredClone(input.personnel),
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    this.state.organizations.push(organization);
    return structuredClone(organization);
  }

  async createAgentToken(userId: string, label: string): Promise<CreateAgentTokenResult> {
    const secret = `gfpat_${crypto.randomUUID().replaceAll("-", "")}${crypto.randomUUID().replaceAll("-", "")}`;
    const token: PlatformAgentToken = {
      id: makeId("token"),
      userId,
      label,
      createdAt: now(),
      lastUsedAt: null,
      revokedAt: null,
    };

    this.state.agentTokens.push(token);
    this.agentTokenSecrets.set(hashToken(secret), { ...token, tokenHash: hashToken(secret) });

    return {
      token: structuredClone(token),
      secret,
    };
  }

  async listAgentTokens(userId: string): Promise<PlatformAgentToken[]> {
    return this.state.agentTokens
      .filter((token) => token.userId === userId)
      .map((token) => structuredClone(token));
  }

  async revokeAgentToken(userId: string, tokenId: string): Promise<void> {
    const token = this.state.agentTokens.find((candidate) => candidate.id === tokenId && candidate.userId === userId);
    if (!token) {
      return;
    }

    token.revokedAt = now();
  }

  async getUserByAgentToken(secret: string): Promise<PlatformUser | null> {
    const record = this.agentTokenSecrets.get(hashToken(secret));
    if (!record || record.revokedAt) {
      return null;
    }

    const token = this.state.agentTokens.find((candidate) => candidate.id === record.id);
    if (token) {
      token.lastUsedAt = now();
    }

    return this.state.users.find((user) => user.id === record.userId) ?? null;
  }

  async createJob(job: PlatformJob): Promise<PlatformJob> {
    this.state.jobs.push(structuredClone(job));
    return structuredClone(job);
  }

  async saveJob(job: PlatformJob): Promise<PlatformJob> {
    const index = this.state.jobs.findIndex((candidate) => candidate.id === job.id);
    if (index === -1) {
      this.state.jobs.push(structuredClone(job));
      return structuredClone(job);
    }

    this.state.jobs[index] = structuredClone(job);
    return structuredClone(job);
  }

  async findJobById(jobId: string): Promise<PlatformJob | null> {
    return this.state.jobs.find((job) => job.id === jobId) ?? null;
  }

  async createOffer(offer: PlatformOffer): Promise<PlatformOffer> {
    this.state.offers.push(structuredClone(offer));
    return structuredClone(offer);
  }

  async findOfferById(offerId: string): Promise<PlatformOffer | null> {
    return this.state.offers.find((offer) => offer.id === offerId) ?? null;
  }

  async acceptOffer(requesterId: string, offerId: string): Promise<PlatformEngagement | null> {
    const existing = this.state.engagements.find((engagement) => engagement.offerId === offerId);
    if (existing) {
      return structuredClone(existing);
    }

    const offer = this.state.offers.find((candidate) => candidate.id === offerId);
    if (!offer) {
      return null;
    }

    const job = this.state.jobs.find((candidate) => candidate.id === offer.jobId);
    if (!job || job.requesterId !== requesterId) {
      return null;
    }

    offer.status = "accepted";
    offer.acceptedAt = now();
    job.status = "matched";

    for (const otherOffer of this.state.offers) {
      if (otherOffer.jobId === job.id && otherOffer.id !== offer.id && otherOffer.status === "pending") {
        otherOffer.status = "rejected";
      }
    }

      const engagement: PlatformEngagement = {
        id: makeId("engagement"),
        jobId: job.id,
        offerId: offer.id,
      requesterId,
      specialistId: offer.specialistId,
      targetType: job.targetType,
      targetId: job.targetId,
      specialistRole: offer.specialistRole ?? job.specialistRole,
      amountUsd: offer.amountUsd,
      payoutAddress: offer.payoutAddress,
      status: "pending_funding",
      createdAt: now(),
      fundedAt: null,
      payment: null,
    };

    this.state.engagements.push(engagement);
    return structuredClone(engagement);
  }

  async findEngagementById(engagementId: string): Promise<PlatformEngagement | null> {
    return this.state.engagements.find((engagement) => engagement.id === engagementId) ?? null;
  }

  async fundEngagement(
    engagementId: string,
    payment: PlatformPaymentRecord,
  ): Promise<PlatformEngagement | null> {
    const engagement = this.state.engagements.find((candidate) => candidate.id === engagementId);
    if (!engagement) {
      return null;
    }

    engagement.status = "funded";
    engagement.fundedAt = now();
    engagement.payment = payment;
    return structuredClone(engagement);
  }

  async createResearchScenario(scenario: PlatformResearchScenario): Promise<PlatformResearchScenario> {
    this.state.researchScenarios.push(structuredClone(scenario));
    return structuredClone(scenario);
  }

  async findResearchScenarioById(scenarioId: string): Promise<PlatformResearchScenario | null> {
    return this.state.researchScenarios.find((scenario) => scenario.id === scenarioId) ?? null;
  }

  async createResearchRequest(request: PlatformResearchRequest): Promise<PlatformResearchRequest> {
    this.state.researchRequests.push(structuredClone(request));
    return structuredClone(request);
  }

  async findResearchRequestById(requestId: string): Promise<PlatformResearchRequest | null> {
    return this.state.researchRequests.find((request) => request.id === requestId) ?? null;
  }

  async saveResearchRequest(request: PlatformResearchRequest): Promise<PlatformResearchRequest> {
    const index = this.state.researchRequests.findIndex((candidate) => candidate.id === request.id);
    if (index === -1) {
      this.state.researchRequests.push(structuredClone(request));
      return structuredClone(request);
    }

    this.state.researchRequests[index] = structuredClone(request);
    return structuredClone(request);
  }

  async replaceTrackedGrants(
    requestId: string,
    grants: PlatformTrackedGrant[],
  ): Promise<PlatformTrackedGrant[]> {
    this.state.trackedGrants = this.state.trackedGrants.filter((grant) => grant.requestId !== requestId);
    this.state.trackedGrants.push(...structuredClone(grants));
    return structuredClone(grants);
  }

  async findTrackedGrantById(grantId: string): Promise<PlatformTrackedGrant | null> {
    return this.state.trackedGrants.find((grant) => grant.id === grantId) ?? null;
  }

  async saveTrackedGrant(grant: PlatformTrackedGrant): Promise<PlatformTrackedGrant> {
    const index = this.state.trackedGrants.findIndex((candidate) => candidate.id === grant.id);
    if (index === -1) {
      this.state.trackedGrants.push(structuredClone(grant));
      return structuredClone(grant);
    }

    this.state.trackedGrants[index] = structuredClone(grant);
    return structuredClone(grant);
  }

  async findGrantReportByRequestId(requestId: string): Promise<PlatformGrantReport | null> {
    return this.state.grantReports.find((report) => report.requestId === requestId) ?? null;
  }

  async upsertGrantReport(report: PlatformGrantReport): Promise<PlatformGrantReport> {
    const index = this.state.grantReports.findIndex((candidate) => candidate.requestId === report.requestId);
    if (index === -1) {
      this.state.grantReports.push(structuredClone(report));
      return structuredClone(report);
    }

    this.state.grantReports[index] = structuredClone(report);
    return structuredClone(report);
  }

  async findGrantCatalogEntryById(grantId: string): Promise<PlatformGrantCatalogEntry | null> {
    return this.state.grantCatalogEntries.find((grant) => grant.id === grantId) ?? null;
  }

  async findGrantCatalogEntryBySourceGrantId(
    sourceGrantId: string,
  ): Promise<PlatformGrantCatalogEntry | null> {
    return this.state.grantCatalogEntries.find((grant) => grant.sourceGrantId === sourceGrantId) ?? null;
  }

  async saveGrantCatalogEntry(grant: PlatformGrantCatalogEntry): Promise<PlatformGrantCatalogEntry> {
    const index = this.state.grantCatalogEntries.findIndex((candidate) => candidate.id === grant.id);
    if (index === -1) {
      this.state.grantCatalogEntries.push(structuredClone(grant));
      return structuredClone(grant);
    }

    this.state.grantCatalogEntries[index] = structuredClone(grant);
    return structuredClone(grant);
  }

  async setGrantBookmark(userId: string, grantId: string, bookmarked: boolean): Promise<boolean> {
    const index = this.state.grantBookmarks.findIndex(
      (bookmark) => bookmark.userId === userId && bookmark.grantId === grantId,
    );

    if (bookmarked) {
      if (index === -1) {
        this.state.grantBookmarks.push({
          id: makeId("bookmark"),
          userId,
          grantId,
          createdAt: now(),
        });
      }
      return true;
    }

    if (index !== -1) {
      this.state.grantBookmarks.splice(index, 1);
    }

    return false;
  }

  async findGrantApplicationSchemaByCatalogGrantId(
    catalogGrantId: string,
  ): Promise<PlatformGrantApplicationSchema | null> {
    return this.state.grantApplicationSchemas.find((schema) => schema.catalogGrantId === catalogGrantId) ?? null;
  }

  async upsertGrantApplicationSchema(
    schema: PlatformGrantApplicationSchema,
  ): Promise<PlatformGrantApplicationSchema> {
    const index = this.state.grantApplicationSchemas.findIndex(
      (candidate) => candidate.catalogGrantId === schema.catalogGrantId,
    );
    if (index === -1) {
      this.state.grantApplicationSchemas.push(structuredClone(schema));
      return structuredClone(schema);
    }

    this.state.grantApplicationSchemas[index] = structuredClone(schema);
    return structuredClone(schema);
  }

  async createApplicationTemplate(template: PlatformApplicationTemplate): Promise<PlatformApplicationTemplate> {
    this.state.applicationTemplates.push(structuredClone(template));
    return structuredClone(template);
  }

  async findApplicationTemplateById(templateId: string): Promise<PlatformApplicationTemplate | null> {
    return this.state.applicationTemplates.find((template) => template.id === templateId) ?? null;
  }

      async createApplicationWorkspace(workspace: PlatformApplicationWorkspace): Promise<PlatformApplicationWorkspace> {
    this.state.applicationWorkspaces.push(structuredClone(workspace));
    return structuredClone(workspace);
  }

  async findApplicationWorkspaceById(workspaceId: string): Promise<PlatformApplicationWorkspace | null> {
    return this.state.applicationWorkspaces.find((workspace) => workspace.id === workspaceId) ?? null;
  }

  async saveApplicationWorkspace(workspace: PlatformApplicationWorkspace): Promise<PlatformApplicationWorkspace> {
    const index = this.state.applicationWorkspaces.findIndex((candidate) => candidate.id === workspace.id);
    if (index === -1) {
      this.state.applicationWorkspaces.push(structuredClone(workspace));
      return structuredClone(workspace);
    }

    this.state.applicationWorkspaces[index] = structuredClone(workspace);
    return structuredClone(workspace);
  }

  async createProposalWorkspace(workspace: PlatformProposalWorkspace): Promise<PlatformProposalWorkspace> {
    this.state.proposalWorkspaces.push(structuredClone(workspace));
    return structuredClone(workspace);
  }

  async findProposalWorkspaceById(workspaceId: string): Promise<PlatformProposalWorkspace | null> {
    return this.state.proposalWorkspaces.find((workspace) => workspace.id === workspaceId) ?? null;
  }

  async findProposalWorkspaceByTrackedGrantId(grantId: string): Promise<PlatformProposalWorkspace | null> {
    return this.state.proposalWorkspaces.find((workspace) => workspace.trackedGrantId === grantId) ?? null;
  }

  async saveProposalWorkspace(workspace: PlatformProposalWorkspace): Promise<PlatformProposalWorkspace> {
    const index = this.state.proposalWorkspaces.findIndex((candidate) => candidate.id === workspace.id);
    if (index === -1) {
      this.state.proposalWorkspaces.push(structuredClone(workspace));
      return structuredClone(workspace);
    }

    this.state.proposalWorkspaces[index] = structuredClone(workspace);
    return structuredClone(workspace);
  }

  async createAgentProviderConnection(
    connection: PlatformAgentProviderConnection,
  ): Promise<PlatformAgentProviderConnection> {
    this.state.agentProviderConnections.push(structuredClone(connection));
    return structuredClone(connection);
  }

  async findAgentProviderConnectionById(connectionId: string): Promise<PlatformAgentProviderConnection | null> {
    return this.state.agentProviderConnections.find((connection) => connection.id === connectionId) ?? null;
  }

  async createAgentExecutionRecord(record: PlatformAgentExecutionRecord): Promise<PlatformAgentExecutionRecord> {
    this.state.agentExecutionRecords.push(structuredClone(record));
    return structuredClone(record);
  }
}

class PostgresStore {
  private readonly database: TransactionalQueryable;

  constructor(database: TransactionalQueryable) {
    this.database = database;
  }

  async readState(): Promise<PlatformState> {
    await this.ensureSchema();
    const [
      users,
      organizations,
      agentTokens,
      jobs,
      offers,
      engagements,
      payments,
      researchScenarios,
      researchRequests,
      trackedGrants,
      grantReports,
      grantCatalogEntries,
      grantBookmarks,
      grantApplicationSchemas,
      applicationTemplates,
      applicationWorkspaces,
      proposalWorkspaces,
      agentProviderConnections,
      agentExecutionRecords,
    ] =
      await Promise.all([
        this.database.query("select * from users order by created_at desc"),
        this.database.query("select * from organizations order by created_at desc"),
        this.database.query(
          "select id, user_id, label, created_at, last_used_at, revoked_at from agent_tokens order by created_at desc",
        ),
        this.database.query("select * from jobs order by created_at desc"),
        this.database.query("select * from offers order by created_at desc"),
        this.database.query("select * from engagements order by created_at desc"),
        this.database.query("select * from payments"),
        this.database.query("select * from research_scenarios order by created_at desc"),
        this.database.query("select * from research_requests order by created_at desc"),
        this.database.query("select * from tracked_grants order by created_at desc"),
        this.database.query("select * from grant_reports order by created_at desc"),
        this.database.query("select * from grant_catalog_entries order by created_at desc"),
        this.database.query("select * from grant_bookmarks order by created_at desc"),
        this.database.query("select * from grant_application_schemas order by created_at desc"),
        this.database.query("select * from application_templates order by created_at desc"),
        this.database.query("select * from application_workspaces order by created_at desc"),
        this.database.query("select * from proposal_workspaces order by created_at desc"),
        this.database.query("select * from agent_provider_connections order by created_at desc"),
        this.database.query("select * from agent_execution_records order by created_at desc"),
      ]);

    const paymentsByEngagement = new Map<string, PlatformPaymentRecord>();
    for (const row of payments.rows as Record<string, unknown>[]) {
      paymentsByEngagement.set(String(row.engagement_id), toPayment(row));
    }

    return {
      users: (users.rows as Record<string, unknown>[]).map(toUser),
      organizations: (organizations.rows as Record<string, unknown>[]).map(toOrganization),
      agentTokens: (agentTokens.rows as Record<string, unknown>[]).map(toAgentToken),
      jobs: (jobs.rows as Record<string, unknown>[]).map(toJob),
      offers: (offers.rows as Record<string, unknown>[]).map(toOffer),
      engagements: (engagements.rows as Record<string, unknown>[]).map((row) =>
        toEngagement(row, paymentsByEngagement.get(String(row.id)) ?? null),
      ),
      researchScenarios: (researchScenarios.rows as Record<string, unknown>[]).map(toResearchScenario),
      researchRequests: (researchRequests.rows as Record<string, unknown>[]).map(toResearchRequest),
      trackedGrants: (trackedGrants.rows as Record<string, unknown>[]).map(toTrackedGrant),
      grantReports: (grantReports.rows as Record<string, unknown>[]).map(toGrantReport),
      grantCatalogEntries: (grantCatalogEntries.rows as Record<string, unknown>[]).map(toGrantCatalogEntry),
      grantBookmarks: (grantBookmarks.rows as Record<string, unknown>[]).map(toGrantBookmark),
      grantApplicationSchemas: (grantApplicationSchemas.rows as Record<string, unknown>[]).map(
        toGrantApplicationSchema,
      ),
      applicationTemplates: (applicationTemplates.rows as Record<string, unknown>[]).map(toApplicationTemplate),
      applicationWorkspaces: (applicationWorkspaces.rows as Record<string, unknown>[]).map(
        toApplicationWorkspace,
      ),
      proposalWorkspaces: (proposalWorkspaces.rows as Record<string, unknown>[]).map(toProposalWorkspace),
      agentProviderConnections: (agentProviderConnections.rows as Record<string, unknown>[]).map(
        toAgentProviderConnection,
      ),
      agentExecutionRecords: (agentExecutionRecords.rows as Record<string, unknown>[]).map(
        toAgentExecutionRecord,
      ),
    };
  }

  async findUserById(userId: string): Promise<PlatformUser | null> {
    await this.ensureSchema();
    const result = await this.database.query("select * from users where id = $1 limit 1", [userId]);
    return result.rows[0] ? toUser(result.rows[0] as Record<string, unknown>) : null;
  }

  async findUserByPrivyUserId(privyUserId: string): Promise<PlatformUser | null> {
    await this.ensureSchema();
    const result = await this.database.query("select * from users where privy_user_id = $1 limit 1", [privyUserId]);
    return result.rows[0] ? toUser(result.rows[0] as Record<string, unknown>) : null;
  }

  async upsertUserProfile(input: UpsertUserProfileInput): Promise<PlatformUser> {
    await this.ensureSchema();
    const timestamp = now();
    const result = await this.database.query(
      `insert into users (
        id,
        privy_user_id,
        name,
        role,
        wallet_address,
        smart_wallet_address,
        created_at,
        updated_at
      ) values ($1, $2, $3, $4, $5, $6, $7, $7)
      on conflict (privy_user_id)
      do update set
        name = excluded.name,
        role = excluded.role,
        wallet_address = excluded.wallet_address,
        smart_wallet_address = excluded.smart_wallet_address,
        updated_at = excluded.updated_at
      returning *`,
      [
        makeId("user"),
        input.privyUserId,
        input.name,
        input.role,
        input.walletAddress,
        input.smartWalletAddress,
        timestamp,
      ],
    );

    return toUser(result.rows[0] as Record<string, unknown>);
  }

  async findOrganizationByOwnerUserId(ownerUserId: string): Promise<PlatformOrganization | null> {
    await this.ensureSchema();
    const result = await this.database.query(
      "select * from organizations where owner_user_id = $1 limit 1",
      [ownerUserId],
    );
    return result.rows[0] ? toOrganization(result.rows[0] as Record<string, unknown>) : null;
  }

  async upsertOrganization(input: UpsertOrganizationInput): Promise<PlatformOrganization> {
    await this.ensureSchema();
    const timestamp = now();
    const result = await this.database.query(
      `insert into organizations (
        id,
        owner_user_id,
        name,
        website,
        registration_country,
        registration_region,
        organization_type,
        operating_scope,
        local_operating_areas_json,
        mission_statement,
        programs_json,
        target_demographics_json,
        thematic_areas_json,
        annual_operating_budget,
        strategic_priorities_json,
        email_updates_enabled,
        personnel_json,
        created_at,
        updated_at
      ) values (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18, $18
      )
      on conflict (owner_user_id)
      do update set
        name = excluded.name,
        website = excluded.website,
        registration_country = excluded.registration_country,
        registration_region = excluded.registration_region,
        organization_type = excluded.organization_type,
        operating_scope = excluded.operating_scope,
        local_operating_areas_json = excluded.local_operating_areas_json,
        mission_statement = excluded.mission_statement,
        programs_json = excluded.programs_json,
        target_demographics_json = excluded.target_demographics_json,
        thematic_areas_json = excluded.thematic_areas_json,
        annual_operating_budget = excluded.annual_operating_budget,
        strategic_priorities_json = excluded.strategic_priorities_json,
        email_updates_enabled = excluded.email_updates_enabled,
        personnel_json = excluded.personnel_json,
        updated_at = excluded.updated_at
      returning *`,
      [
        makeId("organization"),
        input.ownerUserId,
        input.name,
        input.website,
        input.registrationCountry,
        input.registrationRegion,
        input.organizationType,
        input.operatingScope,
        JSON.stringify(input.localOperatingAreas),
        input.missionStatement,
        JSON.stringify(input.programs),
        JSON.stringify(input.targetDemographics),
        JSON.stringify(input.thematicAreas),
        input.annualOperatingBudget,
        JSON.stringify(input.strategicPriorities),
        input.emailUpdatesEnabled,
        JSON.stringify(input.personnel),
        timestamp,
      ],
    );

    return toOrganization(result.rows[0] as Record<string, unknown>);
  }

  async createAgentToken(userId: string, label: string): Promise<CreateAgentTokenResult> {
    await this.ensureSchema();
    const secret = `gfpat_${crypto.randomUUID().replaceAll("-", "")}${crypto.randomUUID().replaceAll("-", "")}`;
    const timestamp = now();
    const result = await this.database.query(
      `insert into agent_tokens (
        id,
        user_id,
        label,
        token_hash,
        created_at,
        last_used_at,
        revoked_at
      ) values ($1, $2, $3, $4, $5, null, null)
      returning id, user_id, label, created_at, last_used_at, revoked_at`,
      [makeId("token"), userId, label, hashToken(secret), timestamp],
    );

    return {
      token: toAgentToken(result.rows[0] as Record<string, unknown>),
      secret,
    };
  }

  async listAgentTokens(userId: string): Promise<PlatformAgentToken[]> {
    await this.ensureSchema();
    const result = await this.database.query(
      "select id, user_id, label, created_at, last_used_at, revoked_at from agent_tokens where user_id = $1 order by created_at desc",
      [userId],
    );
    return (result.rows as Record<string, unknown>[]).map(toAgentToken);
  }

  async revokeAgentToken(userId: string, tokenId: string): Promise<void> {
    await this.ensureSchema();
    await this.database.query(
      "update agent_tokens set revoked_at = $1 where user_id = $2 and id = $3 and revoked_at is null",
      [now(), userId, tokenId],
    );
  }

  async getUserByAgentToken(secret: string): Promise<PlatformUser | null> {
    await this.ensureSchema();
    const tokenHash = hashToken(secret);
    const client = await this.database.connect();
    try {
      await client.query("begin");
      const tokenResult = await client.query(
        `select id, user_id
         from agent_tokens
         where token_hash = $1 and revoked_at is null
         limit 1`,
        [tokenHash],
      );

      if (!tokenResult.rows[0]) {
        await client.query("rollback");
        return null;
      }

      const tokenRow = tokenResult.rows[0] as Record<string, unknown>;
      const timestamp = now();
      await client.query("update agent_tokens set last_used_at = $1 where id = $2", [timestamp, tokenRow.id]);
      const userResult = await client.query("select * from users where id = $1 limit 1", [tokenRow.user_id]);
      await client.query("commit");
      return userResult.rows[0] ? toUser(userResult.rows[0] as Record<string, unknown>) : null;
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  }

  async createJob(job: PlatformJob): Promise<PlatformJob> {
    await this.ensureSchema();
    const result = await this.database.query(
      `insert into jobs (
        id,
        requester_id,
        type,
        grant_id,
        catalog_grant_id,
        target_type,
        target_id,
        specialist_role,
        title,
        description,
        funding_need,
        status,
        created_at
      )
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       returning *`,
      [
        job.id,
        job.requesterId,
        job.type,
        job.grantId,
        job.catalogGrantId,
        job.targetType,
        job.targetId,
        job.specialistRole,
        job.title,
        job.description,
        job.fundingNeed,
        job.status,
        job.createdAt,
      ],
    );

    return toJob(result.rows[0] as Record<string, unknown>);
  }

  async saveJob(job: PlatformJob): Promise<PlatformJob> {
    await this.ensureSchema();
    const result = await this.database.query(
      `update jobs
       set requester_id = $2,
           type = $3,
           grant_id = $4,
           catalog_grant_id = $5,
           target_type = $6,
           target_id = $7,
           specialist_role = $8,
           title = $9,
           description = $10,
           funding_need = $11,
           status = $12,
           created_at = $13
       where id = $1
       returning *`,
      [
        job.id,
        job.requesterId,
        job.type,
        job.grantId,
        job.catalogGrantId,
        job.targetType,
        job.targetId,
        job.specialistRole,
        job.title,
        job.description,
        job.fundingNeed,
        job.status,
        job.createdAt,
      ],
    );
    return toJob(result.rows[0] as Record<string, unknown>);
  }

  async findJobById(jobId: string): Promise<PlatformJob | null> {
    await this.ensureSchema();
    const result = await this.database.query("select * from jobs where id = $1 limit 1", [jobId]);
    return result.rows[0] ? toJob(result.rows[0] as Record<string, unknown>) : null;
  }

  async createOffer(offer: PlatformOffer): Promise<PlatformOffer> {
    await this.ensureSchema();
    const result = await this.database.query(
      `insert into offers (
        id,
        job_id,
        specialist_id,
        specialist_role,
        message,
        amount_usd,
        payout_address,
        status,
        created_at,
        accepted_at
      ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      returning *`,
      [
        offer.id,
        offer.jobId,
        offer.specialistId,
        offer.specialistRole,
        offer.message,
        offer.amountUsd,
        offer.payoutAddress,
        offer.status,
        offer.createdAt,
        offer.acceptedAt,
      ],
    );

    return toOffer(result.rows[0] as Record<string, unknown>);
  }

  async findOfferById(offerId: string): Promise<PlatformOffer | null> {
    await this.ensureSchema();
    const result = await this.database.query("select * from offers where id = $1 limit 1", [offerId]);
    return result.rows[0] ? toOffer(result.rows[0] as Record<string, unknown>) : null;
  }

  async acceptOffer(requesterId: string, offerId: string): Promise<PlatformEngagement | null> {
    await this.ensureSchema();
    const client = await this.database.connect();
    try {
      await client.query("begin");
      const existingEngagement = await client.query("select * from engagements where offer_id = $1 limit 1", [offerId]);
      if (existingEngagement.rows[0]) {
        const engagement = await this.loadEngagementFromClient(client, String((existingEngagement.rows[0] as Record<string, unknown>).id));
        await client.query("commit");
        return engagement;
      }

      const offerResult = await client.query("select * from offers where id = $1 limit 1", [offerId]);
      if (!offerResult.rows[0]) {
        await client.query("rollback");
        return null;
      }

      const offer = toOffer(offerResult.rows[0] as Record<string, unknown>);
      const jobResult = await client.query("select * from jobs where id = $1 limit 1", [offer.jobId]);
      if (!jobResult.rows[0]) {
        await client.query("rollback");
        return null;
      }

      const job = toJob(jobResult.rows[0] as Record<string, unknown>);
      if (job.requesterId !== requesterId) {
        await client.query("rollback");
        return null;
      }

      const acceptedAt = now();
      await client.query("update offers set status = 'accepted', accepted_at = $1 where id = $2", [
        acceptedAt,
        offerId,
      ]);
      await client.query(
        "update offers set status = 'rejected' where job_id = $1 and id <> $2 and status = 'pending'",
        [job.id, offerId],
      );
      await client.query("update jobs set status = 'matched' where id = $1", [job.id]);

      const engagementId = makeId("engagement");
      await client.query(
        `insert into engagements (
          id,
          job_id,
          offer_id,
          requester_id,
          specialist_id,
          target_type,
          target_id,
          specialist_role,
          amount_usd,
          payout_address,
          status,
          created_at,
          funded_at
        ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'pending_funding', $11, null)`,
        [
          engagementId,
          job.id,
          offer.id,
          requesterId,
          offer.specialistId,
          job.targetType,
          job.targetId,
          offer.specialistRole ?? job.specialistRole,
          offer.amountUsd,
          offer.payoutAddress,
          now(),
        ],
      );

      const engagement = await this.loadEngagementFromClient(client, engagementId);
      await client.query("commit");
      return engagement;
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  }

  async findEngagementById(engagementId: string): Promise<PlatformEngagement | null> {
    await this.ensureSchema();
    const client = await this.database.connect();
    try {
      return await this.loadEngagementFromClient(client, engagementId);
    } finally {
      client.release();
    }
  }

  async fundEngagement(
    engagementId: string,
    payment: PlatformPaymentRecord,
  ): Promise<PlatformEngagement | null> {
    await this.ensureSchema();
    const client = await this.database.connect();
    try {
      await client.query("begin");
      const engagementResult = await client.query("select * from engagements where id = $1 limit 1", [engagementId]);
      if (!engagementResult.rows[0]) {
        await client.query("rollback");
        return null;
      }

      await client.query("update engagements set status = 'funded', funded_at = $1 where id = $2", [now(), engagementId]);
      await client.query(
        `insert into payments (
          id,
          engagement_id,
          protocol,
          amount_usd,
          network,
          pay_to,
          facilitator_url,
          payment_header,
          funded_by_user_id,
          created_at
        ) values ($1, $2, 'x402', $3, $4, $5, $6, $7, $8, $9)
        on conflict (engagement_id)
        do update set
          amount_usd = excluded.amount_usd,
          network = excluded.network,
          pay_to = excluded.pay_to,
          facilitator_url = excluded.facilitator_url,
          payment_header = excluded.payment_header,
          funded_by_user_id = excluded.funded_by_user_id,
          created_at = excluded.created_at`,
        [
          makeId("payment"),
          engagementId,
          payment.amountUsd,
          payment.network,
          payment.payTo,
          payment.facilitatorUrl,
          payment.paymentHeader,
          payment.fundedByUserId,
          now(),
        ],
      );

      const engagement = await this.loadEngagementFromClient(client, engagementId);
      await client.query("commit");
      return engagement;
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  }

  async createResearchScenario(scenario: PlatformResearchScenario): Promise<PlatformResearchScenario> {
    await this.ensureSchema();
    const result = await this.database.query(
      `insert into research_scenarios (
        id,
        owner_user_id,
        name,
        summary,
        geography,
        business_model,
        customers_json,
        needs_json,
        tags_json,
        created_at,
        updated_at
      ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      returning *`,
      [
        scenario.id,
        scenario.ownerUserId,
        scenario.name,
        scenario.summary,
        scenario.geography,
        scenario.businessModel,
        JSON.stringify(scenario.customers),
        JSON.stringify(scenario.needs),
        JSON.stringify(scenario.tags),
        scenario.createdAt,
        scenario.updatedAt,
      ],
    );

    return toResearchScenario(result.rows[0] as Record<string, unknown>);
  }

  async findResearchScenarioById(scenarioId: string): Promise<PlatformResearchScenario | null> {
    await this.ensureSchema();
    const result = await this.database.query(
      "select * from research_scenarios where id = $1 limit 1",
      [scenarioId],
    );
    return result.rows[0] ? toResearchScenario(result.rows[0] as Record<string, unknown>) : null;
  }

  async createResearchRequest(request: PlatformResearchRequest): Promise<PlatformResearchRequest> {
    await this.ensureSchema();
    const result = await this.database.query(
      `insert into research_requests (
        id,
        requester_id,
        scenario_id,
        source_catalog_grant_id,
        research_focus,
        organization_prefill_json,
        status,
        run_phase,
        progress_summary,
        run_started_at,
        brief_json,
        report_json,
        error_message,
        activity_json,
        steering_json,
        created_at,
        updated_at,
        last_run_at
      ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      returning *`,
      [
        request.id,
        request.requesterId,
        request.scenarioId,
        request.sourceCatalogGrantId,
        request.researchFocus,
        request.organizationPrefill ? JSON.stringify(request.organizationPrefill) : null,
        request.status,
        request.runPhase,
        request.progressSummary,
        request.runStartedAt,
        request.latestBrief ? JSON.stringify(request.latestBrief) : null,
        request.latestReport ? JSON.stringify(request.latestReport) : null,
        request.errorMessage,
        JSON.stringify(request.activity),
        JSON.stringify(request.steeringNotes),
        request.createdAt,
        request.updatedAt,
        request.lastRunAt,
      ],
    );

    return toResearchRequest(result.rows[0] as Record<string, unknown>);
  }

  async findResearchRequestById(requestId: string): Promise<PlatformResearchRequest | null> {
    await this.ensureSchema();
    const result = await this.database.query(
      "select * from research_requests where id = $1 limit 1",
      [requestId],
    );
    return result.rows[0] ? toResearchRequest(result.rows[0] as Record<string, unknown>) : null;
  }

  async saveResearchRequest(request: PlatformResearchRequest): Promise<PlatformResearchRequest> {
    await this.ensureSchema();
    const result = await this.database.query(
      `update research_requests
       set scenario_id = $2,
           source_catalog_grant_id = $3,
           research_focus = $4,
           organization_prefill_json = $5,
           status = $6,
           run_phase = $7,
           progress_summary = $8,
           run_started_at = $9,
           brief_json = $10,
           report_json = $11,
           error_message = $12,
           activity_json = $13,
           steering_json = $14,
           updated_at = $15,
           last_run_at = $16
       where id = $1
       returning *`,
      [
        request.id,
        request.scenarioId,
        request.sourceCatalogGrantId,
        request.researchFocus,
        request.organizationPrefill ? JSON.stringify(request.organizationPrefill) : null,
        request.status,
        request.runPhase,
        request.progressSummary,
        request.runStartedAt,
        request.latestBrief ? JSON.stringify(request.latestBrief) : null,
        request.latestReport ? JSON.stringify(request.latestReport) : null,
        request.errorMessage,
        JSON.stringify(request.activity),
        JSON.stringify(request.steeringNotes),
        request.updatedAt,
        request.lastRunAt,
      ],
    );

    return toResearchRequest(result.rows[0] as Record<string, unknown>);
  }

  async replaceTrackedGrants(
    requestId: string,
    grants: PlatformTrackedGrant[],
  ): Promise<PlatformTrackedGrant[]> {
    await this.ensureSchema();
    const client = await this.database.connect();
    try {
      await client.query("begin");
      await client.query("delete from tracked_grants where request_id = $1", [requestId]);

      for (const grant of grants) {
        await client.query(
          `insert into tracked_grants (
            id,
            request_id,
            requester_id,
            catalog_grant_id,
            repository_binding_json,
            title,
            sponsor,
            funding_type,
            fit_score,
            why_fit,
            eligibility_notes_json,
            amount_summary,
            deadline_summary,
            geography,
            status,
            citations_json,
            next_actions_json,
            queue_state,
            proposal_workspace_id,
            proposal_job_id,
            created_at,
            updated_at
          ) values (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
            $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
            $21, $22
          )`,
          [
            grant.id,
            grant.requestId,
            grant.requesterId,
            grant.catalogGrantId,
            grant.repositoryBinding ? JSON.stringify(grant.repositoryBinding) : null,
            grant.title,
            grant.sponsor,
            grant.fundingType,
            grant.fitScore,
            grant.whyFit,
            JSON.stringify(grant.eligibilityNotes),
            grant.amountSummary,
            grant.deadlineSummary,
            grant.geography,
            grant.status,
            JSON.stringify(grant.citations),
            JSON.stringify(grant.nextActions),
            grant.queueState,
            grant.proposalWorkspaceId,
            grant.proposalJobId,
            grant.createdAt,
            grant.updatedAt,
          ],
        );
      }

      await client.query("commit");
      return structuredClone(grants);
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  }

  async findTrackedGrantById(grantId: string): Promise<PlatformTrackedGrant | null> {
    await this.ensureSchema();
    const result = await this.database.query(
      "select * from tracked_grants where id = $1 limit 1",
      [grantId],
    );
    return result.rows[0] ? toTrackedGrant(result.rows[0] as Record<string, unknown>) : null;
  }

  async saveTrackedGrant(grant: PlatformTrackedGrant): Promise<PlatformTrackedGrant> {
    await this.ensureSchema();
    const result = await this.database.query(
      `update tracked_grants
       set catalog_grant_id = $2,
           repository_binding_json = $3,
           queue_state = $4,
           proposal_workspace_id = $5,
           proposal_job_id = $6,
           updated_at = $7
       where id = $1
       returning *`,
      [
        grant.id,
        grant.catalogGrantId,
        grant.repositoryBinding ? JSON.stringify(grant.repositoryBinding) : null,
        grant.queueState,
        grant.proposalWorkspaceId,
        grant.proposalJobId,
        grant.updatedAt,
      ],
    );
    return toTrackedGrant(result.rows[0] as Record<string, unknown>);
  }

  async findGrantReportByRequestId(requestId: string): Promise<PlatformGrantReport | null> {
    await this.ensureSchema();
    const result = await this.database.query(
      "select * from grant_reports where request_id = $1 limit 1",
      [requestId],
    );
    return result.rows[0] ? toGrantReport(result.rows[0] as Record<string, unknown>) : null;
  }

  async upsertGrantReport(report: PlatformGrantReport): Promise<PlatformGrantReport> {
    await this.ensureSchema();
    const result = await this.database.query(
      `insert into grant_reports (
        id,
        request_id,
        requester_id,
        business_case_id,
        executive_summary,
        search_summary,
        opportunities_json,
        rejected_leads_json,
        next_actions_json,
        created_at,
        updated_at
      ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      on conflict (request_id)
      do update set
        requester_id = excluded.requester_id,
        business_case_id = excluded.business_case_id,
        executive_summary = excluded.executive_summary,
        search_summary = excluded.search_summary,
        opportunities_json = excluded.opportunities_json,
        rejected_leads_json = excluded.rejected_leads_json,
        next_actions_json = excluded.next_actions_json,
        updated_at = excluded.updated_at
      returning *`,
      [
        report.id,
        report.requestId,
        report.requesterId,
        report.businessCaseId,
        report.executiveSummary,
        report.searchSummary,
        JSON.stringify(report.opportunities),
        JSON.stringify(report.rejectedLeads),
        JSON.stringify(report.nextActions),
        report.createdAt,
        report.updatedAt,
      ],
    );
    return toGrantReport(result.rows[0] as Record<string, unknown>);
  }

  async findGrantCatalogEntryById(grantId: string): Promise<PlatformGrantCatalogEntry | null> {
    await this.ensureSchema();
    const result = await this.database.query(
      "select * from grant_catalog_entries where id = $1 limit 1",
      [grantId],
    );
    return result.rows[0] ? toGrantCatalogEntry(result.rows[0] as Record<string, unknown>) : null;
  }

  async findGrantCatalogEntryBySourceGrantId(
    sourceGrantId: string,
  ): Promise<PlatformGrantCatalogEntry | null> {
    await this.ensureSchema();
    const result = await this.database.query(
      "select * from grant_catalog_entries where source_grant_id = $1 limit 1",
      [sourceGrantId],
    );
    return result.rows[0] ? toGrantCatalogEntry(result.rows[0] as Record<string, unknown>) : null;
  }

  async saveGrantCatalogEntry(grant: PlatformGrantCatalogEntry): Promise<PlatformGrantCatalogEntry> {
    await this.ensureSchema();
    const result = await this.database.query(
      `insert into grant_catalog_entries (
        id,
        created_by_user_id,
        source_type,
        source_grant_id,
        source_report_id,
        last_research_request_id,
        repository_binding_json,
        title,
        sponsor,
        funding_type,
        fit_score,
        why_fit,
        eligibility_notes_json,
        amount_summary,
        deadline_summary,
        geography,
        status,
        citations_json,
        next_actions_json,
        tags_json,
        provenance_notes,
        freshness_notes,
        pursuit_notes,
        last_validated_at,
        created_at,
        updated_at
      ) values (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
        $21, $22, $23, $24, $25, $26
      )
      on conflict (id)
      do update set
        created_by_user_id = excluded.created_by_user_id,
        source_type = excluded.source_type,
        source_grant_id = excluded.source_grant_id,
        source_report_id = excluded.source_report_id,
        last_research_request_id = excluded.last_research_request_id,
        repository_binding_json = excluded.repository_binding_json,
        title = excluded.title,
        sponsor = excluded.sponsor,
        funding_type = excluded.funding_type,
        fit_score = excluded.fit_score,
        why_fit = excluded.why_fit,
        eligibility_notes_json = excluded.eligibility_notes_json,
        amount_summary = excluded.amount_summary,
        deadline_summary = excluded.deadline_summary,
        geography = excluded.geography,
        status = excluded.status,
        citations_json = excluded.citations_json,
        next_actions_json = excluded.next_actions_json,
        tags_json = excluded.tags_json,
        provenance_notes = excluded.provenance_notes,
        freshness_notes = excluded.freshness_notes,
        pursuit_notes = excluded.pursuit_notes,
        last_validated_at = excluded.last_validated_at,
        updated_at = excluded.updated_at
      returning *`,
      [
        grant.id,
        grant.createdByUserId,
        grant.sourceType,
        grant.sourceGrantId,
        grant.sourceReportId,
        grant.lastResearchRequestId,
        grant.repositoryBinding ? JSON.stringify(grant.repositoryBinding) : null,
        grant.title,
        grant.sponsor,
        grant.fundingType,
        grant.fitScore,
        grant.whyFit,
        JSON.stringify(grant.eligibilityNotes),
        grant.amountSummary,
        grant.deadlineSummary,
        grant.geography,
        grant.status,
        JSON.stringify(grant.citations),
        JSON.stringify(grant.nextActions),
        JSON.stringify(grant.tags),
        grant.provenanceNotes,
        grant.freshnessNotes,
        grant.pursuitNotes,
        grant.lastValidatedAt,
        grant.createdAt,
        grant.updatedAt,
      ],
    );
    return toGrantCatalogEntry(result.rows[0] as Record<string, unknown>);
  }

  async setGrantBookmark(userId: string, grantId: string, bookmarked: boolean): Promise<boolean> {
    await this.ensureSchema();

    if (bookmarked) {
      await this.database.query(
        `insert into grant_bookmarks (id, user_id, grant_catalog_entry_id, created_at)
         values ($1, $2, $3, $4)
         on conflict (user_id, grant_catalog_entry_id) do nothing`,
        [makeId("bookmark"), userId, grantId, now()],
      );
      return true;
    }

    await this.database.query(
      "delete from grant_bookmarks where user_id = $1 and grant_catalog_entry_id = $2",
      [userId, grantId],
    );
    return false;
  }

  async findGrantApplicationSchemaByCatalogGrantId(
    catalogGrantId: string,
  ): Promise<PlatformGrantApplicationSchema | null> {
    await this.ensureSchema();
    const result = await this.database.query(
      "select * from grant_application_schemas where catalog_grant_id = $1 limit 1",
      [catalogGrantId],
    );
    return result.rows[0] ? toGrantApplicationSchema(result.rows[0] as Record<string, unknown>) : null;
  }

  async upsertGrantApplicationSchema(
    schema: PlatformGrantApplicationSchema,
  ): Promise<PlatformGrantApplicationSchema> {
    await this.ensureSchema();
    const result = await this.database.query(
      `insert into grant_application_schemas (
        id,
        catalog_grant_id,
        name,
        document_type,
        sections_json,
        created_at,
        updated_at
      ) values ($1, $2, $3, $4, $5, $6, $7)
      on conflict (catalog_grant_id)
      do update set
        name = excluded.name,
        document_type = excluded.document_type,
        sections_json = excluded.sections_json,
        updated_at = excluded.updated_at
      returning *`,
      [
        schema.id,
        schema.catalogGrantId,
        schema.name,
        schema.documentType,
        JSON.stringify(schema.sections),
        schema.createdAt,
        schema.updatedAt,
      ],
    );
    return toGrantApplicationSchema(result.rows[0] as Record<string, unknown>);
  }

  async createApplicationTemplate(template: PlatformApplicationTemplate): Promise<PlatformApplicationTemplate> {
    await this.ensureSchema();
    const result = await this.database.query(
      `insert into application_templates (
        id,
        owner_user_id,
        name,
        document_type,
        sections_json,
        created_at,
        updated_at
      ) values ($1, $2, $3, $4, $5, $6, $7)
      returning *`,
      [
        template.id,
        template.ownerUserId,
        template.name,
        template.documentType,
        JSON.stringify(template.sections),
        template.createdAt,
        template.updatedAt,
      ],
    );
    return toApplicationTemplate(result.rows[0] as Record<string, unknown>);
  }

  async findApplicationTemplateById(templateId: string): Promise<PlatformApplicationTemplate | null> {
    await this.ensureSchema();
    const result = await this.database.query(
      "select * from application_templates where id = $1 limit 1",
      [templateId],
    );
    return result.rows[0] ? toApplicationTemplate(result.rows[0] as Record<string, unknown>) : null;
  }

  async createApplicationWorkspace(workspace: PlatformApplicationWorkspace): Promise<PlatformApplicationWorkspace> {
    await this.ensureSchema();
    const result = await this.database.query(
      `insert into application_workspaces (
        id,
        requester_id,
        catalog_grant_id,
        template_id,
        organization_prefill_json,
        document_type,
        title,
        state,
        sections_json,
        created_at,
        updated_at,
        finalized_at
      ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      returning *`,
      [
        workspace.id,
        workspace.requesterId,
        workspace.catalogGrantId,
        workspace.templateId,
        workspace.organizationPrefill ? JSON.stringify(workspace.organizationPrefill) : null,
        workspace.documentType,
        workspace.title,
        workspace.state,
        JSON.stringify(workspace.sections),
        workspace.createdAt,
        workspace.updatedAt,
        workspace.finalizedAt,
      ],
    );
    return toApplicationWorkspace(result.rows[0] as Record<string, unknown>);
  }

  async findApplicationWorkspaceById(workspaceId: string): Promise<PlatformApplicationWorkspace | null> {
    await this.ensureSchema();
    const result = await this.database.query(
      "select * from application_workspaces where id = $1 limit 1",
      [workspaceId],
    );
    return result.rows[0] ? toApplicationWorkspace(result.rows[0] as Record<string, unknown>) : null;
  }

  async saveApplicationWorkspace(workspace: PlatformApplicationWorkspace): Promise<PlatformApplicationWorkspace> {
    await this.ensureSchema();
    const result = await this.database.query(
      `update application_workspaces
       set catalog_grant_id = $2,
           template_id = $3,
           organization_prefill_json = $4,
           document_type = $5,
           title = $6,
           state = $7,
           sections_json = $8,
           updated_at = $9,
           finalized_at = $10
       where id = $1
       returning *`,
      [
        workspace.id,
        workspace.catalogGrantId,
        workspace.templateId,
        workspace.organizationPrefill ? JSON.stringify(workspace.organizationPrefill) : null,
        workspace.documentType,
        workspace.title,
        workspace.state,
        JSON.stringify(workspace.sections),
        workspace.updatedAt,
        workspace.finalizedAt,
      ],
    );
    return toApplicationWorkspace(result.rows[0] as Record<string, unknown>);
  }

  async createProposalWorkspace(workspace: PlatformProposalWorkspace): Promise<PlatformProposalWorkspace> {
    await this.ensureSchema();
    const result = await this.database.query(
      `insert into proposal_workspaces (
        id,
        owner_user_id,
        organization_id,
        tracked_grant_id,
        catalog_grant_id,
        repository_binding_json,
        opportunity_json,
        stage,
        summary,
        next_steps_json,
        open_questions_json,
        primary_application_workspace_id,
        feasibility_snapshot_json,
        contacts_json,
        outreach_events_json,
        outcome_json,
        proposal_job_id,
        engagement_id,
        created_at,
        updated_at
      ) values (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18, $19, $20
      )
      returning *`,
      [
        workspace.id,
        workspace.ownerUserId,
        workspace.organizationId,
        workspace.trackedGrantId,
        workspace.catalogGrantId,
        workspace.repositoryBinding ? JSON.stringify(workspace.repositoryBinding) : null,
        JSON.stringify(workspace.opportunity),
        workspace.stage,
        workspace.summary,
        JSON.stringify(workspace.nextSteps),
        JSON.stringify(workspace.openQuestions),
        workspace.primaryApplicationWorkspaceId,
        workspace.feasibilitySnapshot ? JSON.stringify(workspace.feasibilitySnapshot) : null,
        JSON.stringify(workspace.contacts),
        JSON.stringify(workspace.outreachEvents),
        workspace.outcome ? JSON.stringify(workspace.outcome) : null,
        workspace.proposalJobId,
        workspace.engagementId,
        workspace.createdAt,
        workspace.updatedAt,
      ],
    );
    return toProposalWorkspace(result.rows[0] as Record<string, unknown>);
  }

  async findProposalWorkspaceById(workspaceId: string): Promise<PlatformProposalWorkspace | null> {
    await this.ensureSchema();
    const result = await this.database.query(
      "select * from proposal_workspaces where id = $1 limit 1",
      [workspaceId],
    );
    return result.rows[0] ? toProposalWorkspace(result.rows[0] as Record<string, unknown>) : null;
  }

  async findProposalWorkspaceByTrackedGrantId(grantId: string): Promise<PlatformProposalWorkspace | null> {
    await this.ensureSchema();
    const result = await this.database.query(
      "select * from proposal_workspaces where tracked_grant_id = $1 limit 1",
      [grantId],
    );
    return result.rows[0] ? toProposalWorkspace(result.rows[0] as Record<string, unknown>) : null;
  }

  async saveProposalWorkspace(workspace: PlatformProposalWorkspace): Promise<PlatformProposalWorkspace> {
    await this.ensureSchema();
    const result = await this.database.query(
      `update proposal_workspaces
       set organization_id = $2,
           tracked_grant_id = $3,
           catalog_grant_id = $4,
           repository_binding_json = $5,
           opportunity_json = $6,
           stage = $7,
           summary = $8,
           next_steps_json = $9,
           open_questions_json = $10,
           primary_application_workspace_id = $11,
           feasibility_snapshot_json = $12,
           contacts_json = $13,
           outreach_events_json = $14,
           outcome_json = $15,
           proposal_job_id = $16,
           engagement_id = $17,
           updated_at = $18
       where id = $1
       returning *`,
      [
        workspace.id,
        workspace.organizationId,
        workspace.trackedGrantId,
        workspace.catalogGrantId,
        workspace.repositoryBinding ? JSON.stringify(workspace.repositoryBinding) : null,
        JSON.stringify(workspace.opportunity),
        workspace.stage,
        workspace.summary,
        JSON.stringify(workspace.nextSteps),
        JSON.stringify(workspace.openQuestions),
        workspace.primaryApplicationWorkspaceId,
        workspace.feasibilitySnapshot ? JSON.stringify(workspace.feasibilitySnapshot) : null,
        JSON.stringify(workspace.contacts),
        JSON.stringify(workspace.outreachEvents),
        workspace.outcome ? JSON.stringify(workspace.outcome) : null,
        workspace.proposalJobId,
        workspace.engagementId,
        workspace.updatedAt,
      ],
    );
    return toProposalWorkspace(result.rows[0] as Record<string, unknown>);
  }

  async createAgentProviderConnection(
    connection: PlatformAgentProviderConnection,
  ): Promise<PlatformAgentProviderConnection> {
    await this.ensureSchema();
    const result = await this.database.query(
      `insert into agent_provider_connections (
        id,
        scope,
        owner_user_id,
        organization_id,
        provider,
        label,
        auth_type,
        allowed_artifact_types_json,
        created_at,
        updated_at
      ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      returning *`,
      [
        connection.id,
        connection.scope,
        connection.ownerUserId,
        connection.organizationId,
        connection.provider,
        connection.label,
        connection.authType,
        JSON.stringify(connection.allowedArtifactTypes),
        connection.createdAt,
        connection.updatedAt,
      ],
    );
    return toAgentProviderConnection(result.rows[0] as Record<string, unknown>);
  }

  async findAgentProviderConnectionById(connectionId: string): Promise<PlatformAgentProviderConnection | null> {
    await this.ensureSchema();
    const result = await this.database.query(
      "select * from agent_provider_connections where id = $1 limit 1",
      [connectionId],
    );
    return result.rows[0] ? toAgentProviderConnection(result.rows[0] as Record<string, unknown>) : null;
  }

  async createAgentExecutionRecord(record: PlatformAgentExecutionRecord): Promise<PlatformAgentExecutionRecord> {
    await this.ensureSchema();
    const result = await this.database.query(
      `insert into agent_execution_records (
        id,
        actor_user_id,
        provider_connection_id,
        target_type,
        target_id,
        action,
        output_text,
        created_at
      ) values ($1, $2, $3, $4, $5, $6, $7, $8)
      returning *`,
      [
        record.id,
        record.actorUserId,
        record.providerConnectionId,
        record.targetType,
        record.targetId,
        record.action,
        record.outputText,
        record.createdAt,
      ],
    );
    return toAgentExecutionRecord(result.rows[0] as Record<string, unknown>);
  }

  private async ensureSchema(): Promise<void> {
    let schemaReady = schemaCache.get(this.database as object);
    if (!schemaReady) {
      schemaReady = this.bootstrapSchema();
      schemaCache.set(this.database as object, schemaReady);
    }

    await schemaReady;
  }

  private async bootstrapSchema(): Promise<void> {
    await this.database.query(`
      create table if not exists users (
        id text primary key,
        privy_user_id text unique not null,
        name text not null,
        role text not null check (role in ('requester', 'specialist')),
        wallet_address text,
        smart_wallet_address text,
        created_at text not null,
        updated_at text not null
      )
    `);
    await this.database.query(`
      create table if not exists agent_tokens (
        id text primary key,
        user_id text not null references users (id) on delete cascade,
        label text not null,
        token_hash text not null unique,
        created_at text not null,
        last_used_at text,
        revoked_at text
      )
    `);
    await this.database.query(`
      create table if not exists organizations (
        id text primary key,
        owner_user_id text not null unique references users (id) on delete cascade,
        name text not null,
        website text,
        registration_country text not null,
        registration_region text,
        organization_type text not null,
        operating_scope text not null,
        local_operating_areas_json text not null default '[]',
        mission_statement text not null,
        programs_json text not null default '[]',
        target_demographics_json text not null default '[]',
        thematic_areas_json text not null default '[]',
        annual_operating_budget text not null,
        strategic_priorities_json text not null default '[]',
        email_updates_enabled boolean not null default false,
        personnel_json text not null default '[]',
        created_at text not null,
        updated_at text not null
      )
    `);
    await this.database.query(`
      create table if not exists jobs (
        id text primary key,
        requester_id text not null references users (id) on delete cascade,
        type text not null default 'general' check (type in ('general', 'grant_proposal')),
        grant_id text,
        catalog_grant_id text,
        target_type text,
        target_id text,
        specialist_role text,
        title text not null,
        description text not null,
        funding_need text not null,
        status text not null check (status in ('open', 'matched')),
        created_at text not null
      )
    `);
    await this.database.query(`
      alter table jobs add column if not exists type text not null default 'general'
    `);
    await this.database.query(`
      alter table jobs add column if not exists grant_id text
    `);
    await this.database.query(`
      alter table jobs add column if not exists catalog_grant_id text
    `);
    await this.database.query(`
      alter table jobs add column if not exists target_type text
    `);
    await this.database.query(`
      alter table jobs add column if not exists target_id text
    `);
    await this.database.query(`
      alter table jobs add column if not exists specialist_role text
    `);
    await this.database.query(`
      create table if not exists offers (
        id text primary key,
        job_id text not null references jobs (id) on delete cascade,
        specialist_id text not null references users (id) on delete cascade,
        specialist_role text,
        message text not null,
        amount_usd text not null,
        payout_address text not null,
        status text not null check (status in ('pending', 'accepted', 'rejected')),
        created_at text not null,
        accepted_at text
      )
    `);
    await this.database.query(`
      alter table offers add column if not exists specialist_role text
    `);
    await this.database.query(`
      create table if not exists engagements (
        id text primary key,
        job_id text not null references jobs (id) on delete cascade,
        offer_id text not null unique references offers (id) on delete cascade,
        requester_id text not null references users (id) on delete cascade,
        specialist_id text not null references users (id) on delete cascade,
        target_type text,
        target_id text,
        specialist_role text,
        amount_usd text not null,
        payout_address text not null,
        status text not null check (status in ('pending_funding', 'funded')),
        created_at text not null,
        funded_at text
      )
    `);
    await this.database.query(`
      alter table engagements add column if not exists target_type text
    `);
    await this.database.query(`
      alter table engagements add column if not exists target_id text
    `);
    await this.database.query(`
      alter table engagements add column if not exists specialist_role text
    `);
    await this.database.query(`
      create table if not exists payments (
        id text primary key,
        engagement_id text not null unique references engagements (id) on delete cascade,
        protocol text not null,
        amount_usd text not null,
        network text not null,
        pay_to text not null,
        facilitator_url text not null,
        payment_header text,
        funded_by_user_id text not null references users (id) on delete cascade,
        created_at text not null
      )
    `);
    await this.database.query(`
      create table if not exists research_scenarios (
        id text primary key,
        owner_user_id text not null references users (id) on delete cascade,
        name text not null,
        summary text not null,
        geography text not null,
        business_model text not null,
        customers_json text not null,
        needs_json text not null,
        tags_json text not null,
        created_at text not null,
        updated_at text not null
      )
    `);
    await this.database.query(`
      create table if not exists research_requests (
        id text primary key,
        requester_id text not null references users (id) on delete cascade,
        scenario_id text not null,
        source_catalog_grant_id text,
        research_focus text,
        organization_prefill_json text,
        status text not null check (status in ('draft', 'running', 'completed', 'failed')),
        run_phase text not null default 'idle',
        progress_summary text,
        run_started_at text,
        brief_json text,
        report_json text,
        error_message text,
        activity_json text not null default '[]',
        steering_json text not null default '[]',
        created_at text not null,
        updated_at text not null,
        last_run_at text
      )
    `);
    await this.database.query(`
      alter table research_requests
      add column if not exists organization_prefill_json text
    `);
    await this.database.query(`
      alter table research_requests add column if not exists run_phase text not null default 'idle'
    `);
    await this.database.query(`
      alter table research_requests add column if not exists progress_summary text
    `);
    await this.database.query(`
      alter table research_requests add column if not exists run_started_at text
    `);
    await this.database.query(`
      alter table research_requests add column if not exists activity_json text not null default '[]'
    `);
    await this.database.query(`
      alter table research_requests add column if not exists steering_json text not null default '[]'
    `);
    await this.database.query(`
      alter table research_requests add column if not exists research_focus text
    `);
    await this.database.query(`
        create table if not exists tracked_grants (
          id text primary key,
          request_id text not null references research_requests (id) on delete cascade,
          requester_id text not null references users (id) on delete cascade,
          repository_binding_json text,
          title text not null,
          sponsor text not null,
          funding_type text not null,
        fit_score integer not null,
        why_fit text not null,
        eligibility_notes_json text not null,
        amount_summary text not null,
        deadline_summary text not null,
        geography text not null,
        status text not null,
        citations_json text not null,
        next_actions_json text not null,
        queue_state text not null check (queue_state in ('active', 'inactive')),
        proposal_workspace_id text,
        proposal_job_id text references jobs (id) on delete set null,
        created_at text not null,
        updated_at text not null
      )
    `);
    await this.database.query(`
      alter table tracked_grants add column if not exists proposal_workspace_id text
    `);
    await this.database.query(`
      alter table tracked_grants add column if not exists repository_binding_json text
    `);
    await this.database.query(`
      create table if not exists grant_reports (
        id text primary key,
        request_id text not null unique references research_requests (id) on delete cascade,
        requester_id text not null references users (id) on delete cascade,
        business_case_id text not null,
        executive_summary text not null,
        search_summary text not null,
        opportunities_json text not null default '[]',
        rejected_leads_json text not null default '[]',
        next_actions_json text not null default '[]',
        created_at text not null,
        updated_at text not null
      )
    `);
    await this.database.query(`
      create table if not exists grant_catalog_entries (
        id text primary key,
        created_by_user_id text not null references users (id) on delete cascade,
        source_type text not null check (source_type in ('promoted', 'curated', 'research')),
        source_grant_id text unique,
        source_report_id text,
        last_research_request_id text references research_requests (id) on delete set null,
        repository_binding_json text,
        title text not null,
        sponsor text not null,
        funding_type text not null,
        fit_score integer not null,
        why_fit text not null,
        eligibility_notes_json text not null default '[]',
        amount_summary text not null,
        deadline_summary text not null,
        geography text not null,
        status text not null,
        citations_json text not null default '[]',
        next_actions_json text not null default '[]',
        tags_json text not null default '[]',
        provenance_notes text,
        freshness_notes text,
        pursuit_notes text,
        last_validated_at text,
        created_at text not null,
        updated_at text not null
      )
    `);
    await this.database.query(`
      alter table grant_catalog_entries add column if not exists last_research_request_id text references research_requests (id) on delete set null
    `);
    await this.database.query(`
      alter table grant_catalog_entries add column if not exists provenance_notes text
    `);
    await this.database.query(`
      alter table grant_catalog_entries add column if not exists freshness_notes text
    `);
    await this.database.query(`
      alter table grant_catalog_entries add column if not exists pursuit_notes text
    `);
    await this.database.query(`
      alter table grant_catalog_entries add column if not exists last_validated_at text
    `);
    await this.database.query(`
      alter table grant_catalog_entries add column if not exists repository_binding_json text
    `);
    await this.database.query(`
      alter table grant_catalog_entries drop constraint if exists grant_catalog_entries_source_type_check
    `);
    await this.database.query(`
      alter table grant_catalog_entries
      add constraint grant_catalog_entries_source_type_check
      check (source_type in ('promoted', 'curated', 'research'))
    `);
    await this.database.query(`
      alter table research_requests
      add column if not exists source_catalog_grant_id text references grant_catalog_entries (id) on delete set null
    `);
    await this.database.query(`
      alter table tracked_grants
      add column if not exists catalog_grant_id text references grant_catalog_entries (id) on delete set null
    `);
    await this.database.query(`
      create table if not exists grant_bookmarks (
        id text primary key,
        user_id text not null references users (id) on delete cascade,
        grant_catalog_entry_id text not null references grant_catalog_entries (id) on delete cascade,
        created_at text not null,
        unique (user_id, grant_catalog_entry_id)
      )
    `);
    await this.database.query(`
      create table if not exists grant_application_schemas (
        id text primary key,
        catalog_grant_id text not null unique references grant_catalog_entries (id) on delete cascade,
        name text not null,
        document_type text not null,
        sections_json text not null default '[]',
        created_at text not null,
        updated_at text not null
      )
    `);
    await this.database.query(`
      create table if not exists application_templates (
        id text primary key,
        owner_user_id text not null references users (id) on delete cascade,
        name text not null,
        document_type text not null,
        sections_json text not null default '[]',
        created_at text not null,
        updated_at text not null
      )
    `);
    await this.database.query(`
      create table if not exists application_workspaces (
        id text primary key,
        requester_id text not null references users (id) on delete cascade,
        catalog_grant_id text references grant_catalog_entries (id) on delete set null,
        template_id text references application_templates (id) on delete set null,
        organization_prefill_json text,
        document_type text not null,
        title text not null,
        state text not null check (state in ('draft', 'proposal')),
        sections_json text not null default '[]',
        created_at text not null,
        updated_at text not null,
        finalized_at text
      )
    `);
    await this.database.query(`
      alter table application_workspaces
      add column if not exists organization_prefill_json text
    `);
    await this.database.query(`
      create table if not exists proposal_workspaces (
        id text primary key,
        owner_user_id text not null references users (id) on delete cascade,
        organization_id text references organizations (id) on delete set null,
        tracked_grant_id text unique,
        catalog_grant_id text,
        repository_binding_json text,
        opportunity_json text not null,
        stage text not null check (
          stage in ('qualifying', 'drafting', 'outreach', 'submitted', 'awarded', 'declined', 'no_bid')
        ),
        summary text not null default '',
        next_steps_json text not null default '[]',
        open_questions_json text not null default '[]',
        primary_application_workspace_id text references application_workspaces (id) on delete set null,
        feasibility_snapshot_json text,
        contacts_json text not null default '[]',
        outreach_events_json text not null default '[]',
        outcome_json text,
        proposal_job_id text references jobs (id) on delete set null,
        engagement_id text references engagements (id) on delete set null,
        created_at text not null,
        updated_at text not null
      )
    `);
    await this.database.query(`
      alter table proposal_workspaces add column if not exists catalog_grant_id text
    `);
    await this.database.query(`
      alter table proposal_workspaces add column if not exists repository_binding_json text
    `);
    await this.database.query(`
      create table if not exists agent_provider_connections (
        id text primary key,
        scope text not null check (scope in ('user', 'organization')),
        owner_user_id text references users (id) on delete cascade,
        organization_id text references organizations (id) on delete cascade,
        provider text not null,
        label text not null,
        auth_type text not null check (auth_type in ('byok', 'oauth')),
        allowed_artifact_types_json text not null default '[]',
        created_at text not null,
        updated_at text not null
      )
    `);
    await this.database.query(`
      create table if not exists agent_execution_records (
        id text primary key,
        actor_user_id text not null references users (id) on delete cascade,
        provider_connection_id text not null references agent_provider_connections (id) on delete cascade,
        target_type text not null,
        target_id text not null,
        action text not null,
        output_text text not null,
        created_at text not null
      )
    `);
  }

  private async loadEngagementFromClient(
    client: Queryable,
    engagementId: string,
  ): Promise<PlatformEngagement | null> {
    const engagementResult = await client.query("select * from engagements where id = $1 limit 1", [engagementId]);
    if (!engagementResult.rows[0]) {
      return null;
    }

    const paymentResult = await client.query("select * from payments where engagement_id = $1 limit 1", [engagementId]);
    return toEngagement(
      engagementResult.rows[0] as Record<string, unknown>,
      paymentResult.rows[0] ? toPayment(paymentResult.rows[0] as Record<string, unknown>) : null,
    );
  }
}

const schemaCache = new WeakMap<object, Promise<void>>();

export class ApplicationStore {
  private readonly driver: MemoryStore | PostgresStore;
  private readonly pool: Pool | null;

  constructor(options: ApplicationStoreOptions = {}) {
    if (options.database) {
      this.pool = null;
      this.driver = new PostgresStore(options.database);
      return;
    }

    if (options.persist ?? false) {
      const databaseUrl = options.databaseUrl ?? process.env.DATABASE_URL;
      if (!databaseUrl) {
        throw new Error("DATABASE_URL is required when persistence is enabled.");
      }

      this.pool = new Pool({ connectionString: databaseUrl });
      this.driver = new PostgresStore(this.pool);
      return;
    }

    this.pool = null;
    this.driver = new MemoryStore(options.state);
  }

  async readState(): Promise<PlatformState> {
    return this.driver.readState();
  }

  async findUserById(userId: string): Promise<PlatformUser | null> {
    return this.driver.findUserById(userId);
  }

  async findUserByPrivyUserId(privyUserId: string): Promise<PlatformUser | null> {
    return this.driver.findUserByPrivyUserId(privyUserId);
  }

  async upsertUserProfile(input: UpsertUserProfileInput): Promise<PlatformUser> {
    return this.driver.upsertUserProfile(input);
  }

  async findOrganizationByOwnerUserId(ownerUserId: string): Promise<PlatformOrganization | null> {
    return this.driver.findOrganizationByOwnerUserId(ownerUserId);
  }

  async upsertOrganization(input: UpsertOrganizationInput): Promise<PlatformOrganization> {
    return this.driver.upsertOrganization(input);
  }

  async createAgentToken(userId: string, label: string): Promise<CreateAgentTokenResult> {
    return this.driver.createAgentToken(userId, label);
  }

  async listAgentTokens(userId: string): Promise<PlatformAgentToken[]> {
    return this.driver.listAgentTokens(userId);
  }

  async revokeAgentToken(userId: string, tokenId: string): Promise<void> {
    return this.driver.revokeAgentToken(userId, tokenId);
  }

  async getUserByAgentToken(secret: string): Promise<PlatformUser | null> {
    return this.driver.getUserByAgentToken(secret);
  }

  async createJob(job: PlatformJob): Promise<PlatformJob> {
    return this.driver.createJob(job);
  }

  async saveJob(job: PlatformJob): Promise<PlatformJob> {
    return this.driver.saveJob(job);
  }

  async findJobById(jobId: string): Promise<PlatformJob | null> {
    return this.driver.findJobById(jobId);
  }

  async createOffer(offer: PlatformOffer): Promise<PlatformOffer> {
    return this.driver.createOffer(offer);
  }

  async findOfferById(offerId: string): Promise<PlatformOffer | null> {
    return this.driver.findOfferById(offerId);
  }

  async acceptOffer(requesterId: string, offerId: string): Promise<PlatformEngagement | null> {
    return this.driver.acceptOffer(requesterId, offerId);
  }

  async findEngagementById(engagementId: string): Promise<PlatformEngagement | null> {
    return this.driver.findEngagementById(engagementId);
  }

  async fundEngagement(
    engagementId: string,
    payment: PlatformPaymentRecord,
  ): Promise<PlatformEngagement | null> {
    return this.driver.fundEngagement(engagementId, payment);
  }

  async createResearchScenario(scenario: PlatformResearchScenario): Promise<PlatformResearchScenario> {
    return this.driver.createResearchScenario(scenario);
  }

  async findResearchScenarioById(scenarioId: string): Promise<PlatformResearchScenario | null> {
    return this.driver.findResearchScenarioById(scenarioId);
  }

  async createResearchRequest(request: PlatformResearchRequest): Promise<PlatformResearchRequest> {
    return this.driver.createResearchRequest(request);
  }

  async findResearchRequestById(requestId: string): Promise<PlatformResearchRequest | null> {
    return this.driver.findResearchRequestById(requestId);
  }

  async saveResearchRequest(request: PlatformResearchRequest): Promise<PlatformResearchRequest> {
    return this.driver.saveResearchRequest(request);
  }

  async replaceTrackedGrants(
    requestId: string,
    grants: PlatformTrackedGrant[],
  ): Promise<PlatformTrackedGrant[]> {
    return this.driver.replaceTrackedGrants(requestId, grants);
  }

  async findTrackedGrantById(grantId: string): Promise<PlatformTrackedGrant | null> {
    return this.driver.findTrackedGrantById(grantId);
  }

  async saveTrackedGrant(grant: PlatformTrackedGrant): Promise<PlatformTrackedGrant> {
    return this.driver.saveTrackedGrant(grant);
  }

  async findGrantReportByRequestId(requestId: string): Promise<PlatformGrantReport | null> {
    return this.driver.findGrantReportByRequestId(requestId);
  }

  async upsertGrantReport(report: PlatformGrantReport): Promise<PlatformGrantReport> {
    return this.driver.upsertGrantReport(report);
  }

  async findGrantCatalogEntryById(grantId: string): Promise<PlatformGrantCatalogEntry | null> {
    return this.driver.findGrantCatalogEntryById(grantId);
  }

  async findGrantCatalogEntryBySourceGrantId(
    sourceGrantId: string,
  ): Promise<PlatformGrantCatalogEntry | null> {
    return this.driver.findGrantCatalogEntryBySourceGrantId(sourceGrantId);
  }

  async saveGrantCatalogEntry(grant: PlatformGrantCatalogEntry): Promise<PlatformGrantCatalogEntry> {
    return this.driver.saveGrantCatalogEntry(grant);
  }

  async setGrantBookmark(userId: string, grantId: string, bookmarked: boolean): Promise<boolean> {
    return this.driver.setGrantBookmark(userId, grantId, bookmarked);
  }

  async findGrantApplicationSchemaByCatalogGrantId(
    catalogGrantId: string,
  ): Promise<PlatformGrantApplicationSchema | null> {
    return this.driver.findGrantApplicationSchemaByCatalogGrantId(catalogGrantId);
  }

  async upsertGrantApplicationSchema(
    schema: PlatformGrantApplicationSchema,
  ): Promise<PlatformGrantApplicationSchema> {
    return this.driver.upsertGrantApplicationSchema(schema);
  }

  async createApplicationTemplate(template: PlatformApplicationTemplate): Promise<PlatformApplicationTemplate> {
    return this.driver.createApplicationTemplate(template);
  }

  async findApplicationTemplateById(templateId: string): Promise<PlatformApplicationTemplate | null> {
    return this.driver.findApplicationTemplateById(templateId);
  }

  async createApplicationWorkspace(workspace: PlatformApplicationWorkspace): Promise<PlatformApplicationWorkspace> {
    return this.driver.createApplicationWorkspace(workspace);
  }

  async findApplicationWorkspaceById(workspaceId: string): Promise<PlatformApplicationWorkspace | null> {
    return this.driver.findApplicationWorkspaceById(workspaceId);
  }

  async saveApplicationWorkspace(workspace: PlatformApplicationWorkspace): Promise<PlatformApplicationWorkspace> {
    return this.driver.saveApplicationWorkspace(workspace);
  }

  async createProposalWorkspace(workspace: PlatformProposalWorkspace): Promise<PlatformProposalWorkspace> {
    return this.driver.createProposalWorkspace(workspace);
  }

  async findProposalWorkspaceById(workspaceId: string): Promise<PlatformProposalWorkspace | null> {
    return this.driver.findProposalWorkspaceById(workspaceId);
  }

  async findProposalWorkspaceByTrackedGrantId(grantId: string): Promise<PlatformProposalWorkspace | null> {
    return this.driver.findProposalWorkspaceByTrackedGrantId(grantId);
  }

  async saveProposalWorkspace(workspace: PlatformProposalWorkspace): Promise<PlatformProposalWorkspace> {
    return this.driver.saveProposalWorkspace(workspace);
  }

  async createAgentProviderConnection(
    connection: PlatformAgentProviderConnection,
  ): Promise<PlatformAgentProviderConnection> {
    return this.driver.createAgentProviderConnection(connection);
  }

  async findAgentProviderConnectionById(connectionId: string): Promise<PlatformAgentProviderConnection | null> {
    return this.driver.findAgentProviderConnectionById(connectionId);
  }

  async createAgentExecutionRecord(record: PlatformAgentExecutionRecord): Promise<PlatformAgentExecutionRecord> {
    return this.driver.createAgentExecutionRecord(record);
  }

  async close(): Promise<void> {
    await this.pool?.end();
  }
}
