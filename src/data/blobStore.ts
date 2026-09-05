import { getStore, type Store } from '@netlify/blobs';

/**
 * Deploy previews and branch builds share a site's Blobs store, so without a
 * suffix an edit made from a preview admin would land in the content the next
 * production build reads. TOUR_STORE_NAME overrides both, so a local build can
 * be pointed at a scratch store instead of the live one.
 */
export const STORE_NAME =
  process.env.TOUR_STORE_NAME ||
  (process.env.CONTEXT && process.env.CONTEXT !== 'production'
    ? `kanmon-tours-${process.env.CONTEXT}`
    : 'kanmon-tours');

export const CONTENT_KEY = 'tour-content';
export const PUBLISH_KEY = 'tour-content-publish';

/** True when running inside a Netlify build or function, not a local machine. */
export const ON_NETLIFY = process.env.NETLIFY === 'true';

/**
 * Opens the Blobs store, or returns null when no credentials are available.
 *
 * getStore() throws synchronously on missing credentials rather than failing on
 * the first read, so the try has to wrap the call itself. Functions get their
 * credentials injected via NETLIFY_BLOBS_CONTEXT; a build does not reliably, so
 * we pass siteID/token explicitly and let the injected context win when present.
 */
export function openStore(): Store | null {
  const siteID = process.env.SITE_ID || process.env.NETLIFY_SITE_ID;
  const token = process.env.NETLIFY_API_TOKEN || process.env.NETLIFY_AUTH_TOKEN;

  try {
    return siteID && token
      ? // Strong consistency because Publish fires a build within seconds of a
        // Save — an eventually-consistent read could rebuild the old content.
        getStore({ name: STORE_NAME, siteID, token, consistency: 'strong' })
      : getStore(STORE_NAME);
  } catch {
    return null;
  }
}
