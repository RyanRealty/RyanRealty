/**
 * Deterministic CMA build orchestrator.
 *
 * buildCma() runs the whole pipeline with NO LLM dependency:
 *   subject (listings) → comps (tiered selection) → market context (cache
 *   tables) → adjustments + three-method pricing → static map → brutalist
 *   HTML render → citations → persist to public.cmas (html_content in the
 *   DB, Vercel-safe) + public.cma_comps.
 *
 * Draft only — Matt reviews at /admin/cmas; nothing is sent automatically.
 */

import {
  getCmaBrokerBySlugOrEmail,
  upsertCmaRowBySlug,
  updateCmaRowFieldsBySlug,
  replaceCmaComps,
  getPricingMarketIndex,
  type CmaCompInsert,
} from '@/lib/data'
import { applySubjectFactOverrides, resolveCmaSubject } from '@/lib/cma/subject'
import { applySlugStreetDirectional, formatPersistedCmaAddress } from '@/lib/cma/address-slug'
import { applyCmaClientIntent, isCmaClientIntent, parseCmaClientIntent } from '@/lib/cma/client-intent'
import { selectCompsByKeys, MIN_COMPS } from '@/lib/cma/comps'
import { selectCompsPreferringFacts } from '@/lib/pricing/select'
import { adjustCompAlongMarket, priceCmaSet } from '@/lib/pricing/estimate'
import { attachSellerNet } from '@/lib/pricing/seller-net'
import { classifyStory, citySlug } from '@/lib/pricing/classes'
import type { CompSelectionDiagnostics } from '@/lib/cma/comp-trace'
import { composeBuildSummary, composeFailureSummary } from '@/lib/cma/build-summary'
import { getCmaMarketContext, yearMartCite } from '@/lib/cma/market'
import { adjustComps, computePricing } from '@/lib/cma/pricing'
import { judgeComps, repairNarrativeAgainstAudit } from '@/lib/cma/judge'
import { checkNarrativeIntegrity } from '@/lib/cma/audit-narrative-integrity'
import { hydratePhotoUrls } from '@/lib/cma/photos'
import { resolveCmaSiteData } from '@/lib/cma/county'
import { buildCmaExtras } from '@/lib/cma/extras'
import { computeEquityPosition } from '@/lib/cma/equity'
import { buildListingPlan } from '@/lib/cma/listing-plan'
import { getCmaPriorSaleAtAddress, getCmaSubdivisionHistory, getListingPhotosCount } from '@/lib/data/cma/builderReads'
import { buildSubdivisionStory, SUBDIVISION_STORY_YEARS } from '@/lib/cma/subdivision-story'
import { auditCma } from '@/lib/cma/audit'
import { evaluateAccuracyContract } from '@/lib/cma/contract'
import { applyCompVerdicts } from '@/lib/cma/client-facing'
import { getBpoListingCyclesByAddress } from '@/lib/data/bpo/reads'
import { getExpiredOwnershipSince } from '@/lib/data/prospecting/get'
import { analyzeListingHistory } from '@/lib/bpo/history'
import {
  applyFailedAskCap,
  buildFailureFindings,
  buildServicesList,
  buildNetSheet,
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
import { checkBrandVoice } from '@/lib/voice/check'
import { sanitizeClientProse } from '@/lib/cma/voice-sanitize'
import { reviewProse } from '@/lib/voice/reviewer'
import type { CmaBroker, CmaBuildInput, CmaBuildResult } from '@/lib/cma/types'

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
  meta?: { stage: 'subject' | 'comps' | 'pricing' | 'contract'; docType: 'cma' | 'expired-audit'; compSelection?: CompSelectionDiagnostics | null },
): Promise<void> {
  await updateCmaRowFieldsBySlug(slug, {
    build_error: error.slice(0, 2000),
    built_at: new Date().toISOString(),
    ...(meta
      ? {
          build_summary: composeFailureSummary({
            builder: CMA_BUILDER_VERSION,
            docType: meta.docType,
            stage: meta.stage,
            error,
            compSelection: meta.compSelection ?? null,
          }),
        }
      : {}),
  }).catch(() => {})
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
    const subject = applySubjectFactOverrides({ ...resolved.subject, streetAddress: applySlugStreetDirectional(resolved.subject.streetAddress, slug) }, input.subjectFacts)

    // 2 + 3. Comps, market context, and authoritative site data (zoning / well
    // / septic from county + OWRD records — SKILL §3.5/§3.6) in parallel. Site
    // resolution is fail-open and never throws.
    const curatedKeys = (input.compKeys ?? []).map((k) => k.trim()).filter(Boolean)
    const [selection, market, site] = await Promise.all([
      curatedKeys.length > 0 ? selectCompsByKeys(subject, curatedKeys) : selectCompsPreferringFacts(subject),
      getCmaMarketContext(subject),
      resolveCmaSiteData(subject),
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

    if (selection.comps.length < MIN_COMPS) {
      // Lead with the CONSTRAINT that starved it, not the bare count. A broker
      // reading "only 2 qualifying closed comps found" cannot tell whether the
      // subject is genuinely unpriceable or the search was too narrow; the
      // diagnosis names the binding band, radius, or exclusion.
      const why = selection.diagnostics.starved_reason
      // The trace already ends with `why` whenever the diagnosis was produced,
      // so appending it wholesale printed the same paragraph twice.
      const rest = selection.trace.filter((t) => t !== why)
      const err = `Only ${selection.comps.length} qualifying closed comps found (minimum ${MIN_COMPS}). ${why ?? ''}${
        rest.length ? ` Full search trace: ${rest.join(' ')}` : ''
      }`
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
    const marketIndex = selection.pricingSource === 'facts'
      ? await getPricingMarketIndex(citySlug(subject.city))
      : []
    const asOf = new Date().toISOString().slice(0, 10)
    const subjectStory = classifyStory(subject.levelsRaw, null)
    const priceSet = (set: typeof selection.comps) => {
      const salesByKey = new Map((selection.pricingSales ?? []).map((s) => [s.listingKey, s]))
      const usePath = marketIndex.length > 0 && set.every((c) => salesByKey.has(c.listingKey))
      const adj = (usePath
        ? set.map((c) => {
            const sale = salesByKey.get(c.listingKey)!
            return adjustCompAlongMarket({
              subject,
              subjectStory,
              sale,
              saleStory: sale.storyClass,
              points: marketIndex,
              asOf,
            }).adjusted
          })
        : adjustComps(subject, set, market)
      ).map((c) => {
        const tier = tierByKey.get(c.listingKey)
        return tier === 'weak' ? { ...c, weight: +(c.weight * 0.5).toFixed(4) } : c
      })
      const p = priceCmaSet({ subject, adjusted: adj, market, input, selection, marketIndex, asOf, computePricing })
      attachSellerNet(p, selection.pricingSales ?? set, p?.recommended ?? null)
      if (p && usePath) {
        p.notes.unshift(
          `Time adjustment follows the monthly ${subject.city} sale-price path between each comparable close and ${asOf}.`,
        )
      }
      // The comparability narrative renders with the pricing rationale — the
      // seller sees WHY comps were kept, down-weighted, or excluded.
      if (p && judgment) {
        const excludedCount = selection.comps.length - set.length
        const weakCount = adj.filter((c) => tierByKey.get(c.listingKey) === 'weak').length
        p.notes.push(
          `Comparable review: ${set.length} of ${selection.comps.length} candidate sales kept after a per-comp comparability review${
            excludedCount ? `, ${excludedCount} excluded as a different market segment` : ''
          }${weakCount ? `, ${weakCount} down-weighted to bracket the range` : ''}. ${judgment.narrative}`,
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
      const flagged = [
        ...new Set(
          audit.findings
            .filter(
              (f) =>
                (f.severity === 'critical' || f.severity === 'major') &&
                (f.category === 'comp-selection' || f.category === 'data-integrity') &&
                f.compListingKey,
            )
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
    })
    if (!contract.pass) {
      const failed = contract.checks
        .filter((c) => c.severity === 'hard' && !c.pass)
        .map((c) => `${c.id}: ${c.detail}`)
        .join(' | ')
      const err = `Accuracy contract failed: ${failed}`
      await recordBuildFailure(slug, err, { stage: 'contract', docType, compSelection: selection.diagnostics })
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

    // 4.7. LAST-LISTING REVIEW (Matt 2026-08-05, superseding the 2026-07-14
    // separate audit doc): there is ONE CMA document. When the subject's most
    // recent MLS cycle came off the market without selling, the doc gains a
    // "your last listing — what happened and our take" section built from the
    // same deterministic failure analysis. No separate docType decides this —
    // the LISTING HISTORY does, so an expired subject kicked off from any door
    // gets the review and a clean-history subject never does. (The legacy
    // 'expired-audit' docType is still accepted as input for compat; it no
    // longer changes the document.)
    let expiredAudit: ExpiredAuditData | null = null
    {
      const tokens = subject.streetAddress.trim().split(/\s+/)
      const streetNumber = tokens[0] && /^\d+$/.test(tokens[0]) ? tokens[0] : null
      const namePrefix = streetNumber ? tokens.slice(1).join(' ') : null
      const cycleRows =
        streetNumber && namePrefix
          ? await getBpoListingCyclesByAddress({
              streetNumber,
              streetNameIlike: `${namePrefix}%`,
              cityIlike: subject.city || null,
              postalCode: subject.postalCode,
            })
          : []
      const lastStatus = String(cycleRows[0]?.['StandardStatus'] ?? '')
      const lastCycleFailed = ['Expired', 'Canceled', 'Withdrawn'].includes(lastStatus)
      if (lastCycleFailed) {
        // The failed-ask ceiling (Matt 2026-08-05): never recommend above the
        // price this market just rejected. Runs for EVERY door into the one
        // engine; the trace records what the comps wanted.
        const row0 = cycleRows[0] ?? {}
        const lastAsk = Number(row0['ListPrice'] ?? row0['OriginalListPrice'])
        const offDate = String(row0['off_market_date'] ?? row0['status_change_timestamp'] ?? '') || null
        const cap = applyFailedAskCap(pricing, {
          lastFailedListPrice: Number.isFinite(lastAsk) ? lastAsk : null,
          offMarketDate: offDate,
        })
        if (cap.applied) {
          console.warn(
            `[cma/build] failed-ask ceiling: comps supported ${cap.uncappedRecommended} > failed ask ${cap.cappedTo} — list tiers capped (${slug})`,
          )
        }
        const history = analyzeListingHistory(cycleRows, subject, market?.medianDom ?? null)
        const photosCount = subject.listingKey ? await getListingPhotosCount(subject.listingKey) : null
        expiredAudit = {
          findings: buildFailureFindings({ subject, pricing, market, history, photosCount, ownershipSince: await getExpiredOwnershipSince(subject.mlsNumber) }),
          services: buildServicesList(subject),
          netSheet: buildNetSheet(pricing, {
            expectedConcessions: pricing.sellerNet?.expectedConcessions ?? null,
          }),
          feeLine: feeLine(),
        }
      }
    }

    // 4.75. Report extras (Matt 2026-08-05): seasonality, price-band
    // competition, subdivision pulse, financing profile, photo bench. Runs
    // AFTER the failed-ask cap so the band centers on the final recommended
    // price. Each block is independently nullable (§0: cut, don't guess).
    const subjectPhotosCount = subject.listingKey ? await getListingPhotosCount(subject.listingKey) : null
    const extras = await buildCmaExtras({ subject, comps: adjusted, pricing, subjectPhotosCount })

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
    const map = await buildCmaMapDataUri(subject, adjusted)

    // 5.5. Brand-voice hard-fail gate (W11.2 / CLAUDE.md §"Brand Voice") over
    // every composed PROSE string in the report: the pricing rationale/
    // narrative notes, the development-opportunities section, and (for the
    // expired-audit variant) the failure findings, services list, and net-
    // sheet lines. Every other field in the report is a verified number or a
    // structured fact, not authored prose, so it is out of scope here.
    //
    // PUNCTUATION IS SANITIZED, NOT GATED. Everything in `proseParts` is either
    // written by us or derived from an LLM summary, and both routinely carry an
    // em-dash or a semicolon. Failing the build on one is the wrong trade twice
    // over: the reader gets no document at all, and the defect is a character
    // we can simply fix. sanitizeClientProse rewrites it in place, so the
    // rendered report is clean AND the gate below can only ever fire on a
    // banned word, which is a real content problem.
    pricing.notes = pricing.notes.map(sanitizeClientProse)
    pricing.confidenceReason = sanitizeClientProse(pricing.confidenceReason)
    // reviewReason is folded from the accuracy-contract check details, which
    // quote the adversarial audit's own summary — LLM punctuation, shown to the
    // broker in the admin queue.
    if (pricing.reviewReason) pricing.reviewReason = sanitizeClientProse(pricing.reviewReason)

    const proseParts: string[] = [
      ...pricing.notes,
      pricing.confidenceReason,
      ...(development ? [development.disclaimer, ...development.items.flatMap((i) => [i.headline, i.detail]), ...development.buyerOptions.flatMap((o) => [o.headline, o.detail]), ...development.marketingHighlights.map((h) => h.headline)] : []),
      ...(rental ? [rental.disclaimer, rental.economicsNote, ...rental.tenures.flatMap((t) => [t.headline, t.detail]), ...rental.marketingHighlights.map((h) => h.headline)] : []),
      ...thisHomePlan,
      ...(listingPlan ? listingPlan.items.flatMap((i) => [i.trigger, i.action, i.basis]) : []),
      ...(subdivisionStory
        ? [
            ...subdivisionStory.sections.flatMap((sec) => [sec.heading, sec.body]),
            ...subdivisionStory.notableSales.map((n) => n.line),
          ]
        : []),
      ...(expiredAudit
        ? [
            expiredAudit.feeLine,
            ...expiredAudit.services,
            ...expiredAudit.findings.flatMap((f) => [f.fact, f.meaning]),
            ...expiredAudit.netSheet.lines.flatMap((l) => [l.label, l.note ?? '']),
          ]
        : []),
    ].filter(Boolean)
    // Gate the prose WE author. The LLM comparability narrative (judgment.narrative)
    // is interpolated into pricing.notes but is excluded from the hard gate — it is
    // punctuation-sanitized at its source (judge.ts) but not word-sanitized, so
    // throwing on an LLM word choice would false-positive-break a legitimate build.
    // (Follow-up: word-sanitize the narrative in judge.ts so it can be gated too.)
    const authoredProse = judgment?.narrative
      ? proseParts.join('\n').split(judgment.narrative).join(' ')
      : proseParts.join('\n')
    const voice = checkBrandVoice(authoredProse)
    if (!voice.ok) {
      // Reaching here means a banned WORD, not punctuation: every prose string
      // above was punctuation-sanitized at source a few lines up, so a dash or
      // semicolon can no longer get this far. That distinction is the whole
      // point. Punctuation used to fail the build CLOSED, and the string that
      // did it was one we wrote ourselves on the audit-unavailable branch, so
      // the moment the Anthropic account hit its usage cap on 2026-07-30 every
      // build in the corpus died on "CMA prose fails brand voice: —" and an
      // API outage became a total CMA outage. Sanitizing at source makes that
      // class structurally impossible; a banned word is a real content defect
      // in our own copy and §2 is right that it should stop the document.
      const err = 'CMA prose fails brand voice: ' + voice.violations.map((v) => `${v.term} (${v.kind})`).join(', ')
      await recordBuildFailure(slug, err, { stage: 'pricing', docType, compSelection: selection.diagnostics })
      return { ok: false, error: err, slug }
    }

    // 5.6. Advisory Orwell-rules review (W11.3) — runs ALONGSIDE the deterministic
    // hard-fail gate above, never replacing it. Purely advisory: never throws,
    // never blocks the build. Attached to the result for the admin review UI.
    const voiceReview = await reviewProse(authoredProse, { context: 'cma' }).catch(() => null)

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
    const renderArgs = {
      subject,
      comps: applyCompVerdicts(adjusted, judgment?.verdicts ?? []),
      market,
      pricing,
      client: input.client,
      generatedAtIso,
      subjectTrace: resolved.trace,
      compTrace: selection.trace,
      excludedOutliers: selection.excludedOutliers,
      sellerImprovementsText: input.sellerImprovementsText ?? null,
      site,
      expiredAudit,
      development,
      rental,
      extras,
      subdivisionStory,
      equity,
      listingPlan,
      thisHomePlan,
    }

    // Spread, never a second hand-written list: a field added to one list and
    // not the other would render here and vanish on re-brand (W10.3).
    const { html, pageCount } = renderCmaHtml({ ...renderArgs, broker, mapDataUri: map?.dataUri ?? null })

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
      market_context: market
        ? {
            source: 'market_stats_cache (rolling_365d) + market_pulse_live',
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
      subject_address: formatPersistedCmaAddress({ streetAddress: subject.streetAddress, city: subject.city, postalCode: subject.postalCode, slug }),
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
      client_notes: applyCmaClientIntent(input.client.notes, isCmaClientIntent(input.clientIntent) ? input.clientIntent : parseCmaClientIntent(input.client.notes)),
      ...(input.personId && Number.isFinite(input.personId) && input.personId > 0 ? { person_id: Math.round(input.personId) } : {}),
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
      voiceReview,
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
