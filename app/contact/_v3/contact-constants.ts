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

/**
 * The contact form's honeypot (FUNNEL-1, 2026-09-23). The same bait name and
 * label the alerts sheet and the place-page ask use (`company`): a script fills
 * every field it finds, a person never sees this one. A filled trap does not
 * drop the submit; it is one signal to the intake screen (lib/crm/lead-quality),
 * which keeps the row and tags it.
 */
export const CONTACT_TRAP = { name: 'company', label: 'Company' } as const

export const CONTACT_FAQ_ITEMS = [
  {
    question: 'What areas does Ryan Realty serve?',
    answer:
      'All of Central Oregon: Bend, Redmond, Sisters, Sunriver, La Pine, Prineville, Tumalo, Terrebonne, and the communities around them. We live here, and we know these neighborhoods.',
  },
  {
    question: 'How do I schedule a showing?',
    answer:
      'Send the form on this page, or call or text the office. The form reaches a broker the same minute, and they will call or text you to set a time that works.',
  },
  {
    question: 'How quickly will I hear back after contacting Ryan Realty?',
    answer:
      'The form on this page reaches a broker the same minute you send it, and a confirmation lands in your inbox. If it is urgent, call or text and you will reach us fastest.',
  },
] as const
