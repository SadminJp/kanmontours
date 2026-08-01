import { getStore } from '@netlify/blobs';
import { createHash, timingSafeEqual } from 'node:crypto';
import type { Context } from '@netlify/functions';

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

const STORE_NAME = 'kanmon-tours';
const BLOB_KEY = 'schedules';
const TOUR_SLUGS = ['moji-port-town', 'kokura-castle', 'toto-museum', 'shimonoseki-castle-town'] as const;

interface TourSchedule {
  weekdays: number[];
  blackoutDates: string[];
  extraDates: string[];
}

interface Schedules {
  minLeadDays: number;
  tours: Record<string, TourSchedule>;
}

// Seed data for the very first request, before anyone has saved via the admin
// page. Only ever matters for a brand-new Blobs store — once the admin page
// has been used once, the saved data takes over.
const DEFAULT_SCHEDULES: Schedules = {
  minLeadDays: 3,
  tours: Object.fromEntries(TOUR_SLUGS.map((slug) => [slug, { weekdays: [2, 4, 6], blackoutDates: [], extraDates: [] }])),
};

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

/** Bad or missing input fails closed to the safe default, never to "everything open." */
function normalizeSchedules(input: unknown): Schedules {
  const raw = (input ?? {}) as Record<string, unknown>;
  const rawTours = (raw.tours ?? {}) as Record<string, unknown>;
  const leadDays = Number(raw.minLeadDays);

  const tours: Record<string, TourSchedule> = {};
  for (const slug of TOUR_SLUGS) {
    const t = (rawTours[slug] ?? {}) as Record<string, unknown>;
    tours[slug] = {
      weekdays: toWeekdays(t.weekdays),
      blackoutDates: toIsoDates(t.blackoutDates),
      extraDates: toIsoDates(t.extraDates),
    };
  }

  return {
    minLeadDays: Number.isFinite(leadDays) && leadDays >= 0 ? leadDays : DEFAULT_SCHEDULES.minLeadDays,
    tours,
  };
}

/**
 * Constant-time string comparison. crypto.timingSafeEqual requires equal-length
 * buffers and throws otherwise, which a variable-length user password would
 * trip — hashing both sides to a fixed-length digest first sidesteps that
 * while still avoiding the early-exit timing leak of a plain === comparison.
 */
function safeEqual(a: string, b: string): boolean {
  const hashA = createHash('sha256').update(a).digest();
  const hashB = createHash('sha256').update(b).digest();
  return timingSafeEqual(hashA, hashB);
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

export default async (req: Request, _context: Context): Promise<Response> => {
  const store = getStore(STORE_NAME);

  if (req.method === 'GET') {
    let current = await store.get(BLOB_KEY, { type: 'json' });
    if (!current) {
      current = DEFAULT_SCHEDULES;
      await store.setJSON(BLOB_KEY, current);
    }
    return json(normalizeSchedules(current));
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

    const normalized = normalizeSchedules(data);
    await store.setJSON(BLOB_KEY, normalized);
    return json({ ok: true, data: normalized });
  }

  return json({ error: 'Method not allowed.' }, 405);
};
