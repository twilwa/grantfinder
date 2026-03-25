// ABOUTME: Implements the authenticated browser workspace for marketplace, research requests, and tracked grants.
// ABOUTME: The client stays thin and uses the same REST routes exposed for curl and JSON-RPC users.

import { useEffect, useState, type FormEvent } from "react";
import { createRoot } from "react-dom/client";
import { PrivyProvider, usePrivy, useWallets } from "@privy-io/react-auth";
import { SmartWalletsProvider } from "@privy-io/react-auth/smart-wallets";
import { base, baseSepolia } from "viem/chains";

import type { BrowserClientConfig } from "./platform-types.js";
import {
  ApplicationWorkspaceView,
  CatalogWorkspaceView,
  OrganizationWorkspaceView,
  ProviderWorkspaceView,
  type AgentExecutionSummary,
  type ApplicationDocumentType,
  type ApplicationTemplateSummary,
  type ApplicationWorkspaceSummary,
  type CatalogGrantDetailPayload,
  type CatalogGrantSummary,
  type OrganizationProfileInput,
  type OrganizationPersonnelInput,
  type OrganizationSummary,
  type ProviderArtifactType,
  type ProviderAuthType,
  type ProviderConnectionScope,
  type ProviderConnectionSummary,
  type SectionDefinitionInput,
} from "./client-operations.js";
import {
  SectionCard,
  SidebarButton,
  StatusBadge,
  buttonStyle,
  formCardStyle,
  formatJson,
  formatTimestamp,
  inputStyle,
  parseJsonResponse,
  parseTextList,
  requestPhaseLabel,
  requestStatusTone,
  shellCardStyle,
  subtleCardStyle,
  textareaStyle,
  findSmartWalletAddress,
} from "./client-shared.js";

declare global {
  interface Window {
    __GRANTFINDER_CONFIG__?: BrowserClientConfig;
  }
}

type UserRole = "requester" | "specialist";
type WorkspaceTab =
  | "request-marketplace"
  | "research-dashboard"
  | "my-requests"
  | "my-grants"
  | "organization"
  | "catalog"
  | "applications"
  | "providers";

interface PublicUser {
  id: string;
  name: string;
  role: UserRole;
  walletAddress: string | null;
  smartWalletAddress: string | null;
}

interface DashboardJob {
  id: string;
  requesterId: string;
  type: "general" | "grant_proposal";
  grantId: string | null;
  title: string;
  description: string;
  fundingNeed: string;
  status: string;
  requesterName: string;
  offerCount: number;
  createdAt: string;
}

interface DashboardOffer {
  id: string;
  jobId: string;
  specialistId: string;
  jobTitle: string;
  specialistName: string;
  message: string;
  amountUsd: string;
  payoutAddress: string;
  status: string;
  acceptedAt: string | null;
  createdAt: string;
}

interface DashboardEngagement {
  id: string;
  jobId: string;
  requesterId: string;
  specialistId: string;
  jobTitle: string;
  requesterName: string;
  specialistName: string;
  amountUsd: string;
  payoutAddress: string;
  status: string;
  createdAt: string;
  fundedAt: string | null;
}

interface DashboardPayload {
  users: PublicUser[];
  jobs: DashboardJob[];
  offers: DashboardOffer[];
  engagements: DashboardEngagement[];
}

interface SessionPayload {
  authenticated: boolean;
  identity: {
    privyUserId: string;
  };
  user: PublicUser | null;
}

interface TokenPayload {
  tokens: Array<{
    id: string;
    label: string;
    createdAt: string;
    lastUsedAt: string | null;
    revokedAt: string | null;
  }>;
}

interface ResearchScenarioSummary {
  id: string;
  name: string;
  summary: string;
  sourceType: "fixture" | "custom";
}

interface WorkspaceRequest {
  id: string;
  requesterId: string;
  scenarioId: string;
  scenarioName: string;
  status: "draft" | "running" | "completed" | "failed";
  runPhase:
    | "idle"
    | "briefing"
    | "searching"
    | "reading"
    | "synthesizing"
    | "publishing"
    | "completed"
    | "failed";
  progressSummary: string | null;
  runStartedAt: string | null;
  latestBrief: unknown | null;
  latestReport: {
    executiveSummary?: string;
    searchSummary?: string;
    opportunities?: Array<{
      title: string;
    }>;
  } | null;
  errorMessage: string | null;
  activity: ResearchActivity[];
  steeringNotes: ResearchSteeringNote[];
  createdAt: string;
  updatedAt: string;
  lastRunAt: string | null;
  grantCount: number;
  activeGrantCount: number;
}

interface ResearchActivity {
  id: string;
  kind: "status" | "tool" | "steering";
  title: string;
  detail: string;
  tone: "neutral" | "good" | "warn" | "bad";
  timestamp: string;
}

interface ResearchSteeringNote {
  id: string;
  prompt: string;
  status: "queued" | "applied";
  createdAt: string;
  appliedAt: string | null;
}

interface WorkspaceGrant {
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
  queueState: "active" | "inactive";
  proposalJobId: string | null;
  createdAt: string;
  updatedAt: string;
  requestStatus: WorkspaceRequest["status"];
  scenarioName: string;
}

interface WorkspacePayload {
  user: PublicUser;
  organization: OrganizationSummary | null;
  marketplace: DashboardPayload;
  scenarios: ResearchScenarioSummary[];
  requests: WorkspaceRequest[];
  grants: WorkspaceGrant[];
  reports: Array<{
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
  }>;
  catalog: CatalogGrantSummary[];
  applicationTemplates: ApplicationTemplateSummary[];
  applicationWorkspaces: ApplicationWorkspaceSummary[];
  providerConnections: ProviderConnectionSummary[];
  executions: AgentExecutionSummary[];
}

interface ResearchRequestDetail extends WorkspaceRequest {
  grants: WorkspaceGrant[];
}

const config = window.__GRANTFINDER_CONFIG__ ?? { privyAppId: null, x402Mode: "challenge" as const };

function PrivyDashboardApp() {
  const { ready, authenticated, login, logout, getAccessToken, createWallet, user } = usePrivy();
  const { wallets } = useWallets();

  const [publicDashboard, setPublicDashboard] = useState<DashboardPayload | null>(null);
  const [workspace, setWorkspace] = useState<WorkspacePayload | null>(null);
  const [requestDetail, setRequestDetail] = useState<ResearchRequestDetail | null>(null);
  const [session, setSession] = useState<SessionPayload | null>(null);
  const [tokens, setTokens] = useState<TokenPayload["tokens"]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [latestSecret, setLatestSecret] = useState<string | null>(null);
  const [fundingChallenge, setFundingChallenge] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const [profileName, setProfileName] = useState("");
  const [profileRole, setProfileRole] = useState<UserRole>("requester");
  const [tokenLabel, setTokenLabel] = useState("cli");

  const [scenarioName, setScenarioName] = useState("");
  const [scenarioSummary, setScenarioSummary] = useState("");
  const [scenarioGeography, setScenarioGeography] = useState("United States");
  const [scenarioBusinessModel, setScenarioBusinessModel] = useState("");
  const [scenarioCustomers, setScenarioCustomers] = useState("");
  const [scenarioNeeds, setScenarioNeeds] = useState("");
  const [scenarioTags, setScenarioTags] = useState("");

  const [jobTitle, setJobTitle] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [jobNeed, setJobNeed] = useState("");

  const [offerMessage, setOfferMessage] = useState("");
  const [offerAmount, setOfferAmount] = useState("250.00");
  const [offerPayout, setOfferPayout] = useState("");
  const [steeringPrompt, setSteeringPrompt] = useState("");

  const [activeTab, setActiveTab] = useState<WorkspaceTab>("request-marketplace");
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [selectedGrantId, setSelectedGrantId] = useState<string | null>(null);
  const [selectedCatalogGrantId, setSelectedCatalogGrantId] = useState<string | null>(null);
  const [catalogGrantDetail, setCatalogGrantDetail] = useState<CatalogGrantDetailPayload | null>(null);

  const linkedAccounts = (user?.linkedAccounts as unknown[] | undefined) ?? [];
  const embeddedWalletAddress = wallets[0]?.address ?? null;
  const smartWalletAddress = findSmartWalletAddress(session?.user ?? null, linkedAccounts);

  async function authedFetch(path: string, init?: RequestInit) {
    const accessToken = await getAccessToken();
    const headers = new Headers(init?.headers);
    if (accessToken) {
      headers.set("Authorization", `Bearer ${accessToken}`);
    }
    if (init?.body && !headers.has("content-type")) {
      headers.set("content-type", "application/json");
    }

    return fetch(path, {
      ...init,
      headers,
    });
  }

  async function refreshPublicDashboard() {
    try {
      const response = await fetch("/api/dashboard");
      setPublicDashboard(await parseJsonResponse<DashboardPayload>(response));
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Failed to load dashboard.");
    }
  }

  async function refreshWorkspace() {
    if (!authenticated) {
      setWorkspace(null);
      return;
    }

    try {
      const response = await authedFetch("/api/workspace");
      setWorkspace(await parseJsonResponse<WorkspacePayload>(response));
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Failed to load workspace.");
    }
  }

  async function refreshCatalogGrantDetail(grantId: string, quiet = false) {
    if (!authenticated) {
      setCatalogGrantDetail(null);
      return;
    }

    try {
      const response = await authedFetch(`/api/catalog/grants/${grantId}`);
      setCatalogGrantDetail(await parseJsonResponse<CatalogGrantDetailPayload>(response));
    } catch (fetchError) {
      if (!quiet) {
        setError(fetchError instanceof Error ? fetchError.message : "Failed to load catalog grant detail.");
      }
    }
  }

  async function refreshRequestDetail(requestId: string, quiet = false) {
    if (!authenticated) {
      setRequestDetail(null);
      return;
    }

    try {
      const response = await authedFetch(`/api/research/requests/${requestId}`);
      const payload = await parseJsonResponse<{ request: ResearchRequestDetail }>(response);
      setRequestDetail(payload.request);
    } catch (fetchError) {
      if (!quiet) {
        setError(fetchError instanceof Error ? fetchError.message : "Failed to load request detail.");
      }
    }
  }

  async function refreshSession() {
    if (!authenticated) {
      setSession(null);
      setTokens([]);
      setWorkspace(null);
      return;
    }

    try {
      const response = await authedFetch("/api/auth/session");
      const nextSession = await parseJsonResponse<SessionPayload>(response);
      setSession(nextSession);

      if (nextSession.user) {
        const tokenResponse = await authedFetch("/api/auth/tokens");
        const tokenPayload = await parseJsonResponse<TokenPayload>(tokenResponse);
        setTokens(tokenPayload.tokens);
        await refreshWorkspace();
      } else {
        setTokens([]);
        setWorkspace(null);
      }
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Failed to load session.");
    }
  }

  function resetNotices() {
    setMessage(null);
    setError(null);
  }

  async function runAction(
    label: string,
    work: () => Promise<void>,
  ) {
    setBusyAction(label);
    resetNotices();

    try {
      await work();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "The request failed.");
    } finally {
      setBusyAction(null);
    }
  }

  useEffect(() => {
    void refreshPublicDashboard();
  }, []);

  useEffect(() => {
    if (!ready) {
      return;
    }

    void refreshSession();
  }, [ready, authenticated]);

  useEffect(() => {
    if (!session?.user) {
      return;
    }

    setProfileName(session.user.name);
    setProfileRole(session.user.role);
  }, [session?.user?.id, session?.user?.name, session?.user?.role]);

  useEffect(() => {
    if (embeddedWalletAddress && !offerPayout) {
      setOfferPayout(embeddedWalletAddress);
    }
  }, [embeddedWalletAddress]);

  useEffect(() => {
    const jobs = (workspace?.marketplace ?? publicDashboard)?.jobs ?? [];
    if (jobs.length === 0) {
      setSelectedJobId(null);
      return;
    }

    if (!selectedJobId || !jobs.some((job) => job.id === selectedJobId)) {
      setSelectedJobId(jobs[0].id);
    }
  }, [workspace?.marketplace.jobs, publicDashboard?.jobs, selectedJobId]);

  useEffect(() => {
    const requests = workspace?.requests ?? [];
    if (requests.length === 0) {
      setSelectedRequestId(null);
      setRequestDetail(null);
      return;
    }

    if (!selectedRequestId || !requests.some((request) => request.id === selectedRequestId)) {
      setSelectedRequestId(requests[0].id);
    }
  }, [workspace?.requests, selectedRequestId]);

  useEffect(() => {
    const grants = workspace?.grants ?? [];
    if (grants.length === 0) {
      setSelectedGrantId(null);
      return;
    }

    if (!selectedGrantId || !grants.some((grant) => grant.id === selectedGrantId)) {
      setSelectedGrantId(grants[0].id);
    }
  }, [workspace?.grants, selectedGrantId]);

  useEffect(() => {
    const catalog = workspace?.catalog ?? [];
    if (catalog.length === 0) {
      setSelectedCatalogGrantId(null);
      setCatalogGrantDetail(null);
      return;
    }

    if (!selectedCatalogGrantId || !catalog.some((grant) => grant.id === selectedCatalogGrantId)) {
      setSelectedCatalogGrantId(catalog[0].id);
    }
  }, [workspace?.catalog, selectedCatalogGrantId]);

  useEffect(() => {
    if (!selectedRequestId || !authenticated) {
      setRequestDetail(null);
      return;
    }

    void refreshRequestDetail(selectedRequestId);
  }, [selectedRequestId, authenticated]);

  useEffect(() => {
    if (!selectedCatalogGrantId || !authenticated) {
      setCatalogGrantDetail(null);
      return;
    }

    void refreshCatalogGrantDetail(selectedCatalogGrantId);
  }, [selectedCatalogGrantId, authenticated]);

  useEffect(() => {
    if (!selectedRequestId || requestDetail?.status !== "running") {
      return;
    }

    const timer = window.setInterval(() => {
      void refreshRequestDetail(selectedRequestId, true);
      void refreshWorkspace();
    }, 2000);

    return () => window.clearInterval(timer);
  }, [selectedRequestId, requestDetail?.status]);

  async function submitProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runAction("profile", async () => {
      const response = await authedFetch("/api/auth/profile", {
        method: "POST",
        body: JSON.stringify({
          name: profileName,
          role: profileRole,
          walletAddress: embeddedWalletAddress,
          smartWalletAddress,
        }),
      });
      await parseJsonResponse(response);
      setMessage("Profile saved.");
      await refreshSession();
      await refreshPublicDashboard();
    });
  }

  async function submitAgentToken(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runAction("agent-token", async () => {
      const response = await authedFetch("/api/auth/tokens", {
        method: "POST",
        body: JSON.stringify({ label: tokenLabel }),
      });
      const payload = await parseJsonResponse<{
        token: TokenPayload["tokens"][number];
        secret: string;
      }>(response);
      setLatestSecret(payload.secret);
      setMessage("Agent token created.");
      await refreshSession();
    });
  }

  async function saveOrganizationProfile(input: OrganizationProfileInput) {
    await runAction("organization-profile", async () => {
      const response = await authedFetch("/api/organization", {
        method: "PUT",
        body: JSON.stringify({
          ...input,
          personnel:
            workspace?.organization?.personnel.map((person) => ({
              fullName: person.fullName,
              roleTitle: person.roleTitle,
              yearsExperience: person.yearsExperience,
              email: person.email,
            })) ?? [],
        }),
      });
      const payload = await parseJsonResponse<{ organization: OrganizationSummary }>(response);
      setMessage(`Organization profile saved for ${payload.organization.name}.`);
      await refreshWorkspace();
    });
  }

  async function addOrganizationPersonnel(input: OrganizationPersonnelInput) {
    await runAction("organization-personnel", async () => {
      const response = await authedFetch("/api/organization/personnel", {
        method: "POST",
        body: JSON.stringify(input),
      });
      const payload = await parseJsonResponse<{ personnel: { fullName: string } }>(response);
      setMessage(`Added ${payload.personnel.fullName} to the organization team.`);
      await refreshWorkspace();
    });
  }

  async function acceptOrganizationInvite(inviteId: string) {
    await runAction(`organization-invite-${inviteId}`, async () => {
      await parseJsonResponse(
        await authedFetch(`/api/organization/invites/${inviteId}/accept`, {
          method: "POST",
        }),
      );
      setMessage("Invite accepted.");
      await refreshWorkspace();
    });
  }

  async function toggleCatalogBookmark(grantId: string, bookmarked: boolean) {
    await runAction(`catalog-bookmark-${grantId}`, async () => {
      await parseJsonResponse(
        await authedFetch(`/api/catalog/grants/${grantId}/bookmark`, {
          method: "PUT",
          body: JSON.stringify({ bookmarked }),
        }),
      );
      setMessage(bookmarked ? "Grant bookmarked." : "Grant removed from bookmarks.");
      await refreshWorkspace();
      await refreshCatalogGrantDetail(grantId, true);
    });
  }

  async function saveCatalogSchema(
    grantId: string,
    input: {
      name: string;
      documentType: ApplicationDocumentType;
      sections: SectionDefinitionInput[];
    },
  ) {
    await runAction(`catalog-schema-${grantId}`, async () => {
      await parseJsonResponse(
        await authedFetch(`/api/catalog/grants/${grantId}/schema`, {
          method: "PUT",
          body: JSON.stringify(input),
        }),
      );
      setMessage("Application schema saved.");
      await refreshCatalogGrantDetail(grantId);
    });
  }

  async function createApplicationTemplate(input: {
    name: string;
    documentType: ApplicationDocumentType;
    sections: SectionDefinitionInput[];
  }) {
    await runAction("application-template", async () => {
      const response = await authedFetch("/api/application-templates", {
        method: "POST",
        body: JSON.stringify(input),
      });
      const payload = await parseJsonResponse<{ template: ApplicationTemplateSummary }>(response);
      setMessage(`Template "${payload.template.name}" saved.`);
      await refreshWorkspace();
      setActiveTab("applications");
    });
  }

  async function createApplicationWorkspace(input: {
    catalogGrantId?: string | null;
    templateId?: string | null;
    documentType: ApplicationDocumentType;
  }) {
    const actionKey = input.catalogGrantId ? `catalog-workspace-${input.catalogGrantId}` : "application-workspace";
    await runAction(actionKey, async () => {
      const response = await authedFetch("/api/application-workspaces", {
        method: "POST",
        body: JSON.stringify({
          catalogGrantId: input.catalogGrantId ?? null,
          templateId: input.templateId ?? null,
          documentType: input.documentType,
        }),
      });
      const payload = await parseJsonResponse<{ workspace: ApplicationWorkspaceSummary }>(response);
      setMessage(`Workspace "${payload.workspace.title}" created.`);
      await refreshWorkspace();
      setActiveTab("applications");
    });
  }

  async function updateApplicationWorkspaceSection(workspaceId: string, sectionId: string, content: string) {
    await runAction(`application-section-${sectionId}`, async () => {
      await parseJsonResponse(
        await authedFetch(`/api/application-workspaces/${workspaceId}/sections/${sectionId}`, {
          method: "PATCH",
          body: JSON.stringify({ content }),
        }),
      );
      setMessage("Workspace section saved.");
      await refreshWorkspace();
    });
  }

  async function generateApplicationWorkspaceSection(
    workspaceId: string,
    sectionId: string,
    providerConnectionId: string | null,
  ) {
    await runAction(`application-generate-${sectionId}`, async () => {
      await parseJsonResponse(
        await authedFetch(`/api/application-workspaces/${workspaceId}/sections/${sectionId}/generate`, {
          method: "POST",
          body: JSON.stringify(providerConnectionId ? { providerConnectionId } : {}),
        }),
      );
      setMessage("Generated a fresh section draft.");
      await refreshWorkspace();
    });
  }

  async function finalizeApplicationWorkspace(workspaceId: string) {
    await runAction(`application-finalize-${workspaceId}`, async () => {
      await parseJsonResponse(
        await authedFetch(`/api/application-workspaces/${workspaceId}/finalize`, {
          method: "POST",
        }),
      );
      setMessage("Application workspace finalized.");
      await refreshWorkspace();
    });
  }

  async function createProviderConnection(input: {
    scope: ProviderConnectionScope;
    provider: string;
    label: string;
    authType: ProviderAuthType;
    allowedArtifactTypes: ProviderArtifactType[];
  }) {
    await runAction("provider-connection", async () => {
      const response = await authedFetch("/api/provider-connections", {
        method: "POST",
        body: JSON.stringify(input),
      });
      const payload = await parseJsonResponse<{ connection: ProviderConnectionSummary }>(response);
      setMessage(`Provider connection "${payload.connection.label}" saved.`);
      await refreshWorkspace();
      setActiveTab("providers");
    });
  }

  async function submitScenario(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runAction("scenario", async () => {
      const response = await authedFetch("/api/research/scenarios", {
        method: "POST",
        body: JSON.stringify({
          name: scenarioName,
          summary: scenarioSummary,
          geography: scenarioGeography,
          businessModel: scenarioBusinessModel,
          customers: parseTextList(scenarioCustomers),
          needs: parseTextList(scenarioNeeds),
          tags: parseTextList(scenarioTags),
        }),
      });
      const payload = await parseJsonResponse<{ scenario: ResearchScenarioSummary }>(response);
      setScenarioName("");
      setScenarioSummary("");
      setScenarioBusinessModel("");
      setScenarioCustomers("");
      setScenarioNeeds("");
      setScenarioTags("");
      setMessage(`Scenario "${payload.scenario.name}" saved.`);
      await refreshWorkspace();
    });
  }

  async function createResearchRequestFromScenario(scenarioId: string) {
    await runAction(`request-${scenarioId}`, async () => {
      const response = await authedFetch("/api/research/requests", {
        method: "POST",
        body: JSON.stringify({ scenarioId }),
      });
      const payload = await parseJsonResponse<{ request: WorkspaceRequest }>(response);
      setSelectedRequestId(payload.request.id);
      setActiveTab("my-requests");
      setMessage(`Created request for ${payload.request.scenarioName ?? "selected scenario"}.`);
      await refreshWorkspace();
    });
  }

  async function runResearchRequest(requestId: string) {
    await runAction(`run-${requestId}`, async () => {
      const response = await authedFetch(`/api/research/requests/${requestId}/run`, {
        method: "POST",
        body: JSON.stringify({ awaitCompletion: false }),
      });
      await parseJsonResponse(response);
      setSelectedRequestId(requestId);
      setActiveTab("my-requests");
      setMessage("Research request started.");
      await refreshWorkspace();
      await refreshRequestDetail(requestId);
    });
  }

  async function submitSteering(requestId: string, prompt: string) {
    await runAction(`steer-${requestId}`, async () => {
      const response = await authedFetch(`/api/research/requests/${requestId}/steer`, {
        method: "POST",
        body: JSON.stringify({ prompt }),
      });
      const payload = await parseJsonResponse<{ request: ResearchRequestDetail }>(response);
      setRequestDetail(payload.request);
      setSteeringPrompt("");
      setMessage("Steering note queued for the active research run.");
      await refreshWorkspace();
    });
  }

  async function submitJob(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runAction("job", async () => {
      await parseJsonResponse(
        await authedFetch("/api/jobs", {
          method: "POST",
          body: JSON.stringify({
            title: jobTitle,
            description: jobDescription,
            fundingNeed: jobNeed,
          }),
        }),
      );
      setJobTitle("");
      setJobDescription("");
      setJobNeed("");
      setMessage("Marketplace request created.");
      await refreshPublicDashboard();
      await refreshWorkspace();
    });
  }

  async function submitOffer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedJobId) {
      setError("Choose a marketplace request before submitting an offer.");
      return;
    }

    await runAction("offer", async () => {
      await parseJsonResponse(
        await authedFetch(`/api/jobs/${selectedJobId}/offers`, {
          method: "POST",
          body: JSON.stringify({
            message: offerMessage,
            amountUsd: offerAmount,
            payoutAddress: offerPayout,
          }),
        }),
      );
      setOfferMessage("");
      setMessage("Offer submitted.");
      await refreshPublicDashboard();
      await refreshWorkspace();
    });
  }

  async function acceptOffer(offerId: string) {
    await runAction(`accept-${offerId}`, async () => {
      await parseJsonResponse(
        await authedFetch(`/api/offers/${offerId}/accept`, {
          method: "POST",
        }),
      );
      setMessage("Offer accepted.");
      await refreshPublicDashboard();
      await refreshWorkspace();
    });
  }

  async function requestFundingChallenge(engagementId: string) {
    await runAction(`fund-${engagementId}`, async () => {
      setFundingChallenge(null);
      const response = await authedFetch(`/api/engagements/${engagementId}/fund`, {
        method: "POST",
      });

      if (response.status === 402) {
        const payload = await response.json();
        setFundingChallenge(formatJson(payload));
        setMessage("Funding challenge prepared.");
        return;
      }

      await parseJsonResponse(response);
      setMessage("Engagement funded.");
      await refreshPublicDashboard();
      await refreshWorkspace();
    });
  }

  async function updateGrantQueue(grantId: string, queueState: "active" | "inactive") {
    await runAction(`grant-${grantId}`, async () => {
      await parseJsonResponse(
        await authedFetch(`/api/grants/${grantId}`, {
          method: "PATCH",
          body: JSON.stringify({ queueState }),
        }),
      );
      setMessage(`Grant moved to the ${queueState} queue.`);
      await refreshWorkspace();
    });
  }

  async function createProposalJob(grantId: string) {
    await runAction(`proposal-${grantId}`, async () => {
      await parseJsonResponse(
        await authedFetch(`/api/grants/${grantId}/proposal-job`, {
          method: "POST",
        }),
      );
      setMessage("Proposal-writing job created in the marketplace.");
      setActiveTab("request-marketplace");
      await refreshPublicDashboard();
      await refreshWorkspace();
    });
  }

  const needsProfile = authenticated && session?.user === null;
  const isRequester = session?.user?.role === "requester";
  const isSpecialist = session?.user?.role === "specialist";
  const dashboard = workspace?.marketplace ?? publicDashboard;
  const scenarios = workspace?.scenarios ?? [];
  const requests = workspace?.requests ?? [];
  const grants = workspace?.grants ?? [];
  const catalog = workspace?.catalog ?? [];
  const applicationTemplates = workspace?.applicationTemplates ?? [];
  const applicationWorkspaces = workspace?.applicationWorkspaces ?? [];
  const providerConnections = workspace?.providerConnections ?? [];
  const executions = workspace?.executions ?? [];
  const organization = workspace?.organization ?? null;
  const selectedJob = dashboard?.jobs.find((job) => job.id === selectedJobId) ?? null;
  const selectedRequestSummary = requests.find((request) => request.id === selectedRequestId) ?? null;
  const selectedRequest =
    requestDetail && requestDetail.id === selectedRequestId ? requestDetail : selectedRequestSummary;
  const selectedGrant = grants.find((grant) => grant.id === selectedGrantId) ?? null;
  const selectedCatalogGrantSummary = catalog.find((grant) => grant.id === selectedCatalogGrantId) ?? null;
  const selectedJobOffers = dashboard?.offers.filter((offer) => offer.jobId === selectedJob?.id) ?? [];
  const selectedRequestGrants =
    requestDetail && requestDetail.id === selectedRequestId
      ? requestDetail.grants
      : grants.filter((grant) => grant.requestId === selectedRequest?.id);
  const selectedGrantJob = dashboard?.jobs.find((job) => job.id === selectedGrant?.proposalJobId) ?? null;
  const selectedCatalogGrant =
    catalogGrantDetail && catalogGrantDetail.grant.id === selectedCatalogGrantId
      ? catalogGrantDetail
      : selectedCatalogGrantSummary
        ? { grant: selectedCatalogGrantSummary, schema: null }
        : null;
  const ownerCanAcceptSelectedOffers = Boolean(
    session?.user && selectedJob && session.user.id === selectedJob.requesterId && isRequester,
  );
  const roleActionNote = isRequester
    ? null
    : "Switch back to requester mode to author scenarios, run research, or manage grant queue items.";

  function renderMarketplaceTab() {
    return (
      <div style={{ display: "grid", gap: "1rem" }}>
        <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
          <SectionCard
            title="Marketplace request"
            description={
              isRequester
                ? "Create a new request for general grant support or proposal-writing help."
                : "Requester actions are disabled while you are in specialist mode."
            }
          >
            {isRequester ? (
              <form onSubmit={submitJob} style={formCardStyle}>
                <label>
                  <span>Title</span>
                  <input style={inputStyle} value={jobTitle} onChange={(event) => setJobTitle(event.target.value)} />
                </label>
                <label>
                  <span>Description</span>
                  <textarea
                    style={textareaStyle}
                    value={jobDescription}
                    onChange={(event) => setJobDescription(event.target.value)}
                  />
                </label>
                <label>
                  <span>Funding need</span>
                  <input style={inputStyle} value={jobNeed} onChange={(event) => setJobNeed(event.target.value)} />
                </label>
                <button style={buttonStyle(busyAction === "job")} disabled={busyAction === "job"} type="submit">
                  Create request
                </button>
              </form>
            ) : (
              <p style={{ margin: 0, color: "#566154" }}>{roleActionNote}</p>
            )}
          </SectionCard>

          <SectionCard
            title="Specialist offer"
            description={
              isSpecialist
                ? "Choose a request from the marketplace list and submit your offer."
                : "Switch to specialist mode when you want to bid on open requests."
            }
          >
            {isSpecialist ? (
              <form onSubmit={submitOffer} style={formCardStyle}>
                <label>
                  <span>Selected request</span>
                  <input style={inputStyle} value={selectedJob?.title ?? "None selected"} readOnly />
                </label>
                <label>
                  <span>Message</span>
                  <textarea
                    style={textareaStyle}
                    value={offerMessage}
                    onChange={(event) => setOfferMessage(event.target.value)}
                  />
                </label>
                <label>
                  <span>Amount (USD)</span>
                  <input style={inputStyle} value={offerAmount} onChange={(event) => setOfferAmount(event.target.value)} />
                </label>
                <label>
                  <span>Payout address</span>
                  <input style={inputStyle} value={offerPayout} onChange={(event) => setOfferPayout(event.target.value)} />
                </label>
                <button
                  style={buttonStyle(busyAction === "offer" || !selectedJobId)}
                  disabled={busyAction === "offer" || !selectedJobId}
                  type="submit"
                >
                  Submit offer
                </button>
              </form>
            ) : (
              <p style={{ margin: 0, color: "#566154" }}>
                Switch to specialist mode when you want to submit offers.
              </p>
            )}
          </SectionCard>
        </div>

        <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "minmax(0, 1.15fr) minmax(0, 0.85fr)" }}>
          <SectionCard title="Open requests" description="Browse the marketplace and pick a request to inspect.">
            {dashboard?.jobs.length ? (
              <div style={{ display: "grid", gap: "0.75rem" }}>
                {dashboard.jobs.map((job) => (
                  <button
                    key={job.id}
                    type="button"
                    onClick={() => setSelectedJobId(job.id)}
                    style={{
                      ...subtleCardStyle,
                      border:
                        selectedJobId === job.id
                          ? "1px solid rgba(36, 84, 58, 0.3)"
                          : "1px solid rgba(216, 204, 184, 0.95)",
                      textAlign: "left",
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "start" }}>
                      <div>
                        <div style={{ fontWeight: 700 }}>{job.title}</div>
                        <div style={{ marginTop: "0.35rem", color: "#566154", lineHeight: 1.45 }}>{job.description}</div>
                      </div>
                      <StatusBadge label={job.type === "grant_proposal" ? "Proposal job" : "General"} tone="neutral" />
                    </div>
                    <div style={{ display: "flex", gap: "0.55rem", flexWrap: "wrap", marginTop: "0.75rem" }}>
                      <StatusBadge label={`${job.offerCount} offers`} tone="neutral" />
                      <StatusBadge label={job.status} tone={job.status === "matched" ? "good" : "warn"} />
                      <StatusBadge label={job.requesterName} tone="neutral" />
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <p style={{ margin: 0, color: "#566154" }}>No marketplace requests yet.</p>
            )}
          </SectionCard>

          <SectionCard
            title={selectedJob ? selectedJob.title : "Request detail"}
            description={selectedJob ? selectedJob.fundingNeed : "Pick a request to see offers and funding actions."}
          >
            {selectedJob ? (
              <div style={{ display: "grid", gap: "0.9rem" }}>
                <p style={{ margin: 0, color: "#566154", lineHeight: 1.55 }}>{selectedJob.description}</p>
                <div style={{ display: "flex", gap: "0.55rem", flexWrap: "wrap" }}>
                  <StatusBadge label={selectedJob.status} tone={selectedJob.status === "matched" ? "good" : "warn"} />
                  {selectedJob.grantId ? <StatusBadge label="Sourced from tracked grant" tone="neutral" /> : null}
                </div>

                <div style={{ display: "grid", gap: "0.75rem" }}>
                  <h3 style={{ margin: 0 }}>Offers</h3>
                  {selectedJobOffers.length ? (
                    selectedJobOffers.map((offer) => (
                      <div key={offer.id} style={subtleCardStyle}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "start" }}>
                          <div>
                            <div style={{ fontWeight: 700 }}>{offer.specialistName}</div>
                            <div style={{ marginTop: "0.35rem", color: "#566154", lineHeight: 1.45 }}>{offer.message}</div>
                          </div>
                          <StatusBadge
                            label={`$${offer.amountUsd}`}
                            tone={offer.status === "accepted" ? "good" : offer.status === "rejected" ? "bad" : "neutral"}
                          />
                        </div>
                        {ownerCanAcceptSelectedOffers && offer.status === "pending" ? (
                          <div style={{ marginTop: "0.75rem" }}>
                            <button
                              type="button"
                              onClick={() => void acceptOffer(offer.id)}
                              style={buttonStyle(busyAction === `accept-${offer.id}`)}
                              disabled={busyAction === `accept-${offer.id}`}
                            >
                              Accept offer
                            </button>
                          </div>
                        ) : null}
                      </div>
                    ))
                  ) : (
                    <p style={{ margin: 0, color: "#566154" }}>No offers yet for this request.</p>
                  )}
                </div>

                <div style={{ display: "grid", gap: "0.75rem" }}>
                  <h3 style={{ margin: 0 }}>Engagements</h3>
                  {dashboard?.engagements.filter((engagement) => engagement.jobId === selectedJob.id).length ? (
                    dashboard.engagements
                      .filter((engagement) => engagement.jobId === selectedJob.id)
                      .map((engagement) => (
                        <div key={engagement.id} style={subtleCardStyle}>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "center" }}>
                            <div>
                              <div style={{ fontWeight: 700 }}>{engagement.specialistName}</div>
                              <div style={{ color: "#566154", marginTop: "0.25rem" }}>
                                {engagement.status} · ${engagement.amountUsd}
                              </div>
                            </div>
                            {session?.user?.id === engagement.requesterId ? (
                              <button
                                type="button"
                                onClick={() => void requestFundingChallenge(engagement.id)}
                                style={buttonStyle(busyAction === `fund-${engagement.id}`, "secondary")}
                                disabled={busyAction === `fund-${engagement.id}`}
                              >
                                Get funding challenge
                              </button>
                            ) : null}
                          </div>
                        </div>
                      ))
                  ) : (
                    <p style={{ margin: 0, color: "#566154" }}>No engagement has been accepted for this request yet.</p>
                  )}
                </div>
              </div>
            ) : (
              <p style={{ margin: 0, color: "#566154" }}>Select a marketplace request to inspect it.</p>
            )}
          </SectionCard>
        </div>
      </div>
    );
  }

  function renderResearchDashboardTab() {
    return (
      <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)" }}>
        <SectionCard
          title="Design a scenario"
          description="Turn a real business case into a reusable research scenario instead of relying on fixture IDs."
        >
          {isRequester ? (
            <form onSubmit={submitScenario} style={formCardStyle}>
              <label>
                <span>Name</span>
                <input style={inputStyle} value={scenarioName} onChange={(event) => setScenarioName(event.target.value)} />
              </label>
              <label>
                <span>Summary</span>
                <textarea
                  style={textareaStyle}
                  value={scenarioSummary}
                  onChange={(event) => setScenarioSummary(event.target.value)}
                />
              </label>
              <label>
                <span>Geography</span>
                <input
                  style={inputStyle}
                  value={scenarioGeography}
                  onChange={(event) => setScenarioGeography(event.target.value)}
                />
              </label>
              <label>
                <span>Business model</span>
                <input
                  style={inputStyle}
                  value={scenarioBusinessModel}
                  onChange={(event) => setScenarioBusinessModel(event.target.value)}
                />
              </label>
              <label>
                <span>Customers</span>
                <textarea
                  style={textareaStyle}
                  value={scenarioCustomers}
                  onChange={(event) => setScenarioCustomers(event.target.value)}
                />
              </label>
              <label>
                <span>Needs</span>
                <textarea style={textareaStyle} value={scenarioNeeds} onChange={(event) => setScenarioNeeds(event.target.value)} />
              </label>
              <label>
                <span>Tags</span>
                <input style={inputStyle} value={scenarioTags} onChange={(event) => setScenarioTags(event.target.value)} />
              </label>
              <button
                style={buttonStyle(busyAction === "scenario")}
                disabled={busyAction === "scenario"}
                type="submit"
              >
                Save scenario
              </button>
            </form>
          ) : (
            <p style={{ margin: 0, color: "#566154" }}>{roleActionNote}</p>
          )}
        </SectionCard>

        <SectionCard
          title="Available scenarios"
          description="Use a built-in scenario or one of your saved custom scenarios to create a research request."
        >
          {scenarios.length ? (
            <div style={{ display: "grid", gap: "0.75rem" }}>
              {scenarios.map((scenario) => (
                <div key={scenario.id} style={subtleCardStyle}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "start" }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{scenario.name}</div>
                      <div style={{ marginTop: "0.35rem", color: "#566154", lineHeight: 1.45 }}>{scenario.summary}</div>
                    </div>
                    <StatusBadge
                      label={scenario.sourceType === "custom" ? "Custom" : "Fixture"}
                      tone={scenario.sourceType === "custom" ? "good" : "neutral"}
                    />
                  </div>
                  <div style={{ marginTop: "0.75rem" }}>
                    <button
                      type="button"
                      onClick={() => void createResearchRequestFromScenario(scenario.id)}
                      style={buttonStyle(busyAction === `request-${scenario.id}`, "secondary")}
                      disabled={!isRequester || busyAction === `request-${scenario.id}`}
                    >
                      Create research request
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ margin: 0, color: "#566154" }}>No scenarios are available yet.</p>
          )}
        </SectionCard>
      </div>
    );
  }

  function renderMyRequestsTab() {
    const steeringSuggestions = [
      "Prioritize direct grant dollars over generic intermediary programs.",
      "Bias toward programs with clear deadlines in the next quarter.",
      "Look for proposal-preparation, technical assistance, or application support programs.",
    ];

    return (
      <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "minmax(0, 0.9fr) minmax(0, 1.1fr)" }}>
        <SectionCard
          title="My requests"
          description="Each request keeps the latest report, linked grants, and rerun controls in one place."
        >
          {requests.length ? (
            <div style={{ display: "grid", gap: "0.75rem" }}>
              {requests.map((request) => (
                <button
                  key={request.id}
                  type="button"
                  onClick={() => {
                    setSelectedRequestId(request.id);
                    setActiveTab("my-requests");
                  }}
                  style={{
                    ...subtleCardStyle,
                    border:
                      selectedRequestId === request.id
                        ? "1px solid rgba(36, 84, 58, 0.3)"
                        : "1px solid rgba(216, 204, 184, 0.95)",
                    textAlign: "left",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "start" }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{request.scenarioName}</div>
                      <div style={{ marginTop: "0.35rem", color: "#566154" }}>
                        Updated {formatTimestamp(request.updatedAt)}
                      </div>
                    </div>
                    <StatusBadge
                      label={request.status}
                      tone={requestStatusTone(request.status)}
                    />
                  </div>
                  <div style={{ display: "flex", gap: "0.55rem", flexWrap: "wrap", marginTop: "0.75rem" }}>
                    <StatusBadge label={`${request.grantCount} grants`} tone="neutral" />
                    <StatusBadge label={`${request.activeGrantCount} active`} tone="good" />
                    <StatusBadge label={requestPhaseLabel(request.runPhase)} tone="neutral" />
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <p style={{ margin: 0, color: "#566154" }}>No research requests yet. Start from the research dashboard.</p>
          )}
        </SectionCard>

        <SectionCard
          title={selectedRequest ? selectedRequest.scenarioName : "Request detail"}
          description="Run, steer, and monitor a request from one control room."
        >
          {selectedRequest ? (
            <div style={{ display: "grid", gap: "0.9rem" }}>
              <div style={{ display: "flex", gap: "0.55rem", flexWrap: "wrap" }}>
                <StatusBadge label={selectedRequest.status} tone={requestStatusTone(selectedRequest.status)} />
                <StatusBadge label={requestPhaseLabel(selectedRequest.runPhase)} tone="neutral" />
                {selectedRequest.runStartedAt ? (
                  <StatusBadge label={`Started: ${formatTimestamp(selectedRequest.runStartedAt)}`} tone="neutral" />
                ) : null}
                <StatusBadge label={`Last run: ${formatTimestamp(selectedRequest.lastRunAt)}`} tone="neutral" />
              </div>
              {selectedRequest.progressSummary ? (
                <div style={{ ...subtleCardStyle, border: "1px solid rgba(36,84,58,0.14)" }}>
                  <strong>Current note</strong>
                  <p style={{ margin: "0.45rem 0 0", color: "#566154", lineHeight: 1.55 }}>
                    {selectedRequest.progressSummary}
                  </p>
                </div>
              ) : null}
              {selectedRequest.errorMessage ? (
                <div style={{ ...subtleCardStyle, border: "1px solid rgba(143,45,31,0.2)" }}>
                  <strong>Latest failure</strong>
                  <p style={{ margin: "0.45rem 0 0", color: "#8f2d1f" }}>{selectedRequest.errorMessage}</p>
                </div>
              ) : null}
              <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)" }}>
                <div style={subtleCardStyle}>
                  <strong>Research summary</strong>
                  {selectedRequest.latestReport ? (
                    <>
                      <p style={{ margin: "0.45rem 0 0", color: "#566154", lineHeight: 1.55 }}>
                        {selectedRequest.latestReport.executiveSummary ?? "No executive summary yet."}
                      </p>
                      {selectedRequest.latestReport.searchSummary ? (
                        <p style={{ margin: "0.55rem 0 0", color: "#566154", lineHeight: 1.55 }}>
                          {selectedRequest.latestReport.searchSummary}
                        </p>
                      ) : null}
                    </>
                  ) : (
                    <p style={{ margin: "0.45rem 0 0", color: "#566154", lineHeight: 1.55 }}>
                      This request has not been run yet. Start it to generate a live activity timeline and tracked grants.
                    </p>
                  )}
                </div>

                <div style={subtleCardStyle}>
                  <strong>Steer the run</strong>
                  {selectedRequest.status === "running" ? (
                    <div style={{ display: "grid", gap: "0.75rem", marginTop: "0.55rem" }}>
                      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                        {steeringSuggestions.map((suggestion) => (
                          <button
                            key={suggestion}
                            type="button"
                            onClick={() => setSteeringPrompt(suggestion)}
                            style={buttonStyle(false, "secondary")}
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                      <textarea
                        style={textareaStyle}
                        value={steeringPrompt}
                        onChange={(event) => setSteeringPrompt(event.target.value)}
                        placeholder="Tell the researcher what to emphasize, avoid, or verify next."
                      />
                      <button
                        type="button"
                        onClick={() => void submitSteering(selectedRequest.id, steeringPrompt)}
                        style={buttonStyle(
                          busyAction === `steer-${selectedRequest.id}` || !steeringPrompt.trim(),
                        )}
                        disabled={busyAction === `steer-${selectedRequest.id}` || !steeringPrompt.trim()}
                      >
                        Queue steering note
                      </button>
                      {selectedRequest.steeringNotes.length ? (
                        <div style={{ display: "grid", gap: "0.5rem" }}>
                          {selectedRequest.steeringNotes.slice(0, 4).map((note) => (
                            <div key={note.id} style={{ ...subtleCardStyle, background: "rgba(255,255,255,0.72)" }}>
                              <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem" }}>
                                <strong style={{ fontSize: "0.92rem" }}>{note.status}</strong>
                                <span style={{ color: "#566154", fontSize: "0.88rem" }}>
                                  {formatTimestamp(note.appliedAt ?? note.createdAt)}
                                </span>
                              </div>
                              <p style={{ margin: "0.35rem 0 0", color: "#566154", lineHeight: 1.45 }}>
                                {note.prompt}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <p style={{ margin: "0.45rem 0 0", color: "#566154", lineHeight: 1.55 }}>
                      Start the request to send steering notes while the research agent is still working.
                    </p>
                  )}
                </div>
              </div>

              <div>
                <button
                  type="button"
                  onClick={() => void runResearchRequest(selectedRequest.id)}
                  style={buttonStyle(busyAction === `run-${selectedRequest.id}`)}
                  disabled={!isRequester || busyAction === `run-${selectedRequest.id}`}
                >
                  {selectedRequest.status === "completed" ? "Rerun research" : "Run research"}
                </button>
              </div>
              <div style={subtleCardStyle}>
                <strong>Live activity</strong>
                {selectedRequest.activity.length ? (
                  <div style={{ display: "grid", gap: "0.65rem", marginTop: "0.65rem" }}>
                    {selectedRequest.activity
                      .slice()
                      .reverse()
                      .map((activity) => (
                        <div
                          key={activity.id}
                          style={{
                            display: "grid",
                            gap: "0.28rem",
                            paddingLeft: "0.9rem",
                            borderLeft:
                              activity.tone === "good"
                                ? "3px solid rgba(31,91,56,0.32)"
                                : activity.tone === "bad"
                                  ? "3px solid rgba(143,45,31,0.32)"
                                  : "3px solid rgba(140,91,31,0.24)",
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem" }}>
                            <strong>{activity.title}</strong>
                            <span style={{ color: "#566154", fontSize: "0.88rem" }}>
                              {formatTimestamp(activity.timestamp)}
                            </span>
                          </div>
                          <div style={{ color: "#566154", lineHeight: 1.45 }}>{activity.detail}</div>
                        </div>
                      ))}
                  </div>
                ) : (
                  <p style={{ margin: "0.45rem 0 0", color: "#566154" }}>
                    The activity timeline will appear here once the request starts.
                  </p>
                )}
              </div>
              <div style={{ display: "grid", gap: "0.75rem" }}>
                <h3 style={{ margin: 0 }}>Tracked grants for this request</h3>
                {selectedRequestGrants.length ? (
                  selectedRequestGrants.map((grant) => (
                    <button
                      key={grant.id}
                      type="button"
                      onClick={() => {
                        setSelectedGrantId(grant.id);
                        setActiveTab("my-grants");
                      }}
                      style={{
                        ...subtleCardStyle,
                        textAlign: "left",
                        cursor: "pointer",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "center" }}>
                        <div>
                          <div style={{ fontWeight: 700 }}>{grant.title}</div>
                          <div style={{ marginTop: "0.35rem", color: "#566154" }}>{grant.sponsor}</div>
                        </div>
                        <StatusBadge
                          label={grant.queueState}
                          tone={grant.queueState === "active" ? "good" : "neutral"}
                        />
                      </div>
                    </button>
                  ))
                ) : (
                  <p style={{ margin: 0, color: "#566154" }}>No tracked grants yet for this request.</p>
                )}
              </div>
            </div>
          ) : (
            <p style={{ margin: 0, color: "#566154" }}>Select a request to monitor it.</p>
          )}
        </SectionCard>
      </div>
    );
  }

  function renderMyGrantsTab() {
    return (
      <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "minmax(0, 0.95fr) minmax(0, 1.05fr)" }}>
        <SectionCard
          title="My grants"
          description="Use the active queue to focus which opportunities move toward proposal work."
        >
          {grants.length ? (
            <div style={{ display: "grid", gap: "0.75rem" }}>
              {grants.map((grant) => (
                <button
                  key={grant.id}
                  type="button"
                  onClick={() => setSelectedGrantId(grant.id)}
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
                      <div style={{ marginTop: "0.35rem", color: "#566154", lineHeight: 1.45 }}>
                        {grant.sponsor} · {grant.scenarioName}
                      </div>
                    </div>
                    <StatusBadge
                      label={`${grant.fitScore}/100`}
                      tone={grant.fitScore >= 85 ? "good" : grant.fitScore >= 70 ? "warn" : "neutral"}
                    />
                  </div>
                  <div style={{ display: "flex", gap: "0.55rem", flexWrap: "wrap", marginTop: "0.75rem" }}>
                    <StatusBadge label={grant.queueState} tone={grant.queueState === "active" ? "good" : "neutral"} />
                    <StatusBadge label={grant.requestStatus} tone="neutral" />
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <p style={{ margin: 0, color: "#566154" }}>No tracked grants yet. Run a research request first.</p>
          )}
        </SectionCard>

        <SectionCard
          title={selectedGrant ? selectedGrant.title : "Grant detail"}
          description="Review the details, decide if the grant belongs in the active queue, and promote it into marketplace work when ready."
        >
          {selectedGrant ? (
            <div style={{ display: "grid", gap: "0.9rem" }}>
              <div style={{ display: "flex", gap: "0.55rem", flexWrap: "wrap" }}>
                <StatusBadge label={selectedGrant.queueState} tone={selectedGrant.queueState === "active" ? "good" : "neutral"} />
                <StatusBadge label={selectedGrant.fundingType} tone="neutral" />
                <StatusBadge label={selectedGrant.amountSummary} tone="neutral" />
              </div>
              <div style={subtleCardStyle}>
                <strong>Why it fits</strong>
                <p style={{ margin: "0.45rem 0 0", color: "#566154", lineHeight: 1.55 }}>{selectedGrant.whyFit}</p>
              </div>
              <div style={{ display: "grid", gap: "0.75rem", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
                <div style={subtleCardStyle}>
                  <strong>Deadline</strong>
                  <p style={{ margin: "0.45rem 0 0", color: "#566154" }}>{selectedGrant.deadlineSummary}</p>
                </div>
                <div style={subtleCardStyle}>
                  <strong>Geography</strong>
                  <p style={{ margin: "0.45rem 0 0", color: "#566154" }}>{selectedGrant.geography}</p>
                </div>
              </div>
              <div style={subtleCardStyle}>
                <strong>Eligibility notes</strong>
                <ul style={{ marginTop: "0.55rem" }}>
                  {selectedGrant.eligibilityNotes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              </div>
              <div style={subtleCardStyle}>
                <strong>Next actions</strong>
                <ul style={{ marginTop: "0.55rem" }}>
                  {selectedGrant.nextActions.map((action) => (
                    <li key={action}>{action}</li>
                  ))}
                </ul>
              </div>
              <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => void updateGrantQueue(selectedGrant.id, selectedGrant.queueState === "active" ? "inactive" : "active")}
                  style={buttonStyle(busyAction === `grant-${selectedGrant.id}`, "secondary")}
                  disabled={!isRequester || busyAction === `grant-${selectedGrant.id}`}
                >
                  Move to {selectedGrant.queueState === "active" ? "inactive" : "active"} queue
                </button>
                <button
                  type="button"
                  onClick={() => void createProposalJob(selectedGrant.id)}
                  style={buttonStyle(busyAction === `proposal-${selectedGrant.id}`)}
                  disabled={!isRequester || busyAction === `proposal-${selectedGrant.id}`}
                >
                  {selectedGrant.proposalJobId ? "Refresh proposal job" : "Create proposal job"}
                </button>
              </div>
              {selectedGrant.proposalJobId ? (
                <div style={subtleCardStyle}>
                  <strong>Marketplace job</strong>
                  <p style={{ margin: "0.45rem 0 0", color: "#566154" }}>
                    {selectedGrantJob ? selectedGrantJob.title : selectedGrant.proposalJobId}
                  </p>
                </div>
              ) : null}
              <div style={subtleCardStyle}>
                <strong>Citations</strong>
                <ul style={{ marginTop: "0.55rem" }}>
                  {selectedGrant.citations.map((citation) => (
                    <li key={citation}>
                      <a href={citation} target="_blank" rel="noreferrer">
                        {citation}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <p style={{ margin: 0, color: "#566154" }}>Select a tracked grant to inspect it.</p>
          )}
        </SectionCard>
      </div>
    );
  }

  function renderOrganizationTab() {
    return (
      <OrganizationWorkspaceView
        organization={organization}
        busyAction={busyAction}
        onSaveProfile={(input) => void saveOrganizationProfile(input)}
        onAddPersonnel={(input) => void addOrganizationPersonnel(input)}
        onAcceptInvite={(inviteId) => void acceptOrganizationInvite(inviteId)}
      />
    );
  }

  function renderCatalogTab() {
    return (
      <CatalogWorkspaceView
        grants={catalog}
        selectedGrantId={selectedCatalogGrantId}
        selectedGrantDetail={selectedCatalogGrant}
        busyAction={busyAction}
        onSelectGrant={setSelectedCatalogGrantId}
        onToggleBookmark={(grantId, bookmarked) => void toggleCatalogBookmark(grantId, bookmarked)}
        onSaveSchema={(grantId, input) => void saveCatalogSchema(grantId, input)}
        onCreateWorkspaceFromGrant={(grantId, documentType) =>
          void createApplicationWorkspace({ catalogGrantId: grantId, documentType })
        }
      />
    );
  }

  function renderApplicationsTab() {
    return (
      <ApplicationWorkspaceView
        templates={applicationTemplates}
        workspaces={applicationWorkspaces}
        providerConnections={providerConnections}
        busyAction={busyAction}
        onCreateTemplate={(input) => void createApplicationTemplate(input)}
        onCreateWorkspace={(input) => void createApplicationWorkspace(input)}
        onUpdateSection={(workspaceId, sectionId, content) =>
          void updateApplicationWorkspaceSection(workspaceId, sectionId, content)
        }
        onGenerateSection={(workspaceId, sectionId, providerConnectionId) =>
          void generateApplicationWorkspaceSection(workspaceId, sectionId, providerConnectionId)
        }
        onFinalizeWorkspace={(workspaceId) => void finalizeApplicationWorkspace(workspaceId)}
      />
    );
  }

  function renderProvidersTab() {
    return (
      <ProviderWorkspaceView
        organization={organization}
        connections={providerConnections}
        executions={executions}
        busyAction={busyAction}
        onCreateConnection={(input) => void createProviderConnection(input)}
      />
    );
  }

  function renderWorkspace() {
    if (!session?.user || !workspace || !dashboard) {
      return null;
    }

    return (
      <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "280px minmax(0, 1fr)" }}>
        <aside style={{ display: "grid", gap: "1rem", alignContent: "start" }}>
          <section style={shellCardStyle}>
            <div style={{ fontSize: "0.84rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "#566154" }}>
              Workspace
            </div>
            <div style={{ fontSize: "1.55rem", fontWeight: 700, marginTop: "0.4rem" }}>{session.user.name}</div>
            <div style={{ marginTop: "0.35rem", color: "#566154" }}>
              Switch roles as needed to move between requester and specialist work.
            </div>

            <div style={{ display: "grid", gap: "0.65rem", marginTop: "1rem" }}>
              <SidebarButton
                active={activeTab === "request-marketplace"}
                label="Request marketplace"
                description="Create requests, review offers, and handle funding challenges."
                tabId="request-marketplace"
                onClick={() => setActiveTab("request-marketplace")}
              />
              <SidebarButton
                active={activeTab === "research-dashboard"}
                label="Research dashboard"
                description="Design reusable scenarios and create new research requests."
                tabId="research-dashboard"
                onClick={() => setActiveTab("research-dashboard")}
              />
              <SidebarButton
                active={activeTab === "my-requests"}
                label="My requests"
                description="Run or rerun research and monitor the resulting grant pipeline."
                tabId="my-requests"
                onClick={() => setActiveTab("my-requests")}
              />
              <SidebarButton
                active={activeTab === "my-grants"}
                label="My grants"
                description="Manage the active queue and turn grants into proposal jobs."
                tabId="my-grants"
                onClick={() => setActiveTab("my-grants")}
              />
              <SidebarButton
                active={activeTab === "organization"}
                label="Organization"
                description="Maintain the organization profile, personnel records, and invitation state."
                tabId="organization"
                onClick={() => setActiveTab("organization")}
              />
              <SidebarButton
                active={activeTab === "catalog"}
                label="Catalog"
                description="Review promoted grants, bookmark them, and save application schemas."
                tabId="catalog"
                onClick={() => setActiveTab("catalog")}
              />
              <SidebarButton
                active={activeTab === "applications"}
                label="Applications"
                description="Create reusable templates, edit proposal drafts, and finalize workspaces."
                tabId="applications"
                onClick={() => setActiveTab("applications")}
              />
              <SidebarButton
                active={activeTab === "providers"}
                label="Providers"
                description="Register provider connections and inspect execution history."
                tabId="providers"
                onClick={() => setActiveTab("providers")}
              />
            </div>
          </section>

          <section style={shellCardStyle}>
            <h2 style={{ margin: 0, fontSize: "1.15rem" }}>Identity</h2>
            <form onSubmit={submitProfile} style={{ ...formCardStyle, marginTop: "0.85rem" }}>
              <label>
                <span>Name</span>
                <input style={inputStyle} value={profileName} onChange={(event) => setProfileName(event.target.value)} />
              </label>
              <label>
                <span>Role</span>
                <select
                  style={inputStyle}
                  value={profileRole}
                  onChange={(event) => setProfileRole(event.target.value === "specialist" ? "specialist" : "requester")}
                >
                  <option value="requester">requester</option>
                  <option value="specialist">specialist</option>
                </select>
              </label>
              <button style={buttonStyle(busyAction === "profile")} disabled={busyAction === "profile"} type="submit">
                Save role
              </button>
            </form>
            <div style={{ display: "grid", gap: "0.3rem", marginTop: "0.85rem", color: "#566154" }}>
              <div>Embedded wallet: {embeddedWalletAddress ?? "not created"}</div>
              <div>Smart wallet: {smartWalletAddress ?? "not created yet"}</div>
            </div>
          </section>

          <section style={shellCardStyle}>
            <h2 style={{ margin: 0, fontSize: "1.15rem" }}>Agent tokens</h2>
            <form onSubmit={submitAgentToken} style={{ ...formCardStyle, marginTop: "0.85rem" }}>
              <label>
                <span>Label</span>
                <input style={inputStyle} value={tokenLabel} onChange={(event) => setTokenLabel(event.target.value)} />
              </label>
              <button
                style={buttonStyle(busyAction === "agent-token", "secondary")}
                disabled={busyAction === "agent-token"}
                type="submit"
              >
                Mint token
              </button>
            </form>
            {latestSecret ? <pre style={{ marginTop: "0.85rem" }}>{latestSecret}</pre> : null}
            <div style={{ display: "grid", gap: "0.55rem", marginTop: "0.85rem" }}>
              {tokens.length ? (
                tokens.map((token) => (
                  <div key={token.id} style={subtleCardStyle}>
                    <div style={{ fontWeight: 700 }}>{token.label}</div>
                    <div style={{ marginTop: "0.25rem", color: "#566154", fontSize: "0.92rem" }}>
                      Created {formatTimestamp(token.createdAt)}
                    </div>
                  </div>
                ))
              ) : (
                <p style={{ margin: 0, color: "#566154" }}>No agent tokens minted yet.</p>
              )}
            </div>
          </section>
        </aside>

        <main style={{ display: "grid", gap: "1rem" }}>
          {activeTab === "request-marketplace" ? renderMarketplaceTab() : null}
          {activeTab === "research-dashboard" ? renderResearchDashboardTab() : null}
          {activeTab === "my-requests" ? renderMyRequestsTab() : null}
          {activeTab === "my-grants" ? renderMyGrantsTab() : null}
          {activeTab === "organization" ? renderOrganizationTab() : null}
          {activeTab === "catalog" ? renderCatalogTab() : null}
          {activeTab === "applications" ? renderApplicationsTab() : null}
          {activeTab === "providers" ? renderProvidersTab() : null}
          {fundingChallenge ? (
            <SectionCard
              title="Latest funding challenge"
              description="The containerized demo still returns an x402 challenge here until live payment settlement is enabled."
            >
              <pre>{fundingChallenge}</pre>
            </SectionCard>
          ) : null}
        </main>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      <section
        style={{
          ...shellCardStyle,
          background: "linear-gradient(140deg, rgba(255,255,255,0.78), rgba(246,241,232,0.85))",
        }}
      >
        <div style={{ display: "grid", gap: "0.45rem" }}>
          <div style={{ fontSize: "0.84rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "#566154" }}>
            Grantfinder browser workspace
          </div>
          <h1 style={{ margin: 0, fontSize: "2rem", maxWidth: "18ch" }}>
            Move from research to proposal work without hidden IDs.
          </h1>
          <p style={{ margin: 0, color: "#566154", lineHeight: 1.55, maxWidth: "60ch" }}>
            Create scenarios, run durable research requests, curate a live grant queue, and turn a promising grant into a paid specialist job.
          </p>
        </div>

        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginTop: "1rem" }}>
          {config.privyAppId ? (
            <>
              {!authenticated ? (
                <button style={buttonStyle(false)} onClick={() => login()}>
                  Sign in with Privy
                </button>
              ) : (
                <button style={buttonStyle(false)} onClick={() => logout()}>
                  Sign out
                </button>
              )}
              {authenticated && wallets.length === 0 ? (
                <button style={buttonStyle(false, "secondary")} onClick={() => void createWallet()}>
                  Create embedded wallet
                </button>
              ) : null}
            </>
          ) : (
            <p style={{ margin: 0 }}>Privy is not configured on this deployment yet.</p>
          )}
          <StatusBadge label={`x402: ${config.x402Mode}`} tone="neutral" />
        </div>

        {message ? (
          <div style={{ marginTop: "1rem" }}>
            <StatusBadge label={message} tone="good" />
          </div>
        ) : null}
        {error ? (
          <div style={{ marginTop: "1rem" }}>
            <StatusBadge label={error} tone="bad" />
          </div>
        ) : null}
      </section>

      {needsProfile ? (
        <SectionCard
          title="Complete your profile"
          description="Choose the role you want to start with. You can switch later from the workspace sidebar."
        >
          <form onSubmit={submitProfile} style={formCardStyle}>
            <label>
              <span>Name</span>
              <input style={inputStyle} value={profileName} onChange={(event) => setProfileName(event.target.value)} />
            </label>
            <label>
              <span>Role</span>
              <select
                style={inputStyle}
                value={profileRole}
                onChange={(event) => setProfileRole(event.target.value === "specialist" ? "specialist" : "requester")}
              >
                <option value="requester">requester</option>
                <option value="specialist">specialist</option>
              </select>
            </label>
            <button style={buttonStyle(busyAction === "profile")} disabled={busyAction === "profile"} type="submit">
              Save profile
            </button>
          </form>
        </SectionCard>
      ) : null}

      {session?.user && workspace ? (
        renderWorkspace()
      ) : (
        <SectionCard
          title="Marketplace snapshot"
          description="The public snapshot stays visible so you can inspect the current marketplace shape before signing in."
        >
          {publicDashboard ? (
            <div style={{ display: "grid", gap: "1rem" }}>
              <div
                style={{
                  display: "grid",
                  gap: "0.75rem",
                  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                }}
              >
                <div style={subtleCardStyle}>
                  <strong>{publicDashboard.users.length}</strong>
                  <div style={{ marginTop: "0.25rem", color: "#566154" }}>Users</div>
                </div>
                <div style={subtleCardStyle}>
                  <strong>{publicDashboard.jobs.length}</strong>
                  <div style={{ marginTop: "0.25rem", color: "#566154" }}>Requests</div>
                </div>
                <div style={subtleCardStyle}>
                  <strong>{publicDashboard.offers.length}</strong>
                  <div style={{ marginTop: "0.25rem", color: "#566154" }}>Offers</div>
                </div>
                <div style={subtleCardStyle}>
                  <strong>{publicDashboard.engagements.length}</strong>
                  <div style={{ marginTop: "0.25rem", color: "#566154" }}>Engagements</div>
                </div>
              </div>
              {publicDashboard.jobs.length ? (
                <div style={{ display: "grid", gap: "0.75rem" }}>
                  {publicDashboard.jobs.slice(0, 4).map((job) => (
                    <div key={job.id} style={subtleCardStyle}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "start" }}>
                        <div>
                          <div style={{ fontWeight: 700 }}>{job.title}</div>
                          <div style={{ marginTop: "0.35rem", color: "#566154", lineHeight: 1.45 }}>{job.description}</div>
                        </div>
                        <StatusBadge label={`${job.offerCount} offers`} tone="neutral" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ margin: 0, color: "#566154" }}>No marketplace activity yet.</p>
              )}
            </div>
          ) : (
            <p style={{ margin: 0 }}>Loading dashboard…</p>
          )}
        </SectionCard>
      )}
    </div>
  );
}

function BrowserApp() {
  if (!config.privyAppId) {
    return (
      <section style={shellCardStyle}>
        <h2 style={{ margin: 0 }}>Privy is not configured</h2>
        <p style={{ margin: "0.65rem 0 0", color: "#566154", lineHeight: 1.55 }}>
          Set <code>PRIVY_APP_ID</code> and <code>PRIVY_APP_SECRET</code> to enable browser login and wallet provisioning.
        </p>
      </section>
    );
  }

  const chain = config.x402Mode === "live" ? base : baseSepolia;

  return (
    <PrivyProvider
      appId={config.privyAppId}
      config={{
        defaultChain: chain,
        supportedChains: [chain],
        embeddedWallets: {
          showWalletUIs: true,
        },
      }}
    >
      <SmartWalletsProvider>
        <PrivyDashboardApp />
      </SmartWalletsProvider>
    </PrivyProvider>
  );
}

const rootElement = document.getElementById("app");
if (rootElement) {
  createRoot(rootElement).render(<BrowserApp />);
}
