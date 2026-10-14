/**
 * Homes for sale, under contract, and off the market unsold, on the subject's
 * recorded plat and the plats that touch it (Matt 2026-10-10). The sold
 * search still builds compArea. This file does not choose the sold comps.
 */

import { applyCompVerdicts } from '@/lib/cma/client-facing'
import { resolveCmaParcels } from '@/lib/cma/parcel-shapes'
import { buildCompSearch } from '@/lib/pricing/comp-search'
import { buildCompArea, type CompArea } from '@/lib/pricing/comp-area'
import { getCmaAreaUnsoldCycles } from '@/lib/data/cma/areaUnsoldReads'
import { getListingAskChanges } from '@/lib/data/cma/localOutcomeReads'
import {
  getSubdivisionRing,
  nextRowSubdivisionSlugs,
  readNeighborRings,
  touchingPlatsForSearch,
} from '@/lib/data/geo/subdivision-ring'
import {
  getCmaAreaBandInventory,
  type CmaAreaBandInventory,
  type CmaBandListingRow,
} from '@/lib/data/cma/bandInventory'
import {
  buildExpiredPeerSet,
  keptCompMedianPpsf,
  peerMatchesSubject,
  type CmaExpiredPeerSet,
} from '@/lib/cma/market-status'
import {
  bandRowStretch,
  bandRowToRival,
  daysSinceOnMarket,
  type CmaBandRival,
  type CmaBandRivalSet,
  type CompetitionRingPick,
  withRivalStretch,
} from '@/lib/cma/band-rivals'
import { roomNotedSentence, sameAreaFit, sameAreaSubject, type SameAreaCandidate } from '@/lib/cma/same-area-fit'
import { distanceMiles } from '@/lib/cma/market-area'
import { rankBestPool } from '@/lib/pricing/best-pool'
import {
  POOL_CAP,
  POOL_EXPIRED_MONTHS,
  POOL_NO_PLAT_SENTENCE,
  POOL_QUERY_HI,
  POOL_QUERY_LO,
  bathCountGap,
  keepHousePoolPlats,
  platLabelFromSlug,
  poolCompArea,
  poolCompetitionSentence,
  poolCompetitionSource,
  poolPlace,
  poolReadFailedSentence,
  poolWhere,
  wholeCountGap,
  type PoolMeta,
  type PoolPlat,
} from '@/lib/cma/pool-area'
import { attachCompConcessions } from '@/lib/pricing/seller-net'
import type { CompSelectionDiagnostics } from '@/lib/cma/comp-trace'
import type { CmaAdjustedComp, CmaSubject } from '@/lib/cma/types'

/** The fields of a priced sale the search story and the sales area read. */
type SalesAreaComp = Pick<
  CmaAdjustedComp,
  'address' | 'subdivision' | 'subdivisionSlug' | 'selectionTier' | 'latitude' | 'longitude' | 'ownPlat'
>

/**
 * The search story and the one sales area, off the sales that price. Pure.
 *
 * assembleCompetition reads it for the letter, and the build reads it BEFORE
 * any sale is adjusted for date, so the local listing-window read the
 * exclusive-pocket date gate acts on (Matt 2026-10-08, "Down only if local
 * fell") is measured over the same area as the local page that prints it.
 * None of the fields it reads moves with an adjustment.
 */
export function salesSearchAndArea(args: {
  subject: CmaSubject
  comps: readonly SalesAreaComp[]
  diagnostics: CompSelectionDiagnostics
  subjectZone: string | null
}) {
  const { subject } = args
  const compSearch = buildCompSearch({
    subdivision: args.diagnostics.subject.subdivision ?? subject.subdivision,
    subjectStreet: subject.streetAddress,
    ladder: args.diagnostics.ladder.map((t) => ({
      tier: t.tier,
      ran: t.ran,
      monthsBack: t.months_back,
      compsAdded: t.comps_added,
    })),
    keptComps: args.comps.map((c) => ({
      address: c.address,
      subdivision: c.subdivision,
      subdivisionSlug: c.subdivisionSlug ?? null,
      selectionTier: c.selectionTier,
      // The selector's own-plat call: a sale on the subject's plat under
      // another MLS spelling is inside the subdivision (reader review 2026-10-08).
      ownPlat: c.ownPlat ?? null,
    })),
    rural:
      args.diagnostics.rural_acreage || (subject.lotAcres ?? 0) >= 1
        ? { subjectZone: args.subjectZone, counts: args.diagnostics.excluded_totals }
        : null,
  })
  const compArea = buildCompArea({
    subject: {
      latitude: subject.latitude,
      longitude: subject.longitude,
      subdivision: args.diagnostics.subject.subdivision ?? subject.subdivision,
      subdivisionSlug: subject.subdivisionSlug ?? null,
      streetAddress: subject.streetAddress,
      city: subject.city,
    },
    rungs: (compSearch?.rungs ?? []).map((r) => ({ key: r.key, kept: r.kept, added: r.added })),
    keptComps: args.comps.map((c) => ({
      subdivision: c.subdivision,
      subdivisionSlug: c.subdivisionSlug ?? null,
      selectionTier: c.selectionTier,
      latitude: c.latitude,
      longitude: c.longitude,
      ownPlat: c.ownPlat ?? null,
    })),
  })
  return { compSearch, compArea }
}

/**
 * The grid the letter prints (render_args.comps): the priced sales with the
 * review's verdicts applied and each sale's recorded concession attached. One
 * function, so the build can read the on-market opinion of value off the same
 * grid before it assembles the competition around it (rule 27).
 */
export function printedCompGrid(
  comps: readonly CmaAdjustedComp[],
  verdicts: readonly { listingKey?: string; tier?: string; reason?: string }[],
) {
  return attachCompConcessions(applyCompVerdicts(comps, verdicts))
}

export async function assembleCompetition(args: {
  subject: CmaSubject
  comps: readonly CmaAdjustedComp[]
  verdicts: readonly { listingKey?: string; tier?: string; reason?: string }[]
  diagnostics: CompSelectionDiagnostics
  recommended: number
  subjectZone: string | null
  generatedAtIso: string
}) {
  const { subject } = args
  const renderComps = printedCompGrid(args.comps, args.verdicts)
  const parcels = await resolveCmaParcels({ subject, comps: renderComps }).catch(() => null)
  const { compSearch, compArea } = salesSearchAndArea({
    subject,
    comps: renderComps,
    diagnostics: args.diagnostics,
    subjectZone: args.subjectZone,
  })
  const lat = subject.latitude
  const lng = subject.longitude
  const centre =
    lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null
  const ring = centre ? await getSubdivisionRing(centre.lat, centre.lng) : null

  const noPlatArea: CompArea = {
    kind: 'subdivision',
    names: [],
    radiusMiles: null,
    centre,
    platSlugs: [],
    source: POOL_NO_PLAT_SENTENCE,
    sentence: POOL_NO_PLAT_SENTENCE,
  }

  let poolArea: CompArea | null = null
  let pool: PoolMeta | null = null
  let bandRivals: CmaBandRivalSet | null = null
  let widestAreaInventory: (CmaAreaBandInventory & { sameAreaFit: true }) | null = null
  let competitionRing: CompetitionRingPick<CmaBandListingRow> | null = null
  let rivalBand: { lo: number; hi: number } | null = null
  let unsoldArea: CompArea | null = null

  const readInventory = (area: CompArea) =>
    getCmaAreaBandInventory({
      area,
      city: subject.city,
      lo: POOL_QUERY_LO,
      hi: POOL_QUERY_HI,
      propertySubType: subject.propertySubType,
    }).catch(() => null)

  if (!ring || !centre) {
    bandRivals = {
      area: noPlatArea,
      lo: 0,
      hi: 0,
      activeCount: 0,
      pendingCount: 0,
      rivals: [],
      sentence: POOL_NO_PLAT_SENTENCE,
      source: POOL_NO_PLAT_SENTENCE,
      widenedFrom: null,
      ringsTried: [],
      shortOfFive: false,
      poolGeography: true,
    }
  } else {
    const fitBase = sameAreaSubject(subject)
    const hasNeighborhood = Boolean(ring.neighborhoodSlug) || Boolean(fitBase.marketArea)
    const ownSlug = ring.homeSlug
    const ownLabel = ring.homeLabel.trim() || platLabelFromSlug(ownSlug)
    const own: PoolPlat = { slug: ownSlug, label: ownLabel }
    const touching = keepHousePoolPlats(
      touchingPlatsForSearch(ring.ring, hasNeighborhood).filter((plat) => plat.slug !== ownSlug),
      subject.propertySubType,
      ownSlug,
    )
    const adjacent: PoolPlat[] = touching.map((plat) => ({
      slug: plat.slug,
      label: plat.label.trim() || platLabelFromSlug(plat.slug),
    }))
    const fitSubject = { ...fitBase, subdivision: ownLabel, subdivisionSlug: ownSlug }

    const rivalsOf = (inv: CmaAreaBandInventory): CmaBandRival[] =>
      [
        ...inv.activeRows.map((row) => bandRowToRival(row, 'Active')),
        ...inv.pendingRows.map((row) => bandRowToRival(row, 'Pending')),
      ].filter((row): row is CmaBandRival => row != null && !peerMatchesSubject(row, subject))

    const fitAll = (area: CompArea, rivals: readonly CmaBandRival[], meta: PoolMeta) => {
      const ownSlugs = new Set(meta.ownSlugs)
      const ownNames = new Set([meta.ownLabel.trim().toLowerCase()].filter(Boolean))
      const adjacentSlugs = new Set(meta.adjacentSlugs)
      const adjacentNames = new Set(meta.adjacentLabels.map((name) => name.trim().toLowerCase()).filter(Boolean))
      const nextSlugs = new Set(meta.openedNext ? meta.nextSlugs : [])
      const nextNames = new Set(
        (meta.openedNext ? meta.nextLabels : []).map((name) => name.trim().toLowerCase()).filter(Boolean),
      )
      const fitting: Array<{
        id: string
        place: ReturnType<typeof poolPlace>
        sqft: number | null
        bedsOff: number
        bathsOff: number
        yearBuilt: number | null
        ask: number
        miles: number | null
        rival: CmaBandRival
      }> = []
      for (const rival of rivals) {
        const candidate: SameAreaCandidate = {
          address: rival.address,
          subdivision: rival.subdivision,
          subdivisionSlug: rival.platSlug,
          latitude: rival.latitude,
          longitude: rival.longitude,
          beds: rival.beds,
          baths: rival.baths,
          bathsFull: rival.bathsFull ?? null,
          bathsHalf: rival.bathsHalf ?? null,
          sqft: rival.sqft,
          yearBuilt: rival.yearBuilt,
          propertySubType: rival.propertySubType,
          publicRemarks: rival.publicRemarks ?? null,
        }
        const fit = sameAreaFit(area, fitSubject, candidate)
        if (!fit.ok) continue
        fitting.push({
          id: rival.listingKey,
          place: poolPlace({
            ownPlat: fit.ownPlat,
            slug: rival.platSlug,
            name: rival.subdivision,
            ownSlugs,
            ownNames,
            adjacentSlugs,
            adjacentNames,
            nextSlugs,
            nextNames,
            openedNext: meta.openedNext,
          }),
          sqft: rival.sqft ?? null,
          bedsOff: wholeCountGap(fitSubject.beds, rival.beds),
          bathsOff: bathCountGap(fitSubject, rival),
          yearBuilt: rival.yearBuilt ?? null,
          ask: rival.listPrice,
          miles: distanceMiles(centre, { lat: rival.latitude, lng: rival.longitude }),
          rival: { ...rival, roomDifference: fit.roomDifference },
        })
      }
      return fitting
    }

    const metaOf = (next: readonly PoolPlat[], openedNext: boolean): PoolMeta => ({
      ownSlugs: [own.slug],
      adjacentSlugs: adjacent.map((plat) => plat.slug),
      nextSlugs: openedNext ? next.map((plat) => plat.slug) : [],
      ownLabel: own.label,
      adjacentLabels: adjacent.map((plat) => plat.label),
      nextLabels: openedNext ? next.map((plat) => plat.label) : [],
      openedNext,
    })

    const withoutRemarks = (rival: CmaBandRival): CmaBandRival => {
      if (rival.publicRemarks == null) return rival
      const { publicRemarks: _remarks, ...rest } = rival
      return rest
    }

    let openedNext = false
    let nextReadFailed = false
    let area = poolCompArea({ own, adjacent, next: [], openedNext: false, centre })
    let meta = metaOf([], false)
    const inventory = await readInventory(area)

    if (!inventory) {
      const where = poolWhere({ ownLabel: own.label, openedNext: false })
      bandRivals = {
        area,
        lo: 0,
        hi: 0,
        activeCount: 0,
        pendingCount: 0,
        rivals: [],
        sentence: poolReadFailedSentence(where),
        source: poolCompetitionSource({ ownLabel: own.label, openedNext: false, asOfIso: args.generatedAtIso }),
        widenedFrom: null,
        ringsTried: [],
        shortOfFive: false,
        poolGeography: true,
      }
      pool = meta
      poolArea = area
      unsoldArea = area
    } else {
      let fitting = fitAll(area, rivalsOf(inventory), meta)
      let sourceInventory = inventory
      if (fitting.length < POOL_CAP && touching.length > 0) {
        const neighborRings = await readNeighborRings(touching).catch(() => [])
        const nextSlugs = nextRowSubdivisionSlugs({
          subjectSlug: own.slug,
          firstRingSlugs: touching.map((plat) => plat.slug),
          neighborRings,
          subjectHasNeighborhood: hasNeighborhood,
        })
        const adjacentSet = new Set(adjacent.map((plat) => plat.slug))
        const nextPlats = keepHousePoolPlats(
          nextSlugs
            .filter((slug) => slug && slug !== own.slug && !adjacentSet.has(slug))
            .map((slug) => ({ slug, label: platLabelFromSlug(slug) })),
          subject.propertySubType,
          own.slug,
        )
        if (nextPlats.length > 0) {
          const expanded = poolCompArea({ own, adjacent, next: nextPlats, openedNext: true, centre })
          const second = await readInventory(expanded)
          if (second) {
            openedNext = true
            area = expanded
            meta = metaOf(nextPlats, true)
            sourceInventory = second
            fitting = fitAll(area, rivalsOf(second), meta)
          } else {
            nextReadFailed = true
          }
        }
      }

      const ranked = rankBestPool(
        fitting,
        {
          sqft: fitSubject.sqft,
          yearBuilt: fitSubject.yearBuilt,
          recommended: args.recommended > 0 ? args.recommended : null,
        },
        'active',
        POOL_CAP,
      )
      let printed = ranked.map((item) => withoutRemarks(item.rival))
      if (printed.length > 0) {
        const askChanges = await getListingAskChanges(printed.map((rival) => rival.listingKey)).catch((err) => {
          console.error('[assembleCompetition] ask changes', err instanceof Error ? err.message : String(err))
          return null
        })
        if (askChanges) {
          const rowByKey = new Map(
            [...sourceInventory.activeRows, ...sourceInventory.pendingRows].map((row) => [row.ListingKey, row]),
          )
          printed = printed.map((rival) => {
            const row = rowByKey.get(rival.listingKey)
            const next = row
              ? withRivalStretch(rival, bandRowStretch(row, askChanges.get(rival.listingKey) ?? []))
              : rival
            return withoutRemarks(next)
          })
        }
      }
      const asks = printed.map((rival) => rival.listPrice).filter((n) => Number.isFinite(n) && n > 0)
      const lo = asks.length > 0 ? Math.min(...asks) : 0
      const hi = asks.length > 0 ? Math.max(...asks) : 0
      const activeCount = printed.filter((rival) => rival.status === 'Active').length
      const pendingCount = printed.filter((rival) => rival.status === 'Pending').length
      const printedKeys = new Set(printed.map((rival) => rival.listingKey))
      const fittingActive = sourceInventory.activeRows.filter((row) => printedKeys.has(row.ListingKey))
      const fittingPending = sourceInventory.pendingRows.filter((row) => printedKeys.has(row.ListingKey))
      const nextNote = nextReadFailed ? ' The next row was not read.' : ''
      const citation = {
        ...sourceInventory.citation,
        filter: `${sourceInventory.citation.filter} ListPrice ${POOL_QUERY_LO}..${POOL_QUERY_HI} is a query ceiling, not a rule. The price was not a filter. The plats were. rankBestPool kept ${printed.length} of ${fitting.length}.${nextNote}`,
        rows: printed.length,
        rowsAfterAreaTest: printed.length,
      }
      widestAreaInventory = {
        ...sourceInventory,
        area,
        lo,
        hi,
        activeRows: fittingActive,
        pendingRows: fittingPending,
        activeCount: fittingActive.length,
        pendingCount: fittingPending.length,
        activeAsks: fittingActive.map((row) => Number(row.ListPrice)).filter((n) => Number.isFinite(n) && n > 0),
        activeDaysOnMarket: fittingActive
          .map((row) => daysSinceOnMarket(row.OnMarketDate))
          .filter((n): n is number => n != null),
        citation,
        sameAreaFit: true,
      }
      competitionRing = {
        area,
        ringsTried: [],
        widenedFrom: null,
        activeRows: fittingActive,
        pendingRows: fittingPending,
        activeCount,
        pendingCount,
      }
      rivalBand = asks.length > 0 ? { lo, hi } : null
      const roomNote = roomNotedSentence(printed, fitSubject)
      const heldBack = Math.max(0, fitting.length - printed.length)
      bandRivals = {
        area,
        lo,
        hi,
        activeCount,
        pendingCount,
        rivals: printed,
        sentence: poolCompetitionSentence({
          ownLabel: own.label,
          openedNext,
          activeCount,
          pendingCount,
          roomNote,
          heldBack,
        }),
        source: poolCompetitionSource({
          ownLabel: own.label,
          openedNext,
          asOfIso: args.generatedAtIso,
        }),
        widenedFrom: null,
        ringsTried: [],
        shortOfFive: false,
        poolGeography: true,
      }
      pool = meta
      poolArea = area
      unsoldArea = area
    }
  }

  const unsoldRead = unsoldArea
    ? await getCmaAreaUnsoldCycles({
        area: unsoldArea,
        city: subject.city,
        propertySubType: subject.propertySubType,
        priceLo: POOL_QUERY_LO,
        priceHi: POOL_QUERY_HI,
        months: POOL_EXPIRED_MONTHS,
      })
        .then((read) => (read?.failed ? null : read))
        .catch(() => null)
    : null

  return {
    renderComps,
    parcels,
    compSearch,
    compArea,
    competitionRings: poolArea ? [poolArea] : [],
    widestCompetitionRing: poolArea,
    peerBand: null,
    rivalBand,
    unsoldRead,
    widestAreaInventory,
    competitionRing,
    competitionArea: poolArea,
    bandRivals,
    pool,
  }
}

/**
 * Homes that came off unsold, on the same plats as the homes for sale
 * (Matt 2026-10-10). Thirty-six months. The rank keeps five.
 */
export function assembleExpiredPeers(args: {
  competition: Awaited<ReturnType<typeof assembleCompetition>>
  subject: CmaSubject
  lastCycleFailed: boolean
  now?: Date
}): { expiredPeers: CmaExpiredPeerSet | null; compsLookbackMonths: number } {
  const { competition, subject } = args
  const area = competition.competitionArea ?? competition.widestCompetitionRing
  const expiredPeers =
    area && competition.unsoldRead
      ? buildExpiredPeerSet({
          rows: competition.unsoldRead.rows,
          subject: {
            ...sameAreaSubject(subject),
            streetAddress: subject.streetAddress,
            listingKey: subject.listingKey,
            mlsNumber: subject.mlsNumber,
            ...(competition.pool
              ? {
                  subdivision: competition.pool.ownLabel,
                  subdivisionSlug: competition.pool.ownSlugs[0] ?? subject.subdivisionSlug,
                }
              : {}),
          },
          area,
          asOf: args.now ?? new Date(),
          keptCompMedianPpsf: keptCompMedianPpsf(competition.renderComps),
          closedSaleAddresses: competition.renderComps.map((c) => c.address),
          subjectCameOff: args.lastCycleFailed,
          liveAddresses: (competition.bandRivals?.rivals ?? []).map((rival) => rival.address),
          laterCycles: competition.unsoldRead.laterCycles ?? [],
          pool: competition.pool,
        })
      : null
  return { expiredPeers, compsLookbackMonths: POOL_EXPIRED_MONTHS }
}
