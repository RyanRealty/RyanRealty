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
  type CmaCompInsert,
} from '@/lib/data'
import { resolveCmaSubject } from '@/lib/cma/subject'
import { selectComps, MIN_COMPS } from '@/lib/cma/comps'
import { getCmaMarketContext } from '@/lib/cma/market'
import { adjustComps, computePricing } from '@/lib/cma/pricing'
import { judgeComps } from '@/lib/cma/judge'
import { hydratePhotoUrls } from '@/lib/cma/photos'
import { auditCma } from '@/lib/cma/audit'
import { evaluateAccuracyContract } from '@/lib/cma/contract'
import { buildCmaMapDataUri } from '@/lib/cma/map'
import { renderCmaHtml } from '@/lib/cma/render'
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

/** Record a failed build on the cmas row so the admin queue shows WHY. */
async function recordBuildFailure(slug: string, error: string): Promise<void> {
  await updateCmaRowFieldsBySlug(slug, {
    build_error: error.slice(0, 2000),
    built_at: new Date().toISOString(),
  }).catch(() => {})
}

export async function buildCma(input: CmaBuildInput): Promise<CmaBuildResult> {
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
      await recordBuildFailure(slug, resolved.trace)
      return { ok: false, error: resolved.trace, slug }
    }
    const subject = resolved.subject

    // 2 + 3. Comps and market context in parallel.
    const [selection, market] = await Promise.all([
      selectComps(subject),
      getCmaMarketContext(subject.city),
    ])
    if (selection.comps.length < MIN_COMPS) {
      const err = `Only ${selection.comps.length} qualifying closed comps found (minimum ${MIN_COMPS}). ${selection.trace.join(' ')}`
      await recordBuildFailure(slug, err)
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
    let compsForPricing = selection.comps
    if (judgment) {
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
    } else {
      selection.trace.push(
        'Comparability judgment unavailable for this build — priced on the full selection with the dispersion guard as backstop; broker review required.',
      )
    }

    // 4. Adjustments + pricing (on the vetted comp set). Judge verdicts feed
    // the Method 3 reconciliation weights: strong = full weight, weak = half
    // (bracketing only). Excludes were dropped before the math above.
    const tierByKey = new Map(judgment?.verdicts.map((v) => [v.listingKey, v.tier]) ?? [])
    const priceSet = (set: typeof selection.comps) => {
      const adj = adjustComps(subject, set, market).map((c) => {
        const tier = tierByKey.get(c.listingKey)
        return tier === 'weak' ? { ...c, weight: +(c.weight * 0.5).toFixed(4) } : c
      })
      const p = computePricing(subject, adj, market, {
        sellerImprovementsTotal: input.sellerImprovementsTotal ?? null,
        priceOverride: input.priceOverride ?? null,
      })
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
      await recordBuildFailure(slug, err)
      return { ok: false, error: err, slug }
    }

    // 4.4. Adversarial accuracy audit — an independent second pass whose only
    // job is to refute the finished analysis (Matt directive 2026-07-11:
    // every CMA must be adversarially audited). Builder and auditor share no
    // prompt. Anything but a clean pass forces broker review via the contract.
    let audit = await auditCma({ subject, comps: adjusted, excluded: excludedForAudit(), pricing, judgment, market })

    // 4.45. Bounded self-repair: when the audit ties critical/major findings
    // to SPECIFIC comps, drop those comps, re-price, and re-audit ONCE. The
    // repaired analysis is what ships; both rounds are recorded. Never prunes
    // below the comp floor, never loops more than once.
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
            `The comparability narrative reflects the initial review; ${flagged.length} comp(s) it references were subsequently removed on the independent audit's findings and the pricing recomputed on the remaining set.`,
          )
          audit = await auditCma({ subject, comps: adjusted, excluded: excludedForAudit(), pricing, judgment, market })
        }
      }
    }

    pricing.notes.push(
      audit
        ? audit.verdict === 'pass'
          ? `Adversarial accuracy audit: an independent review pass attacked this analysis${repairedKeys.length ? `, ${repairedKeys.length} comp(s) were removed on its findings and the analysis re-priced,` : ' and'} found no remaining material defect.`
          : `Adversarial accuracy audit: ${audit.findings.length} finding(s) recorded for broker review before this analysis is released${repairedKeys.length ? ` (after a repair pass removed ${repairedKeys.length} comp(s))` : ''}.`
        : 'Adversarial accuracy audit unavailable for this build — broker review required before release.',
    )

    // 4.5. Accuracy contract — the mechanical enforcement of the process.
    // Hard violations kill the build; review violations force needs_review so
    // an unvetted or non-converged CMA can never present as clean.
    const contract = evaluateAccuracyContract({
      comps: adjusted,
      pricing,
      judgment,
      audit,
      minComps: MIN_COMPS,
      marketContextPresent: market != null,
    })
    if (!contract.pass) {
      const failed = contract.checks
        .filter((c) => c.severity === 'hard' && !c.pass)
        .map((c) => `${c.id}: ${c.detail}`)
        .join(' | ')
      const err = `Accuracy contract failed: ${failed}`
      await recordBuildFailure(slug, err)
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

    // 5. Map (best effort — the report ships without it if the key is absent).
    const map = await buildCmaMapDataUri(subject, adjusted)

    // 6. Render.
    const { html, pageCount } = renderCmaHtml({
      subject,
      comps: adjusted,
      market,
      pricing,
      broker,
      client: input.client,
      mapDataUri: map?.dataUri ?? null,
      generatedAtIso,
      subjectTrace: resolved.trace,
      compTrace: selection.trace,
      excludedOutliers: selection.excludedOutliers,
      sellerImprovementsText: input.sellerImprovementsText ?? null,
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
      market_context: market
        ? {
            source: 'market_stats_cache (rolling_365d) + market_pulse_live',
            geo_slug: market.geoSlug,
            period: `${market.periodStart}..${market.periodEnd}`,
            methodology_version: market.methodologyVersion,
            computed_at: market.computedAt,
            pulse_updated_at: market.pulseUpdatedAt,
            sold_count_365: market.soldCount365,
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
      ors_disclosure: 'OAR 863-015-0190 elements included on the final page',
    }

    const buildSummary = {
      builder: CMA_BUILDER_VERSION,
      page_count: pageCount,
      comps_count: adjusted.length,
      // The LLM comparability judgment (or a note that it was unavailable).
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
        : {
            used_llm: false as const,
            note: 'LLM comparability judge unavailable (no key or call failed); priced on the full comp set with the dispersion guard as backstop.',
          },
      // Top-level so the admin queue + batch reports can filter flagged CMAs
      // without digging into the pricing sub-object.
      needs_review: pricing.needsReview,
      review_reason: pricing.reviewReason,
      // The adversarial audit (or a note that it was unavailable).
      audit: audit
        ? {
            used_llm: true as const,
            model: audit.model,
            cost_usd: audit.costUsd,
            verdict: audit.verdict,
            summary: audit.summary,
            findings: audit.findings,
            // Self-repair provenance: what the first audit flagged and what
            // was removed before the re-priced, re-audited result above.
            repaired_comp_keys: repairedKeys.length ? repairedKeys : undefined,
            first_round: firstRoundAudit
              ? {
                  verdict: firstRoundAudit.verdict,
                  summary: firstRoundAudit.summary,
                  findings: firstRoundAudit.findings,
                  cost_usd: firstRoundAudit.costUsd,
                }
              : undefined,
          }
        : {
            used_llm: false as const,
            note: 'Adversarial audit unavailable (no key or call failed); needs_review forced via the contract.',
          },
      // The full accuracy-contract evaluation — every check, pass or fail.
      accuracy_contract: contract,
      pricing: {
        conservative: pricing.conservative,
        recommended: pricing.recommended,
        high_end: pricing.highEnd,
        confidence: pricing.confidence,
        convergence_spread_pct: pricing.convergenceSpreadPct,
        comp_ppsf_cv: pricing.compPpsfCv,
        needs_review: pricing.needsReview,
        review_reason: pricing.reviewReason,
        method1_mid: pricing.method1Mid,
        method2: pricing.method2,
        method3: pricing.method3,
      },
      market: market
        ? {
            geo_label: market.geoLabel,
            months_of_supply: market.monthsOfSupply,
            verdict: market.marketVerdict,
            median_dom: market.medianDom,
            yoy_pct: market.yoyMedianPriceDeltaPct,
          }
        : null,
    }

    // 8. Persist. Upsert keyed on slug — a rebuild updates in place (G47:
    // one property, one slug, one CMA).
    const upsert = await upsertCmaRowBySlug({
      slug,
      subject_address: `${subject.streetAddress}, ${subject.city}, OR ${subject.postalCode ?? ''}`.trim(),
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
      client_notes: input.client.notes,
      broker_id: broker.id,
      broker_slug: broker.slug,
      value_low: pricing.valueLow,
      value_high: pricing.valueHigh,
      recommended_list: pricing.recommended,
      comps_count: adjusted.length,
      html_path: `db:cmas.html_content:${slug}`,
      html_content: html,
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
    await recordBuildFailure(slug, err)
    return { ok: false, error: err, slug }
  }
}
