import type { TourSchedule } from './types';

/**
 * Booking lead time, from the Terms & Conditions: reservations must be made by
 * 10:00 AM three days before the tour date. The calendar therefore offers no
 * date sooner than this many days from today.
 */
export const MIN_LEAD_DAYS = 3;

/**
 * Operating days per tour, keyed by tour slug. Shared by both locales — a date
 * is the same date in either language, so this must not be duplicated into
 * tours.en.ts / tours.ja.ts.
 *
 *   weekdays      0 = Sunday … 6 = Saturday
 *   blackoutDates dates the tour is cancelled, even though the weekday matches
 *   extraDates    one-off dates the tour runs, outside its usual weekdays
 *
 * PLACEHOLDER: every tour below is currently set to Tue / Thu / Sat. Replace
 * these with the real operating days before the client relies on the calendar.
 */
export const tourSchedules: Record<string, TourSchedule> = {
  'moji-port-town': {
    weekdays: [2, 4, 6],
    blackoutDates: [],
    extraDates: [],
  },
  'kokura-castle': {
    weekdays: [2, 4, 6],
    blackoutDates: [],
    extraDates: [],
  },
  'toto-museum': {
    weekdays: [2, 4, 6],
    blackoutDates: [],
    extraDates: [],
  },
  'shimonoseki-castle-town': {
    weekdays: [2, 4, 6],
    blackoutDates: [],
    extraDates: [],
  },
};
