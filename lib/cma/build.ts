/**
 * Deterministic CMA build orchestrator.
 *
 * buildCma() runs the whole pipeline with NO LLM dependency:
 *   subject (listings) → comps (tiered selection) → market context (cache
 *   tables) → adjustments + three-method pricing → static map → brutalist
 *   HTML render → citations → persist to public.cmas (html_content in the
 *   DB, Vercel-safe) + public.cma_comps.
 *
 * The result row lands as status 'draft' — Matt reviews at /admin/cmas and
 * nothing is ever sent automatically.
 */

import {
  getCmaBrokerBySlugOrEmail,
  getCmaAdminReviewRowBySlug,
  upsertCmaRowBySlug,
  updateCmaRowFieldsBySlug,
  replaceCmaComps,
  getPricingMarketIndex,
  type CmaCompInsert,
} from '@/lib/data'
import { applySubjectFactOverrides, resolveCmaSubject } from '@/lib/cma/subject'
import { applySlugStreetDirectional, formatPersistedCmaAddress } from '@/lib/cma/address-slug'
import { applyCmaClientIntent, isCmaClientIntent, parseCmaClientIntent } from '@/lib/cma/client-intent'
import { brokerCompRefusal, selectCompsByKeys, MIN_COMPS } from '@/lib/cma/comps'
import { selectCompsPreferringFacts } from '@/lib/pricing/select'
import { adjustCmaCompAlongMarket, adjustCompAlongMarket, priceCmaSet } from '@/lib/pricing/estimate'
import { buildRejectedSales } from '@/lib/pricing/rejected'
import { dropPriorSalesOfSameHome } from '@/lib/pricing/same-address'
import { buildPricingReview, confidenceForVerdict } from '@/lib/pricing/review'
import { attachCompConcessions, attachSellerNet } from '@/lib/pricing/seller-net'
import { classifyStory, citySlug, irrigationClassFromOwrd, isCustomOrNewSubject, yearQualityCompatible } from '@/lib/pricing/classes'
import type { CompSelectionDiagnostics } from '@/lib/cma/comp-trace'
import { composeBuildSummary, composeFailureSummary, statusAfterBuildFailure } from '@/lib/cma/build-summary'
import { getCmaMarketContext, yearMartCite, cmaMarketSources } from '@/lib/cma/market'
import { adjustComps, computePricing } from '@/lib/cma/pricing'
import { judgeComps, repairNarrativeAgainstAudit } from '@/lib/cma/judge'
import { alignNarrativeToPricedSet, honestComparabilityLine } from '@/lib/cma/judge-consistency'
import { checkNarrativeIntegrity } from '@/lib/cma/audit-narrative-integrity'
import { hydratePhotoUrls } from '@/lib/cma/photos'
import { resolveCmaSiteData } from '@/lib/cma/county'
import { resolveCmaParcels } from '@/lib/cma/parcel-shapes'
import { buildCmaExtras } from '@/lib/cma/extras'
import { computeEquityPosition } from '@/lib/cma/equity'
import { buildListingPlan } from '@/lib/cma/listing-plan'
import { getCmaPriorSaleAtAddress } from '@/lib/data/cma/builderReads'
import { buildSubdivisionStory, SUBDIVISION_STORY_YEARS } from '@/lib/cma/subdivision-story'
import { getCmaSubdivisionHistory } from '@/lib/data/cma/builderReads'
import { auditCma } from '@/lib/cma/audit'
import { evaluateAccuracyContract } from '@/lib/cma/contract'
import { applyCompVerdicts } from '@/lib/cma/client-facing'
import { getBpoListingCyclesByAddress } from '@/lib/data/bpo/reads'
import { getListingPhotosCount } from '@/lib/data/cma/builderReads'
import { getExpiredOwnershipSince } from '@/lib/data/prospecting/get'
import { getCmaListingPriceEvents } from '@/lib/data/cma/localOutcomeReads'
import { buildCmaLocalOutcomes } from '@/lib/pricing/local-outcomes-read'
import { analyzeListingHistory } from '@/lib/bpo/history'
import {
  applyFailedAskCap,
  buildFailureFindings,
  buildServicesList,
  buildNetSheet,
  buildAskExposure,
  resolveFinalCycle,
  stampFinalCycleDom,
  FAILED_ASK_RECENCY_MONTHS,
  feeLine,
  EXPIRED_LISTING_FEE_PCT,
  STANDARD_LISTING_FEE_PCT,
  BUYER_BROKER_ASSUMPTION_PCT,
  type ExpiredAuditData,
} from '@/lib/cma/expired-audit'
import { resolveDevelopmentOpportunities } from '@/lib/cma/development'
import { resolveRentalPotential } from '@/lib/cma/rental-potential'
import { buildCmaMapDataUri } from '@/lib/cma/map'
import { renderCmaHtml } from '@/lib/cma/render'
import { sanitizeClientProse } from '@/lib/cma/voice-sanitize'
import { buildSubjectStatus } from '@/lib/pricing/subject-status'
import { buildCompSearch } from '@/lib/pricing/comp-search'
import { buildCompArea, resolveCompetitionArea } from '@/lib/pricing/comp-area'
import { getCmaAreaUnsoldCycles } from '@/lib/data/cma/areaUnsoldReads'
import { getCmaAreaBandInventory } from '@/lib/data/cma/bandInventory'
import { buildExpiredPeerSet, keptCompMedianPpsf, marketAreaPriceBand } from '@/lib/cma/market-status'
import { bandAroundList, bandRowToRival, buildBandRivalSet, pickCompetitionRing } from '@/lib/cma/band-rivals'
import type { CmaBroker, CmaBuildInput, CmaBuildResult, CmaPricing } from '@/lib/cma/types'

export const CMA_BUILDER_VERSION = 'deterministic-v1 (2026-07-07)'
const DEFAULT_BROKER_SLUG = (process.env.CMA_DEFAULT_BROKER_SLUG ?? 'matthew-ryan').trim().toLowerCase()

async function resolveBroker(input: CmaBuildInput): Promise<CmaBroker> {
  const row =
    (await getCmaBrokerBySlugOrEmail({ slug: input.brokerSlug, email: input.brokerEmail })) ??
    (await getCmaBrokerBySlugOrEmail({ slug: DEFAULT_BROKER_SLUG }))
  if (row) {
    return {
      id: (row.id as string) ?? null,
      slug: (row.slug as string) ?? DEFAULT_BROKER_SLUG,
      displayName: (row.display_name as string) || 'Matt Ryan',
      title: (row.title as string) || 'Broker',
      licenseNumber: (row.license_number as string | null) ?? null,
      email: (row.email as string | null) ?? null,
      // twilio_number, never `phone` — that column holds personal cells for
      // two of three brokers. Enforced by ci:broker-published-phone.
      phone: (row.twilio_number as string | null) ?? null,
      photoUrl: (row.photo_url as string | null) ?? null,
    }
  }
  return {
    id: null,
    slug: DEFAULT_BROKER_SLUG,
    displayName: 'Matt Ryan',
    title: 'Owner & Principal Broker',
    licenseNumber: '201206613',
    email: 'matt@ryan-realty.com',
    phone: '(541) 703-3095',
    photoUrl: '/images/brokers/ryan-matt.png',
  }
}

/**
 * Record a failed build on the cmas row so the admin queue shows WHY.
 *
 * The comp trace goes down with it. A document that could not be priced is
 * exactly the one whose selection ladder someone needs to read, and before
 * 2026-07-30 the failure path wrote only a prose `build_error` — so "which
 * constraint starved this" was unanswerable without re-running the build.
 */
async function recordBuildFailure(
  slug: string,
  error: string,
  meta?: {
    stage: 'subject' | 'comps' | 'pricing' | 'contract'
    docType: 'cma' | 'expired-audit'
    compSelection?: CompSelectionDiagnostics | null
    /**
     * D8 (Matt 2026-08-27): a failed build used to leave an EMPTY row — no
     * comps, no pricing, nothing for the review/rebuild flow to work from.
     * Every figure the build reached before dying is persisted so a broker can
     * see WHY it refused and rebuild with notes instead of starting cold.
     */
    pricing?: CmaPricing | null
    contractChecks?: Array<{ id: string; severity: string; pass: boolean; detail: string }> | null
  },
): Promise<void> {
  const failureSummary = meta
    ? {
        ...composeFailureSummary({
          builder: CMA_BUILDER_VERSION,
          docType: meta.docType,
          stage: meta.stage,
          error,
          compSelection: meta.compSelection ?? null,
        }),
        ...(meta.pricing
          ? {
              pricing_at_failure: {
                recommended: meta.pricing.recommended,
                conservative: meta.pricing.conservative,
                highEnd: meta.pricing.highEnd,
                valueLow: meta.pricing.valueLow,
                valueHigh: meta.pricing.valueHigh,
                predictedClose: meta.pricing.predictedClose ?? null,
                currentAsk: meta.pricing.currentAsk ?? null,
                method1Mid: meta.pricing.method1Mid,
                method2: meta.pricing.method2,
                method3: meta.pricing.method3,
                confidence: meta.pricing.confidence,
                compPpsfCv: meta.pricing.compPpsfCv,
              },
            }
          : {}),
        ...(meta.contractChecks ? { contract_at_failure: meta.contractChecks } : {}),
      }
    : null
  // Matt 2026-09-03 (Rim View): a failed rebuild must not leave the prior
  // kept-set document (Summit/Falcon/Hopper/Hunnell at $1.645M) looking live.
  // Keep the failure summary + build_error for the broker; clear html, comps,
  // and list figures so the draft cannot be mistaken for a priced set.
  // html_path is NOT NULL on public.cmas — nulling it aborts the whole update
  // (live Rim View kept $1.645M Summit/Falcon after a8ab9ded for this reason).
  // Empty string is not a stored document (cmaHasStoredHtml / canOpenCmaDocument).
  // The row's own status, read before anything is written: a failed rebuild
  // clears the document, and a row with no document may not keep wearing
  // `finalized` or `delivered` (three live rows did on 2026-09-07). Archived
  // stays archived; an unreadable status is left alone rather than guessed.
  const existing = await getCmaAdminReviewRowBySlug(slug).catch((err) => {
    console.error('[recordBuildFailure] status read failed', slug, err)
    return null
  })
  const nextStatus = statusAfterBuildFailure(
    existing && typeof existing.status === 'string' ? existing.status : null,
  )
  const clearFields = {
    ...(nextStatus ? { status: nextStatus } : {}),
    build_error: error.slice(0, 2000),
    built_at: new Date().toISOString(),
    ...(failureSummary ? { build_summary: failureSummary } : {}),
    html_content: null,
    html_path: '',
    render_args: null,
    citations: null,
    recommended_list: null,
    value_low: null,
    value_high: null,
    comps_count: 0,
  }
  const cleared: { ok: boolean; id?: string; error?: string } = await updateCmaRowFieldsBySlug(
    slug,
    clearFields,
  ).catch((err) => {
    console.error('[recordBuildFailure] clear update failed', slug, err)
    return { ok: false }
  })
  let cmaId = cleared.ok && typeof cleared.id === 'string' ? cleared.id : null
  // Update can succeed while .select('id') returns empty (RLS). Still wipe comps
  // and retry the clear once so the admin rebuild path cannot keep $1.645M live.
  if (!cmaId || !cleared.ok) {
    const row = existing ?? (await getCmaAdminReviewRowBySlug(slug).catch(() => null))
    if (row && typeof row.id === 'string') cmaId = row.id
    if (!cleared.ok) {
      await updateCmaRowFieldsBySlug(slug, clearFields).catch((err) => {
        console.error('[recordBuildFailure] clear retry failed', slug, err)
      })
    }
  }
  if (cmaId) {
    await replaceCmaComps(cmaId, []).catch((err) => {
      console.error('[recordBuildFailure] replaceCmaComps([]) failed', slug, cmaId, err)
    })
  } else {
    console.error('[recordBuildFailure] no cma id to clear comps for', slug)
  }
}


export async function buildCma(input: CmaBuildInput): Promise<CmaBuildResult> {
  const slug = input.slug.trim().toLowerCase()
  const generatedAtIso = new Date().toISOString()
  // Hoisted: every failure path stamps it on the row alongside the comp trace.
  const docType: 'cma' | 'expired-audit' = input.docType === 'expired-audit' ? 'expired-audit' : 'cma'
  // Held outside the try so the catch-all below can still write the comp trace.
  // A throw anywhere downstream of selection (voice gate, render, persist) used
  // to wipe the answer to "why these comps" off the row entirely.
  let compDiagnostics: CompSelectionDiagnostics | null = null
  try {
    const broker = await resolveBroker(input)

    // 1. Subject.
    const resolved = await resolveCmaSubject({
      mlsNumber: input.mlsNumber,
      rawAddress: input.rawAddress,
      city: input.city,
      postalCode: input.postalCode,
    })
    if (!resolved.subject) {
      await recordBuildFailure(slug, resolved.trace, { stage: 'subject', docType })
      return { ok: false, error: resolved.trace, slug }
    }
    const subject = applySubjectFactOverrides(
      {
        ...resolved.subject,
        streetAddress: applySlugStreetDirectional(resolved.subject.streetAddress, slug),
      },
      input.subjectFacts,
    )
    // Stamp the failed last cycle onto the subject BEFORE pricing and audit.
    // The engine cap keys off standardStatus; the auditor reads lastListPrice.
    // Fetching this after the audit was why first builds failed on rec-above-ask
    // and why live ready rows still printed above last list.
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
          })
        : []
    const cycleStatus = String(cycleRows[0]?.['StandardStatus'] ?? subject.standardStatus ?? '')
    const lastCycleFailed = ['Expired', 'Canceled', 'Withdrawn'].includes(cycleStatus)
    if (lastCycleFailed) {
      const row0 = cycleRows[0] ?? {}
      const cycleAsk = Number(row0['ListPrice'] ?? row0['OriginalListPrice'])
      if (Number.isFinite(cycleAsk) && cycleAsk > 0) subject.lastListPrice = cycleAsk
      subject.standardStatus = cycleStatus
      // ONE days on market for the subject (§0 rule 5). rowToSubject baked
      // CumulativeDaysOnMarket into listingHistoryLine — a list-to-close count
      // across relists — while the "your last listing" review measures the
      // final cycle's own list-to-off-market span. The document printed both
      // (2026-09-07 look pass: 192 in the matrix, 186 in the review). Stamp the
      // final cycle's span here, before anything reads the subject, so the
      // matrix (which reads the line) and the review carry one number.
      stampFinalCycleDom(subject, analyzeListingHistory(cycleRows, subject, null).currentCycle)
    }

    // A STALE CYCLE TELLS NO STORY (round four, class B). cma-19968's newest
    // MLS cycle is a listing that CLOSED in January 2005, so nothing above
    // fires, and `rowToSubject` still hands the document a "Last ask $140,000
    // (Nov 12, 2004)" line and a `lastListPrice` of $140,000 — printed undated
    // three times beside a $461,000 recommendation. Past
    // FAILED_ASK_RECENCY_MONTHS the market that set that ask is a different
    // market, so the ask, its date and the history line are dropped and the
    // reason is carried to the reader on `subjectStatus.note`.
    //
    // Scoped to the case where the last cycle did NOT fail: a stale FAILED ask
    // still binds the price ceiling, which has its own recency branch and a
    // backtest behind it (`applyFailedAskCap`).
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

    // 2 + 3. Comps, market context, and authoritative site data (zoning / well
    // / septic from county + OWRD records — SKILL §3.5/§3.6) in parallel. Site
    // resolution is fail-open and never throws.
    const curatedKeys = (input.compKeys ?? []).map((k) => k.trim()).filter(Boolean)
    const marketPromise = getCmaMarketContext(subject)
    const sitePromise = resolveCmaSiteData(subject)
    const site = await sitePromise
    const subjectIrrigation = irrigationClassFromOwrd(site.water)
    const [selection, market] = await Promise.all([
      curatedKeys.length > 0
        ? selectCompsByKeys(subject, curatedKeys)
        : selectCompsPreferringFacts(subject, { subjectIrrigation }),
      marketPromise,
    ])
    compDiagnostics = selection.diagnostics

    // Broker-confirmed site facts override the GIS-resolved values (§0 allows a
    // seller/broker-confirmed water source). A parcel converted off a private
    // well to a community supplier supersedes the nearest-well-log inference.
    const waterOverride = input.siteOverrides?.water
    if (waterOverride) {
      site.water.source = waterOverride.source
      site.water.providerName = waterOverride.providerName ?? null
      if (waterOverride.source === 'municipal') {
        site.water.wellLog = null
        site.notes = site.notes.filter(
          (n) => !/well log|flow test|private well country|no on-parcel owrd well/i.test(n),
        )
        site.notes.push(
          `Domestic water: ${waterOverride.providerName ?? 'community water system'}, confirmed by the listing broker (the parcel is on a community water supply, not a private well).`,
        )
      }
    }

    // 2.9. ONE HOME, ONE SALE (tasteReview round three, §3). cma-19968's grid
    // printed "60924 Targee" twice, $455,000 in June and $287,500 in March,
    // rows two and four of one table with no unit number and no note — two
    // ListingKeys at one address, same 1,394 square feet, three months apart.
    // One home bought and resold. Weighting both counted that house twice and
    // priced the subject partly off what the flipper paid.
    //
    // Applied HERE, before the judge and before the comp floor, because both
    // ladders converge on `selection` and the drop must be the same whichever
    // one found the sales. The dropped rows print under "considered and not
    // used" with the rule that cut them.
    const sameAddress = dropPriorSalesOfSameHome(selection.comps)
    const priorSaleDrops = sameAddress.dropped
    if (priorSaleDrops.length > 0) {
      const droppedKeys = new Set(priorSaleDrops.map((d) => d.listingKey))
      selection.comps = sameAddress.kept
      if (selection.pricingSales) {
        selection.pricingSales = selection.pricingSales.filter((s) => !droppedKeys.has(s.listingKey))
      }
      selection.trace.push(
        `One home, one sale: ${priorSaleDrops.length} sale(s) were an earlier close at an address already in the set (${priorSaleDrops
          .map((d) => d.address)
          .join(', ')}) and were dropped so no home is counted twice.`,
      )
    }

    if (selection.comps.length < MIN_COMPS) {
      // ONE broker-readable sentence on the row. Until 2026-09-07 this stored
      // the diagnosis plus the entire tier-by-tier search trace — up to 2,000
      // characters of SQL that the queue then printed at a broker, on 74 live
      // rows. Every bit of that detail is still persisted structurally under
      // build_summary.comp_selection (the ladder, the per-tier row counts, the
      // exclusion totals, starved_reason), so nothing is lost; the prose on the
      // row now says only what the reader can act on.
      const err = brokerCompRefusal({
        diagnostics: selection.diagnostics,
        found: selection.comps.length,
        minComps: MIN_COMPS,
        subjectBaths: subject.baths,
        subjectCity: subject.city,
      })
        .replace(/\s+/g, ' ')
        .trim()
      await recordBuildFailure(slug, err, { stage: 'comps', docType, compSelection: selection.diagnostics })
      return { ok: false, error: err, slug }
    }

    // 3.1. Recover photos for the subject + any comp whose cached PhotoURL is
    // null (older backfilled closed comps have no cover photo cached even
    // though Spark holds the full set). Fetched live from Spark; fail-open so
    // a genuinely photoless listing just gets the render placeholder.
    await Promise.all([
      hydratePhotoUrls([subject]),
      hydratePhotoUrls(selection.comps),
    ])

    // 3.5. LLM comparability judgment (fail-open). The deterministic engine
    // does §0-safe math on whatever the query returns; this vets which comps
    // are genuinely comparable and drops the different-tier sales before the
    // math runs. Falls back to the full set + the dispersion guard when the
    // key is absent or the call fails — never blocks a build.
    const judgment = await judgeComps(subject, selection.comps, market)
    const isCurated = curatedKeys.length > 0
    let compsForPricing = selection.comps
    if (judgment && !isCurated) {
      const keep = new Set(judgment.keptKeys)
      const vetted = selection.comps.filter((c) => keep.has(c.listingKey))
      // Never prune below the comp floor — if judgment would leave too few,
      // keep the full set (the dispersion guard still flags it).
      if (vetted.length >= MIN_COMPS) compsForPricing = vetted
      // The judgment step must appear in the rendered verification trace —
      // otherwise the trace says "N comps" while the report prices on fewer.
      selection.trace.push(
        compsForPricing.length === vetted.length
          ? `Comparability judgment (${judgment.model}): kept ${vetted.length} of ${selection.comps.length} candidates, excluded ${judgment.verdicts.filter((v) => v.tier === 'exclude').length} as non-comparable, down-weighted ${judgment.verdicts.filter((v) => v.tier === 'weak').length}. Priced on the ${vetted.length}-comp vetted set.`
          : `Comparability judgment (${judgment.model}) would keep only ${vetted.length} comps — below the ${MIN_COMPS}-comp floor, so the full ${selection.comps.length}-comp set was priced instead.`,
      )
    } else if (judgment && isCurated) {
      // Broker-curated set: the broker already vetted these, so every curated
      // comp is kept. The judge still narrates and its `weak` verdicts still
      // down-weight in the Method 3 reconciliation — it just does not drop a
      // comp the broker deliberately chose.
      const weak = judgment.verdicts.filter(
        (v) => v.tier === 'weak' && compsForPricing.some((c) => c.listingKey === v.listingKey),
      ).length
      selection.trace.push(
        `Broker-selected set of ${compsForPricing.length} comps priced as chosen. Comparability judgment (${judgment.model}) applied for the narrative${weak ? ` and down-weighted ${weak} comp(s) to bracket the range` : ''}; no selected comp was dropped.`,
      )
    } else {
      selection.trace.push(
        'Comparability judgment unavailable for this build. Priced on the full selection with the dispersion guard as backstop, and broker review is required.',
      )
    }

    // 4. Adjustments + pricing (on the vetted comp set). Judge verdicts feed
    // the Method 3 reconciliation weights: strong = full weight, weak = half
    // (bracketing only). Excludes were dropped before the math above.
    const tierByKey = new Map(judgment?.verdicts.map((v) => [v.listingKey, v.tier]) ?? [])
    // ONE CITY, ONE BASIS (tasteReview round three, §1). This used to load the
    // index only on the facts path, so cma-1617-nw-8th — a Bend subject the
    // facts ladder starved, sent to the listings ladder by pickCompSource —
    // fell to the year-over-year basis with n:0 four minutes after two other
    // Bend documents walked the monthly index, and nothing in any of the three
    // said they were measured differently. The index is a fact about the CITY,
    // not about which ladder found the sales.
    const marketIndex = await getPricingMarketIndex(citySlug(subject.city))
    const asOf = new Date().toISOString().slice(0, 10)
    // The SELECTOR's classification, computed once with the same asOf year
    // lib/pricing/match.ts uses. Everything downstream that has to grade a comp
    // by the rule selection actually applied (the accuracy contract's bath cut,
    // the audit self-repair) reads THIS — not its own re-derivation.
    const subjectIsCustomOrNew = isCustomOrNewSubject(
      {
        yearBuilt: subject.yearBuilt,
        newConstructionYn: subject.newConstructionYn,
        remarks: subject.publicRemarks,
        propertySubType: subject.propertySubType,
      },
      Number(asOf.slice(0, 4)),
    )
    const subjectStory = classifyStory(subject.levelsRaw, null)
    const priceSet = (set: typeof selection.comps) => {
      const salesByKey = new Map((selection.pricingSales ?? []).map((s) => [s.listingKey, s]))
      // Walk the index whenever the city HAS one. A sale that carries a
      // sale_pricing_facts row also carries its story class; one off the
      // listings ladder does not, and a missing story class costs a ±13.5%
      // adjustment on that one sale — it does not change which path the
      // document is measured along.
      const usePath = marketIndex.length > 0
      const adj = (usePath
        ? set.map((c) => {
            const sale = salesByKey.get(c.listingKey)
            return sale
              ? adjustCompAlongMarket({
                  subject,
                  subjectStory,
                  sale,
                  saleStory: sale.storyClass,
                  points: marketIndex,
                  asOf,
                }).adjusted
              : adjustCmaCompAlongMarket({
                  subject,
                  subjectStory,
                  comp: c,
                  saleStory: 'unknown',
                  points: marketIndex,
                  asOf,
                }).adjusted
          })
        : adjustComps(subject, set, market)
      ).map((c) => {
        const tier = tierByKey.get(c.listingKey)
        return tier === 'weak' ? { ...c, weight: +(c.weight * 0.5).toFixed(4) } : c
      })
      const p = priceCmaSet({
        subject,
        adjusted: adj,
        market,
        input,
        site,
        selection,
        marketIndex,
        asOf,
        indexUnavailableReason:
          marketIndex.length > 0 ? null : `no monthly index rows for ${citySlug(subject.city) || 'this city'}`,
        computePricing,
      })
      // The concession sentence prints under the matrix and names "the sales
      // that set this price", so it counts THAT set — the kept comps the reader
      // can count — not the wider band set the price path is fitted on
      // (§0 rule 5; look pass 2026-09-07 printed "4 of 8" beside a 5-row matrix).
      attachSellerNet(p, set)
      if (p && usePath) {
        p.notes.unshift(
          `Time adjustment follows the monthly ${subject.city} sale-price path between each comparable close and ${asOf}.`,
        )
      }
      // The comparability narrative renders with the pricing rationale — the
      // seller sees WHY comps were kept, down-weighted, or excluded.
      // Considered and not used: the sales the comparability review set aside
      // and the price-per-square-foot outliers, each with a reason composed
      // from the sale's own facts (never the review's own words, which are not
      // word-sanitized).
      if (p) {
        // `kept` is the set the grid prints, so a sale can never appear in both
        // places. It is NOT the review's keep list: when the review would drop
        // below the comp floor, or the broker curated the set, nothing is
        // actually dropped and the review's exclusions are printed sales
        // (cma-65365-concorde, 2026-09-07: five of six).
        p.rejected = buildRejectedSales({
          candidates: selection.comps,
          preRejected: priorSaleDrops,
          excluded: excludedForAudit(),
          kept: set.map((c) => ({
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
      }
      if (p && judgment) {
        const excludedCount = selection.comps.length - set.length
        const weakCount = adj.filter((c) => tierByKey.get(c.listingKey) === 'weak').length
        let narrative = alignNarrativeToPricedSet(set, judgment.narrative)
        const integrity = checkNarrativeIntegrity({
          narrative,
          comps: adj,
          excluded: excludedForAudit(),
          subject,
          market,
        })
        if (!narrative.trim() || integrity.length > 0) {
          narrative = honestComparabilityLine({ keptCount: adj.length, excludedCount })
        }
        judgment.narrative = narrative
        p.notes.push(
          `Comparable review: ${set.length} of ${selection.comps.length} candidate sales kept after a per-comp comparability review${
            excludedCount ? `, ${excludedCount} excluded as a different market segment` : ''
          }${weakCount ? `, ${weakCount} down-weighted to bracket the range` : ''}.${narrative ? ` ${narrative}` : ''}`,
        )
      }
      return { adj, p }
    }
    const excludedForAudit = () =>
      judgment?.verdicts
        .filter((v) => v.tier === 'exclude')
        .map((v) => ({ listingKey: v.listingKey, reason: v.reason })) ?? []

    let { adj: adjusted, p: pricing } = priceSet(compsForPricing)
    if (!pricing) {
      const err = 'Pricing could not be computed (subject sqft missing).'
      await recordBuildFailure(slug, err, { stage: 'pricing', docType, compSelection: selection.diagnostics })
      return { ok: false, error: err, slug }
    }
    if (lastCycleFailed) {
      const row0 = cycleRows[0] ?? {}
      const offDate = String(row0['off_market_date'] ?? row0['status_change_timestamp'] ?? '') || null
      applyFailedAskCap(pricing, {
        lastFailedListPrice: subject.lastListPrice,
        offMarketDate: offDate,
      })
    }

    // 4.4. Adversarial accuracy audit — an independent second pass whose only
    // job is to refute the finished analysis (Matt directive 2026-07-11:
    // every CMA must be adversarially audited). Builder and auditor share no
    // prompt. Anything but a clean pass forces broker review via the contract.
    let audit = await auditCma({ subject, comps: adjusted, excluded: excludedForAudit(), pricing, judgment, market, site })

    // 4.45. Bounded self-repair: when the audit ties critical/major findings
    // to SPECIFIC comps, drop those comps, re-price, and re-audit ONCE. The
    // repaired analysis is what ships; both rounds are recorded. Never prunes
    // below the comp floor, never loops more than once.
    let firstRoundAudit: typeof audit = null
    let repairedKeys: string[] = []
    // A broker-curated set is not auto-repaired by dropping comps — the broker
    // owns the selection. A non-pass audit still records its findings and forces
    // needs_review through the contract, so the broker reviews it explicitly.
    if (audit && audit.verdict !== 'pass' && !isCurated) {
      const customSubject = subjectIsCustomOrNew
      const flagged = [
        ...new Set(
          audit.findings
            .filter((f) => {
              if (
                !(f.severity === 'critical' || f.severity === 'major') ||
                !(f.category === 'comp-selection' || f.category === 'data-integrity') ||
                !f.compListingKey
              ) {
                return false
              }
              if (f.category === 'data-integrity') return true
              if (!customSubject) return true
              const peer = compsForPricing.find((c) => c.listingKey === f.compListingKey)
              if (
                peer &&
                yearQualityCompatible(
                  {
                    yearBuilt: subject.yearBuilt,
                    newConstructionYn: subject.newConstructionYn,
                    remarks: subject.publicRemarks,
                    propertySubType: subject.propertySubType,
                  },
                  { yearBuilt: peer.yearBuilt, remarks: peer.publicRemarks },
                ) &&
                /luxury|too expensive|premium|price.?tier|higher price/i.test(`${f.claim} ${f.evidence}`)
              ) {
                return false
              }
              return true
            })
            .map((f) => f.compListingKey!),
        ),
      ]
      const remaining = compsForPricing.filter((c) => !flagged.includes(c.listingKey))
      if (flagged.length > 0 && remaining.length >= MIN_COMPS) {
        const repriced = priceSet(remaining)
        if (repriced.p) {
          firstRoundAudit = audit
          repairedKeys = flagged
          compsForPricing = remaining
          adjusted = repriced.adj
          pricing = repriced.p
          if (lastCycleFailed) {
            const row0 = cycleRows[0] ?? {}
            applyFailedAskCap(pricing, {
              lastFailedListPrice: subject.lastListPrice,
              offMarketDate: String(row0['off_market_date'] ?? row0['status_change_timestamp'] ?? '') || null,
            })
          }
          selection.trace.push(
            `Adversarial audit repair: ${flagged.length} comp(s) flagged by the independent audit were removed and the analysis re-priced on the ${remaining.length}-comp set, then re-audited.`,
          )
          pricing.notes.push(
            `The comparability narrative reflects the initial review. The ${flagged.length} comp(s) it references were subsequently removed on the independent audit's findings, and the pricing recomputed on the remaining set.`,
          )
          audit = await auditCma({ subject, comps: adjusted, excluded: excludedForAudit(), pricing, judgment, market, site })
        }
      }
    }

    // 4.46. Narrative repair — the findings the comp repair above cannot touch.
    //
    // A finding with a compListingKey is about a SALE, and 4.45 answers it by
    // dropping the sale. A finding without one is about the PROSE: a miscounted
    // bedroom claim, a $/sqft bracket no comp falls in. Those had no repair path
    // at all, so a sound analysis described one sentence badly failed the audit
    // and parked in draft permanently. On 2026-08-06 that was every stored CMA,
    // 8 of 8 on `Audit verdict: fail`.
    //
    // The comps and the pricing do not move here. Only the sentences do, and
    // the deterministic integrity check must not get worse, and the audit is
    // then re-run so the recorded verdict describes the narrative that actually
    // ships. Once. A document that still fails stays flagged, which is the
    // correct outcome — the point is to stop failing for a fixable sentence,
    // not to talk the auditor out of a real finding.
    let narrativeRepair: { model: string; costUsd: number; accepted: boolean } | null = null
    if (audit && audit.verdict !== 'pass' && judgment && !isCurated) {
      // Eligibility is "the comp repair did not already answer this", NOT
      // "the finding mentions no comp". Naming a comp does not make a finding
      // about the comp: the second Byron rebuild failed on "the narrative
      // falsely claims the 3-bed comp is weighted half when the actual weight
      // is 0.3249", which cites 20603 Kira and is nonetheless a sentence
      // problem about a sale we correctly kept. Filtering on compListingKey
      // sent it to the comp-dropping path, which had nothing to drop, so
      // nothing repaired it. Anything 4.45 already resolved by removing the
      // sale is excluded here; everything else that still fails is prose the
      // model gets one chance to correct.
      const proseFindings = audit.findings
        .filter(
          (f) =>
            (f.severity === 'critical' || f.severity === 'major') &&
            !(f.compListingKey && repairedKeys.includes(f.compListingKey)),
        )
        .map((f) => `${f.claim} ${f.evidence}`.trim())
        .filter(Boolean)
      if (proseFindings.length > 0) {
        const integrityArgs = {
          comps: adjusted,
          excluded: excludedForAudit(),
          subject,
          market,
        }
        const before = checkNarrativeIntegrity({ narrative: judgment.narrative, ...integrityArgs })
        const repair = await repairNarrativeAgainstAudit({
          subject,
          comps: compsForPricing,
          market,
          judgment,
          findings: proseFindings,
        })
        if (repair) {
          const after = checkNarrativeIntegrity({ narrative: repair.narrative, ...integrityArgs })
          if (after.length <= before.length) {
            judgment.narrative = repair.narrative
            const rebuilt = priceSet(compsForPricing)
            if (rebuilt.p) {
              adjusted = rebuilt.adj
              pricing = rebuilt.p
              if (lastCycleFailed) {
                const row0 = cycleRows[0] ?? {}
                applyFailedAskCap(pricing, {
                  lastFailedListPrice: subject.lastListPrice,
                  offMarketDate: String(row0['off_market_date'] ?? row0['status_change_timestamp'] ?? '') || null,
                })
              }
              selection.trace.push(
                `Adversarial audit narrative repair: ${proseFindings.length} finding(s) about the prose were returned to the comparability model, the corrected narrative passed the deterministic integrity check, and the analysis was re-audited on it. No comp and no price changed.`,
              )
              audit = await auditCma({ subject, comps: adjusted, excluded: excludedForAudit(), pricing, judgment, market, site })
              narrativeRepair = { model: repair.model, costUsd: repair.costUsd, accepted: true }
            }
          } else {
            narrativeRepair = { model: repair.model, costUsd: repair.costUsd, accepted: false }
          }
        } else {
          // The repair declined: no API key, or the model returned nothing
          // usable. Silence here is indistinguishable from "the branch never
          // ran", which cost a debugging cycle on 2026-08-06 — three rebuilds
          // where the trace was empty and there was no way to tell whether the
          // repair had been skipped or had simply failed.
          selection.trace.push(
            `Adversarial audit narrative repair: ${proseFindings.length} prose finding(s) were eligible, but the repair returned nothing usable. The audited narrative and the review flag stand.`,
          )
        }
      }
    }

    pricing.notes.push(
      audit
        ? audit.verdict === 'pass'
          ? `Adversarial accuracy audit: an independent review pass attacked this analysis${repairedKeys.length ? `, ${repairedKeys.length} comp(s) were removed on its findings and the analysis re-priced,` : ' and'} found no remaining material defect.`
          : `Adversarial accuracy audit: ${audit.findings.length} finding(s) recorded for broker review before this analysis is released${repairedKeys.length ? ` (after a repair pass removed ${repairedKeys.length} comp(s))` : ''}.`
        : // No em-dash. This string is pushed into pricing.notes, which the
          // brand-voice gate 90 lines below reads and THROWS on, so an em-dash
          // here bricks every build that takes this branch. It stayed latent
          // because the branch only runs when auditCma returns null, and until
          // the Anthropic account hit its usage cap on 2026-07-30 it never did.
          'Adversarial accuracy audit unavailable for this build. Broker review is required before release.',
    )

    // The repair is part of the accuracy trace, so it is recorded whether it was
    // taken or not. A rejected repair is the more interesting record of the two:
    // it says the model was asked to correct the prose and could not do it
    // without making the integrity check worse.
    if (narrativeRepair) {
      selection.trace.push(
        narrativeRepair.accepted
          ? `Narrative repair accepted (${narrativeRepair.model}, $${narrativeRepair.costUsd}).`
          : `Narrative repair rejected (${narrativeRepair.model}, $${narrativeRepair.costUsd}): the rewrite did not survive the deterministic integrity check, so the audited narrative was kept and the review flag stands.`,
      )
    }

    // 4.5. Accuracy contract — the mechanical enforcement of the process.
    // Hard violations kill the build; review violations force needs_review so
    // an unvetted or non-converged CMA can never present as clean.
    const contract = evaluateAccuracyContract({
      comps: adjusted,
      pricing,
      judgment,
      audit,
      site,
      minComps: MIN_COMPS,
      marketContextPresent: market != null,
      subjectSubType: subject.propertySubType,
      subjectBaths: subject.baths,
      subjectIsCustomOrNew,
      failedAsk: pricing.failedAsk ?? null,
    })
    if (!contract.pass) {
      const failed = contract.checks
        .filter((c) => c.severity === 'hard' && !c.pass)
        .map((c) => `${c.id}: ${c.detail}`)
        .join(' | ')
      const err = `Accuracy contract failed: ${failed}`
      await recordBuildFailure(slug, err, {
        stage: 'contract',
        docType,
        compSelection: selection.diagnostics,
        pricing,
        contractChecks: contract.checks,
      })
      return { ok: false, error: err, slug }
    }
    if (contract.forceReview && !pricing.needsReview) {
      pricing.needsReview = true
      pricing.reviewReason =
        pricing.reviewReason ??
        contract.checks
          .filter((c) => c.severity === 'review' && !c.pass)
          .map((c) => c.detail)
          .join(' ')
    }

    // 4.6. THE REVIEW FLAG, ON THE DOCUMENT (tasteReview round three, §2
    // item 1). Two of the four exemplars carried needsReview and rendered as
    // finished opinions — one with the word "indefensible" in its own
    // reviewReason and nowhere on the page. Written AFTER the audit and the
    // contract, so it carries everything that can raise the flag; the reasons
    // are rewritten in lib/pricing/review.ts because render_args is read by
    // the seller document as well as the admin view.
    const auditVerdict = audit
      ? audit.verdict === 'pass'
        ? ('pass' as const)
        : audit.verdict === 'fail'
          ? ('fail' as const)
          : ('review' as const)
      : ('did-not-run' as const)
    pricing.review = buildPricingReview({
      needsReview: pricing.needsReview,
      reviewReason: pricing.reviewReason,
      clamp: pricing.clamp ?? null,
      auditVerdict,
    })
    // CONFIDENCE DERIVES FROM THE VERDICT (round four, class C). cma-19968 was
    // `needsReview: true`, verdict `fail`, three critical findings, and stamped
    // confidence "High" in the same object, because confidence is computed from
    // the comparable set's dispersion and nothing downstream of the audit ever
    // touched it. The mapping only moves it down, and it says so.
    {
      const held = confidenceForVerdict(pricing.confidence, auditVerdict)
      if (held.confidence !== pricing.confidence) {
        pricing.confidence = held.confidence
        if (held.reason) {
          pricing.confidenceReason = [pricing.confidenceReason, held.reason].filter(Boolean).join(' ')
        }
      }
    }

    // 4.7. LAST-LISTING REVIEW (Matt 2026-08-05, superseding the 2026-07-14
    // separate audit doc): there is ONE CMA document. When the subject's most
    // recent MLS cycle came off the market without selling, the doc gains a
    // "your last listing" section built from the
    // same deterministic failure analysis. No separate docType decides this —
    // the LISTING HISTORY does, so an expired subject kicked off from any door
    // gets the review and a clean-history subject never does. (The legacy
    // 'expired-audit' docType is still accepted as input for compat; it no
    // longer changes the document.)
    let expiredAudit: ExpiredAuditData | null = null
    {
      if (lastCycleFailed) {
        const history = analyzeListingHistory(cycleRows, subject, market?.medianDom ?? null)
        const photosCount = subject.listingKey ? await getListingPhotosCount(subject.listingKey) : null
        // Chapter 1's graphic: the final listing period as a stepped line. The
        // dated cuts come from the price-change records for THAT cycle's own
        // ListingKey — not the subject's, which on a relisted address is a
        // different attempt. A cycle with no dated change gets one undated
        // step rather than a date from convention (§0).
        const finalCycle = history.currentCycle
        const priceEvents = finalCycle?.listingKey
          ? await getCmaListingPriceEvents(finalCycle.listingKey).catch(() => [])
          : []
        // A cycle older than FAILED_ASK_RECENCY_MONTHS is nulled with a reason
        // rather than narrated (round four, class B).
        const resolvedCycle = resolveFinalCycle({
          cycle: finalCycle,
          priceEvents,
          listingKey: finalCycle?.listingKey ?? subject.listingKey,
        })
        expiredAudit = {
          findings: buildFailureFindings({ subject, pricing, market, history, photosCount, ownershipSince: await getExpiredOwnershipSince(subject.mlsNumber) }),
          services: buildServicesList(subject),
          netSheet: buildNetSheet(pricing, {
            expectedConcessions: pricing.sellerNet?.expectedConcessions ?? null,
          }),
          feeLine: feeLine(),
          finalCycle: resolvedCycle.cycle,
          // The WHOLE exposure, not the last cut (round four, class B). Measured
          // against the top of the evidence range the cover prints, so the
          // renderer never re-derives a gap from a different number.
          askExposure: buildAskExposure({
            cycle: resolvedCycle.cycle,
            rangeLow: pricing.valueLow,
            rangeHigh: pricing.valueHigh,
          }),
        }
        if (resolvedCycle.suppressedReason) staleCycleReason = resolvedCycle.suppressedReason
      }
    }

    // 4.72. The compliance carve-out (round four, class D). Read off the
    // subject's own newest cycle: 1617 NW 8th is ACTIVE with another brokerage
    // and the closing chapter solicited it; 2465 7th is Withdrawn rather than
    // Expired, so a listing agreement may still be running. The renderer reads
    // this to suppress a solicitation. It decides nothing about price.
    const subjectStatus = buildSubjectStatus({
      standardStatus: subject.standardStatus,
      listAgentName: (cycleRows[0]?.['ListAgentName'] as string | null) ?? subject.listAgentName ?? null,
      listAgentEmail: subject.listAgentEmail ?? null,
      listOfficeName: (cycleRows[0]?.['ListOfficeName'] as string | null) ?? subject.listOfficeName ?? null,
      suppressedReason: staleCycleReason,
    })

    // 4.75. Report extras (Matt 2026-08-05): seasonality, price-band
    // competition, subdivision pulse, financing profile, photo bench. Runs
    // AFTER the failed-ask cap so the band centers on the final recommended
    // price. Each block is independently nullable (§0: cut, don't guess).
    const subjectPhotosCount = subject.listingKey ? await getListingPhotosCount(subject.listingKey) : null
    const extras = await buildCmaExtras({ subject, comps: adjusted, pricing, subjectPhotosCount })

    // 4.755. Chapter 2 — "Priced right sells. Priced high sits", in the
    // reader's own city. The cumulative offer-timing curve and the three
    // first-ask outcome groups are computed HERE, at build, and hung on the
    // market context so `render_args.market.offerTiming` /
    // `render_args.market.askOutcome` are the renderer's only source. Each
    // block carries its own §0 `source`; both also land in `citations` below,
    // including when there is no market context to hang them on.
    const localOutcomes = await buildCmaLocalOutcomes({ city: subject.city })
    if (market) {
      market.offerTiming = localOutcomes.offerTiming
      market.askOutcome = localOutcomes.askOutcome
      market.originalAskRealization = localOutcomes.originalAskRealization
      market.localFailedThenSold = localOutcomes.localFailedThenSold
    }

    // 4.76. What they own: the prior purchase at this address, and what the
    // recommendation says it has done since. Honest in both directions; a loss
    // renders exactly like a gain.
    const priorSale = await getCmaPriorSaleAtAddress(
      subject.streetAddress.split(' ')[0] ?? '',
      subject.streetAddress.split(' ').slice(1).join(' '),
      subject.city,
    ).catch(() => null)
    const equity = computeEquityPosition({ priorSale, recommendedPrice: pricing.recommended, asOf: new Date() })

    // 4.77. The subdivision story (Matt 2026-08-05: the homeowner's deep read
    // on their own street; "this is where we provide our value"). Facts are
    // deterministic over the FULL history; the AI narrative is grounded on
    // those facts + remarks + recent-sale photos, and fails open.
    const storySince = new Date(Date.now() - SUBDIVISION_STORY_YEARS * 365.25 * 24 * 3600e3).toISOString().slice(0, 10)
    const storyRows = subject.subdivision?.trim()
      ? await getCmaSubdivisionHistory(subject.subdivision, storySince).catch(() => [])
      : []
    const subdivisionStory = storyRows.length
      ? await buildSubdivisionStory({ subject, rows: storyRows, sinceIso: storySince })
      : null

    // 4.8. Development potential — pure function over the verified zone +
    // acreage (no new fetches). Every item carries its code citation; the
    // section always renders with the disclaimer + agency directory.
    const development = resolveDevelopmentOpportunities(site, subject)
    // 4.9. Rental potential — same pure-function contract, cited per tenure.
    const rental = resolveRentalPotential(subject, site)

    // 4.9. What we would do about it, derived only from this home's own
    // measured gaps. Every line cites a figure computed above.
    const thisHomePlan = buildServicesList(subject)

    const rawPlan = buildListingPlan({ subject, pricing, extras, expiredAudit, market })
    // Plan lines cite source strings computed elsewhere, so they inherit that
    // punctuation. Sanitize at the boundary rather than trusting every source.
    const listingPlan = rawPlan
      ? {
          source: sanitizeClientProse(rawPlan.source),
          items: rawPlan.items.map((i) => ({
            trigger: sanitizeClientProse(i.trigger),
            action: sanitizeClientProse(i.action),
            basis: sanitizeClientProse(i.basis),
          })),
        }
      : null

    // 5. Map (best effort — the report ships without it if the key is absent).
    // C9: build the comps map only. Subject-only map is not stamped into the letter.
    const map = await buildCmaMapDataUri(subject, adjusted, { tiersUsed: selection.tiersUsed })

    // 5.5. Punctuation sanitization over every composed PROSE string in the
    // report: the pricing rationale/narrative notes, and (for the
    // expired-audit variant) the failure findings, services list, and net-
    // sheet lines. Everything here is either written by us or derived from
    // an LLM summary, and both routinely carry an em-dash or a semicolon.
    // sanitizeClientProse rewrites it in place so the rendered report is clean.
    pricing.notes = pricing.notes.map(sanitizeClientProse)
    pricing.confidenceReason = sanitizeClientProse(pricing.confidenceReason)
    // reviewReason is folded from the accuracy-contract check details, which
    // quote the adversarial audit's own summary — LLM punctuation, shown to the
    // broker in the admin queue.
    if (pricing.reviewReason) pricing.reviewReason = sanitizeClientProse(pricing.reviewReason)

    // The reconciliation sentence and its per-sale reasons are OUR prose and
    // they print in the document, so they get the same punctuation pass.
    if (pricing.reconciliation) {
      pricing.reconciliation.sentence = sanitizeClientProse(pricing.reconciliation.sentence ?? '')
      pricing.reconciliation.weights = pricing.reconciliation.weights.map((w) => ({ ...w, reason: sanitizeClientProse(w.reason) }))
    }

    // 6. Render.
    //
    // renderArgs is EXACTLY what renderCmaHtml receives, minus the two things a
    // re-brand must not inherit: `broker` (the signature block being replaced)
    // and `mapDataUri` (~300KB base64 that several select('*') readers would
    // then pay on every row). Persisting it is what lets W10.3 re-render this
    // document for a different signing broker with byte-identical numbers,
    // instead of calling buildCma again — which re-selects comps and re-runs
    // judgeComps + auditCma, and can therefore change the recommended list
    // price when only the signer changed (CLAUDE.md section 0).
    // Every printed sale carries its seller concession — the 1004's first value
    // adjustment — resolved by the SAME function the seller-net caption under
    // the grid reads, so the line and the caption cannot disagree. Null only
    // when the sale recorded nothing at all.
    const renderComps = attachCompConcessions(applyCompVerdicts(adjusted, judgment?.verdicts ?? []))

    // The recorded lot under the subject and under each kept sale. Resolved
    // from the SAME array the document renders, so a tile numbered 3 is the
    // comp numbered 3 in the grid. Fail-open: no parcel simply means the
    // document carries no land section.
    const parcels = await resolveCmaParcels({ subject, comps: renderComps }).catch(() => null)

    // THE SEARCH, COUNTED (round four, class E). `compTrace` is prose and
    // `tiersUsed` is a list of names, so the story a renderer wrote from them
    // could — and on cma-2465-7th-redmond-97756 did — claim a shortage inside
    // a subdivision that produced three of the five sales printed beneath it.
    // This is the same ladder as counts: what each rung returned, how many of
    // the PRINTED sales came from it, and how those sales fall by subdivision,
    // with one sentence generated from those numbers.
    const compSearch = buildCompSearch({
      subdivision: selection.diagnostics.subject.subdivision ?? subject.subdivision,
      ladder: selection.diagnostics.ladder.map((t) => ({
        tier: t.tier,
        ran: t.ran,
        monthsBack: t.months_back,
        compsAdded: t.comps_added,
      })),
      keptComps: renderComps.map((c) => ({
        subdivision: c.subdivision,
        selectionTier: c.selectionTier,
      })),
    })

    // R2h. ONE AREA, then the two sets that must come out of it (Matt
    // 2026-09-08: "we want to use the same area that we searched and where we
    // actually retrieved comps ... Same thing with the competition").
    //
    // The unsold peers and the competition used to be city-wide reads, so one
    // document carried three different maps. `compArea` is derived from the
    // counted ladder above and the sales this document prints; both reads
    // below are scoped to it and to nothing wider.
    const compArea = buildCompArea({
      subject: {
        latitude: subject.latitude,
        longitude: subject.longitude,
        subdivision: selection.diagnostics.subject.subdivision ?? subject.subdivision,
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
    // Matt 2026-09-08, "definitely tighter on rural homes, make the best
    // decision": a subject with no mapped neighborhood or community widens
    // its competition circle only as far as it has to. `resolveCompetitionArea`
    // returns the RING ORDER to try — one ring for a mapped boundary or a
    // no-coordinate subject, otherwise 5 miles, then 10, then the comp
    // search's own reach, never past it.
    const competitionRings = compArea
      ? resolveCompetitionArea({
          compArea,
          subject: { latitude: subject.latitude, longitude: subject.longitude, city: subject.city },
          keptComps: renderComps.map((c) => ({ latitude: c.latitude, longitude: c.longitude })),
        })
      : []
    // The rows are read ONCE, at the widest ring — `pickCompetitionRing` below
    // walks the narrower rings over rows already in hand, the same shape as
    // the expired-peer window ladder just below it (one read, then a walk).
    const widestCompetitionRing = competitionRings[competitionRings.length - 1] ?? null

    // The peer band is the market-area band (0.55x-1.85x of the anchor) the
    // status grid already uses; the competition band is the +/-10% live band
    // the competition chapter already uses. Same two definitions, read inside
    // the area instead of inside the city.
    const peerBand = marketAreaPriceBand(pricing.recommended || subject.lastListPrice || 0)
    const rivalBand = bandAroundList(pricing.recommended)
    const [unsoldRead, widestAreaInventory] = await Promise.all([
      compArea && peerBand
        ? getCmaAreaUnsoldCycles({
            area: compArea,
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

    const expiredPeers =
      compArea && unsoldRead
        ? buildExpiredPeerSet({
            rows: unsoldRead.rows,
            subject: {
              beds: subject.beds,
              sqft: subject.sqft,
              latitude: subject.latitude,
              longitude: subject.longitude,
              listingKey: subject.listingKey,
              mlsNumber: subject.mlsNumber,
              streetAddress: subject.streetAddress,
            },
            area: compArea,
            keptCompMedianPpsf: keptCompMedianPpsf(renderComps),
          })
        : null

    // Walk the ring ladder over the widest read: stop at the first ring
    // holding three active-or-pending homes, or the widest ring itself.
    const competitionRing =
      widestAreaInventory && competitionRings.length > 0
        ? pickCompetitionRing({
            rings: competitionRings,
            activeRows: widestAreaInventory.activeRows,
            pendingRows: widestAreaInventory.pendingRows,
          })
        : null
    const competitionArea = competitionRing?.area ?? widestCompetitionRing

    const bandRivals =
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
            asOfIso: generatedAtIso,
            widenedFrom: competitionRing.widenedFrom,
            ringsTried: competitionRing.ringsTried,
          })
        : null

    const renderArgs = {
      subject,
      comps: renderComps,
      compSearch,
      compArea,
      expiredPeers,
      bandRivals,
      market,
      pricing,
      client: input.client,
      generatedAtIso,
      subjectTrace: resolved.trace,
      compTrace: selection.trace,
      excludedOutliers: selection.excludedOutliers,
      sellerImprovementsText: input.sellerImprovementsText ?? null,
      site,
      parcels,
      expiredAudit,
      subjectStatus,
      development,
      rental,
      extras,
      subdivisionStory,
      equity,
      listingPlan,
      thisHomePlan,
      tiersUsed: selection.tiersUsed,
    }

    // Spread, never a second hand-written list: a field added to one list and
    // not the other would render here and vanish on re-brand (W10.3).
    const { html, pageCount } = renderCmaHtml({
      ...renderArgs,
      broker,
      mapDataUri: map?.dataUri ?? null,
      subjectMapDataUri: null,
    })

    // 7. Citations — one entry per figure class (CLAUDE.md §0).
    const citations: Record<string, unknown> = {
      builder: CMA_BUILDER_VERSION,
      generated_at: generatedAtIso,
      subject: {
        listing_key: subject.listingKey,
        mls_number: subject.mlsNumber,
        address: `${subject.streetAddress}, ${subject.city}, OR ${subject.postalCode ?? ''}`.trim(),
        source: 'Supabase listings',
        resolution: resolved.trace,
      },
      comp_selection: {
        tiers_used: selection.tiersUsed,
        trace: selection.trace,
        excluded_outliers: selection.excludedOutliers,
      },
      comp_judgment: judgment
        ? {
            source: `LLM comparability judge (${judgment.model})`,
            confidence: judgment.confidence,
            narrative: judgment.narrative,
            kept_keys: judgment.keptKeys,
            excluded: judgment.verdicts.filter((v) => v.tier === 'exclude'),
            cost_usd: judgment.costUsd,
          }
        : { source: 'none', note: 'Priced on the full comp set (deterministic + dispersion guard).' },
      adversarial_audit: audit
        ? {
            source: `Independent adversarial audit (${audit.model})`,
            verdict: audit.verdict,
            summary: audit.summary,
            findings: audit.findings,
            cost_usd: audit.costUsd,
            repaired_comp_keys: repairedKeys.length ? repairedKeys : undefined,
            first_round_verdict: firstRoundAudit?.verdict,
          }
        : { source: 'none', note: 'Audit unavailable — needs_review forced.' },
      comps: adjusted.map((c) => ({
        listing_key: c.listingKey,
        mls_number: c.mlsNumber,
        address: c.address,
        close_price: c.closePrice,
        concessions_amount: c.concessionsAmount ?? null,
        seller_net: c.sellerNet ?? null,
        close_date: c.closeDate,
        sqft: c.sqft,
        days_to_offer: c.daysToOffer,
        dom_total: c.domTotal,
        time_adjustment: c.timeAdjustment,
        size_adjustment: c.sizeAdjustment,
        adjusted_price: c.adjustedPrice,
        weight: c.weight,
        selection_tier: c.selectionTier,
      })),
      subdivision_story: subdivisionStory
        ? {
            source: subdivisionStory.facts.source,
            facts: subdivisionStory.facts,
            model: subdivisionStory.model,
            cost_usd: subdivisionStory.costUsd,
            photo_sales_reviewed: subdivisionStory.photoSalesReviewed,
            photo_sales: subdivisionStory.notableSales.map((n) => ({ mls: n.listNumber, address: n.address })),
          }
        : { source: 'none' },
      // R2h: one entry per read, so a reviewer can re-run the exact scope the
      // peers and the competition were taken over. The rural ladder's ring
      // actually read, and every ring it tried before that, ride along on
      // both entries so a reviewer never has to re-derive the widening.
      comp_area: compArea
        ? {
            ...compArea,
            competition_area: competitionArea,
            competition_rings_tried: competitionRing?.ringsTried ?? [],
            competition_widened_from: competitionRing?.widenedFrom ?? null,
          }
        : { source: 'none', note: 'No sale was printed, so no area was derived.' },
      unsold_peers: unsoldRead
        ? {
            ...unsoldRead.citation,
            window_months: expiredPeers?.windowMonths ?? null,
            windows_tried: expiredPeers?.windowsTried ?? [],
            widened_to: expiredPeers?.widenedTo ?? null,
            count: expiredPeers?.count ?? 0,
            shortfall: expiredPeers?.shortfall ?? true,
            price_band: peerBand,
          }
        : { source: 'none' },
      competition: widestAreaInventory && competitionRing
        ? {
            ...widestAreaInventory.citation,
            active: competitionRing.activeCount,
            pending: competitionRing.pendingCount,
            price_band: rivalBand,
            // The ring actually read (miles, null for a mapped boundary or a
            // no-coordinate subject), every ring tried before it, and the
            // starting ring it widened from — the rural ladder's own trace.
            ring_miles: competitionRing.area.kind === 'radius' ? competitionRing.area.radiusMiles : null,
            rings_tried: competitionRing.ringsTried,
            widened_from: competitionRing.widenedFrom,
          }
        : { source: 'none' },
      equity_position: equity ?? { source: 'none' },
      listing_plan: listingPlan ?? { source: 'none' },
      report_extras: {
        seasonality: extras.seasonality ? { source: extras.seasonality.source, by_month: extras.seasonality.byMonth } : { source: 'none' },
        price_band: extras.band ?? { source: 'none' },
        subdivision_pulse: extras.subdivisionPulse ?? { source: 'none' },
        financing: extras.financing ?? { source: 'none' },
        photo_bench: extras.photoBench
          ? { source: extras.photoBench.source, subject_photos: extras.photoBench.subjectPhotos, comp_median: extras.photoBench.compMedianPhotos }
          : { source: 'none' },
      },
      // Chapter 2's two figures, one entry each (§0: one entry per figure
      // class). Recorded whether or not there was a market context to hang
      // them on, so a reviewer can always re-run the read that produced them.
      market_offer_timing: localOutcomes.offerTiming
        ? {
            ...localOutcomes.offerTiming.source,
            city: localOutcomes.offerTiming.city,
            window_months: localOutcomes.offerTiming.windowMonths,
            n: localOutcomes.offerTiming.n,
            points: localOutcomes.offerTiming.points,
            median_days: localOutcomes.offerTiming.medianDays,
            withheld_reason: localOutcomes.offerTiming.reason,
            ...(market ? {} : { note: 'No market context for this city, so the figure is recorded here only.' }),
          }
        : { source: 'none', note: 'No closed or off-market rows returned for the subject city.' },
      market_original_ask_realization: localOutcomes.originalAskRealization
        ? {
            ...localOutcomes.originalAskRealization.source,
            city: localOutcomes.originalAskRealization.city,
            window_months: localOutcomes.originalAskRealization.windowMonths,
            n: localOutcomes.originalAskRealization.n,
            buckets: localOutcomes.originalAskRealization.buckets,
            ...(market ? {} : { note: 'No market context for this city, so the figure is recorded here only.' }),
          }
        : { source: 'none', note: 'No closed rows returned for the subject city.' },
      market_local_failed_then_sold: localOutcomes.localFailedThenSold
        ? {
            ...localOutcomes.localFailedThenSold.source,
            city: localOutcomes.localFailedThenSold.city,
            window_months: localOutcomes.localFailedThenSold.windowMonths,
            n: localOutcomes.localFailedThenSold.n,
            median_share_of_failed_ask: localOutcomes.localFailedThenSold.medianShareOfFailedAsk,
            withheld_reason: localOutcomes.localFailedThenSold.reason,
            ...(market ? {} : { note: 'No market context for this city, so the figure is recorded here only.' }),
          }
        : { source: 'none', note: 'No failed cycles or closed sales returned for the subject city.' },
      market_ask_outcome: localOutcomes.askOutcome
        ? {
            ...localOutcomes.askOutcome.source,
            city: localOutcomes.askOutcome.city,
            window_months: localOutcomes.askOutcome.windowMonths,
            groups: localOutcomes.askOutcome.groups,
            ...(market ? {} : { note: 'No market context for this city, so the figure is recorded here only.' }),
          }
        : { source: 'none', note: 'No closed or off-market rows returned for the subject city.' },
      final_cycle: expiredAudit?.finalCycle
        ? {
            ...expiredAudit.finalCycle.source,
            list_date: expiredAudit.finalCycle.listDate,
            initial_ask: expiredAudit.finalCycle.initialAsk,
            cuts: expiredAudit.finalCycle.cuts,
            cuts_dated: expiredAudit.finalCycle.cutsDated,
            final_ask: expiredAudit.finalCycle.finalAsk,
            off_market_date: expiredAudit.finalCycle.offMarketDate,
            status: expiredAudit.finalCycle.status,
            days: expiredAudit.finalCycle.days,
          }
        : {
            source: 'none',
            note: staleCycleReason ?? 'The subject has no failed final listing cycle.',
          },
      // §0 trace for the two blocks round four added. Every figure on them is
      // derived from `final_cycle` above and the printed value range, so the
      // trace records the derivation rather than a second query.
      ask_exposure: expiredAudit?.askExposure
        ? {
            source: 'derived from final_cycle above and the printed value range',
            segments: expiredAudit.askExposure.segments,
            dominant_ask: expiredAudit.askExposure.dominant.ask,
            final_ask: expiredAudit.askExposure.final.ask,
          }
        : { source: 'none', note: staleCycleReason ?? 'No dated listing period to measure exposure over.' },
      subject_status: {
        source: 'listings."StandardStatus", "ListAgentName", "ListOfficeName", list_agent_email on the subject cycle',
        ...subjectStatus,
      },
      market_context: market
        ? {
            sources: cmaMarketSources(market),
            geo_slug: market.geoSlug,
            period: `${market.periodStart}..${market.periodEnd}`,
            methodology_version: market.methodologyVersion,
            computed_at: market.computedAt,
            pulse_updated_at: market.pulseUpdatedAt,
            sold_count_365: market.soldCount365, year_volume: yearMartCite(market.yearMart),
            active_count: market.activeCount,
            months_of_supply: market.monthsOfSupply,
            months_of_supply_formula: market.mosFormula,
            yoy_median_price_delta_pct: market.yoyMedianPriceDeltaPct,
          }
        : { source: 'none', note: 'No cache row for the subject city. No time adjustment applied.' },
      pricing: {
        method1: { low: pricing.method1Low, mid: pricing.method1Mid, high: pricing.method1High },
        method2: pricing.method2,
        method3: pricing.method3,
        convergence_spread_pct: pricing.convergenceSpreadPct,
        recommended: pricing.recommended,
        conservative: pricing.conservative,
        high_end: pricing.highEnd,
        confidence: pricing.confidence,
        price_override: pricing.priceOverride,
        improvements_value_add: pricing.improvementsValueAdd,
        size_adjustment_factor: 0.5,
        improvement_recovery_rate: 0.65,
      },
      map: map ? { points: map.pointCount, source: 'Google Static Maps, MLS coordinates' } : null,
      site: {
        tax_account: site.taxAccount,
        taxlot: site.taxlot,
        trs: site.trs,
        acreage: site.acreage,
        zone: site.zone,
        overlays: site.zoneOverlays,
        overlay_detail: site.overlays,
        wildfire_hazard: site.wildfireHazard,
        flood: site.flood,
        water_source: site.water.source,
        well_log: site.water.wellLog,
        irrigation_district: site.water.irrigationDistrict,
        water_rights: site.water.rights,
        mapped_irrigation_acres: site.water.mappedIrrigationAcres,
        primary_irrigation_priority_date: site.water.primaryIrrigationPriorityDate,
        has_private_appurtenant: site.water.hasPrivateAppurtenant,
        water_rights_query_ok: site.water.rightsQueryOk,
        septic: site.septic,
        permits: site.permits,
        entitlement: site.entitlement,
        hunting: site.hunting,
        is_municipal: site.isMunicipal,
        inside_ugb: site.insideUGB,
        public_land: site.publicLand,
        constraints: site.constraints,
        field_confirm: site.fieldConfirm,
        resolved: site.resolved,
        notes: site.notes,
        sources: site.citations,
      },
      ors_disclosure: 'OAR 863-015-0190 elements included on the final page',
      ...(development
        ? {
            development_opportunities: {
              jurisdiction: development.jurisdiction,
              zone: development.zone,
              regs_verified_as_of: development.verifiedAsOf,
              items: development.items,
              zoning_explainer: development.zoningExplainer, buyer_options: development.buyerOptions, hoa: development.hoa, marketing_highlights: development.marketingHighlights,
              source: 'Zone-keyed registry in lib/cma/development.ts; every rule verified against its primary code source 2026-07-14 (58-fact adversarial verification pass)',
            },
          }
        : {}),
      ...(rental
        ? { rental_potential: { jurisdiction: rental.jurisdiction, regs_verified_as_of: rental.verifiedAsOf, tenures: rental.tenures, income: rental.income, marketing_highlights: rental.marketingHighlights, source: 'Jurisdiction-keyed rental registry in lib/cma/rental-potential.ts; every rule cited to its primary code source' } }
        : {}),
      ...(expiredAudit
        ? {
            expired_audit: {
              fee_facts: {
                expired_listing_fee_pct: EXPIRED_LISTING_FEE_PCT,
                standard_listing_fee_pct: STANDARD_LISTING_FEE_PCT,
                buyer_broker_assumption_pct: BUYER_BROKER_ASSUMPTION_PCT,
                source: 'Ryan Realty published rates (app/sell plans; expired rate per broker directive 2026-07-14)',
              },
              failure_findings: expiredAudit.findings,
              net_sheet: expiredAudit.netSheet,
              services_source: `This-home list-kit plan for ${subject.streetAddress}. Photos, 3D, and weekly report stay secondary.`,
            },
          }
        : {}),
    }

    const buildSummary = composeBuildSummary({
      builder: CMA_BUILDER_VERSION,
      docType,
      pageCount,
      comps: adjusted,
      compSelection: selection.diagnostics,
      site,
      judgment,
      audit,
      firstRoundAudit,
      repairedKeys,
      contract,
      pricing,
      market, subject, factsReady: selection.pricingSource === 'facts',
    })

    // 8. Persist. Upsert keyed on slug — a rebuild updates in place (G47:
    // one property, one slug, one CMA).
    const upsert = await upsertCmaRowBySlug({
      slug,
      doc_type: docType,
      subject_address: formatPersistedCmaAddress({
        streetAddress: subject.streetAddress,
        city: subject.city,
        postalCode: subject.postalCode,
        slug,
      }),
      subject_listing_key: subject.listingKey,
      subject_subdivision: subject.subdivision,
      subject_city: subject.city,
      subject_beds: subject.beds != null ? Math.round(subject.beds) : null,
      subject_baths: subject.baths,
      subject_sqft: subject.sqft != null ? Math.round(subject.sqft) : null,
      subject_lot_acres: subject.lotAcres,
      subject_year_built: subject.yearBuilt,
      client_name: input.client.name,
      client_email: input.client.email,
      client_phone: input.client.phone,
      client_notes: applyCmaClientIntent(
        input.client.notes,
        isCmaClientIntent(input.clientIntent) ? input.clientIntent : parseCmaClientIntent(input.client.notes),
      ),
      ...(input.personId && Number.isFinite(input.personId) && input.personId > 0
        ? { person_id: Math.round(input.personId) }
        : {}),
      broker_id: broker.id,
      broker_slug: broker.slug,
      value_low: pricing.valueLow,
      value_high: pricing.valueHigh,
      recommended_list: pricing.recommended,
      comps_count: adjusted.length,
      html_path: `db:cmas.html_content:${slug}`,
      html_content: html,
      // Stored so this document can later be re-rendered for a different
      // signing broker without recomputing a single number (W10.3).
      render_args: renderArgs,
      citations,
      build_summary: buildSummary,
      built_at: generatedAtIso,
      build_error: null,
      price_override: input.priceOverride ?? null,
      status: 'draft',
      generation_reason: input.requestSource
        ? `Deterministic build (${input.requestSource})`
        : 'Deterministic build',
    })
    if (upsert.error || !upsert.id) {
      return { ok: false, error: `cmas upsert failed: ${upsert.error ?? 'no row'}`, slug }
    }

    const compRows: CmaCompInsert[] = adjusted.map((c, i) => ({
      cma_id: upsert.id!,
      comp_listing_key: c.listingKey,
      comp_order: i + 1,
      comp_address: c.address,
      sold_price: Math.round(c.closePrice),
      sold_date: c.closeDate,
      days_to_offer: c.daysToOffer != null ? Math.round(c.daysToOffer) : null,
      dom_total: c.domTotal != null ? Math.round(c.domTotal) : null,
      price_per_sqft: +(c.closePrice / c.sqft).toFixed(2),
    }))
    const compsRes = await replaceCmaComps(upsert.id, compRows)
    if (!compsRes.ok) {
      console.warn('[buildCma] cma_comps replace failed:', compsRes.error)
    }

    return {
      ok: true,
      slug,
      cmaId: upsert.id,
      subject,
      comps: adjusted,
      market,
      pricing,
      html,
      citations,
      pageCount,
    }
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e)
    // Stage is inferred from how far we got: if comps were selected, the throw
    // came from pricing or later, and the comp trace is worth keeping either way.
    await recordBuildFailure(slug, err, {
      stage: compDiagnostics ? 'pricing' : 'subject',
      docType,
      compSelection: compDiagnostics,
    })
    return { ok: false, error: err, slug }
  }
}
