/**
 * Named homes competing at the recommended list. Counts stay on
 * CmaBandPosition. This module names the houses and draws the list.
 */

import { UNADDRESSED_DOC_LINKS, escapeHtml, int, sparkPhotoAt, usd } from '@/lib/cma/render-blocks'
import { trackedDocLink, type TrackedDocLinkCtx } from '@/lib/cma/doc-links'
import { formatDate } from '@/lib/format/date'
import { priceHistoryLineCompactHtml, pricePathFromListing } from '@/lib/cma/price-path'
import { listingHistoryLine as buildListingHistoryLine } from '@/lib/cma/listing-history-line'
import { compAreaContains, compAreaIn, compAreaPhrase, milesPhrase, type CompArea } from '@/lib/pricing/comp-area'
import { countWord } from '@/lib/pricing/estimate'

const esc = escapeHtml

export const BAND_RIVAL_CAP = 4

export type CmaBandRival = {
  listingKey: string
  address: string
  listPrice: number
  status: 'Active' | 'Pending'
  daysOnMarket: number | null
  photoUrl: string | null
  latitude: number | null
  longitude: number | null
  beds?: number | null
  baths?: number | null
  sqft?: number | null
  yearBuilt?: number | null
  lotAcres?: number | null
  propertySubType?: string | null
  originalListPrice?: number | null
  onMarketDate?: string | null
  listingHistoryLine?: string | null
}

export type CmaBandSubject = {
  beds: number | null
  baths: number | null
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
  return [row.StreetNumber, row.StreetName]
    .map((p) => (p ?? '').trim())
    .filter(Boolean)
    .join(' ')
}

function dist2(
  rival: CmaBandRival,
  lat: number,
  lng: number,
): number {
  if (rival.latitude == null || rival.longitude == null) return Number.POSITIVE_INFINITY
  const dLat = rival.latitude - lat
  const dLng = rival.longitude - lng
  return dLat * dLat + dLng * dLng
}

export function rivalFitsSubject(
  r: CmaBandRival,
  subject?: { beds?: number | null; sqft?: number | null } | null,
): boolean {
  if (!subject) return true
  if (subject.beds != null && r.beds != null && r.beds !== subject.beds) return false
  if (subject.sqft != null && subject.sqft > 0 && r.sqft != null && r.sqft > 0) {
    if (Math.abs(r.sqft - subject.sqft) / subject.sqft > 0.25) return false
  }
  return true
}

export function pickBandRivals(
  rivals: readonly CmaBandRival[],
  subject?: {
    latitude: number | null
    longitude: number | null
    beds?: number | null
    sqft?: number | null
  } | null,
  cap = BAND_RIVAL_CAP,
): CmaBandRival[] {
  const named = rivals.filter((r) => r.address.trim() && r.listPrice > 0)
  const similar = named.filter((r) => rivalFitsSubject(r, subject))
  const pool = similar.length > 0 ? similar : named
  const slat = subject?.latitude
  const slng = subject?.longitude
  const ranked =
    slat != null && slng != null && Number.isFinite(slat) && Number.isFinite(slng)
      ? [...pool].sort((a, b) => dist2(a, slat, slng) - dist2(b, slat, slng))
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

export function rivalFactsLine(r: CmaBandRival): string | null {
  return joinFacts([
    r.beds != null ? `${int(r.beds)} bd` : null,
    r.baths != null ? `${r.baths % 1 === 0 ? int(r.baths) : r.baths.toFixed(1)} ba` : null,
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
  if (r.baths != null && subject.baths != null && r.baths !== subject.baths) {
    const d = r.baths - subject.baths
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
  const facts = joinFacts([
    r.sqft != null && r.sqft > 0 ? `${int(r.sqft)} sqft` : null,
    r.beds != null ? `${int(r.beds)} bd` : null,
    r.baths != null ? `${r.baths % 1 === 0 ? int(r.baths) : r.baths.toFixed(1)} ba` : null,
    r.daysOnMarket != null && r.daysOnMarket >= 0
      ? `${int(r.daysOnMarket)} ${r.daysOnMarket === 1 ? 'day' : 'days'} on market`
      : null,
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
      originalListPrice: r.originalListPrice ?? null,
      onMarketDate: r.onMarketDate ?? null,
      daysOnMarket: r.daysOnMarket,
      status: r.status,
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

/** "27 homes are for sale between $350,000 and $428,000. 14 are under contract." */
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
    input.pendingCount > 0
      ? `${int(input.pendingCount)} ${input.pendingCount === 1 ? 'is' : 'are'} under contract.`
      : 'None are under contract right now.',
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

export function competitorCutLine(rivals: readonly CmaBandRival[]): string | null {
  const known = rivals.filter(
    (r) =>
      r.listPrice > 0 &&
      r.originalListPrice != null &&
      Number.isFinite(r.originalListPrice) &&
      r.originalListPrice > 0,
  )
  if (known.length === 0) return null
  const cuts = known
    .filter((r) => r.originalListPrice! > r.listPrice)
    .map((r) => ({
      dollars: r.originalListPrice! - r.listPrice,
      pct: ((r.originalListPrice! - r.listPrice) / r.originalListPrice!) * 100,
    }))
  const shown = known.length
  if (cuts.length === 0) {
    return shown === 1
      ? 'The one home below has not come down from its opening price.'
      : `None of the ${int(shown)} homes below has come down from its opening price.`
  }
  const cut = `a median cut of ${usd(Math.round(median(cuts.map((c) => c.dollars))))}, or ${median(
    cuts.map((c) => c.pct),
  ).toFixed(1)} percent`
  if (shown === 1) return `The one home below has already come down, ${cut}.`
  return `${int(cuts.length)} of the ${int(shown)} homes below ${
    cuts.length === 1 ? 'has' : 'have'
  } already come down, ${cut}.`
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

/** Tip Ready P0: cover already carries the recommend — do not bang it in the title. */
export function competitionHeading(_recommendedList?: number | null): string {
  return 'Who you would compete with at this price'
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

/** ±10% of the recommended list — the band the competition chapter has always used. */
export const BAND_HALF_WIDTH_PCT = 0.1

export function bandAroundList(recommendedList: number): { lo: number; hi: number } | null {
  if (!Number.isFinite(recommendedList) || recommendedList <= 0) return null
  return {
    lo: Math.round((recommendedList * (1 - BAND_HALF_WIDTH_PCT)) / 1000) * 1000,
    hi: Math.round((recommendedList * (1 + BAND_HALF_WIDTH_PCT)) / 1000) * 1000,
  }
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
  /** The starting ring's radius, when the winner widened past it. Null for a mapped boundary, a no-coordinate subject, or a ring that already held three. */
  widenedFrom: number | null
  /** Every ring radius (miles) tried, in order. Empty for a mapped boundary or a no-coordinate subject. */
  ringsTried: number[]
}

/**
 * "27 homes are for sale in Old Bend between $350,000 and $428,000. 14 are
 * under contract." A rural ring that had to widen past its starting five
 * miles says so, in the same sentence, so the seller reads why the map got
 * bigger rather than just a wider number (Matt 2026-09-08).
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
  /** The starting ring's radius, when the winning ring widened past it. Null otherwise. */
  widenedFrom?: number | null
}): string {
  const where = compAreaIn(input.area)
  const widenedNote =
    input.widenedFrom != null &&
    input.area.kind === 'radius' &&
    input.area.radiusMiles != null &&
    input.area.radiusMiles > input.widenedFrom
      ? ` We widened from ${milesPhrase(input.widenedFrom)} to find three.`
      : ''
  if (input.activeCount === 0 && input.pendingCount === 0) {
    return `No home ${where} is for sale between ${usd(input.lo)} and ${usd(
      input.hi,
    )}, and none is under contract.${widenedNote}`
  }
  const bits = [
    `${int(input.activeCount)} home${input.activeCount === 1 ? ' is' : 's are'} for sale ${where} between ${usd(
      input.lo,
    )} and ${usd(input.hi)}.`,
    input.pendingCount > 0
      ? `${int(input.pendingCount)} ${input.pendingCount === 1 ? 'is' : 'are'} under contract.`
      : 'None are under contract right now.',
  ]
  if (widenedNote) bits.push(widenedNote.trim())
  if (input.shown > 0 && input.shown < input.activeCount + input.pendingCount) {
    // "like yours" when the pick narrowed: the counts above are every home in
    // the band, the cards below are the ones at the subject's bed count and
    // within 25% of its size. Without the qualifier the sentence says the
    // nearest of one set and then draws another (§0).
    bits.push(
      `The nearest ${countWord(input.shown)}${input.likeYours ? ' like yours' : ''} ${
        input.shown === 1 ? 'is' : 'are'
      } below.`,
    )
  }
  return bits.join(' ')
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

export function buildBandRivalSet(input: {
  area: CompArea
  lo: number
  hi: number
  activeCount: number
  pendingCount: number
  rivals: readonly CmaBandRival[]
  subject?: {
    latitude: number | null
    longitude: number | null
    beds?: number | null
    sqft?: number | null
  } | null
  cap?: number
  asOfIso?: string | null
  /** The starting ring's radius, when `area` widened past it. Null otherwise — see `pickCompetitionRing`. */
  widenedFrom?: number | null
  /** Every ring radius (miles) the ladder tried, in order. Empty for a mapped boundary or a no-coordinate subject. */
  ringsTried?: number[]
}): CmaBandRivalSet {
  const rivals = pickBandRivals(input.rivals, input.subject ?? null, input.cap ?? BAND_RIVAL_CAP)
  const likeYours = input.rivals.some((r) => rivalFitsSubject(r, input.subject ?? null))
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
    }),
    source: competitionAreaSourceLine({
      area: input.area,
      lo: input.lo,
      hi: input.hi,
      asOfIso: input.asOfIso ?? null,
    }),
    widenedFrom,
    ringsTried: input.ringsTried ?? [],
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
 */
export function pickCompetitionRing<T extends { Latitude?: number | null; Longitude?: number | null }>(
  input: {
    rings: readonly CompArea[]
    activeRows: readonly T[]
    pendingRows: readonly T[]
  },
): CompetitionRingPick<T> {
  const rings = input.rings
  const first = rings[0] ?? null
  const ringsTried: number[] = []
  const geo = (r: T) => ({
    latitude: r.Latitude ?? null,
    longitude: r.Longitude ?? null,
    subdivision: null,
    city: null,
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
    if (activeIn.length + pendingIn.length >= COMPETITION_RING_MIN || isLast) {
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
  TotalLivingAreaSqFt?: number | null
  year_built?: number | null
  lot_size_acres?: number | null
  property_sub_type?: string | null
}

function finiteOrNull(v: unknown): number | null {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** Whole days since a listing went on market. Null when the date is unusable. */
function daysSinceOnMarket(onMarketDate: string | null | undefined): number | null {
  if (!onMarketDate) return null
  const then = new Date(onMarketDate)
  if (Number.isNaN(then.getTime())) return null
  const days = Math.floor((Date.now() - then.getTime()) / 86_400_000)
  return days >= 0 ? days : null
}

/** One MLS row as a named competitor. Null when it has no address or no ask. */
export function bandRowToRival(row: BandInventoryRow, status: 'Active' | 'Pending'): CmaBandRival | null {
  const address = rivalAddress(row)
  const listPrice = Number(row.ListPrice)
  if (!address || !Number.isFinite(listPrice) || listPrice <= 0) return null
  const originalListPrice = finiteOrNull(row.OriginalListPrice)
  const daysOnMarket = daysSinceOnMarket(row.OnMarketDate) ?? finiteOrNull(row.DaysOnMarket)
  return {
    listingKey: row.ListingKey,
    address,
    listPrice,
    status,
    daysOnMarket,
    photoUrl: row.PhotoURL,
    latitude: row.Latitude,
    longitude: row.Longitude,
    beds: finiteOrNull(row.BedroomsTotal),
    baths: finiteOrNull(row.BathroomsTotal),
    sqft: finiteOrNull(row.TotalLivingAreaSqFt),
    yearBuilt: finiteOrNull(row.year_built),
    lotAcres: finiteOrNull(row.lot_size_acres),
    propertySubType: row.property_sub_type ?? null,
    originalListPrice,
    onMarketDate: row.OnMarketDate,
    listingHistoryLine: buildListingHistoryLine({
      listPrice,
      originalListPrice,
      status,
      onMarketDate: row.OnMarketDate,
      daysOnMarket,
    }),
  }
}
