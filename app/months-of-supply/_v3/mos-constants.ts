/**
 * Route-local constants for /months-of-supply.
 *
 * Split out of the route so the page stays under the ci:file-size-budget floor
 * (600 LOC) rather than growing into a god-file — the gate's own instruction is
 * split, not re-baseline.
 *
 * COPY ONLY. Nothing here reads data, and no threshold number and no formula
 * sentence is retyped: MOS_METHODOLOGY_CLAUSE and MOS_THRESHOLD_CLAUSE are
 * imported from lib/market/classify.ts at the call site and printed verbatim.
 * The one FAQ answer that opens with the canonical threshold sentence keeps only
 * its TAIL here (MOS_MARKET_TYPE_ANSWER_TAIL), so the sentence itself still has
 * exactly one definition in the repo.
 */

/** The geographies whose live rows this page publishes, in render order. */
export const MOS_CITY_LABELS = ['Bend'] as const

export type MosCityLabel = (typeof MOS_CITY_LABELS)[number]

/**
 * geo_label -> the city's market report. Every figure on this page is a door.
 *
 * KEYED TO MOS_CITY_LABELS ON PURPOSE, not `Record<string, string>`. The page
 * builds each Ledger row as `href: MOS_CITY_REPORT[label]` and V3Ledger renders
 * that straight into `<Link href={row.href}>`. Under an index signature, adding
 * a city to MOS_CITY_LABELS without a report path type-checks and ships
 * `href: undefined` into next/link at render time. Keyed this way, the same
 * omission is a compile error on this object literal, at the line that caused it.
 */
export const MOS_CITY_REPORT: Record<MosCityLabel, string> = {
  Bend: '/housing-market/bend',
}

export const MOS_REGION_REPORT = '/housing-market/central-oregon'

/**
 * The definition, in the page's own words. Carried verbatim from the pre-v3
 * page: two paragraphs, no rewording, so the term this URL exists to own reads
 * the same to a human and to a crawler that has already cited it.
 */
export const MOS_DEFINITION_PARAGRAPHS = [
  'Months of supply is how many months it would take to sell every home currently on the market at the pace homes have actually been closing. A low number means listings are getting absorbed fast. A high number means inventory is piling up faster than buyers are closing on it.',
  'It compares what is for sale right now with what has been closing. That is supply against demand, not asking prices or how a market feels.',
] as const

export const MOS_SAME_FORMULA_EVERYWHERE =
  'This is the same formula and the same thresholds behind every market-pace figure on ryan-realty.com. It never changes by page.'

export const MOS_FAQ_TITLE = 'Months of supply, explained further'

export const MOS_FAQ_NOTE = 'The same formula and thresholds used on every market page here.'

export const MOS_RELATED_INTRO =
  'Months of supply is one figure inside a fuller picture: active inventory, median list price, days to pending, and price trend by city.'

export type MosFaq = { question: string; answer: string }

/**
 * Question 2 of 4. Its answer opens with MOS_THRESHOLD_CLAUSE and continues with
 * the tail below; the page joins the two so the FAQPage JSON-LD carries the same
 * sentence the rest of the site prints.
 */
export const MOS_MARKET_TYPE_QUESTION =
  'What exactly is a seller’s market versus a buyer’s market?'

export const MOS_MARKET_TYPE_ANSWER_TAIL =
  ' At the low end, listings are getting absorbed faster than new inventory can replace them, and sellers hold more leverage on price and terms. At the high end, buyers have more homes to choose from and more room to negotiate.'

/** Questions 1, 3 and 4, verbatim. The page splices question 2 into position. */
export const MOS_FAQ_FIRST: MosFaq = {
  question: 'Why six months of closings, not three or twelve?',
  answer:
    'Six months smooths out normal week-to-week and month-to-month swings in closing pace without going stale. A shorter window reacts to noise. A window over a year reacts too slowly to an actual shift in the market.',
}

export const MOS_FAQ_REST: readonly MosFaq[] = [
  {
    question: 'Does a rising months of supply mean prices are falling?',
    answer:
      'Not automatically. Months of supply measures pace, not price. It is a leading indicator. A market that stays above six months for a sustained stretch tends to see price growth slow or reverse, but the two numbers can diverge for months before price catches up.',
  },
  {
    question: 'Where does the number on this page come from?',
    answer:
      'The figures above are single-family houses, the same read as the city and region market pages. If a figure cannot publish, this page omits it. We do not fill it from a different snapshot.',
  },
]

/** The closing doors, carried from the pre-v3 "See the full market report" block. */
export const MOS_RELATED_LINKS: ReadonlyArray<{ label: string; href: string }> = [
  { label: 'Central Oregon market report', href: MOS_REGION_REPORT },
  { label: 'Bend market report', href: MOS_CITY_REPORT.Bend },
  { label: 'All cities and towns', href: '/housing-market' },
  { label: 'How we get our numbers', href: '/how-we-get-our-numbers' },
]

export const MOS_METADATA_DESCRIPTION =
  'What months of supply means in real estate, the exact formula, and the current live figure for Central Oregon and Bend. ' +
  'Active listings divided by average monthly closings over the trailing six months.'

export const MOS_METADATA_KEYWORDS = [
  'months of supply',
  'months of supply real estate',
  'months of supply definition',
  'seller’s market vs buyer’s market',
  'Central Oregon housing market',
  'Bend real estate market',
  'Ryan Realty',
]
