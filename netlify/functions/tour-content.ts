import { getStore } from '@netlify/blobs';
import type { Context } from '@netlify/functions';
import { CONTENT_KEY, STORE_NAME, json, verifyAdminPassword } from '../lib/admin.js';
import { buildSeedDoc } from '../../src/data/tourSeed.js';
import type { TourContentDoc } from '../../src/data/types.js';
import { MAX_DOC_BYTES, ValidationError, normalizeDoc } from '../lib/tourContent.js';

/**
 * Serves and updates the editable tour content behind the admin page.
 *
 * GET  — admin only (X-Admin-Password header, as GET has no body). Unlike the
 *        schedules endpoint this is not public: the same content is already
 *        served as HTML, so there's nothing to gain from a second public copy.
 *        Self-seeds from the committed TS files on first read.
 * POST — admin only, password in the body. Replaces the whole document.
 *
 * Validation here REJECTS rather than failing closed, which is the opposite of
 * the schedules endpoint. There, bad input collapsing to "nothing bookable" is
 * safe. Here the equivalent would be erasing the client's website copy, so a
 * malformed save is refused outright with a message naming the offending field.
 */

export default async (req: Request, _context: Context): Promise<Response> => {
  const store = getStore(STORE_NAME);

  if (req.method === 'GET') {
    if (!verifyAdminPassword(req.headers.get('X-Admin-Password'))) {
      return json({ error: 'Incorrect password.' }, 401);
    }

    let current = (await store.get(CONTENT_KEY, { type: 'json' })) as TourContentDoc | null;
    if (!current) {
      // First read: seed from the committed TS files so the admin opens showing
      // exactly what the live site is currently serving.
      current = buildSeedDoc();
      current.updatedAt = new Date().toISOString();
      await store.setJSON(CONTENT_KEY, current);
    }
    return json(current);
  }

  if (req.method === 'POST') {
    if (!process.env.ADMIN_PASSWORD) {
      return json({ error: 'Admin password is not configured on the server.' }, 500);
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return json({ error: 'Invalid request body.' }, 400);
    }

    const { password, data, baseUpdatedAt } = (body ?? {}) as {
      password?: unknown;
      data?: unknown;
      baseUpdatedAt?: unknown;
    };

    if (!verifyAdminPassword(password)) {
      return json({ error: 'Incorrect password.' }, 401);
    }

    // Password but no data is the admin page's login check.
    if (data === undefined) {
      return json({ ok: true });
    }

    const existing = (await store.get(CONTENT_KEY, { type: 'json' })) as TourContentDoc | null;

    // Guards against two admin tabs silently overwriting each other.
    if (existing && typeof baseUpdatedAt === 'string' && baseUpdatedAt !== existing.updatedAt) {
      return json(
        { error: 'This page is out of date — someone else (or another tab) saved changes. Reload to get the latest version.' },
        409
      );
    }

    let normalized: TourContentDoc;
    try {
      normalized = normalizeDoc(data);
    } catch (error) {
      if (error instanceof ValidationError) return json({ error: error.message }, 400);
      throw error;
    }

    const serialized = JSON.stringify(normalized);
    if (serialized.length > MAX_DOC_BYTES) {
      return json({ error: 'That content is too large to save. Please shorten some sections.' }, 413);
    }

    await store.setJSON(CONTENT_KEY, normalized);
    return json({ ok: true, data: normalized });
  }

  return json({ error: 'Method not allowed.' }, 405);
};
