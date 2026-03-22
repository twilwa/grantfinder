// ABOUTME: Starts the Bun HTTP server for the Grantfinder browser, REST, JSON-RPC, and x402 surfaces.
// ABOUTME: This is the executable entrypoint used by `bun run serve` and the production build.

import { createApp } from "./app.js";

const port = Number.parseInt(process.env.PORT ?? "3000", 10);

const app = createApp({
  persist: true,
  databaseUrl: process.env.DATABASE_URL,
  x402: {
    mode: process.env.X402_MODE === "live" ? "live" : "challenge",
    facilitatorUrl: process.env.X402_FACILITATOR_URL,
    network: process.env.X402_NETWORK as `${string}:${string}` | undefined,
    payTo: process.env.X402_PAY_TO,
  },
});

console.log(`Grantfinder listening on http://localhost:${port}`);

Bun.serve({
  port,
  fetch: app.fetch,
});
