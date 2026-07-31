/**
 * `cmas.build_summary` composition — extracted from buildCma() 2026-07-30.
 *
 * This is pure data shaping over values the orchestrator already holds: no
 * fetches, no math, no decisions. It lives on its own because build.ts sits at
 * the file-size ceiling and because the summary is the row the admin queue,
 * the batch reports, and the ad-hoc "why did this document do that" queries all
 * read — it deserves to be readable and testable without loading the whole
 * pipeline.
 *
 * Everything here must stay JSONB-sane: counts, verdicts, and short strings.
 * Never a listing row, never an HTML body, never a base64 map.
 */

import type { CompSelectionDiagnostics } from '@/lib/cma/comp-trace'
import { countByTier } from '@/lib/cma/comp-trace'
import type { AccuracyContract } from '@/lib/cma/contract'
import type { CmaAudit } from '@/lib/cma/audit'
import type { CompJudgment } from '@/lib/cma/judge'
import type { CmaComp, CmaMarketContext, CmaPricing } from '@/lib/cma/types'
import type { CmaSiteData } from '@/lib/cma/county'

export interface BuildSummaryInput {
  builder: string
  docType: 'cma' | 'expired-audit'
  pageCount: number
  comps: CmaComp[]
  compSelection: CompSelectionDiagnostics
  site: CmaSiteData
  judgment: CompJudgment | null
  audit: CmaAudit | null
  firstRoundAudit: CmaAudit | null
  repairedKeys: string[]
  contract: AccuracyContract
  pricing: CmaPricing
  market: CmaMarketContext | null
}

/**
 * The comp trace as it lands on the row.
 *
 * `final_tier_counts` is recomputed here, not taken from the selector: the
 * selector reports the tiers of the candidate set it handed over, and the
 * comparability judge plus the adversarial repair pass can both drop comps
 * after that. What the reader needs is the tier each PRICED comp came from.
 */
function compSelectionSummary(d: CompSelectionDiagnostics, priced: CmaComp[]): CompSelectionDiagnostics {
  return { ...d, final_count: priced.length, final_tier_counts: countByTier(priced) }
}

export function composeBuildSummary(i: BuildSummaryInput): Record<string, unknown> {
  return {
    builder: i.builder,
    doc_type: i.docType,
    page_count: i.pageCount,
    comps_count: i.comps.length,
    // WHY this document got these comps: the ladder walked, per-tier candidates
    // and additions, every exclusion count with its reason, and the tier each
    // priced comp came from. Queryable straight off the row.
    comp_selection: compSelectionSummary(i.compSelection, i.comps),
    // Authoritative site facts for the admin summary (full trace in citations.site).
    site: {
      zone: i.site.zone,
      overlays: i.site.zoneOverlays,
      acreage: i.site.acreage,
      water_source: i.site.water.source,
      irrigation_district: i.site.water.irrigationDistrict,
      water_rights_count: i.site.water.rights.length,
      mapped_irrigation_acres: i.site.water.mappedIrrigationAcres,
      primary_irrigation_priority_date: i.site.water.primaryIrrigationPriorityDate,
      has_private_appurtenant: i.site.water.hasPrivateAppurtenant,
      water_rights_query_ok: i.site.water.rightsQueryOk,
      septic: i.site.septic.status,
      permit_count: i.site.permits.length,
      flood_zone: i.site.flood.zone,
      in_sfha: i.site.flood.inSFHA,
      wildfire_hazard: i.site.wildfireHazard,
      entitlement_conditional: i.site.entitlement?.conditional ?? false,
      hunting_eligible: i.site.hunting != null,
      constraint_count: i.site.constraints.length,
      is_municipal: i.site.isMunicipal,
      resolved: i.site.resolved,
    },
    // The LLM comparability judgment (or a note that it was unavailable).
    judgment: i.judgment
      ? {
          used_llm: true as const,
          model: i.judgment.model,
          cost_usd: i.judgment.costUsd,
          confidence: i.judgment.confidence,
          kept: i.judgment.keptKeys.length,
          excluded: i.judgment.verdicts.filter((v) => v.tier === 'exclude').length,
          narrative: i.judgment.narrative,
          verdicts: i.judgment.verdicts,
        }
      : {
          used_llm: false as const,
          note: 'LLM comparability judge unavailable (no key or call failed); priced on the full comp set with the dispersion guard as backstop.',
        },
    // Top-level so the admin queue + batch reports can filter flagged CMAs
    // without digging into the pricing sub-object.
    needs_review: i.pricing.needsReview,
    review_reason: i.pricing.reviewReason,
    // The adversarial audit (or a note that it was unavailable).
    audit: i.audit
      ? {
          used_llm: true as const,
          model: i.audit.model,
          cost_usd: i.audit.costUsd,
          verdict: i.audit.verdict,
          summary: i.audit.summary,
          findings: i.audit.findings,
          // Self-repair provenance: what the first audit flagged and what was
          // removed before the re-priced, re-audited result above.
          repaired_comp_keys: i.repairedKeys.length ? i.repairedKeys : undefined,
          first_round: i.firstRoundAudit
            ? {
                verdict: i.firstRoundAudit.verdict,
                summary: i.firstRoundAudit.summary,
                findings: i.firstRoundAudit.findings,
                cost_usd: i.firstRoundAudit.costUsd,
              }
            : undefined,
        }
      : {
          used_llm: false as const,
          note: 'Adversarial audit unavailable (no key or call failed); needs_review forced via the contract.',
        },
    // The full accuracy-contract evaluation — every check, pass or fail.
    accuracy_contract: i.contract,
    pricing: {
      conservative: i.pricing.conservative,
      recommended: i.pricing.recommended,
      high_end: i.pricing.highEnd,
      confidence: i.pricing.confidence,
      convergence_spread_pct: i.pricing.convergenceSpreadPct,
      comp_ppsf_cv: i.pricing.compPpsfCv,
      needs_review: i.pricing.needsReview,
      review_reason: i.pricing.reviewReason,
      method1_mid: i.pricing.method1Mid,
      method2: i.pricing.method2,
      method3: i.pricing.method3,
    },
    market: i.market
      ? {
          geo_label: i.market.geoLabel,
          months_of_supply: i.market.monthsOfSupply,
          verdict: i.market.marketVerdict,
          median_dom: i.market.medianDom,
          yoy_pct: i.market.yoyMedianPriceDeltaPct,
        }
      : null,
  }
}

/**
 * The summary written when a build FAILS. The comp trace is the whole point:
 * a document that could not be priced still has to answer "why" from the row,
 * and starvation is the most common answer.
 */
export function composeFailureSummary(opts: {
  builder: string
  docType: 'cma' | 'expired-audit'
  stage: 'subject' | 'comps' | 'pricing' | 'contract'
  error: string
  compSelection?: CompSelectionDiagnostics | null
}): Record<string, unknown> {
  return {
    builder: opts.builder,
    doc_type: opts.docType,
    build_failed: true,
    failed_at_stage: opts.stage,
    build_error: opts.error.slice(0, 2000),
    comp_selection: opts.compSelection ?? null,
  }
}
