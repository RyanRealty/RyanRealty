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
  comps: Array<{ key: string; address: string; baths: number | null; sqft: number; closePrice: number; closeDate: string; adjusted: number; concessions: number | null }>
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
  error: string | null
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

async function dryRun(slug: string): Promise<DryRun> {
  const { getCmaAdminRowBySlug } = await import('@/lib/data')
  const { resolveCmaSubject } = await import('@/lib/cma/subject')
  const { selectCompsPreferringFacts } = await import('@/lib/pricing/select')
  const { isCustomOrNewSubject } = await import('@/lib/pricing/classes')
  const { adjustComps, computePricing } = await import('@/lib/cma/pricing')
  const { adjustCmaCompAlongMarket, adjustCompAlongMarket, priceCmaSet } = await import('@/lib/pricing/estimate')
  const { classifyStory } = await import('@/lib/pricing/classes')
  const { checkDateAdjustments } = await import('@/lib/pricing/market-path')
  const { getPricingMarketIndex } = await import('@/lib/data/pricing/facts')
  const { citySlug } = await import('@/lib/pricing/classes')
  const { getCmaMarketContext } = await import('@/lib/cma/market')
  const { evaluateAccuracyContract } = await import('@/lib/cma/contract')
  const { MIN_COMPS } = await import('@/lib/cma/comps')
  const { getBpoListingCyclesByAddress } = await import('@/lib/data/bpo/reads')
  const { analyzeListingHistory } = await import('@/lib/bpo/history')
  const { buildFailureFindings, stampFinalCycleDom, resolveFinalCycle, buildAskExposure, applyFailedAskCap, FAILED_ASK_RECENCY_MONTHS } =
    await import('@/lib/cma/expired-audit')
  const { buildSubjectStatus } = await import('@/lib/pricing/subject-status')
  const { attachCompConcessions, attachSellerNet } = await import('@/lib/pricing/seller-net')
  const { buildCmaLocalOutcomes } = await import('@/lib/pricing/local-outcomes-read')
  const { getCmaListingPriceEvents } = await import('@/lib/data/cma/localOutcomeReads')

  const base: DryRun = {
    slug, ok: false, stage: 'subject', address: null, city: null, subjectBaths: null,
    subjectSqft: null, customOrNew: null, pricingSource: null, compCount: 0, comps: [],
    recommended: null, range: [null, null], valueRange: [null, null], confidence: null, compPpsfCv: null,
    needsReview: false, reviewReason: null, hardFailures: [],
    matrixSubjectDom: null, reviewSubjectDom: null, keptCompCount: 0, concessionSentence: null,
    concessionSentenceTrimmed: null, renderArgsMarketOfferTiming: null,
    renderArgsMarketAskOutcome: null, renderArgsMarketOriginalAskRealization: null,
    renderArgsMarketLocalFailedThenSold: null, renderArgsPricingReconciliation: null,
    renderArgsPricingRangeRule: null, renderArgsCompSearch: null, renderArgsPricingTimeAdjustment: null,
    timeAdjustmentMeasure: null, marketTrendMeasure: null,
    renderArgsPricingClamp: null, renderArgsPricingSetAside: null,
    renderArgsPricingReview: null, renderArgsPricingSellerNet: null, sellerNetAnchored: true,
    renderArgsExpiredAuditAskExposure: null, renderArgsSubjectStatus: null,
    subjectLastAsk: { price: null, date: null, historyLine: null },
    queueState: null, queueStateStored: null,
    renderArgsPricingRejected: null, renderArgsExpiredAuditFinalCycle: null,
    dateAdjustments: [], dateAdjustmentCheckOk: true, dateAdjustmentFailures: [], error: null,
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
  if (lastCycleFailed) {
    const row0 = cycleRows[0] ?? {}
    const cycleAsk = Number(row0['ListPrice'] ?? row0['OriginalListPrice'])
    if (Number.isFinite(cycleAsk) && cycleAsk > 0) subject.lastListPrice = cycleAsk
    subject.standardStatus = cycleStatus
    stampFinalCycleDom(subject, analyzeListingHistory(cycleRows, subject, null).currentCycle)
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

  const withSel = { ...head, pricingSource: selection.pricingSource, compCount: selection.comps.length }
  if (selection.comps.length < MIN_COMPS) {
    return { ...withSel, error: `Only ${selection.comps.length} qualifying closed comps found (minimum ${MIN_COMPS}). ${selection.diagnostics.starved_reason ?? ''}`.trim() }
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
  const adjusted = usePath
    ? selection.comps.map((c) => {
        const sale = salesByKey.get(c.listingKey)
        return sale
          ? adjustCompAlongMarket({
              subject, subjectStory, sale, saleStory: sale.storyClass, points: marketIndex, asOf,
            }).adjusted
          : adjustCmaCompAlongMarket({
              subject, subjectStory, comp: c, saleStory: 'unknown', points: marketIndex, asOf,
            }).adjusted
      })
    : adjustComps(subject, selection.comps, market)
  const pricing = priceCmaSet({
    subject, adjusted, market, input: {}, site: null,
    selection: { pricingSales: selection.pricingSales ?? [], tiersUsed: selection.tiersUsed ?? [] },
    marketIndex, asOf,
    indexUnavailableReason:
      marketIndex.length > 0 ? null : `no monthly index rows for ${citySlug(subject.city) || 'this city'}`,
    computePricing,
  })
  if (!pricing) return { ...withSel, stage: 'pricing', error: 'Pricing could not be computed (subject sqft missing).' }

  // EXACTLY the ceiling lib/cma/build.ts applies after priceSet (step 4, the
  // `lastCycleFailed` branch). Without it this script printed the ask itself
  // where the document prints the failed-then-sold p75 — $1,500,000 against
  // $1,473,000 on cma-65365-concorde — so the one defect round three called
  // blocking was invisible in the only tool that can see it without a build.
  if (lastCycleFailed) {
    const row0 = cycleRows[0] ?? {}
    applyFailedAskCap(pricing, {
      lastFailedListPrice: subject.lastListPrice,
      offMarketDate: String(row0['off_market_date'] ?? row0['status_change_timestamp'] ?? '') || null,
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

  // render_args.compSearch — the ladder as counts, built by the same function
  // lib/cma/build.ts calls. The judge is skipped here, so the kept set is the
  // full ladder result and the counts are the widest the document could print.
  const { buildCompSearch } = await import('@/lib/pricing/comp-search')
  const compSearch = buildCompSearch({
    subdivision: selection.diagnostics.subject.subdivision ?? subject.subdivision,
    ladder: selection.diagnostics.ladder.map((t) => ({
      tier: t.tier,
      ran: t.ran,
      monthsBack: t.months_back,
      compsAdded: t.comps_added,
    })),
    keptComps: adjusted.map((c) => ({ subdivision: c.subdivision, selectionTier: c.selectionTier })),
  })

  // §0 rule 5 cross-checks, computed off the same objects render_args carries.
  attachSellerNet(pricing, selection.comps)
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
    const history = analyzeListingHistory(cycleRows, subject, market?.medianDom ?? null)
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
    const history = analyzeListingHistory(cycleRows, subject, market?.medianDom ?? null)
    const cycle = history.currentCycle
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
    subjectBaths: subject.baths,
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
    })),
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
    concessionSentence,
    concessionSentenceTrimmed,
    renderArgsMarketOfferTiming: localOutcomes.offerTiming,
    renderArgsMarketAskOutcome: localOutcomes.askOutcome,
    renderArgsMarketOriginalAskRealization: localOutcomes.originalAskRealization,
    renderArgsPricingReconciliation: pricing.reconciliation ?? null,
    renderArgsPricingRangeRule: pricing.rangeRule ?? null,
    renderArgsCompSearch: compSearch,
    renderArgsPricingTimeAdjustment: pricing.timeAdjustment ?? null,
    timeAdjustmentMeasure: pricing.timeAdjustment?.measure ?? null,
    marketTrendMeasure: market?.trendMeasure ?? null,
    renderArgsPricingClamp: pricing.clamp ?? null,
    renderArgsPricingSetAside: pricing.setAside ?? null,
    renderArgsPricingReview: review,
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
  const slugs = argv.filter((a) => !a.startsWith('--')).map((s) => s.trim().toLowerCase())
  if (!slugs.length) {
    console.error('usage: npx tsx scripts/cma-build-dryrun.ts [--json] <slug> [slug...]')
    process.exit(1)
  }
  const out: DryRun[] = []
  for (const slug of slugs) {
    const r = await dryRun(slug).catch((e): DryRun => ({
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
