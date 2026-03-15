import { createHash, randomBytes } from 'crypto';

/**
 * Generate a new opaque API key: 32 random bytes, base64url-encoded.
 * Returns { plaintext, hash }.
 * Store the hash in the DB. Give the user the plaintext (once, never again).
 */
export function generateApiKey(): { plaintext: string; hash: string } {
  const plaintext = randomBytes(32).toString('base64url');
  const hash = hashApiKey(plaintext);
  return { plaintext, hash };
}

/**
 * Hash an API key for DB lookup. SHA-256 is appropriate here because:
 * - Keys are high-entropy random values (not user-chosen passwords)
 * - We need fast lookup; bcrypt's slowness is unnecessary
 */
export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}
