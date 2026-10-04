/**
 * Deterministic Broker Price Opinion build orchestrator.
 *
 * buildBpo() runs the whole pipeline with NO LLM dependency:
 *   subject (listings) → listing cycles (all attempts at the address) → comps
 *   (shared CMA tiered selection) + market context (cache tables) →
 *   listing-history analysis → comp adjustments + reconciliation → opinion of
 *   value → templated rationale → concise HTML → citations → persist to
 *   public.broker_price_opinions (html_content in the DB) + public.bpo_comps.
 *
 * The row lands as status 'draft'. A broker reviews it at /admin/bpo/<slug> and
 * finalizes explicitly. Nothing is ever sent automatically.
 *
 * The comp/market/pricing engine is shared with the CMA builder (lib/cma/**).
 * What the BPO owns is the listing-history analysis and the opinion
 * reconciliation (lib/bpo/history.ts + opinion.ts).
 */

import { cmaMarketSources } from '@/lib/cma/market'
import { getCmaBrokerBySlugOrEmail } from '@/lib/data/cma/builderReads'
import { resolveSigningBrokerForPerson } from '@/lib/data/cma/signing-broker'
import {
  getBpoListingCyclesByAddress,
  upsertBpoRowBySlug,
  updateBpoRowFieldsBySlug,
  replaceBpoComps,
  type BpoCompInsert,
} from '@/lib/data/bpo/reads'
import { resolveCmaSubject } from '@/lib/cma/subject'
import { selectComps, MIN_COMPS } from '@/lib/cma/comps'
import { adjustComps, computePricing } from '@/lib/cma/pricing'
import { pricingFailureMessage } from '@/lib/pricing/price-set'
import { loadBpoEngineInputs, priceBpoAdjusted, bpoCompMap } from '@/lib/bpo/engine'
import { judgeComps } from '@/lib/cma/judge'
import { pricingCompsAfterJudgment } from '@/lib/cma/judgment-prune'
import { comparabilityNarrativeGate } from '@/lib/cma/narrative-final'
import { selectionIsExclusivePocket } from '@/lib/pricing/exclusive-pocket-date-adj'
import { auditCma } from '@/lib/cma/audit'
import { resolveDevelopmentOpportunities } from '@/lib/cma/development'
import { resolveRentalPotential } from '@/lib/cma/rental-potential'
import { evaluateBpoAccuracyContract } from '@/lib/bpo/contract'
import { analyzeListingHistory } from '@/lib/bpo/history'
import { deriveOpinion } from '@/lib/bpo/opinion'
import { deriveOfferStrategy } from '@/lib/bpo/offer'
import { buildBpoRationale } from '@/lib/bpo/narrative'
import { renderBpoHtml } from '@/lib/bpo/render'
import type { CmaBroker } from '@/lib/cma/types'
import type { BpoBuildInput, BpoBuildResult } from '@/lib/bpo/types'

export const BPO_BUILDER_VERSION = 'bpo-deterministic-v1 (2026-07-09)'

const DEFAULT_BROKER_SLUG = (process.env.CMA_DEFAULT_BROKER_SLUG ?? 'matthew-ryan').trim().toLowerCase()

async function resolveBroker(input: BpoBuildInput): Promise<CmaBroker> {
  let slug = input.brokerSlug?.trim() || null
  const email = input.brokerEmail?.trim() || null
  const personId = input.client?.personId ?? null
  if (!slug && !email && personId) {
    const signer = await resolveSigningBrokerForPerson(personId)
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
      // twilio_number, never `phone` (ci:broker-published-phone).
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

/** Split "3124 Lynch" into a street number + street-name prefix for the cycle query. */
function splitStreet(streetAddress: string): { number: string; namePrefix: string } | null {
  const tokens = streetAddress.trim().split(/\s+/).filter(Boolean)
  if (tokens.length < 2 || !/^\d+$/.test(tokens[0]!)) return null
  return { number: tokens[0]!, namePrefix: tokens.slice(1).join(' ') }
}

async function recordFailure(slug: string, error: string): Promise<void> {
  await updateBpoRowFieldsBySlug(slug, {
    build_error: error.slice(0, 2000),
    built_at: new Date().toISOString(),
  }).catch(() => {})
}

export async function buildBpo(input: BpoBuildInput): Promise<BpoBuildResult> {
  const slug = input.slug.trim().toLowerCase()
  const generatedAtIso = new Date().toISOString()
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
      await recordFailure(slug, resolved.trace)
      return { ok: false, error: resolved.trace, slug }
    }
    const subject = resolved.subject

    // 2. Comps + market context in parallel (shared CMA engine).
    const { selection, market, site, marketIndex } = await loadBpoEngineInputs(subject)
    void selectComps
    if (selection.comps.length < MIN_COMPS) {
      const err = `Only ${selection.comps.length} qualifying closed comps found (minimum ${MIN_COMPS}). ${selection.trace.join(' ')}`
      await recordFailure(slug, err)
      return { ok: false, error: err, slug }
    }

    // 2.5. LLM comparability judgment (shared with the CMA engine, fail-open).
    // Vets every candidate comp on the full feature set before any math.
    const judgment = await judgeComps(subject, selection.comps, market)
    let compsForPricing = selection.comps
    // Candidates the product wall kept out before pricing (see the CMA build).
    let differentProduct = 0
    {
      const keep = new Set(judgment?.keptKeys ?? [])
      const vetted = judgment ? selection.comps.filter((c) => keep.has(c.listingKey)) : selection.comps
      const gated = pricingCompsAfterJudgment({
        selected: selection.comps,
        vetted,
        verdicts: judgment?.verdicts ?? [],
        subject: {
          propertySubType: subject.propertySubType,
          yearBuilt: subject.yearBuilt,
          newConstructionYn: subject.newConstructionYn,
          publicRemarks: subject.publicRemarks,
          subdivision: subject.subdivision,
          seniorCommunityYn: subject.seniorCommunityYn,
        },
        minComps: MIN_COMPS,
        exclusivePocket: selectionIsExclusivePocket(selection.tiersUsed),
        ...(selection.ownPlatAgeRestrictedShare !== undefined
          ? { ownPlatAgeRestrictedShare: selection.ownPlatAgeRestrictedShare }
          : {}),
      })
      if (gated.shortage) {
        const err =
          gated.droppedProduct > 0
            ? `Not enough sales of the same product type to price this home. ${gated.comps.length} of ${selection.comps.length} candidates matched, and this home needs ${MIN_COMPS}.`
            : `Not enough comparable sales the review would keep. ${gated.comps.length} of ${selection.comps.length} stayed, and this home needs ${MIN_COMPS}.`
        await recordFailure(slug, err)
        return { ok: false, error: err, slug }
      }
      compsForPricing = gated.comps
      differentProduct = gated.droppedProduct
      if (judgment) {
        selection.trace.push(
          `Comparability judgment (${judgment.model}): kept ${judgment.keptKeys.length} of ${selection.comps.length} candidates, excluded ${judgment.verdicts.filter((v) => v.tier === 'exclude').length} as non-comparable, down-weighted ${judgment.verdicts.filter((v) => v.tier === 'weak').length}. ${gated.trace}`,
        )
      } else {
        selection.trace.push(
          gated.droppedProduct > 0
            ? `Comparability judgment unavailable. ${gated.trace} Broker review is required.`
            : 'Comparability judgment unavailable — priced on the full selection; broker review required.',
        )
      }
    }
    const tierByKey = new Map(judgment?.verdicts.map((v) => [v.listingKey, v.tier]) ?? [])
    const reviewExclusions = () =>
      judgment?.verdicts.filter((v) => v.tier === 'exclude').map((v) => ({ listingKey: v.listingKey, reason: v.reason })) ?? []
    // The judge's narrative, held apart from whatever a pass prints, and gated
    // again on every set this opinion prices (the same gate as the CMA,
    // lib/cma/narrative-final.ts). `gatedKeys` is the set the review and the
    // product wall let through, before any audit repair.
    const narrativeGate = comparabilityNarrativeGate(judgment?.narrative, {
      candidates: selection.comps,
      excluded: reviewExclusions(),
      subject,
      market,
      tierByKey,
      gatedKeys: new Set(compsForPricing.map((c) => c.listingKey)),
      differentProduct,
    })

    // 3. Listing history — all MLS cycles at the address.
    const split = splitStreet(subject.streetAddress)
    const cycleRows = split
      ? await getBpoListingCyclesByAddress({
          streetNumber: split.number,
          streetNameIlike: `${split.namePrefix}%`,
          cityIlike: subject.city || null,
          postalCode: subject.postalCode,
        })
      : []
    const history = analyzeListingHistory(cycleRows, subject, market?.medianDom ?? null)

    // 4. Adjust comps + reconcile to the opinion (weak-tier comps carry half
    // weight in the reconciliation, matching the CMA engine).
    const deriveAll = (set: typeof selection.comps) => {
      const priced = priceBpoAdjusted({
        subject, set, market, selection, marketIndex, asOf: generatedAtIso.slice(0, 10), tierByKey,
        priceOverride: input.priceOverride ?? null, adjustComps, computePricing,
      })
      if (!priced.p) return { adj: priced.adj, p: null, op: null }
      return { ...priced, p: priced.p, op: deriveOpinion(subject, priced.p, market, history, { priceOverride: input.priceOverride ?? null }) }
    }
    const derived = deriveAll(compsForPricing)
    if (!derived?.p || !derived.op) {
      const err = pricingFailureMessage(subject, derived?.adj ?? [])
      await recordFailure(slug, err)
      return { ok: false, error: err, slug }
    }
    let { adj: adjusted, p: pricing, op: opinion } = derived

    // 4.4. Adversarial accuracy audit — independent second pass attacking the
    // OPINION (Matt directive 2026-07-11: BPOs are adversarially audited like
    // CMAs). Deterministic verdict over categorized findings.
    const opinionContext = () =>
      [
        `Opinion = comp reconciliation anchored at $${opinion.compAnchor.toLocaleString()}`,
        history.listingPressureAdjustmentPct
          ? `listing-pressure adjustment ${(history.listingPressureAdjustmentPct * 100).toFixed(1)}% from ${history.failedAttemptsCount} failed attempt(s)`
          : 'no listing-pressure adjustment',
        history.currentIsActive && history.currentListPrice
          ? `ACTIVE listing at $${history.currentListPrice.toLocaleString()} caps the opinion (ceiling rule)`
          : 'no active listing ceiling',
        opinion.priceOverride ? `broker price override $${opinion.priceOverride.toLocaleString()} applied` : null,
      ]
        .filter(Boolean)
        .join(' · ')
    // The judge's narrative against the sales that actually price, before each
    // audit reads it and before the rationale prints it. The same gate the CMA
    // runs (lib/cma/narrative-final.ts): refuted sentences come out, the full
    // integrity check runs on what is left, and the honest count line prints
    // when nothing true is left OR a finding remains. The BPO used to fall back
    // only on an empty narrative, so a named sale that is not in the report
    // still printed in the rationale (review of da8dce6, 2026-09-30).
    const alignNarrative = () => {
      if (!judgment) return
      const final = narrativeGate.gate(adjusted)
      if (final.removed.length > 0) {
        selection.trace.push(
          `Comparability narrative checked against the ${compsForPricing.length} priced sale(s): ${
            new Set(final.removed.map((f) => f.sentence)).size
          } sentence(s) removed because the priced set refutes them (${[...new Set(final.removed.map((f) => f.kind))].join(', ')}).`,
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
    }
    const runAudit = () =>
      auditCma({
        subject,
        comps: adjusted,
        excluded: reviewExclusions(),
        pricing,
        judgment,
        market,
        site,
        finalOpinion: {
          value: opinion.opinionValue,
          low: opinion.valueLow,
          high: opinion.valueHigh,
          confidence: opinion.confidence,
          context: opinionContext(),
        },
        candidates: selection.comps,
      })
    alignNarrative()
    let audit = await runAudit()

    // 4.45. Bounded self-repair — comp-selection/data-integrity findings tied
    // to specific comps: drop them, re-derive pricing AND opinion, re-audit once.
    let firstRoundAudit: typeof audit = null
    let repairedKeys: string[] = []
    if (audit && audit.verdict !== 'pass') {
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
        const rederived = deriveAll(remaining)
        if (rederived.p && rederived.op) {
          firstRoundAudit = audit
          repairedKeys = flagged
          compsForPricing = remaining
          adjusted = rederived.adj
          pricing = rederived.p
          opinion = rederived.op
          selection.trace.push(
            `Adversarial audit repair: ${flagged.length} comp(s) flagged by the independent audit were removed, the opinion re-derived on the ${remaining.length}-comp set, then re-audited.`,
          )
          alignNarrative()
          audit = await runAudit()
        }
      }
    }

    // 4.5. Accuracy contract — hard violations kill the build; review
    // violations force needs_review so an unvetted/disputed opinion can never
    // present as clean.
    const contract = evaluateBpoAccuracyContract({
      comps: adjusted,
      pricing,
      judgment,
      audit,
      opinion,
      history,
      site,
      subjectSubType: subject.propertySubType,
      minComps: MIN_COMPS,
      marketContextPresent: market != null,
    })
    if (!contract.pass) {
      const failed = contract.checks
        .filter((c) => c.severity === 'hard' && !c.pass)
        .map((c) => `${c.id}: ${c.detail}`)
        .join(' | ')
      const err = `Accuracy contract failed: ${failed}`
      await recordFailure(slug, err)
      return { ok: false, error: err, slug }
    }
    const needsReview = contract.forceReview || pricing.needsReview
    const reviewReason = needsReview
      ? (pricing.reviewReason ??
        contract.checks
          .filter((c) => c.severity === 'review' && !c.pass)
          .map((c) => c.detail)
          .join(' '))
      : null

    const offer = deriveOfferStrategy(subject, opinion, market, history)

    // 5. Rationale + render (judgment narrative + audit stamp render inside
    // the client-safe rationale block).
    let rationale = buildBpoRationale({ subject, history, opinion, market, comps: adjusted })
    if (judgment) {
      rationale += ` Comparable review: ${compsForPricing.length} of ${selection.comps.length} candidate sales kept after a per-comp comparability review. ${judgment.narrative}`
    }
    if (repairedKeys.length) {
      // What happened, and nothing the gate made untrue: the narrative above
      // was checked again against the remaining set, so it does not describe
      // an initial review that still names the removed sales.
      rationale += ` The independent audit's findings removed ${repairedKeys.length} comp(s). The opinion was re-derived on the remaining set, and the comparability narrative was checked again against it.`
    }
    rationale += audit
      ? audit.verdict === 'pass'
        ? ' An independent adversarial review attacked this analysis and found no material defect.'
        : ` An independent adversarial review recorded ${audit.findings.length} finding(s) for broker review before release.`
      : ' Independent adversarial review was unavailable for this build. Broker review is required before release.'

    // Development + rental potential — pure functions over the verified zone.
    const development = resolveDevelopmentOpportunities(site, subject)

    const map = await bpoCompMap(subject, adjusted, selection.tiersUsed)
    const { html, pageCount } = renderBpoHtml({
      subject,
      comps: adjusted,
      market,
      history,
      opinion,
      offer,
      broker,
      rationale,
      purpose: input.purpose ?? null,
      generatedAtIso,
      site,
      development,
      rental: resolveRentalPotential(subject, site),
      mapDataUri: map?.dataUri ?? null,
      tiersUsed: selection.tiersUsed,
    })

    // 6. Citations — one entry per figure class (CLAUDE.md section 0).
    const citations: Record<string, unknown> = {
      builder: BPO_BUILDER_VERSION,
      generated_at: generatedAtIso,
      subject: {
        listing_key: subject.listingKey,
        mls_number: subject.mlsNumber,
        address: `${subject.streetAddress}, ${subject.city}, ${subject.state} ${subject.postalCode ?? ''}`.trim(),
        source: 'Supabase listings',
        resolution: resolved.trace,
      },
      listing_history: {
        source: 'Supabase listings (one row per ListingKey at the address)',
        attempts: history.attemptsCount,
        failed_attempts: history.failedAttemptsCount,
        current_status: history.currentCycle?.outcome ?? null,
        current_dom: history.currentDaysOnMarket,
        peak_ask: history.peakAskingPrice,
        listing_pressure_pct: history.listingPressureAdjustmentPct,
        trace: history.trace,
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
            llm_verdict: audit.llmVerdict,
            summary: audit.summary,
            findings: audit.findings,
            cost_usd: audit.costUsd,
            repaired_comp_keys: repairedKeys.length ? repairedKeys : undefined,
            first_round_verdict: firstRoundAudit?.verdict,
          }
        : { source: 'none', note: 'Audit unavailable — needs_review forced.' },
      comps: adjusted.map((c) => ({
        listing_key: c.listingKey,
        address: c.address,
        close_price: c.closePrice,
        close_date: c.closeDate,
        sqft: c.sqft,
        time_adjustment: c.timeAdjustment,
        size_adjustment: c.sizeAdjustment,
        adjusted_price: c.adjustedPrice,
        weight: c.weight,
        selection_tier: c.selectionTier,
      })),
      market_context: market
        ? {
            sources: cmaMarketSources(market),
            geo_slug: market.geoSlug,
            period: `${market.periodStart}..${market.periodEnd}`,
            methodology_version: market.methodologyVersion,
            months_of_supply: market.monthsOfSupply,
            months_of_supply_formula: market.mosFormula,
            median_dom: market.medianDom,
            yoy_median_price_delta_pct: market.yoyMedianPriceDeltaPct,
          }
        : { source: 'none', note: 'No cache row for the subject city. No time adjustment applied.' },
      opinion: {
        comp_anchor: opinion.compAnchor,
        listing_pressure_pct: history.listingPressureAdjustmentPct,
        opinion_value: opinion.opinionValue,
        value_low: opinion.valueLow,
        value_high: opinion.valueHigh,
        confidence: opinion.confidence,
        vs_current_list_pct: opinion.vsCurrentListPct,
        price_override: opinion.priceOverride,
      },
      offer_strategy: {
        mode: offer.mode,
        posture: offer.posture,
        leverage_score: offer.leverageScore,
        opening_offer: offer.openingOffer,
        target_offer: offer.targetOffer,
        ceiling: offer.ceiling,
        recommended_list: offer.recommendedList,
        expected_offer_low: offer.expectedOfferLow,
        expected_offer_high: offer.expectedOfferHigh,
        // Drives expectedOfferLow in seller mode (offer.ts lowFactor).
        sale_to_list_ratio: market?.saleToListRatio ?? null,
      },
      site: {
        tax_account: site.taxAccount,
        taxlot: site.taxlot,
        trs: site.trs,
        acreage: site.acreage,
        zone: site.zone,
        overlays: site.zoneOverlays,
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
        constraints: site.constraints,
        field_confirm: site.fieldConfirm,
        resolved: site.resolved,
        notes: site.notes,
        sources: site.citations,
      },
      disclosure: 'Broker price opinion (ORS 696.010 / 696.290), not an appraisal (ORS ch. 674).',
    }

    const buildSummary = {
      builder: BPO_BUILDER_VERSION,
      page_count: pageCount,
      comps_count: adjusted.length,
      needs_review: needsReview,
      review_reason: reviewReason,
      // Authoritative site facts for the admin summary (full trace in citations.site).
      site: {
        zone: site.zone,
        overlays: site.zoneOverlays,
        acreage: site.acreage,
        water_source: site.water.source,
        irrigation_district: site.water.irrigationDistrict,
        water_rights_count: site.water.rights.length,
        mapped_irrigation_acres: site.water.mappedIrrigationAcres,
        primary_irrigation_priority_date: site.water.primaryIrrigationPriorityDate,
        has_private_appurtenant: site.water.hasPrivateAppurtenant,
        water_rights_query_ok: site.water.rightsQueryOk,
        septic: site.septic.status,
        permit_count: site.permits.length,
        flood_zone: site.flood.zone,
        in_sfha: site.flood.inSFHA,
        wildfire_hazard: site.wildfireHazard,
        entitlement_conditional: site.entitlement?.conditional ?? false,
        hunting_eligible: site.hunting != null,
        constraint_count: site.constraints.length,
        is_municipal: site.isMunicipal,
        resolved: site.resolved,
      },
      judgment: judgment
        ? {
            used_llm: true as const,
            model: judgment.model,
            cost_usd: judgment.costUsd,
            confidence: judgment.confidence,
            kept: judgment.keptKeys.length,
            excluded: judgment.verdicts.filter((v) => v.tier === 'exclude').length,
            narrative: judgment.narrative,
            verdicts: judgment.verdicts,
          }
        : { used_llm: false as const, note: 'Comparability judge unavailable; priced on the full comp set.' },
      audit: audit
        ? {
            used_llm: true as const,
            model: audit.model,
            cost_usd: audit.costUsd,
            verdict: audit.verdict,
            llm_verdict: audit.llmVerdict,
            summary: audit.summary,
            findings: audit.findings,
            repaired_comp_keys: repairedKeys.length ? repairedKeys : undefined,
            first_round: firstRoundAudit
              ? { verdict: firstRoundAudit.verdict, summary: firstRoundAudit.summary, findings: firstRoundAudit.findings, cost_usd: firstRoundAudit.costUsd }
              : undefined,
          }
        : { used_llm: false as const, note: 'Adversarial audit unavailable; needs_review forced via the contract.' },
      accuracy_contract: contract,
      opinion: {
        opinion_value: opinion.opinionValue,
        value_low: opinion.valueLow,
        value_high: opinion.valueHigh,
        confidence: opinion.confidence,
        comp_anchor: opinion.compAnchor,
        vs_current_list_pct: opinion.vsCurrentListPct,
      },
      history: {
        attempts: history.attemptsCount,
        failed_attempts: history.failedAttemptsCount,
        current_dom: history.currentDaysOnMarket,
        current_list: history.currentListPrice,
        peak_ask: history.peakAskingPrice,
      },
      market: market
        ? { geo_label: market.geoLabel, months_of_supply: market.monthsOfSupply, verdict: market.marketVerdict, median_dom: market.medianDom }
        : null,
      offer: { mode: offer.mode, posture: offer.posture, headline: offer.headline },
    }

    // 7. Persist — upsert keyed on slug (rebuild updates in place).
    const upsert = await upsertBpoRowBySlug({
      slug,
      subject_address: `${subject.streetAddress}, ${subject.city}, ${subject.state} ${subject.postalCode ?? ''}`.trim(),
      subject_listing_key: subject.listingKey,
      subject_subdivision: subject.subdivision,
      subject_city: subject.city,
      subject_beds: subject.beds != null ? Math.round(subject.beds) : null,
      subject_baths: subject.baths,
      subject_sqft: subject.sqft != null ? Math.round(subject.sqft) : null,
      subject_lot_acres: subject.lotAcres,
      subject_year_built: subject.yearBuilt,
      subject_status: history.currentCycle?.status ?? subject.standardStatus,
      opinion_value: opinion.opinionValue,
      value_low: opinion.valueLow,
      value_high: opinion.valueHigh,
      confidence: opinion.confidence,
      comps_count: adjusted.length,
      listing_history: {
        cycles: history.cycles,
        signals: history.signals,
        current_is_active: history.currentIsActive,
        current_dom: history.currentDaysOnMarket,
        current_list: history.currentListPrice,
        peak_ask: history.peakAskingPrice,
        failed_attempts: history.failedAttemptsCount,
        listing_pressure_pct: history.listingPressureAdjustmentPct,
      },
      market_snapshot: buildSummary.market,
      offer_strategy: {
        mode: offer.mode,
        posture: offer.posture,
        leverage_score: offer.leverageScore,
        headline: offer.headline,
        opening_offer: offer.openingOffer,
        target_offer: offer.targetOffer,
        ceiling: offer.ceiling,
        recommended_list: offer.recommendedList,
        expected_offer_low: offer.expectedOfferLow,
        expected_offer_high: offer.expectedOfferHigh,
        leverage: offer.leverage,
        terms: offer.terms,
      },
      rationale,
      broker_id: broker.id,
      broker_slug: broker.slug,
      person_id: input.client?.personId ?? null,
      requested_by: input.requestedBy ?? null,
      purpose: input.purpose ?? null,
      html_path: `db:broker_price_opinions.html_content:${slug}`,
      html_content: html,
      preview_url: `/bpo/${slug}`,
      citations,
      build_summary: buildSummary,
      built_at: generatedAtIso,
      build_error: null,
      price_override: opinion.priceOverride,
      status: 'draft',
      generation_reason: input.requestSource ? `Deterministic build (${input.requestSource})` : 'Deterministic build',
    })
    if (upsert.error || !upsert.id) {
      return { ok: false, error: `broker_price_opinions upsert failed: ${upsert.error ?? 'no row'}`, slug }
    }

    const compRows: BpoCompInsert[] = adjusted.map((c, i) => ({
      bpo_id: upsert.id!,
      comp_listing_key: c.listingKey,
      comp_order: i + 1,
      comp_address: c.address,
      sold_price: Math.round(c.closePrice),
      sold_date: c.closeDate,
      days_to_offer: c.daysToOffer != null ? Math.round(c.daysToOffer) : null,
      dom_total: c.domTotal != null ? Math.round(c.domTotal) : null,
      price_per_sqft: +(c.closePrice / c.sqft).toFixed(2),
      adjusted_price: Math.round(c.adjustedPrice),
    }))
    const compsRes = await replaceBpoComps(upsert.id, compRows)
    if (!compsRes.ok) console.warn('[buildBpo] bpo_comps replace failed:', compsRes.error)

    return {
      ok: true,
      slug,
      bpoId: upsert.id,
      subject,
      comps: adjusted,
      market,
      history,
      opinion,
      offer,
      html,
      citations,
    }
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e)
    await recordFailure(slug, err)
    return { ok: false, error: err, slug }
  }
}
