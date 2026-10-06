/**
 * The rival set the nudge reads, and the same rings the letter prints.
 * Loaded before the graded audit so that audit sees the list after the nudge.
 */

import { applyCompVerdicts } from '@/lib/cma/client-facing'
import { resolveCmaParcels } from '@/lib/cma/parcel-shapes'
import { buildCompSearch } from '@/lib/pricing/comp-search'
import {
  buildCompArea,
  competitionDistanceRings,
  COMPETITION_BEND_CAP_MILES,
  parentPlaceArea,
  resolveCompetitionArea,
  type CompArea,
} from '@/lib/pricing/comp-area'
import { getCmaAreaUnsoldCycles } from '@/lib/data/cma/areaUnsoldReads'
import { getCmaAreaBandInventory } from '@/lib/data/cma/bandInventory'
import { competitorUnsoldSubdivisionNames, marketAreaPriceBand } from '@/lib/cma/market-status'
import type { CmaMarketAreaRow } from '@/lib/data/cma/marketAreaReads'
import {
  bandAroundList,
  bandAroundListAt,
  bandRowToRival,
  buildBandRivalSet,
  chooseCompetitionBand,
  COMPETITION_BAND_STEPS,
  COMPETITION_GOOD_COUNT,
  COMPETITION_SHOWN_CAP,
  emptyCompetitionSet,
  pickCompetitionRing,
  rivalFitsSubject,
  type CmaBandRival,
  type CmaBandRivalSet,
} from '@/lib/cma/band-rivals'
import { attachCompConcessions } from '@/lib/pricing/seller-net'
import type { CompSelectionDiagnostics } from '@/lib/cma/comp-trace'
import type { CmaAdjustedComp, CmaSubject } from '@/lib/cma/types'

type CompetitionStep = {
  halfWidth: number
  band: { lo: number; hi: number }
  area: CompArea
  fitting: CmaBandRival[]
  all: CmaBandRival[]
}

/**
 * The sales plat is short of five homes a buyer would actually cross-shop.
 * Open the price band in that place, then the mapped neighborhood, then
 * quarter-mile rings. Stop at the first step that holds five homes within
 * one bedroom and 35 percent of the size. The city is not a ring.
 * Matt 2026-10-06. Same opening the expired chapter uses when three tight
 * matches are not there.
 */
async function widenShortPlatCompetition(args: {
  subject: CmaSubject
  recommended: number
  startArea: CompArea
  platFitting: number
  asOfIso: string
}): Promise<CmaBandRivalSet | null> {
  const fitSubject = {
    latitude: args.subject.latitude,
    longitude: args.subject.longitude,
    beds: args.subject.beds,
    sqft: args.subject.sqft,
  }
  const read = (area: CompArea, band: { lo: number; hi: number }) =>
    getCmaAreaBandInventory({
      area,
      city: args.subject.city,
      lo: band.lo,
      hi: band.hi,
      propertySubType: args.subject.propertySubType,
    }).catch(() => null)
  const asRivals = (
    inv: Awaited<ReturnType<typeof getCmaAreaBandInventory>>,
  ): CmaBandRival[] => {
    if (!inv) return []
    return [
      ...inv.activeRows.map((r) => bandRowToRival(r, 'Active')),
      ...inv.pendingRows.map((r) => bandRowToRival(r, 'Pending')),
    ].filter((r): r is CmaBandRival => r != null)
  }
  async function walk(area: CompArea): Promise<CompetitionStep | null> {
    const steps: CompetitionStep[] = []
    for (const halfWidth of COMPETITION_BAND_STEPS) {
      const band = bandAroundListAt(args.recommended, halfWidth)
      if (!band) continue
      const all = asRivals(await read(area, band))
      const fitting = all.filter((r) => rivalFitsSubject(r, fitSubject))
      steps.push({ halfWidth, band, area, fitting, all })
      if (fitting.length >= COMPETITION_GOOD_COUNT) break
    }
    return chooseCompetitionBand(steps)
  }
  function toSet(step: CompetitionStep, extra?: { widenedFrom: number | null; ringsTried: number[] }): CmaBandRivalSet {
    const use = step.fitting.length > 0 ? step.fitting : step.all
    return buildBandRivalSet({
      area: step.area,
      lo: step.band.lo,
      hi: step.band.hi,
      activeCount: use.filter((r) => r.status === 'Active').length,
      pendingCount: use.filter((r) => r.status === 'Pending').length,
      rivals: use,
      subject: fitSubject,
      cap: COMPETITION_SHOWN_CAP,
      asOfIso: args.asOfIso,
      widenedFrom: extra?.widenedFrom ?? null,
      ringsTried: extra?.ringsTried ?? [],
    })
  }
  let best = await walk(args.startArea)
  if (best && best.fitting.length >= COMPETITION_GOOD_COUNT) return toSet(best)
  const parent = parentPlaceArea({ latitude: args.subject.latitude, longitude: args.subject.longitude })
  if (parent) {
    const parentStep = await walk(parent)
    if (parentStep && parentStep.fitting.length > (best?.fitting.length ?? 0)) best = parentStep
    if (best && best.fitting.length >= COMPETITION_GOOD_COUNT) return toSet(best)
  }
  const rings = [
    ...(parent ? [parent] : []),
    ...competitionDistanceRings({
      latitude: args.subject.latitude,
      longitude: args.subject.longitude,
      capMiles: COMPETITION_BEND_CAP_MILES,
    }),
  ]
  const widest = rings[rings.length - 1]
  const widestBand = bandAroundListAt(args.recommended, COMPETITION_BAND_STEPS[COMPETITION_BAND_STEPS.length - 1]!)
  if (!widest || !widestBand) return best && best.fitting.length > args.platFitting ? toSet(best) : null
  const wideInv = await read(widest, widestBand)
  if (!wideInv) return best && best.fitting.length > args.platFitting ? toSet(best) : null
  const rowFits = (row: (typeof wideInv.activeRows)[number], status: 'Active' | 'Pending') => {
    const rival = bandRowToRival(row, status)
    return rival != null && rivalFitsSubject(rival, fitSubject)
  }
  const pick = pickCompetitionRing({
    rings,
    activeRows: wideInv.activeRows.filter((row) => rowFits(row, 'Active')),
    pendingRows: wideInv.pendingRows.filter((row) => rowFits(row, 'Pending')),
    min: COMPETITION_GOOD_COUNT,
  })
  const picked = pick.activeCount + pick.pendingCount
  if (picked <= (best?.fitting.length ?? args.platFitting)) {
    return best && best.fitting.length > args.platFitting ? toSet(best) : null
  }
  const pickedRivals = [
    ...pick.activeRows.map((r) => bandRowToRival(r, 'Active')),
    ...pick.pendingRows.map((r) => bandRowToRival(r, 'Pending')),
  ].filter((r): r is CmaBandRival => r != null)
  return buildBandRivalSet({
    area: pick.area,
    lo: widestBand.lo,
    hi: widestBand.hi,
    activeCount: pickedRivals.filter((r) => r.status === 'Active').length,
    pendingCount: pickedRivals.filter((r) => r.status === 'Pending').length,
    rivals: pickedRivals,
    subject: fitSubject,
    cap: COMPETITION_SHOWN_CAP,
    asOfIso: args.asOfIso,
    widenedFrom: pick.widenedFrom,
    ringsTried: pick.ringsTried,
  })
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
  const renderComps = attachCompConcessions(applyCompVerdicts(args.comps, args.verdicts))
  const parcels = await resolveCmaParcels({ subject, comps: renderComps }).catch(() => null)
  const compSearch = buildCompSearch({
    subdivision: args.diagnostics.subject.subdivision ?? subject.subdivision,
    subjectStreet: subject.streetAddress,
    ladder: args.diagnostics.ladder.map((t) => ({
      tier: t.tier,
      ran: t.ran,
      monthsBack: t.months_back,
      compsAdded: t.comps_added,
    })),
    keptComps: renderComps.map((c) => ({
      address: c.address,
      subdivision: c.subdivision,
      selectionTier: c.selectionTier,
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
      city: subject.city,
    },
    rungs: (compSearch?.rungs ?? []).map((r) => ({ key: r.key, kept: r.kept, added: r.added })),
    keptComps: renderComps.map((c) => ({
      subdivision: c.subdivision,
      selectionTier: c.selectionTier,
      latitude: c.latitude,
      longitude: c.longitude,
    })),
  })
  const competitionRings = compArea
    ? resolveCompetitionArea({
        compArea,
        subject: {
          latitude: subject.latitude,
          longitude: subject.longitude,
          city: subject.city,
        },
        keptComps: renderComps.map((c) => ({
          subdivision: c.subdivision,
          selectionTier: c.selectionTier,
          latitude: c.latitude,
          longitude: c.longitude,
        })),
      }).filter((r) => r.kind !== 'city')
    : []
  const widestCompetitionRing = competitionRings.length > 0 ? competitionRings[competitionRings.length - 1]! : null
  const peerBand = marketAreaPriceBand(args.recommended || subject.lastListPrice || 0)
  const rivalBand = bandAroundList(args.recommended)
  const [unsoldRead, widestAreaInventory] = await Promise.all([
    widestCompetitionRing && peerBand
      ? getCmaAreaUnsoldCycles({
          area: widestCompetitionRing,
          city: subject.city,
          propertySubType: subject.propertySubType,
          priceLo: peerBand.lo,
          priceHi: peerBand.hi,
        }).catch(() => null)
      : Promise.resolve(null),
    widestCompetitionRing && rivalBand
      ? getCmaAreaBandInventory({
          area: widestCompetitionRing,
          city: subject.city,
          lo: rivalBand.lo,
          hi: rivalBand.hi,
          propertySubType: subject.propertySubType,
        }).catch(() => null)
      : Promise.resolve(null),
  ])
  const competitionRing =
    widestAreaInventory && competitionRings.length > 0
      ? pickCompetitionRing({
          rings: competitionRings,
          activeRows: widestAreaInventory.activeRows,
          pendingRows: widestAreaInventory.pendingRows,
        })
      : null
  const competitionArea = competitionRing?.area ?? widestCompetitionRing
  let bandRivals =
    competitionRing && widestAreaInventory
      ? buildBandRivalSet({
          area: competitionRing.area,
          lo: widestAreaInventory.lo,
          hi: widestAreaInventory.hi,
          activeCount: competitionRing.activeCount,
          pendingCount: competitionRing.pendingCount,
          rivals: [
            ...competitionRing.activeRows.map((r) => bandRowToRival(r, 'Active')),
            ...competitionRing.pendingRows.map((r) => bandRowToRival(r, 'Pending')),
          ].filter((r): r is NonNullable<typeof r> => r != null),
          subject: {
            latitude: subject.latitude,
            longitude: subject.longitude,
            beds: subject.beds,
            sqft: subject.sqft,
          },
          asOfIso: args.generatedAtIso,
          widenedFrom: competitionRing.widenedFrom,
          ringsTried: competitionRing.ringsTried,
          cap: COMPETITION_SHOWN_CAP,
        })
      : null
  const recommended = args.recommended || subject.lastListPrice || 0
  const uncappedPlat = [
    ...(competitionRing?.activeRows ?? widestAreaInventory?.activeRows ?? []).map((r) => bandRowToRival(r, 'Active')),
    ...(competitionRing?.pendingRows ?? widestAreaInventory?.pendingRows ?? []).map((r) => bandRowToRival(r, 'Pending')),
  ].filter((r): r is CmaBandRival => r != null)
  const platFitting = uncappedPlat.filter((r) =>
    rivalFitsSubject(r, {
      beds: subject.beds,
      sqft: subject.sqft,
    }),
  ).length
  if (
    recommended > 0 &&
    compArea &&
    widestCompetitionRing &&
    (compArea.kind === 'subdivision' || compArea.kind === 'subdivisions') &&
    platFitting < COMPETITION_GOOD_COUNT
  ) {
    const widened = await widenShortPlatCompetition({
      subject,
      recommended,
      startArea: widestCompetitionRing,
      platFitting,
      asOfIso: args.generatedAtIso,
    })
    if (widened && widened.rivals.length > (bandRivals?.rivals.length ?? 0)) bandRivals = widened
  }
  if (!bandRivals && rivalBand && compArea) {
    bandRivals = emptyCompetitionSet({
      rings: competitionRings,
      compArea,
      lo: rivalBand.lo,
      hi: rivalBand.hi,
    })
  }
  // Expireds follow the subdivisions actually drawn as competition. Not the
  // parent neighborhood, and not a mile ring. The peer set uses these rows
  // only when the sales plats are still short of three close matches.
  let rivalUnsoldRows: CmaMarketAreaRow[] = []
  const salesNames =
    widestCompetitionRing &&
    (widestCompetitionRing.kind === 'subdivision' || widestCompetitionRing.kind === 'subdivisions')
      ? widestCompetitionRing.names
      : []
  const extraNames = competitorUnsoldSubdivisionNames(bandRivals?.rivals ?? [], salesNames)
  if (extraNames.length > 0 && peerBand && subject.city.trim()) {
    const extraArea: CompArea = {
      kind: extraNames.length === 1 ? 'subdivision' : 'subdivisions',
      names: extraNames,
      radiusMiles: null,
      centre: widestCompetitionRing?.centre ?? null,
      source: 'subdivisions of the homes drawn as competition',
      sentence: '',
    }
    const extra = await getCmaAreaUnsoldCycles({
      area: extraArea,
      city: subject.city,
      propertySubType: subject.propertySubType,
      priceLo: peerBand.lo,
      priceHi: peerBand.hi,
    }).catch(() => null)
    rivalUnsoldRows = extra?.rows ?? []
  }
  return {
    renderComps,
    parcels,
    compSearch,
    compArea,
    competitionRings,
    widestCompetitionRing,
    peerBand,
    rivalBand,
    unsoldRead,
    rivalUnsoldRows,
    widestAreaInventory,
    competitionRing,
    competitionArea,
    bandRivals,
  }
}
