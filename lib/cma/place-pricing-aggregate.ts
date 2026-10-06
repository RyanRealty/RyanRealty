/**
 * Twelve-month parent-place pricing story. Pure. No database.
 * Null is not zero. A median needs five homes.
 */

import type { PlacePricingStory } from '@/lib/cma/place-pricing-types'
import { parentPlaceArea } from '@/lib/pricing/comp-area'
import { median } from '@/lib/cma/market-status'

const FAILED = new Set(['Expired', 'Canceled', 'Withdrawn'])

export type PlacePricingListingRow = {
  streetNumber?: string | null
  streetName?: string | null
  status?: string | null
  listPrice?: number | null
  originalListPrice?: number | null
  closePrice?: number | null
  closeDate?: string | null
  listDate?: string | null
  onMarketDate?: string | null
  offMarketDate?: string | null
  /** Null means the MLS recorded nothing. Zero means it recorded none. */
  concessionsAmount?: number | null
  /** Offer timing. Not DaysOnMarket, which is list-to-close. */
  daysToPending?: number | null
  propertySubType?: string | null
}

export type PlacePricingTarget = {
  placeName: string
  placeKind: 'neighborhood' | 'community'
}

/**
 * Neighborhood and community letters use that name. A subdivision letter
 * uses the neighborhood or community that contains the subject. A city or
 * a radius is not a place for this story.
 */
export function resolvePlacePricingTarget(input: {
  compArea: { kind?: string | null; names?: readonly string[] | null } | null | undefined
  latitude: number | null
  longitude: number | null
}): PlacePricingTarget | null {
  const kind = input.compArea?.kind ?? null
  if (kind === 'neighborhood' || kind === 'community') {
    const placeName = input.compArea?.names?.[0]?.trim() ?? ''
    return placeName ? { placeName, placeKind: kind } : null
  }
  if (kind !== 'subdivision' && kind !== 'subdivisions') return null
  const parent = parentPlaceArea({ latitude: input.latitude, longitude: input.longitude })
  if (!parent || (parent.kind !== 'neighborhood' && parent.kind !== 'community')) return null
  const placeName = parent.names[0]?.trim() ?? ''
  if (!placeName) return null
  return { placeName, placeKind: parent.kind }
}

function isoDay(value: string | Date | null | undefined): string | null {
  if (value == null) return null
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null
    return value.toISOString().slice(0, 10)
  }
  const day = value.trim().slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null
}

function shiftMonths(iso: string, months: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y!, m! - 1 + months, d)).toISOString().slice(0, 10)
}

function inSpan(value: string | null | undefined, start: string, end: string): boolean {
  const day = isoDay(value)
  return day != null && day >= start && day <= end
}

export function normalizePlaceAddress(
  streetNumber: string | null | undefined,
  streetName: string | null | undefined,
): string {
  return `${streetNumber ?? ''} ${streetName ?? ''}`.toLowerCase().replace(/\s+/g, ' ').trim()
}

function positive(value: number | null | undefined): number | null {
  return value != null && Number.isFinite(value) && value > 0 ? value : null
}

function recordedConcession(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value) || value < 0) return null
  return value
}

function recordedDays(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value) || value < 0) return null
  return value
}

function eventDay(row: PlacePricingListingRow): string {
  const days = [row.closeDate, row.offMarketDate, row.listDate, row.onMarketDate]
    .map((value) => isoDay(value))
    .filter((day): day is string => day != null)
  days.sort()
  return days[days.length - 1] ?? ''
}

function latest<T extends PlacePricingListingRow>(rows: readonly T[]): T {
  return rows.reduce((best, row) => (eventDay(row) >= eventDay(best) ? row : best))
}

function longDate(iso: string): string {
  return new Date(`${iso}T12:00:00.000Z`).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

function shareMedian(values: number[], gate: number): number | null {
  if (gate < 5 || values.length < 5) return null
  return median(values)
}

export function rowsToPlacePricingStory(input: {
  placeName: string | null | undefined
  placeKind: 'neighborhood' | 'community'
  propertySubType: string | null | undefined
  asOf: string | Date
  rows: readonly PlacePricingListingRow[]
}): PlacePricingStory | null {
  const placeName = input.placeName?.trim() ?? ''
  const subtype = input.propertySubType?.trim() ?? ''
  const end = isoDay(input.asOf)
  if (!placeName || !subtype || !end) return null
  if (input.placeKind !== 'neighborhood' && input.placeKind !== 'community') return null
  const start = shiftMonths(end, -12)
  const fitting = input.rows.filter((row) => {
    if ((row.propertySubType ?? '').trim() !== subtype) return false
    return (
      inSpan(row.listDate, start, end) ||
      inSpan(row.onMarketDate, start, end) ||
      inSpan(row.offMarketDate, start, end) ||
      inSpan(row.closeDate, start, end)
    )
  })
  const byAddress = new Map<string, PlacePricingListingRow[]>()
  for (const row of fitting) {
    const key = normalizePlaceAddress(row.streetNumber, row.streetName)
    if (!key) continue
    const group = byAddress.get(key)
    if (group) group.push(row)
    else byAddress.set(key, [row])
  }
  if (byAddress.size === 0) return null

  let didNotSell = 0
  let droppedPrice = 0
  let gaveConcessions = 0
  const cutShares: number[] = []
  const concessionShares: number[] = []
  const heldDays: number[] = []
  const cutDays: number[] = []

  for (const rows of byAddress.values()) {
    const closed = rows.filter((row) => row.status === 'Closed' && inSpan(row.closeDate, start, end))
    const failed = rows.some((row) => row.status != null && FAILED.has(row.status))
    const closedInWindow = rows.some((row) => inSpan(row.closeDate, start, end))
    if (failed && !closedInWindow) didNotSell += 1

    const drops = rows.filter((row) => {
      const original = positive(row.originalListPrice)
      const list = positive(row.listPrice)
      return original != null && list != null && original > list
    })
    if (drops.length > 0) {
      droppedPrice += 1
      const drop = latest(drops)
      const original = positive(drop.originalListPrice)!
      const list = positive(drop.listPrice)!
      cutShares.push((original - list) / original)
    }

    const credits = rows.filter((row) => {
      const amount = recordedConcession(row.concessionsAmount)
      return amount != null && amount > 0
    })
    if (credits.length > 0) {
      gaveConcessions += 1
      const credit = latest(credits)
      const amount = recordedConcession(credit.concessionsAmount)!
      const list = positive(credit.listPrice)
      if (list != null) concessionShares.push(amount / list)
    }

    if (closed.length > 0) {
      const sale = latest(closed)
      const days = recordedDays(sale.daysToPending)
      if (days != null) {
        const original = positive(sale.originalListPrice)
        const list = positive(sale.listPrice)
        const cut = original != null && list != null && original > list
        if (cut) cutDays.push(days)
        else heldDays.push(days)
      }
    }
  }

  const listedHomes = byAddress.size
  const homes = listedHomes === 1 ? '1 home' : `${listedHomes} homes`
  return {
    placeName,
    placeKind: input.placeKind,
    windowMonths: 12,
    asOf: end,
    listedHomes,
    didNotSell,
    droppedPrice,
    typicalCutShare: shareMedian(cutShares, droppedPrice),
    gaveConcessions,
    typicalConcessionShare: shareMedian(concessionShares, gaveConcessions),
    heldAskCount: heldDays.length,
    heldAskMedianDays: shareMedian(heldDays, heldDays.length),
    cutPriceCount: cutDays.length,
    cutPriceMedianDays: shareMedian(cutDays, cutDays.length),
    sourceNote: `${placeName}, ${subtype}, ${longDate(start)} through ${longDate(end)}, ${homes}.`,
  }
}
