export type Locale = 'en' | 'ja';

export interface ItineraryStep {
  text: string;
}

export interface TourContent {
  slug: string;
  number: string;
  title: string;
  subtitle: string;
  heroImage: string;
  cardSummary: string;
  overview: string[];
  highlights: string[];
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
    title: string;
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
    perPerson: string;
    selectedDate: string;
  };
  inquiryForm: {
    pageTitle: string;
    intro: string;
    name: string;
    email: string;
    message: string;
    submit: string;
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
