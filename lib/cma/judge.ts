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
 * SELF-CONSISTENCY (2026-07-30). The auditor's most frequent real catch was the
 * judge applying its own exclusion criteria unevenly (922 Ogden: excluded
 * $676-801/sqft as a premium tier, kept one at $631 while the retained set sat
 * at $446-544). The mechanism that stops that lives in
 * lib/cma/judge-consistency.ts and its module header is the spec. This file is
 * the orchestration around it: declare the rule in the tool schema, call the
 * model, run the check, and when the check finds a contradiction, take ONE
 * targeted repair turn that hands the model its own verdicts and the specific
 * conflict. Whatever survives the repair is resolved deterministically here —
 * strand/band violators are excluded, and the numeric band is written into
 * their reason so the excluded list reads as one rule.
 *
 * Runs on ANTHROPIC_API_KEY (Sonnet 4.5). Fails OPEN: if the key is absent or
 * a call errors, returns null and the caller falls back to the deterministic
 * set + the dispersion guard. Never blocks a build, never throws.
 */

import Anthropic from '@anthropic-ai/sdk'
import type { CmaComp, CmaMarketContext, CmaSubject } from '@/lib/cma/types'
import { sanitizeClientProse } from '@/lib/cma/voice-sanitize'
import {
  EXCLUSION_BASES,
  checkJudgmentConsistency,
  isPriceTierExclusion,
  narrativeMismatches,
  ppsf,
  splitSentences,
  type CompTier,
  type CompVerdict,
  type ExclusionBasis,
} from '@/lib/cma/judge-consistency'

// The consistency vocabulary is defined next to the check that enforces it;
// re-exported here so every existing caller keeps importing from one place.
export type { CompTier, CompVerdict, ExclusionBasis, ConsistencyCheck } from '@/lib/cma/judge-consistency'
export { checkJudgmentConsistency } from '@/lib/cma/judge-consistency'

const MODEL = 'claude-sonnet-4-5'
const INPUT_COST_PER_TOKEN = 0.000003
const OUTPUT_COST_PER_TOKEN = 0.000015

/** Below this many kept comps the deterministic resolver stops pruning —
 *  buildCma's own MIN_COMPS floor would discard the whole judgment anyway. */
const RESOLVE_KEEP_FLOOR = 3

export interface CompJudgment {
  verdicts: CompVerdict[]
  /** listingKeys to price on (tier strong|weak; exclude dropped). */
  keptKeys: string[]
  confidence: 'High' | 'Moderate' | 'Supportable'
  /** 2-3 sentence comparability rationale for the pricing page. */
  narrative: string
  /** The declared $/sqft band the subject is priced in. Every kept comp sits
   *  inside it; every price-tier exclusion sits outside it. Optional so callers
   *  and fixtures built before the consistency contract still type-check. */
  ppsfFloor?: number
  ppsfCeiling?: number
  /** The model's one-sentence statement of the criteria it applied. */
  exclusionRule?: string
  /** Self-consistency trace: what code caught, whether a repair ran, what code
   *  had to resolve itself. Empty violations = the first pass was coherent. */
  consistency?: {
    firstPassViolations: string[]
    repairRan: boolean
    postRepairViolations: string[]
    resolvedByCode: string[]
  }
  costUsd: number
  model: string
  usedLlm: true
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
      ppsfFloor: {
        type: 'number',
        description:
          'The LOWEST $/sqft this analysis treats as the subject\'s market tier. Every comp you keep must sell at or above it, and every comp you exclude for being a cheaper tier must sell below it. A whole number of dollars per square foot.',
      },
      ppsfCeiling: {
        type: 'number',
        description:
          'The HIGHEST $/sqft this analysis treats as the subject\'s market tier. Every comp you keep must sell at or below it, and every comp you exclude for being a premium tier must sell above it. A whole number of dollars per square foot.',
      },
      exclusionRule: {
        type: 'string',
        description:
          'One or two plain sentences stating every criterion you applied and the threshold for each, in numbers where the criterion is numeric. Example: "Priced on closed sales from $420 to $610 per square foot. Sales above that band were remodeled to a higher finish level per their remarks, and sales built more than 15 years after the subject were excluded as a different construction generation." The same threshold must hold for every candidate.',
      },
      verdicts: {
        type: 'array',
        description: 'One entry per candidate comp, keyed by its listing key. Every candidate needs a verdict.',
        items: {
          type: 'object',
          properties: {
            listingKey: { type: 'string' },
            tier: { type: 'string', enum: ['strong', 'weak', 'exclude'] },
            reason: {
              type: 'string',
              description:
                'One concise clause. For an exclusion, cite the comp\'s actual value on the criterion (its $/sqft, its year built, the remarks phrase) so the reason can be checked against the data.',
            },
            basis: {
              type: 'string',
              enum: EXCLUSION_BASES,
              description:
                'REQUIRED on tier=exclude: the single criterion the exclusion rests on. Use price-tier ONLY when the $/sqft band is the reason. If the real reason is condition, vintage, size, lot, location, or structure type, name that instead.',
            },
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
          '2-3 sentences a seller reads on the pricing page. State the count kept, the $/sqft band, and the rule that decided the exclusions. Only claims the data in this prompt supports. NEVER reference comps by their list number/index (numbering shifts after exclusions) — refer to comps by street name only, and quote only figures shown in this prompt. Never describe a comp you kept as excluded, or a comp you excluded as kept.',
      },
    },
    required: ['ppsfFloor', 'ppsfCeiling', 'exclusionRule', 'verdicts', 'confidence', 'narrative'],
  },
}

const SYSTEM =
  'You are a licensed Oregon principal broker reviewing the comparable sales for a CMA. ' +
  'Your only job is comparability judgment: decide which of the candidate closed sales are genuinely comparable ' +
  'to the subject home, and which are a different quality tier, size class, or location and must be excluded or ' +
  'down-weighted. Weigh EVERY dimension you are given, not just $/sqft: bed/bath count, year built and vintage, ' +
  'lot size, view, garage, days on market, list-to-sold behavior, and above all the remarks — renovation and ' +
  'condition language ("fully remodeled", "new roof", "needs TLC", "investor special", "as-is") explains price ' +
  'differences and decides comparability. A comp set that mixes, say, $218/sqft and $414/sqft homes is not one ' +
  'market — say so and exclude the ones that do not belong, citing the specific feature or remarks evidence in a ' +
  'one-line reason each. ' +
  'STRUCTURE TYPE IS A HARD EXCLUSION, and you are the only check on it. The MLS sub-type field is already ' +
  'filtered upstream, but it is unreliable: properties tagged "Single Family Residence" turn out from their remarks ' +
  'to be a duplex, triplex, or other multi-unit or income-configured building. For a single-family subject, exclude ' +
  'any comp whose remarks indicate more than one dwelling unit, a shared wall, or a purpose-built income ' +
  'configuration, no matter what its sub-type says or how close or recent the sale is. A duplex sells to an ' +
  'investor on a rent roll, not to the subject\'s buyer. Say which remarks phrase gave it away. ' +
  'tier=strong means directly comparable (full weight in the reconciliation); tier=weak means ' +
  'usable with reservations (half weight — bracketing only); tier=exclude means a different market segment (dropped ' +
  'before any math). Prefer excluding a genuinely non-comparable sale over keeping it to hit a count. Keep at least ' +
  '5 comps when 5 or more are genuinely comparable. Be honest about confidence: honest uncertainty beats false ' +
  'precision. Do not invent facts about a comp beyond what is given. ' +
  // ── the consistency contract ───────────────────────────────────────────────
  'ONE RULE, EVERY CANDIDATE. An independent reviewer reads your excluded list beside your kept list and looks for ' +
  'a criterion you applied to one comp and not another. That is the single defect that gets this analysis sent ' +
  'back. So state the criterion as a NUMBER and hold to it: ppsfFloor and ppsfCeiling are the $/sqft band you are ' +
  'pricing the subject in, and they are checked mechanically. Every comp you KEEP must sell inside that band. ' +
  'Every comp you exclude with basis=price-tier must sell outside it. If you want to keep a sale at $631/sqft, the ' +
  'ceiling has to be at least $631, and then you cannot call $650 a premium tier — you need a different, real ' +
  'reason for the ones above, or you keep them too. And do not strand a kept comp: if one retained sale sits far ' +
  'above the rest of the retained cluster and near the sales you threw out, it belongs with the ones you threw ' +
  'out. Apply the same discipline to every non-numeric criterion. If you exclude one comp for being 16 years newer ' +
  'than the subject, say the vintage threshold you used and exclude every candidate past it. ' +
  'WHAT REVIEWERS CATCH MOST OFTEN, in order: a kept comp a full construction generation newer or older than the ' +
  'subject; a kept comp in an amenity-bearing planned community or resort when the subject is not, or the reverse; ' +
  'a kept comp of a different product type; and an exclusion reason the data does not actually show. Check your ' +
  'own set against those four before you answer. ' +
  // ── narrative discipline ───────────────────────────────────────────────────
  'THE NARRATIVE IS EVIDENCE, NOT SALES COPY. A seller reads it and an independent reviewer checks every clause ' +
  'against the data in this prompt. State what IS known: how many sales you kept, the $/sqft band, the rule that ' +
  'decided the exclusions, and what the retained sales have in common that you can point to in their fields or ' +
  'remarks. Do NOT assert that the subject and a comp share condition, finish level, quality, or desirability ' +
  'unless the SUBJECT\'s own remarks or fields state it. Do NOT say a set "brackets" the subject on any dimension ' +
  'you were not given for the subject. When the subject\'s condition is unknown, say it is unknown and say the ' +
  'value assumes it. House voice (marketing_brain_skills/brand-voice/VOICE.md, anchored on Buffett): state the fact, ' +
  'then stop, and never write a sentence that explains the sentence before it. No adjective of quality about a home: ' +
  'name the finish level with the remarks phrase itself ("studs out remodel", "needs TLC") or with the number. ' +
  'A number is stated once and left alone. No coined maxims, no clause that moralizes a fact, and never phrase a ' +
  'number as something that speaks, says, or proves a point: state the number and stop. No em dashes, no semicolons, no exclamation marks. ' +
  'Return your judgment only through the record_comp_judgment tool.'


interface RawJudgment {
  verdicts: CompVerdict[]
  confidence: CompJudgment['confidence']
  narrative: string
  ppsfFloor: number
  ppsfCeiling: number
  exclusionRule: string
}

function parseJudgment(block: Anthropic.ToolUseBlock, comps: CmaComp[]): RawJudgment | null {
  const out = block.input as {
    verdicts?: Array<{ listingKey?: string; tier?: string; reason?: string; basis?: string }>
    confidence?: string
    narrative?: string
    ppsfFloor?: number
    ppsfCeiling?: number
    exclusionRule?: string
  }
  const validKeys = new Set(comps.map((c) => c.listingKey))
  const seen = new Set<string>()
  const verdicts: CompVerdict[] = (out.verdicts ?? [])
    .filter((v) => {
      if (!v.listingKey || !validKeys.has(v.listingKey) || seen.has(v.listingKey)) return false
      seen.add(v.listingKey)
      return true
    })
    .map((v) => {
      const tier = (['strong', 'weak', 'exclude'].includes(v.tier ?? '') ? v.tier : 'weak') as CompTier
      const basis =
        tier === 'exclude' && EXCLUSION_BASES.includes((v.basis ?? '') as ExclusionBasis)
          ? (v.basis as ExclusionBasis)
          : tier === 'exclude'
            ? 'other'
            : undefined
      return { listingKey: v.listingKey!, tier, reason: (v.reason ?? '').trim(), basis }
    })
  if (verdicts.length === 0) return null
  return {
    verdicts,
    confidence: (['High', 'Moderate', 'Supportable'].includes(out.confidence ?? '')
      ? out.confidence
      : 'Moderate') as CompJudgment['confidence'],
    narrative: (out.narrative ?? '').trim(),
    ppsfFloor: typeof out.ppsfFloor === 'number' ? Math.round(out.ppsfFloor) : 0,
    ppsfCeiling: typeof out.ppsfCeiling === 'number' ? Math.round(out.ppsfCeiling) : 0,
    exclusionRule: (out.exclusionRule ?? '').trim(),
  }
}

/** Render a judgment back to the model for the repair turn. */
function renderJudgmentForRepair(comps: CmaComp[], j: RawJudgment): string {
  const byKey = new Map(comps.map((c) => [c.listingKey, c]))
  const line = (v: CompVerdict) => {
    const c = byKey.get(v.listingKey)
    return `- ${v.listingKey} · ${c?.address ?? '?'} · $${c ? ppsf(c) : '?'}/sqft · tier=${v.tier}${v.basis ? ` · basis=${v.basis}` : ''} · ${v.reason}`
  }
  return (
    `Declared band: $${j.ppsfFloor} to $${j.ppsfCeiling}/sqft\n` +
    `Declared rule: ${j.exclusionRule}\n` +
    `Verdicts:\n${j.verdicts.map(line).join('\n')}\n` +
    `Confidence: ${j.confidence}\nNarrative: ${j.narrative}`
  )
}

interface JudgeTurn {
  block: Anthropic.ToolUseBlock | null
  costUsd: number
}

/**
 * The ONE place this module talks to a model (G56: model calls go through a
 * single chokepoint, never scattered per call site). Both the first pass and
 * the consistency repair turn come through here, so the model, the tool
 * forcing, the token ceiling, and the cost accounting are defined once and
 * cannot drift apart between the two.
 */
async function sendJudgeTurn(
  client: Anthropic,
  messages: Anthropic.MessageParam[],
): Promise<JudgeTurn> {
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 2500,
    system: SYSTEM,
    tools: [JUDGE_TOOL],
    tool_choice: { type: 'tool', name: 'record_comp_judgment' },
    messages,
  })
  return {
    block: res.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use') ?? null,
    costUsd: computeCostUsd(res.usage.input_tokens, res.usage.output_tokens),
  }
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

  // Named explicitly so the narrative cannot quietly assume condition parity.
  const conditionEvidence = subjectRemarks
    ? 'SUBJECT CONDITION EVIDENCE: the subject remarks above are the ONLY condition evidence on file. Do not claim finish level, renovation status, or quality beyond what they state.'
    : 'SUBJECT CONDITION EVIDENCE: none. No remarks, photos, or condition fields are on file for the subject. Any claim about its condition, finish level, or quality would be invented. State that the analysis assumes average condition for its vintage and that condition is unverified.'

  const marketLine = market
    ? `Market: ${market.geoLabel}, ${market.marketVerdict}, ${market.monthsOfSupply} months supply, median $${market.medianPpsf ?? '?'}/sqft, ${market.yoyMedianPriceDeltaPct ?? '?'}% YoY.`
    : 'Market: no cache row for this geography.'

  const user =
    `SUBJECT: ${subjectLine}\n${marketLine}\n${conditionEvidence}\n\n` +
    `CANDIDATE COMPS (${comps.length}) — judge each by its listing key:\n` +
    comps.map((c, i) => `${i + 1}. ${describeComp(c)}`).join('\n') +
    `\n\nClassify every comp (strong / weak / exclude), declare the $/sqft band and the rule you applied, give an overall confidence, and write the comparability narrative.`

  try {
    const client = new Anthropic({ apiKey })
    let costUsd = 0

    const first = await sendJudgeTurn(client, [{ role: 'user', content: user }])
    costUsd += first.costUsd
    const firstBlock = first.block
    if (!firstBlock) return null
    let judged = parseJudgment(firstBlock, comps)
    if (!judged) return null

    const firstCheck = checkJudgmentConsistency({ comps, ...judged })
    const firstPassViolations = firstCheck.violations
    let check = firstCheck
    let repairRan = false

    // ── ONE targeted repair turn, only when code found a contradiction ───────
    if (firstCheck.violations.length > 0) {
      repairRan = true
      const repairUser =
        `A mechanical consistency check ran over your judgment and found contradictions. ` +
        `Your job now is to return ONE corrected judgment that survives the same check.\n\n` +
        `YOUR JUDGMENT:\n${renderJudgmentForRepair(comps, judged)}\n\n` +
        `CONTRADICTIONS FOUND:\n${firstCheck.violations.map((v, i) => `${i + 1}. ${v}`).join('\n')}\n\n` +
        `Resolve each one honestly. You may move a comp to exclude, move an exclusion back to weak, widen or ` +
        `narrow the declared band, change an exclusion's basis to the criterion it really rests on, or rewrite ` +
        `the narrative. What you may NOT do is keep a comp inside a band you also exclude on, keep a sale that ` +
        `sits with the excluded cluster, or describe a comp one way in the narrative and another way in its ` +
        `verdict. If resolving a contradiction leaves only three or four genuinely comparable sales, that is the ` +
        `correct answer and you should say so and lower the confidence. Do not keep a non-comparable sale to hit ` +
        `a count. Return the complete corrected judgment through the tool, every candidate included.`

      const second = await sendJudgeTurn(client, [
        { role: 'user', content: user },
        { role: 'assistant', content: [firstBlock] },
        // The tool_use above MUST be answered by a tool_result or the API
        // rejects the turn, which would fail the judge open on every
        // inconsistent document.
        {
          role: 'user',
          content: [
            { type: 'tool_result', tool_use_id: firstBlock.id, content: 'Judgment recorded. Consistency check follows.' },
            { type: 'text', text: repairUser },
          ],
        },
      ])
      costUsd += second.costUsd
      const repaired = second.block ? parseJudgment(second.block, comps) : null
      if (repaired) {
        const recheck = checkJudgmentConsistency({ comps, ...repaired })
        // Take the repair when it is strictly better; otherwise keep round one.
        if (recheck.violations.length < check.violations.length) {
          judged = repaired
          check = recheck
        }
      }
    }

    // ── deterministic resolution of whatever survived ───────────────────────
    const resolvedByCode: string[] = []
    const byKey = new Map(comps.map((c) => [c.listingKey, c]))

    // Any candidate with no verdict is kept at half weight with an honest
    // reason, never dropped silently.
    for (const c of comps) {
      if (!judged.verdicts.some((v) => v.listingKey === c.listingKey)) {
        judged.verdicts.push({
          listingKey: c.listingKey,
          tier: 'weak',
          reason: 'No comparability verdict was returned for this sale, so it is carried at half weight to bracket the range rather than dropped without a stated reason.',
        })
        resolvedByCode.push(`${c.listingKey}: missing verdict, carried as weak`)
      }
    }

    // Band and strand violators get excluded. Their reason is written after the
    // band is re-anchored below, so the number in the reason is the number the
    // shipped set actually supports. Never prune below the floor: buildCma
    // would discard the whole judgment anyway.
    const codeExcluded: string[] = []
    if (check.offendingKeptKeys.length > 0) {
      const keptCount = judged.verdicts.filter((v) => v.tier !== 'exclude').length
      const wouldRemain = keptCount - check.offendingKeptKeys.length
      if (wouldRemain >= RESOLVE_KEEP_FLOOR) {
        for (const key of check.offendingKeptKeys) {
          const v = judged.verdicts.find((x) => x.listingKey === key)
          if (!v || v.tier === 'exclude' || !byKey.has(key)) continue
          v.tier = 'exclude'
          v.basis = 'price-tier'
          v.reason = ''
          codeExcluded.push(key)
          resolvedByCode.push(`${key}: excluded, outside the declared band`)
        }
      } else {
        resolvedByCode.push(
          `${check.offendingKeptKeys.length} band violation(s) left in place: excluding them would leave fewer than ${RESOLVE_KEEP_FLOOR} comps.`,
        )
      }
    }

    // Re-anchor the published band on the set that actually shipped, so the
    // numbers in the excluded reasons and the narrative describe reality.
    const finalKept = judged.verdicts.filter((v) => v.tier !== 'exclude')
    const finalKeptPpsf = finalKept.map((v) => (byKey.get(v.listingKey) ? ppsf(byKey.get(v.listingKey)!) : 0)).filter((p) => p > 0)
    if (finalKeptPpsf.length > 0) {
      judged.ppsfFloor = Math.min(judged.ppsfFloor || Infinity, ...finalKeptPpsf)
      judged.ppsfCeiling = Math.max(judged.ppsfCeiling, ...finalKeptPpsf)
    }

    // Every price-tier exclusion that genuinely sits outside the final band
    // carries the band in its reason, so the auditor reads one stated rule
    // instead of inferring one. Code-excluded comps get the whole sentence.
    const band = `$${judged.ppsfFloor} to $${judged.ppsfCeiling}/sqft`
    for (const v of judged.verdicts) {
      const c = byKey.get(v.listingKey)
      if (!c) continue
      const p = ppsf(c)
      const outsideBand = p > 0 && (p < judged.ppsfFloor || p > judged.ppsfCeiling)
      if (codeExcluded.includes(v.listingKey)) {
        v.reason = `Sold at $${p}/sqft, outside the ${band} range this analysis prices the subject in.`
        continue
      }
      if (!isPriceTierExclusion(v) || !outsideBand || v.reason.includes(band)) continue
      v.reason = `${v.reason.replace(/\s*[.]?\s*$/, '')}. Sold at $${p}/sqft, outside the ${band} range this analysis prices the subject in.`
    }

    // Strip narrative sentences that still contradict a verdict, rather than
    // shipping prose the auditor will correctly call unsupported.
    let narrative = judged.narrative
    const verdictByKey = new Map(judged.verdicts.map((v) => [v.listingKey, v]))
    if (narrativeMismatches(comps, verdictByKey, narrative).length > 0) {
      const sentences = splitSentences(narrative)
      if (sentences.length >= 2) {
        const cleaned = sentences.filter(
          (s) => narrativeMismatches(comps, verdictByKey, s).length === 0,
        )
        if (cleaned.length > 0 && cleaned.length < sentences.length) {
          narrative = cleaned.join(' ')
          resolvedByCode.push('Removed narrative sentence(s) that contradicted a verdict.')
        }
      }
    }
    // The stated rule is what makes the exclusions checkable, so it has to
    // reach the reader (and the independent auditor, which is shown only the
    // narrative). Appended only when the narrative did not state the band
    // itself, so the seller does not read the same sentence twice.
    const narrativeStatesBand = /per square foot|\/sq\.?\s?ft|\/sqft/i.test(narrative)
    if (judged.exclusionRule && !narrativeStatesBand && !narrative.includes(judged.exclusionRule)) {
      narrative = `${narrative} ${judged.exclusionRule}`.trim()
    }

    const keptKeys = judged.verdicts.filter((v) => v.tier !== 'exclude').map((v) => v.listingKey)
    // Brand-voice sanitize: the model can emit em/en-dashes and semicolons,
    // which are banned in client prose. Numeric ranges become "to"; other
    // dashes become commas; semicolons become periods.
    const sanitize = sanitizeClientProse
    return {
      verdicts: judged.verdicts.map((v) => ({ ...v, reason: sanitize(v.reason) })),
      keptKeys,
      confidence: judged.confidence,
      narrative: sanitize(narrative),
      ppsfFloor: judged.ppsfFloor,
      ppsfCeiling: judged.ppsfCeiling,
      exclusionRule: sanitize(judged.exclusionRule),
      consistency: {
        firstPassViolations,
        repairRan,
        postRepairViolations: check.violations,
        resolvedByCode,
      },
      costUsd: +costUsd.toFixed(4),
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
