/**
 * Dry-run the CMA engine on a slug and print what it would produce. WRITES NOTHING.
 *
 * WHY THIS EXISTS. `scripts/_rebuild-cma.ts --dry-run` prints the row and exits
 * without calling the engine, and a real `buildCma` clears and rewrites the live
 * `cmas` row on every failure path (recordBuildFailure). So "would this subject
 * build now, and at what price" had no answer that did not first destroy the
 * evidence of why it failed before. This runs the same deterministic path the
 * build runs — resolve subject, walk the ladder, adjust, price, grade against
 * the accuracy contract — against production data, and prints the comp list,
 * the price, and every hard check that failed.
 *
 *   npx tsx scripts/cma-build-dryrun.ts cma-16083-dyke-la-pine [more slugs...]
 *   npx tsx scripts/cma-build-dryrun.ts --json <slug>
 *   npx tsx scripts/cma-build-dryrun.ts --pocket-legacy <slug>
 *
 * An exclusive-pocket set is priced the way the build prices it: the letter's
 * local read is measured first, and a sale moves down with the city index
 * only when that read fell (Matt 2026-10-08, "Down only if local fell"), then
 * the pocket's band finish runs (lib/cma/pocket-pricing.ts). `--pocket-legacy`
 * prices the pocket without the local gate, the always-down walk the build
 * used before that ruling, so the two can be compared on one home.
 *
 * NOT a full build: the LLM comparability judge and the adversarial audit are
 * skipped on purpose (they cost money and they can only REMOVE comps, so a
 * contract pass here is the ceiling, not a promise). It is the deterministic
 * half — selection, pricing, and the hard gates — which is where every one of
 * the 2026-09-07 build failures died.
 */
import { config as loadEnv } from 'dotenv'
loadEnv({ path: '.env.local' })
loadEnv()
import path from 'node:path'
import Module from 'node:module'

// `server-only` throws outside a Next server component and lib/data imports it.
// Same resolve-time substitution scripts/_rebuild-cma.ts uses; every import
// below is dynamic so it cannot hoist above the hook.
const STUB = path.resolve(__dirname, '../test/server-only-stub.ts')
const CACHE_STUB = path.resolve(__dirname, '../test/next-cache-cli-stub.ts')
const resolveFilename = (Module as unknown as { _resolveFilename: (r: string, ...a: unknown[]) => string })._resolveFilename
;(Module as unknown as { _resolveFilename: unknown })._resolveFilename = function (
  this: unknown,
  request: string,
  ...args: unknown[]
) {
  const req =
    request === 'server-only' || request === 'client-only'
      ? STUB
      : request === 'next/cache'
        ? CACHE_STUB
        : request
  return resolveFilename.call(this, req, ...args)
}

type DryRun = {
  slug: string
  ok: boolean
  stage: 'subject' | 'comps' | 'pricing' | 'contract' | 'complete'
  address: string | null
  city: string | null
  subjectBaths: number | null
  subjectSqft: number | null
  customOrNew: boolean | null
  pricingSource: string | null
  compCount: number
  comps: Array<{ key: string; address: string; baths: number | null; sqft: number; closePrice: number; closeDate: string; adjusted: number; concessions: number | null; date?: number; size?: number; onMarketDate?: string | null; offerFrom?: string | null; daysToOffer?: number | null; domTotal?: number | null }>
  /**
   * The exclusive pocket's date gate (Matt 2026-10-08): whether the set is a
   * pocket, which mode priced it, and the local read the gate acted on.
   */
  pocketDate?: {
    exclusivePocket: boolean
    mode: 'gated' | 'legacy'
    branch: string | null
    verdict: string | null
    missing: string | null
    place: string | null
    sized: boolean
    early: unknown
    late: unknown
    listingWindow: { listDate: string | null; offDate: string | null }
  } | null
  recommended: number | null
  /** The list tiers: conservative and high end. */
  range: [number | null, number | null]
  /** What the home is worth: the spread of the printed adjusted sale prices. */
  valueRange: [number | null, number | null]
  confidence: string | null
  compPpsfCv: number | null
  needsReview: boolean
  reviewReason: string | null
  hardFailures: string[]
  /**
   * §0 rule 5 cross-checks the look pass caught on 2026-09-07. Both are the
   * numbers the DOCUMENT prints, read the way the renderers read them.
   *  - matrixSubjectDom: the DOM lib/cma/comp-matrix.ts pulls out of
   *    `render_args.subject.listingHistoryLine`;
   *  - reviewSubjectDom: the DOM the "your last listing" time-on-market
   *    finding prints. These two must be equal.
   *  - concessionSentence: the line lib/cma/render-pricing-page.ts prints
   *    under the matrix; its denominator must equal keptCompCount.
   */
  matrixSubjectDom: number | null
  reviewSubjectDom: number | null
  keptCompCount: number
  /**
   * Refill from the same rung (Matt 2026-10-08, lib/cma/review-refill.ts):
   * the rung that reached five, whether it widened the area, and the sales
   * it still holds for the comparability review to refill from, in the rung's
   * order. The judge is skipped here, so this is the same bench the build
   * would draw on, not a refill that happened.
   */
  refillBench: { rung: string | null; widening: boolean; held: number; keys: string[] } | null
  /**
   * The home's independent price anchor and the one 20% line around it (Matt
   * 2026-10-08, lib/pricing/price-tier.ts): the line the search admitted on and
   * the review grounds a price-tier cut on. `skipped` is the distinct sales the
   * line kept out (excluded_totals.price_tier). Null when there is no anchor.
   */
  priceAnchor?: { ppsf: number; n: number; floor: number; ceiling: number; skipped: number } | null
  concessionSentence: string | null
  /** Same sentence over a MIN_COMPS-sized kept set (judge-trim simulation). */
  concessionSentenceTrimmed: string | null
  /**
   * The three chapter-1/chapter-2 blocks EXACTLY as buildCma hangs them on
   * `render_args` — `render_args.market.offerTiming`,
   * `render_args.market.askOutcome`, `render_args.expiredAudit.finalCycle`.
   * Computed here through the same functions the build calls, so the dry run
   * shows the shipped shape without writing a row.
   */
  renderArgsMarketOfferTiming: unknown
  renderArgsMarketAskOutcome: unknown
  renderArgsMarketOriginalAskRealization: unknown
  /** render_args.pricing.reconciliation — which sale carried the price. */
  renderArgsPricingReconciliation: unknown
  /** render_args.pricing.rangeRule — how the low and high were produced. */
  renderArgsPricingRangeRule: unknown
  /**
   * render_args.compSearch — the ladder as COUNTS. Round four class E: the
   * prose search story claimed "not enough recent sales inside Diamond Bar
   * Ranch" while three of the five printed sales were in it.
   */
  renderArgsCompSearch: unknown
  /**
   * R2h — the one area, and the two sets that must come out of it. Before
   * this, the unsold peers were a city-wide 12-month pull and the competition
   * was a city-wide band read, so one document carried three different maps.
   */
  renderArgsCompArea: unknown
  renderArgsCompetitionArea: unknown
  renderArgsExpiredPeers: unknown
  renderArgsBandRivals: unknown
  /** One §0 entry per area-scoped read: table, filter, rows, fetchedAt, query. */
  areaCitations: unknown[]
  /** render_args.pricing.timeAdjustment — the basis every date adjustment used. */
  renderArgsPricingTimeAdjustment: unknown
  /**
   * The two city trends the document prints, each named. Round four class E:
   * the index peaked in a month the median close bottomed in, and neither
   * carried a label saying they measure different things.
   */
  timeAdjustmentMeasure: string | null
  marketTrendMeasure: string | null
  /**
   * The "Adjusted for date" column the price grid prints, one row per sale,
   * beside the move the named index actually records over that sale's own
   * span. R2d (evaluator round two, 2026-09-08): the document printed a
   * −0.4%/month basis over a −5.25% year and a grid column reading −8.58% to
   * −11.48%, because the index endpoint was the PARTIAL current month. These
   * two columns must agree, and the check below is the guard that says so.
   */
  dateAdjustments: Array<{
    address: string
    closeDate: string
    monthsOld: number
    /** (adjustment / close price) — what the grid prints. */
    printedPct: number
    amount: number
    /** The move the index records between that sale's month and the reference. */
    indexImpliedPct: number | null
    reversedWithinSpan: boolean
    ok: boolean
    reason: string | null
  }>
  dateAdjustmentCheckOk: boolean
  dateAdjustmentFailures: string[]
  /** render_args.pricing.clamp — what overrode the printed method, when it did. */
  renderArgsPricingClamp: unknown
  /** render_args.pricing.setAside — the sales the range rule removed from the price. */
  renderArgsPricingSetAside: unknown
  /** render_args.pricing.review — the flag a document must not be able to hide. */
  renderArgsPricingReview: unknown
  /**
   * render_args.pricing.sellerNet — what the seller keeps, itemised from the
   * RECOMMENDED LIST. Round four class A: the figure this replaced was
   * `predictedClose - concessions`, unanchored from the price printed beside
   * it, and on cma-65365-concorde it published a net ABOVE the list.
   * `sellerNetAnchored` is the invariant: net <= recommended, always.
   */
  renderArgsPricingSellerNet: unknown
  sellerNetAnchored: boolean
  /**
   * render_args.expiredAudit.askExposure — every price the final listing
   * period wore and how long each one ran. Round four class B: the story was
   * computed from the last cut, which on cma-2465 covered 35 of 187 days.
   */
  renderArgsExpiredAuditAskExposure: unknown
  /**
   * render_args.subjectStatus — the compliance carve-out. Round four class D.
   */
  renderArgsSubjectStatus: unknown
  /** The subject's own last-ask fields AFTER the stale-cycle suppression. */
  subjectLastAsk: { price: number | null; date: string | null; historyLine: string | null }
  /** The state /admin/cmas renders for the STORED row today. */
  queueStateStored: string | null
  /** The state it would land in after this run, carrying the stored audit verdict. */
  queueState: string | null
  /** render_args.pricing.rejected — considered and not used. */
  renderArgsPricingRejected: unknown
  renderArgsMarketLocalFailedThenSold: unknown
  renderArgsExpiredAuditFinalCycle: unknown
  /** The build's own hold (rule 22): the last failed ask inside the band. */
  hold: { kind: string; ask: number; bandLow: number; bandHigh: number; reason: string } | null
  error: string | null
}

/**
 * R2h — the area block: the one area in seller words, the unsold peers with
 * the window the ladder had to open to, the competition with its own area, and
 * the §0 citation for each read.
 */
type AreaLike = { sentence?: string; kind?: string; names?: string[]; radiusMiles?: number | null }
type PeerLike = {
  count: number
  areaTotal: number
  found: number
  likeYours: boolean
  windowMonths: number
  windowsTried: number[]
  widenedTo: number | null
  shortfall: boolean
  sentence: string
  peers: Array<{
    address: string
    status: string
    listPrice: number
    daysOnMarket: number | null
    whyItSat?: string | null
  }>
}
type RivalsLike = {
  activeCount: number
  pendingCount: number
  sentence: string
  area: AreaLike
  widenedFrom: number | null
  ringsTried: number[]
  rivals: Array<{ address: string; status: string; listPrice: number; daysOnMarket: number | null }>
}

function printArea(r: DryRun): void {
  const area = r.renderArgsCompArea as AreaLike | null
  const comp = r.renderArgsCompetitionArea as AreaLike | null
  console.log(`   compArea.sentence = ${area?.sentence ?? 'none'}`)
  console.log('   render_args.compArea =')
  console.log(indent(r.renderArgsCompArea))
  console.log(`   competition area = ${comp?.kind ?? 'none'} · ${comp?.sentence ?? ''}`)
  const peers = r.renderArgsExpiredPeers as PeerLike | null
  if (!peers) console.log('   render_args.expiredPeers = none')
  else {
    console.log(
      `   render_args.expiredPeers · shown ${peers.count} of ${peers.found} found${
        peers.likeYours ? ' like the subject' : ''
      } · ${peers.areaTotal} unsold in the area · windowMonths ${peers.windowMonths} · widenedTo ${peers.widenedTo ?? 'none'} · tried ${peers.windowsTried.join(
        '/',
      )}${peers.shortfall ? ' · SHORTFALL' : ''}`,
    )
    console.log(`     ${peers.sentence}`)
    for (const p of peers.peers) {
      console.log(
        `     ${p.address.slice(0, 28).padEnd(28)} ${p.status.padEnd(9)} $${p.listPrice.toLocaleString('en-US').padStart(9)}  ${
          p.daysOnMarket ?? '?'
        } days`,
      )
      if (p.whyItSat) console.log(`       why it sat: ${p.whyItSat}`)
    }
  }
  const rivals = r.renderArgsBandRivals as RivalsLike | null
  if (!rivals) console.log('   render_args.bandRivals = none')
  else {
    console.log(
      `   render_args.bandRivals · ${rivals.activeCount} active · ${rivals.pendingCount} pending · area ${
        rivals.area?.kind
      } ${(rivals.area?.names ?? []).join(', ')}${rivals.area?.radiusMiles ? ` ${rivals.area.radiusMiles} mi` : ''} · ringsTried ${rivals.ringsTried.join(
        '/',
      )} · widenedFrom ${rivals.widenedFrom ?? 'none'}`,
    )
    console.log(`     ${rivals.sentence}`)
    for (const v of rivals.rivals) {
      console.log(
        `     ${v.address.slice(0, 28).padEnd(28)} ${v.status.padEnd(9)} $${v.listPrice.toLocaleString('en-US').padStart(9)}  ${
          v.daysOnMarket ?? '?'
        } days`,
      )
    }
  }
  console.log('   area read citations =')
  console.log(indent(r.areaCitations))
}

/** JSON, indented under the dry-run's own two-space report gutter. */
function indent(value: unknown): string {
  return JSON.stringify(value, null, 2)
    .split('\n')
    .map((l) => `     ${l}`)
    .join('\n')
}

/** Exactly what lib/cma/comp-matrix.ts subjectDomDays reads off the subject. */
function domFromHistoryLine(line: string | null | undefined): number | null {
  const m = line?.match(/(\d+)\s+days?\s+on\s+market/i)
  if (!m) return null
  const n = Number(m[1])
  return Number.isFinite(n) && n >= 0 ? n : null
}

async function dryRun(slug: string, opts: { pocketLegacy?: boolean } = {}): Promise<DryRun> {
  const { getCmaAdminRowBySlug } = await import('@/lib/data')
  const { resolveCmaSubject } = await import('@/lib/cma/subject')
  const { selectCompsPreferringFacts } = await import('@/lib/pricing/select')
  const { priceTierLine } = await import('@/lib/pricing/price-tier')
  const { isCustomOrNewSubject } = await import('@/lib/pricing/classes')
  const { adjustComps, computePricing } = await import('@/lib/cma/pricing')
  const { pricingFailureMessage } = await import('@/lib/pricing/price-set')
  const { adjustCmaCompAlongMarket, adjustCompAlongMarket, priceCmaSet } = await import('@/lib/pricing/estimate')
  const { classifyStory } = await import('@/lib/pricing/classes')
  const { checkDateAdjustments } = await import('@/lib/pricing/market-path')
  const { getPricingMarketIndex } = await import('@/lib/data/pricing/facts')
  const { citySlug } = await import('@/lib/pricing/classes')
  const { getCmaMarketContext } = await import('@/lib/cma/market')
  const { evaluateAccuracyContract } = await import('@/lib/cma/contract')
  const { MIN_COMPS, brokerCompRefusal } = await import('@/lib/cma/comps')
  const { getBpoListingCyclesByAddress } = await import('@/lib/data/bpo/reads')
  const { analyzeListingHistory } = await import('@/lib/bpo/history')
  const { readFailedListingCycle, withFailedCycle } = await import('@/lib/cma/failed-cycle-read')
  const { buildFailureFindings, stampFinalCycleDom, resolveFinalCycle, buildAskExposure, applyFailedAskCap, FAILED_ASK_RECENCY_MONTHS } =
    await import('@/lib/cma/expired-audit')
  const { buildSubjectStatus } = await import('@/lib/pricing/subject-status')
  const { attachCompConcessions, attachSellerNet, reanchorSellerNet } = await import('@/lib/pricing/seller-net')
  const { buildCmaLocalOutcomes } = await import('@/lib/pricing/local-outcomes-read')
  const { getCmaListingPriceEvents } = await import('@/lib/data/cma/localOutcomeReads')

  const base: DryRun = {
    slug, ok: false, stage: 'subject', address: null, city: null, subjectBaths: null,
    subjectSqft: null, customOrNew: null, pricingSource: null, compCount: 0, comps: [],
    recommended: null, range: [null, null], valueRange: [null, null], confidence: null, compPpsfCv: null,
    needsReview: false, reviewReason: null, hardFailures: [],
    matrixSubjectDom: null, reviewSubjectDom: null, keptCompCount: 0, refillBench: null, concessionSentence: null,
    concessionSentenceTrimmed: null, renderArgsMarketOfferTiming: null,
    renderArgsMarketAskOutcome: null, renderArgsMarketOriginalAskRealization: null,
    renderArgsMarketLocalFailedThenSold: null, renderArgsPricingReconciliation: null,
    renderArgsPricingRangeRule: null, renderArgsCompSearch: null, renderArgsPricingTimeAdjustment: null,
    renderArgsCompArea: null, renderArgsCompetitionArea: null, renderArgsExpiredPeers: null,
    renderArgsBandRivals: null, areaCitations: [],
    timeAdjustmentMeasure: null, marketTrendMeasure: null,
    renderArgsPricingClamp: null, renderArgsPricingSetAside: null,
    renderArgsPricingReview: null, renderArgsPricingSellerNet: null, sellerNetAnchored: true,
    renderArgsExpiredAuditAskExposure: null, renderArgsSubjectStatus: null,
    subjectLastAsk: { price: null, date: null, historyLine: null },
    queueState: null, queueStateStored: null,
    renderArgsPricingRejected: null, renderArgsExpiredAuditFinalCycle: null,
    dateAdjustments: [], dateAdjustmentCheckOk: true, dateAdjustmentFailures: [], hold: null, error: null,
  }

  const row = await getCmaAdminRowBySlug(slug)
  if (!row) return { ...base, error: 'no cmas row for this slug' }

  const resolved = await resolveCmaSubject({
    mlsNumber: (row.subject_listing_key as string | null) ?? null,
    rawAddress: (row.subject_address as string | null) ?? null,
    city: (row.subject_city as string | null) ?? null,
  })
  const subject = resolved.subject
  if (!subject) return { ...base, error: resolved.trace }

  // Same stamp the build applies before anything reads the subject: the failed
  // final cycle's ask, status, and its own days on market (lib/cma/build.ts).
  const streetTokens = subject.streetAddress.trim().split(/\s+/)
  const streetNumber = streetTokens[0] && /^\d+$/.test(streetTokens[0]) ? streetTokens[0] : null
  const namePrefix = streetNumber ? streetTokens.slice(1).join(' ') : null
  const cycleRows =
    streetNumber && namePrefix
      ? await getBpoListingCyclesByAddress({
          streetNumber,
          streetNameIlike: `${namePrefix}%`,
          cityIlike: subject.city || null,
          postalCode: subject.postalCode,
        }).catch(() => [])
      : []
  const cycleStatus = String(cycleRows[0]?.['StandardStatus'] ?? subject.standardStatus ?? '')
  const lastCycleFailed = ['Expired', 'Canceled', 'Withdrawn'].includes(cycleStatus)
  // EXACTLY lib/cma/build.ts: the failed cycle on the days it was on the
  // market, from its MLS status log, read once.
  const failedCycle = lastCycleFailed ? await readFailedListingCycle(cycleRows, subject) : null
  if (lastCycleFailed) {
    const row0 = cycleRows[0] ?? {}
    const cycleAsk = Number(row0['ListPrice'] ?? row0['OriginalListPrice'])
    if (Number.isFinite(cycleAsk) && cycleAsk > 0) subject.lastListPrice = cycleAsk
    subject.standardStatus = cycleStatus
    stampFinalCycleDom(subject, failedCycle)
  }

  // EXACTLY lib/cma/build.ts step 1's stale-cycle suppression (round four,
  // class B). Without it this script shows the $140,000 November 2004 ask on
  // cma-19968 that the document was printing.
  let staleCycleReason: string | null = null
  if (!lastCycleFailed) {
    const lastAskDay = String(subject.lastListDate ?? '').slice(0, 10)
    const askMs = /^\d{4}-\d{2}-\d{2}$/.test(lastAskDay) ? Date.parse(`${lastAskDay}T00:00:00.000Z`) : NaN
    const monthsOld = Number.isNaN(askMs) ? null : (Date.now() - askMs) / (30.44 * 24 * 3600 * 1000)
    if (monthsOld != null && monthsOld > FAILED_ASK_RECENCY_MONTHS) {
      staleCycleReason =
        `The last listing period at this address ran in ${lastAskDay.slice(0, 4)}, more than ` +
        `${FAILED_ASK_RECENCY_MONTHS} months ago. That is a different market, so this report does not ` +
        `build a story on the price it asked.`
      subject.lastListPrice = null
      subject.lastListDate = null
      subject.listingHistoryLine = null
    }
  }

  const asOf = new Date().toISOString().slice(0, 10)
  const customOrNew = isCustomOrNewSubject(
    {
      yearBuilt: subject.yearBuilt,
      newConstructionYn: subject.newConstructionYn,
      remarks: subject.publicRemarks,
      propertySubType: subject.propertySubType,
    },
    Number(asOf.slice(0, 4)),
  )
  const head = {
    ...base,
    address: subject.streetAddress,
    city: subject.city,
    subjectBaths: subject.baths,
    subjectSqft: subject.sqft,
    customOrNew,
    stage: 'comps' as const,
  }

  const [selection, market] = await Promise.all([
    selectCompsPreferringFacts(subject, {}),
    getCmaMarketContext(subject).catch(() => null),
  ])
  // EXACTLY lib/cma/build.ts step 2.9: one home, one sale.
  const { dropPriorSalesOfSameHome } = await import('@/lib/pricing/same-address')
  const sameAddress = dropPriorSalesOfSameHome(selection.comps)
  const priorSaleDrops = sameAddress.dropped
  if (priorSaleDrops.length > 0) {
    const droppedKeys = new Set(priorSaleDrops.map((d) => d.listingKey))
    selection.comps = sameAddress.kept
    if (selection.pricingSales) {
      selection.pricingSales = selection.pricingSales.filter((s) => !droppedKeys.has(s.listingKey))
    }
  }

  const anchorLine = priceTierLine(selection.diagnostics?.price_anchor?.ppsf)
  const withSel = {
    ...head,
    pricingSource: selection.pricingSource,
    compCount: selection.comps.length,
    priceAnchor:
      anchorLine && selection.diagnostics?.price_anchor
        ? {
            ppsf: anchorLine.anchor,
            n: selection.diagnostics.price_anchor.n,
            floor: anchorLine.floor,
            ceiling: anchorLine.ceiling,
            skipped: selection.diagnostics.excluded_totals?.price_tier ?? 0,
          }
        : null,
  }
  if (selection.comps.length < MIN_COMPS) {
    // EXACTLY the sentence lib/cma/build.ts stores on the row (it leads with
    // the path that held the most price-setting sales, by address), then the
    // engineering diagnosis, which leads the same way.
    const refusal = brokerCompRefusal({
      diagnostics: selection.diagnostics,
      found: selection.comps.length,
      minComps: MIN_COMPS,
      subjectBaths: subject.baths,
      subjectCity: subject.city,
      sales: selection.comps.map((c) => c.address),
    })
    return { ...withSel, error: `${refusal} ${selection.diagnostics.starved_reason ?? ''}`.replace(/\s+/g, ' ').trim() }
  }

  // The index is a fact about the CITY, not about which ladder found the sales
  // (lib/cma/build.ts step 4). This script mirrored the old facts-only load.
  const marketIndex = await getPricingMarketIndex(citySlug(subject.city))
  // EXACTLY the branch lib/cma/build.ts takes (step 4, `usePath`). Before
  // 2026-09-08 this script always took the year-over-year `adjustComps` path,
  // so its date adjustments were not the ones the document prints and the R2d
  // defect could not be seen here at all.
  const salesByKey = new Map((selection.pricingSales ?? []).map((s) => [s.listingKey, s]))
  const usePath = marketIndex.length > 0
  const subjectStory = classifyStory(subject.levelsRaw, null)
  // EXACTLY lib/cma/build.ts priceSet's pocket path (Matt 2026-10-08, "Down
  // only if local fell"): the listing window and its closes, read once, the
  // local read for the set off the sales as the adjusters build them, then the
  // gate. The build's set is the judged one; here it is the ladder's.
  const { selectionIsExclusivePocket } = await import('@/lib/pricing/exclusive-pocket-date-adj')
  const { loadListingWindowCloses } = await import('@/lib/cma/listing-window-load')
  const { localReadForSet, finishExclusivePocketPricing } = await import('@/lib/cma/pocket-pricing')
  const { preserveHydratedClosedCompDom, pricingSaleToCmaComp } = await import('@/lib/pricing/estimate')
  const exclusivePocket = selectionIsExclusivePocket(selection.tiersUsed ?? [])
  const finalCycleForWindow = lastCycleFailed
    ? await (async () => {
        const cycle = failedCycle
        const priceEvents = cycle?.listingKey ? await getCmaListingPriceEvents(cycle.listingKey).catch(() => []) : []
        return resolveFinalCycle({ cycle, priceEvents, listingKey: cycle?.listingKey ?? subject.listingKey }).cycle
      })()
    : null
  const listingWindow = {
    city: subject.city,
    listDate: finalCycleForWindow?.listDate ?? subject.lastListDate,
    offDate: finalCycleForWindow?.offMarketDate ?? null,
  }
  const windowCloses = await loadListingWindowCloses({ ...listingWindow, propertySubType: subject.propertySubType }).catch(
    () => null,
  )
  const { zonedDateKey } = await import('@/lib/format/date')
  const local = localReadForSet({
    subject,
    comps: selection.comps.map((c) => {
      const sale = usePath ? salesByKey.get(c.listingKey) : undefined
      return sale ? preserveHydratedClosedCompDom(pricingSaleToCmaComp(sale), c) : c
    }),
    diagnostics: selection.diagnostics,
    subjectZone: null,
    window: listingWindow,
    closes: windowCloses,
    asOf: zonedDateKey(new Date().toISOString()),
  })
  const pocketLocal = opts.pocketLegacy ? undefined : local.pocketLocal
  const adjusted = usePath
    ? selection.comps.map((c) => {
        const sale = salesByKey.get(c.listingKey)
        return sale
          ? adjustCompAlongMarket({
              subject, subjectStory, sale, saleStory: sale.storyClass, points: marketIndex, asOf,
              hydrated: c, exclusivePocket, pocketLocal,
            }).adjusted
          : adjustCmaCompAlongMarket({
              subject, subjectStory, comp: c, saleStory: 'unknown', points: marketIndex, asOf,
              exclusivePocket, pocketLocal,
            }).adjusted
      })
    : exclusivePocket
      ? selection.comps.map((c) =>
          adjustCmaCompAlongMarket({
            subject, subjectStory, comp: c, saleStory: 'unknown', points: [], asOf,
            exclusivePocket: true, pocketLocal,
          }).adjusted,
        )
      : adjustComps(subject, selection.comps, market)
  let pricing = priceCmaSet({
    subject, adjusted, market, input: {}, site: null,
    selection: { pricingSales: selection.pricingSales ?? [], tiersUsed: selection.tiersUsed ?? [] },
    marketIndex, asOf,
    indexUnavailableReason:
      marketIndex.length > 0 ? null : `no monthly index rows for ${citySlug(subject.city) || 'this city'}`,
    computePricing,
    holdFailedAskUnderSaleSet: true,
    pocketLocal: exclusivePocket ? pocketLocal : undefined,
  })
  if (!pricing) return { ...withSel, stage: 'pricing', error: pricingFailureMessage(subject, adjusted) }
  if (exclusivePocket) {
    attachSellerNet(pricing, selection.comps)
    finishExclusivePocketPricing(pricing, { subject, adj: adjusted, set: selection.comps, pocketLocal })
  }
  const pocketDate = {
    exclusivePocket,
    mode: (opts.pocketLegacy ? 'legacy' : 'gated') as 'gated' | 'legacy',
    branch: pricing.timeAdjustment?.localGate?.branch ?? null,
    verdict: local.pocketLocal.verdict,
    missing: local.pocketLocal.missing,
    place: local.pocketLocal.place,
    sized: local.pocketLocal.sized,
    early: local.pocketLocal.early,
    late: local.pocketLocal.late,
    listingWindow: { listDate: listingWindow.listDate ?? null, offDate: listingWindow.offDate ?? null },
  }

  // EXACTLY the ceiling lib/cma/build.ts applies after priceSet (step 4, the
  // `lastCycleFailed` branch). Without it this script printed the ask itself
  // where the document prints the failed-then-sold p75 — $1,500,000 against
  // $1,473,000 on cma-65365-concorde — so the one defect round three called
  // blocking was invisible in the only tool that can see it without a build.
  if (lastCycleFailed) {
    const row0 = cycleRows[0] ?? {}
    const { subjectDomDays } = await import('@/lib/cma/comp-matrix')
    applyFailedAskCap(pricing, {
      lastFailedListPrice: subject.lastListPrice,
      offMarketDate: String(row0['off_market_date'] ?? row0['status_change_timestamp'] ?? '') || null,
      // The rule-16 pull reads these. Without them this printed the bare
      // $1,000 step where the build pulls by days on market (3037 Purcell,
      // $564,000 here against $555,000 in the build, 2026-10-07).
      daysOnMarket: subjectDomDays(subject),
      originalListPrice: Number(row0['OriginalListPrice']) || null,
    })
  }

  // The judge is skipped in a dry run, so the only rejections it can show are
  // the price-per-square-foot outlier trims the deterministic ladder made.
  const { buildRejectedSales } = await import('@/lib/pricing/rejected')
  const rejected = buildRejectedSales({
    candidates: selection.comps,
    preRejected: priorSaleDrops,
    excluded: [],
    // The kept set is the full ladder result in a dry run, and it is what stops
    // a printed sale from also appearing as rejected.
    kept: selection.comps.map((c) => ({
      listingKey: c.listingKey,
      address: c.address,
      sqft: c.sqft,
      yearBuilt: c.yearBuilt,
      closeDate: c.closeDate,
      closePrice: c.closePrice,
    })),
    outliers: selection.excludedOutliers,
    subject: {
      sqft: subject.sqft,
      yearBuilt: subject.yearBuilt,
      baths: subject.baths,
      propertySubType: subject.propertySubType,
      latitude: subject.latitude,
      longitude: subject.longitude,
    },
  })

  // The date-adjustment guard (R2d). Runs on the same adjusted set the grid
  // prints, against the same index the printed basis names.
  const dateCheck = checkDateAdjustments({
    points: marketIndex,
    asOf,
    sales: adjusted.map((c) => ({
      label: c.address,
      closeDate: c.closeDate,
      closePrice: c.closePrice,
      timeAdjustment: c.timeAdjustment,
    })),
  })

  // render_args.compSearch, render_args.compArea, render_args.expiredPeers and
  // render_args.bandRivals through the same two functions lib/cma/build.ts
  // calls, so a dry-run score equals a build's for these blocks. The judge is
  // skipped here, so the kept set is the full ladder result and the counts are
  // the widest the document could print. Both reads are scoped to the sales
  // area and to nothing wider (Matt 2026-10-07, rule 24).
  const { assembleCompetition, assembleExpiredPeers } = await import('@/lib/cma/assemble-competition')
  const competition = await assembleCompetition({
    subject,
    comps: adjusted,
    verdicts: [],
    diagnostics: selection.diagnostics,
    recommended: pricing.recommended,
    subjectZone: null,
    generatedAtIso: new Date().toISOString(),
  })
  const {
    compSearch,
    compArea,
    peerBand,
    rivalBand,
    unsoldRead,
    widestAreaInventory,
    competitionRing,
    competitionArea,
    bandRivals,
  } = competition
  const { expiredPeers } = assembleExpiredPeers({ competition, subject, lastCycleFailed })

  // §0 rule 5 cross-checks, computed off the same objects render_args carries.
  attachSellerNet(pricing, selection.comps)
  // EXACTLY build.ts settleRecommended: sitting actives can still move the
  // list, then the band clamp and the round. Without it this printed a
  // recommendation the build moves (3037 Purcell, 2026-10-07). The dry run's
  // rivals come from its own competition ring, not the judged set.
  {
    const { finishRecommendedAfterActives } = await import('@/lib/cma/finish-recommended')
    const { pocketClosedSupportPrice } = await import('@/lib/pricing/active-dom-nudge')
    const { syncRangeRuleToHeroBand } = await import('@/lib/pricing/estimate')
    const beforeActives = pricing.recommended
    pricing = syncRangeRuleToHeroBand(
      finishRecommendedAfterActives(pricing, {
        actives: (bandRivals?.rivals ?? []).map((r) => ({
          status: r.status,
          listPrice: r.listPrice,
          daysOnMarket: r.daysOnMarket,
        })),
        pocketClosedSupport: pocketClosedSupportPrice(adjusted, subject.subdivision),
        ask: pricing.failedAsk ?? (lastCycleFailed ? subject.lastListPrice : null),
      }),
    )
    if (pricing.recommended !== beforeActives) {
      console.log(
        `   actives settle · recommended $${beforeActives.toLocaleString('en-US')} → $${pricing.recommended.toLocaleString('en-US')}`,
      )
    }
  }
  const concessionLine = (n: { knownCount: number; givenCount: number; medianWhenGiven: number | null } | undefined) => {
    if (!n || n.knownCount === 0) return null
    const whenGiven =
      n.medianWhenGiven != null ? `, median $${Math.round(n.medianWhenGiven).toLocaleString('en-US')} when given` : ''
    return `${n.givenCount} of ${n.knownCount} sales that set this price reported a concession${whenGiven}.`
  }
  const concessionSentence = concessionLine(pricing.sellerNet)
  // The judge is skipped here, so the kept set is the full ladder result. Price
  // a MIN_COMPS-sized slice too, to show the denominator follows whatever set
  // the document ends up printing rather than the wider band set.
  const trimmed = { recommended: pricing.recommended, notes: [] as string[] } as Parameters<typeof attachSellerNet>[0]
  attachSellerNet(trimmed, selection.comps.slice(0, MIN_COMPS))
  const concessionSentenceTrimmed = concessionLine(trimmed?.sellerNet)
  const reviewSubjectDom = (() => {
    if (!lastCycleFailed) return null
    const history = withFailedCycle(analyzeListingHistory(cycleRows, subject, market?.medianDom ?? null), failedCycle)
    const findings = buildFailureFindings({
      subject, pricing, market, history, photosCount: null, ownershipSince: null,
    })
    const f = findings.find((x) => x.lens === 'time-on-market')
    return domFromHistoryLine(f?.fact ?? null)
  })()

  // The three blocks buildCma hangs on render_args, computed through the same
  // functions the build calls (lib/cma/build.ts steps 4.7 and 4.755).
  const localOutcomes = await buildCmaLocalOutcomes({ city: subject.city }).catch(() => ({
    offerTiming: null,
    askOutcome: null,
    originalAskRealization: null,
    localFailedThenSold: null,
  }))
  const resolvedCycle = await (async () => {
    if (!lastCycleFailed) return { cycle: null, suppressedReason: null }
    const cycle = failedCycle
    const priceEvents = cycle?.listingKey ? await getCmaListingPriceEvents(cycle.listingKey).catch(() => []) : []
    return resolveFinalCycle({ cycle, priceEvents, listingKey: cycle?.listingKey ?? subject.listingKey })
  })()
  const finalCycleBlock = resolvedCycle.cycle
  if (resolvedCycle.suppressedReason) staleCycleReason = resolvedCycle.suppressedReason
  const askExposure = buildAskExposure({
    cycle: finalCycleBlock,
    rangeLow: pricing.valueLow,
    rangeHigh: pricing.valueHigh,
  })
  const subjectStatus = buildSubjectStatus({
    standardStatus: subject.standardStatus,
    listAgentName: (cycleRows[0]?.['ListAgentName'] as string | null) ?? subject.listAgentName ?? null,
    listAgentEmail: subject.listAgentEmail ?? null,
    listOfficeName: (cycleRows[0]?.['ListOfficeName'] as string | null) ?? subject.listOfficeName ?? null,
    suppressedReason: staleCycleReason,
  })

  // EXACTLY what lib/cma/build.ts step 4.6 writes. The dry run skips the LLM
  // audit, so the verdict it can report is 'did-not-run'.
  const { buildPricingReview } = await import('@/lib/pricing/review')
  const { resolveCmaQueueState, readCmaAuditVerdict } = await import('@/lib/data/cma/unified-queue')
  const storedSummary = (row.build_summary ?? null) as Parameters<typeof readCmaAuditVerdict>[0]
  const storedAudit = readCmaAuditVerdict(storedSummary)
  const storedNeedsReview = storedSummary?.needs_review === true
  const queueStateWith = (needsReview: boolean) =>
    resolveCmaQueueState({
      status: String(row.status ?? 'draft'),
      archivedAt: (row.archived_at as string | null) ?? null,
      buildError: (row.build_error as string | null) ?? null,
      hasDocument: true,
      needsReview,
      auditVerdict: storedAudit.verdict,
      deliveredAt: (row.delivered_at as string | null) ?? null,
      emailSentAt: (row.email_sent_at as string | null) ?? null,
      queuedAt: (row.queued_at as string | null) ?? null,
    })
  // EXACTLY lib/cma/build.ts: the band is pinned to the sales that set it
  // (set-aside rows read by key), the cap's ask is re-read on that band, then
  // rule 22, the last failed ask inside that pinned band (Matt 2026-10-07),
  // then a recommendation under the band: held when the failed ask put it
  // there, failed otherwise. Same helpers as the build.
  {
    const { pinPrintedBandToSettingSales } = await import('@/lib/pricing/estimate')
    const { applyAskBelowBandHold, applyAskInBandHold } = await import('@/lib/cma/gap-hold')
    const { reclassifyFailedAskOnPrintedBand } = await import('@/lib/cma/expired-audit')
    const recommendedBeforePin = pricing.recommended
    pricing = pinPrintedBandToSettingSales(pricing, attachCompConcessions(adjusted))
    if (pricing.recommended !== recommendedBeforePin) reanchorSellerNet(pricing)
    reclassifyFailedAskOnPrintedBand(
      pricing,
      pricing.failedAsk ?? (lastCycleFailed ? (subject.lastListPrice ?? null) : null),
    )
    applyAskInBandHold(pricing, {
      lastCycleFailed,
      lastListPrice: subject.lastListPrice,
      auditVerdict: storedAudit.verdict,
    })
    const belowBand = applyAskBelowBandHold(pricing, {
      lastListPrice: subject.lastListPrice,
      auditVerdict: storedAudit.verdict,
    })
    if (!belowBand.ok) return { ...withSel, stage: 'pricing', error: `Pricing failed: ${belowBand.error}` }
  }
  const review = buildPricingReview({
    needsReview: pricing.needsReview,
    reviewReason: pricing.reviewReason,
    clamp: pricing.clamp ?? null,
    auditVerdict: storedAudit.verdict,
  })

  const contract = evaluateAccuracyContract({
    comps: adjusted,
    pricing,
    judgment: null,
    audit: null,
    site: null,
    minComps: MIN_COMPS,
    marketContextPresent: market != null,
    subjectSubType: subject.propertySubType,
    // EXACTLY the subject lib/cma/build.ts hands the contract: beds, the MLS
    // bath split and the recorded plat, not the bath total alone (which made
    // this script compare totals the picker never compared, 2026-10-08).
    subjectBaths: subject.baths,
    subjectBathsFull: subject.bathsFull ?? null,
    subjectBathsHalf: subject.bathsHalf ?? null,
    subjectBeds: subject.beds,
    subjectSubdivisionSlug: subject.subdivisionSlug ?? null,
    subjectGround: subject,
    subjectIsCustomOrNew: customOrNew,
    failedAsk: pricing.failedAsk ?? null,
  })
  const hardFailures = contract.checks.filter((c) => c.severity === 'hard' && !c.pass).map((c) => `${c.id}: ${c.detail}`)

  return {
    ...withSel,
    stage: hardFailures.length ? 'contract' : 'complete',
    ok: hardFailures.length === 0,
    // Concessions resolved exactly as buildCma stamps them on render_args.
    comps: attachCompConcessions(adjusted).map((c) => ({
      key: c.listingKey, address: c.address, baths: c.baths, sqft: c.sqft,
      closePrice: Math.round(c.closePrice), closeDate: c.closeDate, adjusted: Math.round(c.adjustedPrice),
      concessions: c.concessions,
      date: Math.round(c.timeAdjustment),
      size: Math.round(c.sizeAdjustment),
      onMarketDate: c.onMarketDate ?? null,
      offerFrom: c.offerFrom ?? null,
      daysToOffer: c.daysToOffer,
      domTotal: c.domTotal,
    })),
    pocketDate,
    recommended: pricing.recommended,
    range: [pricing.conservative, pricing.highEnd],
    valueRange: [pricing.valueLow, pricing.valueHigh],
    confidence: pricing.confidence,
    compPpsfCv: pricing.compPpsfCv ?? null,
    needsReview: pricing.needsReview === true,
    reviewReason: pricing.reviewReason ?? null,
    hardFailures,
    matrixSubjectDom: domFromHistoryLine(subject.listingHistoryLine),
    reviewSubjectDom,
    keptCompCount: adjusted.length,
    // EXACTLY what lib/cma/build.ts hands lib/cma/review-refill.ts: the
    // selection's bench, so the fleet scorer sees whether a review drop on
    // this home would refill from the same rung or fail as a shortage.
    refillBench: selection.refill
      ? {
          rung: selection.refill.rung,
          widening: selection.refill.widening,
          held: selection.refill.comps.length,
          keys: selection.refill.comps.map((c) => c.listingKey),
        }
      : null,
    concessionSentence,
    concessionSentenceTrimmed,
    renderArgsMarketOfferTiming: localOutcomes.offerTiming,
    renderArgsMarketAskOutcome: localOutcomes.askOutcome,
    renderArgsMarketOriginalAskRealization: localOutcomes.originalAskRealization,
    renderArgsPricingReconciliation: pricing.reconciliation ?? null,
    renderArgsPricingRangeRule: pricing.rangeRule ?? null,
    renderArgsCompSearch: compSearch,
    renderArgsCompArea: compArea,
    renderArgsCompetitionArea: competitionArea,
    renderArgsExpiredPeers: expiredPeers,
    renderArgsBandRivals: bandRivals,
    areaCitations: [
      unsoldRead ? { read: 'unsold peers', ...unsoldRead.citation, price_band: peerBand } : null,
      widestAreaInventory && competitionRing
        ? {
            read: 'competition',
            ...widestAreaInventory.citation,
            active: competitionRing.activeCount,
            pending: competitionRing.pendingCount,
            price_band: rivalBand,
            ring_miles: competitionRing.area.kind === 'radius' ? competitionRing.area.radiusMiles : null,
            rings_tried: competitionRing.ringsTried,
            widened_from: competitionRing.widenedFrom,
          }
        : null,
    ].filter((c) => c != null),
    renderArgsPricingTimeAdjustment: pricing.timeAdjustment ?? null,
    timeAdjustmentMeasure: pricing.timeAdjustment?.measure ?? null,
    marketTrendMeasure: market?.trendMeasure ?? null,
    renderArgsPricingClamp: pricing.clamp ?? null,
    renderArgsPricingSetAside: pricing.setAside ?? null,
    renderArgsPricingReview: review,
    hold: pricing.hold ?? null,
    renderArgsPricingSellerNet: pricing.sellerNet ?? null,
    // THE INVARIANT: what the seller keeps can never exceed the price we told
    // them to ask. Round four class A shipped four documents where it did.
    sellerNetAnchored:
      pricing.sellerNet == null ||
      (pricing.sellerNet.list === pricing.recommended && pricing.sellerNet.net <= pricing.recommended),
    renderArgsExpiredAuditAskExposure: askExposure,
    renderArgsSubjectStatus: subjectStatus,
    subjectLastAsk: {
      price: subject.lastListPrice,
      date: subject.lastListDate,
      historyLine: subject.listingHistoryLine,
    },
    // What /admin/cmas shows for the STORED row, and what it would show after
    // this run. The dry run cannot re-run the LLM audit, so the second line
    // carries the stored verdict beside THIS run's review flag.
    queueStateStored: queueStateWith(storedNeedsReview),
    queueState: queueStateWith(pricing.needsReview === true),
    renderArgsPricingRejected: rejected,
    renderArgsMarketLocalFailedThenSold: localOutcomes.localFailedThenSold,
    renderArgsExpiredAuditFinalCycle: finalCycleBlock,
    dateAdjustments: dateCheck.rows.map((r, i) => ({
      address: r.label,
      closeDate: r.closeDate,
      monthsOld: r.monthsOld,
      printedPct: r.printedPct,
      // By POSITION: `checkDateAdjustments` keeps the order it was given, and
      // two sales on one street can carry the same address label.
      amount: adjusted[i]?.timeAdjustment ?? 0,
      indexImpliedPct: r.indexImpliedPct,
      reversedWithinSpan: r.reversedWithinSpan,
      ok: r.ok,
      reason: r.reason,
    })),
    dateAdjustmentCheckOk: dateCheck.ok,
    dateAdjustmentFailures: dateCheck.failures,
    error: hardFailures.length ? `Accuracy contract failed: ${hardFailures.join(' | ')}` : null,
  }
}

async function main() {
  const argv = process.argv.slice(2)
  const asJson = argv.includes('--json')
  const pocketLegacy = argv.includes('--pocket-legacy')
  const slugs = argv.filter((a) => !a.startsWith('--')).map((s) => s.trim().toLowerCase())
  if (!slugs.length) {
    console.error('usage: npx tsx scripts/cma-build-dryrun.ts [--json] <slug> [slug...]')
    process.exit(1)
  }
  const out: DryRun[] = []
  for (const slug of slugs) {
    const r = await dryRun(slug, { pocketLegacy }).catch((e): DryRun => ({
      slug, ok: false, stage: 'subject', address: null, city: null, subjectBaths: null, subjectSqft: null,
      customOrNew: null, pricingSource: null, compCount: 0, comps: [], recommended: null,
      range: [null, null], valueRange: [null, null], confidence: null, compPpsfCv: null, needsReview: false, reviewReason: null,
      hardFailures: [], matrixSubjectDom: null, reviewSubjectDom: null, keptCompCount: 0,
      concessionSentence: null, concessionSentenceTrimmed: null,
      renderArgsMarketOfferTiming: null, renderArgsMarketAskOutcome: null,
      renderArgsMarketOriginalAskRealization: null, renderArgsMarketLocalFailedThenSold: null,
      renderArgsPricingReconciliation: null, renderArgsPricingRangeRule: null,
      renderArgsPricingTimeAdjustment: null, renderArgsPricingClamp: null,
      renderArgsPricingSetAside: null, renderArgsPricingReview: null,
      renderArgsPricingSellerNet: null, sellerNetAnchored: true,
      renderArgsExpiredAuditAskExposure: null, renderArgsSubjectStatus: null,
      subjectLastAsk: { price: null, date: null, historyLine: null },
      queueState: null,
      queueStateStored: null,
      renderArgsPricingRejected: null,
      renderArgsExpiredAuditFinalCycle: null,
      dateAdjustments: [], dateAdjustmentCheckOk: true, dateAdjustmentFailures: [],
      error: e instanceof Error ? e.message : String(e),
    }))
    out.push(r)
    if (asJson) continue
    console.log(`\n── ${r.slug} — ${r.address ?? '(unresolved)'}, ${r.city ?? '?'}`)
    console.log(`   ${r.ok ? 'WOULD BUILD' : `WOULD FAIL at ${r.stage}`} · subject ${r.subjectBaths ?? '?'} bath / ${r.subjectSqft ?? '?'} sqft · custom-or-new ${r.customOrNew} · source ${r.pricingSource ?? 'n/a'}`)
    if (r.recommended != null) {
      console.log(`   recommended $${r.recommended.toLocaleString()} (list tiers $${r.range[0]?.toLocaleString()}–$${r.range[1]?.toLocaleString()}) · confidence ${r.confidence} · $/sqft CV ${r.compPpsfCv}${r.needsReview ? ' · FLAGGED' : ''}`)
      console.log(`   worth $${r.valueRange[0]?.toLocaleString()}–$${r.valueRange[1]?.toLocaleString()} (the printed adjusted sale prices)`)
    }
    if (r.hold) {
      console.log(
        `   hold = ${r.hold.kind} · ask $${r.hold.ask.toLocaleString('en-US')} inside $${r.hold.bandLow.toLocaleString('en-US')} to $${r.hold.bandHigh.toLocaleString('en-US')}`,
      )
    }
    if (r.priceAnchor) {
      console.log(
        `   price anchor $${r.priceAnchor.ppsf}/sqft (n=${r.priceAnchor.n}) · line $${r.priceAnchor.floor} to $${r.priceAnchor.ceiling} · ${r.priceAnchor.skipped} sale(s) skipped on the line`,
      )
    }
    if (r.comps.length) {
      console.log(`   comps (${r.comps.length}):`)
      for (const c of r.comps) {
        const conc = c.concessions == null ? 'concessions not reported' : c.concessions > 0 ? `concessions $${c.concessions.toLocaleString()}` : 'no concession'
        console.log(`     ${c.address} · ${c.baths ?? '?'}ba · ${c.sqft}sf · closed $${c.closePrice.toLocaleString()} ${c.closeDate} · ${conc} → adj $${c.adjusted.toLocaleString()}`)
      }
    }
    if (r.matrixSubjectDom != null || r.reviewSubjectDom != null) {
      const agree = r.matrixSubjectDom === r.reviewSubjectDom
      console.log(
        `   subject DOM · matrix ${r.matrixSubjectDom ?? 'n/a'} · last-listing review ${r.reviewSubjectDom ?? 'n/a'} · ${agree ? 'AGREE' : 'MISMATCH'}`,
      )
    }
    if (r.concessionSentence) {
      const m = r.concessionSentence.match(/\bof (\d+) sales\b/)
      const denom = m ? Number(m[1]) : null
      console.log(`   concessions · kept comps ${r.keptCompCount} · "${r.concessionSentence}" · ${denom === r.keptCompCount ? 'SAME SET' : 'DIFFERENT SET'}`)
      if (r.refillBench) {
        console.log(
          `   refill bench · reached five on ${r.refillBench.rung ?? 'no rung'} (${r.refillBench.widening ? 'widening rung' : 'own ground'}) · ${r.refillBench.held} sale(s) the review can refill from${r.refillBench.keys.length ? `: ${r.refillBench.keys.join(', ')}` : ''}`,
        )
      }
      if (r.concessionSentenceTrimmed) console.log(`   concessions · 5-comp kept set · "${r.concessionSentenceTrimmed}"`)
    }
    console.log('   render_args.market.offerTiming =')
    console.log(indent(r.renderArgsMarketOfferTiming))
    console.log('   render_args.market.askOutcome =')
    console.log(indent(r.renderArgsMarketAskOutcome))
    console.log('   render_args.pricing.rejected =')
    console.log(indent(r.renderArgsPricingRejected))
    if (r.dateAdjustments.length) {
      const pct = (n: number | null) => (n == null ? '    n/a' : `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`)
      console.log(`   adjusted for date · ${r.dateAdjustmentCheckOk ? 'GUARD PASSES' : 'GUARD FAILS'}`)
      console.log('     sale                       closed      months  index implies   printed        amount')
      for (const d of r.dateAdjustments) {
        console.log(
          `     ${d.address.slice(0, 24).padEnd(24)}   ${d.closeDate}  ${String(d.monthsOld).padStart(5)}  ` +
            `${pct(d.indexImpliedPct).padStart(13)}  ${pct(d.printedPct).padStart(8)}  ` +
            `${(d.amount >= 0 ? '+$' : '-$') + Math.abs(d.amount).toLocaleString('en-US')}`.padStart(13) +
            `${d.reason ? `  · ${d.reason}` : ''}`,
        )
      }
      for (const f of r.dateAdjustmentFailures) console.log(`     ✖ ${f}`)
    }
    console.log(
      `   two city trends, two measures · timeAdjustment.measure = ${
        r.timeAdjustmentMeasure ?? 'none'
      } · market.trendMeasure = ${r.marketTrendMeasure ?? 'none'}`,
    )
    console.log('   render_args.pricing.timeAdjustment =')
    console.log(indent(r.renderArgsPricingTimeAdjustment))
    console.log('   render_args.pricing.clamp =')
    console.log(indent(r.renderArgsPricingClamp))
    console.log('   render_args.pricing.rangeRule =')
    console.log(indent(r.renderArgsPricingRangeRule))
    console.log('   render_args.pricing.setAside =')
    console.log(indent(r.renderArgsPricingSetAside))
    console.log('   render_args.compSearch =')
    console.log(indent(r.renderArgsCompSearch))
    printArea(r)
    console.log(
      `   queue state · stored ${r.queueStateStored ?? 'n/a'} · after this run ${r.queueState ?? 'n/a'}`,
    )
    console.log('   render_args.pricing.review =')
    console.log(indent(r.renderArgsPricingReview))
    console.log(
      `   render_args.pricing.sellerNet · ${r.sellerNetAnchored ? 'ANCHORED to the recommended list' : 'UNANCHORED — the net does not follow the list'} =`,
    )
    console.log(indent(r.renderArgsPricingSellerNet))
    console.log('   render_args.subjectStatus =')
    console.log(indent(r.renderArgsSubjectStatus))
    console.log(
      `   subject last ask (after the stale-cycle suppression) · ${
        r.subjectLastAsk.price == null ? 'none' : `$${r.subjectLastAsk.price.toLocaleString('en-US')}`
      } · ${r.subjectLastAsk.date ?? 'no date'} · ${r.subjectLastAsk.historyLine ?? 'no history line'}`,
    )
    console.log('   render_args.pricing.reconciliation =')
    console.log(indent(r.renderArgsPricingReconciliation))
    console.log('   render_args.market.originalAskRealization =')
    console.log(indent(r.renderArgsMarketOriginalAskRealization))
    console.log('   render_args.market.localFailedThenSold =')
    console.log(indent(r.renderArgsMarketLocalFailedThenSold))
    console.log('   render_args.expiredAudit.finalCycle =')
    console.log(indent(r.renderArgsExpiredAuditFinalCycle))
    console.log('   render_args.expiredAudit.askExposure =')
    console.log(indent(r.renderArgsExpiredAuditAskExposure))
    if (r.error) console.log(`   ✖ ${r.error}`)
  }
  if (asJson) console.log(JSON.stringify(out, null, 2))
}

main().catch((e) => {
  console.error('✖ dry-run threw:', e)
  process.exit(1)
})
