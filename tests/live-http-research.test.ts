// ABOUTME: Provides an optional end-to-end HTTP test for the web research API.
// ABOUTME: It runs only when model provider credentials are available for the PI runtime.

import { expect, jest, test } from "bun:test";

import { createApp } from "../src/app.js";
import { StaticAuthProvider } from "../src/auth.js";
import { runFundingResearch } from "../src/agent.js";

function resolveLiveTestProvider() {
  if (process.env.PI_PROVIDER) {
    return process.env.PI_PROVIDER;
  }

  if (process.env.OPENAI_API_KEY) {
    return "openai";
  }

  if (process.env.ANTHROPIC_API_KEY) {
    return "anthropic";
  }

  if (process.env.GOOGLE_API_KEY) {
    return "google";
  }

  return null;
}

function hasCredentialsForProvider(provider: string | null) {
  switch (provider) {
    case "openai":
      return Boolean(process.env.OPENAI_API_KEY);
    case "anthropic":
      return Boolean(process.env.ANTHROPIC_API_KEY);
    case "google":
      return Boolean(process.env.GOOGLE_API_KEY);
    default:
      return false;
  }
}

const selectedProvider = resolveLiveTestProvider();
const shouldRunLiveTest =
  process.env.RUN_LIVE_PROVIDER_TESTS === "1" &&
  hasCredentialsForProvider(selectedProvider);

jest.setTimeout(180_000);

(shouldRunLiveTest ? test : test.skip)(
  "authenticated HTTP client can run a built-in research request",
  async () => {
    const app = createApp({
      authProvider: new StaticAuthProvider({
        browser_requester: { privyUserId: "did:privy:requester" },
      }),
      researchRunner: (options) =>
        runFundingResearch({
          ...options,
          provider: selectedProvider ?? undefined,
          thinkingLevel: "minimal",
          minResearchRounds: 1,
          maxResearchRounds: 1,
          minHighQualitySources: 1,
          sourceDeltaThreshold: 99,
          opportunityDeltaThreshold: 99,
          topN: 1,
        }),
    });

    const profileResponse = await app.request("/api/auth/profile", {
      method: "POST",
      headers: {
        authorization: "Bearer browser_requester",
        "content-type": "application/json",
      },
      body: JSON.stringify({ name: "Requester", role: "requester" }),
    });
    expect(profileResponse.status).toBe(201);

    const requestResponse = await app.request("/api/research/requests", {
      method: "POST",
      headers: {
        authorization: "Bearer browser_requester",
        "content-type": "application/json",
      },
      body: JSON.stringify({ scenarioId: "inverse-private-equity" }),
    });
    const requestPayload = await requestResponse.json();

    const researchResponse = await app.request(`/api/research/requests/${requestPayload.request.id}/run`, {
      method: "POST",
      headers: {
        authorization: "Bearer browser_requester",
        "content-type": "application/json",
      },
      body: JSON.stringify({ awaitCompletion: false }),
    });

    const runPayload = await researchResponse.json();

    let payload: Awaited<ReturnType<typeof researchResponse.json>> | null = null;
    for (let attempt = 0; attempt < 180; attempt += 1) {
      const detailResponse = await app.request(`/api/research/requests/${requestPayload.request.id}`, {
        headers: {
          authorization: "Bearer browser_requester",
        },
      });
      const detailPayload = await detailResponse.json();
      if (detailPayload.request.status === "completed") {
        payload = { request: detailPayload.request, grants: detailPayload.request.grants };
        break;
      }

      await Bun.sleep(1_000);
    }

    expect(requestResponse.status).toBe(201);
    expect(researchResponse.status).toBe(202);
    expect(runPayload.request.status).toBe("running");
    expect(payload).not.toBeNull();
    expect(payload?.request.status).toBe("completed");
    expect(payload?.grants.length).toBeGreaterThan(0);
    expect(payload?.request.latestReport.businessCaseId).toBe("inverse-private-equity");
  },
);
