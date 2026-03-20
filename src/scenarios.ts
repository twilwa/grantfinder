// ABOUTME: Loads built-in and file-based business-case scenarios for the grant research agent.
// ABOUTME: The CLI and tests use these helpers to execute known scenarios without hand-entering context.

import { readFile, readdir } from "node:fs/promises";

import type { BusinessScenario } from "./types.js";

const fixturesDirectory = new URL("../fixtures/scenarios/", import.meta.url);

function toFixtureUrl(identifier: string): URL {
  return new URL(`${identifier}.json`, fixturesDirectory);
}

export async function listScenarioIds(): Promise<string[]> {
  const entries = await readdir(fixturesDirectory);
  return entries
    .filter((entry) => entry.endsWith(".json"))
    .map((entry) => entry.replace(/\.json$/u, ""))
    .sort();
}

export async function loadScenario(identifierOrPath: string): Promise<BusinessScenario> {
  const source =
    identifierOrPath.endsWith(".json") || identifierOrPath.includes("/")
      ? new URL(identifierOrPath, `file://${process.cwd()}/`)
      : toFixtureUrl(identifierOrPath);

  const fileContents = await readFile(source, "utf-8");
  return JSON.parse(fileContents) as BusinessScenario;
}
