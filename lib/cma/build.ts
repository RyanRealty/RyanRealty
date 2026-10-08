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
  upsertCmaRowBySlug,
  updateCmaRowFieldsBySlug,
  replaceCmaComps,
  snapshotCmaVersion,
  getCmaBuildSummaryBySlug,
  getPricingMarketIndex,
  type CmaCompInsert,
} from '@/lib/data'
import { resolveSigningBrokerForPerson } from '@/lib/data/cma/signing-broker'
import { applySubjectFactOverrides, resolveCmaSubject } from '@/lib/cma/subject'
import { applyReconciledRoomCounts, reconcileSubjectRoomCounts } from '@/lib/cma/subject-room-conflict'
import { pickCoverPhoto } from '@/lib/cma/cover-photo'
import { applySlugStreetDirectional, formatPersistedCmaAddress } from '@/lib/cma/address-slug'
import { applyCmaClientIntent, isCmaClientIntent, parseCmaClientIntent } from '@/lib/cma/client-intent'
import { cmaClientPersistFields, resolveLinkedCmaClient } from '@/lib/cma/expired-owner-link'
import { brokerCompRefusal, selectCompsByKeys, MIN_COMPS } from '@/lib/cma/comps'
import { reviewWithRefill } from '@/lib/cma/review-refill'
import { reviewWeightFactor } from '@/lib/cma/review-weight'
import { selectCompsPreferringFacts } from '@/lib/pricing/select'
import { subjectPlatGround } from '@/lib/pricing/plat-ground'
import {
  adjustCmaCompAlongMarket,
  adjustCompAlongMarket,
  preserveHydratedClosedCompDom,
  priceCmaSet,
  pricingSaleToCmaComp,
  pinPrintedBandToSettingSales,
  syncRangeRuleToHeroBand,
} from '@/lib/pricing/estimate'
import { selectionIsExclusivePocket } from '@/lib/pricing/exclusive-pocket-date-adj'
import { finishExclusivePocketPricing, localReadForSet } from '@/lib/cma/pocket-pricing'
import { buildRejectedSales } from '@/lib/pricing/rejected'
import { dropPriorSalesOfSameHome } from '@/lib/pricing/same-address'
import { buildPricingReview, confidenceForVerdict } from '@/lib/pricing/review'
import { applyAskBelowBandHold, applyAskInBandHold } from '@/lib/cma/gap-hold'
import { attachSellerNet, reanchorSellerNet } from '@/lib/pricing/seller-net'
import { pricingFailureMessage } from '@/lib/pricing/price-set'
import { classifyStory, citySlug, irrigationClassFromOwrd, isCustomOrNewSubject, yearQualityCompatible } from '@/lib/pricing/classes'
import type { CompSelectionDiagnostics } from '@/lib/cma/comp-trace'
import { composeBuildSummary, composeFailureSummary } from '@/lib/cma/build-summary'
import { getCmaMarketContext, yearMartCite, cmaMarketSources, CMA_MARKET_POPULATION } from '@/lib/cma/market'
import { adjustComps, computePricing } from '@/lib/cma/pricing'
import { judgeComps, readJudgeCache, repairNarrativeAgainstAudit, type CompJudgment } from '@/lib/cma/judge'
import type { JudgeDecisionRecord, JudgeUnstableError } from '@/lib/cma/judge-vote'
import { comparabilityNarrativeGate } from '@/lib/cma/narrative-final'
import { hydratePhotoUrls } from '@/lib/cma/photos'
import { hydrateClosedCompDaysOnMarket } from '@/lib/cma/hydrate-closed-comp-dom'
import { resolveCmaSiteData } from '@/lib/cma/county'
import { buildCmaExtras } from '@/lib/cma/extras'
import { computeEquityPosition } from '@/lib/cma/equity'
import { buildListingPlan } from '@/lib/cma/listing-plan'
import { getCmaPriorSaleAtAddress } from '@/lib/data/cma/builderReads'
import { buildSubdivisionStory, SUBDIVISION_STORY_YEARS } from '@/lib/cma/subdivision-story'
import { getCmaSubdivisionHistory } from '@/lib/data/cma/builderReads'
import { auditCma } from '@/lib/cma/audit'
import { evaluateAccuracyContract } from '@/lib/cma/contract'
import { evaluateLetterConsistencyContract } from '@/lib/cma/letter-consistency'
import { printedAddressesOf, printedPlacesOf } from '@/lib/cma/street-context'
import { getBpoListingCyclesByAddress } from '@/lib/data/bpo/reads'
import { getListingPhotosCount } from '@/lib/data/cma/builderReads'
import { getExpiredOwnershipSince } from '@/lib/data/prospecting/get'
import { getCmaListingPriceEvents } from '@/lib/data/cma/localOutcomeReads'
import { buildCmaLocalOutcomes } from '@/lib/pricing/local-outcomes-read'
import { analyzeListingHistory } from '@/lib/bpo/history'
import { readFailedListingCycle, readSubjectStretch, withFailedCycle } from '@/lib/cma/failed-cycle-read'
import { statusIsOnMarket } from '@/lib/cma/subject-on-market'
import {
  applyFailedAskCap,
  failedAskBelowRangeNote,
  reclassifyFailedAskOnPrintedBand,
  buildFailureFindings,
  buildServicesList,
  buildAskExposure,
  resolveFinalCycle,
  stampFinalCycleDom,
  FAILED_ASK_RECENCY_MONTHS,
  STANDARD_LISTING_FEE_PCT,
  BUYER_BROKER_ASSUMPTION_PCT,
  type ExpiredAuditData,
} from '@/lib/cma/expired-audit'
import { subjectDomDays } from '@/lib/cma/comp-matrix'
import { resolveDevelopmentOpportunities } from '@/lib/cma/development'
import { resolveRentalPotential } from '@/lib/cma/rental-potential'
import { buildCmaMapDataUri, cmaMapOptionsFromArgs } from '@/lib/cma/map'
import { renderCmaHtml } from '@/lib/cma/render'
import { sanitizeClientProse } from '@/lib/cma/voice-sanitize'
import { buildSubjectStatus } from '@/lib/pricing/subject-status'
import type { PlacePricingStory } from '@/lib/cma/place-pricing-types'
import { readPlacePricingStory } from '@/lib/data/cma/placePricingRead'
import { loadListingWindowCloses } from '@/lib/cma/listing-window-load'
import { pocketClosedSupportPrice } from '@/lib/pricing/active-dom-nudge'
import { finishRecommendedAfterActives } from '@/lib/cma/finish-recommended'
import { assembleCompetition, assembleExpiredPeers } from '@/lib/cma/assemble-competition'
import type { CmaBroker, CmaBuildInput, CmaBuildResult, CmaPricing } from '@/lib/cma/types'
import { zonedDateKey } from '@/lib/format/date'

export const CMA_BUILDER_VERSION = 'deterministic-v1 (2026-07-07)'
const DEFAULT_BROKER_SLUG = (process.env.CMA_DEFAULT_BROKER_SLUG ?? 'matthew-ryan').trim().toLowerCase()

async function resolveBroker(input: CmaBuildInput): Promise<CmaBroker> {
  // An explicit slug or email is the signer (rebuild, rebrand, the admin
  // select). When neither was passed, the linked person's assigned broker
  // signs. Matt is only the fallback when that person has no assignment.
  let slug = input.brokerSlug?.trim() || null
  const email = input.brokerEmail?.trim() || null
  if (!slug && !email && input.personId) {
    const signer = await resolveSigningBrokerForPerson(input.personId)
    slug = signer.slug?.trim() || null
  }
  const row =
    (await getCmaBrokerBySlugOrEmail({ slug, email })) ??
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
 *
 * The prior document stays (a failed rebuild keeps what was already built), so
 * the trace goes on `build_summary.last_failure`, next to the prior letter's
 * summary: the stage, the reason, the selection diagnostics with its trace,
 * the review's verdicts when the review ended it, and the failed hard checks
 * when the contract did. A successful build writes a fresh summary, which
 * clears it. 1648 Pheasant and 20676 Wild Rose failed at the review on
 * 2026-10-08 and nothing on the row said which sales were seated or why the
 * review dropped them.
 */
type BuildFailureReview = NonNullable<Parameters<typeof composeFailureSummary>[0]['review']>

async function recordBuildFailure(
  slug: string,
  error: string,
  meta?: {
    stage: 'subject' | 'comps' | 'pricing' | 'contract'
    docType: 'cma' | 'expired-audit'
    compSelection?: CompSelectionDiagnostics | null
    pricing?: CmaPricing | null
    contractChecks?: Array<{ id: string; severity: string; pass: boolean; detail: string }> | null
    trace?: readonly string[] | null
    review?: BuildFailureReview | null
  },
): Promise<void> {
  // A failed rebuild keeps the prior document, pricing and comps. Only the
  // failure reason (and when it happened) is written so the broker can still
  // open, approve and send what was already built.
  const reason = error.slice(0, 2000)
  const withStamp = {
    build_error: reason,
    build_failed_at: new Date().toISOString(),
  }
  const written = await updateCmaRowFieldsBySlug(slug, withStamp).catch((err) => {
    console.error('[recordBuildFailure] update failed', slug, err)
    return { ok: false as const, error: err instanceof Error ? err.message : 'update failed' }
  })
  if (!written.ok && /build_failed_at/i.test(written.error ?? '')) {
    await updateCmaRowFieldsBySlug(slug, { build_error: reason }).catch((err) => {
      console.error('[recordBuildFailure] build_error fallback failed', slug, err)
    })
  }
  if (!meta) return
  const lastFailure = composeFailureSummary({
    builder: CMA_BUILDER_VERSION,
    docType: meta.docType,
    stage: meta.stage,
    error: reason,
    at: withStamp.build_failed_at,
    compSelection: meta.compSelection ?? null,
    trace: meta.trace ?? null,
    review: meta.review ?? null,
    contractChecks: meta.contractChecks ?? null,
  })
  // Same merge as the judge cache: the prior summary's keys stay, one key is
  // added. A failed merge never hides the build_error written above.
  await getCmaBuildSummaryBySlug(slug)
    .then((current) => updateCmaRowFieldsBySlug(slug, { build_summary: { ...(current ?? {}), last_failure: lastFailure } }))
    .catch((err) => {
      console.error('[recordBuildFailure] last_failure merge failed', slug, err)
    })
}

/** The review's verdicts in the shape `last_failure.review` stores. */
function failureReviewOf(
  judgment: CompJudgment | null,
  unstable: JudgeUnstableError | null,
): BuildFailureReview | null {
  if (unstable) {
    return {
      kept: [...unstable.record.keptKeys],
      unstableKeys: [...unstable.record.unstableKeys],
      verdicts: unstable.record.verdicts.map((v) => ({
        listingKey: v.listingKey,
        tier: v.tier,
        basis: v.basis ?? null,
        reason: v.reason,
      })),
    }
  }
  if (!judgment) return null
  return {
    kept: [...judgment.keptKeys],
    verdicts: judgment.verdicts.map((v) => ({
      listingKey: v.listingKey,
      tier: v.tier,
      basis: v.basis ?? null,
      reason: v.reason,
    })),
  }
}

/**
 * Merge the judge decision onto the existing build_summary. The prior letter
 * stays; only this JSON key is added. A failed merge must not hide the
 * build_error the caller writes next.
 */
async function persistJudgeCache(slug: string, record: JudgeDecisionRecord): Promise<void> {
  const current = (await getCmaBuildSummaryBySlug(slug)) ?? {}
  await updateCmaRowFieldsBySlug(slug, { build_summary: { ...current, judge_cache: record } })
}


export async function buildCma(input: CmaBuildInput): Promise<CmaBuildResult> {
  const slug = input.slug.trim().toLowerCase()
  const generatedAtIso = new Date().toISOString()
  // The letter's calendar day in Pacific time, the day every printed date on
  // the document reads (formatDate). A UTC slice of an evening build is the
  // next day, which is how a letter dated October 7 printed "Measured
  // 2026-10-08" and "listed ... through October 8, 2026" (reader review
  // 2026-10-08). The reads that print a day take this.
  const letterDay = zonedDateKey(generatedAtIso)
  // Hoisted: every failure path stamps it on the row alongside the comp trace.
  const docType: 'cma' | 'expired-audit' = input.docType === 'expired-audit' ? 'expired-audit' : 'cma'
  // Held outside the try so the catch-all below can still write the comp trace.
  // A throw anywhere downstream of selection (voice gate, render, persist) used
  // to wipe the answer to "why these comps" off the row entirely.
  let compDiagnostics: CompSelectionDiagnostics | null = null
  const snapshot = await snapshotCmaVersion({ slug, reason: 'rebuild' })
  if (!snapshot.ok) {
    return {
      ok: false,
      error: `Could not snapshot the current CMA before rebuild: ${snapshot.error}`,
      slug,
    }
  }
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
    // The cover (Matt 2026-09-09): the best exterior among the listing's own
    // photos, graded once each, the MLS hero kept when it already is one.
    const coverPhoto = await pickCoverPhoto({ listingKey: subject.listingKey, heroUrl: subject.photoUrl })
    if (coverPhoto.url) subject.photoUrl = coverPhoto.url
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
    // The failed cycle, on the days it was on the market: its MLS status log
    // ends it the day it left Active (3177 Coho, withdrawn Feb 10 and expired
    // Sep 30, counts 71 days, not 302). Read once and reused by the stamp
    // below, the listing window and the review (reader review 2026-10-08).
    const failedCycle = lastCycleFailed ? await readFailedListingCycle(cycleRows, subject) : null
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
      stampFinalCycleDom(subject, failedCycle)
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

    // THE SUBJECT'S LAST STRETCH (Matt 2026-10-08, "Last stretch, labeled").
    // A home on the market counts its days from the day it last came on the
    // market, so the first ask the letter prints is the ask in effect then,
    // not its Coming Soon price or an earlier stretch's. A failed listing's
    // stretch is stamped from its final cycle below, where the same rule
    // resolves its opening ask off its price events.
    if (!lastCycleFailed && subject.lastListDate && statusIsOnMarket(subject.standardStatus)) {
      subject.stretch = await readSubjectStretch(subject).catch(() => null)
    }

    // WHEN THE LISTING AND THE HOUSE'S OWN RECORD DISAGREE (Matt 2026-09-10:
    // "flag it, use the history"). The room counts decide which sales are
    // comparable, so a typed bed or bath count propagates into the whole comp
    // set before anyone sees the document. Reconciled HERE, ahead of selection,
    // and re-overridden by the broker's own facts, which always win.
    const roomCheck = reconcileSubjectRoomCounts(
      { beds: subject.beds, baths: subject.baths, sqft: subject.sqft },
      cycleRows.map((r) => ({
        beds: Number(r['BedroomsTotal'] ?? NaN),
        baths: Number(r['BathroomsTotal'] ?? NaN),
        sqft: Number(r['TotalLivingAreaSqFt'] ?? NaN),
        closeDate: typeof r['CloseDate'] === 'string' ? r['CloseDate'] : null,
        status: typeof r['StandardStatus'] === 'string' ? r['StandardStatus'] : null,
      })),
      { asOf: generatedAtIso.slice(0, 10) },
    )
    const roomConflicts = roomCheck.conflicts
    if (roomConflicts.length > 0) {
      const applied = applyReconciledRoomCounts(subject, roomCheck)
      const brokerCorrected = applySubjectFactOverrides(applied, input.subjectFacts)
      subject.beds = brokerCorrected.beds
      subject.baths = brokerCorrected.baths
      // A count taken from the record or the broker drops the listing's split.
      subject.bathsFull = brokerCorrected.bathsFull ?? null
      subject.bathsHalf = brokerCorrected.bathsHalf ?? null
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
        : selectCompsPreferringFacts(subject, {
            subjectIrrigation,
            subjectZoning: site.zone,
            asOf: generatedAtIso.slice(0, 10),
          }),
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

    // Relists reset OnMarketDate. Calendar DOM from that date undercounts
    // when listing/price history still holds the first list (Clearpine / Linda).
    selection.comps = await hydrateClosedCompDaysOnMarket(selection.comps)

    if (selection.comps.length < MIN_COMPS) {
      // ONE broker-readable sentence on the row. Until 2026-09-07 this stored
      // the diagnosis plus the entire tier-by-tier search trace — up to 2,000
      // characters of SQL that the queue then printed at a broker, on 74 live
      // rows. Every bit of that detail is still persisted structurally under
      // build_summary.comp_selection (the ladder, the per-tier row counts, the
      // exclusion totals, starved_reason), so nothing is lost; the prose on the
      // row now says only what the reader can act on.
      // It leads with the path that held the most price-setting sales, by
      // address: the facts walk rides on a listings fallback as facts_path.
      const err = brokerCompRefusal({
        diagnostics: selection.diagnostics,
        found: selection.comps.length,
        minComps: MIN_COMPS,
        subjectBaths: subject.baths,
        subjectCity: subject.city,
        sales: selection.comps.map((c) => c.address),
      })
        .replace(/\s+/g, ' ')
        .trim()
      await recordBuildFailure(slug, err, { stage: 'comps', docType, compSelection: selection.diagnostics, trace: selection.trace })
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
    // key is absent or the call fails. A different product still blocks:
    // pricing that set is a comp shortage, not a number.
    const isCurated = curatedKeys.length > 0
    const priorCache = await getCmaBuildSummaryBySlug(slug)
      .then((summary) => readJudgeCache(summary))
      .catch(() => null)
    // THE ONE 20% LINE (Matt 2026-10-08, lib/pricing/price-tier.ts). The
    // review is handed the same independent anchor the comp search graded
    // every sale against, so it grades price on the same line and never drops
    // a sale the search admitted for price. No anchor: the review runs as
    // before. A broker-picked set never went through the search's line, so its
    // review keeps the band it always drew.
    const judgePriceAnchor = isCurated ? null : (selection.diagnostics?.price_anchor ?? null)
    const judgeOptions = {
      priorCache,
      minComps: MIN_COMPS,
      // A broker-picked set is priced as chosen. The minimum is not in play.
      enforceKeepMinimum: !isCurated,
      priceAnchor: judgePriceAnchor,
    }
    let judgment: Awaited<ReturnType<typeof judgeComps>> = null
    let compsForPricing = selection.comps
    // Candidates the product wall kept out before pricing. With the set the
    // review let through (the narrative gate's gatedKeys, below) it splits
    // every candidate that does not price by the one step that took it out.
    let differentProduct = 0
    if (!isCurated) {
      // The review's keep prices the house, and nothing it excluded comes
      // back (the Falcon re-admission is retired, lib/cma/judgment-prune.ts).
      // A different product, age-restricted housing included, never prices
      // it. Fewer than the minimum is the existing comp shortage, not a price.
      //
      // REFILL FROM THE SAME RUNG (Matt 2026-10-08, lib/cma/review-refill.ts).
      // When the review drops a sale, or splits on one, from an exactly-five
      // set a widening rung reached, the next sale on that same rung is taken
      // and the refilled set is reviewed again, at most twice and never past
      // the rung's bench. `selection.comps` becomes every candidate the
      // review saw, so the letter's "N of M candidate sales kept" and the
      // rejected list describe the final set.
      const review = await reviewWithRefill({
        subject,
        selection,
        minComps: MIN_COMPS,
        exclusivePocket: selectionIsExclusivePocket(selection.tiersUsed),
        judge: (comps) => judgeComps(subject, comps, market, judgeOptions),
        prepare: async (comps) => {
          await hydratePhotoUrls(comps)
          return hydrateClosedCompDaysOnMarket(comps)
        },
      })
      selection.comps = review.candidates
      if (review.pricingSales) selection.pricingSales = review.pricingSales
      selection.trace.push(...review.trace)
      if (review.refill) selection.diagnostics.review_refill = review.refill
      // JUDGE_UNSTABLE after every refill the rung allowed (JudgeUnstableError,
      // lib/cma/judge-vote.ts): store the decision on the row and fail the
      // build with the judge's own sentence, as before the refill existed.
      const unstable: JudgeUnstableError | null = review.unstable
      if (unstable) {
        await persistJudgeCache(slug, unstable.record).catch((cacheErr) => {
          console.error('[cma/judge] could not store the unstable decision', slug, cacheErr)
        })
        const message = unstable.message
        await recordBuildFailure(slug, message, {
          stage: 'comps',
          docType,
          compSelection: selection.diagnostics,
          trace: selection.trace,
          review: failureReviewOf(null, unstable),
        })
        return { ok: false, error: message, slug }
      }
      judgment = review.judgment
      const gated = review.gated
      if (gated.shortage) {
        const err =
          gated.droppedProduct > 0
            ? `Not enough sales of the same product type to price this home. ${gated.comps.length} of ${selection.comps.length} candidates matched, and this home needs ${MIN_COMPS}.`
            : `Not enough comparable sales the review would keep. ${gated.comps.length} of ${selection.comps.length} stayed, and this home needs ${MIN_COMPS}.`
        await recordBuildFailure(slug, err, {
          stage: 'comps',
          docType,
          compSelection: selection.diagnostics,
          trace: selection.trace,
          review: failureReviewOf(judgment, null),
        })
        return { ok: false, error: err, slug }
      }
      compsForPricing = gated.comps
      differentProduct = gated.droppedProduct
      if (judgment) {
        const excluded = judgment.verdicts.filter((v) => v.tier === 'exclude').length
        const weak = judgment.verdicts.filter((v) => v.tier === 'weak').length
        selection.trace.push(
          `Comparability judgment (${judgment.model}): kept ${judgment.keptKeys.length} of ${selection.comps.length} candidates, excluded ${excluded} as non-comparable, down-weighted ${weak}. ${judgment.cacheHit ? 'Reused the stored decision. ' : ''}${gated.trace}`,
        )
      } else if (gated.droppedProduct > 0) {
        selection.trace.push(
          `Comparability judgment unavailable for this build. ${gated.trace} Broker review is required.`,
        )
      } else {
        selection.trace.push(
          'Comparability judgment unavailable for this build. Priced on the full selection with the dispersion guard as backstop, and broker review is required.',
        )
      }
    } else {
      // Broker-curated set: the broker already vetted these, so every curated
      // comp is kept. The judge still narrates and its `weak` verdicts still
      // down-weight in the Method 3 reconciliation — it just does not drop a
      // comp the broker deliberately chose. enforceKeepMinimum is false here,
      // so the review never throws unstable and nothing refills.
      judgment = await judgeComps(subject, selection.comps, market, judgeOptions)
      if (judgment) {
        const weak = judgment.verdicts.filter(
          (v) => reviewWeightFactor(v.tier) < 1 && compsForPricing.some((c) => c.listingKey === v.listingKey),
        ).length
        selection.trace.push(
          `Broker-selected set of ${compsForPricing.length} comps priced as chosen. Comparability judgment (${judgment.model}) applied for the narrative${weak ? ` and down-weighted ${weak} comp(s) to bracket the range` : ''}; no selected comp was dropped.`,
        )
      } else {
        selection.trace.push(
          'Comparability judgment unavailable for this build. Priced on the full selection with the dispersion guard as backstop, and broker review is required.',
        )
      }
    }

    // 4. Adjustments + pricing (on the vetted comp set). Judge verdicts feed
    // the Method 3 reconciliation weights: strong = full weight, weak = half
    // (bracketing only). An automatic set dropped its excludes above; a
    // broker-picked one prices every pick as chosen, an exclude verdict
    // included, and only `weak` is halved (reviewWeightFactor).
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
    // THE LOCAL READ COMES BEFORE THE PRICE (Matt 2026-10-08, "Down only if
    // local fell"). An exclusive-pocket set moves down for date with the city
    // index only when the letter's own local read fell: the listing-window
    // read the local page prints. So the window and its closes are read here,
    // once, and every priced set measures its local read off them through the
    // same function the page uses (lib/cma/pocket-pricing.ts localReadForSet).
    // The final cycle is the same one step 4.7 narrates; it is resolved here
    // and reused there.
    const finalCycleRead = lastCycleFailed
      ? await (async () => {
          const cycle = failedCycle
          const priceEvents = cycle?.listingKey
            ? await getCmaListingPriceEvents(cycle.listingKey).catch(() => [])
            : []
          const resolved = resolveFinalCycle({
            cycle,
            priceEvents,
            listingKey: cycle?.listingKey ?? subject.listingKey,
          })
          return { resolved }
        })()
      : null
    // The failed listing's last stretch, as its final cycle resolved it (Matt
    // 2026-10-08): the day it began, the ask in effect then, and whether it
    // came back.
    const resolvedCycle = finalCycleRead?.resolved.cycle ?? null
    if (resolvedCycle?.listDate) {
      subject.stretch = {
        from: resolvedCycle.listDate,
        firstAsk: resolvedCycle.initialAsk,
        restarted: resolvedCycle.restarted === true,
      }
    }
    const listingWindow = {
      city: subject.city,
      listDate: finalCycleRead?.resolved.cycle?.listDate ?? subject.lastListDate,
      offDate: finalCycleRead?.resolved.cycle?.offMarketDate ?? null,
    }
    const windowCloses = await loadListingWindowCloses({
      ...listingWindow,
      propertySubType: subject.propertySubType,
    }).catch(() => null)
    const priceSet = (set: typeof selection.comps) => {
      const salesByKey = new Map((selection.pricingSales ?? []).map((s) => [s.listingKey, s]))
      // Walk the index whenever the city HAS one. A sale that carries a
      // sale_pricing_facts row also carries its story class; one off the
      // listings ladder does not, and a missing story class costs a ±13.5%
      // adjustment on that one sale — it does not change which path the
      // document is measured along.
      const usePath = marketIndex.length > 0
      // Exclusive pocket (Canter 2026-09-15): city-index date-adjust pumps
      // Horse Back closes toward Clearpine ppsf. Admin owns picker exclusivity;
      // this only refuses applying that series to a set that already stayed in.
      const exclusivePocket = selectionIsExclusivePocket(selection.tiersUsed)
      // The local read for THIS set, off the sales as the adjusters build them
      // (the facts walk rebuilds a sale from its sale_pricing_facts row), so
      // its area is the one the letter's competition chapter draws.
      const { listingMarket: setListingMarket, pocketLocal } = localReadForSet({
        subject,
        comps: set.map((c) => {
          const sale = usePath ? salesByKey.get(c.listingKey) : undefined
          return sale ? preserveHydratedClosedCompDom(pricingSaleToCmaComp(sale), c) : c
        }),
        diagnostics: selection.diagnostics,
        subjectZone: site.zone,
        window: listingWindow,
        closes: windowCloses,
        asOf: letterDay,
      })
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
                  // Sale rebuild drops original_entry / history. Keep hydrate.
                  hydrated: c,
                  exclusivePocket,
                  pocketLocal,
                }).adjusted
              : adjustCmaCompAlongMarket({
                  subject,
                  subjectStory,
                  comp: c,
                  saleStory: 'unknown',
                  points: marketIndex,
                  asOf,
                  exclusivePocket,
                  pocketLocal,
                }).adjusted
          })
        : exclusivePocket
          ? set.map((c) =>
              adjustCmaCompAlongMarket({
                subject,
                subjectStory,
                comp: c,
                saleStory: 'unknown',
                points: [],
                asOf,
                exclusivePocket: true,
                pocketLocal,
              }).adjusted,
            )
          : adjustComps(subject, set, market)
      ).map((c) => {
        const factor = reviewWeightFactor(tierByKey.get(c.listingKey))
        return factor < 1 ? { ...c, weight: +(c.weight * factor).toFixed(4) } : c
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
        // A failed-ask pull under every sale that set the price is held for
        // Matt after the pin (applyAskBelowBandHold), not failed here.
        holdFailedAskUnderSaleSet: true,
        // Recorded on the basis only where the gate applies: the pocket.
        pocketLocal: exclusivePocket ? pocketLocal : undefined,
      })
      // The concession sentence prints under the matrix and names "the sales
      // that set this price", so it counts THAT set — the kept comps the reader
      // can count — not the wider band set the price path is fitted on
      // (§0 rule 5; look pass 2026-09-07 printed "4 of 8" beside a 5-row matrix).
      attachSellerNet(p, set)
      if (p) {
        for (const line of [...new Set(adj.map((c) => c.sewerNote).filter((n): n is string => Boolean(n)))]) {
          if (!p.notes.includes(line)) p.notes.push(line)
        }
      }
      if (p && exclusivePocket) {
        finishExclusivePocketPricing(p, { subject, adj, set, pocketLocal })
      } else if (p && usePath) {
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
            beds: subject.beds,
            baths: subject.baths,
            bathsFull: subject.bathsFull ?? null,
            bathsHalf: subject.bathsHalf ?? null,
            propertySubType: subject.propertySubType,
            latitude: subject.latitude,
            longitude: subject.longitude,
            streetAddress: subject.streetAddress,
            city: subject.city,
            subdivision: subject.subdivision,
          },
        })
      }
      if (p && judgment) {
        const breakdown = narrativeGate.breakdown(set)
        const weakCount = adj.filter((c) => reviewWeightFactor(tierByKey.get(c.listingKey)) < 1).length
        // THE NARRATIVE AGAINST THE FINAL PRICED SET (2026-09-30). The judge
        // wrote it about its own cut. Every sentence a count, a named drop or
        // keep, a weight, a lot figure or a $/sqft band refutes comes out here,
        // against the sales in `set`, and what is left is gated on the full
        // integrity check the audit runs. A narrative with nothing true left,
        // or with a finding left, is replaced by the honest count line, split
        // by reason. This runs whether or not the LLM audit can, and again on
        // every set this build prices, always from the judge's own narrative
        // (or an adopted rewrite), never from what an earlier pass printed
        // (comparabilityNarrativeGate, lib/cma/narrative-final.ts).
        const final = narrativeGate.gate(adj)
        if (final.removed.length > 0) {
          const sentences = [...new Set(final.removed.map((f) => f.sentence))]
          selection.trace.push(
            `Comparability narrative checked against the ${set.length} priced sale(s): ${sentences.length} sentence(s) removed because the priced set refutes them (${[
              ...new Set(final.removed.map((f) => f.kind)),
            ].join(', ')}): ${sentences.map((t) => `"${t}"`).join(' ')}`,
          )
        }
        if (final.fellBack) {
          selection.trace.push(
            final.integrity.length > 0
              ? `Comparability narrative replaced by the count line: ${final.integrity.length} integrity finding(s) remained after the refuted sentences came out.`
              : 'Comparability narrative replaced by the count line: no sentence of it survived the priced set.',
          )
        }
        judgment.narrative = final.narrative
        // Every candidate that does not price, by the one step that took it
        // out. This used to call all of them "excluded as a different market
        // segment", the different-product sales and the audit removals included.
        const reasons = [
          breakdown.reviewExcluded ? `${breakdown.reviewExcluded} excluded by the review` : null,
          breakdown.differentProduct ? `${breakdown.differentProduct} left out as a different product type` : null,
          breakdown.auditRemoved ? `${breakdown.auditRemoved} removed on the independent audit's findings` : null,
          weakCount ? `${weakCount} down-weighted to bracket the range` : null,
        ].filter((r): r is string => r != null)
        p.notes.push(
          `Comparable review: ${set.length} of ${selection.comps.length} candidate sales kept after a per-comp comparability review${
            reasons.length ? `, ${reasons.join(', ')}` : ''
          }.${final.narrative ? ` ${final.narrative}` : ''}`,
        )
      }
      // The local read this set was gated on IS the local page's read: the
      // build prints it, never a second one (Matt 2026-10-08).
      return { adj, p, listingMarket: setListingMarket }
    }
    const excludedForAudit = () =>
      judgment?.verdicts
        .filter((v) => v.tier === 'exclude')
        .map((v) => ({ listingKey: v.listingKey, reason: v.reason })) ?? []
    // The judge's narrative, held apart from whatever a pass prints, and gated
    // again on every set this build prices. `gatedKeys` is the set the review
    // and the product wall let through, before any audit repair: a kept sale
    // missing from a later priced set was removed on the audit's findings.
    const narrativeGate = comparabilityNarrativeGate(judgment?.narrative, {
      candidates: selection.comps,
      excluded: excludedForAudit(),
      subject,
      market,
      tierByKey,
      gatedKeys: new Set(compsForPricing.map((c) => c.listingKey)),
      differentProduct,
    })

    let { adj: adjusted, p: pricing, listingMarket: pricedListingMarket } = priceSet(compsForPricing)
    if (!pricing) {
      const err = pricingFailureMessage(subject, adjusted)
      await recordBuildFailure(slug, err, { stage: 'pricing', docType, compSelection: selection.diagnostics, trace: selection.trace })
      return { ok: false, error: err, slug }
    }
    if (lastCycleFailed) {
      const row0 = cycleRows[0] ?? {}
      const offDate = String(row0['off_market_date'] ?? row0['status_change_timestamp'] ?? '') || null
      applyFailedAskCap(pricing, {
        lastFailedListPrice: subject.lastListPrice,
        offMarketDate: offDate,
        daysOnMarket: subjectDomDays(subject),
        originalListPrice: Number(row0['OriginalListPrice']) || null,
      })
    }

    // Sitting actives can still move the list. The graded audit has to see
    // the list after that nudge, the band clamp, and the thousand-dollar
    // round. A repair that re-prices runs this again before its re-audit,
    // because the comp set changed. That re-audit is the stored grade. There
    // is no second call whose only job is to rewrite a dollar, and no regex
    // rewrite of the summary.
    const settleRecommended = async (
      comps: typeof adjusted,
      current: NonNullable<typeof pricing>,
    ) => {
      const competition = await assembleCompetition({
        subject,
        comps,
        verdicts: judgment?.verdicts ?? [],
        diagnostics: selection.diagnostics,
        recommended: current.recommended,
        subjectZone: site.zone,
        generatedAtIso,
      })
      const finished = syncRangeRuleToHeroBand(
        finishRecommendedAfterActives(current, {
          actives: (competition.bandRivals?.rivals ?? []).map((r) => ({
            status: r.status,
            listPrice: r.listPrice,
            daysOnMarket: r.daysOnMarket,
          })),
          pocketClosedSupport: pocketClosedSupportPrice(comps, subject.subdivision),
          ask: current.failedAsk ?? (lastCycleFailed ? subject.lastListPrice : null),
        }),
      )
      return { competition, pricing: finished }
    }
    let settled = await settleRecommended(adjusted, pricing)
    let competition = settled.competition
    pricing = settled.pricing

    // 4.4. Adversarial accuracy audit — an independent second pass whose only
    // job is to refute the finished analysis (Matt directive 2026-07-11:
    // every CMA must be adversarially audited). Builder and auditor share no
    // prompt. Anything but a clean pass forces broker review via the contract.
    let audit = await auditCma({ subject, comps: adjusted, excluded: excludedForAudit(), pricing, judgment, market, site, candidates: selection.comps })

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
      // A five-sale set cannot lose a sale and still price (the cap equals the
      // floor, Matt 2026-10-07): a flagged comp falls through to the review
      // flag, never a silent reprice.
      if (flagged.length > 0 && remaining.length >= MIN_COMPS) {
        const repriced = priceSet(remaining)
        if (repriced.p) {
          firstRoundAudit = audit
          repairedKeys = flagged
          compsForPricing = remaining
          adjusted = repriced.adj
          pricing = repriced.p
          pricedListingMarket = repriced.listingMarket
          if (lastCycleFailed) {
            const row0 = cycleRows[0] ?? {}
            applyFailedAskCap(pricing, {
              lastFailedListPrice: subject.lastListPrice,
              offMarketDate: String(row0['off_market_date'] ?? row0['status_change_timestamp'] ?? '') || null,
              daysOnMarket: subjectDomDays(subject),
              originalListPrice: Number(row0['OriginalListPrice']) || null,
            })
          }
          selection.trace.push(
            `Adversarial audit repair: ${flagged.length} comp(s) flagged by the independent audit were removed and the analysis re-priced on the ${remaining.length}-comp set, then re-audited.`,
          )
          settled = await settleRecommended(adjusted, pricing)
          competition = settled.competition
          pricing = settled.pricing
          audit = await auditCma({ subject, comps: adjusted, excluded: excludedForAudit(), pricing, judgment, market, site, candidates: selection.comps })
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
        const repair = await repairNarrativeAgainstAudit({
          subject,
          comps: compsForPricing,
          market,
          judgment,
          findings: proseFindings,
          priceAnchor: judgePriceAnchor,
        })
        if (repair) {
          // The rewrite is held to the gate the narrative it would replace
          // already passed, against the same priced set: its refuted sentences
          // come out first, then the integrity check runs on what is left.
          // This used to compare the RAW rewrite with a narrative the gate had
          // already cleaned, so a rewrite lost to sentences the same gate would
          // have taken out of it (review of da8dce6, 2026-09-30). It is taken
          // only when true prose survives: a rewrite the gate reduces to the
          // count line says less than the narrative the audit read.
          const gatedRepair = narrativeGate.adopt(repair.narrative, adjusted)
          if (gatedRepair.adopted) {
            const rebuilt = priceSet(compsForPricing)
            if (!rebuilt.p) {
              narrativeGate.revert()
            } else {
              adjusted = rebuilt.adj
              pricing = rebuilt.p
              pricedListingMarket = rebuilt.listingMarket
              if (lastCycleFailed) {
                const row0 = cycleRows[0] ?? {}
                applyFailedAskCap(pricing, {
                  lastFailedListPrice: subject.lastListPrice,
                  offMarketDate: String(row0['off_market_date'] ?? row0['status_change_timestamp'] ?? '') || null,
                  daysOnMarket: subjectDomDays(subject),
                  originalListPrice: Number(row0['OriginalListPrice']) || null,
                })
              }
              selection.trace.push(
                `Adversarial audit narrative repair: ${proseFindings.length} finding(s) about the prose were returned to the comparability model, the corrected narrative passed the same final-set gate as the narrative it replaced${
                  gatedRepair.removed.length > 0
                    ? ` after ${new Set(gatedRepair.removed.map((f) => f.sentence)).size} sentence(s) the priced set refutes came out`
                    : ''
                }, and the analysis was re-audited on it. No comp and no price changed.`,
              )
              settled = await settleRecommended(adjusted, pricing)
              competition = settled.competition
              pricing = settled.pricing
              audit = await auditCma({ subject, comps: adjusted, excluded: excludedForAudit(), pricing, judgment, market, site, candidates: selection.comps })
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

    // Pushed here, on the pricing that ships, and not beside the re-price: a
    // narrative repair re-prices once more and would drop a note pushed there.
    // It says what happened. The note it replaces said the narrative "reflects
    // the initial review" and still named the removed sales, which stopped
    // being true once every priced set re-gated the narrative (review of
    // da8dce6, 2026-09-30).
    if (repairedKeys.length > 0) {
      pricing.notes.push(
        `The independent audit's findings removed ${repairedKeys.length} comp(s). The pricing was recomputed on the remaining set, and the comparability narrative was checked again against it.`,
      )
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
    // it says the model was asked to correct the prose and its rewrite did not
    // survive the final-set gate.
    if (narrativeRepair) {
      selection.trace.push(
        narrativeRepair.accepted
          ? `Narrative repair accepted (${narrativeRepair.model}, $${narrativeRepair.costUsd}).`
          : `Narrative repair rejected (${narrativeRepair.model}, $${narrativeRepair.costUsd}): the rewrite did not survive the final-set gate (nothing true was left, or an integrity finding remained), so the audited narrative was kept and the review flag stands.`,
      )
    }

    // 4.5. Accuracy contract — the mechanical enforcement of the process.
    // Hard violations kill the build; review violations force needs_review so
    // an unvetted or non-converged CMA can never present as clean.
    // Graded once, on the list the audit just saw.
    const accuracyContractInput = {
      comps: adjusted,
      pricing,
      judgment,
      audit,
      site,
      minComps: MIN_COMPS,
      marketContextPresent: market != null,
      subjectSubType: subject.propertySubType,
      subjectBaths: subject.baths,
      subjectBathsFull: subject.bathsFull ?? null,
      subjectBathsHalf: subject.bathsHalf ?? null,
      subjectBeds: subject.beds,
      subjectSubdivisionSlug: subject.subdivisionSlug ?? null,
      // Where the home sits, so a sale is graded on the picker's own ground.
      subjectGround: subject,
      subjectIsCustomOrNew,
      failedAsk: pricing.failedAsk ?? null,
      // Null when nothing graded a comp on price on this build.
      priceAnchorPpsf: selection.diagnostics?.price_anchor?.ppsf ?? null,
      tiersUsed: selection.tiersUsed,
    }
    const contract = evaluateAccuracyContract(accuracyContractInput)
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
        trace: selection.trace,
        pricing,
        contractChecks: contract.checks,
      })
      return { ok: false, error: err, slug }
    }
    // Re-narrow after audit repair/rebuild reassignments (priceSet.p is
    // CmaPricing | null). Without this, `if (pricing && …)` widens the rest
    // of the function and TS18047 fires in closures (ci:commit-compiles).
    if (!pricing) {
      const err = pricingFailureMessage(subject, adjusted, { afterAudit: true })
      await recordBuildFailure(slug, err, {
        stage: 'pricing',
        docType,
        compSelection: selection.diagnostics,
        trace: selection.trace,
      })
      return { ok: false, error: err, slug }
    }
    // THE ROOM-COUNT CONFLICT REACHES THE REVIEWER (Matt 2026-09-10). A count
    // the listing and the house's own closed sale disagree on is never a quiet
    // resolution: whichever number priced the document, a person confirms it.
    if (roomConflicts.length > 0) {
      pricing.needsReview = true
      pricing.reviewReason = [pricing.reviewReason, ...roomConflicts.map((c) => c.note)]
        .filter(Boolean)
        .join(' ')
    }
    if (contract.forceReview) {
      // Every failing review check reaches the reason, even when the engine
      // had already raised the flag: Dana's 1531 10th carried dispersion and
      // a ±27% range, and the range sentence never printed because the flag
      // was up first (2026-09-09).
      pricing.needsReview = true
      const reviewReasonHeld = pricing.reviewReason ?? ''
      const details = contract.checks
        .filter((c) => c.severity === 'review' && !c.pass)
        .map((c) => c.detail)
        .filter((d) => d && !reviewReasonHeld.includes(d))
      pricing.reviewReason = [pricing.reviewReason, ...details].filter(Boolean).join(' ')
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
      // finalCycleRead is set exactly when lastCycleFailed is.
      if (lastCycleFailed && finalCycleRead) {
        const history = withFailedCycle(
          analyzeListingHistory(cycleRows, subject, market?.medianDom ?? null),
          failedCycle,
        )
        const photosCount = subject.listingKey ? await getListingPhotosCount(subject.listingKey) : null
        // Chapter 1's graphic: the final listing period as a stepped line. The
        // dated cuts come from the price-change records for THAT cycle's own
        // ListingKey — not the subject's, which on a relisted address is a
        // different attempt. A cycle with no dated change gets one undated
        // step rather than a date from convention (§0). A cycle older than
        // FAILED_ASK_RECENCY_MONTHS is nulled with a reason rather than
        // narrated (round four, class B). Resolved once, before pricing, so
        // the local read the pocket's date move is gated on reads this same
        // listing window (finalCycleRead).
        const resolvedCycle = finalCycleRead.resolved
        expiredAudit = {
          findings: buildFailureFindings({ subject, pricing, market, history, photosCount, ownershipSince: await getExpiredOwnershipSince(subject.mlsNumber) }),
          services: buildServicesList(subject),
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

    // 4.75. Photo count now; extras (and the listing plan that reads the band)
    // wait until CompArea + area inventory exist so extras never call the
    // city-wide band when a CompArea is set.
    const subjectPhotosCount = subject.listingKey ? await getListingPhotosCount(subject.listingKey) : null

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
    // The subject's ground, not one MLS spelling (reader review 2026-10-08,
    // 1355 Jacksonville): every close on its recorded plat, whatever the MLS
    // calls it, and the name alone only where no polygon holds the home.
    const storyRows = subject.subdivision?.trim()
      ? await getCmaSubdivisionHistory(subject.subdivision, storySince, {
          ground: subjectPlatGround(subject),
          city: subject.city ?? null,
        }).catch(() => [])
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

    // 5. Map (best effort — the report ships without it if the key is absent).
    // C9: build the comps map only. Subject-only map is not stamped into the letter.
    // The stored letter carries the same three pin families, off the same
    // sets, as the served one (lib/cma/serve-document.ts): render_args'
    // comps, area, rivals and unsold peers, read by the same options builder.
    // Its overlay rides into the render below, so html_content (the PDF and
    // the review snapshot) is not a bare tile under "Every pin below is a row".
    const map = await buildCmaMapDataUri(
      subject,
      competition.renderComps,
      cmaMapOptionsFromArgs({
        subject,
        comps: competition.renderComps,
        compArea: competition.compArea,
        bandRivals: competition.bandRivals,
        expiredPeers: assembleExpiredPeers({ competition, subject, lastCycleFailed }).expiredPeers,
        tiersUsed: selection.tiersUsed,
      }),
    )

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
    // Loaded before the graded audit, on the pre-nudge list, so the nudge and
    // the letter read the same rivals. A repair that re-prices replaces this.
    const {
      renderComps,
      parcels,
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

    // Extras + listing plan AFTER CompArea. When CompArea is set, pass the
    // same ±10% area inventory the competition chapter uses — never city-wide
    // getCmaBandInventory (Matt lock: same pocket/area/time for closed +
    // active + expired).
    const extras = await buildCmaExtras({
      subject,
      comps: adjusted,
      pricing,
      subjectPhotosCount,
      compArea,
      areaInventory: widestAreaInventory,
      band: rivalBand,
    })
    const rawPlan = buildListingPlan({ subject, pricing, extras, expiredAudit, market })
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

    // The homes that came off unsold, from the same one ring the competition
    // was read over and by the same rules (Matt 2026-10-07, rule 24). The
    // closed-sale lookback caps the window inside it (Matt ADD 2026-09-12).
    const { expiredPeers } = assembleExpiredPeers({ competition, subject, lastCycleFailed })

    let placePricing: PlacePricingStory | null = null
    try {
      placePricing = await readPlacePricingStory({
        compArea,
        latitude: subject.latitude,
        longitude: subject.longitude,
        propertySubType: subject.propertySubType,
        asOf: letterDay,
      })
    } catch (err) {
      console.error('[buildCma] placePricing', err)
      placePricing = null
    }

    // The local page prints the read the price was gated on (Matt 2026-10-08,
    // "Down only if local fell"): the same closes, the same window and the
    // same sales area, measured by priceSet for the set that priced. One read,
    // so the two pages cannot disagree about which way homes like this went.
    const listingMarket = pricedListingMarket

    const recommendedBeforePin = pricing.recommended
    pricing = pinPrintedBandToSettingSales(pricing, renderComps)
    if (pricing.recommended !== recommendedBeforePin) reanchorSellerNet(pricing)
    // The ask exposure measured the pre-pin band above; the band it prints is
    // the pinned one. resolvedCycle is block-scoped there, so the cycle is
    // read back off the audit block.
    if (expiredAudit) {
      expiredAudit.askExposure = buildAskExposure({
        cycle: expiredAudit.finalCycle,
        rangeLow: pricing.valueLow,
        rangeHigh: pricing.valueHigh,
      })
    }
    // RULE 22 (Matt 2026-10-07): the last failed ask inside the trimmed band
    // the recommendation reads from, read AFTER the pin so low and high are
    // rangeRule.adjustedLow/adjustedHigh by construction. An ask above the
    // band is rule 16's ordinary case; an ask below it is the existing
    // failedAskBelowRange path. The build completes and the document
    // persists; the hold on the row is what keeps it from sending
    // (lib/cma/gap-hold.ts). Never widen or reshape the search for this.
    // sanitizeClientProse already ran; the sentence is written clean.
    // The cap judged the ask before the pin; the hold reads the pinned band.
    // Re-read below / inside / above on the printed band first, so exactly
    // one of them holds on the row (review, 2026-10-07).
    reclassifyFailedAskOnPrintedBand(
      pricing,
      pricing.failedAsk ?? (lastCycleFailed ? (subject.lastListPrice ?? null) : null),
    )
    applyAskInBandHold(pricing, { lastCycleFailed, lastListPrice: subject.lastListPrice, auditVerdict })
    // A recommendation under the printed band low is not a price (rule 20).
    // When the failed-ask ceiling put it there the document is held for Matt
    // ('ask-below-band', 20676 Wild Rose and 915 Saginaw, 2026-10-07); any
    // other cause fails the build here, before a letter is written.
    const belowBand = applyAskBelowBandHold(pricing, { lastListPrice: subject.lastListPrice, auditVerdict })
    if (!belowBand.ok) {
      const err = `Pricing failed: ${belowBand.error}`
      await recordBuildFailure(slug, err, { stage: 'pricing', docType, pricing })
      return { ok: false, error: err, slug }
    }
    // Rule 26: the held letter says both facts once (heldUnderBandLead). The
    // cap's "the recommended list sits on the sales" note is not true of it.
    if (pricing.hold?.kind === 'ask-below-band') {
      const stale = new Set(
        [pricing.failedAsk, subject.lastListPrice]
          .filter((a): a is number => a != null && a > 0)
          .map((a) => failedAskBelowRangeNote(a)),
      )
      pricing.notes = pricing.notes.filter((n) => !stale.has(n))
    }
    // A blank client on an expired home is the skip-traced owner. Resolved
    // before render so the letter can keep that name out of the copy, and
    // before persist so a null does not wipe a client already stored.
    const linked = await resolveLinkedCmaClient({
      client: input.client,
      personId: input.personId ?? null,
      listingKey: subject.listingKey,
    })
    const linkedClient = {
      ...input.client,
      name: linked.name,
      email: linked.email,
      phone: linked.phone,
    }
    const renderArgs = {
      coverPhoto: {
        url: coverPhoto.url,
        source: coverPhoto.source,
        reason: coverPhoto.reason,
        graded: coverPhoto.graded,
        costUsd: coverPhoto.costUsd,
      },
      subject,
      comps: renderComps,
      compSearch,
      compArea,
      expiredPeers,
      placePricing,
      bandRivals,
      market,
      pricing,
      client: linkedClient,
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
      listingMarket,
    }

    // Spread, never a second hand-written list: a field added to one list and
    // not the other would render here and vanish on re-brand (W10.3).
    const personId = linked.personId
    const { html, pageCount } = renderCmaHtml({
      ...renderArgs,
      broker,
      mapDataUri: map?.dataUri ?? null,
      mapOverlay: map,
      subjectMapDataUri: null,
      docLinks: { brokerSlug: broker.slug, personId, cmaSlug: slug },
    })
    const letterContract = evaluateLetterConsistencyContract({
      html,
      names: { clientName: linkedClient.name },
      identity: { personId, clientEmail: linkedClient.email },
      pricing,
      closedComps: renderComps,
      expiredAddresses: (expiredPeers?.peers ?? []).map((peer) => peer.address),
      // A name word inside an address the letter prints is the street, not the owner.
      printedAddresses: printedAddressesOf(renderArgs),
      // A name word inside a place the letter printed from its data (a subdivision, the comp area) is the place.
      printedPlaces: printedPlacesOf(renderArgs),
      place: {
        compArea,
        propertySubType: subject.propertySubType,
        listingMarket,
        citywideListingCounts: (market?.askOutcome?.groups ?? [])
          .map((group) => group.n)
          .filter((n) => n > 0),
      },
      // Down only if local fell (Matt 2026-10-08): the printed grid against
      // the local page it sits a page after.
      pocketDate: { timeAdjustment: pricing.timeAdjustment ?? null, comps: renderComps, listingMarket },
    })
    for (const check of letterContract.checks) {
      contract.checks.push(check)
    }
    if (!letterContract.pass) {
      contract.pass = false
      const failed = letterContract.checks
        .filter((c) => c.severity === 'hard' && !c.pass)
        .map((c) => `${c.id}: ${c.detail}`)
        .join(' | ')
      const err = `Letter consistency contract failed: ${failed}`
      await recordBuildFailure(slug, err, {
        stage: 'contract',
        docType,
        contractChecks: letterContract.checks,
      })
      return { ok: false, error: err, slug }
    }

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
        beds: subject.beds,
        baths: subject.baths,
        // Present only when the listing and this home's own closed sale gave
        // different room counts at the same square footage. Each entry names
        // both numbers, which one priced the document, and why.
        room_conflicts: roomConflicts.length > 0 ? roomConflicts : undefined,
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
            input_checksum: judgment.inputChecksum ?? null,
            judge_version: judgment.decision?.judgeVersion ?? null,
            votes: judgment.decision?.votes ?? null,
            cache_hit: judgment.cacheHit === true,
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
        // Why the size move is what it is: adjusted, or no living area on
        // record for the sale or the subject (Matt 2026-10-08).
        size_adjustment_basis: c.sizeAdjustmentBasis ?? null,
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
      listing_window_market: listingMarket
        ? {
            place: listingMarket.place,
            grain: listingMarket.grain,
            sized: listingMarket.sized,
            sqft_low: listingMarket.sqftLow,
            sqft_high: listingMarket.sqftHigh,
            early: listingMarket.early,
            late: listingMarket.late,
            price_move: listingMarket.priceMove,
            ppsf_move: listingMarket.ppsfMove,
            source: `Supabase listings. ${listingMarket.place} (${listingMarket.grain}), same property subtype as the subject, Closed, ClosePrice > 0, CloseDate ${listingMarket.early.from} through ${listingMarket.late.to}. Measured ${listingMarket.asOf ?? letterDay}.`,
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
            population: CMA_MARKET_POPULATION,
            active_count: market.activeCount,
            months_of_supply: market.monthsOfSupply,
            months_of_supply_closed_6mo: market.closedSixMonths ?? null,
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
                standard_listing_fee_pct: STANDARD_LISTING_FEE_PCT,
                buyer_broker_assumption_pct: BUYER_BROKER_ASSUMPTION_PCT,
                source: 'Ryan Realty published rates (app/sell plans). One fee on every letter, 3% (Matt 2026-10-08).',
              },
              failure_findings: expiredAudit.findings,
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
      ...cmaClientPersistFields(linked),
      client_notes: applyCmaClientIntent(
        input.client.notes,
        isCmaClientIntent(input.clientIntent) ? input.clientIntent : parseCmaClientIntent(input.client.notes),
      ),
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
