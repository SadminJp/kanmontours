import type { TourContent, TourContentDoc } from './types.js';
import { CONTENT_KEY, ON_NETLIFY, STORE_NAME, openStore } from './blobStore.js';
import { assertValidDoc, buildSeedDoc, flattenLocale } from './tourSeed.js';

/**
 * Loads tour content for the build.
 *
 * On Netlify the content is fetched over HTTP from the site's own
 * /api/tour-content endpoint rather than read from Blobs directly. That looks
 * indirect, but it is the mechanism that actually works: Blobs injects
 * credentials automatically into deployed functions, and does not into builds.
 * Passing siteID/token explicitly is the documented workaround, but Netlify
 * refuses to expose a NETLIFY_SITE_ID variable to the build environment, so the
 * build has no site ID to pass and every attempt returns 401. Going through the
 * function sidesteps the problem: the function reads Blobs with the credentials
 * it is given for free, and the build authenticates to it with ADMIN_PASSWORD,
 * which the build environment does provide.
 *
 * The request targets the live site, which is still serving the previous deploy
 * while this build runs. That is fine — the previous deploy's function reads the
 * same Blobs store, so it returns current content regardless of which deploy's
 * code answers.
 *
 * Throughout, a failure that could mean "content exists but we could not read
 * it" FAILS THE BUILD rather than falling back to the committed seed files.
 * Falling back would look like success — green deploy, no error — while
 * silently republishing months-old content over the client's edits. A failed
 * build is loud and leaves the last good deploy serving.
 */
async function loadTourDoc(): Promise<TourContentDoc> {
  if (process.env.TOURS_FORCE_SEED === '1') {
    const doc = buildSeedDoc();
    console.log(`[tours] TOURS_FORCE_SEED=1 — using seed files (${doc.tours.length} tours)`);
    return doc;
  }

  if (ON_NETLIFY) return loadFromApi();
  return loadFromBlobsOrSeed();
}

/** Build-time read via the site's own API. See the note above for why. */
async function loadFromApi(): Promise<TourContentDoc> {
  const base = (process.env.TOUR_CONTENT_URL || process.env.URL || '').replace(/\/$/, '');
  const password = process.env.ADMIN_PASSWORD;

  if (!base || !password) {
    throw new Error(
      `[tours] cannot load tour content: ${!base ? 'no site URL (URL)' : 'no ADMIN_PASSWORD'} in the build environment. ` +
        'Refusing to build with stale seed content, which would silently overwrite saved edits. ' +
        'Set TOURS_FORCE_SEED=1 to deliberately build from the repo files instead.'
    );
  }

  const endpoint = `${base}/api/tour-content`;
  let response: Response;
  try {
    response = await fetch(endpoint, { headers: { 'X-Admin-Password': password } });
  } catch (error) {
    throw new Error(
      `[tours] could not reach ${endpoint}: ${(error as Error).message}. ` +
        'Refusing to build with stale seed content. Set TOURS_FORCE_SEED=1 to build from the repo files instead.'
    );
  }

  if (!response.ok) {
    // A 404 used to fall back to the seed files, back when the endpoint had not
    // been deployed yet. It is deployed now, and URL is the custom domain, whose
    // DNS lives outside Netlify — so a 404 most likely means the domain is
    // answering from somewhere else (a lapsed registration, a parking page).
    // Falling back there would quietly republish the repo's old content.
    const hint =
      response.status === 401
        ? "ADMIN_PASSWORD in the build environment does not match the one the function checks against."
        : response.status === 404
          ? `Nothing answered at ${endpoint} — check that the domain's DNS still points at Netlify.`
          : 'The content API returned an unexpected status.';
    throw new Error(
      `[tours] ${endpoint} returned ${response.status}. ${hint} ` +
        'Refusing to build with stale seed content, which would silently overwrite saved edits. ' +
        'Set TOURS_FORCE_SEED=1 to deliberately build from the repo files instead.'
    );
  }

  // A parked or misdirected domain answers 200 with an HTML page, which would
  // otherwise surface as an unhelpful JSON syntax error.
  const type = response.headers.get('content-type') ?? '';
  if (!type.includes('application/json')) {
    throw new Error(
      `[tours] ${endpoint} returned ${type || 'no content type'} instead of JSON — ` +
        "the domain is probably not pointing at Netlify (yet). Check the site's DNS. " +
        'Refusing to build with stale seed content. Set TOURS_FORCE_SEED=1 to build from the repo files instead.'
    );
  }

  const doc = await response.json();
  assertValidDoc(doc);
  console.log(`[tours] loaded ${doc.tours.length} tours from ${endpoint} (updated ${doc.updatedAt})`);
  return doc;
}

/**
 * Off-Netlify path. Normally there are no credentials and the seed files are
 * the right answer; explicit credentials let a developer point a local build at
 * a real store (see TOUR_STORE_NAME) to reproduce a content problem.
 */
async function loadFromBlobsOrSeed(): Promise<TourContentDoc> {
  const { store, how, siteIdSource, hasToken } = openStore();
  const auth = `store="${STORE_NAME}" auth=${how} siteId=${siteIdSource ?? 'MISSING'} token=${hasToken ? 'present' : 'MISSING'}`;

  if (!store) {
    const doc = buildSeedDoc();
    console.log(`[tours] local build, no Blobs credentials (${auth}) — using seed files (${doc.tours.length} tours)`);
    return doc;
  }

  let stored: unknown;
  try {
    stored = await store.get(CONTENT_KEY, { type: 'json' });
  } catch (error) {
    const doc = buildSeedDoc();
    console.log(`[tours] local build, Blobs unreachable (${auth}: ${(error as Error).message}) — using seed files`);
    return doc;
  }

  if (stored === null || stored === undefined) {
    const doc = buildSeedDoc();
    console.log(`[tours] local build, no saved content — using seed files (${doc.tours.length} tours)`);
    return doc;
  }

  assertValidDoc(stored);
  console.log(`[tours] local build, loaded ${stored.tours.length} tours from Blobs — ${auth}`);
  return stored;
}

const doc = await loadTourDoc();

export const tourDoc: TourContentDoc = doc;
export const toursEn: TourContent[] = flattenLocale(doc, 'en');
export const toursJa: TourContent[] = flattenLocale(doc, 'ja');
