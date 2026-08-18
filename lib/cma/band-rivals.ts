/**
 * Named homes competing at the recommended list. Counts stay on
 * CmaBandPosition. This module names the houses and draws the cards.
 */

import { escapeHtml, int, sparkPhotoAt, usd } from '@/lib/cma/render-blocks'

const esc = escapeHtml

export const BAND_RIVAL_CAP = 8

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

export function pickBandRivals(
  rivals: readonly CmaBandRival[],
  subject?: { latitude: number | null; longitude: number | null } | null,
  cap = BAND_RIVAL_CAP,
): CmaBandRival[] {
  const named = rivals.filter((r) => r.address.trim() && r.listPrice > 0)
  const slat = subject?.latitude
  const slng = subject?.longitude
  const ranked =
    slat != null && slng != null && Number.isFinite(slat) && Number.isFinite(slng)
      ? [...named].sort((a, b) => dist2(a, slat, slng) - dist2(b, slat, slng))
      : [...named]
  return ranked.filter((r) => r.status === 'Active').slice(0, cap)
}

function rivalCard(r: CmaBandRival): string {
  const photo = sparkPhotoAt(r.photoUrl, '640x480')
  const img = photo
    ? `<img class="rival-ph" src="${esc(photo)}" alt="${esc(r.address)}" />`
    : `<div class="rival-ph is-empty" aria-hidden="true"></div>`
  const days =
    r.daysOnMarket != null && r.daysOnMarket >= 0 ? `${int(r.daysOnMarket)} days on market` : null
  const rooms = [
    r.beds != null && r.beds > 0 ? `${int(r.beds)} bed` : null,
    r.baths != null && r.baths > 0 ? `${r.baths} bath` : null,
  ]
    .filter(Boolean)
    .join(' · ')
  const meta = [rooms, days].filter(Boolean).join(' · ')
  return `<article class="rival-card">
    ${img}
    <div class="rival-body">
      <div class="rival-addr">${esc(r.address)}</div>
      <div class="rival-ask">${usd(r.listPrice)}</div>
      ${meta ? `<div class="rival-meta">${esc(meta)}</div>` : ''}
    </div>
  </article>`
}

function rivalLead(input: {
  activeCount: number
  productLabel?: string | null
  hasNamedActives: boolean
}): string {
  const cls = input.productLabel?.trim()
  const noun = input.activeCount === 1 ? 'home' : 'homes'
  const set = cls ? ` in the ${cls}` : ''
  if (input.activeCount === 0) {
    return cls
      ? `No homes for sale right now in the ${cls}.`
      : 'No homes for sale right now in the same search as the sales that set the number.'
  }
  if (input.hasNamedActives) {
    return `${int(input.activeCount)} ${noun} for sale${set}.`
  }
  return `${int(input.activeCount)} ${noun} for sale${set}.`
}

export function renderBandRivalsHtml(input: {
  city: string
  lo: number
  hi: number
  activeCount: number
  pendingCount: number
  rivals: readonly CmaBandRival[]
  productLabel?: string | null
}): string {
  const actives = input.rivals.filter((r) => r.status === 'Active')
  const activeCards = actives.map(rivalCard).join('')
  const activeLead = rivalLead({
    activeCount: input.activeCount,
    productLabel: input.productLabel,
    hasNamedActives: actives.length > 0,
  })
  return `
  <h2 class="section">Who you are competing with at this price</h2>
  <p>${esc(activeLead)}</p>
  ${
    actives.length > 0
      ? `<h3 class="subhead">For sale now</h3><div class="rival-grid">${activeCards}</div>`
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
  productLabel?: string | null
}): string {
  const actives = input.rivals.filter((r) => r.status === 'Active')
  const cards = (rows: readonly CmaBandRival[]) => rows.map(rivalCard).join('')
  const cls = input.productLabel?.trim()
  const headline =
    actives.length > 0
      ? `${int(input.activeCount)} ${input.activeCount === 1 ? 'home is' : 'homes are'} for sale in the same search`
      : `Who you are competing with at this price`
  const lede = rivalLead({
    activeCount: input.activeCount,
    productLabel: cls,
    hasNamedActives: actives.length > 0,
  })
  return `
  <section class="sc sc-navy" id="competition">
    <div class="in wide">
      <div class="kick r">At this price</div>
      <h2 class="h r">${esc(headline)}</h2>
      <p class="lede r">${esc(lede)}</p>
      ${actives.length ? `<h3 class="sub r">For sale now</h3><div class="rival-grid r">${cards(actives)}</div>` : ''}
    </div>
  </section>`
}
