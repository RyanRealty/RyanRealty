// brand-voice:exempt — factual place Q&A generated from figures already on the page
/**
 * SITE-172 — place FAQ depth beyond pulse stats.
 *
 * Pulse questions (median price, active count, months of supply, days to
 * pending, 12-month sold) stay in lib/site/market-faq.ts. This helper adds
 * questions whose answers are already on the city or neighborhood page as a
 * named section: neighborhoods, communities, parks, trails, open houses,
 * sale-to-original, financing mix, 30-day new listings, the affordability
 * calculator, calendar-year closed volume.
 *
 * Every extra is §0-strict:
 *  - omit when the page did not render the source section
 *  - omit without a named source string the page already prints
 *  - omit answers under MIN_PLACE_FAQ_EXTRA_CHARS (thin Dataset restatements)
 *  - never invent HOA dollars or school numbers
 *
 * Dataset variableMeasured stays pulse-only. Extras feed the visible FAQ and
 * FAQPage JSON-LD only.
 */
import { formatPriceExact } from '@/lib/format/money'
import { formatPaceShare } from '@/lib/data/market-truth/public-pace'
import { publishableNewCount } from '@/lib/site/place-alerts'
import type { MarketFaqItem, MarketFaqResult } from '@/lib/site/market-faq'

export const MIN_PLACE_FAQ_EXTRA_CHARS = 120

const NAME_CAP = 6

export type PlaceFaqExtraItem = {
  question: string
  answer: string
  /** The same source line the page already prints under that section. */
  source: string
}

export type PlaceFaqNamedPlace = {
  name: string
}

export type PlaceFaqOpenHouse = {
  address: string
  when?: string | null
}

export type PlaceFaqFinancingSlice = {
  name: string
  label: string
}

export type PlaceFaqYearClosed = {
  year: number
  volume: string
  soldCount: number
}

export type PlaceFaqRate = {
  pct: number
  weekLabel: string
  sourceName: string
}

export type PlaceFaqExtrasInput = {
  placeName: string
  /** Parent city, for neighborhood extras that list sibling districts. */
  cityName?: string | null
  grain: 'city' | 'neighborhood'
  neighborhoods?: readonly PlaceFaqNamedPlace[] | null
  neighborhoodsSource?: string | null
  communities?: readonly PlaceFaqNamedPlace[] | null
  communitiesSource?: string | null
  parks?: readonly PlaceFaqNamedPlace[] | null
  parksSource?: string | null
  trails?: readonly PlaceFaqNamedPlace[] | null
  trailsSource?: string | null
  openHouses?: readonly PlaceFaqOpenHouse[] | null
  openHousesSource?: string | null
  /** Already converted to 0–100 by leftoverSaleToListPct. */
  saleToOriginalPct?: number | null
  saleToOriginalSource?: string | null
  /** 0–1 share of detached closings paid cash. */
  cashShare?: number | null
  financing?: readonly PlaceFaqFinancingSlice[] | null
  mixSource?: string | null
  newListings30d?: number | null
  newListingsSource?: string | null
  medianListPrice?: number | null
  medianListSource?: string | null
  rate?: PlaceFaqRate | null
  yearClosed?: PlaceFaqYearClosed | null
  yearClosedSource?: string | null
}

function uniqueNames(items: readonly { name: string }[] | null | undefined): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const item of items ?? []) {
    const name = item?.name?.trim()
    if (!name) continue
    const key = name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(name)
  }
  return out
}

function joinNames(names: readonly string[]): string {
  if (names.length === 0) return ''
  if (names.length === 1) return names[0]!
  if (names.length === 2) return `${names[0]} and ${names[1]}`
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`
}

function listed(names: readonly string[]): { text: string; more: number } {
  const head = names.slice(0, NAME_CAP)
  return { text: joinNames(head), more: Math.max(0, names.length - head.length) }
}

function moreClause(more: number): string {
  if (more <= 0) return ''
  return ` and ${more.toLocaleString('en-US')} more named on this page`
}

function pushExtra(out: PlaceFaqExtraItem[], item: PlaceFaqExtraItem): void {
  const question = item.question.trim()
  const answer = item.answer.trim()
  const source = item.source.trim()
  if (!question || !answer || !source) return
  if (answer.length < MIN_PLACE_FAQ_EXTRA_CHARS) return
  out.push({ question, answer, source })
}

export function buildPlaceFaqExtras(input: PlaceFaqExtrasInput): PlaceFaqExtraItem[] {
  const place = input.placeName.trim()
  const extras: PlaceFaqExtraItem[] = []
  if (!place) return extras

  const neighborhoods = uniqueNames(input.neighborhoods)
  if (neighborhoods.length >= 2 && input.neighborhoodsSource?.trim()) {
    const { text, more } = listed(neighborhoods)
    const city = input.cityName?.trim()
    const subject = input.grain === 'neighborhood' && city ? city : place
    const kind =
      input.grain === 'neighborhood'
        ? 'other designated neighborhoods'
        : 'designated neighborhoods'
    pushExtra(extras, {
      question: `Which neighborhoods are in ${subject}?`,
      answer:
        `${subject}'s ${kind} on this page include ${text}${moreClause(more)}. ` +
        `Each row is that district's live single-family count from the same MLS feed the neighborhood ledger uses, not a guess. ` +
        `Open a neighborhood for its own homes and market figures.`,
      source: input.neighborhoodsSource,
    })
  }

  const communities = uniqueNames(input.communities)
  if (communities.length >= 2 && input.communitiesSource?.trim()) {
    const { text, more } = listed(communities)
    pushExtra(extras, {
      question: `Which communities are in ${place}?`,
      answer:
        `Communities listed on this ${place} page include ${text}${moreClause(more)}. ` +
        `Those names are the in-city community and golf or master-planned doors this page already publishes. ` +
        `Each count comes from the same live MLS feed as the community ledger, not a separate inventory.`,
      source: input.communitiesSource,
    })
  }

  const parks = uniqueNames(input.parks)
  if (parks.length >= 1 && input.parksSource?.trim()) {
    const { text, more } = listed(parks)
    const where = input.grain === 'neighborhood' ? `near ${place}` : `in ${place}`
    pushExtra(extras, {
      question: `What parks are ${where}?`,
      answer:
        `Parks named on this page include ${text}${moreClause(more)}. ` +
        `Features, parking, hours, and acreage print on those rows only when the official park page states them. ` +
        `This is the Central Oregon parks registry list this page already shows, not an invented complete inventory.`,
      source: input.parksSource,
    })
  }

  const trails = uniqueNames(input.trails)
  if (trails.length >= 1 && input.trailsSource?.trim()) {
    const { text, more } = listed(trails)
    const where = input.grain === 'neighborhood' ? `near ${place}` : `in ${place}`
    pushExtra(extras, {
      question: `What trails are ${where}?`,
      answer:
        `Trails named on this page include ${text}${moreClause(more)}. ` +
        `Distance and difficulty print on those rows only when the land manager publishes them. ` +
        `This is the Central Oregon trails registry list this page already shows, not a guessed trail network.`,
      source: input.trailsSource,
    })
  }

  const openHouses = (input.openHouses ?? [])
    .map((row) => ({
      address: row.address?.trim() ?? '',
      when: row.when?.trim() || null,
    }))
    .filter((row) => row.address.length > 0)
  if (input.grain === 'city' && openHouses.length >= 1 && input.openHousesSource?.trim()) {
    const n = openHouses.length
    const samples = openHouses.slice(0, NAME_CAP).map((row) =>
      row.when ? `${row.address} (${row.when})` : row.address,
    )
    const extra = n > samples.length ? ` and ${n - samples.length} more on this page` : ''
    pushExtra(extras, {
      question: `Are there open houses in ${place} this week?`,
      answer:
        `Yes. This page lists ${n.toLocaleString('en-US')} open house${n === 1 ? '' : 's'} scheduled in the next 7 days, including ${joinNames(samples)}${extra}. ` +
        `Times and addresses are the same MLS OpenHouses pull the open-house ledger uses. ` +
        `The full weekend list is on this city's open-houses page.`,
      source: input.openHousesSource,
    })
  }

  const salePct = input.saleToOriginalPct
  if (
    salePct != null &&
    Number.isFinite(salePct) &&
    salePct > 0 &&
    input.saleToOriginalSource?.trim()
  ) {
    const shown = `${(Math.round(salePct * 10) / 10).toFixed(1)}%`
    pushExtra(extras, {
      question: `Do homes in ${place} sell for the asking price?`,
      answer:
        `The typical detached single-family home in ${place} closed at ${shown} of the price it was first listed at, over the last 12 months. ` +
        `Under 100% means sellers generally came down from their first number before the home sold. Over 100% means buyers bid past it. ` +
        `That is the same sale-to-original share this page's market section already prints.`,
      source: input.saleToOriginalSource,
    })
  }

  const cash =
    input.cashShare != null && Number.isFinite(input.cashShare) && input.cashShare > 0
      ? input.cashShare
      : null
  const financing = (input.financing ?? []).filter((bit) => bit.name?.trim() && bit.label?.trim())
  if ((cash != null || financing.length > 0) && input.mixSource?.trim()) {
    const sentences: string[] = []
    if (cash != null) {
      sentences.push(
        `${formatPaceShare(cash)} of the detached ${place} homes that closed over the last 12 months were paid for in cash.`,
      )
    }
    if (financing.length > 0) {
      const bits = financing.slice(0, 4).map((bit) => `${bit.label.trim()} ${bit.name.trim()}`)
      sentences.push(`The same financing mix on this page also shows ${joinNames(bits)}.`)
    }
    sentences.push(
      `Shares under 5% are not published, so these do not add to 100%. This is how other buyers paid on detached closings; it is not a suggestion about your down payment.`,
    )
    pushExtra(extras, {
      question: `How do buyers in ${place} pay?`,
      answer: sentences.join(' '),
      source: input.mixSource,
    })
  }

  const newN = publishableNewCount(input.newListings30d)
  if (newN != null && input.newListingsSource?.trim()) {
    const houses = newN === 1 ? 'house' : 'houses'
    pushExtra(extras, {
      question: `How many new houses listed in ${place} in the last 30 days?`,
      answer:
        `${newN.toLocaleString('en-US')} detached single-family ${houses} came on the market in ${place} in the last 30 days. ` +
        `That count is Market Truth new listings of detached single-family homes, Coming Soon excluded — the same figure the alerts strip on this page prints. ` +
        `The email alert follows this page's filter, which is wider than houses alone.`,
      source: input.newListingsSource,
    })
  }

  const median =
    input.medianListPrice != null && Number.isFinite(input.medianListPrice) && input.medianListPrice > 0
      ? Math.round(input.medianListPrice)
      : null
  if (median != null && input.medianListSource?.trim()) {
    const rate = input.rate
    const rateSentence =
      rate && Number.isFinite(rate.pct) && rate.pct > 0 && rate.weekLabel.trim() && rate.sourceName.trim()
        ? `The 30-year rate on that calculator is ${rate.pct}% for the week of ${rate.weekLabel.trim()}, from ${rate.sourceName.trim()}.`
        : `When a measured 30-year rate is not on this page, the calculator says the rate is an assumption you set.`
    pushExtra(extras, {
      question: `How much house can I afford in ${place}?`,
      answer:
        `This page's calculator opens on ${place}'s median asking price of ${formatPriceExact(median)} for the single-family homes now listed. ` +
        `Move the monthly payment or the price and the other follows. ${rateSentence} ` +
        `It does not count how many homes sit under your ceiling — that search is one tap from the calculator.`,
      source: input.medianListSource,
    })
  }

  const year = input.yearClosed
  if (
    input.grain === 'city' &&
    year &&
    year.year > 0 &&
    year.soldCount > 0 &&
    year.volume.trim() &&
    input.yearClosedSource?.trim()
  ) {
    pushExtra(extras, {
      question: `How much ${place} real estate closed in ${year.year}?`,
      answer:
        `Closed MLS sales in ${place} across all property types totaled ${year.volume.trim()} in calendar year ${year.year}, from ${year.soldCount.toLocaleString('en-US')} sales. ` +
        `That is not active inventory and not a single-family-only figure. It is the same calendar-year volume this page's market section already prints.`,
      source: input.yearClosedSource,
    })
  }

  return extras
}

/**
 * Append extras onto a pulse FAQ without touching Dataset variables.
 * Duplicate questions (same wording as a pulse or place-answers row) are dropped.
 */
export function appendPlaceFaqExtras(
  base: MarketFaqResult,
  extras: readonly PlaceFaqExtraItem[],
): MarketFaqResult {
  const seen = new Set(base.faqs.map((item) => item.question.trim().toLowerCase()))
  const faqs: MarketFaqItem[] = [...base.faqs]
  for (const extra of extras) {
    const question = extra.question.trim()
    const answer = extra.answer.trim()
    if (!question || !answer || answer.length < MIN_PLACE_FAQ_EXTRA_CHARS) continue
    const key = question.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    faqs.push({ question, answer })
  }
  return { ...base, faqs }
}
