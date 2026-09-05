import type { TourContent, TourContentDoc } from './types.js';
import { CONTENT_KEY, ON_NETLIFY, openStore } from './blobStore.js';
import { assertValidDoc, buildSeedDoc, flattenLocale } from './tourSeed.js';

/**
 * Loads tour content for the build.
 *
 * The important rule is that a Blobs failure on Netlify FAILS THE BUILD rather
 * than falling back to the committed seed files. Falling back would look like a
 * success — green deploy, no error — while silently republishing months-old
 * content over the client's edits. A failed build is loud and leaves the last
 * good deploy serving, which is strictly better.
 *
 * Locally there are no credentials and falling back is the correct, everyday
 * behaviour, so the distinction is drawn on ON_NETLIFY rather than on the error.
 */
async function loadTourDoc(): Promise<TourContentDoc> {
  if (process.env.TOURS_FORCE_SEED === '1') {
    const doc = buildSeedDoc();
    console.log(`[tours] TOURS_FORCE_SEED=1 — using seed files (${doc.tours.length} tours)`);
    return doc;
  }

  const store = openStore();
  if (!store) {
    const doc = buildSeedDoc();
    console.log(`[tours] no Blobs credentials — using seed files (${doc.tours.length} tours)`);
    return doc;
  }

  let stored: unknown;
  try {
    stored = await store.get(CONTENT_KEY, { type: 'json' });
  } catch (error) {
    if (ON_NETLIFY) {
      throw new Error(
        `[tours] could not read tour content from Blobs: ${(error as Error).message}. ` +
          'Refusing to build with stale seed content. Check that SITE_ID and NETLIFY_API_TOKEN ' +
          'are scoped to Builds, or set TOURS_FORCE_SEED=1 to deliberately build from the repo files.'
      );
    }
    const doc = buildSeedDoc();
    console.log(`[tours] Blobs unreachable locally — using seed files (${doc.tours.length} tours)`);
    return doc;
  }

  // A missing key is legitimate: nobody has opened the admin yet. The content
  // function seeds it on first read, so this only happens on the first deploy.
  if (stored === null || stored === undefined) {
    const doc = buildSeedDoc();
    console.log(`[tours] no saved content yet — using seed files (${doc.tours.length} tours)`);
    return doc;
  }

  // A document that exists but is invalid is never silently replaced with seed
  // data — that would hide the client's content behind stale copy.
  assertValidDoc(stored);
  console.log(`[tours] loaded ${stored.tours.length} tours from Blobs (updated ${stored.updatedAt})`);
  return stored;
}

const doc = await loadTourDoc();

export const tourDoc: TourContentDoc = doc;
export const toursEn: TourContent[] = flattenLocale(doc, 'en');
export const toursJa: TourContent[] = flattenLocale(doc, 'ja');
