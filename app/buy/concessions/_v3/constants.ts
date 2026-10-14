import { CONTACT } from '@/lib/brand/contact'

export const ROUTE_PATH = '/buy/concessions'

export const TITLE = 'Seller concessions for Bend buyers'

export const DESCRIPTION =
  'Compare a price cut to the same dollars as a seller concession that buys down the rate. At least 1 in 2 Bend sales in the last 90 days reported a seller concession.'

/**
 * The Stage still. A Bend aerial (Drake Park and the river), 3840x2160, the
 * repo's own photograph. /sell opens on Tetherow and /buy on Sisters, so a
 * buyer landing here from an ad sees Bend itself behind "Buyers have
 * leverage in Bend."
 */
export const POSTER = '/images/homepage/bend-drake-park-aerial.jpg'

/** Stage context line. One phrase, not a sentence. */
export const STAGE_EYEBROW = 'Bend · last 90 days'

// Draft copy from Writing Bot (Oct 13), pending Matt's OK. The lede that used
// to follow it is COMPARE_CLAIM below, under the instrument it describes.
export const HERO_HEADLINE = 'Buyers have leverage in Bend.'

/** The compare instrument's heading: the ad's own line. */
export const COMPARE_HEADING = 'Same $10,000, two ways'

export const COMPARE_EYEBROW = 'Payment'

export const AMOUNT_LABEL = 'Seller dollars'

export const AMOUNT_HINT = 'Starts at the median Bend credit, last 90 days. Drag it to your offer.'

export const INPUTS_LABEL = 'Your numbers'

export const CAPS_INTRO = 'Every loan has a cap on concessions. Your lender will know yours.'

export const ASK_LEDE =
  "Tell us where you are in your search. We'll help you ask for a concession that fits your loan."

export const LENDER_LINE = 'Not lending advice. Talk to your lender.'

/** One sentence under the compare heading: the claim the figures prove. */
export const COMPARE_CLAIM =
  'At least 1 in 2 Bend sales in the last 90 days came with a seller concession. Put toward your rate, that money can lower your payment more than the same dollars off the price.'

/**
 * The caps, one answer per loan family. The sources are named on each row;
 * the Fannie Mae guide was read 2026-10-13, the three handbooks are cited by
 * chapter and the lender confirms the live limit.
 */
export const CAP_ANSWERS = [
  {
    question: 'Conventional loans',
    body: 'Principal residence or second home: 3% of the price when the loan is over 90% of it, 6% from 75.01% to 90%, and 9% at 75% and under. Investment property: 2%. Measured on the lower of price or appraised value. Seller-funded buy-downs count toward the cap. The credit cannot exceed actual closing costs; anything over is treated as a sales concession and deducted from the price.',
    source: 'Fannie Mae Selling Guide B3-4.1-02, read 2026-10-13.',
  },
  {
    question: 'FHA, VA and USDA loans',
    body: "FHA: 6% of the sales price. VA: 4% of reasonable value for concessions; the buyer's normal closing costs the seller pays are not counted toward that 4%. USDA: 6%. Your lender confirms the limit on your loan.",
    source: 'HUD Handbook 4000.1; VA Lenders Handbook M26-7, chapter 8; USDA HB-1-3555, chapter 6.',
  },
  {
    question: 'What RESPA requires',
    body: 'No kickbacks or referral fees. Seller credits are disclosed on the Closing Disclosure. We give information only, not loans.',
    source: 'RESPA, 12 USC 2607.',
  },
] as const

export const POINTS_ASSUMPTION = 'assumption, varies by lender'

export const TRAP = { name: 'company', label: 'Company' } as const

export const TIMELINE_OPTIONS = [
  { value: 'now', label: 'Ready now' },
  { value: '1-3-months', label: 'Next 1 to 3 months' },
  { value: '3-6-months', label: '3 to 6 months' },
  { value: '6-plus', label: '6 months or more' },
  { value: 'looking', label: 'Just looking' },
] as const

export const LOAN_TYPE_OPTIONS = [
  { value: 'conventional', label: 'Conventional' },
  { value: 'fha', label: 'FHA' },
  { value: 'va', label: 'VA' },
  { value: 'usda', label: 'USDA' },
] as const

export const OCCUPANCY_OPTIONS = [
  { value: 'principal', label: 'Primary home' },
  { value: 'second', label: 'Second home' },
  { value: 'investment', label: 'Investment' },
] as const

export const PHONE_LABEL = CONTACT.phoneDirect
export const PHONE_HREF = `tel:${CONTACT.phoneDirectTel}`

export const ASK_CTA = 'Get a concession plan for your offer'
