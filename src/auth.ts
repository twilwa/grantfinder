// ABOUTME: Verifies browser bearer tokens and abstracts the identity provider used by the web app.
// ABOUTME: The app uses Privy in production and a deterministic static provider in tests.

import { PrivyClient } from "@privy-io/node";

import type { PlatformSessionIdentity } from "./platform-types.js";

export class InvalidAccessTokenError extends Error {
  constructor(message = "The provided access token is not valid.") {
    super(message);
    this.name = "InvalidAccessTokenError";
  }
}

export interface BrowserAuthProvider {
  verifyAccessToken(accessToken: string): Promise<PlatformSessionIdentity>;
}

interface PrivyAuthProviderOptions {
  appId: string;
  appSecret: string;
  jwtVerificationKey?: string;
}

export class PrivyAuthProvider implements BrowserAuthProvider {
  private readonly client: PrivyClient;

  constructor(options: PrivyAuthProviderOptions) {
    this.client = new PrivyClient({
      appId: options.appId,
      appSecret: options.appSecret,
      ...(options.jwtVerificationKey ? { jwtVerificationKey: options.jwtVerificationKey } : {}),
    });
  }

  async verifyAccessToken(accessToken: string): Promise<PlatformSessionIdentity> {
    try {
      const claims = await this.client.utils().auth().verifyAccessToken(accessToken);

      return {
        privyUserId: claims.user_id,
      };
    } catch {
      throw new InvalidAccessTokenError();
    }
  }
}

export class StaticAuthProvider implements BrowserAuthProvider {
  constructor(private readonly identities: Record<string, PlatformSessionIdentity>) {}

  async verifyAccessToken(accessToken: string): Promise<PlatformSessionIdentity> {
    const identity = this.identities[accessToken];
    if (!identity) {
      throw new InvalidAccessTokenError();
    }

    return identity;
  }
}
