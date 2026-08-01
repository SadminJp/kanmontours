import type { TourSchedule } from './types';
import scheduleData from './schedules.json';

/**
 * Operating days live in schedules.json rather than in this file, because the
 * admin UI at /admin writes that file directly and cannot edit TypeScript.
 *
 * Everything below normalises what the CMS produces: the editor can emit
 * weekday values as strings, and cleared lists as null. Bad data fails closed —
 * an unparseable schedule offers no dates rather than offering every date.
 */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function toWeekdays(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  const days = value
    .map(Number)
    .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6);
  return [...new Set(days)].sort((a, b) => a - b);
}

function toIsoDates(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  // The CMS date picker can emit a full timestamp; keep only the date part.
  const dates = value
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.slice(0, 10))
    .filter((entry) => ISO_DATE.test(entry));
  return [...new Set(dates)].sort();
}

function toSchedule(value: unknown): TourSchedule {
  const raw = (value ?? {}) as Record<string, unknown>;
  return {
    weekdays: toWeekdays(raw.weekdays),
    blackoutDates: toIsoDates(raw.blackoutDates),
    extraDates: toIsoDates(raw.extraDates),
  };
}

/**
 * Booking lead time, from the Terms & Conditions: reservations must be made by
 * 10:00 AM three days before the tour date.
 */
const rawLeadDays = Number(scheduleData.minLeadDays);
export const MIN_LEAD_DAYS = Number.isFinite(rawLeadDays) && rawLeadDays >= 0 ? rawLeadDays : 3;

/** Operating days per tour, keyed by tour slug. Shared by both locales. */
export const tourSchedules: Record<string, TourSchedule> = Object.fromEntries(
  Object.entries(scheduleData.tours ?? {}).map(([slug, schedule]) => [slug, toSchedule(schedule)])
);
