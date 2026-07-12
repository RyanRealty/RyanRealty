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

import { getCmaBrokerBySlugOrEmail } from '@/lib/data'
import {
  getBpoListingCyclesByAddress,
  upsertBpoRowBySlug,
  updateBpoRowFieldsBySlug,
  replaceBpoComps,
  type BpoCompInsert,
} from '@/lib/data/bpo/reads'
import { resolveCmaSubject } from '@/lib/cma/subject'
import { selectComps, MIN_COMPS } from '@/lib/cma/comps'
import { getCmaMarketContext } from '@/lib/cma/market'
import { adjustComps, computePricing } from '@/lib/cma/pricing'
import { judgeComps } from '@/lib/cma/judge'
import { auditCma } from '@/lib/cma/audit'
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
      phone: (row.phone as string | null) ?? null,
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
    const [selection, market] = await Promise.all([
      selectComps(subject),
      getCmaMarketContext(subject.city),
    ])
    if (selection.comps.length < MIN_COMPS) {
      const err = `Only ${selection.comps.length} qualifying closed comps found (minimum ${MIN_COMPS}). ${selection.trace.join(' ')}`
      await recordFailure(slug, err)
      return { ok: false, error: err, slug }
    }

    // 2.5. LLM comparability judgment (shared with the CMA engine, fail-open).
    // Vets every candidate comp on the full feature set before any math.
    const judgment = await judgeComps(subject, selection.comps, market)
    let compsForPricing = selection.comps
    if (judgment) {
      const keep = new Set(judgment.keptKeys)
      const vetted = selection.comps.filter((c) => keep.has(c.listingKey))
      if (vetted.length >= MIN_COMPS) compsForPricing = vetted
      selection.trace.push(
        compsForPricing.length === vetted.length
          ? `Comparability judgment (${judgment.model}): kept ${vetted.length} of ${selection.comps.length} candidates, excluded ${judgment.verdicts.filter((v) => v.tier === 'exclude').length} as non-comparable, down-weighted ${judgment.verdicts.filter((v) => v.tier === 'weak').length}.`
          : `Comparability judgment (${judgment.model}) would keep only ${vetted.length} comps — below the ${MIN_COMPS}-comp floor, so the full set was priced instead.`,
      )
    } else {
      selection.trace.push('Comparability judgment unavailable — priced on the full selection; broker review required.')
    }
    const tierByKey = new Map(judgment?.verdicts.map((v) => [v.listingKey, v.tier]) ?? [])

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
      const adj = adjustComps(subject, set, market).map((c) => {
        const tier = tierByKey.get(c.listingKey)
        return tier === 'weak' ? { ...c, weight: +(c.weight * 0.5).toFixed(4) } : c
      })
      const p = computePricing(subject, adj, market, { priceOverride: null })
      if (!p) return null
      const op = deriveOpinion(subject, p, market, history, { priceOverride: input.priceOverride ?? null })
      return { adj, p, op }
    }
    let derived = deriveAll(compsForPricing)
    if (!derived) {
      const err = 'Pricing could not be computed (subject sqft missing).'
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
    const runAudit = () =>
      auditCma({
        subject,
        comps: adjusted,
        excluded:
          judgment?.verdicts.filter((v) => v.tier === 'exclude').map((v) => ({ listingKey: v.listingKey, reason: v.reason })) ?? [],
        pricing,
        judgment,
        market,
        finalOpinion: {
          value: opinion.opinionValue,
          low: opinion.valueLow,
          high: opinion.valueHigh,
          confidence: opinion.confidence,
          context: opinionContext(),
        },
      })
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
        if (rederived) {
          firstRoundAudit = audit
          repairedKeys = flagged
          compsForPricing = remaining
          ;({ adj: adjusted, p: pricing, op: opinion } = rederived)
          selection.trace.push(
            `Adversarial audit repair: ${flagged.length} comp(s) flagged by the independent audit were removed, the opinion re-derived on the ${remaining.length}-comp set, then re-audited.`,
          )
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
      rationale += ` ${repairedKeys.length} comp(s) referenced by the initial review were subsequently removed on an independent audit's findings and the opinion re-derived.`
    }
    rationale += audit
      ? audit.verdict === 'pass'
        ? ' An independent adversarial review attacked this analysis and found no material defect.'
        : ` An independent adversarial review recorded ${audit.findings.length} finding(s) for broker review before release.`
      : ' Independent adversarial review was unavailable for this build. Broker review is required before release.'
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
            source: 'market_stats_cache (rolling_365d) + market_pulse_live',
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
      disclosure: 'Broker price opinion (ORS 696.010 / 696.290), not an appraisal (ORS ch. 674).',
    }

    const buildSummary = {
      builder: BPO_BUILDER_VERSION,
      page_count: pageCount,
      comps_count: adjusted.length,
      needs_review: needsReview,
      review_reason: reviewReason,
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
