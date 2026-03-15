import { Fathom } from 'fathom-typescript';
import { DBTokenStore } from './token-store';

/**
 * Create a Fathom API client for a specific user.
 * Uses their persisted OAuth tokens via DBTokenStore.
 * The SDK handles access token refresh automatically.
 */
export function createFathomClient(userId: string): Fathom {
  const tokenStore = new DBTokenStore(userId);
  return new Fathom({
    security: Fathom.withAuthorization({
      clientId: process.env.FATHOM_CLIENT_ID!,
      clientSecret: process.env.FATHOM_CLIENT_SECRET!,
      // No 'code' here — we're using persisted tokens, not starting a new flow.
      // The SDK reads from tokenStore.get() directly.
      tokenStore,
    } as any), // SDK types require 'code' for initial flow; omit it for token-restore
  });
}
