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
 * model, run the check. A single-sample repair turn was itself another draw
 * from the same non-deterministic model, so the stability pass takes a majority
 * of three passes instead. Whatever the majority returns is resolved
 * deterministically here: strand/band violators are excluded, and the numeric
 * band is written into their reason so the excluded list reads as one rule.
 * Comps whose exclusion was thrown out for an unsupported threshold are
 * protected from that second cut.
 *
 * Runs on XAI_API_KEY through lib/grok (Matt 2026-09-01). Fails OPEN: if the key is absent or
 * a call errors, returns null and the caller falls back to the deterministic
 * set + the dispersion guard. Never blocks a build on an unavailable judge.
 *
 * STABILITY (2026-09-29). grok-4.6 with reasoning effort low and no seed was
 * returning different keep/exclude decisions on byte-identical briefs, and a
 * single flip under the 3-comp minimum failed the build or moved the price.
 * The xAI chat body now sends temperature 0 and a fixed seed (both documented
 * on POST /v1/chat/completions; neither is in the reasoning-model reject list).
 * Seed is best-effort, so the judge also takes a majority of 3 independent
 * passes, drops an exclusion whose cited threshold the fields do not support,
 * and caches the votes by a checksum of the exact model input. A split that
 * decides whether the row reaches the kept-comp minimum throws JudgeUnstableError
 * (JUDGE_UNSTABLE) instead of pricing. That is the one throw: an unavailable
 * judge still returns null.
 */

import { GROK_MODELS, generateGrokStructured, grokConfigured, type GrokMessage } from '@/lib/grok'
import type { CmaComp, CmaMarketContext, CmaSubject } from '@/lib/cma/types'
import { setJudgeUnavailableReason } from '@/lib/cma/llm-unavailable'
import { sanitizeClientProse } from '@/lib/cma/voice-sanitize'
import { SAME_STREET_SIZE_BAND, sameStreetPeer } from '@/lib/pricing/price-anchor'
import { carriedRoomDecision } from '@/lib/pricing/room-ground'
import { PRICING_MIN_COMPS } from '@/lib/pricing/ladder'
import { roomDifferenceSentence, roomOffPhrase } from '@/lib/pricing/room-counts'
import {
  EXCLUSION_BASES,
  checkJudgmentConsistency,
  isPriceTierExclusion,
  narrativeMismatches,
  ppsf,
  restoreCustomYearQualityPeers,
  splitSentences,
  type CompTier,
  type CompVerdict,
  type ExclusionBasis,
} from '@/lib/cma/judge-consistency'
import { groundVote, isRoomCountExclusion } from '@/lib/cma/judge-ground'
import { PRICE_TIER_BAND, insidePriceTier, priceTierLine, salePpsf, type PriceTierLine } from '@/lib/pricing/price-tier'
import { isCustomOrNewSubject } from '@/lib/pricing/classes'
import { formatMonthsOfSupply } from '@/lib/format/months-of-supply'
import { claimCompOf, narrativeClaimFindings, stripRefutedSentences, type ClaimComp } from '@/lib/cma/narrative-claims'
import {
  JUDGE_REASONING_EFFORT,
  JUDGE_RUNS,
  JUDGE_SEED,
  JUDGE_TEMPERATURE,
  JUDGE_VERSION,
  JudgeUnstableError,
  aggregateJudgeVotes,
  cacheHit,
  canonicalJudgeInput,
  decisionRecord,
  judgeInputChecksum,
  parseStoredJudgeCache,
  storedVoteFromGround,
  type JudgeDecisionRecord,
  type StoredVote,
} from '@/lib/cma/judge-vote'

export function readJudgeCache(summary: unknown): JudgeDecisionRecord | null {
  return parseStoredJudgeCache(summary, MODEL)
}

export {
  JUDGE_RUNS,
  JUDGE_SEED,
  JUDGE_TEMPERATURE,
  JUDGE_VERSION,
  JUDGE_UNSTABLE,
  JudgeUnstableError,
  parseStoredJudgeCache,
} from '@/lib/cma/judge-vote'
export type { JudgeDecisionRecord, StoredVote } from '@/lib/cma/judge-vote'

/** Injected by tests and the read-only replay. Production leaves this unset and uses lib/grok. */
export type JudgeModelCall = (args: {
  system: string
  messages: GrokMessage[]
}) => Promise<{ payload: unknown; raw: string; costUsd: number }>

export type JudgeCompsOptions = {
  /** Prior `build_summary.judge_cache`, when the row has one. */
  priorCache?: JudgeDecisionRecord | null
  /** Kept-comp minimum the unstable check is measured against. Default 3. */
  minComps?: number
  /**
   * When false, an unstable split is returned on the judgment instead of thrown.
   * Curated (broker-picked) sets do not drop comps, so the minimum is not in play.
   */
  enforceKeepMinimum?: boolean
  callModel?: JudgeModelCall
  /**
   * The home's INDEPENDENT price anchor, the figure the comp search graded
   * every sale against (selection.diagnostics.price_anchor). With it the
   * review holds the one 20% line (Matt 2026-10-08, lib/pricing/price-tier.ts):
   * the brief states the line, the model declares it as its band, a price-tier
   * cut of a sale inside it is overridden, and no sale inside it is dropped by
   * the band cut below. Null or absent: the review derives its band as before.
   */
  priceAnchor?: JudgePriceAnchor | null
}

/** The anchor the review is told about: whole dollars a square foot and the sales it was read over. */
export type JudgePriceAnchor = { ppsf: number; n?: number | null }

// The consistency vocabulary is defined next to the check that enforces it;
// re-exported here so every existing caller keeps importing from one place.
export type { CompTier, CompVerdict, ExclusionBasis, ConsistencyCheck } from '@/lib/cma/judge-consistency'
export { checkJudgmentConsistency } from '@/lib/cma/judge-consistency'

// The judge runs on xAI (Matt 2026-09-01: the Anthropic account went dark on
// billing 2026-08-27 and the LLM layer moved to Grok). Model id lives in
// lib/grok/client.ts (ci:grok-models); cost comes back per call from xAI.
const MODEL = GROK_MODELS.text

/** Below this many kept comps the deterministic band cut stops pruning. The
 *  pricing minimum is the same five (PRICING_MIN_COMPS, Matt 2026-10-07), and
 *  buildCma prices only the sales this review keeps (lib/cma/judgment-prune.ts):
 *  a keep under five is a comp shortage, never a reason to price the excluded
 *  sales. */
const RESOLVE_KEEP_FLOOR = PRICING_MIN_COMPS

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
  /** Checksum of the exact model input. Present once the stability pass has run. */
  inputChecksum?: string
  /** True when this judgment was read from the stored decision, not a new model call. */
  cacheHit?: boolean
  /** Votes and the aggregated decision, persisted on the row as judge_cache. */
  decision?: JudgeDecisionRecord
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
    c.roomDifference?.length
      ? `room-note: ${roomOffPhrase(c.roomDifference, c.roomDecision?.gap)} different, counts for less, $0 on the room`
      : null,
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

/** Strict JSON schema for the judgment (xAI json_schema mode: every property required, no extras). */
const JUDGE_SCHEMA: Record<string, unknown> = {
    type: 'object',
    additionalProperties: false,
    properties: {
      ppsfFloor: {
        type: 'number',
        description:
          'The LOWEST $/sqft this analysis treats as the subject\'s market tier. Every comp you keep must sell at or above it, and every comp you exclude for being a cheaper tier must sell below it. A whole number of dollars per square foot. When the brief gives a PRICE TIER LINE, this is that line\'s floor.',
      },
      ppsfCeiling: {
        type: 'number',
        description:
          'The HIGHEST $/sqft this analysis treats as the subject\'s market tier. Every comp you keep must sell at or below it, and every comp you exclude for being a premium tier must sell above it. A whole number of dollars per square foot. When the brief gives a PRICE TIER LINE, this is that line\'s ceiling.',
      },
      exclusionRule: {
        type: 'string',
        description:
          'One or two plain sentences stating every criterion you applied and the threshold for each, in numbers where the criterion is numeric. Example: "Priced on closed sales from $420 to $610 per square foot. Sales above that band were remodeled to a higher finish level per their remarks." The same threshold must hold for every candidate. Do not state a year-built wall. The picker already applied year built.',
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
              enum: [...EXCLUSION_BASES, 'not-excluded'],
              description:
                'On tier=exclude: the single criterion the exclusion rests on ("not-excluded" for kept comps). Use price-tier ONLY when the $/sqft band is the reason. If the real reason is condition, vintage, size, lot, location, or structure type, name that instead.',
            },
          },
          additionalProperties: false,
          required: ['listingKey', 'tier', 'reason', 'basis'],
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
  'out. ' +
  'THE PRICE TIER LINE. When the brief gives a PRICE TIER LINE, that line IS the band: the home\'s own area sells ' +
  'at the stated figure per square foot, and its price tier is that figure plus or minus 20 percent. Declare the ' +
  'line\'s two numbers as ppsfFloor and ppsfCeiling. Do not draw a band from the sales you keep or from the other ' +
  'candidates. A sale inside the line is this home\'s price tier, and price alone does not exclude it. Use ' +
  'basis=price-tier only for a sale outside the line. The comp search admitted every sale on that same line, and ' +
  'code holds you to it. ' +
  'LOT SIZE UNDER AN ACRE IS NOT A CUT. When the subject and a sale both sit on less than one acre, the lot ' +
  'difference is shown beside the sale and never excludes it: a half-acre sale stays on a small-lot home. Do not ' +
  'exclude for lot size there, on any basis. Weigh it less if you must. At one acre and above on either side, a ' +
  'lot of a materially different size may still be excluded with basis=lot. ' +
  'Apply the same discipline to every non-numeric criterion. Do not exclude a sale for living area inside ' +
  '25 percent of the subject, and do not exclude one for year built. The picker already made those cuts, ' +
  'and it widens closed-sale age and date when the first location search is short of 3. A looser match stays. ' +
  'Weigh it less. Do not drop it. ' +
  'WHAT REVIEWERS CATCH MOST OFTEN, in order: a kept comp in an amenity-bearing planned community or resort when the subject is not, or the reverse; ' +
  'a kept comp of a different product type; and an exclusion reason the data does not actually show. Check your ' +
  'own set against those three before you answer. ' +
  'CUSTOM AND NEW CONSTRUCTION: do not exclude a same-generation custom or new-construction peer as too luxury, ' +
  'too expensive, or a premium tier. Year and quality outrank price. A 2022 custom sale is a peer to a 2024 custom ' +
  'subject even when it sold higher. ' +
  'THE ONE ROOM RULE (beds and baths, same decision). Same whole count travels anywhere. Up to two whole bedrooms ' +
  'off, up to two whole bathrooms off, or both, stays in the set and counts for less than the same room count. ' +
  'Do not exclude that sale for the room gap, and apply no dollar value to the room. Three or more whole rooms apart ' +
  'on either count is refused everywhere: exclude those. A half bath never decides usability. A candidate with a ' +
  'room-note stays. Code holds you to this rule the same way it holds the $/sqft band. ' +
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
  'Return only the JSON judgment object.'


interface RawJudgment {
  verdicts: CompVerdict[]
  confidence: CompJudgment['confidence']
  narrative: string
  ppsfFloor: number
  ppsfCeiling: number
  exclusionRule: string
}

function parseJudgment(payload: unknown, comps: CmaComp[]): RawJudgment | null {
  const out = payload as {
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

interface JudgeTurn {
  payload: unknown | null
  raw: string | null
  costUsd: number
}

/**
 * The ONE place this module talks to a model (G56: model calls go through a
 * single chokepoint, never scattered per call site). Both the first pass and
 * the consistency repair turn come through here, so the model, the tool
 * forcing, the token ceiling, and the cost accounting are defined once and
 * cannot drift apart between the two.
 */
async function sendJudgeTurn(messages: GrokMessage[], callModel?: JudgeModelCall): Promise<JudgeTurn> {
  if (callModel) {
    const res = await callModel({ system: SYSTEM, messages })
    return { payload: res.payload, raw: res.raw, costUsd: res.costUsd ?? 0 }
  }
  const res = await generateGrokStructured<Record<string, unknown>>({
    system: SYSTEM,
    messages,
    schema: JUDGE_SCHEMA,
    schemaName: 'record_comp_judgment',
    maxTokens: 2500,
    reasoningEffort: JUDGE_REASONING_EFFORT,
    // Both are on the xAI chat completions body. The Cursor CLI transport
    // ignores them: cursor-agent has no temperature or seed flag.
    temperature: JUDGE_TEMPERATURE,
    seed: JUDGE_SEED,
  })
  return { payload: res.value, raw: res.raw, costUsd: res.costUsd ?? 0 }
}

export function judgePromptChecksum(user: string, model: string = MODEL): string {
  return judgeInputChecksum(
    canonicalJudgeInput({
      judgeVersion: JUDGE_VERSION,
      model,
      seed: JUDGE_SEED,
      temperature: JUDGE_TEMPERATURE,
      reasoningEffort: JUDGE_REASONING_EFFORT,
      schemaName: 'record_comp_judgment',
      schemaJson: JSON.stringify(JUDGE_SCHEMA),
      system: SYSTEM,
      user,
    }),
  )
}

/**
 * Months of supply as the judge prompt prints it: the display value
 * (formatMonthsOfSupply, so a threshold never reads wrong) in the number shape
 * the prompt always carried ("3.6", "4"). The prompt text is the judge cache
 * key (judgePromptChecksum), so a raw 3.6213 here would re-run the model on
 * every stored decision for no change in the decision.
 */
function mosForPrompt(mos: number | null): string {
  return mos == null ? 'unknown' : String(Number(formatMonthsOfSupply(mos)))
}

/**
 * The subject/comps/market brief the judge reasons over.
 *
 * Extracted from judgeComps so the audit-driven narrative repair below can hand
 * the model the SAME brief it saw the first time. A repair turn built on a
 * different brief is a different question, and the answer would not be
 * comparable to the one it is replacing.
 */
export function buildJudgeUserPrompt(
  subject: CmaSubject,
  comps: CmaComp[],
  market: CmaMarketContext | null,
  priceAnchor: JudgePriceAnchor | null = null,
): string {
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
    ? `Market: ${market.geoLabel}, ${market.marketVerdict}, ${mosForPrompt(market.monthsOfSupply)} months supply, median $${market.medianPpsf ?? '?'}/sqft, ${market.yoyMedianPriceDeltaPct ?? '?'}% YoY.`
    : 'Market: no cache row for this geography.'

  // THE ONE 20% LINE (Matt 2026-10-08). Stated only when the search had an
  // anchor, so a home without one gets the brief it always got.
  const line = priceTierLine(priceAnchor?.ppsf)
  const lineText = line
    ? `\nPRICE TIER LINE: this home's own area sells for $${line.anchor} a square foot${
        priceAnchor?.n != null && priceAnchor.n > 0 ? ` (median of ${priceAnchor.n} closed sales)` : ''
      }, the figure the comp search graded every candidate against. The line is that figure plus or minus ${Math.round(
        PRICE_TIER_BAND * 100,
      )} percent: $${line.floor} to $${line.ceiling} a square foot. Declare ppsfFloor ${line.floor} and ppsfCeiling ${line.ceiling}. A candidate inside the line is not a different price tier. In the narrative, say the kept sales sit inside that line rather than calling the line their range.`
    : ''

  return (
    `SUBJECT: ${subjectLine}\n${marketLine}${lineText}\n${conditionEvidence}\n\n` +
    `CANDIDATE COMPS (${comps.length}) — judge each by its listing key:\n` +
    comps.map((c, i) => `${i + 1}. ${describeComp(c)}`).join('\n') +
    `\n\nClassify every comp (strong / weak / exclude), declare the $/sqft band and the rule you applied, give an overall confidence, and write the comparability narrative.`
  )
}

/**
 * Judge which candidate comps are genuinely comparable to the subject.
 * Returns null (fail-open) when the model is unavailable or a call fails.
 * Throws JudgeUnstableError when a split vote is what decides the kept-comp minimum.
 */
export async function judgeComps(
  subject: CmaSubject,
  comps: CmaComp[],
  market: CmaMarketContext | null,
  options: JudgeCompsOptions = {},
): Promise<CompJudgment | null> {
  setJudgeUnavailableReason(null)
  if (comps.length === 0) return null
  if (!options.callModel && !grokConfigured()) return null

  const priceAnchor = options.priceAnchor ?? null
  const line = priceTierLine(priceAnchor?.ppsf)
  const user = buildJudgeUserPrompt(subject, comps, market, priceAnchor)
  const inputChecksum = judgePromptChecksum(user, MODEL)
  const minComps = options.minComps ?? PRICING_MIN_COMPS
  const enforce = options.enforceKeepMinimum !== false
  const candidateKeys = comps.map((c) => c.listingKey)
  const prior = options.priorCache && options.priorCache.model === MODEL && cacheHit(options.priorCache, inputChecksum)
    ? options.priorCache
    : null

  try {
    if (prior) {
      if (prior.unstable && enforce) {
        throw new JudgeUnstableError(
          prior.message ??
            'JUDGE_UNSTABLE. The stored comparability review did not agree on enough kept sales. The build was not priced.',
          prior,
          true,
        )
      }
      // THE STORED VOTES ARE THE EXPENSIVE PART; THE RESOLVER IS CODE (2026-09-30).
      // The cache used to hand back the finalized verdicts as they were stored,
      // so a change to the deterministic resolver below (a new restoration, a
      // narrative check) never reached a row whose brief had not changed. The
      // votes are replayed through the same majority and the same resolver
      // instead: no model call, the same decision stability, the current rules.
      const aggregate = aggregateJudgeVotes({ votes: prior.votes, minComps, candidateKeys })
      // The replay is held to the same stability rule as a fresh run, not only
      // to the flag the record was stored with: a record an older aggregator
      // wrote as stable, whose votes the current one reads as a split that
      // decides the minimum, fails the build exactly as those votes would fresh
      // (review of da8dce6, 2026-09-30).
      if (aggregate.unstable && enforce) {
        const record = decisionRecord({
          model: MODEL,
          inputChecksum,
          minComps,
          votes: prior.votes,
          aggregate,
        })
        throw new JudgeUnstableError(aggregate.message ?? 'JUDGE_UNSTABLE. The build was not priced.', record, true)
      }
      return finalizeJudgment({
        subject,
        comps,
        votes: prior.votes,
        aggregate,
        inputChecksum,
        minComps,
        costUsd: 0,
        cacheHit: true,
        line,
      })
    }

    let costUsd = 0
    const votes: StoredVote[] = []
    for (let i = 0; i < JUDGE_RUNS; i++) {
      const turn = await sendJudgeTurn([{ role: 'user', content: user }], options.callModel)
      costUsd += turn.costUsd
      if (turn.payload == null) throw new Error('judge returned no payload')
      const parsed = parseJudgment(turn.payload, comps)
      if (!parsed) throw new Error('judge returned no usable verdicts')
      const grounds = groundVote(
        subject,
        comps,
        parsed.verdicts,
        {
          floor: parsed.ppsfFloor,
          ceiling: parsed.ppsfCeiling,
        },
        line,
      )
      votes.push(
        storedVoteFromGround(grounds, {
          confidence: parsed.confidence,
          narrative: parsed.narrative,
          ppsfFloor: parsed.ppsfFloor,
          ppsfCeiling: parsed.ppsfCeiling,
          exclusionRule: parsed.exclusionRule,
        }),
      )
    }
    const aggregate = aggregateJudgeVotes({ votes, minComps, candidateKeys })
    if (aggregate.unstable && enforce) {
      const record = decisionRecord({
        model: MODEL,
        inputChecksum,
        minComps,
        votes,
        aggregate,
      })
      throw new JudgeUnstableError(aggregate.message ?? 'JUDGE_UNSTABLE. The build was not priced.', record, false)
    }
    return finalizeJudgment({ subject, comps, votes, aggregate, inputChecksum, minComps, costUsd, cacheHit: false, line })
  } catch (err) {
    if (err instanceof JudgeUnstableError) throw err
    const reason = err instanceof Error ? err.message : String(err)
    setJudgeUnavailableReason(reason)
    console.warn('[cma/judge] comparability judgment failed, falling back to deterministic:', reason)
    return null
  }
}

/** A comp and its review tier, in the shape the narrative claim checks read. */
function claimComp(c: CmaComp, tier: CompTier | null): ClaimComp {
  return claimCompOf(c, tier)
}

/**
 * The deterministic half of the judgment: everything after the majority vote.
 * A fresh build and a cache hit both run it, on the same votes, so a stored
 * decision always resolves under the current rules.
 */
function finalizeJudgment(args: {
  subject: CmaSubject
  comps: CmaComp[]
  votes: StoredVote[]
  aggregate: ReturnType<typeof aggregateJudgeVotes>
  inputChecksum: string
  minComps: number
  costUsd: number
  cacheHit: boolean
  /** The one 20% line around the home's anchor, or null with no anchor. */
  line?: PriceTierLine | null
}): CompJudgment {
  const { subject, comps, votes, aggregate, inputChecksum, minComps, costUsd } = args
  const line = args.line ?? null
  const judged: RawJudgment = {
    verdicts: aggregate.verdicts.map((v) => ({ ...v })),
    confidence: aggregate.confidence,
    narrative: aggregate.narrative,
    // With an anchor the declared band IS the line, whatever the model wrote:
    // the review grades price on the line the search admitted on, never on a
    // band drawn from the sales it kept (Matt 2026-10-08).
    ppsfFloor: line ? line.floor : aggregate.ppsfFloor,
    ppsfCeiling: line ? line.ceiling : aggregate.ppsfCeiling,
    exclusionRule: aggregate.exclusionRule,
  }

  const firstCheck = checkJudgmentConsistency({ comps, ...judged })
  const firstPassViolations = firstCheck.violations
  const check = firstCheck
  const repairRan = false

  // ── deterministic resolution of whatever survived ───────────────────────
  const resolvedByCode: string[] = [
    args.cacheHit
      ? `Reused the stored ${JUDGE_RUNS} passes (the brief is unchanged) and resolved them again under the current rules.`
      : `Majority of ${JUDGE_RUNS} passes. No single-sample repair turn.`,
  ]
  for (const key of aggregate.protectedKeys) {
    resolvedByCode.push(`${key}: exclusion ignored, the cited threshold is not supported by the fields`)
  }
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

  // ONE 20% LINE: a sale inside it is this home's price tier, so the band and
  // strand cut below (a price-tier cut by another name) never drops it. The
  // search admitted it on the same line; dropping it here is the split vote
  // this ruling ended. A custom or new subject keeps the floor and loses the
  // ceiling, as the search does (lib/pricing/price-tier.ts insidePriceTier).
  const insideLineKeys: string[] = []
  if (line) {
    const floorOnly = isCustomOrNewSubject({
      yearBuilt: subject.yearBuilt,
      newConstructionYn: subject.newConstructionYn,
      remarks: subject.publicRemarks,
    })
    for (const c of comps) {
      const p = salePpsf(c.closePrice, c.sqft)
      if (p != null && insidePriceTier(p, line, { floorOnly })) insideLineKeys.push(c.listingKey)
    }
  }

  // Custom/new year-quality peers the model tossed as luxury come back.
  const restored = restoreCustomYearQualityPeers({
    subject: {
      yearBuilt: subject.yearBuilt,
      newConstructionYn: subject.newConstructionYn,
      remarks: subject.publicRemarks,
    },
    comps,
    verdicts: judged.verdicts,
  })
  judged.verdicts = restored.verdicts
  const protectedKeys = new Set<string>([...restored.restoredKeys, ...aggregate.protectedKeys, ...insideLineKeys])
  // Same-street and own-plat restorations below; a restoration retires the declared rule.
  let restoredByRule = 0
  if (restored.restoredKeys.length > 0) {
    for (const key of restored.restoredKeys) {
      const c = byKey.get(key)
      if (!c) continue
      const p = ppsf(c)
      if (p > 0) {
        judged.ppsfFloor = Math.min(judged.ppsfFloor || p, p)
        judged.ppsfCeiling = Math.max(judged.ppsfCeiling || 0, p)
      }
      resolvedByCode.push(`${key}: restored, custom/new year-quality peer cannot be dropped as luxury`)
    }
  }

  // THE HOUSE NEXT DOOR IS NOT A DIFFERENT PRICE TIER (Matt 2026-09-10).
  // On 23 Benaiah the judge excluded 31 Benaiah — the identical 2,080 sqft
  // floorplan on the same street, an arm's-length sale that closed above its
  // last ask — on the basis "sold at $246/sqft, outside the $305 to $362
  // range this analysis prices the subject in". That band came from the OTHER
  // comps, so the reasoning was circular: the one sale that would have moved
  // the number was removed for disagreeing with the sales that set it. The
  // deterministic selector already exempts a same-street, same-size peer from
  // its own price cut (lib/pricing/price-anchor.ts); the judge is held to the
  // same rule. A gap that wide between the twin next door and the wider
  // neighborhood is the finding, not the noise, and the review page shows it.
  for (const v of judged.verdicts) {
    const c = byKey.get(v.listingKey)
    if (!c) continue
    if (
      !sameStreetPeer(
        { streetAddress: subject.streetAddress, city: subject.city, sqft: subject.sqft ?? 0 },
        { address: c.address, city: c.city, sqft: c.sqft },
      )
    ) {
      continue
    }
    protectedKeys.add(v.listingKey)
    if (v.tier !== 'exclude') continue
    // The street exempts the price cut only. A different product on a
    // street that shares the first word stays excluded.
    if (!isPriceTierExclusion(v)) continue
    v.tier = 'strong'
    delete v.basis
    v.reason = `Same street as the subject and within ${Math.round(SAME_STREET_SIZE_BAND * 100)}% of its size. The closest sale there is to this house, so it prices it whatever the wider neighborhood runs at.`
    resolvedByCode.push(`${v.listingKey}: restored, a same-street peer of the subject's size cannot be dropped on price`)
    restoredByRule++
  }

  // THE SUBJECT'S OWN PLAT IS NOT A DIFFERENT PRICE TIER EITHER (Matt
  // 2026-09-10: "two exemptions and only two", the plat and the same-street
  // twin; held here 2026-09-30). Falcon 15991 is why: the judge cut near-acre
  // peers inside the subject's own plat on price, kept three of eight, and the
  // answer then was to price the whole candidate pool whenever the judge kept
  // fewer than five (lib/cma/judgment-prune.ts, now retired). That brought back
  // every excluded sale, at full weight. This brings back only the one the
  // ruling exempts, at half weight, with its reason on record. `ownPlat` is the
  // SELECTOR's own-plat decision (onOwnPlat in lib/pricing/plat-ground.ts,
  // which counts a recorded addition or phase of the subject's subdivision
  // inside its neighborhood as its own subdivision, Matt 2026-10-08 "Yes,
  // everywhere"; or the street-cluster pocket), the same decision on both
  // ladders, so the judge and the ladder cannot disagree
  // about which sales are in the plat. Every own-plat sale is also protected
  // from the band cut below, which is a price-tier cut by another name.
  for (const v of judged.verdicts) {
    const c = byKey.get(v.listingKey)
    if (!c || c.ownPlat !== true) continue
    protectedKeys.add(v.listingKey)
    if (!isPriceTierExclusion(v)) continue
    v.tier = 'weak'
    delete v.basis
    v.reason = `Inside the subject's own subdivision${c.subdivision ? `, ${c.subdivision}` : ''}. A sale there is this home's price tier, so price alone does not drop it. It is carried at half weight.`
    resolvedByCode.push(`${v.listingKey}: restored, a sale in the subject's own plat cannot be dropped on price tier`)
    restoredByRule++
  }

  // THE ROOM RULE IS NOT A JUDGE CALL (Matt 2026-09-10, skill 0.1; widened
  // 2026-10-09). This review reads the picker's own decision for the sale,
  // re-run on the counts the picker compared (carriedRoomDecision). Up to two
  // bedrooms off and two bathrooms off that the picker kept cannot be dropped
  // for the room. Three or more on one count cannot stay, whatever the model said.
  for (const v of judged.verdicts) {
    const c = byKey.get(v.listingKey)
    if (!c) continue
    const rooms = carriedRoomDecision(subject, c)
    if (!rooms.ok) {
      if (v.tier === 'exclude') continue
      v.tier = 'exclude'
      v.basis = 'other'
      v.reason = 'Room counts are three or more whole rooms apart.'
      resolvedByCode.push(`${v.listingKey}: excluded, one-room rule refuses this sale`)
      continue
    }
    if (!isRoomCountExclusion(v)) continue
    v.tier = 'strong'
    delete v.basis
    v.reason =
      roomDifferenceSentence(rooms.notes, rooms.gap) ??
      'Room counts follow the one-room rule. This sale stays.'
    protectedKeys.add(v.listingKey)
    restoredByRule++
    resolvedByCode.push(`${v.listingKey}: restored, one-room rule keeps this sale`)
  }

  // Band and strand violators get excluded. Their reason is written after the
  // band is re-anchored below, so the number in the reason is the number the
  // shipped set actually supports. Never prune below the floor: buildCma
  // would discard the whole judgment anyway. Custom year-quality peers stay.
  const codeExcluded: string[] = []
  const offending = check.offendingKeptKeys.filter((k) => !protectedKeys.has(k))
  if (offending.length > 0) {
    const keptCount = judged.verdicts.filter((v) => v.tier !== 'exclude').length
    const wouldRemain = keptCount - offending.length
    if (wouldRemain >= RESOLVE_KEEP_FLOOR) {
      for (const key of offending) {
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
  // THE SAME CLAIM CHECKS THE BUILD RUNS AGAINST THE FINAL PRICED SET
  // (lib/cma/narrative-claims.ts, 2026-09-30), run here against the set this
  // review keeps: a count, a named drop or keep, a weight, or a lot figure the
  // kept sales refute. The judge wrote the narrative before grounding and the
  // restorations above moved the set, so it can describe a cut that no longer
  // stands. buildCma runs them again against the sales that actually price
  // (alignNarrativeToFinalSet in lib/cma/judge-consistency.ts), after the
  // product walls and any audit repair.
  const keptClaims = finalKept
    .map((v) => byKey.get(v.listingKey))
    .filter((c): c is CmaComp => c != null)
    .map((c) => claimComp(c, verdictByKey.get(c.listingKey)?.tier ?? null))
  const candidateClaims = comps.map((c) => claimComp(c, verdictByKey.get(c.listingKey)?.tier ?? null))
  const claimSubject = { streetAddress: subject.streetAddress, lotAcres: subject.lotAcres }
  {
    const stripped = stripRefutedSentences({
      narrative,
      priced: keptClaims,
      candidates: candidateClaims,
      subject: claimSubject,
    })
    if (stripped.removed.length > 0) {
      narrative = stripped.narrative
      resolvedByCode.push(
        `Removed ${new Set(stripped.removed.map((f) => f.sentence)).size} narrative sentence(s) the kept set refutes (${[
          ...new Set(stripped.removed.map((f) => f.kind)),
        ].join(', ')}).`,
      )
    }
  }
  // A RESTORATION RETIRES THE DECLARED RULE (review of da8dce6, 2026-09-30).
  // The model states its exclusion rule and band about its own cut. When a
  // restoration above puts back a sale it cut, that rule stops describing the
  // sales that price: on the judge-restore fixture it kept printing "Priced on
  // closed sales from $350 to $420 per square foot" over a restored $278 sale.
  // So the rule is dropped, and the band and exclusion sentences in the
  // narrative are held to the kept set by the claim checks just above.
  if (judged.exclusionRule && (restoredByRule > 0 || restored.restoredKeys.length > 0)) {
    resolvedByCode.push(
      'Dropped the declared exclusion rule: a restoration put a sale it excluded back in the kept set, so the rule no longer describes the sales that price.',
    )
    judged.exclusionRule = ''
  }
  // The stated rule is what makes the exclusions checkable, so it has to
  // reach the reader (and the independent auditor, which is shown only the
  // narrative). Appended only when the narrative did not state the band
  // itself, so the seller does not read the same sentence twice, and only
  // when the kept set does not refute it (a band the re-anchoring widened).
  const narrativeStatesBand = /per square foot|\/sq\.?\s?ft|\/sqft/i.test(narrative)
  if (judged.exclusionRule && !narrativeStatesBand && !narrative.includes(judged.exclusionRule)) {
    const refuted = narrativeClaimFindings({
      narrative: judged.exclusionRule,
      priced: keptClaims,
      candidates: candidateClaims,
      subject: claimSubject,
    })
    if (refuted.length > 0) {
      resolvedByCode.push(
        `Did not append the declared exclusion rule: the kept set refutes it (${[...new Set(refuted.map((f) => f.kind))].join(', ')}).`,
      )
      judged.exclusionRule = ''
    } else {
      narrative = `${narrative} ${judged.exclusionRule}`.trim()
    }
  }

  const keptKeys = judged.verdicts.filter((v) => v.tier !== 'exclude').map((v) => v.listingKey)
  // Brand-voice sanitize: the model can emit em/en-dashes and semicolons,
  // which are banned in client prose. Numeric ranges become "to"; other
  // dashes become commas; semicolons become periods.
  const sanitize = sanitizeClientProse
  const verdicts = judged.verdicts.map((v) => ({ ...v, reason: sanitize(v.reason) }))
  const record = decisionRecord({
    model: MODEL,
    inputChecksum,
    minComps,
    votes,
    aggregate,
    finalized: {
      verdicts,
      keptKeys,
      narrative: sanitize(narrative),
      confidence: judged.confidence,
      ppsfFloor: judged.ppsfFloor,
      ppsfCeiling: judged.ppsfCeiling,
      exclusionRule: sanitize(judged.exclusionRule),
    },
  })
  return {
    verdicts,
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
    inputChecksum,
    cacheHit: args.cacheHit,
    decision: record,
  }
}

/**
 * ONE targeted narrative repair, driven by the adversarial audit's findings.
 *
 * WHY THIS EXISTS. The build already self-repairs findings tied to a SPECIFIC
 * comp: drop the comp, re-price, re-audit. Findings about the PROSE had no such
 * path, so a narrative that misdescribed a sound comp set flagged the whole
 * document and parked it in draft forever. On 2026-08-06 that was every stored
 * CMA — 8 of 8 carrying `Audit verdict: fail`, several for nothing worse than a
 * miscounted bedroom claim sitting beside correct pricing.
 *
 * The comp set and the pricing are FINAL here. They have already been judged,
 * repaired, and audited. Only the sentences change.
 *
 * The model proposes; CODE decides. The caller re-runs the deterministic
 * narrative-integrity check on whatever comes back and keeps the repair only
 * when it is strictly cleaner — the same contract the consistency repair above
 * operates under. A model is not permitted to certify its own correction.
 */
export async function repairNarrativeAgainstAudit(args: {
  subject: CmaSubject
  comps: CmaComp[]
  market: CmaMarketContext | null
  judgment: CompJudgment
  /** Auditor findings about the prose, rendered one per line. */
  findings: string[]
  /** The same anchor the judgment was briefed with, so the repair sees the same brief. */
  priceAnchor?: JudgePriceAnchor | null
}): Promise<{ narrative: string; costUsd: number; model: string } | null> {
  if (!grokConfigured() || args.findings.length === 0 || args.comps.length === 0) return null
  if (!args.judgment.narrative?.trim()) return null

  const user = buildJudgeUserPrompt(args.subject, args.comps, args.market, args.priceAnchor ?? null)
  const repairUser =
    `An independent adversarial audit read the comparability narrative you wrote and found claims the ` +
    `comp set does not support. Return ONE corrected judgment whose narrative survives the same audit.\n\n` +
    `YOUR NARRATIVE:\n${args.judgment.narrative}\n\n` +
    `WHAT THE AUDIT FOUND:\n${args.findings.map((f, i) => `${i + 1}. ${f}`).join('\n')}\n\n` +
    `The comp set and the pricing are FINAL and were audited as correct. Do not reclassify a comp, do not ` +
    `move a sale in or out, and do not restate the recommended price. Return the same verdicts you returned ` +
    `before. The ONLY thing to change is the prose.\n\n` +
    `Every count, bracket, and address in the narrative must be checkable against the comps listed above. ` +
    `Count the rows before you write a number. If four comps have four bedrooms, the narrative says four. ` +
    `If no comp falls in a price-per-square-foot bracket, do not state that bracket. A claim you cannot ` +
    `point at a row for comes out of the sentence entirely — a shorter narrative that is true beats a fuller ` +
    `one that is not.`

  try {
    let costUsd = 0

    const first = await sendJudgeTurn([{ role: 'user', content: user }])
    costUsd += first.costUsd
    if (first.payload == null) return null

    const second = await sendJudgeTurn([
      { role: 'user', content: user },
      { role: 'assistant', content: first.raw ?? JSON.stringify(first.payload) },
      { role: 'user', content: repairUser },
    ])
    costUsd += second.costUsd

    const repaired = second.payload != null ? parseJudgment(second.payload, args.comps) : null
    const narrative = repaired?.narrative?.trim()
    if (!narrative) return null

    return { narrative, costUsd: +costUsd.toFixed(4), model: MODEL }
  } catch (err) {
    console.warn(
      '[cma/judge] narrative repair failed, keeping the audited narrative and the review flag:',
      err instanceof Error ? err.message : String(err),
    )
    return null
  }
}
