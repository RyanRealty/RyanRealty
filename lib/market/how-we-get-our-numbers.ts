/**
 * Public dictionary for market figures. Visitor English only.
 * MOS formula and thresholds are imported, never retyped.
 * Table names, SQL, and internal stamps stay out of this copy.
 */
import { MOS_METHODOLOGY_CLAUSE, MOS_THRESHOLD_CLAUSE } from '@/lib/market/classify'
import { assertPublicMethodology } from '@/lib/market/publish-public-methodology'

export const HOW_WE_GET_OUR_NUMBERS_PATH = '/how-we-get-our-numbers'

export function howNumberHref(anchor: string): string {
  return `${HOW_WE_GET_OUR_NUMBERS_PATH}#${anchor}`
}

export type HowNumberEntry = {
  id: string
  term: string
  body: readonly string[]
}

export type HowNumberFaq = {
  question: string
  answer: string
}

/** HUD KPI label -> dictionary id. Every label KbMarketHud can print must live here. */
export const HUD_KPI_HOW = {
  'Active homes': 'active-homes',
  'Closed · 30 days': 'closed-30-days',
  'Sold · 12 mo': 'sold-12-mo',
  'New · 30 days': 'new-30-days',
  'Sale to list': 'sale-to-list',
  'Median to pending': 'median-to-pending',
  'Median on market · 12 mo': 'median-on-market-12-mo',
  'Median on market · active': 'median-on-market-active',
  'Months of supply': 'months-of-supply',
} as const

export type HudKpiLabel = keyof typeof HUD_KPI_HOW

export const PANEL_HOW = {
  pace: 'leftover-pace',
  mix: 'leftover-mix',
  products: 'other-product-types',
  chart: 'leftover-chart',
  medianList: 'median-list',
} as const

export const HOW_NUMBER_ENTRIES: readonly HowNumberEntry[] = [
  {
    id: 'houses-we-count',
    term: 'Houses we count',
    body: [
      'We count single-family houses only. That is the MLS house type, not condos, townhomes, land, or farms.',
      'Each house is counted once in each kind of place (city, neighborhood, zip, region) based on the place we have mapped as its home for that type. That is not the city name typed on the listing, and it is not a city-limits polygon. When neighborhoods nest, the smallest containing neighborhood is the one that counts.',
    ],
  },
  {
    id: 'leftover',
    term: 'Leftover',
    body: [
      'Leftover is our name for those membership counts. Closed · 30 days, Median to pending, the leftover strip, mix, leftover monthly charts, and leftover extra product types all use this pile.',
      'It is a different pile from the live MLS snapshot and from the older monthly figures. A city can show more houses on leftover than an older snapshot that only counted listings whose city field matched and whose pin sat inside a polygon. That is a definition, not a math error.',
    ],
  },
  {
    id: 'active-homes',
    term: 'Active homes',
    body: [
      'Houses currently for sale in that place, leftover membership. Same pile as Closed · 30 days, Median to pending, Sale to list, and Months of supply on that HUD.',
      'If leftover cannot publish the count, the tile is omitted. We do not fill it from the live MLS snapshot. Neighborhood inventory is the address set we have mapped, not a polygon count.',
    ],
  },
  {
    id: 'closed-30-days',
    term: 'Closed · 30 days',
    body: [
      'How many of those leftover houses closed in the last 30 complete days, counted from the last complete MLS day.',
      'If leftover cannot publish the count, the tile is omitted. We do not fill it from the live MLS snapshot. We never put a 12-month leftover closed count on this tile.',
    ],
  },
  {
    id: 'sold-12-mo',
    term: 'Sold · 12 mo',
    body: [
      'Leftover 12-month closed count, shown only when Closed · 30 days is missing, and labeled as 12 months so it cannot be read as a 30-day figure.',
    ],
  },
  {
    id: 'new-30-days',
    term: 'New · 30 days',
    body: [
      'This HUD tile is omitted until leftover membership has a true 30-day new-listings figure. We do not print the live MLS snapshot here, and we never put leftover 12-month new listings under a 30-day label. 12-month leftover new listings live in the leftover strip.',
    ],
  },
  {
    id: 'sale-to-list',
    term: 'Sale to list',
    body: [
      'Median close price as a share of original list price, leftover membership, last 12 months.',
      'A missing leftover cell omits the tile. We do not fill this from the older monthly figures.',
    ],
  },
  {
    id: 'median-to-pending',
    term: 'Median to pending',
    body: [
      'Median days from list date to an accepted offer over the last 90 days, leftover membership. Same pile as Active homes and Closed · 30 days on that HUD.',
      'If leftover cannot publish the figure, the tile is omitted. We do not fill it from the live MLS snapshot. The leftover 12-month days-to-contract lives in the leftover strip, never on this tile.',
    ],
  },
  {
    id: 'median-on-market-12-mo',
    term: 'Median on market · 12 mo',
    body: [
      'This label is not on the leftover HUD KPI row. Median to pending is leftover 90-day list-to-pending. Older days-on-market figures stay on core-chart tabs, not under this HUD label.',
    ],
  },
  {
    id: 'median-on-market-active',
    term: 'Median on market · active',
    body: [
      'This label is not on the leftover HUD KPI row. If leftover Median to pending is missing, the pending tile is omitted rather than filling from active days on market.',
    ],
  },
  {
    id: 'months-of-supply',
    term: 'Months of supply',
    body: [
      'Months of supply is how many months it would take to sell every house currently for sale at the pace houses have actually been closing.',
      MOS_METHODOLOGY_CLAUSE,
      MOS_THRESHOLD_CLAUSE,
      'On the HUD this uses leftover membership, and only when the inventory count next to it is the same leftover population. If leftover months of supply cannot publish, the tile is omitted. We do not fill it from the live MLS snapshot. Neighborhood months of supply is withheld when leftover cannot publish it. Core-chart months of supply tabs are omitted so they cannot mix older monthly figures into the leftover HUD. The dedicated definition lives on the Months of supply page.',
    ],
  },
  {
    id: 'median-list',
    term: 'Median list price',
    body: [
      'Median asking price of the leftover active houses in that HUD. Same pile as Active homes. If leftover cannot publish it, the figure is omitted.',
    ],
  },
  {
    id: 'leftover-pace',
    term: 'Detached leftover strip',
    body: [
      'The leftover strip under the HUD. Pending now, median age of actives, and 12-month leftover stats such as closed count, median close, days to contract, new listings, price cuts, sale to original list, cash share, and year-over-year change.',
      'Missing leftover cells are omitted, not filled from the older monthly figures. This strip is where 12-month days to contract lives.',
    ],
  },
  {
    id: 'leftover-mix',
    term: 'Detached mix',
    body: [
      'Share of leftover closed sales in the last 12 months by feature, financing, and bedroom count.',
      'Garage is a true share. Other feature flags publish as a floor (the label reads at least), because a blank MLS field is not a no. A zero floor is not a figure.',
    ],
  },
  {
    id: 'leftover-chart',
    term: 'Median close chart',
    body: [
      'Monthly median close for leftover houses, calendar months. We plot a leftover series when at least six months publish. Otherwise the older monthly figures remain.',
    ],
  },
  {
    id: 'other-product-types',
    term: 'Other product types',
    body: [
      'Condo, townhome, manufactured, land, farm, commercial sale, and similar extra types, leftover membership. Not mixed into the house HUD. Commercial lease is not on this site. Neighborhood extra months of supply stays off while none of those cells are publishable.',
    ],
  },
  {
    id: 'ytd',
    term: 'YTD',
    body: [
      'YTD is not on the leftover HUD or the leftover housing-market instrument. Those surfaces use leftover membership only. Older year-to-date cache figures are omitted there so they cannot be read as the same pile.',
    ],
  },
  {
    id: 'this-month',
    term: 'This month',
    body: [
      'This-month cache figures are not on the leftover HUD or housing-market instrument. Calendar-month leftover median close, when we plot it, is leftover membership, labeled as a completed month.',
    ],
  },
  {
    id: 'weekly-price-cuts',
    term: 'Weekly price cuts',
    body: [
      'Weekly price-cut charts are omitted from the leftover HUD. Leftover has a 12-month closed-with-a-price-cut share in the leftover strip, not a weekly active share.',
    ],
  },
  {
    id: 'days-on-market',
    term: 'Days on market',
    body: [
      'Days-on-market core-chart tabs are omitted from the leftover HUD. Median to pending on that HUD is leftover 90-day list-to-pending. Do not read a cache days-on-market series as leftover days to contract.',
    ],
  },
  {
    id: 'fill-on-miss',
    term: 'When a number is missing',
    body: [
      'On the HUD KPI row and leftover HUD charts, a missing leftover cell is omitted. We do not fill it from the live MLS snapshot or the older monthly figures.',
      'We do not invent a zero, and we do not put a longer window under a shorter label.',
    ],
  },
]

export const HOW_NUMBER_FAQS: readonly HowNumberFaq[] = [
  {
    question: 'Why can a city show more houses than city limits?',
    answer:
      'Leftover counts single-family houses mapped to that place as home, not listings whose city field matched and whose pin sat inside a polygon. Those are two piles.',
  },
  {
    question: 'Why is Closed · 30 days different from the leftover 12-month strip?',
    answer:
      'Closed · 30 days is the last 30 complete days. The leftover strip’s closed sales figure is 12 months. We never put the 12-month leftover count on the 30-day tile.',
  },
  {
    question: 'What does leftover mean on this site?',
    answer:
      'Leftover is our name for membership counts of single-family houses. Each house is counted once per place type. It is not the live MLS snapshot and not the older monthly figures.',
  },
  {
    question: 'When do you print a live MLS snapshot instead?',
    answer:
      'The leftover HUD does not. A missing leftover cell is omitted. We do not print older YTD, this-month, inventory, days-on-market, months-of-supply, or weekly price-cut series on that leftover HUD.',
  },
]

export const HOW_NUMBER_RELATED = [
  { label: 'Central Oregon market report', href: '/housing-market/central-oregon' },
  { label: 'Bend market report', href: '/housing-market/bend' },
  { label: 'Housing market', href: '/housing-market' },
  { label: 'Months of supply, defined', href: '/months-of-supply' },
] as const

export const HOW_NUMBER_METADATA_DESCRIPTION =
  'What Closed · 30 days, months of supply, leftover, and the other market figures on this site actually count, and how we collect them.'

export const HOW_NUMBER_METADATA_KEYWORDS = [
  'how we get our numbers',
  'Central Oregon housing market',
  'months of supply',
  'Bend real estate market',
  'Ryan Realty',
] as const

const EXTRA_LEAK =
  /market_pulse_live|market_metric|market_stats_cache|place_membership|getMetric|is_primary|PropertyType|closed_cte|ILIKE/i

export function assertHowNumberCopy(): void {
  for (const entry of HOW_NUMBER_ENTRIES) {
    for (const line of entry.body) {
      assertPublicMethodology(line)
      if (EXTRA_LEAK.test(line)) {
        throw new Error(`How-we-get-our-numbers leaked an internal stamp: ${line}`)
      }
    }
  }
  for (const faq of HOW_NUMBER_FAQS) {
    assertPublicMethodology(faq.question)
    assertPublicMethodology(faq.answer)
    if (EXTRA_LEAK.test(faq.question) || EXTRA_LEAK.test(faq.answer)) {
      throw new Error(`How-we-get-our-numbers FAQ leaked an internal stamp: ${faq.question}`)
    }
  }
}
