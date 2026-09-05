import { createHash, timingSafeEqual } from 'node:crypto';

/**
 * Shared helpers for the admin-backed functions.
 *
 * Deliberately outside netlify/functions/ — anything at the top level of that
 * directory is auto-deployed as its own endpoint, and this is a library.
 */

export const STORE_NAME = 'kanmon-tours';
export const SCHEDULES_KEY = 'schedules';
export const SETTINGS_KEY = 'settings';
export const CONTENT_KEY = 'tour-content';
export const PUBLISH_KEY = 'tour-content-publish';

/**
 * Constant-time string comparison. crypto.timingSafeEqual requires equal-length
 * buffers and throws otherwise, which a variable-length user password would
 * trip — hashing both sides to a fixed-length digest first sidesteps that
 * while still avoiding the early-exit timing leak of a plain === comparison.
 */
export function safeEqual(a: string, b: string): boolean {
  const hashA = createHash('sha256').update(a).digest();
  const hashB = createHash('sha256').update(b).digest();
  return timingSafeEqual(hashA, hashB);
}

export function verifyAdminPassword(candidate: unknown): boolean {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword || typeof candidate !== 'string') return false;
  return safeEqual(candidate, adminPassword);
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}
