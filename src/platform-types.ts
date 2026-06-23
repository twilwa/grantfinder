// ABOUTME: Defines the persistent marketplace, auth, and payment types for the web application shell.
// ABOUTME: These types keep the HTTP surfaces, browser UI, and service layer aligned around one data model.

import type { FundingOpportunity, FundingReport, RejectedLead } from "./report.js";
import type { BusinessScenario, ResearchBrief } from "./types.js";

export type UserRole = "requester" | "specialist";
export type JobType = "general" | "grant_proposal";
export type ApplicationDocumentType = "grant_proposal" | "loi" | "budget_narrative" | "other";
export type OrganizationType =
  | "nonprofit"
  | "fiscal_sponsor"
  | "school"
  | "government"
  | "tribal_entity"
  | "for_profit"
  | "other";
export type OrganizationOperatingScope = "local" | "regional" | "national" | "international";
export type OrganizationPersonnelAccessState = "none" | "invited" | "active";
export type ResearchRequestStatus = "draft" | "running" | "completed" | "failed";
export type GrantQueueState = "active" | "inactive";
export type GrantCatalogSourceType = "promoted" | "curated" | "research";
export type ApplicationWorkspaceState = "draft" | "proposal";
export type ProposalWorkspaceStage =
  | "qualifying"
  | "drafting"
  | "outreach"
  | "submitted"
  | "awarded"
  | "declined"
  | "no_bid";
export type ProposalOpportunitySourceType = "tracked_grant" | "catalog_grant" | "manual";
export type ProposalFeasibilityConfidence = "high" | "medium" | "low";
export type ProposalOutcomeStatus = "submitted" | "awarded" | "declined" | "no_bid";
export type ProposalOutreachKind = "email" | "call" | "meeting" | "note" | "other";
export type ProposalOutreachDirection = "outbound" | "inbound";
export const DEFAULT_REPOSITORY_ROOT_PATH = "grantfinder/";
export type RepositoryBindingSourceKind = "tracked_grant" | "catalog_grant" | "proposal_workspace";
export type RepositoryPublicationStatus = "blocked" | "failed" | "published";
export type ServiceTargetType =
  | "grant_catalog_entry"
  | "application_workspace"
  | "workspace_section"
  | "proposal_workspace";
export type AgentExecutionTargetType = ServiceTargetType | "tracked_grant";
export type SpecialistServiceRole = "researcher" | "writer" | "reviewer" | "submission_specialist";
export type AgentProviderConnectionScope = "user" | "organization";
export type AgentProviderAuthType = "byok" | "oauth";
export type ResearchRunPhase =
  | "idle"
  | "briefing"
  | "searching"
  | "reading"
  | "synthesizing"
  | "publishing"
  | "completed"
  | "failed";
export type FeatureAudienceType = "user" | "organization" | "role";
export type ResearchActivityKind = "status" | "tool" | "steering";
export type ResearchActivityTone = "neutral" | "good" | "warn" | "bad";
export type ResearchSteeringStatus = "queued" | "applied";

export interface PlatformResearchActivity {
  id: string;
  kind: ResearchActivityKind;
  title: string;
  detail: string;
  tone: ResearchActivityTone;
  timestamp: string;
}

export interface PlatformResearchSteeringNote {
  id: string;
  prompt: string;
  status: ResearchSteeringStatus;
  createdAt: string;
  appliedAt: string | null;
}

export interface PlatformRepositoryPublication {
  status: RepositoryPublicationStatus;
  branch: string | null;
  commitSha: string | null;
  pullRequestUrl: string | null;
  publishedAt: string | null;
  errorMessage: string | null;
}

export interface PlatformRepositoryBinding {
  repositoryUrl: string;
  baseBranch: string;
  rootPath: string;
  privyGitHubAccountId: string;
  providerConnectionId: string;
  attachedByUserId: string;
  attachedAt: string;
  updatedAt: string;
  latestPublication: PlatformRepositoryPublication | null;
}

export interface PlatformRepositoryBindingSource {
  kind: RepositoryBindingSourceKind;
  id: string;
}

export interface PlatformUser {
  id: string;
  privyUserId: string | null;
  name: string;
  role: UserRole;
  walletAddress: string | null;
  smartWalletAddress: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PlatformOrganizationPersonnel {
  id: string;
  fullName: string;
  roleTitle: string;
  yearsExperience: number | null;
  email: string | null;
  userId: string | null;
  platformAccessEnabled: boolean;
  accessState: OrganizationPersonnelAccessState;
  canManageInvites: boolean;
  invite: PlatformOrganizationInvite | null;
}

export interface PlatformOrganizationInvite {
  id: string;
  invitePath: string;
  createdAt: string;
  acceptedAt: string | null;
}

export interface PlatformOrganizationPrefill {
  organizationName: string;
  website: string | null;
  registrationCountry: string;
  registrationRegion: string | null;
  organizationType: OrganizationType;
  operatingScope: OrganizationOperatingScope;
  localOperatingAreas: string[];
  missionStatement: string;
  programs: string[];
  targetDemographics: string[];
  thematicAreas: string[];
  annualOperatingBudget: string;
  strategicPriorities: string[];
  capturedAt: string;
}

export interface PlatformOrganization {
  id: string;
  ownerUserId: string;
  name: string;
  website: string | null;
  registrationCountry: string;
  registrationRegion: string | null;
  organizationType: OrganizationType;
  operatingScope: OrganizationOperatingScope;
  localOperatingAreas: string[];
  missionStatement: string;
  programs: string[];
  targetDemographics: string[];
  thematicAreas: string[];
  annualOperatingBudget: string;
  strategicPriorities: string[];
  emailUpdatesEnabled: boolean;
  personnel: PlatformOrganizationPersonnel[];
  createdAt: string;
  updatedAt: string;
}

export interface PlatformAgentToken {
  id: string;
  userId: string;
  label: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

export interface PlatformJob {
  id: string;
  requesterId: string;
  type: JobType;
  grantId: string | null;
  catalogGrantId: string | null;
  targetType: ServiceTargetType | null;
  targetId: string | null;
  specialistRole: SpecialistServiceRole | null;
  title: string;
  description: string;
  fundingNeed: string;
  status: "open" | "matched";
  createdAt: string;
}

export interface PlatformOffer {
  id: string;
  jobId: string;
  specialistId: string;
  specialistRole: SpecialistServiceRole | null;
  message: string;
  amountUsd: string;
  payoutAddress: string;
  status: "pending" | "accepted" | "rejected";
  createdAt: string;
  acceptedAt: string | null;
}

export interface PlatformPaymentRecord {
  protocol: "x402";
  amountUsd: string;
  network: string;
  payTo: string;
  facilitatorUrl: string;
  paymentHeader: string | null;
  fundedByUserId: string;
}

export interface PlatformEngagement {
  id: string;
  jobId: string;
  offerId: string;
  requesterId: string;
  specialistId: string;
  targetType: ServiceTargetType | null;
  targetId: string | null;
  specialistRole: SpecialistServiceRole | null;
  amountUsd: string;
  payoutAddress: string;
  status: "pending_funding" | "funded";
  createdAt: string;
  fundedAt: string | null;
  payment: PlatformPaymentRecord | null;
}

export interface PlatformResearchScenario extends BusinessScenario {
  ownerUserId: string | null;
  sourceType: "custom" | "fixture";
  createdAt: string;
  updatedAt: string;
}

export interface PlatformResearchRequest {
  id: string;
  requesterId: string;
  scenarioId: string;
  sourceCatalogGrantId: string | null;
  researchFocus: string | null;
  organizationPrefill: PlatformOrganizationPrefill | null;
  status: ResearchRequestStatus;
  runPhase: ResearchRunPhase;
  progressSummary: string | null;
  runStartedAt: string | null;
  latestBrief: ResearchBrief | null;
  latestReport: FundingReport | null;
  errorMessage: string | null;
  activity: PlatformResearchActivity[];
  steeringNotes: PlatformResearchSteeringNote[];
  createdAt: string;
  updatedAt: string;
  lastRunAt: string | null;
}

export interface PlatformTrackedGrant {
  id: string;
  requestId: string;
  requesterId: string;
  catalogGrantId: string | null;
  repositoryBinding: PlatformRepositoryBinding | null;
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
  queueState: GrantQueueState;
  proposalWorkspaceId: string | null;
  proposalJobId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PlatformGrantReport {
  id: string;
  requestId: string;
  requesterId: string;
  businessCaseId: string;
  executiveSummary: string;
  searchSummary: string;
  opportunities: FundingOpportunity[];
  rejectedLeads: RejectedLead[];
  nextActions: string[];
  createdAt: string;
  updatedAt: string;
}

export interface PlatformGrantCatalogEntry {
  id: string;
  createdByUserId: string;
  sourceType: GrantCatalogSourceType;
  sourceGrantId: string | null;
  sourceReportId: string | null;
  lastResearchRequestId: string | null;
  repositoryBinding: PlatformRepositoryBinding | null;
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
  createdAt: string;
  updatedAt: string;
}

export interface PlatformGrantBookmark {
  id: string;
  userId: string;
  grantId: string;
  createdAt: string;
}

export interface PlatformApplicationSectionValidation {
  minWords: number | null;
  maxWords: number | null;
}

export interface PlatformApplicationSectionDefinition {
  id: string;
  key: string;
  title: string;
  stepName: string | null;
  prompt: string | null;
  examples: string[];
  validation: PlatformApplicationSectionValidation;
}

export interface PlatformApplicationWorkspaceSection extends PlatformApplicationSectionDefinition {
  orderIndex: number;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface PlatformGrantApplicationSchema {
  id: string;
  catalogGrantId: string;
  name: string;
  documentType: ApplicationDocumentType;
  sections: PlatformApplicationSectionDefinition[];
  createdAt: string;
  updatedAt: string;
}

export interface PlatformApplicationTemplate {
  id: string;
  ownerUserId: string;
  name: string;
  documentType: ApplicationDocumentType;
  sections: PlatformApplicationSectionDefinition[];
  createdAt: string;
  updatedAt: string;
}

export interface PlatformApplicationWorkspace {
  id: string;
  requesterId: string;
  catalogGrantId: string | null;
  templateId: string | null;
  organizationPrefill: PlatformOrganizationPrefill | null;
  documentType: ApplicationDocumentType;
  title: string;
  state: ApplicationWorkspaceState;
  sections: PlatformApplicationWorkspaceSection[];
  createdAt: string;
  updatedAt: string;
  finalizedAt: string | null;
}

export interface PlatformProposalOpportunity {
  sourceType: ProposalOpportunitySourceType;
  title: string;
  sponsor: string;
  fundingType: string;
  amountSummary: string | null;
  deadlineSummary: string | null;
  geography: string | null;
  sourceUrl: string | null;
  notes: string | null;
}

export interface PlatformProposalFeasibilitySnapshot {
  verdict: string;
  confidence: ProposalFeasibilityConfidence;
  blockers: string[];
  assumptions: string[];
  requiredDocuments: string[];
  recommendedNextStep: string;
  updatedAt: string;
}

export interface PlatformProposalContact {
  id: string;
  name: string;
  roleTitle: string | null;
  email: string | null;
  phone: string | null;
  organization: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PlatformProposalOutreachEvent {
  id: string;
  kind: ProposalOutreachKind;
  direction: ProposalOutreachDirection;
  subject: string | null;
  summary: string;
  occurredAt: string;
  createdAt: string;
}

export interface PlatformProposalOutcome {
  status: ProposalOutcomeStatus;
  summary: string;
  recordedAt: string;
}

export interface PlatformProposalWorkspace {
  id: string;
  ownerUserId: string;
  organizationId: string | null;
  trackedGrantId: string | null;
  catalogGrantId: string | null;
  repositoryBinding: PlatformRepositoryBinding | null;
  opportunity: PlatformProposalOpportunity;
  stage: ProposalWorkspaceStage;
  summary: string;
  nextSteps: string[];
  openQuestions: string[];
  primaryApplicationWorkspaceId: string | null;
  feasibilitySnapshot: PlatformProposalFeasibilitySnapshot | null;
  contacts: PlatformProposalContact[];
  outreachEvents: PlatformProposalOutreachEvent[];
  outcome: PlatformProposalOutcome | null;
  proposalJobId: string | null;
  engagementId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PlatformAgentProviderConnection {
  id: string;
  scope: AgentProviderConnectionScope;
  ownerUserId: string | null;
  organizationId: string | null;
  provider: string;
  label: string;
  authType: AgentProviderAuthType;
  allowedArtifactTypes: ServiceTargetType[];
  createdAt: string;
  updatedAt: string;
}

export interface PlatformAgentExecutionRecord {
  id: string;
  actorUserId: string;
  providerConnectionId: string;
  targetType: AgentExecutionTargetType;
  targetId: string;
  action: string;
  outputText: string;
  createdAt: string;
}

export interface PlatformFeatureFlag {
  id: string;
  key: string;
  description: string;
  defaultEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PlatformFeatureFlagTarget {
  id: string;
  flagId: string;
  audienceType: FeatureAudienceType;
  audienceId: string;
  enabled: boolean;
  createdAt: string;
}

export interface PlatformState {
  users: PlatformUser[];
  organizations: PlatformOrganization[];
  agentTokens: PlatformAgentToken[];
  jobs: PlatformJob[];
  offers: PlatformOffer[];
  engagements: PlatformEngagement[];
  researchScenarios: PlatformResearchScenario[];
  researchRequests: PlatformResearchRequest[];
  trackedGrants: PlatformTrackedGrant[];
  grantReports: PlatformGrantReport[];
  grantCatalogEntries: PlatformGrantCatalogEntry[];
  grantBookmarks: PlatformGrantBookmark[];
  grantApplicationSchemas: PlatformGrantApplicationSchema[];
  applicationTemplates: PlatformApplicationTemplate[];
  applicationWorkspaces: PlatformApplicationWorkspace[];
  proposalWorkspaces: PlatformProposalWorkspace[];
  agentProviderConnections: PlatformAgentProviderConnection[];
  agentExecutionRecords: PlatformAgentExecutionRecord[];
  featureFlags: PlatformFeatureFlag[];
  featureFlagTargets: PlatformFeatureFlagTarget[];
}

export interface PlatformSessionIdentity {
  privyUserId: string;
}

export interface BrowserClientConfig {
  privyAppId: string | null;
  x402Mode: X402Settings["mode"];
}

export interface X402Settings {
  mode: "challenge" | "live";
  facilitatorUrl: string;
  network: `${string}:${string}`;
  payTo: string;
}

export interface FundingChallenge {
  protocol: "x402";
  engagementId: string;
  description: string;
  facilitatorUrl: string;
  network: `${string}:${string}`;
  payTo: string;
  amountUsd: string;
  route: string;
}

export function createEmptyPlatformState(): PlatformState {
  return {
    users: [],
    organizations: [],
    agentTokens: [],
    jobs: [],
    offers: [],
    engagements: [],
    researchScenarios: [],
    researchRequests: [],
    trackedGrants: [],
    grantReports: [],
    grantCatalogEntries: [],
    grantBookmarks: [],
    grantApplicationSchemas: [],
    applicationTemplates: [],
    applicationWorkspaces: [],
    proposalWorkspaces: [],
    agentProviderConnections: [],
    agentExecutionRecords: [],
    featureFlags: [],
    featureFlagTargets: [],
  };
}
