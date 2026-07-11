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

    // 4. Adjust comps + reconcile to the opinion.
    const adjusted = adjustComps(subject, selection.comps, market)
    const pricing = computePricing(subject, adjusted, market, { priceOverride: null })
    if (!pricing) {
      const err = 'Pricing could not be computed (subject sqft missing).'
      await recordFailure(slug, err)
      return { ok: false, error: err, slug }
    }
    const opinion = deriveOpinion(subject, pricing, market, history, {
      priceOverride: input.priceOverride ?? null,
    })
    const offer = deriveOfferStrategy(subject, opinion, market, history)

    // 5. Rationale + render.
    const rationale = buildBpoRationale({ subject, history, opinion, market, comps: adjusted })
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
