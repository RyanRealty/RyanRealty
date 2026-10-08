/**
 * Majority of N independent comp-review votes, plus the checksum of the exact
 * model input so an identical rebuild can reuse the decision.
 *
 * A comp is kept only when a strict majority of the votes keep it (weak or
 * strong). Tie goes to exclude: keeping requires more than half. Among the
 * keep votes, the tier is the most common of weak and strong. A tie in that
 * count goes to weak, the more conservative weight.
 *
 * Agreement is about keep versus exclude, not about weak versus strong. A
 * comp the runs do not agree on is unstable. If the unanimous keeps are below
 * the pricing minimum and counting every unstable comp as kept would reach
 * that minimum, the split is what decides whether the row can be priced. That
 * is JUDGE_UNSTABLE: do not build. A split that stays under the minimum on
 * both sides is an ordinary comp shortage. A split that stays at or above the
 * minimum on both sides is priced on the majority.
 */

import { createHash } from 'node:crypto'
import type { CompTier, CompVerdict, ExclusionBasis } from '@/lib/cma/judge-consistency'
import type { GroundResult } from '@/lib/cma/judge-ground'

/** Bump when the vote, the grounding rules, or the prompt contract change.
 *  The version is part of the checksum, so old stored decisions miss. */
export const JUDGE_VERSION = 'judge-stability-3'
export const JUDGE_RUNS = 3
/** Fixed. xAI chat `seed` is best-effort, not a guarantee. */
export const JUDGE_SEED = 20260929
export const JUDGE_TEMPERATURE = 0
export const JUDGE_REASONING_EFFORT = 'low' as const

export const JUDGE_UNSTABLE = 'JUDGE_UNSTABLE'

const CONFIDENCE_RANK: Record<string, number> = { Supportable: 0, Moderate: 1, High: 2 }

export type JudgeConfidence = 'High' | 'Moderate' | 'Supportable'

export type StoredVoteVerdict = {
  listingKey: string
  tier: CompTier
  modelTier: CompTier
  basis?: ExclusionBasis
  reason: string
  grounded: boolean
  rule: string
}

export type StoredVote = {
  verdicts: StoredVoteVerdict[]
  confidence: JudgeConfidence
  narrative: string
  ppsfFloor: number
  ppsfCeiling: number
  exclusionRule: string
}

/** What a build stores on `build_summary.judge_cache` and inside the judgment. */
export type JudgeDecisionRecord = {
  judgeVersion: string
  model: string
  inputChecksum: string
  runs: number
  minComps: number
  votes: StoredVote[]
  verdicts: CompVerdict[]
  keptKeys: string[]
  unstable: boolean
  unstableKeys: string[]
  keepLow: number
  keepHigh: number
  narrative: string
  confidence: JudgeConfidence
  ppsfFloor: number
  ppsfCeiling: number
  exclusionRule: string
  /** Set when unstable, so a cache hit fails with the same sentence. */
  message: string | null
}

export class JudgeUnstableError extends Error {
  readonly code = JUDGE_UNSTABLE
  readonly record: JudgeDecisionRecord
  readonly cacheHit: boolean
  constructor(message: string, record: JudgeDecisionRecord, cacheHit = false) {
    super(message)
    this.name = 'JudgeUnstableError'
    this.record = record
    this.cacheHit = cacheHit
  }
}

export function judgeUnstableMessage(args: {
  low: number
  high: number
  minComps: number
  candidates: number
}): string {
  return (
    `${JUDGE_UNSTABLE}. The comparability review did not agree on whether this home has enough kept sales. ` +
    `${args.low} of ${args.candidates} stayed in every pass and ${args.high} if every split sale is kept, ` +
    `and this home needs ${args.minComps}. The build was not priced.`
  )
}

export function canonicalJudgeInput(parts: {
  judgeVersion: string
  model: string
  seed: number
  temperature: number
  reasoningEffort: string
  schemaName: string
  schemaJson: string
  system: string
  user: string
}): string {
  return [
    parts.judgeVersion,
    parts.model,
    String(parts.seed),
    String(parts.temperature),
    parts.reasoningEffort,
    parts.schemaName,
    parts.schemaJson,
    parts.system,
    parts.user,
  ].join('\n---\n')
}

export function judgeInputChecksum(canonical: string): string {
  return createHash('sha256').update(canonical).digest('hex')
}

export type AggregateResult = {
  verdicts: CompVerdict[]
  keptKeys: string[]
  unstable: boolean
  unstableKeys: string[]
  keepLow: number
  keepHigh: number
  /** Kept comps whose exclude vote was thrown out. The band resolver must not drop them again. */
  protectedKeys: string[]
  confidence: JudgeConfidence
  narrative: string
  ppsfFloor: number
  ppsfCeiling: number
  exclusionRule: string
  message: string | null
}

function keepOf(tier: CompTier): boolean {
  return tier !== 'exclude'
}

function confidenceOf(votes: StoredVote[], scoreOf: (v: StoredVote) => number): JudgeConfidence {
  let best = votes[0]!
  let bestScore = scoreOf(best)
  for (let i = 1; i < votes.length; i++) {
    const vote = votes[i]!
    const score = scoreOf(vote)
    const betterScore = score > bestScore
    const sameScoreMoreConservative =
      score === bestScore && CONFIDENCE_RANK[vote.confidence] < CONFIDENCE_RANK[best.confidence]
    if (betterScore || sameScoreMoreConservative) {
      best = vote
      bestScore = score
    }
  }
  return best.confidence
}

/**
 * Combine grounded votes. `votes[i].verdicts` must already be one row per
 * candidate, in the same listing-key order the caller will price.
 */
export function aggregateJudgeVotes(args: {
  votes: StoredVote[]
  minComps: number
  candidateKeys: readonly string[]
}): AggregateResult {
  const votes = args.votes
  const n = votes.length
  const verdicts: CompVerdict[] = []
  const unstableKeys: string[] = []
  const protectedKeys: string[] = []
  let keepLow = 0

  for (const key of args.candidateKeys) {
    const cells = votes.map((vote) => vote.verdicts.find((v) => v.listingKey === key))
    const tiers = cells.map((c) => c?.tier ?? 'weak')
    const keepVotes = tiers.filter((t) => keepOf(t)).length
    const kept = keepVotes * 2 > n
    const unanimous = tiers.every((t) => keepOf(t) === keepOf(tiers[0]!))
    if (unanimous && kept) keepLow += 1
    if (!unanimous) unstableKeys.push(key)
    if (!kept) {
      const source = cells.find((c) => c && c.tier === 'exclude' && c.grounded) ?? cells.find((c) => c && c.tier === 'exclude')
      verdicts.push({
        listingKey: key,
        tier: 'exclude',
        reason: source?.reason ?? 'Excluded by a majority of the comparability passes.',
        basis: source?.basis,
      })
      continue
    }
    const keepCells = cells.filter((c): c is StoredVoteVerdict => !!c && keepOf(c.tier))
    const strong = keepCells.filter((c) => c.tier === 'strong').length
    const weak = keepCells.filter((c) => c.tier === 'weak').length
    const tier: CompTier = strong > weak ? 'strong' : 'weak'
    const source =
      keepCells.find((c) => c.tier === tier && c.modelTier === tier) ??
      keepCells.find((c) => c.tier === tier) ??
      keepCells[0]
    if (cells.some((c) => c && c.modelTier === 'exclude' && !c.grounded)) protectedKeys.push(key)
    verdicts.push({
      listingKey: key,
      tier,
      reason: source?.reason ?? 'Kept by a majority of the comparability passes.',
    })
  }

  // Low is the comps every pass kept. High adds every split comp, which could
  // still be kept. The gap between them is what an unstable vote can move.
  const keepHigh = keepLow + unstableKeys.length

  const keptKeys = verdicts.filter((v) => v.tier !== 'exclude').map((v) => v.listingKey)
  const unstable = keepLow < args.minComps && keepHigh >= args.minComps
  const keptSet = new Set(keptKeys)
  const aligned = confidenceOf(votes, (vote) =>
    vote.verdicts.reduce((n, v) => n + (keptSet.has(v.listingKey) === keepOf(v.tier) ? 1 : 0), 0),
  )
  const narrativeVote = votes
    .map((vote, index) => ({ vote, index }))
    .sort((a, b) => {
      const as = a.vote.verdicts.reduce((n, v) => n + (keptSet.has(v.listingKey) === keepOf(v.tier) ? 1 : 0), 0)
      const bs = b.vote.verdicts.reduce((n, v) => n + (keptSet.has(v.listingKey) === keepOf(v.tier) ? 1 : 0), 0)
      if (bs !== as) return bs - as
      if (CONFIDENCE_RANK[a.vote.confidence] !== CONFIDENCE_RANK[b.vote.confidence]) {
        return CONFIDENCE_RANK[a.vote.confidence] - CONFIDENCE_RANK[b.vote.confidence]
      }
      return a.index - b.index
    })[0]!.vote

  return {
    verdicts,
    keptKeys,
    unstable,
    unstableKeys,
    keepLow,
    keepHigh,
    protectedKeys,
    confidence: aligned,
    narrative: narrativeVote.narrative,
    ppsfFloor: narrativeVote.ppsfFloor,
    ppsfCeiling: narrativeVote.ppsfCeiling,
    exclusionRule: narrativeVote.exclusionRule,
    message: unstable
      ? judgeUnstableMessage({
          low: keepLow,
          high: keepHigh,
          minComps: args.minComps,
          candidates: args.candidateKeys.length,
        })
      : null,
  }
}

export function storedVoteFromGround(
  grounds: readonly GroundResult[],
  meta: {
    confidence: JudgeConfidence
    narrative: string
    ppsfFloor: number
    ppsfCeiling: number
    exclusionRule: string
  },
): StoredVote {
  return {
    confidence: meta.confidence,
    narrative: meta.narrative,
    ppsfFloor: meta.ppsfFloor,
    ppsfCeiling: meta.ppsfCeiling,
    exclusionRule: meta.exclusionRule,
    verdicts: grounds.map((g) => ({
      listingKey: g.verdict.listingKey,
      tier: g.verdict.tier,
      modelTier: g.modelTier,
      basis: g.verdict.basis,
      reason: g.verdict.reason,
      grounded: g.grounded,
      rule: g.rule,
    })),
  }
}

export function decisionRecord(args: {
  model: string
  inputChecksum: string
  minComps: number
  votes: StoredVote[]
  aggregate: AggregateResult
  /** Final verdicts after the deterministic resolver, when the row was stable. */
  finalized?: {
    verdicts: CompVerdict[]
    keptKeys: string[]
    narrative: string
    confidence: JudgeConfidence
    ppsfFloor: number
    ppsfCeiling: number
    exclusionRule: string
  } | null
}): JudgeDecisionRecord {
  const fin = args.finalized
  return {
    judgeVersion: JUDGE_VERSION,
    model: args.model,
    inputChecksum: args.inputChecksum,
    runs: JUDGE_RUNS,
    minComps: args.minComps,
    votes: args.votes,
    verdicts: fin?.verdicts ?? args.aggregate.verdicts,
    keptKeys: fin?.keptKeys ?? args.aggregate.keptKeys,
    unstable: args.aggregate.unstable,
    unstableKeys: args.aggregate.unstableKeys,
    keepLow: args.aggregate.keepLow,
    keepHigh: args.aggregate.keepHigh,
    narrative: fin?.narrative ?? args.aggregate.narrative,
    confidence: fin?.confidence ?? args.aggregate.confidence,
    ppsfFloor: fin?.ppsfFloor ?? args.aggregate.ppsfFloor,
    ppsfCeiling: fin?.ppsfCeiling ?? args.aggregate.ppsfCeiling,
    exclusionRule: fin?.exclusionRule ?? args.aggregate.exclusionRule,
    message: args.aggregate.message,
  }
}

function isConfidence(v: unknown): v is JudgeConfidence {
  return v === 'High' || v === 'Moderate' || v === 'Supportable'
}

function isTier(v: unknown): v is CompTier {
  return v === 'strong' || v === 'weak' || v === 'exclude'
}

/** A stored JSON blob is a hit only when it is this judge version and complete. */
export function parseJudgeDecisionRecord(raw: unknown, model: string): JudgeDecisionRecord | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Partial<JudgeDecisionRecord>
  if (r.judgeVersion !== JUDGE_VERSION) return null
  if (r.model !== model) return null
  if (typeof r.inputChecksum !== 'string' || r.inputChecksum.length < 16) return null
  if (r.runs !== JUDGE_RUNS) return null
  if (!Array.isArray(r.votes) || r.votes.length !== JUDGE_RUNS) return null
  if (!Array.isArray(r.verdicts) || !Array.isArray(r.keptKeys)) return null
  if (typeof r.unstable !== 'boolean') return null
  if (!isConfidence(r.confidence)) return null
  if (typeof r.narrative !== 'string') return null
  for (const vote of r.votes) {
    if (!vote || !Array.isArray(vote.verdicts)) return null
    for (const cell of vote.verdicts) {
      if (!cell || typeof cell.listingKey !== 'string' || !isTier(cell.tier) || !isTier(cell.modelTier)) return null
    }
  }
  return r as JudgeDecisionRecord
}

export function parseStoredJudgeCache(summary: unknown, model: string): JudgeDecisionRecord | null {
  if (!summary || typeof summary !== 'object') return null
  const cache = (summary as { judge_cache?: unknown }).judge_cache
  return parseJudgeDecisionRecord(cache, model)
}

export function cacheHit(record: JudgeDecisionRecord | null, checksum: string): record is JudgeDecisionRecord {
  return !!record && record.inputChecksum === checksum && record.judgeVersion === JUDGE_VERSION
}
