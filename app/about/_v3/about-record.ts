/**
 * /about: the sourced facts block (about upgrade, SEO & AEO Desk brief of
 * 2026-10-08). The direct answer under the H1, the freshness line, "Who we
 * help" (Matt 2026-10-08), "Track record, sourced", the
 * record-bound FAQ answers, and the meta description, all worded here from:
 *
 *   - the firm's all-area closing record (app/team/_v3/firm-record.ts: every
 *     closed sale where a Ryan Realty broker was the listing or buyer's broker,
 *     once per ListingKey, any area), the same record /team prints;
 *   - the closings rail's own count ("25 in Central Oregon": only where the
 *     rail is shown);
 *   - the live Google reviews (public.reviews, the /reviews page);
 *   - lib/brand/contact.ts (founding year, Bend office, licenses, address).
 *
 * ONE HEADLINE COUNT. The headline is the all-area record. "25" may appear
 * only as the rail's Central Oregon count. A live value that did not load
 * drops its sentence, never guesses it (CLAUDE.md section 0).
 *
 * DATED FACTS THAT ARE NOT LIVE. Three facts were checked by hand on
 * 2026-10-08 and are printed with that date, never with today's:
 *   - the Oregon Real Estate Agency License Lookup (7:36 AM PT): firm
 *     201253677 is a "Registered Business Name" license, and the four broker
 *     licenses were active;
 *   - the review themes: 5 of the 25 Google reviews are from clients who were
 *     out of state or out of the country (Jul 2026, Aug 2025, May 2025,
 *     Dec 2024, Dec 2023), counted from the full review text;
 *   - the Bend and Redmond neighborhood names on the record, read from the
 *     rail's subdivision labels (codes such as "CLAB" are not neighborhoods
 *     and are left out).
 * Re-check them when the record or the review count moves.
 *
 * VOICE. No competitor or portal is named (Matt 2026-09-23, NAR Article 15),
 * no "best", "#1", "top", or "leading" self-claim, no client names, initials,
 * or addresses, no em dashes, no new "licensed since" or year count.
 */

import { BRAND, BROKERS } from '@/lib/brand/contact'
import { formatCalendarDay, formatMonthYear } from '@/lib/format/date'
import { formatPriceExact } from '@/lib/format/money'
import { LISTING_FEE_PERCENT } from '@/app/sell/_v3/sell-constants'
import type { FirmAllAreaRecord, FirmRecordSale, FirmTally } from '@/app/team/_v3/firm-record'
import { ABOUT_LICENSES_CHECKED, FIRM_LICENSE, countWord } from './about-constants'

/** The day this page's copy last changed. Bump it when the copy changes. */
export const ABOUT_COPY_UPDATED = '2026-10-08'

/** Review themes, counted by hand from the full Google review text. */
export const ABOUT_REVIEW_THEMES = {
  countedOn: '2026-10-08',
  reviewTotal: 25,
  /** Clients who were out of state or out of the country during their sale or purchase. */
  awayDuringSale: 5,
} as const

/** Neighborhood names on the record (rail subdivision labels), read 2026-10-08. */
export const ABOUT_RECORD_NEIGHBORHOODS = {
  bend: [
    'NorthWest Crossing (2)',
    'Broken Top',
    'Vandevert Ranch',
    'Northpointe',
    'Forest Hills',
    'Valhalla Heights',
    'Sun Meadow',
    'Stonehaven',
    'Cedar Creek',
    'Tillicum Village',
    'Deschutes River Recreation Homesites',
    'Forest Meadows',
  ],
  redmond: ['Forked Horn Butte', 'Townsite of Redmond', 'Whitehorse'],
} as const

/** Cities a client asks about that the record may not reach yet. */
const ASKED_CITIES = ['Sisters', 'Sunriver'] as const

const FIRM_LICENSE_NUMBER = FIRM_LICENSE.replace(/^OREA\s+/, '')

export type AboutLiveFigures = {
  /** The all-area firm record, or null when it did not load. */
  record: FirmAllAreaRecord | null
  /** How many closings the Central Oregon rail lists, or null. */
  centralOregonListed: number | null
  reviews: { average: number; count: number; newest: string | null } | null
  /** Licensed brokers on the live roster. */
  brokerCount: number
  /** The calendar day (Pacific) the live figures were read, YYYY-MM-DD. */
  asOf: string
}

/** Text with inline doors: a string is text, an object is a link. */
export type AboutRichText = ReadonlyArray<string | { label: string; href: string }>

export function aboutRichTextPlain(parts: AboutRichText): string {
  return parts.map((p) => (typeof p === 'string' ? p : p.label)).join('')
}

/* -------------------------------------------------------------------------- */
/* Words                                                                       */
/* -------------------------------------------------------------------------- */

function longDay(ymd: string): string {
  return formatCalendarDay(ymd, { month: 'long', day: 'numeric', year: 'numeric' })
}

function shortDay(ymd: string): string {
  return formatCalendarDay(ymd, { month: 'short', day: 'numeric', year: 'numeric' })
}

function upperFirst(s: string): string {
  return s ? `${s[0]!.toUpperCase()}${s.slice(1)}` : s
}

/** "Five", "Four"; past nine, the numeral. */
function countWordUpper(n: number): string {
  return upperFirst(countWord(n))
}

function listWords(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? ''
  if (items.length === 2) return `${items[0]} and ${items[1]}`
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`
}

function hasRecord(record: FirmAllAreaRecord | null | undefined): record is FirmAllAreaRecord {
  return !!record && record.count > 0 && !!record.firstClose && !!record.lastClose
}

/** "April 2015 to September 2026". */
export function aboutRecordSpanLong(record: FirmAllAreaRecord): string {
  const first = formatMonthYear(record.firstClose)
  const last = formatMonthYear(record.lastClose)
  return first === last ? first : `${first} to ${last}`
}

function firstYear(record: FirmAllAreaRecord): string {
  return (record.firstClose ?? '').slice(0, 4)
}

/** "Matt Ryan 22, Rebecca Peterson 4" (brokers with at least one). */
function brokerCounts(record: FirmAllAreaRecord, field: 'count' | 'recent', joiner: 'comma' | 'and'): string {
  const parts = record.brokers.filter((b) => b[field] > 0).map((b) => `${b.name} ${b[field]}`)
  if (joiner === 'and') return listWords(parts)
  return parts.join(', ')
}

/** "22 by Matt Ryan and 4 by Rebecca Peterson". */
function brokerCountsBy(record: FirmAllAreaRecord): string {
  return listWords(record.brokers.filter((b) => b.count > 0).map((b) => `${b.count} by ${b.name}`))
}

/** "7 in Bend and 1 in Redmond". */
function cityCounts(cities: readonly FirmTally[]): string {
  return listWords(cities.map((c) => `${c.n} in ${c.name}`))
}

const TYPE_WORDS: Record<string, [string, string]> = {
  house: ['house', 'houses'],
  manufactured: ['manufactured home', 'manufactured homes'],
  townhouse: ['townhouse', 'townhouses'],
  condo: ['condo', 'condos'],
  land: ['land parcel', 'land parcels'],
  multi: ['multi-family property', 'multi-family properties'],
  commercial: ['commercial property', 'commercial properties'],
}

function typeWords(types: readonly FirmTally[]): string {
  return listWords(
    types.map((t) => {
      const [one, many] = TYPE_WORDS[t.name] ?? [t.name, t.name]
      return `${t.n} ${t.n === 1 ? one : many}`
    }),
  )
}

const NEIGHBORHOOD_NAMES: ReadonlySet<string> = new Set(
  [...ABOUT_RECORD_NEIGHBORHOODS.bend, ...ABOUT_RECORD_NEIGHBORHOODS.redmond].map((n) =>
    n.replace(/\s*\(\d+\)$/, '').toLowerCase(),
  ),
)

/** A sale's place in words: its neighborhood when we name it, else its city. */
function salePlace(sale: FirmRecordSale): string {
  const sub = sale.subdivision?.trim()
  if (sub && NEIGHBORHOOD_NAMES.has(sub.toLowerCase())) {
    return [...ABOUT_RECORD_NEIGHBORHOODS.bend, ...ABOUT_RECORD_NEIGHBORHOODS.redmond]
      .map((n) => n.replace(/\s*\(\d+\)$/, ''))
      .find((n) => n.toLowerCase() === sub.toLowerCase()) ?? sub
  }
  return sale.city || 'Central Oregon'
}

function missingAskedCities(record: FirmAllAreaRecord): string[] {
  return ASKED_CITIES.filter((city) => !record.cities.some((c) => c.name.toLowerCase() === city.toLowerCase()))
}


/* -------------------------------------------------------------------------- */
/* The direct answer, under the H1                                             */
/* -------------------------------------------------------------------------- */

export function aboutDirectAnswer(live: AboutLiveFigures): string {
  const { record, reviews } = live
  const asOf = longDay(live.asOf)
  const sentences = [
    `${BRAND.name} is a boutique real estate brokerage in downtown ${BRAND.address.city}, ${BRAND.address.regionFull}.`,
    `Owner and principal broker ${BROKERS.matt.nameShort} (Oregon license ${BROKERS.matt.license}) founded it in ${BRAND.llcSince} and opened the ${BRAND.address.city} office at ${BRAND.address.street} in ${BRAND.foundedLabel}.`,
  ]
  const closings = hasRecord(record)
    ? `Its brokers have ${record.count} recorded MLS closings from ${aboutRecordSpanLong(record)}`
    : null
  const rating =
    reviews && reviews.count > 0
      ? `its Google Business Profile shows a ${reviews.average.toFixed(1)} rating from ${reviews.count} reviews as of ${asOf}`
      : null
  if (closings && rating) sentences.push(`${closings}, and ${rating}.`)
  else if (closings) sentences.push(`${closings}.`)
  else if (rating) sentences.push(`${upperFirst(rating)}.`)
  sentences.push(
    `The listing fee is ${LISTING_FEE_PERCENT} of the sale price with no add-on fees, and one broker stays with each client from the first call to closing.`,
  )
  return sentences.join(' ')
}

/** The source line under the direct answer. */
export function aboutDirectAnswerSource(): AboutRichText {
  return [
    "Closings: regional MLS through Oregon Data Share, every sale where a Ryan Realty broker was the listing or buyer's broker, counted once (",
    { label: 'track record', href: '/about#track-record' },
    `). License: Oregon Real Estate Agency License Lookup, ${shortDay(ABOUT_LICENSES_CHECKED)}. Reviews: our Google Business Profile, read live (`,
    { label: 'every review', href: '/reviews' },
    ').',
  ]
}

/** "Updated Oct 8, 2026 · Figures as of Oct 8, 2026". */
export function aboutFreshnessLine(live: Pick<AboutLiveFigures, 'asOf'>): string {
  return `Updated ${shortDay(ABOUT_COPY_UPDATED)} · Figures as of ${shortDay(live.asOf)}`
}

/** The meta description: founding year, the closings, the reviews, the fee. */
export function aboutMetaDescription(live: Pick<AboutLiveFigures, 'record' | 'reviews'>): string {
  const lead = `${BRAND.address.city}, ${BRAND.address.regionFull} brokerage founded in ${BRAND.llcSince}.`
  const parts: string[] = []
  if (hasRecord(live.record)) parts.push(`${live.record.count} recorded MLS closings since ${firstYear(live.record)}`)
  if (live.reviews && live.reviews.count > 0) {
    parts.push(`${live.reviews.average.toFixed(1)} from ${live.reviews.count} Google reviews`)
  }
  parts.push(`a ${LISTING_FEE_PERCENT} listing fee with no add-ons`)
  return `${lead} ${upperFirst(listWords(parts))}.`
}

/* -------------------------------------------------------------------------- */
/* Who we help                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Matt 2026-10-08: "we're the right fit for every single person." Public copy
 * names who Ryan Realty serves and never anyone it would turn away. Every line
 * states who we serve, with its figure from the live record.
 */
export const ABOUT_HELP_HEADING = 'Who we help'
export const ABOUT_HELP_INTRO = 'Anyone buying or selling a home in Central Oregon.'

function reviewThemeClause(): string {
  return `${countWordUpper(ABOUT_REVIEW_THEMES.awayDuringSale)} of our ${ABOUT_REVIEW_THEMES.reviewTotal} Google reviews, as of ${longDay(ABOUT_REVIEW_THEMES.countedOn)}`
}

export function aboutWhoWeHelp(live: AboutLiveFigures): string[] {
  const { record } = live
  const lines = [
    'Sellers and buyers anywhere in Central Oregon. The broker you start with prices your home, negotiates every offer, and sits with you at closing.',
    `Clients selling or buying from out of state or out of the country. ${reviewThemeClause()}, come from clients who were away during their sale or purchase.`,
    `Every seller sees the fee before the first call: ${LISTING_FEE_PERCENT} of the sale price, with no add-on fees.`,
  ]
  if (hasRecord(record)) {
    if (record.lowest && record.highest && record.lowest.key !== record.highest.key) {
      lines.push(
        `Homes at every price point. Our recorded closings run from ${formatPriceExact(record.lowest.price)} in ${salePlace(record.lowest)} to ${formatPriceExact(record.highest.price)} in ${salePlace(record.highest)}.`,
      )
    }
    const manufactured = record.types.find((t) => t.name === 'manufactured')?.n ?? 0
    if (manufactured > 0) {
      lines.push(
        `Manufactured homes and rural property. ${countWordUpper(manufactured)} of our recorded closings ${manufactured === 1 ? 'is a manufactured home' : 'are manufactured homes'}.`,
      )
    }
  }
  return lines
}

/* -------------------------------------------------------------------------- */
/* Track record, sourced                                                       */
/* -------------------------------------------------------------------------- */

export const ABOUT_TRACK_RECORD_HEADING = 'Track record, sourced'

export type AboutRecordItem = { term: string; body: AboutRichText }

export function aboutTrackRecordLede(live: Pick<AboutLiveFigures, 'asOf'>): string {
  return `As of ${longDay(live.asOf)}. Source: the regional MLS through Oregon Data Share. We count every closed sale where a Ryan Realty broker was the listing broker or the buyer's broker, once per sale.`
}

export function aboutTrackRecord(live: AboutLiveFigures): AboutRecordItem[] {
  const { record, reviews } = live
  const items: AboutRecordItem[] = []
  if (hasRecord(record)) {
    const listed =
      live.centralOregonListed && live.centralOregonListed > 0
        ? ` ${live.centralOregonListed} are in Central Oregon and listed above.`
        : ''
    const byBroker = brokerCounts(record, 'count', 'comma')
    items.push({
      term: 'Recorded closings',
      body: [`${record.count}, from ${aboutRecordSpanLong(record)}.${byBroker ? ` ${byBroker}.` : ''}${listed}`],
    })
    if (record.recent.count > 0) {
      const recentBy = brokerCounts(record, 'recent', 'and')
      items.push({
        term: 'Last 12 months',
        body: [`${record.recent.count} ${record.recent.count === 1 ? 'closing' : 'closings'}${recentBy ? `, ${recentBy}` : ''}.`],
      })
    }
    const where = record.cities.map((c) => `${c.name} ${c.n}`)
    if (record.outside > 0) where.push(`${record.outside} outside Central Oregon`)
    if (where.length > 0) items.push({ term: 'Where', body: [`${listWords(where)}.`] })
    items.push({
      term: 'Bend neighborhoods with a recorded closing',
      body: [
        `${listWords(ABOUT_RECORD_NEIGHBORHOODS.bend)}. In Redmond: ${listWords(ABOUT_RECORD_NEIGHBORHOODS.redmond)}.`,
      ],
    })
    if (record.lowest && record.highest) {
      const highMonth = formatMonthYear(record.highest.day)
      items.push({
        term: 'Prices',
        body: [
          `${formatPriceExact(record.lowest.price)} to ${formatPriceExact(record.highest.price)}. The highest was ${formatPriceExact(record.highest.price)} in ${salePlace(record.highest)}${highMonth ? ` in ${highMonth}` : ''}.`,
        ],
      })
    }
    if (record.types.length > 0) items.push({ term: 'Property types', body: [`${typeWords(record.types)}.`] })
  }
  if (reviews && reviews.count > 0) {
    const newest = reviews.newest ? formatMonthYear(reviews.newest.slice(0, 10)) : ''
    items.push({
      term: 'Reviews',
      body: [
        `${reviews.average.toFixed(1)} from ${reviews.count} Google reviews${newest ? `, the newest from ${newest}` : ''}. Every Google review is on our `,
        { label: 'reviews page', href: '/reviews' },
        ' in full.',
      ],
    })
  }
  items.push({
    term: 'Licenses',
    body: [
      `${BRAND.legalName}, Oregon Real Estate Agency license ${FIRM_LICENSE_NUMBER} (registered business name). Principal broker ${BROKERS.matt.nameShort}, license ${BROKERS.matt.license}. Both showed active on the Agency's License Lookup on ${longDay(ABOUT_LICENSES_CHECKED)}.`,
    ],
  })
  return items
}

export const ABOUT_TRACK_RECORD_LINKS = [
  { label: 'How we get our numbers', href: '/how-we-get-our-numbers' },
  { label: 'The brokers', href: '/team' },
] as const

/* -------------------------------------------------------------------------- */
/* The record-bound FAQ answers                                                */
/* -------------------------------------------------------------------------- */

type FaqItem = { question: string; answer: string }

export const ABOUT_FAQ_GOOD = 'Is Ryan Realty a good brokerage in Bend?'
export const ABOUT_FAQ_CHOOSE = 'Who is the best realtor in Bend for selling a home?'
export const ABOUT_FAQ_HOW_MANY = 'How many homes has Ryan Realty sold?'
export const ABOUT_FAQ_AWAY = "Is Ryan Realty a good choice if I'm selling from out of state?"
export const ABOUT_FAQ_TOWNS = 'Does Ryan Realty work in Redmond, Sisters, and Sunriver?'

function faqGood(live: AboutLiveFigures): FaqItem {
  const { record, reviews } = live
  const asOf = longDay(live.asOf)
  const brokers = live.brokerCount > 0 ? `${countWord(live.brokerCount)}-broker brokerage` : 'brokerage'
  const parts = [
    'Judge us on the public record.',
    `Ryan Realty is a ${brokers} in downtown ${BRAND.address.city}, owned by principal broker ${BROKERS.matt.nameShort}, whose Oregon license (${BROKERS.matt.license}) shows as active on the Oregon Real Estate Agency's License Lookup.`,
  ]
  const closings = hasRecord(record)
    ? `Our brokers have ${record.count} recorded MLS closings from ${aboutRecordSpanLong(record)}`
    : null
  const rating =
    reviews && reviews.count > 0
      ? `our Google Business Profile shows a ${reviews.average.toFixed(1)} rating from ${reviews.count} reviews as of ${asOf}, every one posted in full on our reviews page`
      : null
  if (closings && rating) parts.push(`${closings}, and ${rating}.`)
  else if (closings) parts.push(`${closings}.`)
  else if (rating) parts.push(`${upperFirst(rating)}.`)
  parts.push(
    `The listing fee is published, ${LISTING_FEE_PERCENT} of the sale price with no add-on fees, and the broker you start with stays with you through closing.`,
  )
  return { question: ABOUT_FAQ_GOOD, answer: parts.join(' ') }
}

function faqChoose(live: AboutLiveFigures): FaqItem {
  const { record } = live
  const ours: string[] = []
  if (hasRecord(record) && record.recent.count > 0) {
    const where = record.recent.cities.length > 0 ? `, ${cityCounts(record.recent.cities)}` : ''
    ours.push(
      `our brokers closed ${record.recent.count} ${record.recent.count === 1 ? 'home' : 'homes'} in the last 12 months as of ${longDay(live.asOf)}${where}`,
    )
  }
  ours.push(
    `the fee is ${LISTING_FEE_PERCENT} with no add-on fees`,
    'the broker you hire handles your sale from first call to closing',
    'you get a written valuation from recent closed sales within 24 hours',
    'and every listing gets professional photography, video, and a 3D tour',
  )
  return {
    question: ABOUT_FAQ_CHOOSE,
    answer: `An agent calling themselves the best is not evidence, so compare agents on the record. Interview two or three agents and ask each one the same five things: how many homes they closed in the last 12 months, their listing fee in writing, who handles your file day to day, how they would price your home from recent closed sales, and what the marketing includes. Our answers: ${ours.join('; ')}.`,
  }
}

function faqHowMany(live: AboutLiveFigures): FaqItem | null {
  const { record } = live
  if (!hasRecord(record)) return null
  const by = brokerCountsBy(record)
  const parts = [
    `Our brokers have ${record.count} recorded closings on the regional MLS (Oregon Data Share) from ${aboutRecordSpanLong(record)}, counting each sale once whether we represented the seller or the buyer${by ? `: ${by}` : ''}.`,
  ]
  if (live.centralOregonListed && live.centralOregonListed > 0) {
    parts.push(
      `${live.centralOregonListed} of them are in Central Oregon, and each of those is listed on this page with its address, closing price, and date.`,
    )
  }
  if (record.lowest && record.highest && record.lowest.key !== record.highest.key) {
    parts.push(`Prices range from ${formatPriceExact(record.lowest.price)} to ${formatPriceExact(record.highest.price)}.`)
  }
  return { question: ABOUT_FAQ_HOW_MANY, answer: parts.join(' ') }
}

function faqAway(): FaqItem {
  return {
    question: ABOUT_FAQ_AWAY,
    answer: `Yes, and it's a large part of our work. ${reviewThemeClause()}, come from clients who were out of state or out of the country while they sold or bought here. They describe a broker who answered quickly and who lined up repairs and contractors locally while they were away. Our guide to selling your Bend home from out of state covers the process, and our Oregon withholding guide explains the tax prepayment that applies to nonresident sellers.`,
  }
}

function faqTowns(live: AboutLiveFigures): FaqItem | null {
  const { record } = live
  if (!hasRecord(record)) return null
  const towns = record.cities.map((c) => c.name).filter((name) => name.toLowerCase() !== BRAND.address.city.toLowerCase())
  const reach = towns.length > 0 ? `our recorded closings include ${listWords(towns)} as well as Bend neighborhoods from NorthWest Crossing to Vandevert Ranch` : 'our recorded closings include Bend neighborhoods from NorthWest Crossing to Vandevert Ranch'
  const missing = missingAskedCities(record)
  const gap =
    missing.length === 0
      ? ''
      : ` We don't have a recorded closing in ${listWords(missing).replace(/ and /, ' or ')} yet, so we'll show you the recent sales there and the comps we'd use before you decide.`
  return { question: ABOUT_FAQ_TOWNS, answer: `Yes. We work across Central Oregon, and ${reach}.${gap}` }
}

/**
 * The 13-question order of the brief: three record questions first, the kept
 * questions in their order, the out-of-state answer after the fee, and the
 * towns answer before Tumalo. `kept` is aboutFaqItems() (roster + hours live).
 * A record question whose figures did not load is left out, never guessed.
 */
export function aboutFaqWithRecord(kept: readonly FaqItem[], live: AboutLiveFigures): FaqItem[] {
  const out: FaqItem[] = [faqGood(live), faqChoose(live)]
  const howMany = faqHowMany(live)
  if (howMany) out.push(howMany)
  const towns = faqTowns(live)
  for (const item of kept) {
    if (/^Do you cover Tumalo\?$/.test(item.question) && towns) out.push(towns)
    out.push(item)
    if (/charge to sell a home\?$/.test(item.question)) out.push(faqAway())
  }
  return out
}

/** One visible door per answer (V3Answers action). JSON-LD stays plain text. */
export function aboutFaqAction(question: string, valuationHref: string): { label: string; href: string } | undefined {
  if (question === ABOUT_FAQ_GOOD) return { label: 'Every review', href: '/reviews' }
  if (question === 'Who are the brokers?') return { label: 'The team page', href: '/team' }
  if (question === ABOUT_FAQ_AWAY) {
    return { label: 'Selling your Bend home from out of state', href: '/blog/selling-your-bend-home-from-out-of-state' }
  }
  if (question === 'How do I get a home valuation?') return { label: 'Value my home', href: valuationHref }
  return undefined
}
