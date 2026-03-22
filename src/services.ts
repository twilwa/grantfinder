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
  PlatformAgentToken,
  PlatformEngagement,
  PlatformJob,
  PlatformOffer,
  PlatformResearchActivity,
  PlatformResearchRequest,
  PlatformResearchScenario,
  PlatformResearchSteeringNote,
  PlatformSessionIdentity,
  PlatformState,
  PlatformTrackedGrant,
  PlatformUser,
  ResearchRunPhase,
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

interface CreateJobInput {
  title: string;
  description: string;
  fundingNeed: string;
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
  marketplace: DashboardData;
  scenarios: ResearchScenarioSummary[];
  requests: WorkspaceRequest[];
  grants: WorkspaceGrant[];
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
    const timestamp = now();
    const request: PlatformResearchRequest = {
      id: makeId("request"),
      requesterId: user.id,
      scenarioId: scenario.id,
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
    const result = await this.executeResearch(scenario);

    return {
      scenario,
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
    const scenario = await this.loadScenarioForUser(user, runningRequest.scenarioId);
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

    return {
      user: this.toPublicUser(user),
      marketplace: {
        users: state.users.sort(byCreatedAt).map((candidate) => this.toPublicUser(candidate)),
        jobs: this.buildDashboardJobs(state),
        offers: this.buildDashboardOffers(state),
        engagements: this.buildDashboardEngagements(state),
      },
      scenarios: (await this.listResearchScenarios(user)).scenarios,
      requests,
      grants,
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

    const job: PlatformJob = {
      id: makeId("job"),
      requesterId: user.id,
      type: "general",
      grantId: null,
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
    if (toolName === "search_web") {
      return "searching";
    }

    if (toolName === "read_source_page") {
      return "reading";
    }

    if (toolName === "publish_report") {
      return "publishing";
    }

    return "synthesizing";
  }

  private titleForTool(toolName: string): string {
    if (toolName === "search_web") {
      return "Searching for opportunities";
    }

    if (toolName === "read_source_page") {
      return "Reading source material";
    }

    if (toolName === "publish_report") {
      return "Publishing structured report";
    }

    return `Running ${toolName}`;
  }

  private detailForTool(toolName: string, args: unknown): string {
    if (toolName === "search_web" && this.isRecord(args) && typeof args.query === "string") {
      return `Query: ${args.query}`;
    }

    if (toolName === "read_source_page" && this.isRecord(args) && typeof args.url === "string") {
      return `Source: ${args.url}`;
    }

    if (toolName === "publish_report") {
      return "Writing the final structured brief and opportunity report.";
    }

    return this.summarizeValue(args);
  }

  private progressSummaryForTool(toolName: string, args: unknown): string {
    if (toolName === "search_web" && this.isRecord(args) && typeof args.query === "string") {
      return `Searching the web for: ${args.query}`;
    }

    if (toolName === "read_source_page" && this.isRecord(args) && typeof args.url === "string") {
      return `Reading and verifying: ${args.url}`;
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

  private requireGrantQueueState(queueState: GrantQueueState): GrantQueueState {
    if (queueState !== "active" && queueState !== "inactive") {
      throw new AppError(400, "invalid_queue_state", "queueState must be active or inactive.");
    }

    return queueState;
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
