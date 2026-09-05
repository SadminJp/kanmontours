import type { LocalizedTour, TourContentDoc, TourEntry, TourImage } from '../../src/data/types.js';

/**
 * Validation for admin-submitted tour content.
 *
 * Split out from the function handler so it can be unit-tested without Netlify
 * Blobs credentials — the handler calls getStore() before anything else, which
 * throws off-platform.
 *
 * The philosophy differs deliberately from normalizeSchedules in schedules.ts.
 * That fails closed, because "nothing is bookable" is a safe resting state.
 * Content has no safe empty state: failing closed would erase the client's
 * website copy. So anything malformed is REJECTED with a message naming the
 * offending tour and field, and only harmless tidying (trimming, dropping
 * blank rows) is applied silently.
 */

export class ValidationError extends Error {}

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const IMAGE_SRC_RE = /^\/images\/[A-Za-z0-9][A-Za-z0-9._/-]*\.(jpg|jpeg|png|webp)$/i;
const ID_RE = /^[A-Za-z0-9_-]{4,32}$/;

// Slugs that would collide with a real route under /en/ or /ja/.
const RESERVED_SLUGS = ['admin', 'api', 'images', 'booking', 'inquiry', 'policies', 'tours'];

const MAX_TOURS = 20;
const MAX_STRING = 4000;
export const MAX_DOC_BYTES = 512 * 1024;

const LIST_LIMITS = { overview: 20, highlights: 20, meetingPoint: 10, itinerary: 30 } as const;
const IMAGE_LIMIT = 12;

/** Fields that would break a page or a booking email if left blank. */
const REQUIRED_FIELDS = [
  'number',
  'title',
  'subtitle',
  'heroImage',
  'cardSummary',
  'detailPrice',
  'bookingPrice',
  'departureTime',
  'duration',
  'groupSize',
] as const;

/** Fields that are legitimately allowed to be empty. */
const OPTIONAL_FIELDS = [
  'included',
  'notIncluded',
  'operatingDatesNote',
  'sharedNote',
  'walkingDistance',
] as const;

function fail(message: string): never {
  throw new ValidationError(message);
}

/**
 * Trims, caps length, and strips control characters.
 *
 * Written as a loop rather than a regex so no control characters have to
 * appear literally in this file. Tab and newline are kept, since the
 * multi-line fields legitimately contain them.
 */
function cleanString(value: unknown): string {
  if (typeof value !== 'string') return '';
  let out = '';
  for (const char of value) {
    const code = char.charCodeAt(0);
    if (code === 9 || code === 10 || code >= 32) out += char;
  }
  return out.trim().slice(0, MAX_STRING);
}

function cleanStringList(value: unknown, limit: number): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(cleanString).filter(Boolean).slice(0, limit);
}

function cleanImages(value: unknown, where: string): TourImage[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, IMAGE_LIMIT).map((entry, index) => {
    const raw = (entry ?? {}) as Record<string, unknown>;
    const src = cleanString(raw.src);
    if (!src) fail(`${where}[${index}]: image is missing a file.`);
    if (src.includes('..') || !IMAGE_SRC_RE.test(src)) {
      fail(`${where}[${index}]: "${src}" is not a valid image path.`);
    }
    return { src, alt: cleanString(raw.alt) };
  });
}

function normalizeLocale(value: unknown, where: string): LocalizedTour {
  const raw = (value ?? {}) as Record<string, unknown>;
  const out = {} as Record<string, unknown>;

  for (const field of REQUIRED_FIELDS) {
    const cleaned = cleanString(raw[field]);
    if (!cleaned) fail(`${where}: "${field}" cannot be empty.`);
    out[field] = cleaned;
  }
  for (const field of OPTIONAL_FIELDS) {
    out[field] = cleanString(raw[field]);
  }

  out.overview = cleanStringList(raw.overview, LIST_LIMITS.overview);
  out.highlights = cleanStringList(raw.highlights, LIST_LIMITS.highlights);
  out.meetingPoint = cleanStringList(raw.meetingPoint, LIST_LIMITS.meetingPoint);

  // Accepts {text} objects or bare strings, so a simpler admin payload works.
  const steps = Array.isArray(raw.itinerary) ? raw.itinerary : [];
  out.itinerary = steps
    .map((step) => cleanString(typeof step === 'string' ? step : (step as { text?: unknown })?.text))
    .filter(Boolean)
    .slice(0, LIST_LIMITS.itinerary)
    .map((text) => ({ text }));

  out.overviewImages = cleanImages(raw.overviewImages, `${where}.overviewImages`);
  out.highlightImages = cleanImages(raw.highlightImages, `${where}.highlightImages`);

  return out as unknown as LocalizedTour;
}

export function normalizeDoc(input: unknown): TourContentDoc {
  const raw = (input ?? {}) as Record<string, unknown>;
  const tours = raw.tours;

  if (!Array.isArray(tours)) fail('Expected a list of tours.');
  // An empty list would delete every tour page, the homepage grid and every
  // option on the booking form in a single save.
  if (!tours.length) fail('A site must have at least one tour.');
  if (tours.length > MAX_TOURS) fail(`Too many tours (limit ${MAX_TOURS}).`);

  const seenSlugs = new Set<string>();
  const seenIds = new Set<string>();

  const normalized: TourEntry[] = tours.map((entry, index) => {
    const rawEntry = (entry ?? {}) as Record<string, unknown>;
    const slug = cleanString(rawEntry.slug).toLowerCase();
    const where = `Tour ${index + 1}${slug ? ` (${slug})` : ''}`;

    if (!slug) fail(`${where}: web address (slug) cannot be empty.`);
    if (!SLUG_RE.test(slug) || slug.length > 60) {
      fail(`${where}: "${slug}" is not a valid web address. Use lowercase letters, numbers and hyphens.`);
    }
    if (RESERVED_SLUGS.includes(slug)) fail(`${where}: "${slug}" is reserved and cannot be used.`);
    // Duplicates would otherwise surface as an opaque duplicate-route failure
    // from getStaticPaths at build time.
    if (seenSlugs.has(slug)) fail(`${where}: two tours share the web address "${slug}".`);
    seenSlugs.add(slug);

    let id = cleanString(rawEntry.id);
    if (!id || !ID_RE.test(id) || seenIds.has(id)) id = `t_${randomId()}`;
    seenIds.add(id);

    const previousSlugs = cleanStringList(rawEntry.previousSlugs, 10)
      .map((entry) => entry.toLowerCase())
      .filter((entry) => SLUG_RE.test(entry) && entry !== slug);

    return {
      id,
      slug,
      ...(previousSlugs.length ? { previousSlugs } : {}),
      en: normalizeLocale(rawEntry.en, `${where} English`),
      ja: normalizeLocale(rawEntry.ja, `${where} Japanese`),
    };
  });

  return { version: 1, updatedAt: new Date().toISOString(), tours: normalized };
}

function randomId(): string {
  return Math.random().toString(36).slice(2, 10);
}
