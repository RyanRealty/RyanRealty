/**
 * Read-only check: what the letter prints for competition and unsold homes
 * against what the build stored.
 *
 * A failure is the class that emptied 2902 Pinnacle: a blank place on the
 * area the build drew, a delivered or finalized letter whose printed rows
 * are not the rows it was signed with, or a chapter that says none while
 * those rows are still in the stored set. A draft that drops a named
 * subdivision outside the sales plats is rule 24 (3177 Coho). It is reported,
 * and it is not a failure.
 *
 * Pure. `scripts/cma-render-audit.ts` runs it over stored rows. No writes.
 */

import type { CmaBandRival } from '@/lib/cma/band-rivals'
import type { CmaExpiredPeer } from '@/lib/cma/market-status'
import {
  activeRivalsFor,
  isSubjectListing,
  letterIsFrozen,
  matrixSetsFromArgs,
  sameDrawnArea,
  unsoldPeersFor,
} from '@/lib/cma/matrix-sets'
import { letterProductMatch } from '@/lib/cma/market-area'
import { competitionPage, didNotSellPage, type OpinionPageArgs } from '@/lib/cma/opinion-pages'
import type { CompArea } from '@/lib/pricing/comp-area'
import { usableSubdivision } from '@/lib/pricing/comp-search'

export type RenderAuditResult = {
  fail: string[]
  rule24: string[]
  /** Dropped for a reason that is not the Pinnacle class and not rule 24. */
  other: string[]
  /** Stored rivals with an address and a price, before the render filter. */
  storedRivals: number
  printedRivals: number
  storedPeers: number
  printedPeers: number
}

type PlaceRow = {
  listingKey?: string | null
  address?: string | null
  subdivision?: string | null
  platSlug?: string | null
  listPrice?: number | null
  propertySubType?: string | null
}

function lacksPlace(row: PlaceRow): boolean {
  const plat = typeof row.platSlug === 'string' ? row.platSlug.trim() : ''
  return usableSubdivision(row.subdivision) == null && plat.length === 0
}

function keyOf(row: PlaceRow): string {
  return (row.listingKey ?? '').trim() || (row.address ?? '').trim()
}

function dropped<T extends PlaceRow>(stored: readonly T[], printed: readonly T[]): T[] {
  const keep = new Set(printed.map(keyOf))
  return stored.filter((row) => {
    const key = keyOf(row)
    return key.length > 0 && !keep.has(key)
  })
}

function chapterText(page: { toc?: string; body?: string } | null): string {
  return `${page?.toc ?? ''}\n${page?.body ?? ''}`
}

/**
 * One stored `cmas` row. `args` is `render_args`. Status is the row status
 * the serve path stamps as `documentStatus`.
 */
export function auditCmaRenderRow(input: {
  slug: string
  status: string | null
  args: unknown
}): RenderAuditResult {
  const fail: string[] = []
  const rule24: string[] = []
  const other: string[] = []
  const empty = { fail, rule24, other, storedRivals: 0, printedRivals: 0, storedPeers: 0, printedPeers: 0 }
  const args = input.args
  if (!args || typeof args !== 'object') return empty
  const doc = args as {
    subject?: { propertySubType?: string | null; listingKey?: string | null; mlsNumber?: string | null; streetAddress?: string | null } | null
    compArea?: CompArea | null
    pricing?: { recommended?: number | null } | null
    generatedAtIso?: string | null
    bandRivals?: {
      area?: CompArea | null
      rivals?: CmaBandRival[] | null
      lo?: number
      hi?: number
      activeCount?: number
      pendingCount?: number
      sentence?: string | null
    } | null
    expiredPeers?: {
      area?: CompArea | null
      peers?: CmaExpiredPeer[] | null
      count?: number
      sentence?: string | null
      windowMonths?: number
    } | null
    extras?: {
      band?: { rivals?: CmaBandRival[] | null } | null
      marketArea?: { expiredPeers?: CmaExpiredPeer[] | null } | null
    } | null
  }
  const subject = doc.subject
  if (!subject) return empty
  const status = input.status ?? 'draft'
  const withStatus = { ...(args as object), documentStatus: status }
  const frozen = letterIsFrozen(status)
  const sets = matrixSetsFromArgs(withStatus)
  const filterArea = doc.compArea ?? doc.bandRivals?.area ?? null
  const bandArea = doc.bandRivals?.area ?? null
  const peerArea = doc.expiredPeers?.area ?? null

  const storedRivals = (doc.bandRivals?.rivals ?? doc.extras?.band?.rivals ?? []).filter(
    (r) => (r.address ?? '').trim() && (r.listPrice ?? 0) > 0,
  )
  const printedRivals = activeRivalsFor(storedRivals, subject, filterArea, { frozen, buildArea: bandArea })
  for (const row of dropped(storedRivals, printedRivals)) {
    if (isSubjectListing(row, subject)) continue
    const where = `${input.slug} rival ${row.address}`
    if (frozen) {
      fail.push(`${where} dropped on a ${status} letter`)
    } else if (lacksPlace(row) && sameDrawnArea(filterArea, bandArea)) {
      fail.push(`${where} has no place and was drawn on this area`)
    } else if (usableSubdivision(row.subdivision)) {
      rule24.push(`${where} names ${row.subdivision}, outside the sales plats`)
    } else if (lacksPlace(row)) {
      other.push(`${where} blank place on a different area`)
    } else if (!letterProductMatch(subject.propertySubType, row.propertySubType)) {
      other.push(`${where} product`)
    } else {
      other.push(`${where} not printed`)
    }
  }

  const storedPeers = (doc.expiredPeers?.peers ?? doc.extras?.marketArea?.expiredPeers ?? []).filter(
    (p) => (p.address ?? '').trim() && (p.listPrice ?? 0) > 0,
  )
  const printedPeers = unsoldPeersFor({
    subject,
    peers: storedPeers,
    area: doc.compArea ?? null,
    buildArea: peerArea,
    frozen,
  })
  for (const row of dropped(storedPeers, printedPeers)) {
    if (isSubjectListing(row, subject)) continue
    const where = `${input.slug} unsold ${row.address}`
    if (frozen) {
      fail.push(`${where} dropped on a ${status} letter`)
    } else if (lacksPlace(row) && sameDrawnArea(doc.compArea ?? null, peerArea)) {
      fail.push(`${where} has no place and was drawn on this area`)
    } else if (usableSubdivision(row.subdivision)) {
      rule24.push(`${where} names ${row.subdivision}, outside the sales plats`)
    } else if (lacksPlace(row)) {
      other.push(`${where} blank place on a different area`)
    } else if (!letterProductMatch(subject.propertySubType, row.propertySubType)) {
      other.push(`${where} product`)
    } else {
      other.push(`${where} not printed`)
    }
  }

  if (sets.active.length !== printedRivals.length || sets.unsold.length !== printedPeers.length) {
    fail.push(
      `${input.slug} map set disagrees with the chapters (rivals ${sets.active.length} vs ${printedRivals.length}, unsold ${sets.unsold.length} vs ${printedPeers.length})`,
    )
  }

  const pageArgs = {
    ...(args as object),
    documentStatus: status,
    comps: (args as { comps?: unknown }).comps ?? [],
    market: (args as { market?: unknown }).market ?? null,
    pricing: doc.pricing ?? { recommended: null, valueLow: null, valueHigh: null, notes: [] },
    generatedAtIso: doc.generatedAtIso ?? '2026-10-09T00:00:00.000Z',
  } as unknown as OpinionPageArgs

  if (doc.bandRivals && doc.pricing) {
    try {
      const text = chapterText(competitionPage(pageArgs))
      // A pending-only chapter honestly says "0 homes are for sale" and then
      // names the homes under contract. The defect is that zero lead with
      // none under contract, over rows the chapter still draws (2902 Pinnacle).
      const saysNone = /0 homes are for sale[^<]{0,240}None are under contract/.test(text)
      if (saysNone && printedRivals.length > 0) {
        fail.push(`${input.slug} competition chapter says none while ${printedRivals.length} rivals print`)
      }
    } catch {
      // A row the chapter cannot render is not this defect.
    }
  }
  if (doc.expiredPeers && doc.pricing) {
    try {
      const text = chapterText(didNotSellPage(pageArgs))
      const saysNone = /No other listing like yours near you came off unsold|No home like yours in this area came off/.test(text)
      if (saysNone && printedPeers.length > 0) {
        fail.push(`${input.slug} unsold chapter says none while ${printedPeers.length} peers print`)
      }
    } catch {
      // Same as the competition chapter.
    }
  }

  return {
    fail,
    rule24,
    other,
    storedRivals: storedRivals.length,
    printedRivals: printedRivals.length,
    storedPeers: storedPeers.length,
    printedPeers: printedPeers.length,
  }
}
