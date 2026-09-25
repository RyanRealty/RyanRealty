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
 * NEIGHBORHOOD FACTS (Matt 2026-09-24, "Add to neighborhoods"). A neighborhood
 * page also answers how old its homes are, whether homes report an HOA, what
 * the dues run and whether CC&Rs are on file. Each answer is the sentence the
 * page's own section prints (V3PlaceCharacter's builders, V3PlaceDocuments'
 * counts and caveats), so the FAQ cannot say more than the section does. The
 * city FAQ does not get these: its test keeps HOA and school data out.
 * Schools come through lib/site/market-faq.ts, from the attendance areas.
 *
 * Dataset variableMeasured stays pulse-only. Extras feed the visible FAQ and
 * FAQPage JSON-LD only.
 */
import { duesSentence, hoaPresenceSentence, PLACE_HOA_CAVEAT, yearBuiltSentence } from '@/components/site/v3'
import { formatPriceExact } from '@/lib/format/money'
import { formatPaceShare } from '@/lib/data/market-truth/public-pace'
import type { PlaceCharacter } from '@/lib/data/places/getPlaceCharacter'
import { summarizePlaceDocuments, type PlaceDocument } from '@/lib/data/places/place-document-view'
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
  /** Neighborhood grain only: build years, HOA presence and dues (getPlaceCharacter). */
  character?: PlaceCharacter | null
  /** The population those figures were measured on, in the page's words. */
  characterSource?: string | null
  /** Neighborhood grain only: the governing documents the page links (getPlaceDocuments). */
  documents?: readonly PlaceDocument[] | null
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

/*
 * AEO-5 / VOICE-5 (visibility audit 2026-09-22): every answer below is the
 * fact in plain words, the way a broker would say it. Where the number came
 * from rides in `source`, which the page prints as the row's source line and
 * keeps as data-source-key; it no longer rides inside the sentence ("not a
 * guess", "the same MLS OpenHouses pull the open-house ledger uses", "this is
 * the registry list this page already shows"). Answer engines quote the
 * sentence, so the sentence is the part a reader should be able to repeat.
 */

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
        `${subject}'s ${kind} include ${text}${moreClause(more)}. ` +
        `Each neighborhood has its own page with the single-family homes for sale there right now and its own market figures.`,
      source: input.neighborhoodsSource,
    })
  }

  const communities = uniqueNames(input.communities)
  if (communities.length >= 2 && input.communitiesSource?.trim()) {
    const { text, more } = listed(communities)
    pushExtra(extras, {
      question: `Which communities are in ${place}?`,
      answer:
        `Communities in ${place} include ${text}${moreClause(more)}. ` +
        `They are the golf, resort, and master-planned communities with pages of their own, ` +
        `and each one shows the homes for sale there right now.`,
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
        `Parks ${where} include ${text}${moreClause(more)}. ` +
        `Each park has its own page with the features, parking, hours, and acreage its official park page lists.`,
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
        `Trails ${where} include ${text}${moreClause(more)}. ` +
        `Each trail has its own page with the distance and difficulty the land manager publishes, so you can pick one before you go.`,
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
    const extra = n > samples.length ? ` and ${n - samples.length} more` : ''
    const lead =
      n === 1
        ? `Yes. There is 1 open house in ${place} in the next 7 days`
        : `Yes. There are ${n.toLocaleString('en-US')} open houses in ${place} in the next 7 days`
    pushExtra(extras, {
      question: `Are there open houses in ${place} this week?`,
      answer:
        `${lead}, including ${joinNames(samples)}${extra}. ` +
        `The full list, with every time and address, is on the ${place} open houses page.`,
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
        `Under 100% means sellers generally came down from their first number before the home sold. Over 100% means buyers bid past it.`,
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
      sentences.push(`By how they paid: ${joinNames(bits)}.`)
    }
    sentences.push(
      `Payment types under 5% are left out, so these do not add up to 100%. This is how other buyers paid, and it is not a suggestion about your down payment.`,
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
        `${newN.toLocaleString('en-US')} detached single-family ${houses} came on the market in ${place} in the last 30 days, not counting Coming Soon listings. ` +
        `The email alert on this page tells you about the next ones, and it covers other home types too, not only houses.`,
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
        : `Put in your own interest rate and the payment updates.`
    pushExtra(extras, {
      question: `How much house can I afford in ${place}?`,
      answer:
        `The median asking price for a single-family home in ${place} is ${formatPriceExact(median)}, and the calculator on this page starts there. ` +
        `Move the monthly payment or the price and the other follows. ${rateSentence} ` +
        `To see the homes that fit your budget, search from the calculator.`,
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
        `Closed sales in ${place} across all property types added up to ${year.volume.trim()} in ${year.year}, from ${year.soldCount.toLocaleString('en-US')} sales. ` +
        `That total covers every kind of property that sold, so it is not a single-family-only figure.`,
      source: input.yearClosedSource,
    })
  }

  if (input.grain === 'neighborhood') {
    pushCharacterExtras(extras, place, input.character ?? null, input.characterSource ?? null)
    pushDocumentsExtra(extras, place, input.documents ?? null)
  }

  return extras
}

function pushCharacterExtras(
  out: PlaceFaqExtraItem[],
  place: string,
  character: PlaceCharacter | null,
  source: string | null,
): void {
  if (!character || !source?.trim()) return
  const { yearBuilt, hoaPresence, dues, subType, noun } = character
  if (yearBuilt) {
    pushExtra(out, {
      question: `How old are the homes in ${place}?`,
      answer: yearBuiltSentence(place, noun, yearBuilt),
      source,
    })
  }
  if (hoaPresence) {
    pushExtra(out, {
      question: `Do homes in ${place} have an HOA?`,
      answer: `${hoaPresenceSentence(subType, hoaPresence)} ${PLACE_HOA_CAVEAT}`,
      source,
    })
  }
  if (dues) {
    pushExtra(out, {
      question: `How much are HOA dues in ${place}?`,
      answer: `${duesSentence(subType, dues)} One home's dues can sit well above or below that. Confirm them through the association before relying on them.`,
      source,
    })
  }
}

/**
 * What is on file, never a yes or no. A declaration covers the lots its own
 * text describes, and a Bend district holds many subdivisions, so one linked
 * declaration is not "yes, this place has CC&Rs" for every home in it. The
 * counts, county and attribution come from summarizePlaceDocuments, the same
 * helper V3PlaceDocuments' note and footnote read.
 */
function pushDocumentsExtra(
  out: PlaceFaqExtraItem[],
  place: string,
  documents: readonly PlaceDocument[] | null,
): void {
  const summary = summarizePlaceDocuments(documents ?? [])
  if (!summary) return
  const { count, declarations, amendments, county, hasRecorded, hasAssociation, publisher, attribution } = summary
  const which =
    declarations > 0 && amendments > 0
      ? `: ${declarations === 1 ? 'the declaration' : `${declarations} declarations`} and ${amendments} recorded ${amendments === 1 ? 'amendment' : 'amendments'}`
      : ''
  const sentences = [
    `This page links ${count} ${hasRecorded ? 'recorded ' : ''}${count === 1 ? 'document' : 'documents'} for ${place}${which}.`,
  ]
  if (hasRecorded) {
    sentences.push(
      hasAssociation
        ? `The ones with a book, page or instrument number are copies of instruments recorded in ${county} County, Oregon.`
        : `They are copies of instruments recorded in ${county} County, Oregon.`,
    )
  }
  if (hasAssociation) {
    sentences.push(
      `${hasRecorded ? 'The rest are' : 'They are'} ${publisher ?? 'the association'}'s own published copies, which carry no county instrument number.`,
    )
  }
  if (declarations > 0) {
    sentences.push(`A declaration covers the lots it describes, which may not be every home in ${place}.`)
  }
  sentences.push(
    'Later amendments may exist that are not shown here, so confirm the governing documents for a specific home through title before relying on them.',
  )

  const sources = [
    hasRecorded ? `instruments recorded in ${county} County, Oregon${attribution ? `, copies via ${attribution.label}` : ''}` : null,
    hasAssociation ? `${publisher ?? 'the association'}'s published copies` : null,
  ].filter((part): part is string => Boolean(part))

  pushExtra(out, {
    question: declarations > 0 ? `What CC&Rs are on file for ${place}?` : `What governing documents are on file for ${place}?`,
    answer: sentences.join(' '),
    source: sources.join('; '),
  })
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
