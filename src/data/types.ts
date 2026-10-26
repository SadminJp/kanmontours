export type Locale = 'en' | 'ja';

export interface ItineraryStep {
  text: string;
}

export interface TourImage {
  src: string;
  alt: string;
}

export interface TourContent {
  slug: string;
  number: string;
  title: string;
  subtitle: string;
  heroImage: string;
  cardSummary: string;
  overview: string[];
  overviewImages?: TourImage[];
  highlights: string[];
  highlightImages?: TourImage[];
  detailPrice: string;
  bookingPrice: string;
  included: string;
  notIncluded: string;
  departureTime: string;
  duration: string;
  meetingPoint: string[];
  groupSize: string;
  operatingDatesNote: string;
  sharedNote: string;
  itinerary: ItineraryStep[];
  walkingDistance: string;
}

/**
 * How a tour is stored in Netlify Blobs, as opposed to how pages consume it.
 *
 * `slug` is hoisted out of the per-locale halves so the two languages can never
 * drift apart the way two parallel arrays could, and `id` is a stable handle
 * that survives a slug rename — it's what lets a rename move the tour's booking
 * schedule across instead of orphaning it. Neither is ever rendered.
 */
export type LocalizedTour = Omit<TourContent, 'slug'>;

export interface TourEntry {
  id: string;
  slug: string;
  previousSlugs?: string[];
  en: LocalizedTour;
  ja: LocalizedTour;
}

/**
 * The document stored in Netlify Blobs under the `tour-content` key. Despite the
 * name it also carries the home page: one document means one save, one
 * concurrency check and one publish for everything the admin edits.
 *
 * `home` is optional because documents saved before the Home Page tab existed
 * don't have it; a missing `home` means "use the seed", which is exactly what
 * the site showed at the time.
 */
export interface TourContentDoc {
  version: 1;
  updatedAt: string;
  tours: TourEntry[];
  home?: HomeContent;
  /** Terms & Conditions page; absent = use the seed, like `home`. */
  policies?: PoliciesDoc;
  /** Booking Request and Inquiry page wording; absent = use the seed, like `home`. */
  forms?: FormsDoc;
}

/**
 * The editable wording of the booking and inquiry pages. Which booking field
 * labels exist differs by language (the Japanese form asks for more), and the
 * seed in ui.en.ts / ui.ja.ts is what defines that — see buildSeedForms.
 */
export interface FormsContent {
  booking: UiStrings['booking'];
  inquiryForm: UiStrings['inquiryForm'];
}

export interface FormsDoc {
  en: FormsContent;
  ja: FormsContent;
}

export interface PoliciesDoc {
  en: PoliciesContent;
  ja: PoliciesContent;
}

/** One photo on the home page: shared by both languages, described in each. */
export interface HomeImage {
  src: string;
  alt: { en: string; ja: string };
}

/**
 * The home page's photo slots. The counts are fixed (see HOME_IMAGE_SLOTS) so
 * an edit can replace a photo but never leave a gallery with a hole in it.
 */
export interface HomeImages {
  banners: HomeImage[];
  regionMap: HomeImage;
  kitakyushuGallery: HomeImage[];
  shimonosekiGallery: HomeImage[];
  offerGallery: HomeImage[];
  aboutGallery: HomeImage[];
  accessMap: HomeImage;
}

export interface HomeContent {
  en: SiteContent;
  ja: SiteContent;
  images: HomeImages;
}

/** Gallery sizes the home page layout is built around; null = a single photo. */
export const HOME_IMAGE_SLOTS: Record<keyof HomeImages, number | null> = {
  banners: 2,
  regionMap: null,
  kitakyushuGallery: 3,
  shimonosekiGallery: 3,
  offerGallery: 2,
  aboutGallery: 4,
  accessMap: null,
};

export interface AccessRoute {
  label: string;
  lines: string[];
}

export interface AccessGroup {
  heading: string;
  routes: AccessRoute[];
}

export interface SiteContent {
  meta: {
    title: string;
    description: string;
  };
  hero: {
    eyebrow: string;
    title: string[];
    tagline: string;
  };
  intro: {
    heading: string;
    paragraphs: string[];
  };
  cities: {
    heading: string;
    kitakyushu: { title: string; paragraphs: string[] };
    shimonoseki: { title: string; paragraphs: string[] };
  };
  offer: {
    heading: string;
    paragraphs: string[];
    specialHeading: string;
    specialPoints: string[];
  };
  tours: {
    heading: string;
    intro: string;
  };
  about: {
    heading: string;
    paragraphs: string[];
  };
  access: {
    heading: string;
    groups: AccessGroup[];
  };
  contact: {
    heading: string;
    email: string;
  };
}

export interface PolicySection {
  heading: string;
  paragraphs?: string[];
  list?: string[];
}

export interface PoliciesContent {
  pageTitle: string;
  sections: PolicySection[];
}

export interface UiStrings {
  nav: {
    home: string;
    aboutCities: string;
    offer: string;
    tours: string;
    aboutUs: string;
    booking: string;
    inquiry: string;
    policies: string;
    langSwitchLabel: string;
    langSwitchTo: string;
    brandTagline: string;
  };
  buttons: {
    readMore: string;
    detailsAndBooking: string;
    booking: string;
    inquiry: string;
  };
  tourMeta: {
    overview: string;
    highlights: string;
    price: string;
    included: string;
    notIncluded: string;
    departureTime: string;
    duration: string;
    meetingPoint: string;
    groupSize: string;
    operatingDates: string;
    itinerary: string;
    walkingDistance: string;
  };
  booking: {
    pageTitle: string;
    step1: string;
    step2: string;
    calendarHint: string;
    loadingDates: string;
    datesUnavailable: string;
    selectTourFirst: string;
    step3: string;
    fields: {
      totalParticipants?: string;
      name?: string;
      email?: string;
      adults?: string;
      underAge?: string;
      representativeName?: string;
      kanji?: string;
      katakana?: string;
      contact?: string;
      phone?: string;
    };
    step4: string;
    termsAgree: string;
    submit: string;
    selectedDate: string;
    successMessage: string;
    errorMessage: string;
  };
  inquiryForm: {
    pageTitle: string;
    intro: string;
    name: string;
    email: string;
    message: string;
    submit: string;
    successMessage: string;
    errorMessage: string;
  };
  footer: {
    quickLinks: string;
    rights: string;
  };
  calendar: {
    months: string[];
    weekdays: string[];
  };
}
