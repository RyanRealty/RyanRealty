/**
 * Route-local constants for /about.
 *
 * Split out of page.tsx so the page stays under the file-size floor. Nothing
 * here fetches or formats. About is who we are: origin once, licenses once,
 * towns as one sentence. FAQ does not retell origin or licenses.
 */

/** Firm license as published on the pre-v3 about page (OREA 201253677). */
export const FIRM_LICENSE = 'OREA 201253677'

/**
 * Service-area towns, in the order they used to appear on the city ledger.
 * Presentation, not a geo registry. Tumalo is not here: it is unincorporated
 * and not a distinct MLS city — the FAQ says that instead of implying a row.
 */
export const ABOUT_CITY_LABELS = [
  'Bend',
  'Redmond',
  'Sisters',
  'Sunriver',
  'La Pine',
  'Terrebonne',
  'Prineville',
] as const

const LAST_TOWN = ABOUT_CITY_LABELS[ABOUT_CITY_LABELS.length - 1]
const LEAD_TOWNS = ABOUT_CITY_LABELS.slice(0, -1).join(', ')

/** One sentence of towns. Inventory lives on /housing-market and /homes-for-sale. */
export const ABOUT_TOWNS_SENTENCE = `We cover ${LEAD_TOWNS}, and ${LAST_TOWN}.`

export const ABOUT_FAQ_ITEMS = [
  {
    question: 'Will I work with the same broker from start to finish?',
    answer:
      'Yes. The broker you first talk to is the broker who works your purchase or sale through to close. There is no hand-off to a junior agent or a transaction desk.',
  },
  {
    question: 'What areas do you cover?',
    answer:
      'Bend, Redmond, Sisters, Sunriver, La Pine, Terrebonne, and Prineville, plus the surrounding resort communities including Tetherow, Pronghorn, Eagle Crest, and Brasada Ranch. Tumalo, unincorporated and not a separate MLS city, is served as part of the Bend market.',
  },
  {
    question: 'How do I get a home valuation?',
    answer:
      'Use Value my home. A broker prepares a comparative market analysis from recent comparable sales and gives you a price range, with the comps that support it.',
  },
] as const
