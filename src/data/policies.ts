import type { PoliciesContent } from './types.js';
import { tourDoc } from './tours.js';
import { buildSeedPolicies } from './tourSeed.js';

/**
 * Terms & Conditions for the build, as edited in the admin's Terms & Conditions
 * tab. Rides on the same document as the tours and home page (see tours.ts and
 * site.ts); a document without `policies` predates the tab, so the seed is
 * exactly what the page showed then.
 *
 * policies.en.ts and policies.ja.ts are the seed — pages import from here.
 */
const policies = tourDoc.policies ?? buildSeedPolicies();

export const policiesEn: PoliciesContent = policies.en;
export const policiesJa: PoliciesContent = policies.ja;
