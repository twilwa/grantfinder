// ABOUTME: Shares browser workspace styles, formatting helpers, and small UI primitives across client views.
// ABOUTME: Keeping these exports separate lets the main client focus on state while feature views stay isolated.

import { useEffect, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";

import { DEFAULT_REPOSITORY_ROOT_PATH, type PlatformRepositoryBinding, type PlatformRepositoryBindingSource, type RepositoryBindingSourceKind } from "./platform-types.js";
import type { RepositoryBindingInput } from "./services.js";

export type StatusTone = "neutral" | "good" | "warn" | "bad";
export type RequestStatusLike = "draft" | "running" | "completed" | "failed";
export type RequestPhaseLike =
  | "idle"
  | "briefing"
  | "searching"
  | "reading"
  | "synthesizing"
  | "publishing"
  | "completed"
  | "failed";

export const shellCardStyle: CSSProperties = {
  padding: "1.1rem",
  borderRadius: "18px",
  background: "rgba(255,255,255,0.68)",
  border: "1px solid rgba(216, 204, 184, 0.95)",
  boxShadow: "0 16px 36px rgba(55, 45, 24, 0.06)",
};

export const subtleCardStyle: CSSProperties = {
  ...shellCardStyle,
  background: "rgba(255, 255, 255, 0.5)",
  boxShadow: "none",
};

const externalLinkStyle: CSSProperties = {
  color: "#173b28",
  fontWeight: 600,
};

type RepositoryBindingSurfaceKind = RepositoryBindingSourceKind | "application_workspace";

export const formCardStyle: CSSProperties = {
  display: "grid",
  gap: "0.75rem",
};

export const inputStyle: CSSProperties = {
  width: "100%",
  border: "1px solid #b8b4ab",
  borderRadius: "12px",
  padding: "0.72rem 0.8rem",
  background: "rgba(255,255,255,0.82)",
  color: "#1f2a1f",
};

export const textareaStyle: CSSProperties = {
  ...inputStyle,
  minHeight: "7rem",
  resize: "vertical",
};

const primaryButtonStyle: CSSProperties = {
  border: 0,
  borderRadius: "999px",
  padding: "0.78rem 1.1rem",
  background: "linear-gradient(135deg, #24543a 0%, #173b28 100%)",
  color: "white",
  cursor: "pointer",
  fontWeight: 600,
};

const secondaryButtonStyle: CSSProperties = {
  ...primaryButtonStyle,
  background: "rgba(255,255,255,0.9)",
  color: "#173b28",
  border: "1px solid rgba(36, 84, 58, 0.22)",
};

export function buttonStyle(disabled = false, variant: "primary" | "secondary" = "primary"): CSSProperties {
  const baseStyle = variant === "primary" ? primaryButtonStyle : secondaryButtonStyle;
  return {
    ...baseStyle,
    opacity: disabled ? 0.55 : 1,
    cursor: disabled ? "not-allowed" : "pointer",
  };
}

export function formatJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

export function formatTimestamp(value: string | null): string {
  if (!value) {
    return "Not yet";
  }

  return new Date(value).toLocaleString();
}

export function parseTextList(value: string): string[] {
  return value
    .split(/[\n,]/u)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function requestStatusTone(status: RequestStatusLike): StatusTone {
  if (status === "completed") {
    return "good";
  }

  if (status === "failed") {
    return "bad";
  }

  if (status === "running") {
    return "warn";
  }

  return "neutral";
}

export function requestPhaseLabel(phase: RequestPhaseLike): string {
  if (phase === "idle") {
    return "Idle";
  }

  return `${phase.charAt(0).toUpperCase()}${phase.slice(1)}`;
}

export function findSmartWalletAddress(
  user: { smartWalletAddress?: string | null } | null,
  linkedAccounts: unknown[] | undefined,
): string | null {
  if (user?.smartWalletAddress) {
    return user.smartWalletAddress;
  }

  const smartWallet = linkedAccounts?.find((account): account is Record<string, unknown> => {
    if (!account || typeof account !== "object") {
      return false;
    }

    const candidate = account as Record<string, unknown>;
    return candidate.type === "smart_wallet";
  });

  return typeof smartWallet?.address === "string" ? smartWallet.address : null;
}

export function findGitHubAccountLabel(
  user:
    | {
        github?: {
          subject: string;
          username: string | null;
          name: string | null;
          email: string | null;
        } | null;
      }
    | null,
): string | null {
  const github = user?.github;
  if (!github) {
    return null;
  }

  return github.username ?? github.name ?? github.email ?? github.subject ?? null;
}

function formatRepositorySourceLabel(
  surfaceKind: RepositoryBindingSurfaceKind,
  source: PlatformRepositoryBindingSource | null,
): string {
  if (!source) {
    return "No repository source";
  }

  if (surfaceKind === "proposal_workspace") {
    if (source.kind === "tracked_grant") {
      return "Inherited from tracked grant";
    }

    if (source.kind === "catalog_grant") {
      return "Inherited from catalog entry";
    }

    return "Set directly on this workspace";
  }

  if (surfaceKind === "application_workspace") {
    if (source.kind === "tracked_grant") {
      return "Inherited from tracked grant";
    }

    if (source.kind === "catalog_grant") {
      return "Inherited from catalog entry";
    }

    return "Set directly on this workspace";
  }

  if (surfaceKind === "catalog_grant") {
    return source.kind === "tracked_grant" ? "Attached to tracked grant" : "Attached to catalog grant";
  }

  return "Attached to tracked grant";
}

export function RepositoryPublicationSummary({
  binding,
}: {
  binding: PlatformRepositoryBinding | null;
}) {
  if (!binding) {
    return null;
  }

  const publication = binding.latestPublication;
  const isPublished = publication?.status === "published";
  const statusLabel = publication
    ? publication.status === "published"
      ? "Publication published"
      : publication.status === "blocked"
        ? "Publication blocked"
        : "Publication failed"
    : "No repository publication has been recorded yet.";
  const statusTone = publication
    ? publication.status === "published"
      ? "good"
      : publication.status === "blocked"
        ? "warn"
        : "bad"
    : "warn";

  return (
    <div style={{ ...subtleCardStyle, display: "grid", gap: "0.85rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", alignItems: "start" }}>
        <div>
          <strong>Repository sync</strong>
          <div style={{ marginTop: "0.35rem", color: "#566154", lineHeight: 1.5 }}>
            Track the latest publication state for the connected GitHub repository.
          </div>
        </div>
        <StatusBadge label={statusLabel} tone={statusTone} />
      </div>

      {isPublished && publication ? (
        <div style={{ display: "grid", gap: "0.7rem" }}>
          <div style={{ display: "grid", gap: "0.22rem" }}>
            <span style={{ color: "#566154" }}>Published branch</span>
            <a href={`${binding.repositoryUrl}/tree/${publication.branch ?? ""}`} target="_blank" rel="noreferrer" style={externalLinkStyle}>
              {publication.branch}
            </a>
          </div>
          <div style={{ display: "grid", gap: "0.22rem" }}>
            <span style={{ color: "#566154" }}>Published commit</span>
            <a href={`${binding.repositoryUrl}/commit/${publication.commitSha ?? ""}`} target="_blank" rel="noreferrer" style={externalLinkStyle}>
              {publication.commitSha}
            </a>
          </div>
          <div style={{ display: "grid", gap: "0.22rem" }}>
            <span style={{ color: "#566154" }}>Pull request</span>
            <a href={publication.pullRequestUrl ?? "#"} target="_blank" rel="noreferrer" style={externalLinkStyle}>
              {publication.pullRequestUrl}
            </a>
          </div>
          <div style={{ display: "grid", gap: "0.22rem" }}>
            <span style={{ color: "#566154" }}>Repository root</span>
            <span>{binding.rootPath}</span>
          </div>
          <div style={{ color: "#566154", lineHeight: 1.5 }}>GitHub copy is current.</div>
        </div>
      ) : (
        <div style={{ display: "grid", gap: "0.6rem" }}>
          <div style={{ color: "#8c5b1f", lineHeight: 1.5 }}>
            {publication?.errorMessage ?? "No repository publication has been recorded yet."}
          </div>
          <div style={{ color: "#8c5b1f", lineHeight: 1.5 }}>GitHub does not yet have the latest platform artifact.</div>
        </div>
      )}
    </div>
  );
}

export function RepositoryBindingPanel({
  surfaceKind,
  binding,
  bindingSource,
  providerConnections,
  githubAccountId,
  githubAccountLabel,
  busy = false,
  onSubmit,
  onClear,
  onLinkGithubAccount,
}: {
  surfaceKind: RepositoryBindingSurfaceKind;
  binding: PlatformRepositoryBinding | null;
  bindingSource: PlatformRepositoryBindingSource | null;
  providerConnections: Array<{ id: string; label: string; provider: string }>;
  githubAccountId: string | null;
  githubAccountLabel: string | null;
  busy?: boolean;
  onSubmit: (input: RepositoryBindingInput) => void;
  onClear: () => void;
  onLinkGithubAccount: () => void;
}) {
  const defaultProviderConnectionId = providerConnections[0]?.id ?? "";
  const [repositoryUrl, setRepositoryUrl] = useState(binding?.repositoryUrl ?? "");
  const [baseBranch, setBaseBranch] = useState(binding?.baseBranch ?? "");
  const [rootPath, setRootPath] = useState(binding?.rootPath ?? DEFAULT_REPOSITORY_ROOT_PATH);
  const [providerConnectionId, setProviderConnectionId] = useState(binding?.providerConnectionId ?? defaultProviderConnectionId);

  useEffect(() => {
    setRepositoryUrl(binding?.repositoryUrl ?? "");
    setBaseBranch(binding?.baseBranch ?? "");
    setRootPath(binding?.rootPath ?? DEFAULT_REPOSITORY_ROOT_PATH);
    setProviderConnectionId(binding?.providerConnectionId ?? defaultProviderConnectionId);
  }, [binding?.repositoryUrl, binding?.baseBranch, binding?.rootPath, binding?.providerConnectionId, defaultProviderConnectionId]);

  function submitBinding(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!githubAccountId || busy) {
      return;
    }

    onSubmit({
      repositoryUrl: repositoryUrl.trim(),
      baseBranch: baseBranch.trim(),
      rootPath: rootPath.trim() || DEFAULT_REPOSITORY_ROOT_PATH,
      privyGitHubAccountId: githubAccountId,
      providerConnectionId,
    });
  }

  const sourceLabel = formatRepositorySourceLabel(surfaceKind, bindingSource);
  const canClear = Boolean(binding) && (surfaceKind !== "proposal_workspace" || bindingSource?.kind === "proposal_workspace");

  return (
    <div style={{ ...subtleCardStyle, display: "grid", gap: "0.85rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", alignItems: "start" }}>
        <div>
          <strong>Repository binding</strong>
          <div style={{ marginTop: "0.35rem", color: "#566154", lineHeight: 1.5 }}>
            Attach the GitHub repository that receives Grantfinder-managed artifacts.
          </div>
        </div>
        <StatusBadge label={binding ? "Linked" : "Not linked"} tone={binding ? "good" : "warn"} />
      </div>

      <div style={{ display: "flex", gap: "0.55rem", flexWrap: "wrap" }}>
        <StatusBadge
          label={sourceLabel}
          tone={surfaceKind === "proposal_workspace" && bindingSource && bindingSource.kind !== "proposal_workspace" ? "warn" : "neutral"}
        />
        {binding ? <StatusBadge label={`Root path ${binding.rootPath}`} tone="neutral" /> : <StatusBadge label={`Root path ${DEFAULT_REPOSITORY_ROOT_PATH}`} tone="neutral" />}
        {githubAccountLabel ? <StatusBadge label={githubAccountLabel} tone="good" /> : null}
      </div>

      <RepositoryPublicationSummary binding={binding} />

      <form onSubmit={submitBinding} style={formCardStyle}>
        <label style={{ display: "grid", gap: "0.35rem" }}>
          <span>Repository URL</span>
          <input
            style={inputStyle}
            value={repositoryUrl}
            onChange={(event) => setRepositoryUrl(event.target.value)}
            placeholder="https://github.com/org/repository"
          />
        </label>

        <label style={{ display: "grid", gap: "0.35rem" }}>
          <span>Base branch</span>
          <input
            style={inputStyle}
            value={baseBranch}
            onChange={(event) => setBaseBranch(event.target.value)}
            placeholder="main"
          />
        </label>

        <label style={{ display: "grid", gap: "0.35rem" }}>
          <span>Repository root path</span>
          <input
            style={inputStyle}
            value={rootPath}
            onChange={(event) => setRootPath(event.target.value)}
            placeholder={DEFAULT_REPOSITORY_ROOT_PATH}
          />
          <span style={{ color: "#566154", lineHeight: 1.45 }}>Defaults to {DEFAULT_REPOSITORY_ROOT_PATH} when left blank.</span>
        </label>

        <label style={{ display: "grid", gap: "0.35rem" }}>
          <span>Provider connection</span>
          <select style={inputStyle} value={providerConnectionId} onChange={(event) => setProviderConnectionId(event.target.value)}>
            <option value="">Select a provider connection</option>
            {providerConnections.map((connection) => (
              <option key={connection.id} value={connection.id}>
                {connection.label} ({connection.provider})
              </option>
            ))}
          </select>
        </label>

        {githubAccountId ? (
          <div style={{ color: "#566154", lineHeight: 1.5 }}>
            GitHub account: {githubAccountLabel ?? githubAccountId}
          </div>
        ) : (
          <div style={{ ...subtleCardStyle, background: "rgba(244, 225, 200, 0.45)" }}>
            <StatusBadge label="GitHub account required" tone="warn" />
            <div style={{ marginTop: "0.45rem", color: "#566154", lineHeight: 1.5 }}>
              Link your GitHub account in Privy before attaching a repository.
            </div>
            <button
              type="button"
              onClick={onLinkGithubAccount}
              style={{ ...buttonStyle(false, "secondary"), marginTop: "0.75rem" }}
            >
              Link GitHub account
            </button>
          </div>
        )}

        {binding ? (
          <a href={binding.repositoryUrl} target="_blank" rel="noreferrer" style={externalLinkStyle}>
            Open repository
          </a>
        ) : null}

        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginTop: "0.25rem" }}>
          <button
            type="submit"
            disabled={busy || !githubAccountId || !providerConnectionId || !repositoryUrl.trim() || !baseBranch.trim()}
            style={buttonStyle(busy || !githubAccountId || !providerConnectionId || !repositoryUrl.trim() || !baseBranch.trim())}
          >
            {binding ? "Update repository" : "Attach repository"}
          </button>
          {canClear ? (
            <button
              type="button"
              onClick={onClear}
              disabled={busy}
              style={buttonStyle(busy, "secondary")}
            >
              Clear repository
            </button>
          ) : null}
        </div>
      </form>
    </div>
  );
}

export async function parseJsonResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as T & { error?: { message?: string } };
  if (!response.ok) {
    const message =
      typeof payload === "object" && payload && "error" in payload && payload.error?.message
        ? payload.error.message
        : `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return payload;
}

export function StatusBadge({ label, tone = "neutral" }: { label: string; tone?: StatusTone }) {
  const palette =
    tone === "good"
      ? { background: "#d6e7db", color: "#1f5b38" }
      : tone === "warn"
        ? { background: "#f4e1c8", color: "#8c5b1f" }
        : tone === "bad"
          ? { background: "#f4d6d1", color: "#8f2d1f" }
          : { background: "rgba(255,255,255,0.8)", color: "#384438" };

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "0.28rem 0.65rem",
        borderRadius: "999px",
        fontSize: "0.84rem",
        fontWeight: 600,
        ...palette,
      }}
    >
      {label}
    </span>
  );
}

export function SidebarButton({
  active,
  label,
  description,
  onClick,
  tabId,
}: {
  active: boolean;
  label: string;
  description: string;
  onClick: () => void;
  tabId?: string;
}) {
  return (
    <button
      type="button"
      data-workspace-tab={tabId}
      onClick={onClick}
      style={{
        width: "100%",
        border: active ? "1px solid rgba(36, 84, 58, 0.25)" : "1px solid rgba(216, 204, 184, 0.95)",
        borderRadius: "18px",
        background: active ? "linear-gradient(135deg, rgba(36,84,58,0.16), rgba(36,84,58,0.06))" : "rgba(255,255,255,0.75)",
        color: "#1f2a1f",
        textAlign: "left",
        padding: "0.95rem 1rem",
        cursor: "pointer",
      }}
    >
      <div style={{ fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: "0.9rem", color: "#566154", marginTop: "0.3rem", lineHeight: 1.45 }}>
        {description}
      </div>
    </button>
  );
}

export function SectionCard({
  title,
  description,
  children,
  style,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <section style={{ ...shellCardStyle, ...style }}>
      <div style={{ marginBottom: "0.9rem" }}>
        <h2 style={{ margin: 0, fontSize: "1.35rem" }}>{title}</h2>
        {description ? (
          <p style={{ margin: "0.45rem 0 0", color: "#566154", lineHeight: 1.5 }}>{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}
