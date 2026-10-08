/**
 * The rival set the nudge reads, and the expired set the letter prints, both
 * inside the sales area and by the sales rules (Matt 2026-10-07, rule 24).
 * Loaded before the graded audit so that audit sees the list after the nudge.
 */

import { applyCompVerdicts } from '@/lib/cma/client-facing'
import { resolveCmaParcels } from '@/lib/cma/parcel-shapes'
import { buildCompSearch } from '@/lib/pricing/comp-search'
import { buildCompArea, resolveCompetitionArea } from '@/lib/pricing/comp-area'
import { getCmaAreaUnsoldCycles } from '@/lib/data/cma/areaUnsoldReads'
import {
  getCmaAreaBandInventory,
  type CmaAreaBandInventory,
  type CmaBandListingRow,
} from '@/lib/data/cma/bandInventory'
import {
  buildExpiredPeerSet,
  keptCompMedianPpsf,
  marketAreaPriceBand,
  peerMatchesSubject,
  type CmaExpiredPeerSet,
} from '@/lib/cma/market-status'
import {
  bandAroundList,
  bandAroundListAt,
  bandRowToRival,
  buildBandRivalSet,
  chooseCompetitionBand,
  COMPETITION_BAND_STEPS,
  COMPETITION_GOOD_COUNT,
  COMPETITION_SHOWN_CAP,
  daysSinceOnMarket,
  emptyCompetitionSet,
  type CmaBandRival,
  type CmaBandRivalSet,
  type CompetitionRingPick,
} from '@/lib/cma/band-rivals'
import { sameAreaFit, sameAreaSubject, type SameAreaFit } from '@/lib/cma/same-area-fit'
import { attachCompConcessions } from '@/lib/pricing/seller-net'
import type { CompSelectionDiagnostics } from '@/lib/cma/comp-trace'
import type { CmaAdjustedComp, CmaSubject } from '@/lib/cma/types'

/** One price step inside the sales area: every home the band holds, and the ones that pass the rules. */
type BandStep = {
  halfWidth: number
  band: { lo: number; hi: number }
  all: CmaBandRival[]
  fitting: CmaBandRival[]
}

function rowsInBand(rows: readonly CmaBandListingRow[], band: { lo: number; hi: number }): CmaBandListingRow[] {
  return rows.filter((r) => {
    const price = Number(r.ListPrice)
    return Number.isFinite(price) && price >= band.lo && price <= band.hi
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
      subdivisionSlug: subject.subdivisionSlug ?? null,
      streetAddress: subject.streetAddress,
      city: subject.city,
    },
    rungs: (compSearch?.rungs ?? []).map((r) => ({ key: r.key, kept: r.kept, added: r.added })),
    keptComps: renderComps.map((c) => ({
      subdivision: c.subdivision,
      subdivisionSlug: c.subdivisionSlug ?? null,
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
  const firstBand = bandAroundList(args.recommended)
  const [unsoldRead, firstInventory] = await Promise.all([
    widestCompetitionRing && peerBand
      ? getCmaAreaUnsoldCycles({
          area: widestCompetitionRing,
          city: subject.city,
          propertySubType: subject.propertySubType,
          priceLo: peerBand.lo,
          priceHi: peerBand.hi,
        }).catch(() => null)
      : Promise.resolve(null),
    widestCompetitionRing && firstBand
      ? getCmaAreaBandInventory({
          area: widestCompetitionRing,
          city: subject.city,
          lo: firstBand.lo,
          hi: firstBand.hi,
          propertySubType: subject.propertySubType,
        }).catch(() => null)
      : Promise.resolve(null),
  ])

  // THE ONE AREA, THE ONE FIT (Matt 2026-10-07, rule 24). Every home the
  // chapter counts sits inside the sales area and passes the same rules the
  // sales passed. When a short recorded plat holds fewer than five such homes
  // at ±10%, the price band opens one step at a time INSIDE that area, never
  // the parent neighborhood, never a quarter-mile ring. One extra read at
  // most: the ±25% band is a superset of every step, so the rest is a walk in
  // memory, the same shape as the expired window ladder.
  const fitSubject = sameAreaSubject(subject)
  // One fit per listing, however many band steps hold it.
  const fits = new Map<string, SameAreaFit>()
  const fitOf = (r: CmaBandRival): SameAreaFit => {
    const known = fits.get(r.listingKey)
    if (known) return known
    const fit = sameAreaFit(widestCompetitionRing, fitSubject, {
      address: r.address,
      subdivision: r.subdivision,
      latitude: r.latitude,
      longitude: r.longitude,
      beds: r.beds,
      baths: r.baths,
      sqft: r.sqft,
      yearBuilt: r.yearBuilt,
      propertySubType: r.propertySubType,
      publicRemarks: r.publicRemarks ?? null,
    })
    fits.set(r.listingKey, fit)
    return fit
  }
  // The subject's own listing is never its competition: a home on the market
  // sits inside its own band and came back as "1 home like yours is for sale"
  // (3062 NW Kelly Hill, reader review 2026-10-08). Out by listing key, and by
  // address for any other record of the same house.
  const toRivals = (inv: CmaAreaBandInventory): CmaBandRival[] =>
    [
      ...inv.activeRows.map((r) => bandRowToRival(r, 'Active')),
      ...inv.pendingRows.map((r) => bandRowToRival(r, 'Pending')),
    ].filter((r): r is CmaBandRival => r != null && !peerMatchesSubject(r, subject))
  const stamp = (all: readonly CmaBandRival[]): CmaBandRival[] =>
    all.flatMap((r) => {
      const fit = fitOf(r)
      return fit.ok ? [{ ...r, roomDifference: fit.roomDifference }] : []
    })
  const steps: BandStep[] = []
  if (firstInventory && firstBand) {
    const all = toRivals(firstInventory)
    steps.push({ halfWidth: COMPETITION_BAND_STEPS[0], band: firstBand, all, fitting: stamp(all) })
  }
  let wideInventory: CmaAreaBandInventory | null = null
  // True when the ladder needed the ±25% read and it failed. The ±10% count
  // stands and the letter sentence does not change, but the citation says
  // the band was never opened, so a reviewer can tell a short ±10% set from
  // one the ladder walked.
  let wideReadFailed = false
  const recommended = args.recommended || subject.lastListPrice || 0
  const shortPlat =
    compArea != null && (compArea.kind === 'subdivision' || compArea.kind === 'subdivisions')
  if (
    steps[0] &&
    widestCompetitionRing &&
    recommended > 0 &&
    shortPlat &&
    steps[0].fitting.length < COMPETITION_GOOD_COUNT
  ) {
    const widest = bandAroundListAt(recommended, COMPETITION_BAND_STEPS[COMPETITION_BAND_STEPS.length - 1]!)
    wideInventory = widest
      ? await getCmaAreaBandInventory({
          area: widestCompetitionRing,
          city: subject.city,
          lo: widest.lo,
          hi: widest.hi,
          propertySubType: subject.propertySubType,
        }).catch(() => null)
      : null
    if (widest && !wideInventory) wideReadFailed = true
    if (wideInventory) {
      const wideAll = toRivals(wideInventory)
      for (const halfWidth of COMPETITION_BAND_STEPS.slice(1)) {
        const band = bandAroundListAt(recommended, halfWidth)
        if (!band) continue
        const all = wideAll.filter((r) => r.listPrice >= band.lo && r.listPrice <= band.hi)
        const fitting = stamp(all)
        steps.push({ halfWidth, band, all, fitting })
        if (fitting.length >= COMPETITION_GOOD_COUNT) break
      }
    }
  }
  const chosen = chooseCompetitionBand(steps)

  // The returned objects describe the PRINTED band and the FITTING set, so
  // buildCmaExtras (the listing plan's "homes like yours are for sale in this
  // band"), the nudge and the citations in lib/cma/build.ts all read the one
  // count the sentence states (rule 17) with no edit there. An opened band is
  // cut from the wide read by ListPrice, and its citation names that band,
  // not the wide read's.
  const rivalBand = chosen?.band ?? firstBand
  // `sameAreaFit: true` tells buildCmaExtras these rows are the fitting set,
  // so citations.price_band.source does not call them the whole band.
  let widestAreaInventory: (CmaAreaBandInventory & { sameAreaFit: true }) | null = null
  let competitionRing: CompetitionRingPick<CmaBandListingRow> | null = null
  let bandRivals: CmaBandRivalSet | null = null
  if (chosen && widestCompetitionRing) {
    const opened = chosen.halfWidth > COMPETITION_BAND_STEPS[0]
    const source = opened ? wideInventory : firstInventory
    if (source) {
      const activeRows = opened ? rowsInBand(source.activeRows, chosen.band) : source.activeRows
      const pendingRows = opened ? rowsInBand(source.pendingRows, chosen.band) : source.pendingRows
      const fittingKeys = new Set(chosen.fitting.map((r) => r.listingKey))
      const fittingActive = activeRows.filter((r) => fittingKeys.has(r.ListingKey))
      const fittingPending = pendingRows.filter((r) => fittingKeys.has(r.ListingKey))
      const pct = (halfWidth: number) => `±${Math.round(halfWidth * 100)}%`
      const stepsNote =
        steps.length > 1
          ? `; band steps tried ${steps.map((s) => pct(s.halfWidth)).join('/')} inside the same area, never a wider place (Matt 2026-10-07)`
          : ''
      const wideFailedNote = wideReadFailed
        ? `; the ±${Math.round(COMPETITION_BAND_STEPS[COMPETITION_BAND_STEPS.length - 1]! * 100)}% band read failed, so the band was never opened; the ±${Math.round(
            COMPETITION_BAND_STEPS[0] * 100,
          )}% count stands`
        : ''
      const openedNote = opened
        ? `; band opened from ±10% to ${pct(chosen.halfWidth)}, read once at ${pct(
            COMPETITION_BAND_STEPS[COMPETITION_BAND_STEPS.length - 1]!,
          )} (ListPrice ${source.lo}..${source.hi}, ${source.citation.rowsAfterAreaTest} rows) and cut to this band in memory`
        : ''
      const citation = {
        ...source.citation,
        filter: `${
          opened
            ? source.citation.filter.replace(
                `ListPrice ${source.lo}..${source.hi}`,
                `ListPrice ${chosen.band.lo}..${chosen.band.hi}`,
              )
            : source.citation.filter
        }${stepsNote}${openedNote}${wideFailedNote}; sameAreaFit kept ${chosen.fitting.length} of ${chosen.all.length}`,
        rows: opened ? activeRows.length + pendingRows.length : source.citation.rows,
        rowsAfterAreaTest: opened ? activeRows.length + pendingRows.length : source.citation.rowsAfterAreaTest,
      }
      widestAreaInventory = {
        ...source,
        lo: chosen.band.lo,
        hi: chosen.band.hi,
        activeRows: fittingActive,
        pendingRows: fittingPending,
        activeCount: fittingActive.length,
        pendingCount: fittingPending.length,
        activeAsks: fittingActive.map((r) => Number(r.ListPrice)).filter((n) => Number.isFinite(n) && n > 0),
        activeDaysOnMarket: fittingActive
          .map((r) => daysSinceOnMarket(r.OnMarketDate))
          .filter((n): n is number => n != null),
        citation,
        sameAreaFit: true,
      }
      competitionRing = {
        area: widestCompetitionRing,
        ringsTried: [],
        widenedFrom: null,
        activeRows: fittingActive,
        pendingRows: fittingPending,
        activeCount: fittingActive.length,
        pendingCount: fittingPending.length,
      }
      bandRivals = buildBandRivalSet({
        area: widestCompetitionRing,
        lo: chosen.band.lo,
        hi: chosen.band.hi,
        activeCount: fittingActive.length,
        pendingCount: fittingPending.length,
        unlikeCount: chosen.all.length - chosen.fitting.length,
        // True when the band ladder was walked and still holds fewer than
        // five, whichever step printed (a tie keeps the tighter band). The
        // citation above records every step tried.
        shortOfFive: steps.length > 1 && chosen.fitting.length < COMPETITION_GOOD_COUNT,
        rivals: chosen.fitting,
        subject: fitSubject,
        cap: COMPETITION_SHOWN_CAP,
        asOfIso: args.generatedAtIso,
        widenedFrom: null,
        ringsTried: [],
      })
    }
  }
  const competitionArea = widestCompetitionRing
  if (!bandRivals && rivalBand && compArea) {
    bandRivals = emptyCompetitionSet({
      rings: competitionRings,
      compArea,
      lo: rivalBand.lo,
      hi: rivalBand.hi,
    })
  }
  // The range is read around the list BEFORE the homes in it are weighed
  // (they are what the active-days pull reads), so it cannot be centered on
  // the final list without depending on itself. The letter says what it is
  // centered on, and whether it opened past ±10% (competition-band-basis.ts).
  if (bandRivals && rivalBand && args.recommended > 0) {
    bandRivals = {
      ...bandRivals,
      bandBasis: {
        center: args.recommended,
        // rivalBand is chosen.band whenever a step was chosen, else the ±10% band.
        halfWidth: chosen?.halfWidth ?? COMPETITION_BAND_STEPS[0],
        baseHalfWidth: COMPETITION_BAND_STEPS[0],
      },
    }
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

/**
 * The homes that came off unsold, from the SAME one ring the competition was
 * read over and by the same rules (Matt 2026-10-07, rule 24). The build and
 * the dry run both call this, so a dry-run score equals a build's.
 */
export function assembleExpiredPeers(args: {
  competition: Awaited<ReturnType<typeof assembleCompetition>>
  subject: CmaSubject
  lastCycleFailed: boolean
  now?: Date
}): { expiredPeers: CmaExpiredPeerSet | null; compsLookbackMonths: number } {
  const { competition, subject } = args
  const now = args.now ?? new Date()
  // Same lookback as the closed sales that set the price. No older expireds
  // from a longer window than the solds (Matt ADD 2026-09-12).
  const ages = competition.renderComps
    .map((c) => {
      const iso = (c.closeDate ?? '').slice(0, 10)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null
      const ms = now.getTime() - Date.parse(`${iso}T12:00:00.000Z`)
      if (!Number.isFinite(ms) || ms < 0) return null
      return Math.ceil(ms / (1000 * 60 * 60 * 24 * 30.44))
    })
    .filter((n): n is number => n != null && n > 0)
  const compsLookbackMonths = ages.length > 0 ? Math.max(3, Math.max(...ages)) : 12
  const area = competition.widestCompetitionRing
  // `unsoldRead` was already read over this one ring; there is no ring loop.
  // An EMPTY read still produces a sentence ("No home in X came off"). A
  // FAILED read produces no set at all: a read that threw is not evidence
  // that nothing came off (§0), and the citation says `source: none`.
  const expiredPeers =
    area && competition.unsoldRead
      ? buildExpiredPeerSet({
          rows: competition.unsoldRead.rows,
          subject: {
            ...sameAreaSubject(subject),
            streetAddress: subject.streetAddress,
            listingKey: subject.listingKey,
            mlsNumber: subject.mlsNumber,
          },
          area,
          asOf: now,
          keptCompMedianPpsf: keptCompMedianPpsf(competition.renderComps),
          maxWindowMonths: compsLookbackMonths,
          closedSaleAddresses: competition.renderComps.map((c) => c.address),
          subjectCameOff: args.lastCycleFailed,
          liveAddresses: (competition.bandRivals?.rivals ?? []).map((rival) => rival.address),
        })
      : null
  return { expiredPeers, compsLookbackMonths }
}
