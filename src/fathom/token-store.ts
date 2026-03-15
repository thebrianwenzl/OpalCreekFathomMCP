import { eq } from 'drizzle-orm';
import { db } from '../db';
import { fathomTokens } from '../db/schema';
import { encrypt, decrypt } from '../auth/crypto';

// Matches the TokenStore interface from fathom-typescript (not exported as a namespace)
interface TokenStore {
  get(): Promise<{ token: string; refresh_token: string; expires: number } | undefined>;
  set(token: string, refresh_token: string, expires: number): Promise<void>;
}

/**
 * Implements the fathom-typescript TokenStore interface backed by Postgres.
 * The SDK calls get() before each request and set() after any token rotation.
 * Refresh tokens are single-use — always write back whatever the SDK returns.
 */
export class DBTokenStore implements TokenStore {
  constructor(private readonly userId: string) {}

  async get(): Promise<{ token: string; refresh_token: string; expires: number } | undefined> {
    const record = await db.query.fathomTokens.findFirst({
      where: eq(fathomTokens.userId, this.userId),
    });
    if (!record) return undefined;
    return {
      token: decrypt(record.accessToken),
      refresh_token: decrypt(record.refreshToken),
      expires: record.expiresAt,
    };
  }

  async set(token: string, refresh_token: string, expires: number): Promise<void> {
    await db
      .insert(fathomTokens)
      .values({
        userId: this.userId,
        accessToken: encrypt(token),
        refreshToken: encrypt(refresh_token),
        expiresAt: expires,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: fathomTokens.userId,
        set: {
          accessToken: encrypt(token),
          refreshToken: encrypt(refresh_token),
          expiresAt: expires,
          updatedAt: new Date(),
        },
      });
  }
}
