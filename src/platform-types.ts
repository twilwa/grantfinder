// ABOUTME: Defines the persistent marketplace, auth, and payment types for the web application shell.
// ABOUTME: These types keep the HTTP surfaces, browser UI, and service layer aligned around one data model.

import type { FundingReport } from "./report.js";
import type { BusinessScenario, ResearchBrief } from "./types.js";

export type UserRole = "requester" | "specialist";
export type JobType = "general" | "grant_proposal";
export type ResearchRequestStatus = "draft" | "running" | "completed" | "failed";
export type GrantQueueState = "active" | "inactive";
export type ResearchRunPhase =
  | "idle"
  | "briefing"
  | "searching"
  | "reading"
  | "synthesizing"
  | "publishing"
  | "completed"
  | "failed";
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
  proposalJobId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PlatformState {
  users: PlatformUser[];
  agentTokens: PlatformAgentToken[];
  jobs: PlatformJob[];
  offers: PlatformOffer[];
  engagements: PlatformEngagement[];
  researchScenarios: PlatformResearchScenario[];
  researchRequests: PlatformResearchRequest[];
  trackedGrants: PlatformTrackedGrant[];
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
    agentTokens: [],
    jobs: [],
    offers: [],
    engagements: [],
    researchScenarios: [],
    researchRequests: [],
    trackedGrants: [],
  };
}
