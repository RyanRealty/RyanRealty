/**
 * Named homes competing at the recommended list. Counts stay on
 * CmaBandPosition. This module names the houses and draws the list.
 */

import { escapeHtml, int, sparkPhotoAt, usd } from '@/lib/cma/render-blocks'
import { trackedDocLink, type TrackedDocLinkCtx } from '@/lib/cma/doc-links'

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

function rivalFitsSubject(
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
    ctx ?? {},
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
  return `<article class="rival-card">
    ${img}
    <div class="rival-body">
      <a class="rival-addr" href="${esc(href)}" data-rr-track="cma-competition">${esc(r.address)}</a>
      <div class="rival-ask">${usd(r.listPrice)}</div>
      ${facts ? `<div class="rival-facts">${esc(facts)}</div>` : ''}
      ${vs ? `<div class="rival-meta">${esc(vs)}</div>` : ''}
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
}

/** "Who you would compete with at $389,000" — the chapter title. */
export function competitionHeading(recommendedList: number | null | undefined): string {
  return recommendedList != null && recommendedList > 0
    ? `Who you would compete with at ${usd(recommendedList)}`
    : 'Who you would compete with at this price'
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
  return `<p>${esc(sentence)}</p>
  ${actives.length ? `<h3 class="subhead">For sale now</h3><div class="rival-grid">${cards(actives)}</div>` : ''}
  ${pendings.length ? `<h3 class="subhead">Under contract</h3><div class="rival-grid">${cards(pendings)}</div>` : ''}`
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
