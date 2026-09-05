import type { Locale, LocalizedTour, TourContent, TourContentDoc, TourEntry } from './types';
import { toursEn } from './tours.en';
import { toursJa } from './tours.ja';

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
}
