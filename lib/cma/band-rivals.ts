/**
 * Named homes competing at the recommended list. Counts stay on
 * CmaBandPosition. This module names the houses and draws the list.
 */

import { escapeHtml, int, sparkPhotoAt, usd } from '@/lib/cma/render-blocks'

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

export function rivalVsSubjectLine(r: CmaBandRival, subject: CmaBandSubject | null | undefined): string | null {
  if (!subject) return null
  const bits: string[] = []
  if (subject.recommendedList != null && subject.recommendedList > 0) {
    const d = Math.round(r.listPrice - subject.recommendedList)
    if (d === 0) bits.push('same as this list')
    else if (d > 0) bits.push(`${usd(d)} above this list`)
    else bits.push(`${usd(-d)} below this list`)
  }
  if (r.sqft != null && r.sqft > 0 && subject.sqft != null && subject.sqft > 0) {
    const d = Math.round(r.sqft - subject.sqft)
    if (d === 0) bits.push('same size')
    else if (d > 0) bits.push(`${int(d)} sqft larger`)
    else bits.push(`${int(-d)} sqft smaller`)
  }
  if (r.beds != null && subject.beds != null && r.beds !== subject.beds) {
    const d = r.beds - subject.beds
    bits.push(d > 0 ? `${int(d)} more bed${d === 1 ? '' : 's'}` : `${int(-d)} fewer bed${d === -1 ? '' : 's'}`)
  }
  if (r.baths != null && subject.baths != null && r.baths !== subject.baths) {
    const d = r.baths - subject.baths
    const abs = Math.abs(d)
    const label = abs === 1 ? 'bath' : 'baths'
    bits.push(d > 0 ? `${abs % 1 === 0 ? int(abs) : abs.toFixed(1)} more ${label}` : `${abs % 1 === 0 ? int(abs) : abs.toFixed(1)} fewer ${label}`)
  }
  if (r.yearBuilt != null && subject.yearBuilt != null) {
    const d = r.yearBuilt - subject.yearBuilt
    if (d === 0) bits.push('same year')
    else if (d > 0) bits.push(`${int(d)} year${Math.abs(d) === 1 ? '' : 's'} newer`)
    else bits.push(`${int(-d)} year${Math.abs(d) === 1 ? '' : 's'} older`)
  }
  const mi = milesBetween(r, subject)
  if (mi != null && mi >= 0.05) {
    bits.push(mi >= 10 ? `${int(mi)} mi` : `${mi.toFixed(1)} mi`)
  }
  return bits.length ? bits.join(' · ') : null
}

function subjectFactsLine(s: CmaBandSubject): string | null {
  return joinFacts([
    s.beds != null ? `${int(s.beds)} bd` : null,
    s.baths != null ? `${s.baths % 1 === 0 ? int(s.baths) : s.baths.toFixed(1)} ba` : null,
    s.sqft != null && s.sqft > 0 ? `${int(s.sqft)} sqft` : null,
    s.yearBuilt != null ? String(s.yearBuilt) : null,
    s.lotAcres != null && s.lotAcres > 0 ? `${s.lotAcres.toFixed(2)} ac` : null,
  ])
}

function subjectRow(subject: CmaBandSubject | null | undefined): string {
  if (!subject) return ''
  const facts = subjectFactsLine(subject)
  const photo = sparkPhotoAt(subject.photoUrl ?? null, '320x320')
  const img = photo
    ? `<img class="rival-ph" src="${esc(photo)}" alt="This home" />`
    : `<div class="rival-ph is-empty" aria-hidden="true"></div>`
  const ask =
    subject.recommendedList != null && subject.recommendedList > 0
      ? `<div class="rival-ask">${usd(subject.recommendedList)}</div>`
      : `<div class="rival-ask"></div>`
  return `<article class="rival-row is-subject">
    ${img}
    <div class="rival-body">
      <div class="rival-addr">This home</div>
      ${facts ? `<div class="rival-facts">${esc(facts)}</div>` : ''}
      <div class="rival-meta">Recommended list</div>
    </div>
    ${ask}
  </article>`
}

function rivalRow(r: CmaBandRival, subject: CmaBandSubject | null | undefined): string {
  const photo = sparkPhotoAt(r.photoUrl, '320x320')
  const img = photo
    ? `<img class="rival-ph" src="${esc(photo)}" alt="${esc(r.address)}" />`
    : `<div class="rival-ph is-empty" aria-hidden="true"></div>`
  const facts = rivalFactsLine(r)
  const vs = rivalVsSubjectLine(r, subject)
  const days = r.daysOnMarket != null && r.daysOnMarket >= 0 ? `${int(r.daysOnMarket)} days` : null
  const meta = joinFacts([days, vs])
  return `<article class="rival-row">
    ${img}
    <div class="rival-body">
      <div class="rival-addr">${esc(r.address)}</div>
      ${facts ? `<div class="rival-facts">${esc(facts)}</div>` : ''}
      ${meta ? `<div class="rival-meta">${esc(meta)}</div>` : ''}
    </div>
    <div class="rival-ask">${usd(r.listPrice)}</div>
  </article>`
}

export function renderBandRivalsHtml(input: {
  city: string
  lo: number
  hi: number
  activeCount: number
  pendingCount: number
  rivals: readonly CmaBandRival[]
  subject?: CmaBandSubject | null
}): string {
  const actives = input.rivals.filter((r) => r.status === 'Active')
  const pendings = input.rivals.filter((r) => r.status === 'Pending')
  const rows = (list: readonly CmaBandRival[]) => list.map((r) => rivalRow(r, input.subject)).join('')
  const activeLead =
    actives.length > 0
      ? `${int(input.activeCount)} home${input.activeCount === 1 ? '' : 's'} for sale between ${usd(input.lo)} and ${usd(input.hi)}.`
      : `${int(input.activeCount)} home${input.activeCount === 1 ? '' : 's'} for sale in that band.`
  const pendingLead =
    input.pendingCount > 0
      ? `${int(input.pendingCount)} under contract in the same band.`
      : 'None under contract in this band right now.'
  const shown =
    actives.length + pendings.length < input.activeCount + input.pendingCount
      ? ` Nearest ${int(actives.length + pendings.length)} shown.`
      : ''
  const subjectBlock = input.subject ? `<div class="rival-list">${subjectRow(input.subject)}</div>` : ''
  return `
  <h2 class="section">Who you are competing with at this price</h2>
  <p>${esc(activeLead)} ${esc(pendingLead)}${esc(shown)}</p>
  ${subjectBlock}
  ${
    actives.length > 0
      ? `<h3 class="subhead">For sale now</h3><div class="rival-list">${rows(actives)}</div>`
      : ''
  }
  ${
    pendings.length > 0
      ? `<h3 class="subhead">Under contract</h3><div class="rival-list">${rows(pendings)}</div>`
      : ''
  }`
}

export function renderBandRivalsSceneHtml(input: {
  city: string
  lo: number
  hi: number
  activeCount: number
  pendingCount: number
  rivals: readonly CmaBandRival[]
  subject?: CmaBandSubject | null
}): string {
  const actives = input.rivals.filter((r) => r.status === 'Active')
  const pendings = input.rivals.filter((r) => r.status === 'Pending')
  const rows = (list: readonly CmaBandRival[]) => list.map((r) => rivalRow(r, input.subject)).join('')
  const headline =
    actives.length > 0
      ? `${int(input.activeCount)} home${input.activeCount === 1 ? ' is' : 's are'} for sale between ${usd(input.lo)} and ${usd(input.hi)}`
      : `Who you are competing with at this price`
  return `
  <section class="sc sc-navy" id="competition">
    <div class="in wide">
      <div class="kick r">At this price</div>
      <h2 class="h r">${esc(headline)}</h2>
      <p class="lede r">${int(input.pendingCount)} under contract in the same band.</p>
      ${input.subject ? `<div class="rival-list r">${subjectRow(input.subject)}</div>` : ''}
      ${actives.length ? `<h3 class="sub r">For sale now</h3><div class="rival-list r">${rows(actives)}</div>` : ''}
      ${pendings.length ? `<h3 class="sub r">Under contract</h3><div class="rival-list r">${rows(pendings)}</div>` : ''}
    </div>
  </section>`
}
