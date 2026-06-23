// ABOUTME: Feature-flag gating helpers and the administrator flag-management panel for the browser client.
// ABOUTME: Pure, prop-driven pieces so the main client owns state while flag UI stays isolated and testable.

import { useState, type FormEvent, type ReactNode } from "react";

import {
  buttonStyle,
  formCardStyle,
  inputStyle,
  SectionCard,
  StatusBadge,
  subtleCardStyle,
} from "./client-shared.js";
import type {
  FeatureAudienceType,
  PlatformFeatureFlag,
  PlatformFeatureFlagTarget,
} from "./platform-types.js";

export type AdminFeatureFlag = PlatformFeatureFlag & {
  targets: PlatformFeatureFlagTarget[];
};

export interface FeatureFlagInput {
  key: string;
  description: string;
  defaultEnabled: boolean;
}

export interface FeatureFlagTargetInput {
  audienceType: FeatureAudienceType;
  audienceId: string;
  enabled: boolean;
}

const AUDIENCE_TYPES: FeatureAudienceType[] = ["user", "organization", "role"];

const AUDIENCE_LABELS: Record<FeatureAudienceType, string> = {
  user: "User",
  organization: "Organization",
  role: "Role",
};

// Resolves whether a feature key is present in the session's resolved enabled set.
export function isFeatureEnabled(
  enabledFeatures: readonly string[] | undefined,
  key: string,
): boolean {
  return Array.isArray(enabledFeatures) && enabledFeatures.includes(key);
}

// Renders its children only when the feature key is in the enabled set, otherwise the fallback.
export function FeatureGate({
  enabledFeatures,
  featureKey,
  children,
  fallback = null,
}: {
  enabledFeatures: readonly string[] | undefined;
  featureKey: string;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  return <>{isFeatureEnabled(enabledFeatures, featureKey) ? children : fallback}</>;
}

function FlagTargetRow({
  flagId,
  target,
  busy,
  onDeleteTarget,
}: {
  flagId: string;
  target: PlatformFeatureFlagTarget;
  busy: boolean;
  onDeleteTarget: (flagId: string, targetId: string) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: "0.6rem",
        flexWrap: "wrap",
      }}
    >
      <div style={{ display: "flex", gap: "0.45rem", alignItems: "center", flexWrap: "wrap" }}>
        <StatusBadge label={AUDIENCE_LABELS[target.audienceType]} tone="neutral" />
        <span style={{ fontWeight: 600 }}>{target.audienceId}</span>
        <StatusBadge label={target.enabled ? "On" : "Off"} tone={target.enabled ? "good" : "warn"} />
      </div>
      <button
        type="button"
        onClick={() => onDeleteTarget(flagId, target.id)}
        disabled={busy}
        style={buttonStyle(busy, "secondary")}
      >
        Remove rule
      </button>
    </div>
  );
}

function AddTargetForm({
  flagId,
  busy,
  onSetTarget,
}: {
  flagId: string;
  busy: boolean;
  onSetTarget: (flagId: string, input: FeatureFlagTargetInput) => void;
}) {
  const [audienceType, setAudienceType] = useState<FeatureAudienceType>("user");
  const [audienceId, setAudienceId] = useState("");
  const [enabled, setEnabled] = useState(true);

  function submitTarget(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !audienceId.trim()) {
      return;
    }

    onSetTarget(flagId, { audienceType, audienceId: audienceId.trim(), enabled });
    setAudienceId("");
  }

  return (
    <form onSubmit={submitTarget} style={{ ...formCardStyle, gap: "0.6rem" }}>
      <label style={{ display: "grid", gap: "0.35rem" }}>
        <span>Audience</span>
        <select
          style={inputStyle}
          value={audienceType}
          onChange={(event) => setAudienceType(event.target.value as FeatureAudienceType)}
        >
          {AUDIENCE_TYPES.map((type) => (
            <option key={type} value={type}>
              {AUDIENCE_LABELS[type]}
            </option>
          ))}
        </select>
      </label>

      <label style={{ display: "grid", gap: "0.35rem" }}>
        <span>Audience identifier</span>
        <input
          style={inputStyle}
          value={audienceId}
          onChange={(event) => setAudienceId(event.target.value)}
          placeholder="user id, organization id, or role"
        />
      </label>

      <label style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
        <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />
        <span>Enable the feature for this audience</span>
      </label>

      <button
        type="submit"
        disabled={busy || !audienceId.trim()}
        style={buttonStyle(busy || !audienceId.trim())}
      >
        Save targeting rule
      </button>
    </form>
  );
}

function FlagCard({
  flag,
  busy,
  onUpdateFlag,
  onDeleteFlag,
  onSetTarget,
  onDeleteTarget,
}: {
  flag: AdminFeatureFlag;
  busy: boolean;
  onUpdateFlag: (flagId: string, input: FeatureFlagInput) => void;
  onDeleteFlag: (flagId: string) => void;
  onSetTarget: (flagId: string, input: FeatureFlagTargetInput) => void;
  onDeleteTarget: (flagId: string, targetId: string) => void;
}) {
  const [description, setDescription] = useState(flag.description);

  function saveDescription(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) {
      return;
    }

    onUpdateFlag(flag.id, {
      key: flag.key,
      description: description.trim(),
      defaultEnabled: flag.defaultEnabled,
    });
  }

  function toggleDefault() {
    if (busy) {
      return;
    }

    onUpdateFlag(flag.id, {
      key: flag.key,
      description: flag.description,
      defaultEnabled: !flag.defaultEnabled,
    });
  }

  return (
    <div style={{ ...subtleCardStyle, display: "grid", gap: "0.85rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", alignItems: "start" }}>
        <div>
          <strong style={{ fontSize: "1.05rem" }}>{flag.key}</strong>
          <div style={{ marginTop: "0.3rem", color: "#566154", lineHeight: 1.5 }}>
            {flag.description || "No description provided."}
          </div>
        </div>
        <StatusBadge
          label={flag.defaultEnabled ? "Default on" : "Default off"}
          tone={flag.defaultEnabled ? "good" : "warn"}
        />
      </div>

      <form onSubmit={saveDescription} style={{ ...formCardStyle, gap: "0.6rem" }}>
        <label style={{ display: "grid", gap: "0.35rem" }}>
          <span>Description</span>
          <input
            style={inputStyle}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="What feature does this flag gate?"
          />
        </label>
        <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
          <button type="submit" disabled={busy} style={buttonStyle(busy)}>
            Save description
          </button>
          <button type="button" onClick={toggleDefault} disabled={busy} style={buttonStyle(busy, "secondary")}>
            {flag.defaultEnabled ? "Set default off" : "Set default on"}
          </button>
          <button
            type="button"
            onClick={() => onDeleteFlag(flag.id)}
            disabled={busy}
            style={buttonStyle(busy, "secondary")}
          >
            Delete flag
          </button>
        </div>
      </form>

      <div style={{ display: "grid", gap: "0.6rem" }}>
        <strong>Targeting rules</strong>
        {flag.targets.length === 0 ? (
          <span style={{ color: "#566154" }}>
            No targeting rules. The default state applies to everyone.
          </span>
        ) : (
          flag.targets.map((target) => (
            <FlagTargetRow
              key={target.id}
              flagId={flag.id}
              target={target}
              busy={busy}
              onDeleteTarget={onDeleteTarget}
            />
          ))
        )}
        <AddTargetForm flagId={flag.id} busy={busy} onSetTarget={onSetTarget} />
      </div>
    </div>
  );
}

function CreateFlagForm({
  busy,
  onCreateFlag,
}: {
  busy: boolean;
  onCreateFlag: (input: FeatureFlagInput) => void;
}) {
  const [key, setKey] = useState("");
  const [description, setDescription] = useState("");
  const [defaultEnabled, setDefaultEnabled] = useState(false);

  function submitFlag(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !key.trim()) {
      return;
    }

    onCreateFlag({ key: key.trim(), description: description.trim(), defaultEnabled });
    setKey("");
    setDescription("");
    setDefaultEnabled(false);
  }

  return (
    <form onSubmit={submitFlag} style={formCardStyle}>
      <label style={{ display: "grid", gap: "0.35rem" }}>
        <span>Flag key</span>
        <input
          style={inputStyle}
          value={key}
          onChange={(event) => setKey(event.target.value)}
          placeholder="beta-sidebar"
        />
      </label>

      <label style={{ display: "grid", gap: "0.35rem" }}>
        <span>Description</span>
        <input
          style={inputStyle}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="What feature does this flag gate?"
        />
      </label>

      <label style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
        <input
          type="checkbox"
          checked={defaultEnabled}
          onChange={(event) => setDefaultEnabled(event.target.checked)}
        />
        <span>Enabled by default for everyone without a matching rule</span>
      </label>

      <button type="submit" disabled={busy || !key.trim()} style={buttonStyle(busy || !key.trim())}>
        Create flag
      </button>
    </form>
  );
}

// Administrator-only surface to create, edit, delete flags and manage their targeting rules.
export function FeatureFlagAdminPanel({
  flags,
  busy = false,
  onCreateFlag,
  onUpdateFlag,
  onDeleteFlag,
  onSetTarget,
  onDeleteTarget,
}: {
  flags: AdminFeatureFlag[];
  busy?: boolean;
  onCreateFlag: (input: FeatureFlagInput) => void;
  onUpdateFlag: (flagId: string, input: FeatureFlagInput) => void;
  onDeleteFlag: (flagId: string) => void;
  onSetTarget: (flagId: string, input: FeatureFlagTargetInput) => void;
  onDeleteTarget: (flagId: string, targetId: string) => void;
}) {
  return (
    <SectionCard
      title="Feature flags"
      description="Create flags and target them to a user, organization, or role. Most specific rule wins; the default applies otherwise."
    >
      <div style={{ display: "grid", gap: "1.1rem" }}>
        <CreateFlagForm busy={busy} onCreateFlag={onCreateFlag} />

        {flags.length === 0 ? (
          <p style={{ margin: 0, color: "#566154" }}>No feature flags yet. Create one above.</p>
        ) : (
          <div style={{ display: "grid", gap: "1rem" }}>
            {flags.map((flag) => (
              <FlagCard
                key={flag.id}
                flag={flag}
                busy={busy}
                onUpdateFlag={onUpdateFlag}
                onDeleteFlag={onDeleteFlag}
                onSetTarget={onSetTarget}
                onDeleteTarget={onDeleteTarget}
              />
            ))}
          </div>
        )}
      </div>
    </SectionCard>
  );
}
