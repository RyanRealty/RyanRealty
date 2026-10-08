/**
 * WHICH HOMES ARE IN EACH OF THE THREE SETS, resolved once.
 *
 * Delta 3 gives the document one map and three matrices keyed to it: closed
 * sales numbered, homes for sale lettered, listings that came off unsold in
 * roman. The pin and the row are the same object to a reader, and the
 * interaction layer matches them on the key alone — so the ORDER each set is
 * in has to be decided in exactly one place. It used to be decided twice: the
 * map numbered `render_args.comps`, and the chapters filtered and collapsed
 * their own sets on the way to a card. A peer dropped by one and kept by the
 * other is a pin that highlights the wrong home.
 *
 * Pure, no I/O. `lib/cma/map.ts` reads it to key the tile's pins;
 * `lib/cma/opinion-pages.ts` reads it to key the matrices.
 */

import { collapseExpiredPeerCycles, peerMatchesSubject } from '@/lib/cma/market-status'
import type { CmaExpiredPeer } from '@/lib/cma/market-status'
import { competitionAreaSentence, type CmaBandRival } from '@/lib/cma/band-rivals'
import type { CmaSubject } from '@/lib/cma/types'
import { letterProductMatch } from '@/lib/cma/market-area'
import { compAreaContains, salesAreaIsBounded, type CompArea } from '@/lib/pricing/comp-area'

/**
 * The listings that came off the same area unsold, in matrix-2 order.
 *
 * Named, priced, not the subject's own listing, one row per address (a home
 * that failed twice is one story, not two). Every peer the sentence counted.
 */
function insideSalesBoundary(
  area: CompArea | null | undefined,
  row: {
    latitude?: number | null
    longitude?: number | null
    subdivision?: string | null
    city?: string | null
  },
): boolean {
  if (!area || !salesAreaIsBounded(area)) return true
  // A blank place is not inside the sales boundary. Keeping it would be a
  // second path around the plat, the polygon, or the radius.
  if (area.kind === 'subdivision' || area.kind === 'subdivisions') {
    return compAreaContains(area, row)
  }
  if (row.latitude == null || row.longitude == null) return false
  return compAreaContains(area, row)
}

export function unsoldPeersFor(input: {
  subject: Pick<CmaSubject, 'listingKey' | 'mlsNumber' | 'streetAddress'> & { propertySubType?: string | null }
  peers?: readonly CmaExpiredPeer[] | null
  area?: CompArea | null
}): CmaExpiredPeer[] {
  const named = (input.peers ?? []).filter(
    (p) =>
      p.address.trim() &&
      p.listPrice > 0 &&
      !peerMatchesSubject(p, input.subject) &&
      letterProductMatch(input.subject.propertySubType, p.propertySubType) &&
      // A peer outside the sales area is never drawn, whatever its stored
      // name (Matt 2026-10-07).
      insideSalesBoundary(input.area, p),
  )
  return collapseExpiredPeerCycles(named)
}

/**
 * The homes competing at the recommended list, in matrix-3 order: everything
 * for sale, then everything under contract, exactly as the chapter has always
 * printed them. `pickBandRivals` already ran at build; this only fixes the
 * order the keys are handed out in.
 */
const STATUS_RANK: Record<string, number> = { Pending: 3, Active: 2, Expired: 1 }

function normAddr(address: string): string {
  return address.replace(/^0+\s+/, '').trim().toLowerCase().replace(/\s+/g, ' ')
}

/** Same home listed twice: keep the most advanced status (Pending > Active). */
export function dedupeRivalsByAddress(rivals: readonly CmaBandRival[]): CmaBandRival[] {
  const byAddr = new Map<string, CmaBandRival>()
  for (const r of rivals) {
    const key = normAddr(r.address)
    if (!key) continue
    const prior = byAddr.get(key)
    if (!prior || (STATUS_RANK[r.status] ?? 0) > (STATUS_RANK[prior.status] ?? 0)) {
      byAddr.set(key, r)
    }
  }
  return [...byAddr.values()]
}

/** What `peerMatchesSubject` reads off the subject. */
type SubjectKeys = Pick<CmaSubject, 'listingKey' | 'mlsNumber' | 'streetAddress'>

function hasSubjectKeys(subject: unknown): subject is SubjectKeys {
  const s = subject as Partial<SubjectKeys> | null | undefined
  return Boolean(s && (s.listingKey?.trim() || s.mlsNumber?.trim() || s.streetAddress?.trim()))
}

/**
 * THE SUBJECT IS NEVER ITS OWN COMPETITION.
 *
 * 3062 NW Kelly Hill is Active, and the band read it was priced against
 * returned its own listing: the status table counted "Active 1 home
 * $699,999", the chapter said "1 home like yours is for sale", the map drew
 * "A 3062 Kelly Hill" at 0.00 miles beside "Your home", and the owner's own
 * $75,001 cut was printed as somebody else's (reader review 2026-10-08). The
 * build now leaves it out of the read (lib/cma/assemble-competition.ts); a
 * stored row still carries it, so the render takes it out by listing key,
 * and any other record of the same house by address (`peerMatchesSubject`).
 */
export function isSubjectListing(
  row: { listingKey?: string | null; address?: string | null },
  subject: unknown,
): boolean {
  return hasSubjectKeys(subject) && peerMatchesSubject(row, subject)
}

export function activeRivalsFor(
  rivals?: readonly CmaBandRival[] | null,
  subject?: ({ propertySubType?: string | null } & Partial<SubjectKeys>) | null,
  area?: CompArea | null,
): CmaBandRival[] {
  const named = dedupeRivalsByAddress(
    (rivals ?? []).filter((r) => r.address.trim() && r.listPrice > 0 && !isSubjectListing(r, subject)),
  )
  const kept = named.filter(
    (r) =>
      letterProductMatch(subject?.propertySubType, r.propertySubType) &&
      insideSalesBoundary(area, r),
  )
  return [...kept.filter((r) => r.status === 'Active'), ...kept.filter((r) => r.status === 'Pending')]
}

/**
 * A stored competition set with the subject's own listing taken out, and the
 * counts that included it taken down by the same homes.
 *
 * The stored sentence counted the home itself ("1 home like yours is for
 * sale"), so when a home is taken out it is recounted over the same area,
 * band and rules (`competitionAreaSentence`), never printed as stored. A
 * city-band row with no area keeps no sentence; the chapter then writes its
 * own over the counts it draws.
 */
export type CompetitionSet = {
  lo: number
  hi: number
  activeCount: number
  pendingCount: number
  rivals: CmaBandRival[]
  sentence: string | null
}

export function competitionSetWithoutSubject(
  set:
    | {
        lo: number
        hi: number
        activeCount: number
        pendingCount: number
        rivals?: readonly CmaBandRival[] | null
        sentence?: string | null
        area?: CompArea | null
        unlikeCount?: number
        shortOfFive?: boolean
      }
    | null
    | undefined,
  subject: unknown,
): CompetitionSet | null {
  if (!set) return null
  const all = [...(set.rivals ?? [])]
  const sentence = set.sentence?.trim() || null
  const own = all.filter((r) => isSubjectListing(r, subject))
  if (own.length === 0) {
    return { lo: set.lo, hi: set.hi, activeCount: set.activeCount, pendingCount: set.pendingCount, rivals: all, sentence }
  }
  const rivals = all.filter((r) => !own.includes(r))
  const activeCount = Math.max(0, set.activeCount - own.filter((r) => r.status === 'Active').length)
  const pendingCount = Math.max(0, set.pendingCount - own.filter((r) => r.status === 'Pending').length)
  const recounted =
    sentence && set.area
      ? competitionAreaSentence({
          area: set.area,
          lo: set.lo,
          hi: set.hi,
          activeCount,
          pendingCount,
          shown: rivals.length,
          likeYours: rivals.length > 0,
          unlikeCount: set.unlikeCount,
          shortOfFive: set.shortOfFive,
          rivals,
        })
      : null
  return { lo: set.lo, hi: set.hi, activeCount, pendingCount, rivals, sentence: recounted }
}

/**
 * `render_args.compArea` — the pricing side's own account of the area every
 * set in this document was drawn from (R2h, 2026-09-08). Absent on every row
 * built before it landed; the map then falls back to the subdivision outline
 * and the search story's radius, which is exactly what it drew before.
 */
export type CmaCompArea = {
  kind?: string | null
  names?: readonly string[] | null
  radiusMiles?: number | null
  centre?: { lat: number; lng: number } | null
  source?: string | null
  sentence?: string | null
  /** The recorded plats a plat area holds whole (`CompArea.platSlugs`). */
  platSlugs?: readonly string[] | null
  /**
   * A plat only the subject's own street reached (`CompArea.street`). The map
   * does not draw it: it is in the area on that street only (rule 24).
   */
  street?: { key: string; names: readonly string[]; platSlugs: readonly string[] } | null
}

function finite(v: unknown): number | null {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

/** Reads `compArea` off `render_args` without trusting any of its fields. */
export function readCompArea(args: unknown): CmaCompArea | null {
  const raw = (args as { compArea?: unknown } | null | undefined)?.compArea
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const centreRaw = o.centre as Record<string, unknown> | null | undefined
  const lat = centreRaw ? finite(centreRaw.lat) : null
  const lng = centreRaw ? finite(centreRaw.lng) : null
  const strings = (v: unknown): string[] =>
    Array.isArray(v) ? v.map((n) => String(n ?? '').trim()).filter(Boolean) : []
  const names = Array.isArray(o.names) ? strings(o.names) : null
  const platSlugs = strings(o.platSlugs)
  const streetRaw = o.street && typeof o.street === 'object' ? (o.street as Record<string, unknown>) : null
  const streetKey = typeof streetRaw?.key === 'string' ? streetRaw.key.trim() : ''
  const street = streetRaw && streetKey
    ? { key: streetKey, names: strings(streetRaw.names), platSlugs: strings(streetRaw.platSlugs) }
    : null
  return {
    kind: typeof o.kind === 'string' ? o.kind : null,
    names: names && names.length > 0 ? names : null,
    radiusMiles: finite(o.radiusMiles),
    centre: lat != null && lng != null ? { lat, lng } : null,
    source: typeof o.source === 'string' ? o.source : null,
    sentence: typeof o.sentence === 'string' && o.sentence.trim() ? o.sentence.trim() : null,
    platSlugs: platSlugs.length > 0 ? platSlugs : null,
    street,
  }
}

/**
 * THE AREA, IN THE SENTENCE THE PRICING SIDE WROTE, or nothing.
 *
 * §0: the map's caption may not describe an area from the renderer's own
 * guess. When the row carries no `compArea` the caption says only what the
 * drawing shows.
 */
export function compAreaSentence(args: unknown): string | null {
  return readCompArea(args)?.sentence ?? null
}

/** Both sets off one stored `render_args`, for the tile builder. */
export function matrixSetsFromArgs(args: unknown): {
  unsold: CmaExpiredPeer[]
  active: CmaBandRival[]
} {
  const a = args as
    | {
        subject?: CmaSubject | null
        extras?: {
          marketArea?: { expiredPeers?: readonly CmaExpiredPeer[] | null } | null
          band?: { rivals?: readonly CmaBandRival[] | null } | null
        } | null
      }
    | null
    | undefined
  const subject = a?.subject
  const doc = a as {
    compArea?: CompArea | null
    expiredPeers?: { peers?: readonly CmaExpiredPeer[] | null } | null
    bandRivals?: { rivals?: readonly CmaBandRival[] | null; area?: CompArea | null } | null
  } | null
  const peers = doc?.expiredPeers?.peers ?? a?.extras?.marketArea?.expiredPeers ?? []
  const rivals = doc?.bandRivals?.rivals ?? a?.extras?.band?.rivals ?? []
  return {
    unsold: subject ? unsoldPeersFor({ subject, peers, area: doc?.compArea ?? null }) : [],
    // The sales area first. An old row's widened `bandRivals.area` no longer
    // admits a pin outside the plats the sales sit in (Matt 2026-10-07).
    active: activeRivalsFor(rivals, subject, doc?.compArea ?? doc?.bandRivals?.area ?? null),
  }
}
