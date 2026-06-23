// ABOUTME: Verifies the admin-gated feature-flag CRUD API and the session bootstrap's resolved enabledFeatures.
// ABOUTME: Exercises the real HTTP code path: env allowlist gate, flag/target persistence, and per-user resolution.

import { afterEach, beforeEach, expect, test } from "bun:test";

import { StaticAuthProvider } from "../src/auth.js";
import { createApp } from "../src/app.js";

const ADMIN_PRIVY_ID = "did:privy:admin";
const originalAllowlist = process.env.PLATFORM_ADMIN_PRIVY_IDS;

beforeEach(() => {
  process.env.PLATFORM_ADMIN_PRIVY_IDS = ADMIN_PRIVY_ID;
});

afterEach(() => {
  if (originalAllowlist === undefined) {
    delete process.env.PLATFORM_ADMIN_PRIVY_IDS;
  } else {
    process.env.PLATFORM_ADMIN_PRIVY_IDS = originalAllowlist;
  }
});

function createTestApp() {
  return createApp({
    authProvider: new StaticAuthProvider({
      browser_admin: { privyUserId: ADMIN_PRIVY_ID },
      browser_requester: { privyUserId: "did:privy:requester" },
    }),
  });
}

function authed(token: string, body?: unknown): RequestInit {
  return {
    method: body === undefined ? "GET" : "POST",
    headers: {
      authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  };
}

function authedWith(method: string, token: string, body: unknown): RequestInit {
  return {
    method,
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}

async function createProfile(app: ReturnType<typeof createApp>, token: string, role: "requester" | "specialist") {
  await app.request("/api/auth/profile", {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ name: `User ${token}`, role }),
  });
}

async function sessionFor(app: ReturnType<typeof createApp>, token: string) {
  const response = await app.request("/api/auth/session", authed(token));
  return response.json();
}

test("anonymous and non-administrator requests cannot manage flags", async () => {
  const app = createTestApp();

  const anon = await app.request("/api/admin/feature-flags", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ key: "beta", description: "", defaultEnabled: false }),
  });
  expect(anon.status).toBe(401);

  await createProfile(app, "browser_requester", "requester");
  const forbidden = await app.request(
    "/api/admin/feature-flags",
    authed("browser_requester", { key: "beta", description: "", defaultEnabled: false }),
  );
  expect(forbidden.status).toBe(403);

  // The non-administrator's role is unchanged.
  const session = await sessionFor(app, "browser_requester");
  expect(session.user.role).toBe("requester");
  expect(session.isPlatformAdministrator).toBe(false);
});

test("an administrator creates a flag, targets a user, and the session resolves it", async () => {
  const app = createTestApp();
  await createProfile(app, "browser_admin", "requester");
  await createProfile(app, "browser_requester", "requester");

  const adminSession = await sessionFor(app, "browser_admin");
  expect(adminSession.isPlatformAdministrator).toBe(true);

  const created = await app.request(
    "/api/admin/feature-flags",
    authed("browser_admin", { key: "beta-sidebar", description: "Beta sidebar", defaultEnabled: false }),
  );
  expect(created.status).toBe(201);
  const { flag } = await created.json();
  expect(flag.key).toBe("beta-sidebar");

  // Default is off — neither user sees it yet.
  expect((await sessionFor(app, "browser_requester")).enabledFeatures).toEqual([]);

  // Find the requester's user id from their session, then target them on.
  const requesterSession = await sessionFor(app, "browser_requester");
  const target = await app.request(
    `/api/admin/feature-flags/${flag.id}/targets`,
    authedWith("PUT", "browser_admin", {
      audienceType: "user",
      audienceId: requesterSession.user.id,
      enabled: true,
    }),
  );
  expect(target.status).toBe(201);

  // The targeted user now resolves the feature; the admin (untargeted, default off) does not.
  const afterTarget = await sessionFor(app, "browser_requester");
  expect(afterTarget.enabledFeatures).toEqual(["beta-sidebar"]);
  expect(afterTarget.enabledFeatures).toBeArray();
  // Targeting rules never reach the client.
  expect(JSON.stringify(afterTarget)).not.toContain("audienceType");
  expect((await sessionFor(app, "browser_admin")).enabledFeatures).toEqual([]);

  // Resolution is deterministic across loads.
  expect((await sessionFor(app, "browser_requester")).enabledFeatures).toEqual(["beta-sidebar"]);
});

test("the admin flag listing includes targeting rules and deletion cascades", async () => {
  const app = createTestApp();
  await createProfile(app, "browser_admin", "requester");
  await createProfile(app, "browser_requester", "requester");
  const requesterSession = await sessionFor(app, "browser_requester");

  const { flag } = await (
    await app.request(
      "/api/admin/feature-flags",
      authed("browser_admin", { key: "beta-panel", description: "Beta panel", defaultEnabled: true }),
    )
  ).json();

  await app.request(
    `/api/admin/feature-flags/${flag.id}/targets`,
    authedWith("PUT", "browser_admin", {
      audienceType: "user",
      audienceId: requesterSession.user.id,
      enabled: false,
    }),
  );

  const listing = await (await app.request("/api/admin/feature-flags", authed("browser_admin"))).json();
  expect(listing.flags).toHaveLength(1);
  expect(listing.flags[0].targets).toHaveLength(1);
  expect(listing.flags[0].targets[0].audienceId).toBe(requesterSession.user.id);

  // default-on flag, user targeted off -> requester does not see it; admin (default on) does.
  expect((await sessionFor(app, "browser_requester")).enabledFeatures).toEqual([]);
  expect((await sessionFor(app, "browser_admin")).enabledFeatures).toEqual(["beta-panel"]);

  const deleted = await app.request(`/api/admin/feature-flags/${flag.id}`, {
    method: "DELETE",
    headers: { authorization: "Bearer browser_admin" },
  });
  expect(deleted.status).toBe(200);

  // Flag and its targets are gone; later resolutions omit the feature.
  const afterDelete = await (await app.request("/api/admin/feature-flags", authed("browser_admin"))).json();
  expect(afterDelete.flags).toHaveLength(0);
  expect((await sessionFor(app, "browser_admin")).enabledFeatures).toEqual([]);
});
