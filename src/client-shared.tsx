// ABOUTME: Shares browser workspace styles, formatting helpers, and small UI primitives across client views.
// ABOUTME: Keeping these exports separate lets the main client focus on state while feature views stay isolated.

import type { CSSProperties, ReactNode } from "react";

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
