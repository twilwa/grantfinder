// ABOUTME: Persists Grantfinder users, agent tokens, marketplace records, and payments in memory or Postgres.
// ABOUTME: Tests use the in-memory path or an injected pg-compatible adapter while hosted runtime uses DATABASE_URL.

import { createHash } from "node:crypto";

import { Pool, type QueryResult, type QueryResultRow } from "pg";

import type {
  PlatformAgentToken,
  PlatformEngagement,
  PlatformJob,
  PlatformOffer,
  PlatformResearchActivity,
  PlatformPaymentRecord,
  PlatformResearchRequest,
  PlatformResearchScenario,
  PlatformResearchSteeringNote,
  PlatformState,
  PlatformTrackedGrant,
  PlatformUser,
} from "./platform-types.js";
import { createEmptyPlatformState } from "./platform-types.js";

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
    proposalJobId: row.proposal_job_id ? String(row.proposal_job_id) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
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
}

class PostgresStore {
  private readonly database: TransactionalQueryable;

  constructor(database: TransactionalQueryable) {
    this.database = database;
  }

  async readState(): Promise<PlatformState> {
    await this.ensureSchema();
    const [users, agentTokens, jobs, offers, engagements, payments, researchScenarios, researchRequests, trackedGrants] =
      await Promise.all([
      this.database.query("select * from users order by created_at desc"),
      this.database.query("select id, user_id, label, created_at, last_used_at, revoked_at from agent_tokens order by created_at desc"),
      this.database.query("select * from jobs order by created_at desc"),
      this.database.query("select * from offers order by created_at desc"),
      this.database.query("select * from engagements order by created_at desc"),
      this.database.query("select * from payments"),
      this.database.query("select * from research_scenarios order by created_at desc"),
      this.database.query("select * from research_requests order by created_at desc"),
      this.database.query("select * from tracked_grants order by created_at desc"),
    ]);

    const paymentsByEngagement = new Map<string, PlatformPaymentRecord>();
    for (const row of payments.rows as Record<string, unknown>[]) {
      paymentsByEngagement.set(String(row.engagement_id), toPayment(row));
    }

    return {
      users: (users.rows as Record<string, unknown>[]).map(toUser),
      agentTokens: (agentTokens.rows as Record<string, unknown>[]).map(toAgentToken),
      jobs: (jobs.rows as Record<string, unknown>[]).map(toJob),
      offers: (offers.rows as Record<string, unknown>[]).map(toOffer),
      engagements: (engagements.rows as Record<string, unknown>[]).map((row) =>
        toEngagement(row, paymentsByEngagement.get(String(row.id)) ?? null),
      ),
      researchScenarios: (researchScenarios.rows as Record<string, unknown>[]).map(toResearchScenario),
      researchRequests: (researchRequests.rows as Record<string, unknown>[]).map(toResearchRequest),
      trackedGrants: (trackedGrants.rows as Record<string, unknown>[]).map(toTrackedGrant),
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
      `insert into jobs (id, requester_id, type, grant_id, title, description, funding_need, status, created_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       returning *`,
      [
        job.id,
        job.requesterId,
        job.type,
        job.grantId,
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
        message,
        amount_usd,
        payout_address,
        status,
        created_at,
        accepted_at
      ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      returning *`,
      [
        offer.id,
        offer.jobId,
        offer.specialistId,
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
          amount_usd,
          payout_address,
          status,
          created_at,
          funded_at
        ) values ($1, $2, $3, $4, $5, $6, $7, 'pending_funding', $8, null)`,
        [engagementId, job.id, offer.id, requesterId, offer.specialistId, offer.amountUsd, offer.payoutAddress, now()],
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
      ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      returning *`,
      [
        request.id,
        request.requesterId,
        request.scenarioId,
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
           status = $3,
           run_phase = $4,
           progress_summary = $5,
           run_started_at = $6,
           brief_json = $7,
           report_json = $8,
           error_message = $9,
           activity_json = $10,
           steering_json = $11,
           updated_at = $12,
           last_run_at = $13
       where id = $1
       returning *`,
      [
        request.id,
        request.scenarioId,
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
            proposal_job_id,
            created_at,
            updated_at
          ) values (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
            $11, $12, $13, $14, $15, $16, $17, $18, $19
          )`,
          [
            grant.id,
            grant.requestId,
            grant.requesterId,
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
       set queue_state = $2,
           proposal_job_id = $3,
           updated_at = $4
       where id = $1
       returning *`,
      [grant.id, grant.queueState, grant.proposalJobId, grant.updatedAt],
    );
    return toTrackedGrant(result.rows[0] as Record<string, unknown>);
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
      create table if not exists jobs (
        id text primary key,
        requester_id text not null references users (id) on delete cascade,
        type text not null default 'general' check (type in ('general', 'grant_proposal')),
        grant_id text,
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
      create table if not exists offers (
        id text primary key,
        job_id text not null references jobs (id) on delete cascade,
        specialist_id text not null references users (id) on delete cascade,
        message text not null,
        amount_usd text not null,
        payout_address text not null,
        status text not null check (status in ('pending', 'accepted', 'rejected')),
        created_at text not null,
        accepted_at text
      )
    `);
    await this.database.query(`
      create table if not exists engagements (
        id text primary key,
        job_id text not null references jobs (id) on delete cascade,
        offer_id text not null unique references offers (id) on delete cascade,
        requester_id text not null references users (id) on delete cascade,
        specialist_id text not null references users (id) on delete cascade,
        amount_usd text not null,
        payout_address text not null,
        status text not null check (status in ('pending_funding', 'funded')),
        created_at text not null,
        funded_at text
      )
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
      create table if not exists tracked_grants (
        id text primary key,
        request_id text not null references research_requests (id) on delete cascade,
        requester_id text not null references users (id) on delete cascade,
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
        proposal_job_id text references jobs (id) on delete set null,
        created_at text not null,
        updated_at text not null
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

  async close(): Promise<void> {
    await this.pool?.end();
  }
}
