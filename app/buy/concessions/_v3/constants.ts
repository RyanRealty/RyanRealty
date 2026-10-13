import { CONTACT } from '@/lib/brand/contact'

export const ROUTE_PATH = '/buy/concessions'

export const TITLE = 'Seller concessions for Bend buyers'

export const DESCRIPTION =
  'Compare a price cut to the same dollars as a seller concession that buys down the rate. At least 1 in 2 Bend sales in the last 90 days reported a seller concession.'

// Draft copy from Writing Bot (Oct 13), pending Matt's OK.
export const HERO_HEADLINE = 'Buyers have leverage in Bend.'

export const HERO_LEDE =
  'At least 1 in 2 Bend sales in the last 90 days came with a seller concession. Used to buy down your rate, that credit can lower your monthly payment more than the same dollars off the price.'

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
