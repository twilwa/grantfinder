// ABOUTME: Builds deterministic repository publication targets and adapter inputs for Grantfinder branches.
// ABOUTME: The helpers keep path construction, branch naming, and pull request upserts pure and testable.

import type {
  PlatformRepositoryBinding,
  PlatformRepositoryBindingSource,
  PlatformRepositoryPublication,
} from "./platform-types.js";
import { DEFAULT_REPOSITORY_ROOT_PATH } from "./platform-types.js";

export interface RepositoryPublicationFile {
  path: string;
  content: string;
}

export interface RepositoryPublicationCommitInput {
  repositoryUrl: string;
  baseBranch: string;
  branchName: string;
  files: RepositoryPublicationFile[];
}

export interface RepositoryPublicationPullRequestInput {
  repositoryUrl: string;
  baseBranch: string;
  branchName: string;
  title: string;
  body: string;
  existingPullRequestUrl: string | null;
}

export interface RepositoryPublicationAdapter {
  writeBranchCommit(input: RepositoryPublicationCommitInput): Promise<{ commitSha: string }>;
  upsertPullRequest(
    input: RepositoryPublicationPullRequestInput,
  ): Promise<{ pullRequestUrl: string; action: "created" | "updated" }>;
}

export interface RepositoryPublicationTarget {
  repositoryUrl: string;
  baseBranch: string;
  rootPath: string;
  branchName: string;
  repositoryPath: string;
  pullRequestTitle: string;
  pullRequestBody: string;
}

function trimSlashes(value: string): string {
  return value.replace(/^\/+|\/+$/g, "");
}

export function buildRepositoryPath(rootPath: string | null | undefined, ...segments: string[]): string {
  const root = trimSlashes((rootPath?.trim() || DEFAULT_REPOSITORY_ROOT_PATH).trim());
  return [root, ...segments.map((segment) => trimSlashes(segment))].filter(Boolean).join("/");
}

export function buildGrantfinderBranchName(source: PlatformRepositoryBindingSource): string {
  return buildRepositoryPath("grantfinder", source.kind, source.id);
}

export function resolveRepositoryPublicationTarget(
  binding: PlatformRepositoryBinding,
  source: PlatformRepositoryBindingSource,
  relativePath: string,
): RepositoryPublicationTarget {
  const repositoryPath = buildRepositoryPath(binding.rootPath, relativePath);
  const branchName = buildGrantfinderBranchName(source);

  return {
    repositoryUrl: binding.repositoryUrl,
    baseBranch: binding.baseBranch,
    rootPath: binding.rootPath,
    branchName,
    repositoryPath,
    pullRequestTitle: `Grantfinder publication for ${source.kind.replaceAll("_", " ")} ${source.id}`,
    pullRequestBody: [
      `Grantfinder published ${repositoryPath} on branch ${branchName}.`,
      `Base branch: ${binding.baseBranch}.`,
    ].join("\n"),
  };
}

export async function upsertPublicationPullRequest(
  adapter: RepositoryPublicationAdapter,
  input: RepositoryPublicationPullRequestInput,
): Promise<{ pullRequestUrl: string; action: "created" | "updated" }> {
  return adapter.upsertPullRequest(input);
}

export function readLatestPublicationStatus(
  binding: PlatformRepositoryBinding | null,
): PlatformRepositoryPublication | null {
  return binding?.latestPublication ? { ...binding.latestPublication } : null;
}

export function persistLatestPublicationStatus(
  binding: PlatformRepositoryBinding,
  publication: PlatformRepositoryPublication,
  updatedAt: string,
): PlatformRepositoryBinding {
  return {
    ...binding,
    updatedAt,
    latestPublication: { ...publication },
  };
}
