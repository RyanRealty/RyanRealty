/**
 * CMA comparability judgment — the LLM judgment layer that the deterministic
 * builder alone cannot provide.
 *
 * The deterministic engine does §0-safe MATH (time/size adjustment, 3-method
 * reconciliation) on whatever comps the query returns. It has no way to notice
 * that a "comp" is a different quality or location tier — so a set spanning
 * $218 to $414/sqft prices cleanly and wrongly. This module gives one Claude
 * pass the subject + the candidate comp pool and asks it to classify each comp
 * (strong / weak / exclude) with a reason, exactly as SKILL Step 5 + Step 9 +
 * Step 11.5 require. buildCma prices on the vetted set.
 *
 * Runs on ANTHROPIC_API_KEY (Sonnet 4.5, ~$0.10-0.15/CMA). Fails OPEN: if the
 * key is absent or the call errors, returns null and the caller falls back to
 * the deterministic set + the dispersion guard. Never blocks a build.
 */

import Anthropic from '@anthropic-ai/sdk'
import type { CmaComp, CmaMarketContext, CmaSubject } from '@/lib/cma/types'

const MODEL = 'claude-sonnet-4-5'
const INPUT_COST_PER_TOKEN = 0.000003
const OUTPUT_COST_PER_TOKEN = 0.000015

export type CompTier = 'strong' | 'weak' | 'exclude'

export interface CompVerdict {
  listingKey: string
  tier: CompTier
  reason: string
}

export interface CompJudgment {
  verdicts: CompVerdict[]
  /** listingKeys to price on (tier strong|weak; exclude dropped). */
  keptKeys: string[]
  confidence: 'High' | 'Moderate' | 'Supportable'
  /** 2-3 sentence comparability rationale for the pricing page. */
  narrative: string
  costUsd: number
  model: string
  usedLlm: true
}

function ppsf(c: CmaComp): number {
  return c.sqft > 0 ? Math.round(c.closePrice / c.sqft) : 0
}

/** Trimmed remarks excerpt — condition/renovation/quality clues without prompt bloat. */
function remarksExcerpt(remarks: string | null | undefined, maxChars = 320): string | null {
  const t = remarks?.replace(/\s+/g, ' ').trim()
  if (!t) return null
  return t.length > maxChars ? `${t.slice(0, maxChars)}…` : t
}

/** Full-feature comp description for the prompt — the judge must see EVERY
 *  comparability dimension, not just size and price. */
function describeComp(c: CmaComp): string {
  const parts = [
    `key=${c.listingKey}`,
    c.address,
    c.subdivision ? `subdiv=${c.subdivision}` : null,
    `${c.beds ?? '?'}bd/${c.baths ?? '?'}ba`,
    `${c.sqft}sqft`,
    c.lotAcres != null ? `${c.lotAcres}ac lot` : null,
    c.yearBuilt ? `built ${c.yearBuilt}` : null,
    c.viewDescription ? `view: ${c.viewDescription}` : null,
    c.taxAnnual != null ? `tax $${Math.round(c.taxAnnual).toLocaleString()}/yr` : null,
    c.listPrice ? `listed $${Math.round(c.listPrice).toLocaleString()}` : null,
    `sold $${Math.round(c.closePrice).toLocaleString()}`,
    `$${ppsf(c)}/sqft`,
    `on ${c.closeDate}`,
    c.daysToOffer != null ? `${c.daysToOffer} days to offer` : null,
    c.domTotal != null ? `${c.domTotal} DOM` : null,
  ].filter(Boolean)
  const line = parts.join(' · ')
  const remarks = remarksExcerpt(c.publicRemarks)
  return remarks ? `${line}\n   remarks: ${remarks}` : line
}

const JUDGE_TOOL: Anthropic.Tool = {
  name: 'record_comp_judgment',
  description: 'Record the comparability verdict for every candidate comp and the overall confidence.',
  input_schema: {
    type: 'object',
    properties: {
      verdicts: {
        type: 'array',
        description: 'One entry per candidate comp, keyed by its listing key.',
        items: {
          type: 'object',
          properties: {
            listingKey: { type: 'string' },
            tier: { type: 'string', enum: ['strong', 'weak', 'exclude'] },
            reason: { type: 'string', description: 'One concise clause. Why this comp is strong, weak, or excluded.' },
          },
          required: ['listingKey', 'tier', 'reason'],
        },
      },
      confidence: {
        type: 'string',
        enum: ['High', 'Moderate', 'Supportable'],
        description: 'Confidence in the resulting value after excluding non-comparable comps.',
      },
      narrative: {
        type: 'string',
        description:
          '2-3 sentences a seller reads on the pricing page explaining the comp set and any exclusions. No hype, no adjectives, data-first. NEVER reference comps by their list number/index (numbering shifts after exclusions) — refer to comps by street name only, and quote only figures shown in this prompt.',
      },
    },
    required: ['verdicts', 'confidence', 'narrative'],
  },
}

/**
 * Judge which candidate comps are genuinely comparable to the subject.
 * Returns null (fail-open) when ANTHROPIC_API_KEY is missing or the call fails.
 */
export async function judgeComps(
  subject: CmaSubject,
  comps: CmaComp[],
  market: CmaMarketContext | null,
): Promise<CompJudgment | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey || comps.length === 0) return null

  const subjectParts = [
    `${subject.streetAddress}, ${subject.city}`,
    subject.subdivision ? `subdivision=${subject.subdivision}` : null,
    `${subject.beds ?? '?'}bd/${subject.baths ?? '?'}ba`,
    `${subject.sqft ?? '?'}sqft`,
    subject.lotAcres != null ? `${subject.lotAcres}ac lot` : null,
    subject.yearBuilt ? `built ${subject.yearBuilt}` : null,
    subject.garageSpaces != null ? `${subject.garageSpaces}-car garage` : null,
    subject.viewDescription ? `view: ${subject.viewDescription}` : null,
    subject.taxAnnual != null ? `tax $${Math.round(subject.taxAnnual).toLocaleString()}/yr` : null,
    subject.lastListPrice ? `last listed $${Math.round(subject.lastListPrice).toLocaleString()}` : null,
  ].filter(Boolean)
  const subjectRemarks = remarksExcerpt(subject.publicRemarks, 400)
  const subjectLine =
    subjectParts.join(' · ') +
    (subjectRemarks ? `\n  remarks: ${subjectRemarks}` : '') +
    (subject.listingHistoryLine ? `\n  listing history: ${subject.listingHistoryLine}` : '')

  const marketLine = market
    ? `Market: ${market.geoLabel}, ${market.marketVerdict}, ${market.monthsOfSupply} months supply, median $${market.medianPpsf ?? '?'}/sqft, ${market.yoyMedianPriceDeltaPct ?? '?'}% YoY.`
    : 'Market: no cache row for this geography.'

  const system =
    'You are a licensed Oregon principal broker reviewing the comparable sales for a CMA. ' +
    'Your only job is comparability judgment: decide which of the candidate closed sales are genuinely comparable ' +
    'to the subject home, and which are a different quality tier, size class, or location and must be excluded or ' +
    'down-weighted. Weigh EVERY dimension you are given, not just $/sqft: bed/bath count, year built and vintage, ' +
    'lot size, view, garage, days on market, list-to-sold behavior, and above all the remarks — renovation and ' +
    'condition language ("fully remodeled", "new roof", "needs TLC", "investor special", "as-is") explains price ' +
    'differences and decides comparability. A comp set that mixes, say, $218/sqft and $414/sqft homes is not one ' +
    'market — say so and exclude the ones that do not belong, citing the specific feature or remarks evidence in a ' +
    'one-line reason each. tier=strong means directly comparable (full weight in the reconciliation); tier=weak means ' +
    'usable with reservations (half weight — bracketing only); tier=exclude means a different market segment (dropped ' +
    'before any math). Prefer excluding a genuinely non-comparable sale over keeping it to hit a count. Keep at least ' +
    '6 comps when 6 or more are genuinely comparable. Be honest about confidence: honest uncertainty beats false ' +
    'precision. Do not invent facts about a comp beyond what is given. ' +
    'Return your judgment only through the record_comp_judgment tool.'

  const user =
    `SUBJECT: ${subjectLine}\n${marketLine}\n\n` +
    `CANDIDATE COMPS (${comps.length}) — judge each by its listing key:\n` +
    comps.map((c, i) => `${i + 1}. ${describeComp(c)}`).join('\n') +
    `\n\nClassify every comp (strong / weak / exclude), give an overall confidence, and write the comparability narrative.`

  try {
    const client = new Anthropic({ apiKey })
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 2000,
      system,
      tools: [JUDGE_TOOL],
      tool_choice: { type: 'tool', name: 'record_comp_judgment' },
      messages: [{ role: 'user', content: user }],
    })
    const costUsd = computeCostUsd(res.usage.input_tokens, res.usage.output_tokens)
    const block = res.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')
    if (!block) return null
    const out = block.input as {
      verdicts?: Array<{ listingKey?: string; tier?: string; reason?: string }>
      confidence?: string
      narrative?: string
    }
    const validKeys = new Set(comps.map((c) => c.listingKey))
    const verdicts: CompVerdict[] = (out.verdicts ?? [])
      .filter((v) => v.listingKey && validKeys.has(v.listingKey))
      .map((v) => ({
        listingKey: v.listingKey!,
        tier: (['strong', 'weak', 'exclude'].includes(v.tier ?? '') ? v.tier : 'weak') as CompTier,
        reason: (v.reason ?? '').trim(),
      }))
    if (verdicts.length === 0) return null
    const keptKeys = verdicts.filter((v) => v.tier !== 'exclude').map((v) => v.listingKey)
    const confidence = (['High', 'Moderate', 'Supportable'].includes(out.confidence ?? '')
      ? out.confidence
      : 'Moderate') as CompJudgment['confidence']
    return {
      verdicts,
      keptKeys,
      confidence,
      narrative: (out.narrative ?? '').trim(),
      costUsd,
      model: MODEL,
      usedLlm: true,
    }
  } catch (err) {
    console.warn('[cma/judge] comparability judgment failed, falling back to deterministic:', err instanceof Error ? err.message : String(err))
    return null
  }
}

function computeCostUsd(inputTokens: number, outputTokens: number): number {
  return +(inputTokens * INPUT_COST_PER_TOKEN + outputTokens * OUTPUT_COST_PER_TOKEN).toFixed(4)
}
