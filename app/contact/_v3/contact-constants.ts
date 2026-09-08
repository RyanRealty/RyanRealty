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
      'All of Central Oregon: Bend, Redmond, Sisters, Sunriver, La Pine, Prineville, Tumalo, Terrebonne, and the communities around them. We live here, and we know these neighborhoods.',
  },
  {
    question: 'How do I schedule a showing?',
    answer:
      'Send the form on this page, or call or text the office. A broker gets back to you within one business day to set a time that works for you.',
  },
  {
    question: 'How quickly will I hear back after contacting Ryan Realty?',
    answer:
      'Within one business day, and usually sooner. If it is urgent, call or text and you will reach us faster.',
  },
] as const
