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
  comps: Array<{ key: string; address: string; baths: number | null; sqft: number; closePrice: number; closeDate: string; adjusted: number }>
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
  const { priceCmaSet } = await import('@/lib/pricing/estimate')
  const { getPricingMarketIndex } = await import('@/lib/data/pricing/facts')
  const { citySlug } = await import('@/lib/pricing/classes')
  const { getCmaMarketContext } = await import('@/lib/cma/market')
  const { evaluateAccuracyContract } = await import('@/lib/cma/contract')
  const { MIN_COMPS } = await import('@/lib/cma/comps')
  const { getBpoListingCyclesByAddress } = await import('@/lib/data/bpo/reads')
  const { analyzeListingHistory } = await import('@/lib/bpo/history')
  const { buildFailureFindings, stampFinalCycleDom, buildFinalCycle } = await import('@/lib/cma/expired-audit')
  const { attachSellerNet } = await import('@/lib/pricing/seller-net')
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
    renderArgsPricingRangeRule: null, renderArgsExpiredAuditFinalCycle: null, error: null,
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
  const withSel = { ...head, pricingSource: selection.pricingSource, compCount: selection.comps.length }
  if (selection.comps.length < MIN_COMPS) {
    return { ...withSel, error: `Only ${selection.comps.length} qualifying closed comps found (minimum ${MIN_COMPS}). ${selection.diagnostics.starved_reason ?? ''}`.trim() }
  }

  const marketIndex = selection.pricingSource === 'facts' ? await getPricingMarketIndex(citySlug(subject.city)) : []
  const adjusted = adjustComps(subject, selection.comps, market)
  const pricing = priceCmaSet({
    subject, adjusted, market, input: {}, site: null,
    selection: { pricingSales: selection.pricingSales ?? [], tiersUsed: selection.tiersUsed ?? [] },
    marketIndex, asOf, computePricing,
  })
  if (!pricing) return { ...withSel, stage: 'pricing', error: 'Pricing could not be computed (subject sqft missing).' }

  // §0 rule 5 cross-checks, computed off the same objects render_args carries.
  attachSellerNet(pricing, selection.comps, pricing.predictedClose ?? pricing.recommended ?? null)
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
  attachSellerNet(trimmed, selection.comps.slice(0, MIN_COMPS), pricing.predictedClose ?? pricing.recommended ?? null)
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
  const finalCycleBlock = await (async () => {
    if (!lastCycleFailed) return null
    const history = analyzeListingHistory(cycleRows, subject, market?.medianDom ?? null)
    const cycle = history.currentCycle
    const priceEvents = cycle?.listingKey ? await getCmaListingPriceEvents(cycle.listingKey).catch(() => []) : []
    return buildFinalCycle({ cycle, priceEvents, listingKey: cycle?.listingKey ?? subject.listingKey })
  })()

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
    comps: adjusted.map((c) => ({
      key: c.listingKey, address: c.address, baths: c.baths, sqft: c.sqft,
      closePrice: Math.round(c.closePrice), closeDate: c.closeDate, adjusted: Math.round(c.adjustedPrice),
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
    renderArgsMarketLocalFailedThenSold: localOutcomes.localFailedThenSold,
    renderArgsExpiredAuditFinalCycle: finalCycleBlock,
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
      renderArgsExpiredAuditFinalCycle: null,
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
        console.log(`     ${c.address} · ${c.baths ?? '?'}ba · ${c.sqft}sf · closed $${c.closePrice.toLocaleString()} ${c.closeDate} → adj $${c.adjusted.toLocaleString()}`)
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
    console.log('   render_args.pricing.rangeRule =')
    console.log(indent(r.renderArgsPricingRangeRule))
    console.log('   render_args.pricing.reconciliation =')
    console.log(indent(r.renderArgsPricingReconciliation))
    console.log('   render_args.market.originalAskRealization =')
    console.log(indent(r.renderArgsMarketOriginalAskRealization))
    console.log('   render_args.market.localFailedThenSold =')
    console.log(indent(r.renderArgsMarketLocalFailedThenSold))
    console.log('   render_args.expiredAudit.finalCycle =')
    console.log(indent(r.renderArgsExpiredAuditFinalCycle))
    if (r.error) console.log(`   ✖ ${r.error}`)
  }
  if (asJson) console.log(JSON.stringify(out, null, 2))
}

main().catch((e) => {
  console.error('✖ dry-run threw:', e)
  process.exit(1)
})
