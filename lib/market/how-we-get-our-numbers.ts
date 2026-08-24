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
      'Houses currently for sale in that place.',
      'On a city, neighborhood, or community page this is leftover membership when we have it, otherwise the live MLS snapshot. On the homepage region HUD it is currently the live MLS snapshot. Neighborhood inventory is the address set we have mapped, not a polygon count.',
    ],
  },
  {
    id: 'closed-30-days',
    term: 'Closed · 30 days',
    body: [
      'How many of those houses closed in the last 30 complete days, counted from the last complete MLS day.',
      'Leftover membership when we can publish it. If that membership count is missing, we print the live MLS 30-day sold count under the same label. We never put a 12-month leftover closed count on this tile. Zip pages omit the tile when leftover is missing.',
    ],
  },
  {
    id: 'sold-12-mo',
    term: 'Sold · 12 mo',
    body: [
      'A 12-month closed count from the older monthly figures, shown only when a 30-day closed count is not available, and labeled as 12 months so it cannot be read as a 30-day figure.',
    ],
  },
  {
    id: 'new-30-days',
    term: 'New · 30 days',
    body: [
      'Houses that came on the market in the last 30 days, from the live MLS snapshot. This tile has not moved to leftover membership.',
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
      'Median days from list date to an accepted offer over the last 90 days, leftover membership.',
      'If that cell is missing, we print the live MLS days-to-pending figure under the same label. The leftover 12-month days-to-contract lives in the leftover strip, never on this tile.',
    ],
  },
  {
    id: 'median-on-market-12-mo',
    term: 'Median on market · 12 mo',
    body: [
      'A 12-month days-on-market figure from the older monthly figures, shown only when Median to pending is not available.',
    ],
  },
  {
    id: 'median-on-market-active',
    term: 'Median on market · active',
    body: [
      'Median days the current active houses have been on the market, shown only when neither Median to pending nor the 12-month on-market figure is available.',
    ],
  },
  {
    id: 'months-of-supply',
    term: 'Months of supply',
    body: [
      'Months of supply is how many months it would take to sell every house currently for sale at the pace houses have actually been closing.',
      MOS_METHODOLOGY_CLAUSE,
      MOS_THRESHOLD_CLAUSE,
      'On city pages this uses leftover membership when the inventory count next to it is the same population. Neighborhood months of supply is withheld when the two sides of the ratio do not describe the same homes. Core charts for months of supply still use the older monthly figures. The dedicated definition lives on the Months of supply page.',
    ],
  },
  {
    id: 'median-list',
    term: 'Median list price',
    body: [
      'Median asking price of the active houses in that HUD. City pages use leftover membership when we have it. The homepage uses the live MLS snapshot.',
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
      'Year-to-date median sale and homes sold from the older monthly figures, not leftover membership.',
    ],
  },
  {
    id: 'this-month',
    term: 'This month',
    body: [
      'The current calendar month, or the last complete month, from the older monthly figures.',
    ],
  },
  {
    id: 'weekly-price-cuts',
    term: 'Weekly price cuts',
    body: [
      'Share of actives with a price cut in the recent weekly window, from the older weekly figures. Not leftover membership.',
    ],
  },
  {
    id: 'days-on-market',
    term: 'Days on market',
    body: [
      'Core-chart days on market still uses the older monthly figures. Do not read it as leftover days to contract.',
    ],
  },
  {
    id: 'fill-on-miss',
    term: 'When a number is missing',
    body: [
      'A missing leftover cell is omitted, or filled from the live MLS snapshot only on the HUD tiles that say so (Closed · 30 days and Median to pending).',
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
      'On Closed · 30 days and Median to pending, the live MLS snapshot fills only when leftover is missing. New · 30 days, homepage active homes, YTD, this month, core-chart days on market, months of supply charts, and weekly price cuts still use the live snapshot or the older monthly figures.',
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
