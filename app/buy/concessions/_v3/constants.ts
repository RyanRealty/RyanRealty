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

// Draft copy from Writing Bot (Oct 13), pending Matt's OK.
export const HERO_HEADLINE = 'Buyers have leverage in Bend.'

export const HERO_LEDE =
  "So, here's the thing. At least 1 in 2 Bend sales in the last 90 days came with a seller concession. Put toward your rate, that money can lower your payment more than the same dollars off the price."

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

export const RULES_REQUIRED_LINE =
  'Not lending advice. Concession limits depend on loan type and down payment. Talk to your lender.'

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
