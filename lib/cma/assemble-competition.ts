/**
 * The rival set the nudge reads, and the same rings the letter prints.
 * Loaded before the graded audit so that audit sees the list after the nudge.
 */

import { applyCompVerdicts } from '@/lib/cma/client-facing'
import { resolveCmaParcels } from '@/lib/cma/parcel-shapes'
import { buildCompSearch } from '@/lib/pricing/comp-search'
import { buildCompArea, resolveCompetitionArea } from '@/lib/pricing/comp-area'
import { getCmaAreaUnsoldCycles } from '@/lib/data/cma/areaUnsoldReads'
import { getCmaAreaBandInventory } from '@/lib/data/cma/bandInventory'
import { marketAreaPriceBand } from '@/lib/cma/market-status'
import {
  bandAroundList,
  bandRowToRival,
  buildBandRivalSet,
  emptyCompetitionSet,
  pickCompetitionRing,
} from '@/lib/cma/band-rivals'
import { attachCompConcessions } from '@/lib/pricing/seller-net'
import type { CompSelectionDiagnostics } from '@/lib/cma/comp-trace'
import type { CmaAdjustedComp, CmaSubject } from '@/lib/cma/types'

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
    ladder: args.diagnostics.ladder.map((t) => ({
      tier: t.tier,
      ran: t.ran,
      monthsBack: t.months_back,
      compsAdded: t.comps_added,
    })),
    keptComps: renderComps.map((c) => ({
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
