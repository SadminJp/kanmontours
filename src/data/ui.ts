import type { UiStrings } from './types.js';
import { tourDoc } from './tours.js';
import { buildSeedForms } from './tourSeed.js';
import { uiEn as seedUiEn } from './ui.en.js';
import { uiJa as seedUiJa } from './ui.ja.js';

/**
 * Interface wording for the build, with the Booking Request and Inquiry pages'
 * text taken from what the admin's Booking & Inquiry tab saved.
 *
 * Only `booking` and `inquiryForm` are editable; everything else (navigation,
 * buttons, calendar month names) still comes from ui.en.ts / ui.ja.ts. A
 * document without `forms` predates the tab, so the seed is what the pages
 * showed then.
 *
 * The booking and inquiry pages must import from here rather than the seed
 * files, or edits would never reach them.
 */
const forms = tourDoc.forms ?? buildSeedForms();

export const uiEn: UiStrings = { ...seedUiEn, booking: forms.en.booking, inquiryForm: forms.en.inquiryForm };
export const uiJa: UiStrings = { ...seedUiJa, booking: forms.ja.booking, inquiryForm: forms.ja.inquiryForm };
