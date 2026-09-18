import { getStore } from '@netlify/blobs';
import type { Context } from '@netlify/functions';
import type { Store } from '@netlify/blobs';
import { CONTENT_KEY, SCHEDULES_KEY, STORE_NAME, json, safeEqual } from '../lib/admin.js';

/**
 * Serves and updates the tour operating-day schedule that the public booking
 * calendar reads, and that the admin page at /admin/ edits.
 *
 * GET  — public, no auth. The booking calendar needs this for every visitor.
 * POST — requires the ADMIN_PASSWORD env var (set in Netlify's dashboard,
 *        never in the repo) as a shared password. There is no per-user
 *        identity here by design — this data isn't sensitive enough to
 *        justify more than a single shared password for one small business.
 *
 * Storage is a single JSON blob rather than per-tour keys: the whole
 * schedule is small, and admin saves always replace the full document, so
 * there's nothing gained from splitting it up.
 */

/**
 * Last-resort slug list, used only when the tour-content document can't be
 * read. It must never be possible for the slug list to come back empty: the
 * booking calendar treats a slug it can't find as "no operating days", so an
 * empty list would silently disable every date on the calendar and the
 * business would stop taking bookings without any visible error.
 */
const FALLBACK_TOUR_SLUGS = ['kanmon-strait-grand-tour', 'kokura-castle', 'toto-museum', 'shimonoseki-castle-town'];

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const LOCALES = ['en', 'ja'] as const;
type Locale = (typeof LOCALES)[number];

interface LocaleSchedule {
  weekdays: number[];
  blackoutDates: string[];
  extraDates: string[];
}

/**
 * A tour's availability.
 *
 * The three fields are the schedule both languages share. `byLocale` is the
 * optional override for tours that run on different days in English and
 * Japanese; null — or a missing branch within it — means that language falls
 * back to the shared fields. Every document written before this existed simply
 * has no `byLocale` key, which already reads as "no override", so nothing
 * needed converting.
 *
 * The locale nests INSIDE the per-slug value rather than above `tours` on
 * purpose: tour-content.ts rewrites this blob on a slug rename by spreading
 * each per-slug value opaquely, and a locale dimension above `tours` would
 * quietly break that.
 */
interface TourSchedule extends LocaleSchedule {
  byLocale: Partial<Record<Locale, LocaleSchedule>> | null;
}

interface Schedules {
  minLeadDays: number;
  leadDaysByLocale: Partial<Record<Locale, number>> | null;
  tours: Record<string, TourSchedule>;
}

const DEFAULT_MIN_LEAD_DAYS = 3;

/**
 * The tours the schedule covers, taken from the content document so that a tour
 * added through the admin page automatically gets a schedule entry.
 *
 * Falls back rather than returning an empty list — see FALLBACK_TOUR_SLUGS.
 */
async function getTourSlugs(store: Store): Promise<string[]> {
  try {
    const doc = (await store.get(CONTENT_KEY, { type: 'json' })) as { tours?: unknown } | null;
    const tours = Array.isArray(doc?.tours) ? doc.tours : [];
    const slugs = tours
      .map((tour) => (tour as { slug?: unknown })?.slug)
      .filter((slug): slug is string => typeof slug === 'string' && SLUG_RE.test(slug));
    const unique = [...new Set(slugs)];
    if (unique.length) return unique;
  } catch {
    // Fall through — a content-store problem must not take bookings offline.
  }
  return FALLBACK_TOUR_SLUGS;
}

// Seed data for the very first request, before anyone has saved via the admin
// page. Only ever matters for a brand-new Blobs store — once the admin page
// has been used once, the saved data takes over.
function defaultSchedules(slugs: string[]): Schedules {
  return {
    minLeadDays: DEFAULT_MIN_LEAD_DAYS,
    leadDaysByLocale: null,
    tours: Object.fromEntries(
      slugs.map((slug) => [slug, { weekdays: [2, 4, 6], blackoutDates: [], extraDates: [], byLocale: null }])
    ),
  };
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function toWeekdays(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  const days = value.map(Number).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6);
  return [...new Set(days)].sort((a, b) => a - b);
}

function toIsoDates(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const dates = value
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.slice(0, 10))
    .filter((entry) => ISO_DATE.test(entry));
  return [...new Set(dates)].sort();
}

function toLocaleSchedule(value: unknown): LocaleSchedule {
  const raw = (value ?? {}) as Record<string, unknown>;
  return {
    weekdays: toWeekdays(raw.weekdays),
    blackoutDates: toIsoDates(raw.blackoutDates),
    extraDates: toIsoDates(raw.extraDates),
  };
}

/**
 * Normalises the optional per-language override.
 *
 * Anything unusable becomes null, which means both languages fall back to the
 * tour's shared schedule. That is still failing closed: the fallback is a real
 * schedule the admin set, not "every date open". A branch that is simply absent
 * is left absent rather than filled with an empty schedule, so a half-written
 * override degrades to the shared days instead of silently making one language
 * unbookable.
 */
function toByLocale(value: unknown): Partial<Record<Locale, LocaleSchedule>> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;

  const out: Partial<Record<Locale, LocaleSchedule>> = {};
  for (const locale of LOCALES) {
    if (raw[locale] !== undefined && raw[locale] !== null) out[locale] = toLocaleSchedule(raw[locale]);
  }
  return Object.keys(out).length ? out : null;
}

function toLeadDays(value: unknown): number | null {
  const days = Number(value);
  return Number.isFinite(days) && days >= 0 ? Math.floor(days) : null;
}

function toLeadDaysByLocale(value: unknown): Partial<Record<Locale, number>> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;

  const out: Partial<Record<Locale, number>> = {};
  for (const locale of LOCALES) {
    const days = toLeadDays(raw[locale]);
    if (days !== null) out[locale] = days;
  }
  return Object.keys(out).length ? out : null;
}

/** Bad or missing input fails closed to the safe default, never to "everything open." */
function normalizeSchedules(input: unknown, slugs: string[]): Schedules {
  const raw = (input ?? {}) as Record<string, unknown>;
  const rawTours = (raw.tours ?? {}) as Record<string, unknown>;

  const tours: Record<string, TourSchedule> = {};
  for (const slug of slugs) {
    const t = (rawTours[slug] ?? {}) as Record<string, unknown>;
    tours[slug] = {
      ...toLocaleSchedule(t),
      byLocale: toByLocale(t.byLocale),
    };
  }

  return {
    minLeadDays: toLeadDays(raw.minLeadDays) ?? DEFAULT_MIN_LEAD_DAYS,
    leadDaysByLocale: toLeadDaysByLocale(raw.leadDaysByLocale),
    tours,
  };
}

export default async (req: Request, _context: Context): Promise<Response> => {
  const store = getStore(STORE_NAME);

  if (req.method === 'GET') {
    const slugs = await getTourSlugs(store);
    let current = await store.get(SCHEDULES_KEY, { type: 'json' });
    if (!current) {
      current = defaultSchedules(slugs);
      await store.setJSON(SCHEDULES_KEY, current);
    }
    // A tour added since the last save is backfilled here with no operating
    // days, so it is not bookable until someone sets them in the admin page.
    return json(normalizeSchedules(current, slugs));
  }

  if (req.method === 'POST') {
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminPassword) {
      return json({ error: 'Admin password is not configured on the server.' }, 500);
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return json({ error: 'Invalid request body.' }, 400);
    }

    const { password, data } = (body ?? {}) as { password?: unknown; data?: unknown };
    if (typeof password !== 'string' || !safeEqual(password, adminPassword)) {
      return json({ error: 'Incorrect password.' }, 401);
    }

    // A request with a password but no data is a login / session check from
    // the admin page — confirm the password and stop, without touching Blobs.
    if (data === undefined) {
      return json({ ok: true });
    }

    const normalized = normalizeSchedules(data, await getTourSlugs(store));
    await store.setJSON(SCHEDULES_KEY, normalized);
    return json({ ok: true, data: normalized });
  }

  return json({ error: 'Method not allowed.' }, 405);
};
