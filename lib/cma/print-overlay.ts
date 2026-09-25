/**
 * Print-time overlays for stored CMA render_args. Names and missing
 * distances land here so Open PDF / ?print=1 pick them up without a
 * rebuild, a DB write, or a call to buildCma / selectComps.
 */

import { proximityLabel } from '@/lib/cma/market-area'
import type { RenderCmaArgs } from '@/lib/cma/render'

type GeoRow = {
  latitude?: number | null
  longitude?: number | null
  proximity?: string | null
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function fillRow<T extends GeoRow>(
  row: T,
  subject: { latitude?: number | null; longitude?: number | null } | null | undefined,
): T {
  if ((row.proximity ?? '').trim()) return row
  const label = proximityLabel(
    { lat: subject?.latitude ?? null, lng: subject?.longitude ?? null },
    { lat: row.latitude ?? null, lng: row.longitude ?? null },
  )
  if (!label) return row
  return { ...row, proximity: label }
}

function fillRows<T extends GeoRow>(
  rows: T[] | null | undefined,
  subject: { latitude?: number | null; longitude?: number | null } | null | undefined,
): T[] | null | undefined {
  if (!rows) return rows
  return rows.map((row) => fillRow(row, subject))
}

/**
 * Clone extras / expired peers / band rivals and fill blank proximity from
 * subject lat/lng. Never clones or mutates comps or pricing.
 */
export function printArgsDistanceFill(stored: RenderCmaArgs): {
  extras: RenderCmaArgs['extras']
  expiredPeers: RenderCmaArgs['expiredPeers']
  bandRivals: RenderCmaArgs['bandRivals']
} {
  const subject = stored.subject
  let extras = stored.extras ? cloneJson(stored.extras) : stored.extras
  if (extras?.band?.rivals) {
    extras = {
      ...extras,
      band: { ...extras.band, rivals: fillRows(extras.band.rivals, subject) ?? extras.band.rivals },
    }
  }
  if (extras?.marketArea?.expiredPeers) {
    extras = {
      ...extras,
      marketArea: {
        ...extras.marketArea,
        expiredPeers: fillRows(extras.marketArea.expiredPeers, subject) ?? extras.marketArea.expiredPeers,
      },
    }
  }
  let expiredPeers = stored.expiredPeers ? cloneJson(stored.expiredPeers) : stored.expiredPeers
  if (expiredPeers?.peers) {
    expiredPeers = {
      ...expiredPeers,
      peers: fillRows(expiredPeers.peers, subject) ?? expiredPeers.peers,
    }
  }
  let bandRivals = stored.bandRivals ? cloneJson(stored.bandRivals) : stored.bandRivals
  if (bandRivals?.rivals) {
    bandRivals = {
      ...bandRivals,
      rivals: fillRows(bandRivals.rivals, subject) ?? bandRivals.rivals,
    }
  }
  return { extras, expiredPeers, bandRivals }
}

export function pricingIdentity(pricing: {
  recommended?: number | null
  conservative?: number | null
  highEnd?: number | null
  valueLow?: number | null
  valueHigh?: number | null
} | null | undefined): {
  recommended: number | null | undefined
  conservative: number | null | undefined
  highEnd: number | null | undefined
  valueLow: number | null | undefined
  valueHigh: number | null | undefined
} {
  return {
    recommended: pricing?.recommended,
    conservative: pricing?.conservative,
    highEnd: pricing?.highEnd,
    valueLow: pricing?.valueLow,
    valueHigh: pricing?.valueHigh,
  }
}
