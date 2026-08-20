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
  propertySubType?: string | null
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
  const actives = ranked.filter((r) => r.status === 'Active').slice(0, cap)
  const pendings = ranked.filter((r) => r.status === 'Pending').slice(0, cap)
  return [...actives, ...pendings]
}

function rivalCard(r: CmaBandRival): string {
  const photo = sparkPhotoAt(r.photoUrl, '640x480')
  const img = photo
    ? `<img class="rival-ph" src="${esc(photo)}" alt="${esc(r.address)}" />`
    : `<div class="rival-ph is-empty" aria-hidden="true"></div>`
  const days =
    r.daysOnMarket != null && r.daysOnMarket >= 0 ? `${int(r.daysOnMarket)} days on market` : null
  return `<article class="rival-card">
    ${img}
    <div class="rival-body">
      <div class="rival-addr">${esc(r.address)}</div>
      <div class="rival-ask">${usd(r.listPrice)}</div>
      ${days ? `<div class="rival-meta">${esc(days)}</div>` : ''}
    </div>
  </article>`
}

export function renderBandRivalsHtml(input: {
  city: string
  lo: number
  hi: number
  activeCount: number
  pendingCount: number
  rivals: readonly CmaBandRival[]
}): string {
  const actives = input.rivals.filter((r) => r.status === 'Active')
  const pendings = input.rivals.filter((r) => r.status === 'Pending')
  const activeCards = actives.map(rivalCard).join('')
  const pendingCards = pendings.map(rivalCard).join('')
  const activeLead =
    actives.length > 0
      ? `${int(input.activeCount)} home${input.activeCount === 1 ? '' : 's'} for sale between ${usd(input.lo)} and ${usd(input.hi)}.`
      : `${int(input.activeCount)} home${input.activeCount === 1 ? '' : 's'} for sale in that band.`
  const pendingLead =
    input.pendingCount > 0
      ? `${int(input.pendingCount)} under contract in the same band.`
      : 'None under contract in this band right now.'
  return `
  <h2 class="section">Who you are competing with at this price</h2>
  <p>${esc(activeLead)} ${esc(pendingLead)}</p>
  ${
    actives.length > 0
      ? `<h3 class="subhead">For sale now</h3><div class="rival-grid">${activeCards}</div>`
      : ''
  }
  ${
    pendings.length > 0
      ? `<h3 class="subhead">Under contract</h3><div class="rival-grid">${pendingCards}</div>`
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
}): string {
  const actives = input.rivals.filter((r) => r.status === 'Active')
  const pendings = input.rivals.filter((r) => r.status === 'Pending')
  const cards = (rows: readonly CmaBandRival[]) => rows.map(rivalCard).join('')
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
      ${actives.length ? `<h3 class="sub r">For sale now</h3><div class="rival-grid r">${cards(actives)}</div>` : ''}
      ${pendings.length ? `<h3 class="sub r">Under contract</h3><div class="rival-grid r">${cards(pendings)}</div>` : ''}
    </div>
  </section>`
}
