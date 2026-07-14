/**
 * CMA adversarial accuracy audit — the second, independent LLM pass.
 *
 * The judge (lib/cma/judge.ts) helps BUILD the comp set. This auditor's only
 * job is to BREAK the finished analysis: refute the recommended price, catch a
 * non-comparable comp that survived, catch a wrongly excluded comp, catch a
 * narrative claim that does not trace to the data, and spot-check the
 * adjustment math it is shown. Builder and auditor never share a prompt, so
 * the auditor has no stake in the answer (Matt directive 2026-07-11: every
 * CMA must be adversarially audited for accuracy).
 *
 * Enforcement: buildCma runs this on EVERY build. verdict !== 'pass' — or the
 * audit being unavailable — forces needs_review, so an unaudited or disputed
 * CMA can never present as clean. Findings persist in build_summary.audit and
 * citations.adversarial_audit. Deterministic hard checks stay in contract.ts;
 * this pass hunts the judgment-level failures math cannot see.
 */

import Anthropic from '@anthropic-ai/sdk'
import type { CmaAdjustedComp, CmaMarketContext, CmaPricing, CmaSubject } from '@/lib/cma/types'
import type { CompJudgment } from '@/lib/cma/judge'
import type { CmaSiteData } from '@/lib/cma/county'

const MODEL = 'claude-sonnet-4-5'
const INPUT_COST_PER_TOKEN = 0.000003
const OUTPUT_COST_PER_TOKEN = 0.000015

export type AuditSeverity = 'critical' | 'major' | 'minor'
export type AuditVerdict = 'pass' | 'review' | 'fail'
export type AuditCategory =
  | 'data-integrity' // an impossible or wrong FACT (bad year, wrong sqft, misquoted figure)
  | 'comp-selection' // a kept comp that does not belong / an unsupported exclusion
  | 'price-opinion' // the auditor disagrees with the recommendation level
  | 'narrative' // prose claim not traceable to the data
  | 'market-verdict' // MoS-threshold mismatch
  | 'other'

export interface AuditFinding {
  severity: AuditSeverity
  category: AuditCategory
  claim: string
  evidence: string
  /** When the defect is a specific priced comp, its listing key — makes the
   *  finding machine-actionable (buildCma drops it and re-prices). */
  compListingKey?: string | null
}

/**
 * Deterministic verdict over categorized findings — the LLM reports defects,
 * CODE decides the verdict.
 *
 * Calibration history:
 *  - v1 (2026-07-11): the LLM's own verdict inflated to fail on defensible
 *    analyses — an adversarial reviewer attacks any configuration from
 *    whichever side is open. So code decides.
 *  - v2 (2026-07-12): v1 still fired `review` on ~83% of a real batch, because
 *    ANY single major finding forced it, and the auditor always finds one
 *    (usually a price-level gripe). A flag that fires on 83% is not a signal.
 *    v2 makes the flag DISCRIMINATING:
 *      · price-opinion findings are ADVISORY — a price-level disagreement
 *        between two models is broker judgment, never a gate (Matt's rule).
 *      · a lone comp-selection nitpick with no specific comp key is advisory
 *        (if it named a comp, self-repair would already have dropped it).
 *      · market-verdict/other majors are advisory; only critical gates.
 *    `review` now means a specific, actionable defect a broker must resolve;
 *    `fail` means a hard factual error or a clearly non-comparable comp that
 *    survived. Everything advisory is still RECORDED in findings and shown to
 *    the broker — it just does not raise the flag.
 */
export function computeAuditVerdict(findings: AuditFinding[]): AuditVerdict {
  const has = (cat: AuditCategory, sevs: AuditSeverity[]) =>
    findings.some((f) => f.category === cat && sevs.includes(f.severity))

  // BLOCK (fail): a hard factual error, a clearly non-comparable comp that
  // survived, or a definitively false statement a client would read.
  if (has('data-integrity', ['critical']) || has('comp-selection', ['critical']) || has('narrative', ['critical'])) {
    return 'fail'
  }

  // REVIEW: signals strong enough that a single one is meaningful.
  if (has('data-integrity', ['major'])) return 'review' // a wrong FACT, not prose
  if (has('market-verdict', ['critical'])) return 'review'
  // A CLUSTER of comp doubt (2+ comp-selection majors) — one is the auditor's
  // reflex (it always names a comp it would tweak; self-repair already dropped
  // the worst); two independent ones means the set is genuinely mixed.
  const compMajors = findings.filter((f) => f.category === 'comp-selection' && f.severity === 'major').length
  if (compMajors >= 2) return 'review'

  // ADVISORY → pass (recorded + shown, not gated): a lone comp-selection major
  // (reflex), a lone narrative-major rewording, every price-opinion
  // disagreement, market/other majors, and all minors. Calibration v3
  // (2026-07-12): v2 still gated on the single comp-major + single
  // narrative-major the auditor emits on ~100% of CMAs. Only criticals, a wrong
  // fact, or a comp-doubt cluster now raise the flag.
  return 'pass'
}

export interface CmaAudit {
  /** Deterministic verdict computed by computeAuditVerdict over the findings. */
  verdict: AuditVerdict
  /** The model's own (advisory) verdict — recorded, never enforced. */
  llmVerdict: AuditVerdict
  findings: AuditFinding[]
  summary: string
  costUsd: number
  model: string
  usedLlm: true
}

function remarks(t: string | null | undefined, maxChars = 260): string {
  const s = t?.replace(/\s+/g, ' ').trim()
  if (!s) return ''
  return s.length > maxChars ? `${s.slice(0, maxChars)}…` : s
}

const AUDIT_TOOL: Anthropic.Tool = {
  name: 'record_audit',
  description: 'Record the adversarial audit result for this CMA.',
  input_schema: {
    type: 'object',
    properties: {
      findings: {
        type: 'array',
        description: 'Every defect found. Empty array when the analysis survives attack.',
        items: {
          type: 'object',
          properties: {
            severity: {
              type: 'string',
              enum: ['critical', 'major', 'minor'],
              description: 'critical = the recommendation is wrong or indefensible; major = a comp/claim/number needs broker correction; minor = polish.',
            },
            category: {
              type: 'string',
              enum: ['data-integrity', 'comp-selection', 'price-opinion', 'narrative', 'market-verdict', 'other'],
              description:
                'data-integrity = an impossible/wrong FACT in the report; comp-selection = a kept comp that does not belong or an unsupported exclusion; price-opinion = you disagree with the recommendation level; narrative = a prose claim that does not trace to the data; market-verdict = months-of-supply threshold mismatch.',
            },
            claim: { type: 'string', description: 'One sentence: what is wrong.' },
            evidence: { type: 'string', description: 'The specific data shown here that proves it.' },
            compListingKey: {
              type: 'string',
              description: 'REQUIRED when the defect is a specific priced comp: that comp\'s listing key exactly as shown (key=...). Omit for findings not tied to one comp.',
            },
          },
          required: ['severity', 'claim', 'evidence'],
        },
      },
      verdict: {
        type: 'string',
        enum: ['pass', 'review', 'fail'],
        description: 'pass = survives attack (no critical/major findings); review = broker must resolve the findings; fail = the recommendation is indefensible as built.',
      },
      summary: {
        type: 'string',
        description: '1-2 sentences: the audit outcome, written for the reviewing broker.',
      },
    },
    required: ['findings', 'verdict', 'summary'],
  },
}

/**
 * Adversarially audit a finished CMA. Returns null (audit unavailable) when
 * the key is absent or the call fails — the caller MUST then force review.
 */
export async function auditCma(args: {
  subject: CmaSubject
  comps: CmaAdjustedComp[]
  excluded: Array<{ listingKey: string; reason: string }>
  pricing: CmaPricing
  judgment: CompJudgment | null
  market: CmaMarketContext | null
  /** BPO mode: the reconciled OPINION is the number under attack (not the CMA
   *  recommended list), with its ceiling/listing-history reconciliation context. */
  finalOpinion?: {
    value: number
    low: number
    high: number
    confidence: string
    context: string
  }
  /** Authoritative zoning/water/septic — so the auditor can refute buildability/utility claims. */
  site?: CmaSiteData | null
}): Promise<CmaAudit | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return null
  const { subject, comps, excluded, pricing, judgment, market, finalOpinion, site } = args

  const subjectLine = [
    `${subject.streetAddress}, ${subject.city} (subdivision: ${subject.subdivision ?? 'none'})`,
    `beds ${subject.beds ?? 'unknown'} · baths ${subject.baths ?? 'unknown'} · living area ${subject.sqft ?? 'unknown'} sqft · lot ${subject.lotAcres ?? 'unknown'} acres · year built ${subject.yearBuilt ?? 'unknown'}`,
    subject.lastListPrice
      ? `FAILED LISTING at $${Math.round(subject.lastListPrice).toLocaleString()} (${subject.standardStatus ?? 'off market'})`
      : null,
    remarks(subject.publicRemarks, 300) ? `remarks: ${remarks(subject.publicRemarks, 300)}` : null,
  ]
    .filter(Boolean)
    .join('\n')

  const compLines = comps
    .map((c, i) => {
      const tier = judgment?.verdicts.find((v) => v.listingKey === c.listingKey)?.tier ?? 'n/a'
      return (
        `${i + 1}. key=${c.listingKey} · ${c.address} (subdivision: ${c.subdivision ?? 'none'}) · beds ${c.beds ?? 'unknown'} · baths ${c.baths ?? 'unknown'} · ` +
        `living area ${c.sqft} sqft · year built ${c.yearBuilt ?? 'unknown'} · ` +
        `closed $${Math.round(c.closePrice).toLocaleString()} on ${c.closeDate} · ` +
        `machine-adjusted value $${Math.round(c.adjustedPrice).toLocaleString()} · reconciliation weight ${c.weight} · comparability tier ${tier}` +
        (remarks(c.publicRemarks) ? `\n   remarks: ${remarks(c.publicRemarks)}` : '')
      )
    })
    .join('\n')

  const excludedLines = excluded.length
    ? excluded.map((e) => `- ${e.listingKey}: ${e.reason}`).join('\n')
    : '(none)'

  const marketLine = market
    ? `${market.geoLabel}: ${market.marketVerdict}, ${market.monthsOfSupply} MoS, median $${market.medianSalePrice?.toLocaleString?.() ?? market.medianSalePrice}, median $${market.medianPpsf}/sqft, ${market.yoyMedianPriceDeltaPct}% YoY, sale-to-list ${market.saleToListRatio}.`
    : 'No verified market context (no time adjustment applied).'

  const system =
    'You are an independent licensed Oregon principal broker hired to ATTACK a Comparative Market Analysis before it ' +
    'reaches a homeowner. You did not build it and you get no credit for approving it — your reputation rides on ' +
    'catching REAL defects, and equally on not manufacturing fake ones. ' +
    'SCOPE — judgment defects only. The arithmetic in this report (time adjustments, size adjustments, weights, the ' +
    'three-method reconciliation) is computed and machine-verified by deterministic code; do NOT re-derive or dispute ' +
    'arithmetic, rounding, or displayed precision — any arithmetic finding will be discarded. Attack instead: ' +
    '(1) a kept comp that is not genuinely comparable — different product type (townhome vs detached), quality tier, ' +
    'resort/premium location, acreage/estate class, or condition per the remarks; ' +
    '(2) an excluded comp whose stated exclusion reason the data does not support; ' +
    '(3) a recommendation the ADJUSTED comp values shown here do not support — too high or too low relative to where ' +
    'the machine-adjusted values cluster; ' +
    '(4) a narrative or confidence claim that does not trace to the data shown; ' +
    '(5) a market-verdict mismatch (months of supply: 4 or less seller, 4-6 balanced, 6 or more buyer). ' +
    '(6) a SITE claim contradicting the authoritative records: a buildability assertion on EFU/EFUTRB or other restrictive zoning without a verified current entitlement (category=data-integrity, critical); a stated water source or septic system not supported by the SITE line; a flood, wildfire, overlay-setback, or hunting/LOP claim not supported by the SITE line; irrigation-DISTRICT membership presented as a certificated water RIGHT; or any zoning/utility/buildability fact the report asserts that the records did not resolve. ' +
    'CONTEXT — the subject failed to sell at its last list price. A recommendation at or above that price is not ' +
    'automatically wrong: if the adjusted comp values cluster at or above it, that IS the evidence, and the prior ' +
    'failure may reflect condition, presentation, or timing. Flag it only when the comps do not support it. ' +
    'Judge only from the data given; never invent facts. SEVERITY CALIBRATION — critical means NO reasonable broker ' +
    'could defend the recommendation with this comp set; a recommendation that is debatable but sits inside the ' +
    'adjusted comp cluster is NOT critical. major means a specific comp, claim, or exclusion needs broker correction ' +
    '(set compListingKey when it is a comp); minor is polish. Most competent analyses should PASS or carry a small ' +
    'number of major findings — reserve fail for a genuinely broken analysis. If the analysis survives your attack, ' +
    'verdict=pass and say so plainly — a clean pass is a legitimate outcome. Report only through the record_audit tool.'

  const siteLine = site
    ? `Zoning ${site.zone ?? 'UNRESOLVED'}${site.zoneOverlays.length ? ` (overlays ${site.zoneOverlays.join(', ')})` : ''}. ` +
      `${site.acreage != null ? `Parcel ${site.acreage}ac. ` : ''}${site.trs ? `${site.trs}. ` : ''}` +
      `Water: ${site.water.source}${site.water.wellLog ? ` (nearest domestic well ${site.water.wellLog.completedDepthFt ?? '?'}ft)` : ''}${site.water.irrigationDistrict ? ` [${site.water.irrigationDistrict}]` : ''}. ` +
      `Septic: ${site.septic.status}${site.septic.permit ? ` (${site.septic.permit})` : ''}${site.permits.length ? ` (${site.permits.length} permits of record)` : ''}. ` +
      `${site.flood.zone ? `FEMA flood ${site.flood.zone}${site.flood.inSFHA ? ' (SFHA)' : ''}. ` : ''}${site.wildfireHazard ? 'Wildfire hazard zone. ' : ''}` +
      `${site.entitlement?.conditional ? 'Dwelling requires a verified entitlement (NOT by-right). ' : ''}` +
      `${site.hunting ? `Hunting/LOP: ${site.hunting.lop}. ` : ''}` +
      `${site.isMunicipal ? 'Municipal water/sewer.' : 'Non-municipal.'}${site.resolved ? '' : ' SITE FACTS NOT FULLY RESOLVED FROM RECORDS.'}` +
      `${site.constraints.length ? ` Constraints: ${site.constraints.join(' | ')}` : ''}`
    : 'No authoritative site data was resolved.'

  const user =
    `SUBJECT:\n${subjectLine}\n\nMARKET: ${marketLine}\n\nSITE (authoritative county/state records): ${siteLine}\n\n` +
    `PRICED COMP SET (${comps.length}) with the builder's adjustments, weights, and comparability tiers:\n${compLines}\n\n` +
    `EXCLUDED BY THE BUILDER (with its reasons):\n${excludedLines}\n\n` +
    `PRICING: Method 1 (tiered $/sqft) mid $${pricing.method1Mid.toLocaleString()} · Method 2 (size baseline) ${
      pricing.method2 != null ? `$${pricing.method2.toLocaleString()}` : 'n/a'
    } · Method 3 (weighted reconciliation) $${pricing.method3.toLocaleString()} · spread ${pricing.convergenceSpreadPct}% · ` +
    (finalOpinion
      ? `intermediate comp reconciliation $${pricing.recommended.toLocaleString()}.\n` +
        `FINAL OPINION OF VALUE (the number under attack): $${finalOpinion.value.toLocaleString()} ` +
        `(range $${finalOpinion.low.toLocaleString()}–$${finalOpinion.high.toLocaleString()}) · confidence ${finalOpinion.confidence}.\n` +
        `OPINION RECONCILIATION CONTEXT: ${finalOpinion.context}\n`
      : `RECOMMENDED $${pricing.recommended.toLocaleString()} (range $${pricing.conservative.toLocaleString()}–$${pricing.highEnd.toLocaleString()}) · ` +
        `confidence ${pricing.confidence}.\n`) +
    `BUILDER'S COMPARABILITY NARRATIVE: ${judgment?.narrative ?? '(none — judgment did not run)'}\n\n` +
    'Attack this analysis. Record every defect with severity and evidence, then give your verdict.'

  try {
    const client = new Anthropic({ apiKey })
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 2500,
      system,
      tools: [AUDIT_TOOL],
      tool_choice: { type: 'tool', name: 'record_audit' },
      messages: [{ role: 'user', content: user }],
    })
    const costUsd = +(
      res.usage.input_tokens * INPUT_COST_PER_TOKEN +
      res.usage.output_tokens * OUTPUT_COST_PER_TOKEN
    ).toFixed(4)
    const block = res.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')
    if (!block) return null
    const out = block.input as {
      findings?: Array<{ severity?: string; category?: string; claim?: string; evidence?: string; compListingKey?: string }>
      verdict?: string
      summary?: string
    }
    const validKeys = new Set(comps.map((c) => c.listingKey))
    const CATEGORIES: AuditCategory[] = ['data-integrity', 'comp-selection', 'price-opinion', 'narrative', 'market-verdict', 'other']
    const findings: AuditFinding[] = (out.findings ?? [])
      .filter((f) => f.claim)
      .map((f) => ({
        severity: (['critical', 'major', 'minor'].includes(f.severity ?? '') ? f.severity : 'major') as AuditSeverity,
        category: (CATEGORIES.includes((f.category ?? '') as AuditCategory) ? f.category : 'other') as AuditCategory,
        claim: f.claim!.trim(),
        evidence: (f.evidence ?? '').trim(),
        compListingKey: f.compListingKey && validKeys.has(f.compListingKey) ? f.compListingKey : null,
      }))
    // The LLM reports defects; CODE decides the verdict (see computeAuditVerdict).
    // The model's self-reported verdict is kept only as advisory context.
    const verdict = computeAuditVerdict(findings)
    const llmVerdict = (['pass', 'review', 'fail'].includes(out.verdict ?? '') ? out.verdict : 'review') as AuditVerdict
    return {
      verdict,
      llmVerdict,
      findings,
      summary: (out.summary ?? '').trim(),
      costUsd,
      model: MODEL,
      usedLlm: true,
    }
  } catch (err) {
    console.warn('[cma/audit] adversarial audit failed:', err instanceof Error ? err.message : String(err))
    return null
  }
}
