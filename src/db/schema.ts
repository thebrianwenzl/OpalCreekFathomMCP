import { pgTable, uuid, text, timestamp, bigint } from 'drizzle-orm/pg-core';

/**
 * One row per team member who has completed OAuth onboarding.
 * api_key_hash is SHA-256 of the plaintext key we issued them.
 * We never store the plaintext key.
 */
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email'),
  apiKeyHash: text('api_key_hash').notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

/**
 * Fathom OAuth tokens per user. One row per user; upserted on every token rotation.
 * Both tokens are AES-256-GCM encrypted with TOKEN_ENCRYPTION_KEY.
 * expires_at is a unix millisecond timestamp as returned by Fathom SDK.
 */
export const fathomTokens = pgTable('fathom_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: 'cascade' }),
  accessToken: text('access_token').notNull(),
  refreshToken: text('refresh_token').notNull(),
  expiresAt: bigint('expires_at', { mode: 'number' }).notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

/**
 * Short-lived CSRF nonce for OAuth flow.
 * Created when user starts /auth/connect; deleted on /auth/callback.
 * Rows older than 10 minutes can be treated as expired (lazy cleanup in callback).
 */
export const oauthStates = pgTable('oauth_states', {
  state: text('state').primaryKey(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
