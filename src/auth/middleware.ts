import { Context, Next } from 'hono';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { users } from '../db/schema';
import { hashApiKey } from '../lib/api-key';
import { createFathomClient } from '../fathom/client';
import type { Fathom } from 'fathom-typescript';

// Augment Hono's context Variables type
type Variables = {
  userId: string;
  fathomClient: Fathom;
};

/**
 * Extract the bearer token from Authorization header,
 * look up the user, and attach userId + fathomClient to context.
 *
 * Returns 401 if no valid key found.
 */
export async function authMiddleware(c: Context<{ Variables: Variables }>, next: Next) {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Missing or invalid Authorization header' }, 401);
  }

  const apiKey = authHeader.slice(7); // strip "Bearer "
  const hash = hashApiKey(apiKey);

  const user = await db.query.users.findFirst({
    where: eq(users.apiKeyHash, hash),
  });

  if (!user) {
    return c.json({ error: 'Invalid API key' }, 401);
  }

  c.set('userId', user.id);
  c.set('fathomClient', createFathomClient(user.id));

  await next();
}
