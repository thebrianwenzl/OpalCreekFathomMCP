import { Context } from 'hono';
import { Fathom } from 'fathom-typescript';
import { eq, lt } from 'drizzle-orm';
import { randomBytes } from 'crypto';
import { db } from '../db';
import { users, fathomTokens, oauthStates } from '../db/schema';
import { encrypt } from './crypto';
import { generateApiKey } from '../lib/api-key';

const REDIRECT_URI = () => `${process.env.APP_BASE_URL}/auth/callback`;
const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * GET /auth/connect
 * Start the OAuth flow. Generate a state nonce, redirect to Fathom.
 */
export async function handleConnect(c: Context) {
  const state = randomBytes(16).toString('hex');

  // Store state nonce; lazy-clean expired ones while we're here
  await db.delete(oauthStates).where(
    lt(oauthStates.createdAt, new Date(Date.now() - STATE_TTL_MS))
  );
  await db.insert(oauthStates).values({ state });

  const authUrl = Fathom.getAuthorizationUrl({
    clientId: process.env.FATHOM_CLIENT_ID!,
    redirectUri: REDIRECT_URI(),
    scope: 'public_api',
    state,
  });

  return c.redirect(authUrl);
}

/**
 * GET /auth/callback?code=...&state=...
 * Exchange authorization code for tokens. Issue server API key. Show it once.
 */
export async function handleCallback(c: Context) {
  const { code, state } = c.req.query();

  if (!code || !state) {
    return c.text('Missing code or state parameter', 400);
  }

  // Validate state
  const storedState = await db.query.oauthStates.findFirst({
    where: eq(oauthStates.state, state),
  });

  if (!storedState) {
    return c.text('Invalid or expired state parameter', 400);
  }

  // Check TTL
  if (Date.now() - storedState.createdAt.getTime() > STATE_TTL_MS) {
    await db.delete(oauthStates).where(eq(oauthStates.state, state));
    return c.text('State parameter expired. Please try connecting again.', 400);
  }

  // Clean up used state
  await db.delete(oauthStates).where(eq(oauthStates.state, state));

  // Exchange code for tokens manually (raw endpoint, avoid SDK init complexity at this step)
  const tokenResponse = await fetch('https://api.fathom.ai/external/v1/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: process.env.FATHOM_CLIENT_ID!,
      client_secret: process.env.FATHOM_CLIENT_SECRET!,
      redirect_uri: REDIRECT_URI(),
    }),
  });

  if (!tokenResponse.ok) {
    const err = await tokenResponse.text();
    console.error('Fathom token exchange failed:', err);
    return c.text('Failed to exchange authorization code with Fathom.', 500);
  }

  const tokens = await tokenResponse.json() as {
    access_token: string;
    refresh_token: string;
    expires_in?: number;
  };

  // Calculate expiry (expires_in is seconds; store as unix ms)
  const expiresAt = Date.now() + ((tokens.expires_in ?? 3600) * 1000);

  // Fetch the user's email from Fathom to attach to the record (optional but useful)
  let email: string | null = null;
  try {
    const meResponse = await fetch('https://api.fathom.ai/external/v1/me', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (meResponse.ok) {
      const me = await meResponse.json() as { email?: string };
      email = me.email ?? null;
    }
  } catch {
    // Non-fatal; email is optional
  }

  // Generate server API key
  const { plaintext: apiKey, hash: apiKeyHash } = generateApiKey();

  // Upsert user (idempotent if reconnecting) — match on email if we have it
  let userId: string;

  if (email) {
    // Check if this Fathom user already has a record
    const existing = await db.query.users.findFirst({
      where: eq(users.email, email),
    });
    if (existing) {
      // Reuse the user record, issue a new API key
      await db.update(users)
        .set({ apiKeyHash })
        .where(eq(users.id, existing.id));
      userId = existing.id;
    } else {
      const [newUser] = await db.insert(users).values({ email, apiKeyHash }).returning();
      userId = newUser.id;
    }
  } else {
    const [newUser] = await db.insert(users).values({ apiKeyHash }).returning();
    userId = newUser.id;
  }

  // Store encrypted tokens
  await db
    .insert(fathomTokens)
    .values({
      userId,
      accessToken: encrypt(tokens.access_token),
      refreshToken: encrypt(tokens.refresh_token),
      expiresAt,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: fathomTokens.userId,
      set: {
        accessToken: encrypt(tokens.access_token),
        refreshToken: encrypt(tokens.refresh_token),
        expiresAt,
        updatedAt: new Date(),
      },
    });

  // Return the API key to the user — this is the only time it's shown in plaintext
  return c.html(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Fathom MCP — Connected</title>
      <style>
        body { font-family: system-ui, sans-serif; max-width: 600px; margin: 60px auto; padding: 0 20px; }
        code { background: #f4f4f4; padding: 12px 16px; display: block; border-radius: 6px; word-break: break-all; font-size: 14px; }
        .warning { color: #c00; font-weight: 600; }
      </style>
    </head>
    <body>
      <h2>Fathom connected${email ? ` (${email})` : ''}</h2>
      <p>Your MCP server API key:</p>
      <code>${apiKey}</code>
      <p class="warning">Copy this now. It won't be shown again.</p>
      <p>Add this to your Claude MCP configuration:</p>
      <code>{
  "mcpServers": {
    "fathom": {
      "type": "http",
      "url": "${process.env.APP_BASE_URL}/mcp",
      "headers": {
        "Authorization": "Bearer ${apiKey}"
      }
    }
  }
}</code>
    </body>
    </html>
  `);
}
