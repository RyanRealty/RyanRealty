/**
 * Named homes competing at the recommended list. Counts stay on
 * CmaBandPosition. This module names the houses and draws the list.
 */

import { UNADDRESSED_DOC_LINKS, escapeHtml, int, sparkPhotoAt, usd } from '@/lib/cma/render-blocks'
import { trackedDocLink, type TrackedDocLinkCtx } from '@/lib/cma/doc-links'
import { formatDate } from '@/lib/format/date'
import { priceHistoryLineCompactHtml, pricePathFromListing } from '@/lib/cma/price-path'
import { listingHistoryLine as buildListingHistoryLine, liveListingDays } from '@/lib/cma/listing-history-line'
import { listingStretch, offerRun, type AskChange, type ListingStretch } from '@/lib/cma/listing-status'
import { AFTER_LAST_ON_MARKET, listingStretchRead } from '@/lib/cma/last-stretch'
import { compAreaContains, compAreaIn, compAreaPhrase, type CompArea } from '@/lib/pricing/comp-area'
import { countWord } from '@/lib/pricing/estimate'
import { publishStreetNumber, publishStreetPart } from '@/lib/listing/publish-street-line'
import { roomNotedSentence, sameAreaFit, type SameAreaSubject } from '@/lib/cma/same-area-fit'
import { unlikeReasonSentence, type CmaUnlikeHome } from '@/lib/cma/unlike-reason'
import { printedBaths } from '@/lib/pricing/bath-count'

const esc = escapeHtml

export const BAND_RIVAL_CAP = 4

export type CmaBandRival = {
  listingKey: string
  address: string
  listPrice: number
  status: 'Active' | 'Pending'
  /**
   * Active: days on the market as of the build. Pending: days from the day it
   * went Active to the day it went under contract (`pendingDate`), never the
   * days since it listed.
   */
  daysOnMarket: number | null
  /**
   * YYYY-MM-DD (Pacific) a Pending home went under contract. The date its
   * status column prints. Absent on rows built before it was read.
   */
  pendingDate?: string | null
  photoUrl: string | null
  latitude: number | null
  longitude: number | null
  beds?: number | null
  /** BathroomsTotal, which counts a half bath whole. Print through `printedBaths`, never raw. */
  baths?: number | null
  /** MLS full / half bath split (listings.baths_full / baths_half), when read. */
  bathsFull?: number | null
  bathsHalf?: number | null
  sqft?: number | null
  yearBuilt?: number | null
  lotAcres?: number | null
  propertySubType?: string | null
  /** MLS subdivision. Lets the letter drop a rival outside the sales plat. */
  subdivision?: string | null
  /**
   * The recorded plat polygon the home sits in, from the area read (null when
   * tested and none holds it). The area test reads it before the MLS name
   * (rule 24; reader review 2026-10-08, 915 Saginaw). Absent on rows stored
   * before then, which keep the name test.
   */
  platSlug?: string | null
  originalListPrice?: number | null
  onMarketDate?: string | null
  /**
   * Its last stretch on the market (Matt 2026-10-08, "Last stretch, labeled"):
   * its days count from OnMarketDate, the day it last came on the market, and
   * its first ask is the price in effect then. 2260 Indigo went Active Jan 29
   * at $670,000, was withdrawn Jun 8 and came back Jun 15 at $645,000; its 115
   * days and its cut run from $645,000. Print through last-stretch.ts
   * listingStretchRead. Absent on rows built before.
   */
  stretch?: ListingStretch | null
  listingHistoryLine?: string | null
  /** Miles from the subject. Blank on a stored row until print fills it from coordinates. */
  proximity?: string | null
  /** Rule 4: up to two whole rooms off stays and weighs less. Three or more on one count is refused. No dollar value. */
  roomDifference?: Array<'beds' | 'baths'> | null
  /**
   * MLS public remarks, carried only while the build fits the home (the
   * multi-unit and ADU walls read them, rule 24). buildBandRivalSet drops them
   * from the set it returns, so a stored letter does not carry remarks text.
   */
  publicRemarks?: string | null
}

export type CmaBandSubject = {
  beds: number | null
  baths: number | null
  bathsFull?: number | null
  bathsHalf?: number | null
  sqft: number | null
  yearBuilt: number | null
  lotAcres: number | null
  recommendedList: number | null
  latitude: number | null
  longitude: number | null
  photoUrl?: string | null
  daysOnMarket?: number | null
  listingHistoryLine?: string | null
}

export type BandStreetRow = {
  StreetNumber?: string | null
  StreetName?: string | null
}

export function rivalAddress(row: BandStreetRow): string {
  return [publishStreetNumber(row.StreetNumber), publishStreetPart(row.StreetName)]
    .filter((p): p is string => Boolean(p))
    .join(' ')
}

function rivalMiles(rival: CmaBandRival, lat: number, lng: number): number {
  const d = milesBetween({ latitude: lat, longitude: lng }, rival)
  return d == null ? Number.POSITIVE_INFINITY : d
}

/**
 * The same fit the sales passed (Matt 2026-10-07, rule 24): inside the sales
 * area, the same product, the one-room rule on beds and baths, the plat-wide
 * size band, the plat-row year band. One definition, lib/cma/same-area-fit.ts.
 */
export function rivalFitsSubject(
  r: CmaBandRival,
  subject?: Partial<SameAreaSubject> | null,
  area?: CompArea | null,
): boolean {
  return sameAreaFit(area ?? null, subject ?? {}, {
    address: r.address,
    subdivision: r.subdivision,
    subdivisionSlug: r.platSlug,
    latitude: r.latitude,
    longitude: r.longitude,
    beds: r.beds,
    baths: r.baths,
    bathsFull: r.bathsFull ?? null,
    bathsHalf: r.bathsHalf ?? null,
    sqft: r.sqft,
    yearBuilt: r.yearBuilt,
    propertySubType: r.propertySubType,
    publicRemarks: r.publicRemarks ?? null,
  }).ok
}

export function pickBandRivals(
  rivals: readonly CmaBandRival[],
  subject?: (Partial<SameAreaSubject> & { latitude: number | null; longitude: number | null }) | null,
  cap = BAND_RIVAL_CAP,
  area?: CompArea | null,
): CmaBandRival[] {
  const named = rivals.filter((r) => r.address.trim() && r.listPrice > 0)
  // An unlike home never fills the table (Matt 2026-10-07). Short is short.
  const pool = named.filter((r) => rivalFitsSubject(r, subject, area))
  const slat = subject?.latitude
  const slng = subject?.longitude
  const ranked =
    slat != null && slng != null && Number.isFinite(slat) && Number.isFinite(slng)
      ? [...pool].sort((a, b) => rivalMiles(a, slat, slng) - rivalMiles(b, slat, slng))
      : [...pool]
  const actives = ranked.filter((r) => r.status === 'Active').slice(0, cap)
  const pendings = ranked.filter((r) => r.status === 'Pending').slice(0, cap)
  return [...actives, ...pendings]
}

function milesBetween(
  a: { latitude: number | null; longitude: number | null },
  b: { latitude: number | null; longitude: number | null },
): number | null {
  if (
    a.latitude == null ||
    a.longitude == null ||
    b.latitude == null ||
    b.longitude == null ||
    !Number.isFinite(a.latitude) ||
    !Number.isFinite(a.longitude) ||
    !Number.isFinite(b.latitude) ||
    !Number.isFinite(b.longitude)
  ) {
    return null
  }
  const toRad = (d: number) => (d * Math.PI) / 180
  const R = 3958.7613
  const dLat = toRad(b.latitude - a.latitude)
  const dLng = toRad(b.longitude - a.longitude)
  const lat1 = toRad(a.latitude)
  const lat2 = toRad(b.latitude)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

function joinFacts(parts: Array<string | null | undefined>): string | null {
  const kept = parts.filter((p): p is string => Boolean(p && p.trim()))
  return kept.length ? kept.join(' · ') : null
}

/**
 * "2.5 ba": the bath count the way the MLS prints it and the sales table
 * prints it (printedBaths), never BathroomsTotal raw, which counts a half
 * bath whole (3446 Jackwood, 2 full and 1 half, printed "3", 2026-10-08).
 */
function bathsFact(r: { baths?: number | null; bathsFull?: number | null; bathsHalf?: number | null }): string | null {
  const b = printedBaths(r)
  return b != null ? `${b % 1 === 0 ? int(b) : b.toFixed(1)} ba` : null
}

export function rivalFactsLine(r: CmaBandRival): string | null {
  return joinFacts([
    r.beds != null ? `${int(r.beds)} bd` : null,
    bathsFact(r),
    r.sqft != null && r.sqft > 0 ? `${int(r.sqft)} sqft` : null,
    r.yearBuilt != null ? String(r.yearBuilt) : null,
    r.lotAcres != null && r.lotAcres > 0 ? `${r.lotAcres.toFixed(2)} ac` : null,
    r.sqft != null && r.sqft > 0 && r.listPrice > 0
      ? `${usd(Math.round(r.listPrice / r.sqft))}/sf`
      : null,
  ])
}

/**
 * The delta line against your home, in the blueprint's own words:
 * "$28,250 above, 60 sqft larger, 7 years newer". The referent is the chapter
 * title, which names the price.
 */
export function rivalVsSubjectLine(r: CmaBandRival, subject: CmaBandSubject | null | undefined): string | null {
  if (!subject) return null
  const bits: string[] = []
  if (subject.recommendedList != null && subject.recommendedList > 0) {
    const d = Math.round(r.listPrice - subject.recommendedList)
    if (d === 0) bits.push('the same price')
    else bits.push(`${usd(Math.abs(d))} ${d > 0 ? 'above' : 'below'}`)
  }
  if (r.sqft != null && r.sqft > 0 && subject.sqft != null && subject.sqft > 0) {
    const d = Math.round(r.sqft - subject.sqft)
    if (d === 0) bits.push('same size')
    else bits.push(`${int(Math.abs(d))} sqft ${d > 0 ? 'larger' : 'smaller'}`)
  }
  if (r.beds != null && subject.beds != null && r.beds !== subject.beds) {
    const d = r.beds - subject.beds
    bits.push(d > 0 ? `${int(d)} more bed${d === 1 ? '' : 's'}` : `${int(-d)} fewer bed${d === -1 ? '' : 's'}`)
  }
  const rBaths = printedBaths(r)
  const sBaths = printedBaths(subject)
  if (rBaths != null && sBaths != null && rBaths !== sBaths) {
    const d = rBaths - sBaths
    const abs = Math.abs(d)
    const n = abs % 1 === 0 ? int(abs) : abs.toFixed(1)
    bits.push(`${n} ${d > 0 ? 'more' : 'fewer'} bath${abs === 1 ? '' : 's'}`)
  }
  if (r.yearBuilt != null && subject.yearBuilt != null) {
    const d = r.yearBuilt - subject.yearBuilt
    if (d !== 0) {
      bits.push(`${int(Math.abs(d))} year${Math.abs(d) === 1 ? '' : 's'} ${d > 0 ? 'newer' : 'older'}`)
    }
  }
  const mi = milesBetween(r, subject)
  if (mi != null && mi >= 0.05) bits.push(mi >= 10 ? `${int(mi)} mi away` : `${mi.toFixed(1)} mi away`)
  return bits.length ? bits.join(', ') : null
}

/** Photo, linked address, price, size, days on market, and the delta line. */
/**
 * The days a competitor's card and row print, and what they count. A home for
 * sale counts its days on the market. A home under contract counts the days
 * from Active to its contract and says so; a stored row without its contract
 * day has only the days since it listed, which is not that count, so it prints
 * none (reader review 2026-10-08, 2820 Aldrich: "44 days" for an 18-day offer).
 */
export function rivalDays(r: Pick<CmaBandRival, 'status' | 'daysOnMarket' | 'pendingDate'>): {
  days: number | null
  measure: 'offer' | 'on-market'
} {
  const n = r.daysOnMarket != null && Number.isFinite(r.daysOnMarket) && r.daysOnMarket >= 0 ? Math.round(r.daysOnMarket) : null
  if (r.status !== 'Pending') return { days: n, measure: 'on-market' }
  return { days: r.pendingDate ? n : null, measure: 'offer' }
}

/**
 * "115 days on market", "18 days to an offer"; on a stretch that is not the
 * listing's first, "115 days since it last came on the market" and "18 days to
 * an offer after it last came on the market" (Matt 2026-10-08).
 */
export function rivalDaysFact(days: number, measure: 'offer' | 'on-market', restarted: boolean): string {
  const count = `${int(days)} ${days === 1 ? 'day' : 'days'}`
  if (measure === 'offer') return `${count} to an offer${restarted ? ` ${AFTER_LAST_ON_MARKET}` : ''}`
  return restarted ? `${count} since it last came on the market` : `${count} on market`
}

function rivalCard(
  r: CmaBandRival,
  subject: CmaBandSubject | null | undefined,
  ctx: TrackedDocLinkCtx | null | undefined,
  city: string,
): string {
  const photo = sparkPhotoAt(r.photoUrl, '480x360')
  const img = photo
    ? `<img class="rival-ph" src="${esc(photo)}" alt="${esc(r.address)}" loading="eager" referrerpolicy="no-referrer"/>`
    : `<div class="rival-ph is-empty" aria-hidden="true"></div>`
  const href = trackedDocLink(
    'listing',
    {
      listingKey: r.listingKey,
      streetNumber: /^\s*(\d+[A-Za-z]?)\s/.exec(r.address)?.[1] ?? null,
      streetName: r.address.replace(/^\s*\d+[A-Za-z]?\s+/, '').trim() || null,
      city,
    },
    ctx ?? UNADDRESSED_DOC_LINKS,
  )
  const told = rivalDays(r)
  const stretch = listingStretchRead(r)
  const facts = joinFacts([
    r.sqft != null && r.sqft > 0 ? `${int(r.sqft)} sqft` : null,
    r.beds != null ? `${int(r.beds)} bd` : null,
    bathsFact(r),
    told.days != null ? rivalDaysFact(told.days, told.measure, stretch.restarted) : null,
  ])
  const vs = rivalVsSubjectLine(r, subject)
  // Delta 1: "Every active and pending row carries its price history line and
  // days on market too, so the reader sees which competitors have already
  // cut." The compact drawing, because a card in a four-up grid is narrower
  // than the wide line at every viewport.
  const path = priceHistoryLineCompactHtml(
    pricePathFromListing({
      address: r.address,
      listPrice: r.listPrice,
      originalListPrice: stretch.firstAsk,
      onMarketDate: r.onMarketDate ?? null,
      daysOnMarket: told.days,
      status: r.status,
      daysMeasure: told.measure,
    }),
    `rival-${r.listingKey}`,
  )
  return `<article class="rival-card" data-rival="${esc(r.listingKey)}" data-status="${esc(
    r.status.toLowerCase(),
  )}">
    ${img}
    <div class="rival-body">
      <a class="rival-addr" href="${esc(href)}" data-rr-track="cma-competition">${esc(r.address)}</a>
      <div class="rival-ask">${usd(r.listPrice)}</div>
      ${facts ? `<div class="rival-facts">${esc(facts)}</div>` : ''}
      ${vs ? `<div class="rival-meta">${esc(vs)}</div>` : ''}
      ${path}
    </div>
  </article>`
}

/**
 * The under-contract clause that follows a for-sale count. When homes were
 * just counted for sale it says "other", so the two counts read as different
 * homes: "1 home like yours is for sale ... 1 is under contract." read as one
 * home (1355 Jacksonville, reader review 2026-10-08).
 */
export function underContractClause(pending: number, opts: { afterForSale: boolean; like?: string }): string {
  if (!(pending > 0)) return 'None are under contract right now.'
  const verb = pending === 1 ? 'is' : 'are'
  if (!opts.afterForSale) return `${int(pending)} ${verb} under contract.`
  return `${int(pending)} other ${pending === 1 ? 'home' : 'homes'}${opts.like ?? ''} ${verb} under contract.`
}

const COUNT_WORD_VALUES: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
}

/**
 * The stored competition sentence as it prints today. Rows built before the
 * under-contract clause said "other" carry "1 home like yours is for sale ...
 * 1 is under contract."; the render rewrites that clause from the numbers the
 * sentence already states, and changes nothing else.
 */
export function storedCompetitionSentenceToday(sentence: string): string {
  // Rows built before the unlike homes were described said four reasons
  // ("not close to this home in bedrooms, bathrooms, size or age") that were
  // not all true of them (reader review 2026-10-08). The count stays; the
  // reason becomes the one thing true of every one of them.
  const s = withoutMapPointer(sentence).replace(
    /\b(One other home is|([A-Z][a-z]+|\d[\d,]*) other homes are) listed there in that range, but (?:it is not|none is) close to this home in bedrooms, bathrooms, size or age, so (?:it is|they are) not compared here\./,
    (_all, phrase: string, word: string | undefined) => {
      const n = word ? (/^\d/.test(word) ? Number(word.replace(/,/g, '')) : COUNT_WORD_VALUES[word.toLowerCase()] ?? 3) : 1
      return `${phrase} listed there in that range. ${unlikeReasonSentence(null, n)}`
    },
  )
  const m = /^(.*?\bfor sale\b[^.]*\.)(\s+)(\d[\d,]*) (is|are) under contract\./.exec(s)
  if (!m) return s
  const forSale = m[1]!
  // A for-sale count of nothing ("No home ...", "0 homes ...") is not followed by "other".
  if (/^(?:No home|0 homes)\b/.test(forSale)) return s
  const pending = Number(m[3]!.replace(/,/g, ''))
  if (!(pending > 0)) return s
  const like = /\blike yours\b/.test(forSale) ? ' like yours' : ''
  return `${forSale}${m[2]}${underContractClause(pending, { afterForSale: true, like })}${s.slice(m[0].length)}`
}

/** "27 homes are for sale between $350,000 and $428,000. 14 other homes are under contract." */
export function competitionSentence(input: {
  lo: number
  hi: number
  activeCount: number
  pendingCount: number
  shown: number
  /** True when the homes drawn were narrowed to ones like the subject. */
  likeYours?: boolean
}): string {
  const bits = [
    `${int(input.activeCount)} home${input.activeCount === 1 ? ' is' : 's are'} for sale between ${usd(input.lo)} and ${usd(input.hi)}.`,
    underContractClause(input.pendingCount, { afterForSale: input.activeCount > 0 }),
  ]
  if (input.shown > 0 && input.shown < input.activeCount + input.pendingCount) {
    bits.push(`The nearest ${int(input.shown)} are below.`)
  }
  return bits.join(' ')
}

/**
 * Who among the homes below has already come down, and by how much.
 *
 * Delta 1: "Sentence: how many have cut, median cut." The figure is taken over
 * the homes THIS CHAPTER PRINTS, not over the whole price range — each one
 * draws its own opening ask and its ask today on the card, so a reader can add
 * the set up and land on the same median. A home whose opening ask is not on
 * the record is left out of both counts rather than assumed never to have cut.
 */
function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2
}

/**
 * How far the homes for sale have already come down, from the first ask of
 * each one's last stretch on the market (Matt 2026-10-08): 2260 Indigo came
 * back Jun 15 at $645,000 and is asking $550,000, a $95,000 cut over the 115
 * days its card counts, not $120,000 from its January ask of $670,000. When a
 * counted home came back on the market, the sentence says the cut is counted
 * from then.
 */
export function competitorCutLine(rivals: readonly CmaBandRival[]): string | null {
  const known = rivals
    .map((r) => ({ r, stretch: listingStretchRead(r) }))
    .filter(({ r, stretch }) => r.listPrice > 0 && stretch.firstAsk != null && stretch.firstAsk > 0)
  if (known.length === 0) return null
  const cuts = known
    .filter(({ r, stretch }) => stretch.firstAsk! > r.listPrice)
    .map(({ r, stretch }) => ({
      dollars: stretch.firstAsk! - r.listPrice,
      pct: ((stretch.firstAsk! - r.listPrice) / stretch.firstAsk!) * 100,
      restarted: stretch.restarted,
    }))
  const shown = known.length
  if (cuts.length === 0) {
    const since = known.some(({ stretch }) => stretch.restarted)
      ? shown === 1
        ? ' since it last came on the market'
        : ', each counted from when it last came on the market'
      : ''
    return shown === 1
      ? `The one home below has not come down from its opening price${since}.`
      : `None of the ${int(shown)} homes below has come down from its opening price${since}.`
  }
  // One home has a cut, not a median cut. A median needs two or more
  // (reader review 2026-10-07: "a median cut of $120,000" for one home).
  const cut = `${cuts.length === 1 ? 'a cut of' : 'a median cut of'} ${usd(
    Math.round(median(cuts.map((c) => c.dollars))),
  )}, or ${median(cuts.map((c) => c.pct)).toFixed(1)} percent`
  const anyRestarted = cuts.some((c) => c.restarted)
  if (shown === 1) {
    return anyRestarted
      ? `The one home below has come down since it last came on the market, ${cut}.`
      : `The one home below has already come down, ${cut}.`
  }
  if (cuts.length === 1 && anyRestarted) {
    return `${int(cuts.length)} of the ${int(shown)} homes below has come down since it last came on the market, ${cut}.`
  }
  return `${int(cuts.length)} of the ${int(shown)} homes below ${
    cuts.length === 1 ? 'has' : 'have'
  } already come down, ${cut}${anyRestarted ? ', each counted from when it last came on the market' : ''}.`
}

export type BandRivalsInput = {
  city: string
  lo: number
  hi: number
  activeCount: number
  pendingCount: number
  rivals: readonly CmaBandRival[]
  subject?: CmaBandSubject | null
  docLinks?: TrackedDocLinkCtx | null
  /** The recommended list, which the chapter title names. */
  recommendedList?: number | null
  /** The day this document was prepared, for the counts' source line. */
  asOfIso?: string | null
}

/**
 * Tip Ready P0: cover already carries the recommend — do not bang it in the title.
 *
 * A home on the market (lib/cma/subject-on-market.ts) is not deciding where to
 * list: "Who you would compete with at this price" read as listing it at ours.
 * Its chapter is the other homes for sale near the value, said as that.
 *
 * The heading covers what is listed under it (reader review 2026-10-08):
 * 3062 NW Kelly Hill printed "Other homes for sale near this value" over one
 * home that was under contract and none for sale. With the drawn counts the
 * on-market heading names the homes it heads; without them it stays as it was.
 */
export function competitionHeading(
  _recommendedList?: number | null,
  opts?: { onMarket?: boolean; active?: number | null; pending?: number | null },
): string {
  if (!opts?.onMarket) return 'Who you would compete with at this price'
  const active = opts.active ?? null
  const pending = opts.pending ?? 0
  if (pending > 0 && active === 0) return 'Other homes under contract near this value'
  if (pending > 0 && active != null && active > 0) return 'Other homes for sale or under contract near this value'
  return 'Other homes for sale near this value'
}

function competitionBody(input: BandRivalsInput): string {
  const actives = input.rivals.filter((r) => r.status === 'Active')
  const pendings = input.rivals.filter((r) => r.status === 'Pending')
  const cards = (list: readonly CmaBandRival[]) =>
    list.map((r) => rivalCard(r, input.subject, input.docLinks, input.city)).join('')
  const sentence = competitionSentence({
    lo: input.lo,
    hi: input.hi,
    activeCount: input.activeCount,
    pendingCount: input.pendingCount,
    shown: actives.length + pendings.length,
  })
  const cutLine = competitorCutLine(input.rivals)
  return `<p>${esc(sentence)}</p>
  ${cutLine ? `<p>${esc(cutLine)}</p>` : ''}
  <p class="small">${esc(competitionSourceLine(input))}</p>
  ${actives.length ? `<h3 class="subhead">For sale now</h3><div class="rival-grid">${cards(actives)}</div>` : ''}
  ${pendings.length ? `<h3 class="subhead">Under contract</h3><div class="rival-grid">${cards(pendings)}</div>` : ''}`
}

/**
 * The §0 trace for the two counts in the chapter's first sentence.
 *
 * "34 homes are for sale between $356,000 and $435,000. 13 are under contract."
 * sat on the page with no geography, no status definition and no as-of date —
 * three things a reader needs before they can check it.
 */
export function competitionSourceLine(
  input: Pick<BandRivalsInput, 'city' | 'lo' | 'hi' | 'asOfIso'>,
): string {
  // formatDate, not a UTC slice. The slice takes the UTC day and every other
  // date on the document takes the Pacific one, which is how the cover came to
  // print two different dates for one timestamp (CLAUDE.md §0).
  const formatted = input.asOfIso ? formatDate(input.asOfIso) : ''
  const when = formatted && formatted !== '—' ? ` as of ${formatted}` : ''
  return `Homes for sale and under contract in ${input.city} between ${usd(input.lo)} and ${usd(
    input.hi,
  )}, from the Oregon Data Share MLS${when}.`
}

/**
 * A stored sentence, with any pointer at "this map" rewritten.
 *
 * The competition and the did-not-sell chapters print on their own pages and
 * the map is two sheets earlier, so "so it is not on this map" pointed at a
 * map that page does not have (62475 Woodsman, 2382 Jackson, reader review
 * 2026-10-08). Rows built before the wording changed carry the old clause and
 * re-render at serve, so the render rewrites it. Nothing else in the sentence
 * moves: the counts and places it states are the stored ones.
 */
export function withoutMapPointer(sentence: string): string {
  return sentence
    .replace(/,\s*so it is not on (?:this|the) map\./gi, ', so it is not compared here.')
    .replace(/,\s*so none (?:are|is) on (?:this|the) map\./gi, ', so they are not compared here.')
}

/**
 * The source note when the competition chapter draws no home at all.
 *
 * "Homes for sale and under contract in Shevlin West between $1,418,000 and
 * $1,734,000, from the Oregon Data Share MLS as of Oct 7, 2026." printed alone
 * under the chapter's sentence reads as the caption of a table or map, and
 * with nothing drawn it promised one (62475 Woodsman, reader review
 * 2026-10-08). The same trace still prints, because it is what the count of
 * none was taken over (the area, the band, the source and the day), marked as
 * the source of that count rather than as a caption.
 */
export function competitionEmptySourceLine(sourceLine: string | null | undefined): string {
  const line = (sourceLine ?? '').trim()
  if (!line) return ''
  if (/^source:/i.test(line)) return line
  return `Source: ${line.charAt(0).toLowerCase()}${line.slice(1)}`
}

export function renderBandRivalsHtml(input: BandRivalsInput): string {
  return `
  <h2 class="section">${esc(competitionHeading(input.recommendedList ?? input.subject?.recommendedList))}</h2>
  ${competitionBody(input)}`
}

export function renderBandRivalsSceneHtml(input: BandRivalsInput): string {
  return `
  <section class="sc sc-cream pack" id="competition">
    <div class="in wide">
      <div class="kick r">At this price</div>
      <h2 class="h r">${esc(competitionHeading(input.recommendedList ?? input.subject?.recommendedList))}</h2>
      <div class="r">${competitionBody(input)}</div>
    </div>
  </section>`
}

/**
 * THE COMPETITION IS THE NEIGHBOURHOOD, NEVER THE CITY.
 *
 * Matt 2026-09-08: "Same thing with the competition: we want to limit it to the
 * neighborhood or community. Unless it's not part of that, then we'll have to
 * use a radius."
 *
 * `getCmaBandInventory` reads City + price band + sub type, so a seller in Old
 * Bend was shown the four nearest homes out of every listing in Bend inside
 * their band, and the counts in the first sentence — "34 homes are for sale
 * between $356,000 and $435,000" — were citywide counts under a chapter about
 * their street. `buildBandRivalSet` takes the area the document already
 * resolved and states the counts inside it.
 */

/** ±10% of the recommended list — the band the competition chapter starts with. */
export const BAND_HALF_WIDTH_PCT = 0.1

/**
 * When ±10% holds fewer than five homes that pass the sales rules, the
 * chapter opens the band in the sales area only, never a wider place, and
 * never past the last step. It stops at the first step that holds five.
 * Matt 2026-10-06; area reversed 2026-10-07.
 */
export const COMPETITION_BAND_STEPS = [0.1, 0.15, 0.2, 0.25] as const

/** Fitting homes to stop on. The priced set has the same five as its floor. */
export const COMPETITION_GOOD_COUNT = 5

/** The chapter draws this many nearest homes when a band holds more. */
export const COMPETITION_SHOWN_CAP = 8

export function bandAroundListAt(
  recommendedList: number,
  halfWidth: number,
): { lo: number; hi: number } | null {
  if (!Number.isFinite(recommendedList) || recommendedList <= 0) return null
  if (!Number.isFinite(halfWidth) || halfWidth <= 0 || halfWidth >= 1) return null
  return {
    lo: Math.round((recommendedList * (1 - halfWidth)) / 1000) * 1000,
    hi: Math.round((recommendedList * (1 + halfWidth)) / 1000) * 1000,
  }
}

export function bandAroundList(recommendedList: number): { lo: number; hi: number } | null {
  return bandAroundListAt(recommendedList, BAND_HALF_WIDTH_PCT)
}

/**
 * The first price step that holds five fitting homes. When none does, the
 * step that holds the most. A tie keeps the tighter step.
 */
export function chooseCompetitionBand<T extends { fitting: readonly unknown[] }>(
  steps: readonly T[],
): T | null {
  if (steps.length === 0) return null
  for (const step of steps) {
    if (step.fitting.length >= COMPETITION_GOOD_COUNT) return step
  }
  return steps.reduce((best, step) => (step.fitting.length > best.fitting.length ? step : best))
}

export type CmaBandRivalSet = {
  /** The area these counts are taken over — the ring that won the ladder below. */
  area: CompArea
  lo: number
  hi: number
  /** Listings INSIDE the area, not inside the city. */
  activeCount: number
  pendingCount: number
  rivals: CmaBandRival[]
  sentence: string
  source: string
  /** The starting ring's radius, when the winner widened past it. Always null since 2026-10-07: the letter has one ring. */
  widenedFrom: number | null
  /** Every ring radius (miles) tried, in order. Always empty since 2026-10-07: the letter has one ring. */
  ringsTried: number[]
  /** Homes in the band and the area that did not pass the sales rules. They are counted, never drawn. */
  unlikeCount?: number
  /**
   * Those homes, each with its ask and the refusal the fit returned
   * (lib/cma/unlike-reason.ts), so the sentence names the reason that is true
   * of them. Absent on rows built before 2026-10-08.
   */
  unlike?: CmaUnlikeHome[]
  /** True when the band opened to its last step and still holds fewer than five fitting homes. */
  shortOfFive?: boolean
  /** What lo..hi is centered on and how wide it opened; the letter states it (lib/cma/competition-band-basis.ts). */
  bandBasis?: import('@/lib/cma/competition-band-basis').CompetitionBandBasis | null
}

/**
 * How a "nearest N" competition sentence opens. One definition, so the render
 * (lib/cma/opinion-pages.ts) can tell whether a stored sentence's N is the
 * number of homes the table draws for sale.
 */
export function nearestOpening(n: number): string {
  return `The nearest ${countWord(n)}`
}

/**
 * "2 homes like yours are for sale in Rooster Rock and Madison Park between
 * $494,000 and $604,000. 1 is under contract." Every count is a home that
 * passed the sales rules inside the sales area (Matt 2026-10-07, rule 24).
 * When the area holds none, or only unlike homes, the sentence says so
 * plainly instead of reaching further; when the band opened and still fell
 * short, it says nothing from outside was added. A home kept one room apart
 * on the subject's own ground is named with the room, and no dollar value.
 */
export function competitionAreaSentence(input: {
  area: CompArea
  lo: number
  hi: number
  activeCount: number
  pendingCount: number
  shown: number
  /** True when the homes drawn were narrowed to ones like the subject. */
  likeYours?: boolean
  /** Kept on the signature for older callers. Ignored: the letter has one ring. */
  widenedFrom?: number | null
  /** Homes in the band and the area that did not pass the rules. */
  unlikeCount?: number
  /** Those homes with the refusal the fit returned for each (lib/cma/unlike-reason.ts). */
  unlike?: readonly CmaUnlikeHome[] | null
  /** True when the band opened to its last step and still holds fewer than five. */
  shortOfFive?: boolean
  /** The homes drawn: the one-room disclosure, and how many of them are for sale. */
  rivals?: ReadonlyArray<{
    address: string
    status?: 'Active' | 'Pending'
    roomDifference?: Array<'beds' | 'baths'> | null
    beds?: number | null
    baths?: number | null
  }>
  /** The subject's counts, so a two-room gap is named as two. */
  subject?: { beds?: number | null; baths?: number | null } | null
}): string {
  const where = compAreaIn(input.area)
  const whereOr = compAreaIn(input.area, { negative: true })
  const band = `between ${usd(input.lo)} and ${usd(input.hi)}`
  const tail = input.shortOfFive
    ? ` Nothing from outside ${compAreaPhrase(input.area)} was added to make up the number.`
    : ''
  const noted = roomNotedSentence(input.rivals ?? [], input.subject)
  const rooms = noted ? ` ${noted}` : ''
  const unlike = input.unlikeCount ?? 0
  if (input.activeCount === 0 && input.pendingCount === 0) {
    if (unlike === 0) {
      return `No home ${whereOr} is for sale ${band}, and none is under contract.${tail}`
    }
    // One unlike home is "it", never "none" (Matt 2026-10-07 review). The
    // reason is the one the fit returned for each home, never a list of four
    // ("bedrooms, bathrooms, size or age") a reader takes as all true (reader
    // review 2026-10-08).
    const listed =
      unlike === 1
        ? 'One other home is listed there in that range.'
        : `${countWord(unlike, true)} other homes are listed there in that range.`
    const described = input.unlike && input.unlike.length === unlike ? input.unlike : null
    return `No home like yours ${whereOr} is for sale or under contract ${band}. ${listed} ${unlikeReasonSentence(
      described,
      unlike,
    )}${tail}`
  }
  if (input.activeCount === 0) {
    return `No home like yours ${whereOr} is for sale ${band}, but ${countWord(input.pendingCount)} ${
      input.pendingCount === 1 ? 'is' : 'are'
    } under contract.${tail}${rooms}`
  }
  // "The nearest N" counts the homes drawn FOR SALE, never the drawn homes
  // under contract as well: a table of eight for sale and two under contract
  // is "the nearest eight", not "the nearest ten" (rule 17). It is written
  // only when the area holds more for sale than the table draws.
  const drawnActive = input.rivals ? input.rivals.filter((r) => r.status === 'Active').length : null
  const nearest =
    drawnActive != null
      ? drawnActive > 0 && drawnActive < input.activeCount
      : input.shown > 0 && input.shown < input.activeCount + input.pendingCount
  if (nearest) {
    // The count in the sentence is the count of cards below it. A total the
    // chapter does not draw is not a number the letter may state.
    const n = drawnActive ?? input.shown
    const like = input.likeYours ? ' like yours' : ''
    const verb = n === 1 ? 'is' : 'are'
    return `${nearestOpening(n)}${like} ${verb} for sale ${where} ${band}. ${underContractClause(input.pendingCount, {
      afterForSale: true,
      like,
    })}${tail}${rooms}`
  }
  return `${int(input.activeCount)} home${
    input.activeCount === 1 ? ' like yours is' : 's like yours are'
  } for sale ${where} ${band}. ${underContractClause(input.pendingCount, { afterForSale: true, like: ' like yours' })}${tail}${rooms}`
}

/** The §0 trace for the two counts: the area, the band, the source and the day. */
export function competitionAreaSourceLine(input: {
  area: CompArea
  lo: number
  hi: number
  asOfIso?: string | null
}): string {
  const formatted = input.asOfIso ? formatDate(input.asOfIso) : ''
  const when = formatted && formatted !== '—' ? ` as of ${formatted}` : ''
  const where =
    input.area.kind === 'radius' ? compAreaPhrase(input.area) : `in ${compAreaPhrase(input.area)}`
  return `Homes for sale and under contract ${where} between ${usd(input.lo)} and ${usd(
    input.hi,
  )}, from the Oregon Data Share MLS${when}.`
}

function withoutRemarks(rival: CmaBandRival): CmaBandRival {
  const out = { ...rival }
  delete out.publicRemarks
  return out
}

export function buildBandRivalSet(input: {
  area: CompArea
  lo: number
  hi: number
  activeCount: number
  pendingCount: number
  rivals: readonly CmaBandRival[]
  subject?: (Partial<SameAreaSubject> & { latitude: number | null; longitude: number | null }) | null
  cap?: number
  asOfIso?: string | null
  /** Kept on the signature for older callers. Always null from the one-ring path. */
  widenedFrom?: number | null
  /** Kept on the signature for older callers. Always empty from the one-ring path. */
  ringsTried?: number[]
  /** Homes in the band and the area that did not pass the sales rules. */
  unlikeCount?: number
  /** Those homes with the refusal the fit returned for each (lib/cma/unlike-reason.ts). */
  unlike?: CmaUnlikeHome[]
  /** True when the band opened to its last step and still holds fewer than five. */
  shortOfFive?: boolean
}): CmaBandRivalSet {
  // The draw runs the identical fit the assembly counted with: the same area,
  // so the same year band (sameAreaAgeYears: no year test for a neighborhood
  // or community, 30 years for a radius inside ten miles, 25 for plats). With
  // no area the fit fell back to the 25-year plat band, and a home the
  // sentence counted fell out of the table and the map (rule 17).
  // The remarks did their work in the fit; the stored set does not carry them.
  const rivals = pickBandRivals(input.rivals, input.subject ?? null, input.cap ?? BAND_RIVAL_CAP, input.area).map(
    withoutRemarks,
  )
  // Every drawn home passed the rules, so a drawn set is like yours.
  const likeYours = rivals.length > 0
  const widenedFrom = input.widenedFrom ?? null
  return {
    area: input.area,
    lo: input.lo,
    hi: input.hi,
    activeCount: input.activeCount,
    pendingCount: input.pendingCount,
    rivals,
    sentence: competitionAreaSentence({
      area: input.area,
      lo: input.lo,
      hi: input.hi,
      activeCount: input.activeCount,
      pendingCount: input.pendingCount,
      shown: rivals.length,
      likeYours,
      widenedFrom,
      unlikeCount: input.unlikeCount,
      unlike: input.unlike ?? null,
      shortOfFive: input.shortOfFive,
      rivals,
      subject: input.subject ?? null,
    }),
    source: competitionAreaSourceLine({
      area: input.area,
      lo: input.lo,
      hi: input.hi,
      asOfIso: input.asOfIso ?? null,
    }),
    widenedFrom,
    ringsTried: input.ringsTried ?? [],
    unlikeCount: input.unlikeCount,
    ...(input.unlike ? { unlike: input.unlike } : {}),
    shortOfFive: input.shortOfFive,
  }
}

/**
 * The competition read came back empty (no inventory, or no ring to query).
 * The chapter still says so. It does not disappear, and it does not fall
 * back to every listing in the city.
 */
export function emptyCompetitionSet(args: {
  rings: readonly CompArea[]
  compArea: CompArea
  lo: number
  hi: number
}): CmaBandRivalSet {
  const area = args.rings[0] && args.rings[0].kind !== 'city' ? args.rings[0] : null
  const lo = `$${args.lo.toLocaleString('en-US')}`
  const hi = `$${args.hi.toLocaleString('en-US')}`
  const sentence = area
    ? `No home ${compAreaIn(area)} is for sale between ${lo} and ${hi}, and none is under contract. The search did not cover the whole city.`
    : `This home has no map point, so no competition was pulled. The search did not cover the whole city.`
  return {
    area: area ?? {
      kind: 'radius',
      names: [],
      radiusMiles: null,
      centre: args.compArea.centre,
      source: 'competition: no coordinates, city not used',
      sentence: 'The homes closest to yours.',
    },
    lo: args.lo,
    hi: args.hi,
    activeCount: 0,
    pendingCount: 0,
    rivals: [],
    sentence,
    source: 'Competition ladder returned no listings inside the cap.',
    widenedFrom: null,
    ringsTried: args.rings.flatMap((r) => (r.kind === 'radius' && r.radiusMiles != null ? [r.radiusMiles] : [])),
  }
}

/** Minimum active-or-pending count a rural competition ring must hold before the search stops widening (Matt 2026-09-08). */
export const COMPETITION_RING_MIN = 3

export type CompetitionRingPick<T> = {
  /** The ring that won — the first to hold three, or the widest ring tried. */
  area: CompArea
  /** Every ring radius (miles) tried, in order. Empty for a mapped boundary or a no-coordinate subject — there was only ever one ring. */
  ringsTried: number[]
  /** The starting ring's radius, when the winner is a wider ring than that. Null otherwise. */
  widenedFrom: number | null
  activeRows: T[]
  pendingRows: T[]
  activeCount: number
  pendingCount: number
}

/**
 * THE RURAL RING LADDER (Matt 2026-09-08): "definitely tighter on rural
 * homes, make the best decision." `resolveCompetitionArea` (lib/pricing/
 * comp-area.ts) returns the ring order to try — one ring for a mapped
 * boundary or a no-coordinate subject, otherwise 5 miles, then 10, then the
 * comp search's own reach. This walks that order and stops at the first ring
 * that holds three active-or-pending homes, never past the widest ring.
 *
 * `activeRows`/`pendingRows` are read ONCE, at the widest ring
 * (`getCmaAreaBandInventory` already exact-tests them against it), so this
 * walks rows already in hand rather than re-querying per ring — the same
 * shape as the expired-peer window ladder in lib/cma/market-status.ts
 * (`buildExpiredPeerSet`): "The rows come from ONE read at the widest step
 * ... so the ladder is a walk, not six queries." A ring narrower than the
 * widest is always a radius (only the sole, unwidened ring can be a mapped
 * boundary or a city), so re-testing membership only ever needs lat/lng.
 *
 * Since 2026-10-07 the letter has one ring and this function is a
 * pass-through kept for the rural fixtures and the stored widenedFrom and
 * ringsTried fields; assemble-competition.ts no longer calls it.
 */
export function pickCompetitionRing<
  T extends {
    Latitude?: number | null
    Longitude?: number | null
    SubdivisionName?: string | null
    City?: string | null
    plat_slug?: string | null
  },
>(
  input: {
    rings: readonly CompArea[]
    activeRows: readonly T[]
    pendingRows: readonly T[]
    /** Stop once a ring holds this many. Defaults to three. */
    min?: number
  },
): CompetitionRingPick<T> {
  const rings = input.rings
  const first = rings[0] ?? null
  const ringsTried: number[] = []
  const geo = (r: T) => ({
    latitude: r.Latitude ?? null,
    longitude: r.Longitude ?? null,
    subdivision: r.SubdivisionName ?? null,
    city: r.City ?? null,
    platSlug: r.plat_slug,
  })
  for (let i = 0; i < rings.length; i++) {
    const ring = rings[i]!
    const isLast = i === rings.length - 1
    if (ring.kind === 'radius' && ring.radiusMiles != null) ringsTried.push(ring.radiusMiles)
    // The widest ring's rows are already exact-tested by the reader that
    // fetched them; re-testing costs nothing extra to trust but nothing to
    // skip either, EXCEPT that the widest ring may be a mapped boundary or a
    // city, whose exact test needs fields (subdivision/city) this row shape
    // does not carry. Only narrower rings — always a radius — need the
    // re-test, so the last ring is taken as-is.
    const activeIn = isLast ? [...input.activeRows] : input.activeRows.filter((r) => compAreaContains(ring, geo(r)))
    const pendingIn = isLast
      ? [...input.pendingRows]
      : input.pendingRows.filter((r) => compAreaContains(ring, geo(r)))
    const need = input.min ?? COMPETITION_RING_MIN
    if (activeIn.length + pendingIn.length >= need || isLast) {
      const widenedFrom =
        i > 0 && first && first.kind === 'radius' && first.radiusMiles !== ring.radiusMiles
          ? first.radiusMiles
          : null
      return {
        area: ring,
        ringsTried,
        widenedFrom,
        activeRows: activeIn,
        pendingRows: pendingIn,
        activeCount: activeIn.length,
        pendingCount: pendingIn.length,
      }
    }
  }
  // Unreachable: the loop above always returns on its last iteration. Kept
  // for type-safety and to fail closed (the whole inventory) rather than throw.
  return {
    area: rings[rings.length - 1]!,
    ringsTried,
    widenedFrom: null,
    activeRows: [...input.activeRows],
    pendingRows: [...input.pendingRows],
    activeCount: input.activeRows.length,
    pendingCount: input.pendingRows.length,
  }
}

/** An MLS row as the band reads carry it. Structural so this file stays server-free. */
export type BandInventoryRow = BandStreetRow & {
  ListingKey: string
  ListPrice: number | null
  OriginalListPrice?: number | null
  DaysOnMarket: number | null
  OnMarketDate: string | null
  PhotoURL: string | null
  Latitude: number | null
  Longitude: number | null
  BedroomsTotal?: number | null
  BathroomsTotal?: number | null
  baths_full?: number | null
  baths_half?: number | null
  TotalLivingAreaSqFt?: number | null
  year_built?: number | null
  lot_size_acres?: number | null
  property_sub_type?: string | null
  SubdivisionName?: string | null
  City?: string | null
  public_remarks?: string | null
  /** The day it went under contract, on a Pending row. */
  pending_timestamp?: string | null
  /** MLS days from its OnMarketDate to Pending, on a Pending row. */
  days_to_pending?: number | null
  /** The recorded plat polygon the area read put the row in (lib/data/cma/bandInventory.ts). */
  plat_slug?: string | null
  /** The first day it was ever on the market (Active, never Coming Soon): earlier than OnMarketDate when it came back. */
  original_on_market_timestamp?: string | null
}

/** A blank MLS field is unknown, never zero: Number(null) is 0, and a null bed count read as 0 beds. */
function finiteOrNull(v: unknown): number | null {
  if (v == null || (typeof v === 'string' && v.trim() === '')) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/**
 * Whole days since a listing went on market: calendar days from its Pacific
 * on-market day to today's (liveListingDays, the count the subject's own live
 * listing prints). Null when the date is unusable. Date arithmetic, not the
 * "DaysOnMarket" column: docs/DATABASE_FOR_AI_AGENTS.md warns that column is
 * list-to-close. The competition assembly reads this same helper so its day
 * figures cannot drift from the cards.
 */
export function daysSinceOnMarket(onMarketDate: string | null | undefined): number | null {
  if (!onMarketDate) return null
  return liveListingDays(onMarketDate)
}

/**
 * A competitor's last stretch on the market (Matt 2026-10-08): it began at
 * OnMarketDate, the day its days count from, and its first ask is the ask in
 * effect at that moment. Without the ask history a home that came back has an
 * unknown first ask unless its ask never moved.
 */
export function bandRowStretch(
  row: Pick<BandInventoryRow, 'OnMarketDate' | 'OriginalListPrice' | 'ListPrice' | 'original_on_market_timestamp'>,
  askChanges: readonly AskChange[] = [],
): ListingStretch | null {
  return listingStretch({
    startAt: row.OnMarketDate,
    firstOnMarketAt: row.original_on_market_timestamp ?? null,
    askChanges,
    openingAsk: finiteOrNull(row.OriginalListPrice),
    currentAsk: finiteOrNull(row.ListPrice),
  })
}

/** The rival with its stretch, and the history line read off that stretch. */
export function withRivalStretch(rival: CmaBandRival, stretch: ListingStretch | null): CmaBandRival {
  if (!stretch) return rival
  return {
    ...rival,
    stretch,
    listingHistoryLine: buildListingHistoryLine({
      listPrice: rival.listPrice,
      originalListPrice: stretch.firstAsk,
      status: rival.status,
      onMarketDate: rival.onMarketDate ?? null,
      daysOnMarket: rival.daysOnMarket,
    }),
  }
}

/** One MLS row as a named competitor. Null when it has no address or no ask. */
export function bandRowToRival(row: BandInventoryRow, status: 'Active' | 'Pending'): CmaBandRival | null {
  const address = rivalAddress(row)
  const listPrice = Number(row.ListPrice)
  if (!address || !Number.isFinite(listPrice) || listPrice <= 0) return null
  const originalListPrice = finiteOrNull(row.OriginalListPrice)
  // A HOME UNDER CONTRACT COUNTS TO ITS CONTRACT (reader review 2026-10-08).
  // 2820 Aldrich listed Aug 24 and went Pending Sep 11, 18 days; the letter
  // printed 44, the days since it listed. Its days are Active to Pending, as
  // calendar days between the Pacific days, and it is dated the day it went
  // under contract.
  const offer =
    status === 'Pending'
      ? offerRun({
          onMarketDate: row.OnMarketDate,
          pendingAt: row.pending_timestamp ?? null,
          mlsDaysToPending: finiteOrNull(row.days_to_pending),
        })
      : null
  const pendingDate = offer?.to ?? null
  const daysOnMarket =
    status === 'Pending'
      ? (offer?.days ?? null)
      : (daysSinceOnMarket(row.OnMarketDate) ?? finiteOrNull(row.DaysOnMarket))
  const rival: CmaBandRival = {
    listingKey: row.ListingKey,
    address,
    listPrice,
    status,
    daysOnMarket,
    ...(pendingDate ? { pendingDate } : {}),
    photoUrl: row.PhotoURL,
    latitude: row.Latitude,
    longitude: row.Longitude,
    beds: finiteOrNull(row.BedroomsTotal),
    baths: finiteOrNull(row.BathroomsTotal),
    bathsFull: finiteOrNull(row.baths_full),
    bathsHalf: finiteOrNull(row.baths_half),
    sqft: finiteOrNull(row.TotalLivingAreaSqFt),
    yearBuilt: finiteOrNull(row.year_built),
    lotAcres: finiteOrNull(row.lot_size_acres),
    propertySubType: row.property_sub_type ?? null,
    subdivision: row.SubdivisionName ?? null,
    originalListPrice,
    onMarketDate: row.OnMarketDate,
    listingHistoryLine: buildListingHistoryLine({
      listPrice,
      originalListPrice,
      status,
      onMarketDate: row.OnMarketDate,
      daysOnMarket,
    }),
    // Only while the build fits the home (rule 24's multi-unit and ADU walls).
    ...(row.public_remarks != null ? { publicRemarks: row.public_remarks } : {}),
    // The polygon the area read placed it in, so every later area test (the
    // fit, the ring pick, the render) reads the polygon, not the MLS spelling.
    // Always stored, null when the read found none, so a later render can
    // tell "no plat" from "the field was never written" (Matt 2026-10-09).
    platSlug: row.plat_slug ?? null,
  }
  // The last stretch off the row alone; the competition read adds the ask
  // history for the homes it prints (assemble-competition.ts).
  return withRivalStretch(rival, bandRowStretch(row))
}
