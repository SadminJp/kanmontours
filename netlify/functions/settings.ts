import { getStore } from '@netlify/blobs';
import { createHash, timingSafeEqual } from 'node:crypto';
import type { Context } from '@netlify/functions';

/**
 * The admin-configurable destination for form-submission notifications.
 *
 * GET  — requires the admin password (sent as an X-Admin-Password header,
 *        since GET requests don't carry a JSON body). Nothing here is public:
 *        unlike tour schedules, no part of the public site needs to know this.
 * POST — requires the admin password in the JSON body, same shared-password
 *        model as netlify/functions/schedules.ts.
 *
 * Saving does two things: stores the address in Blobs (our own source of
 * truth), then calls Netlify's own Hooks API to point the site's native
 * "submission created" email notification at that address. Per Netlify's
 * published OpenAPI spec (github.com/netlify/open-api/blob/master/swagger.yml)
 * a hook has no form_id/form_name field at all — it's site-wide, covering
 * every form on the site, which is exactly what a single configurable
 * address needs. There's also no confirmed single-call "update"; existing
 * email/submission_created hooks are deleted and recreated instead.
 */

const STORE_NAME = 'kanmon-tours';
const BLOB_KEY = 'settings';
const NETLIFY_API = 'https://api.netlify.com/api/v1';

interface SiteSettings {
  notificationEmail: string;
}

const DEFAULT_SETTINGS: SiteSettings = { notificationEmail: '' };

function safeEqual(a: string, b: string): boolean {
  const hashA = createHash('sha256').update(a).digest();
  const hashB = createHash('sha256').update(b).digest();
  return timingSafeEqual(hashA, hashB);
}

function verifyAdminPassword(candidate: unknown): boolean {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword || typeof candidate !== 'string') return false;
  return safeEqual(candidate, adminPassword);
}

function isValidEmail(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

async function syncNotificationHooks(email: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const token = process.env.NETLIFY_API_TOKEN;
  const siteId = process.env.SITE_ID;
  if (!token || !siteId) {
    return { ok: false, error: 'The server is missing NETLIFY_API_TOKEN, so the notification address could not be applied.' };
  }

  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  let existingHooks: Array<{ id: string; type: string; event: string }>;
  try {
    const listResponse = await fetch(`${NETLIFY_API}/hooks?site_id=${encodeURIComponent(siteId)}`, { headers });
    if (!listResponse.ok) {
      const detail = await listResponse.text().catch(() => '');
      throw new Error(`${listResponse.status}${detail ? `: ${detail}` : ''}`);
    }
    existingHooks = await listResponse.json();
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return { ok: false, error: `Could not read the site’s existing Netlify notification settings (${detail}).` };
  }

  // This integration owns every email/submission_created hook on the site —
  // delete-and-recreate is simpler and safer than depending on an update call.
  const stale = existingHooks.filter((hook) => hook.type === 'email' && hook.event === 'submission_created');
  for (const hook of stale) {
    try {
      await fetch(`${NETLIFY_API}/hooks/${hook.id}`, { method: 'DELETE', headers });
    } catch {
      // A leftover stale hook is harmless noise, not worth failing the save over.
    }
  }

  // site_id is a query parameter on this endpoint, not a body field — the
  // hook object itself has no form-scoping field, so one hook here covers
  // every form on the site.
  try {
    const createResponse = await fetch(`${NETLIFY_API}/hooks?site_id=${encodeURIComponent(siteId)}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        site_id: siteId,
        type: 'email',
        event: 'submission_created',
        data: { email },
      }),
    });
    if (!createResponse.ok) {
      const detail = await createResponse.text().catch(() => '');
      throw new Error(`${createResponse.status}${detail ? `: ${detail}` : ''}`);
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return { ok: false, error: `Saved, but could not set up email notifications (${detail}).` };
  }

  return { ok: true };
}

export default async (req: Request, _context: Context): Promise<Response> => {
  const store = getStore(STORE_NAME);

  if (req.method === 'GET') {
    if (!verifyAdminPassword(req.headers.get('X-Admin-Password'))) {
      return json({ error: 'Incorrect password.' }, 401);
    }
    const current = (await store.get(BLOB_KEY, { type: 'json' })) as SiteSettings | null;
    return json(current ?? DEFAULT_SETTINGS);
  }

  if (req.method === 'POST') {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return json({ error: 'Invalid request body.' }, 400);
    }

    const { password, notificationEmail } = (body ?? {}) as { password?: unknown; notificationEmail?: unknown };
    if (!verifyAdminPassword(password)) {
      return json({ error: 'Incorrect password.' }, 401);
    }
    if (!isValidEmail(notificationEmail)) {
      return json({ error: 'Please enter a valid email address.' }, 400);
    }

    const settings: SiteSettings = { notificationEmail };
    await store.setJSON(BLOB_KEY, settings);

    const syncResult = await syncNotificationHooks(notificationEmail);
    if (!syncResult.ok) {
      return json({ ok: true, data: settings, warning: syncResult.error });
    }

    return json({ ok: true, data: settings });
  }

  return json({ error: 'Method not allowed.' }, 405);
};
