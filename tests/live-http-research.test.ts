// ABOUTME: Provides an optional end-to-end HTTP test for the web research API.
// ABOUTME: It runs only when model provider credentials are available for the PI runtime.

import { expect, jest, test } from "bun:test";

import { createApp } from "../src/app.js";
import { StaticAuthProvider } from "../src/auth.js";

const hasProviderCredentials =
  Boolean(process.env.OPENAI_API_KEY) ||
  Boolean(process.env.ANTHROPIC_API_KEY) ||
  Boolean(process.env.GOOGLE_API_KEY);

jest.setTimeout(60_000);

(hasProviderCredentials ? test : test.skip)(
  "authenticated HTTP client can run a built-in research request",
  async () => {
    const app = createApp({
      authProvider: new StaticAuthProvider({
        browser_requester: { privyUserId: "did:privy:requester" },
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
      },
    });

    const payload = await researchResponse.json();

    expect(requestResponse.status).toBe(201);
    expect(researchResponse.status).toBe(200);
    expect(payload.request.status).toBe("completed");
    expect(payload.grants.length).toBeGreaterThan(0);
    expect(payload.request.latestReport.businessCaseId).toBe("inverse-private-equity");
  },
);
