// ABOUTME: Verifies the local Docker Compose stack renders successfully for the app plus Postgres.
// ABOUTME: This keeps the operator startup path checked alongside the application code.

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { expect, test } from "bun:test";

test("docker compose config renders the app and postgres stack", () => {
  const workspaceRoot = resolve(import.meta.dir, "..");
  const composePath = resolve(workspaceRoot, "compose.yaml");

  expect(existsSync(composePath)).toBe(true);

  const result = spawnSync("docker", ["compose", "-f", composePath, "config"], {
    cwd: workspaceRoot,
    env: process.env,
    encoding: "utf8",
  });

  expect(result.status).toBe(0);
  expect(result.stdout).toContain("app:");
  expect(result.stdout).toContain("postgres:");
  expect(result.stdout).toContain("grantfinder-postgres");
});
