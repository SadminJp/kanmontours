import { HOME_IMAGE_SLOTS } from '../../src/data/types.js';
import type {
  AccessGroup,
  HomeContent,
  HomeImage,
  HomeImages,
  LocalizedTour,
  PoliciesContent,
  PoliciesDoc,
  PolicySection,
  SiteContent,
  TourContentDoc,
  TourEntry,
  TourImage,
} from '../../src/data/types.js';

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

/**
 * `existingHome` / `existingPolicies` are what is stored now. A save that leaves
 * either out — the sync script only sends tours — keeps it, rather than wiping
 * the home page or the Terms & Conditions.
 */
export function normalizeDoc(
  input: unknown,
  existingHome?: HomeContent,
  existingPolicies?: PoliciesDoc
): TourContentDoc {
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

  const home = raw.home === undefined ? existingHome : normalizeHome(raw.home);
  const policies = raw.policies === undefined ? existingPolicies : normalizePolicies(raw.policies);
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    tours: normalized,
    ...(home ? { home } : {}),
    ...(policies ? { policies } : {}),
  };
}

/* --- terms & conditions --------------------------------------------------- */

const POLICY_SECTION_LIMIT = 30;
const POLICY_LIST_LIMIT = 30;

function policiesSide(value: unknown, language: string): PoliciesContent {
  if (!value || typeof value !== 'object') fail(`Terms & Conditions (${language}) content is missing.`);
  const raw = value as Record<string, unknown>;
  const at = (label: string) => `Terms & Conditions (${language}) — ${label}`;

  const sections = Array.isArray(raw.sections) ? raw.sections : [];
  // An empty page would publish a Terms & Conditions page with nothing on it.
  if (!sections.length) fail(at('needs at least one section.'));
  if (sections.length > POLICY_SECTION_LIMIT) fail(at(`too many sections (limit ${POLICY_SECTION_LIMIT}).`));

  return {
    pageTitle: requireString(raw.pageTitle, at('Page title')),
    sections: sections.map((entry, index): PolicySection => {
      const section = (entry ?? {}) as Record<string, unknown>;
      const paragraphs = cleanStringList(section.paragraphs, POLICY_LIST_LIMIT);
      const list = cleanStringList(section.list, POLICY_LIST_LIMIT);
      return {
        heading: requireString(section.heading, at(`Section ${index + 1} heading`)),
        // Left off when empty rather than stored as [], matching the seed files.
        ...(paragraphs.length ? { paragraphs } : {}),
        ...(list.length ? { list } : {}),
      };
    }),
  };
}

export function normalizePolicies(input: unknown): PoliciesDoc {
  const raw = (input ?? {}) as Record<string, unknown>;
  return { en: policiesSide(raw.en, 'English'), ja: policiesSide(raw.ja, 'Japanese') };
}

/* --- home page ------------------------------------------------------------ */

const HOME_LIST_LIMIT = 20;
const ACCESS_GROUP_LIMIT = 10;
const ACCESS_ROUTE_LIMIT = 15;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function requireString(value: unknown, where: string): string {
  const cleaned = cleanString(value);
  if (!cleaned) fail(`${where} cannot be empty.`);
  return cleaned;
}

function homeSide(value: unknown, language: string): SiteContent {
  if (!value || typeof value !== 'object') fail(`Home page (${language}) content is missing.`);
  const raw = value as Record<string, any>;
  const section = (name: string) => (raw[name] ?? {}) as Record<string, any>;
  const at = (label: string) => `Home page (${language}) — ${label}`;

  const meta = section('meta');
  const hero = section('hero');
  const intro = section('intro');
  const cities = section('cities');
  const offer = section('offer');
  const tours = section('tours');
  const about = section('about');
  const access = section('access');
  const contact = section('contact');

  const city = (value: unknown, name: string) => {
    const c = (value ?? {}) as Record<string, unknown>;
    return {
      title: requireString(c.title, at(`${name} title`)),
      paragraphs: cleanStringList(c.paragraphs, HOME_LIST_LIMIT),
    };
  };

  const groups: AccessGroup[] = (Array.isArray(access.groups) ? access.groups : [])
    .slice(0, ACCESS_GROUP_LIMIT)
    .map((group: any, g: number) => ({
      heading: requireString(group?.heading, at(`Access group ${g + 1} heading`)),
      routes: (Array.isArray(group?.routes) ? group.routes : [])
        .slice(0, ACCESS_ROUTE_LIMIT)
        .map((route: any, r: number) => ({
          label: requireString(route?.label, at(`Access group ${g + 1}, route ${r + 1} label`)),
          lines: cleanStringList(route?.lines, HOME_LIST_LIMIT),
        })),
    }));

  const email = requireString(contact.email, at('Contact email'));
  if (!EMAIL_RE.test(email)) fail(`${at('Contact email')}: "${email}" is not a valid email address.`);

  return {
    meta: {
      title: requireString(meta.title, at('Search title')),
      description: requireString(meta.description, at('Search description')),
    },
    hero: {
      eyebrow: requireString(hero.eyebrow, at('Main heading')),
      title: cleanStringList(hero.title, HOME_LIST_LIMIT),
      tagline: requireString(hero.tagline, at('Tagline')),
    },
    intro: {
      heading: requireString(intro.heading, at('Cities of the Strait heading')),
      paragraphs: cleanStringList(intro.paragraphs, HOME_LIST_LIMIT),
    },
    cities: {
      heading: requireString(cities.heading, at('About the Cities heading')),
      kitakyushu: city(cities.kitakyushu, 'Kitakyushu'),
      shimonoseki: city(cities.shimonoseki, 'Shimonoseki'),
    },
    offer: {
      heading: requireString(offer.heading, at('What We Offer heading')),
      paragraphs: cleanStringList(offer.paragraphs, HOME_LIST_LIMIT),
      specialHeading: requireString(offer.specialHeading, at('What Makes Our Tours Special heading')),
      specialPoints: cleanStringList(offer.specialPoints, HOME_LIST_LIMIT),
    },
    tours: {
      heading: requireString(tours.heading, at('Tours heading')),
      intro: cleanString(tours.intro),
    },
    about: {
      heading: requireString(about.heading, at('About Us heading')),
      paragraphs: cleanStringList(about.paragraphs, HOME_LIST_LIMIT),
    },
    access: {
      heading: requireString(access.heading, at('Access heading')),
      groups,
    },
    contact: {
      heading: requireString(contact.heading, at('Contact heading')),
      email,
    },
  };
}

function homeImage(value: unknown, where: string): HomeImage {
  const raw = (value ?? {}) as Record<string, unknown>;
  const src = cleanString(raw.src);
  if (!src) fail(`${where}: photo is missing a file.`);
  if (src.includes('..') || !IMAGE_SRC_RE.test(src)) fail(`${where}: "${src}" is not a valid image path.`);
  const alt = (raw.alt ?? {}) as Record<string, unknown>;
  return { src, alt: { en: cleanString(alt.en), ja: cleanString(alt.ja) } };
}

/** The admin's names for each photo slot, so an error points at what the client sees. */
const SLOT_LABELS: Record<keyof HomeImages, string> = {
  banners: 'Banner photos',
  regionMap: 'Cities of the Strait map',
  kitakyushuGallery: 'Kitakyushu photos',
  shimonosekiGallery: 'Shimonoseki photos',
  offerGallery: 'What We Offer photos',
  aboutGallery: 'About Us photos',
  accessMap: 'Access route map',
};

/**
 * Photo slots have fixed counts: the galleries are laid out for exactly that
 * many, so a save that adds or drops one is refused rather than reshaped.
 */
function homeImages(value: unknown): HomeImages {
  const raw = (value ?? {}) as Record<string, unknown>;
  const out = {} as Record<string, unknown>;
  for (const [slot, count] of Object.entries(HOME_IMAGE_SLOTS)) {
    const where = `Home page — ${SLOT_LABELS[slot as keyof HomeImages]}`;
    if (count === null) {
      out[slot] = homeImage(raw[slot], where);
    } else {
      const list = raw[slot];
      if (!Array.isArray(list) || list.length !== count) fail(`${where}: expected exactly ${count} photos.`);
      out[slot] = list.map((image, i) => homeImage(image, `${where} ${i + 1}`));
    }
  }
  return out as unknown as HomeImages;
}

export function normalizeHome(input: unknown): HomeContent {
  const raw = (input ?? {}) as Record<string, unknown>;
  return {
    en: homeSide(raw.en, 'English'),
    ja: homeSide(raw.ja, 'Japanese'),
    images: homeImages(raw.images),
  };
}

function randomId(): string {
  return Math.random().toString(36).slice(2, 10);
}
