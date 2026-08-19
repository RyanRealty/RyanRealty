/**
 * Route-local FAQ for /contact. Same three questions the pre-v3 page
 * published in FAQPage JSON-LD. No new claims.
 */

/** One unique control id per contact-sheet field. Nightly locators use these. */
export const CONTACT_FIELD_IDS = {
  name: 'contact-name',
  email: 'contact-email',
  phone: 'contact-phone',
  message: 'contact-message',
} as const

export const CONTACT_FAQ_ITEMS = [
  {
    question: 'What areas does Ryan Realty serve?',
    answer:
      'Ryan Realty serves Central Oregon including Bend, Redmond, Sisters, Sunriver, La Pine, Prineville, and surrounding communities.',
  },
  {
    question: 'How do I schedule a showing?',
    answer:
      'Send the form on this page or call the office. A broker replies within one business day to set a time for the showing.',
  },
  {
    question: 'How quickly will I hear back after contacting Ryan Realty?',
    answer:
      'A broker replies within one business day. Calling or texting gets you an answer sooner.',
  },
] as const
