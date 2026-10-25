import type { HomeImages, SiteContent } from './types.js';
import { tourDoc } from './tours.js';
import { buildSeedHome } from './tourSeed.js';

/**
 * Home page and site-wide text for the build, as edited in the admin's Home
 * Page tab.
 *
 * It rides on the same document as the tours (see tours.ts for how that is
 * loaded and why failures stop the build). A document without `home` was saved
 * before the Home Page tab existed, so the seed is exactly what the site showed
 * then — falling back to it here is correct, not a silent staleness risk.
 *
 * site.en.ts and site.ja.ts are the seed. Pages import from this module, never
 * from those files, or an edit would reach the home page but not the titles and
 * footer on every other page.
 */
const home = tourDoc.home ?? buildSeedHome();

export const siteEn: SiteContent = home.en;
export const siteJa: SiteContent = home.ja;
export const homeImages: HomeImages = home.images;
