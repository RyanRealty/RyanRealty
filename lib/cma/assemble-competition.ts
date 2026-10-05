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
import { getCmaAreaBandInventory, type CmaAreaBandInventory } from '@/lib/data/cma/bandInventory'
import { marketAreaPriceBand } from '@/lib/cma/market-status'
import {
  bandAroundList,
  bandRowToRival,
  buildBandRivalSet,
  COMPETITION_RING_MIN,
  emptyCompetitionSet,
  pickCompetitionRing,
  type CmaBandRivalSet,
} from '@/lib/cma/band-rivals'
import { attachCompConcessions } from '@/lib/pricing/seller-net'
import type { CompSelectionDiagnostics } from '@/lib/cma/comp-trace'
import type { CmaAdjustedComp, CmaSubject } from '@/lib/cma/types'

function setFromInventory(
  area: CompArea,
  inv: CmaAreaBandInventory,
  subject: CmaSubject,
  asOfIso: string,
): CmaBandRivalSet {
  return buildBandRivalSet({
    area,
    lo: inv.lo,
    hi: inv.hi,
    activeCount: inv.activeCount,
    pendingCount: inv.pendingCount,
    rivals: [
      ...inv.activeRows.map((r) => bandRowToRival(r, 'Active')),
      ...inv.pendingRows.map((r) => bandRowToRival(r, 'Pending')),
    ].filter((r): r is NonNullable<typeof r> => r != null),
    subject: {
      latitude: subject.latitude,
      longitude: subject.longitude,
      beds: subject.beds,
      sqft: subject.sqft,
    },
    asOfIso,
  })
}

/**
 * The sales plat has fewer than three homes in the band. Continue to the
 * mapped neighborhood, then quarter-mile rings, and stop at the first place
 * that holds three. The city is not a ring.
 */
async function widenShortPlatCompetition(args: {
  subject: CmaSubject
  rivalBand: { lo: number; hi: number }
  platCount: number
  asOfIso: string
}): Promise<CmaBandRivalSet | null> {
  const read = (area: CompArea) =>
    getCmaAreaBandInventory({
      area,
      city: args.subject.city,
      lo: args.rivalBand.lo,
      hi: args.rivalBand.hi,
      propertySubType: args.subject.propertySubType,
    }).catch(() => null)
  const parent = parentPlaceArea({ latitude: args.subject.latitude, longitude: args.subject.longitude })
  if (parent) {
    const parentInv = await read(parent)
    const n = (parentInv?.activeCount ?? 0) + (parentInv?.pendingCount ?? 0)
    if (parentInv && n >= COMPETITION_RING_MIN) return setFromInventory(parent, parentInv, args.subject, args.asOfIso)
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
  if (!widest) return null
  const wideInv = await read(widest)
  if (!wideInv) return null
  const pick = pickCompetitionRing({
    rings,
    activeRows: wideInv.activeRows,
    pendingRows: wideInv.pendingRows,
  })
  if (pick.activeCount + pick.pendingCount <= args.platCount) return null
  return buildBandRivalSet({
    area: pick.area,
    lo: wideInv.lo,
    hi: wideInv.hi,
    activeCount: pick.activeCount,
    pendingCount: pick.pendingCount,
    rivals: [
      ...pick.activeRows.map((r) => bandRowToRival(r, 'Active')),
      ...pick.pendingRows.map((r) => bandRowToRival(r, 'Pending')),
    ].filter((r): r is NonNullable<typeof r> => r != null),
    subject: {
      latitude: args.subject.latitude,
      longitude: args.subject.longitude,
      beds: args.subject.beds,
      sqft: args.subject.sqft,
    },
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
        })
      : null
  const platCount =
    (competitionRing?.activeCount ?? widestAreaInventory?.activeCount ?? 0) +
    (competitionRing?.pendingCount ?? widestAreaInventory?.pendingCount ?? 0)
  if (
    rivalBand &&
    compArea &&
    (compArea.kind === 'subdivision' || compArea.kind === 'subdivisions') &&
    platCount < COMPETITION_RING_MIN
  ) {
    const widened = await widenShortPlatCompetition({
      subject,
      rivalBand,
      platCount,
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
    widestAreaInventory,
    competitionRing,
    competitionArea,
    bandRivals,
  }
}
