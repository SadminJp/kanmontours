import { getStore } from '@netlify/blobs';
import type { Context } from '@netlify/functions';
import { CONTENT_KEY, PUBLISH_KEY, SCHEDULES_KEY, STORE_NAME, json, verifyAdminPassword } from '../lib/admin.js';
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
 * POST ?action=publish — triggers a site rebuild via the Netlify build hook.
 *        Publishing is separate from saving because tour pages are static HTML:
 *        a save only updates the stored document, and the site keeps serving the
 *        previous build until a publish rebuilds it. Doing both on every save
 *        would spend a build per keystroke-save and leave the client waiting
 *        minutes to see anything.
 *
 * Validation here REJECTS rather than failing closed, which is the opposite of
 * the schedules endpoint. There, bad input collapsing to "nothing bookable" is
 * safe. Here the equivalent would be erasing the client's website copy, so a
 * malformed save is refused outright with a message naming the offending field.
 */

interface PublishState {
  publishedAt: string;
  requestedAt: string;
}

/** Rapid double-clicks shouldn't each cost a build. */
const PUBLISH_COOLDOWN_MS = 60 * 1000;

async function readPublishState(store: ReturnType<typeof getStore>): Promise<PublishState | null> {
  return (await store.get(PUBLISH_KEY, { type: 'json' })) as PublishState | null;
}

/**
 * Keeps the booking schedule in step with the tours.
 *
 * Schedules are keyed by slug, so renaming a tour would otherwise leave its
 * operating days behind under the old key and the tour would silently become
 * unbookable — the worst kind of failure here, because nothing looks broken.
 * Matching on the stable `id` is the whole reason that field exists: it is what
 * tells a rename apart from a delete-plus-add.
 *
 * Best effort by design. The content save has already succeeded by this point,
 * and failing the whole request because a follow-up write failed would be
 * worse than reporting it — schedules.ts drops unknown slugs on read anyway, so
 * a stale entry is untidy rather than harmful.
 */
async function reconcileSchedules(
  store: ReturnType<typeof getStore>,
  previous: TourContentDoc | null,
  next: TourContentDoc
): Promise<string | null> {
  const renames = new Map<string, string>();
  if (previous) {
    const oldSlugById = new Map(previous.tours.map((tour) => [tour.id, tour.slug]));
    for (const tour of next.tours) {
      const oldSlug = oldSlugById.get(tour.id);
      if (oldSlug && oldSlug !== tour.slug) renames.set(oldSlug, tour.slug);
    }
  }

  const liveSlugs = new Set(next.tours.map((tour) => tour.slug));

  try {
    const schedules = (await store.get(SCHEDULES_KEY, { type: 'json' })) as
      | { minLeadDays: number; tours: Record<string, unknown> }
      | null;
    if (!schedules || !schedules.tours) return null;

    let changed = false;
    const tours: Record<string, unknown> = {};

    for (const [slug, schedule] of Object.entries(schedules.tours)) {
      const renamedTo = renames.get(slug);
      if (renamedTo) {
        tours[renamedTo] = schedule;
        changed = true;
      } else if (liveSlugs.has(slug)) {
        tours[slug] = schedule;
      } else {
        // The tour was deleted; drop its orphaned schedule.
        changed = true;
      }
    }

    if (!changed) return null;
    await store.setJSON(SCHEDULES_KEY, { ...schedules, tours });
    return null;
  } catch (error) {
    return renames.size
      ? 'The tour was renamed, but its operating days could not be moved across — please check the Schedule tab.'
      : 'The tour was removed, but its old operating days could not be tidied up.';
  }
}

/**
 * Fires the Netlify build hook. The hook URL is read from the environment and
 * never sent to the browser: anyone holding it can spend the site's build
 * minutes at will.
 */
async function publish(store: ReturnType<typeof getStore>): Promise<Response> {
  const hookUrl = process.env.NETLIFY_BUILD_HOOK_URL;
  if (!hookUrl) {
    return json(
      { error: 'Publishing is not set up yet. A build hook needs to be added as NETLIFY_BUILD_HOOK_URL.' },
      500
    );
  }

  const previous = await readPublishState(store);
  if (previous && Date.now() - Date.parse(previous.requestedAt) < PUBLISH_COOLDOWN_MS) {
    return json({ error: 'A publish is already in progress. Please wait a moment and check the website.' }, 429);
  }

  const current = (await store.get(CONTENT_KEY, { type: 'json' })) as TourContentDoc | null;
  if (!current) {
    return json({ error: 'There is nothing to publish yet.' }, 400);
  }

  let response: Response;
  try {
    response = await fetch(hookUrl, { method: 'POST' });
  } catch (error) {
    return json({ error: `Could not reach Netlify to start the build: ${(error as Error).message}` }, 502);
  }
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    return json({ error: `Netlify refused to start the build (${response.status})${detail ? `: ${detail}` : ''}` }, 502);
  }

  // Stamped with the document's own updatedAt rather than "now", so the admin
  // can tell whether what is live matches what is saved.
  const state: PublishState = { publishedAt: current.updatedAt, requestedAt: new Date().toISOString() };
  await store.setJSON(PUBLISH_KEY, state);
  return json({ ok: true, publishedAt: state.publishedAt });
}

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
    const publishState = await readPublishState(store);
    return json({ ...current, publishedAt: publishState?.publishedAt ?? null });
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

    if (new URL(req.url).searchParams.get('action') === 'publish') {
      return publish(store);
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

    const warning = await reconcileSchedules(store, existing, normalized);
    return json(warning ? { ok: true, data: normalized, warning } : { ok: true, data: normalized });
  }

  return json({ error: 'Method not allowed.' }, 405);
};
