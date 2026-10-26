import { HOME_IMAGE_SLOTS } from './types.js';
import type {
  FormsDoc,
  HomeContent,
  HomeImages,
  Locale,
  LocalizedTour,
  PoliciesDoc,
  TourContent,
  TourContentDoc,
  TourEntry,
} from './types.js';
import { toursEn } from './tours.en.js';
import { toursJa } from './tours.ja.js';
import { siteEn } from './site.en.js';
import { siteJa } from './site.ja.js';
import { homeImagesSeed } from './homeImages.js';
import { policiesEn } from './policies.en.js';
import { policiesJa } from './policies.ja.js';
import { uiEn } from './ui.en.js';
import { uiJa } from './ui.ja.js';

/** Deterministic id from a slug, so reseeding twice produces the same document. */
function seedId(slug: string): string {
  let hash = 0;
  for (let i = 0; i < slug.length; i++) {
    hash = (hash * 31 + slug.charCodeAt(i)) | 0;
  }
  return `t_${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function toLocalized(tour: TourContent): LocalizedTour {
  const { slug: _slug, ...rest } = tour;
  return rest;
}

/**
 * The home page as committed in site.en.ts, site.ja.ts and homeImages.ts.
 *
 * Deep-copied so a caller that edits the result (the admin GET merges it into a
 * response; tests mutate it) can never alter the module-level seed objects.
 */
export function buildSeedHome(): HomeContent {
  return JSON.parse(JSON.stringify({ en: siteEn, ja: siteJa, images: homeImagesSeed }));
}

/** The Terms & Conditions page as committed in policies.en.ts / policies.ja.ts. Deep-copied like buildSeedHome. */
export function buildSeedPolicies(): PoliciesDoc {
  return JSON.parse(JSON.stringify({ en: policiesEn, ja: policiesJa }));
}

/**
 * The booking and inquiry page wording as committed in ui.en.ts / ui.ja.ts.
 *
 * Also serves as the schema: the server keeps exactly these keys per language
 * when validating a save, which is how the Japanese form's extra field labels
 * (and the English form's lack of them) are known without a second list.
 */
export function buildSeedForms(): FormsDoc {
  return JSON.parse(
    JSON.stringify({
      en: { booking: uiEn.booking, inquiryForm: uiEn.inquiryForm },
      ja: { booking: uiJa.booking, inquiryForm: uiJa.inquiryForm },
    })
  );
}

/**
 * Builds the initial document from the committed TS files.
 *
 * Pairs the two locales by slug rather than by array index. The old data files
 * relied on the two arrays staying in the same order — a silent correctness
 * trap — so a mismatch throws here instead of quietly mixing up which Japanese
 * copy belongs to which tour.
 */
export function buildSeedDoc(): TourContentDoc {
  const jaBySlug = new Map(toursJa.map((tour) => [tour.slug, tour]));

  const missing = toursEn.filter((tour) => !jaBySlug.has(tour.slug)).map((tour) => tour.slug);
  const extra = toursJa.filter((tour) => !toursEn.some((en) => en.slug === tour.slug)).map((t) => t.slug);
  if (missing.length || extra.length) {
    throw new Error(
      `tours.en.ts and tours.ja.ts disagree on slugs. Missing in JA: [${missing.join(', ')}]. Extra in JA: [${extra.join(', ')}].`
    );
  }

  return {
    version: 1,
    updatedAt: new Date(0).toISOString(),
    tours: toursEn.map((tour) => ({
      id: seedId(tour.slug),
      slug: tour.slug,
      en: toLocalized(tour),
      ja: toLocalized(jaBySlug.get(tour.slug)!),
    })),
    home: buildSeedHome(),
    policies: buildSeedPolicies(),
    forms: buildSeedForms(),
  };
}

/** Flattens the stored shape back into what every page already expects. */
export function flattenLocale(doc: TourContentDoc, locale: Locale): TourContent[] {
  return doc.tours.map((entry) => ({ slug: entry.slug, ...entry[locale] }));
}

/**
 * Structural check applied to anything read from Blobs.
 *
 * Deliberately loud: a duplicate slug would otherwise surface as an opaque
 * duplicate-route failure from getStaticPaths, and a malformed entry would
 * render as blank page sections rather than an obvious error.
 */
export function assertValidDoc(doc: unknown): asserts doc is TourContentDoc {
  const candidate = doc as Partial<TourContentDoc> | null;
  if (!candidate || !Array.isArray(candidate.tours)) {
    throw new Error('tour-content is malformed: expected a "tours" array.');
  }
  if (!candidate.tours.length) {
    throw new Error('tour-content contains no tours — refusing to build a site with no tour pages.');
  }

  const seen = new Set<string>();
  for (const [index, entry] of (candidate.tours as TourEntry[]).entries()) {
    const where = `tours[${index}]${entry?.slug ? ` (${entry.slug})` : ''}`;
    if (!entry?.slug || typeof entry.slug !== 'string') {
      throw new Error(`${where}: missing slug.`);
    }
    if (seen.has(entry.slug)) {
      throw new Error(`${where}: duplicate slug "${entry.slug}".`);
    }
    seen.add(entry.slug);

    for (const locale of ['en', 'ja'] as const) {
      const side = entry[locale];
      if (!side || typeof side !== 'object') {
        throw new Error(`${where}: missing "${locale}" content.`);
      }
      for (const field of ['title', 'number'] as const) {
        if (typeof side[field] !== 'string' || !side[field].trim()) {
          throw new Error(`${where}: "${locale}.${field}" is empty.`);
        }
      }
      for (const field of ['overview', 'highlights', 'meetingPoint', 'itinerary'] as const) {
        if (!Array.isArray(side[field])) {
          throw new Error(`${where}: "${locale}.${field}" must be a list.`);
        }
      }
    }
  }

  if (candidate.home !== undefined) assertValidHome(candidate.home);
  if (candidate.policies !== undefined) assertValidPolicies(candidate.policies);
  if (candidate.forms !== undefined) assertValidForms(candidate.forms);
}

/** Structural check of stored booking/inquiry wording, for the same reason as assertValidHome. */
function assertValidForms(forms: unknown): asserts forms is FormsDoc {
  const candidate = forms as Partial<FormsDoc> | null;
  if (!candidate || typeof candidate !== 'object') throw new Error('forms is malformed.');
  for (const locale of ['en', 'ja'] as const) {
    const side = candidate[locale];
    if (!side || typeof side !== 'object') throw new Error(`forms is missing "${locale}" content.`);
    if (!side.booking || typeof side.booking.pageTitle !== 'string' || !side.booking.pageTitle.trim()) {
      throw new Error(`forms.${locale}.booking.pageTitle is empty.`);
    }
    if (!side.booking.fields || typeof side.booking.fields !== 'object') {
      throw new Error(`forms.${locale}.booking.fields is missing.`);
    }
    if (!side.inquiryForm || typeof side.inquiryForm.pageTitle !== 'string' || !side.inquiryForm.pageTitle.trim()) {
      throw new Error(`forms.${locale}.inquiryForm.pageTitle is empty.`);
    }
  }
}

/** Structural check of a stored Terms & Conditions page, for the same reason as assertValidHome. */
function assertValidPolicies(policies: unknown): asserts policies is PoliciesDoc {
  const candidate = policies as Partial<PoliciesDoc> | null;
  if (!candidate || typeof candidate !== 'object') throw new Error('policies is malformed.');
  for (const locale of ['en', 'ja'] as const) {
    const side = candidate[locale];
    if (!side || typeof side !== 'object') throw new Error(`policies is missing "${locale}" content.`);
    if (typeof side.pageTitle !== 'string' || !side.pageTitle.trim()) {
      throw new Error(`policies.${locale}.pageTitle is empty.`);
    }
    if (!Array.isArray(side.sections) || !side.sections.length) {
      throw new Error(`policies.${locale} has no sections.`);
    }
    side.sections.forEach((section, index) => {
      if (!section || typeof section.heading !== 'string' || !section.heading.trim()) {
        throw new Error(`policies.${locale}.sections[${index}] has no heading.`);
      }
    });
  }
}

/**
 * Structural check of a stored home page. The server validates field by field
 * on save; this only guards the build against a document that would render
 * blank sections or a gallery with missing photos.
 */
function assertValidHome(home: unknown): asserts home is HomeContent {
  const candidate = home as Partial<HomeContent> | null;
  if (!candidate || typeof candidate !== 'object') throw new Error('home is malformed.');

  for (const locale of ['en', 'ja'] as const) {
    const side = candidate[locale] as unknown as Record<string, unknown> | undefined;
    if (!side || typeof side !== 'object') throw new Error(`home is missing "${locale}" content.`);
    for (const section of ['meta', 'hero', 'intro', 'cities', 'offer', 'tours', 'about', 'access', 'contact']) {
      if (!side[section] || typeof side[section] !== 'object') {
        throw new Error(`home.${locale}.${section} is missing.`);
      }
    }
  }

  const images = candidate.images as Partial<HomeImages> | undefined;
  if (!images || typeof images !== 'object') throw new Error('home.images is missing.');
  for (const [slot, count] of Object.entries(HOME_IMAGE_SLOTS)) {
    const value = images[slot as keyof HomeImages] as unknown;
    const list = count === null ? [value] : value;
    if (!Array.isArray(list) || (count !== null && list.length !== count)) {
      throw new Error(`home.images.${slot} should have ${count ?? 1} photo(s).`);
    }
    for (const image of list as Array<{ src?: unknown } | undefined>) {
      if (!image || typeof image.src !== 'string' || !image.src) {
        throw new Error(`home.images.${slot} has a photo with no file.`);
      }
    }
  }
}
