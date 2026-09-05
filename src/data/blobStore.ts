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

export interface StoreHandle {
  store: Store | null;
  /** How credentials were obtained — reported in logs to make 401s diagnosable. */
  how: 'explicit' | 'injected-context' | 'unavailable';
  siteIdSource: string | null;
  hasToken: boolean;
}

/**
 * Opens the Blobs store, reporting how it authenticated.
 *
 * A deployed function gets credentials injected via NETLIFY_BLOBS_CONTEXT, but
 * a build does not, so it has to pass siteID/token explicitly. Distinguishing
 * the two paths matters: an auth failure means something different depending on
 * which one was taken, and without this the only symptom is a bare 401.
 *
 * getStore() throws synchronously on missing credentials rather than failing on
 * the first read, so the try has to wrap the call itself.
 */
export function openStore(): StoreHandle {
  const siteIdSource = process.env.SITE_ID
    ? 'SITE_ID'
    : process.env.NETLIFY_SITE_ID
      ? 'NETLIFY_SITE_ID'
      : null;
  const siteID = process.env.SITE_ID || process.env.NETLIFY_SITE_ID;
  const token = process.env.NETLIFY_API_TOKEN || process.env.NETLIFY_AUTH_TOKEN;
  const hasToken = Boolean(token);

  if (siteID && token) {
    try {
      return {
        // Strong consistency because Publish fires a build within seconds of a
        // Save — an eventually-consistent read could rebuild the old content.
        store: getStore({ name: STORE_NAME, siteID, token, consistency: 'strong' }),
        how: 'explicit',
        siteIdSource,
        hasToken,
      };
    } catch {
      return { store: null, how: 'unavailable', siteIdSource, hasToken };
    }
  }

  try {
    return { store: getStore(STORE_NAME), how: 'injected-context', siteIdSource, hasToken };
  } catch {
    return { store: null, how: 'unavailable', siteIdSource, hasToken };
  }
}
