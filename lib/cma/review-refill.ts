/**
 * REFILL FROM THE SAME RUNG (Matt 2026-10-08).
 *
 * Five price-setting sales is the floor (SKILL.md rule 8). The search walks
 * the home's own ground across its full window and may seat up to seven from
 * there; a rung that WIDENS the area adds only the sales needed to reach five,
 * so a set reached through a widening rung is exactly five. The comparability
 * review (lib/cma/judge.ts) can then drop one, and until tonight the build
 * failed as a comp shortage on a home whose rung still held qualifying sales:
 * 20676 Wild Rose ("3 of 5 stayed"), 915 Saginaw (JUDGE_UNSTABLE, 4 of 5 in
 * every pass).
 *
 * THE RULING (Matt 2026-10-09). The picker already seated the set. A review
 * exclude or a split vote does not remove one of those sales, does not change
 * its weight, and does not refill. The product wall in pricingCompsAfterJudgment
 * is the picker's own product rule. When that wall leaves the set short, and
 * the set was reached through a widening rung, the search still takes the
 * next-best sale from THAT SAME RUNG, never from a wider rung.
 *
 * BOUNDED. At most as many refills as the bench holds, and at most
 * REVIEW_REFILL_MAX_ROUNDS rounds of refill-and-review after the first review.
 * Own ground never refills: it already seats up to seven, and a set reached
 * on own ground carries an empty bench (lib/pricing/match.ts capPricingSet,
 * lib/cma/comps.ts selectComps).
 *
 * One helper, both builds (lib/cma/build.ts, lib/bpo/build.ts). The judge is
 * passed in so a test can drive it without a model.
 */
import type { CmaComp, CmaSubject } from '@/lib/cma/types'
import type { CompJudgment } from '@/lib/cma/judge'
import type { CompVerdict } from '@/lib/cma/judge-consistency'
import { JudgeUnstableError } from '@/lib/cma/judge-vote'
import { pricingCompsAfterJudgment } from '@/lib/cma/judgment-prune'
import type { SelectedPricingComp } from '@/lib/pricing/match'
import { PRICING_MIN_COMPS } from '@/lib/pricing/ladder'
import { dropPriorSalesOfSameHome } from '@/lib/pricing/same-address'

/** Rounds of refill-and-review after the first review. */
export const REVIEW_REFILL_MAX_ROUNDS = 2

/**
 * What the selection hands the build: the rung that reached five, whether it
 * widened the area, and that rung's remaining qualifying, price-setting,
 * not-seated sales in the rung's own order. Seated sales are never in it.
 */
export type CompRefillBench = {
  rung: string | null
  /** Only a set reached through a widening rung refills. */
  widening: boolean
  comps: CmaComp[]
  /** The facts-ladder rows for the same sales, when the facts ladder found them (the market path reads them). */
  pricingSales?: SelectedPricingComp[]
}

export type ReviewRefillRound = {
  round: number
  /** `excluded`: the review dropped sales. `split`: the review split on them (JUDGE_UNSTABLE). */
  reason: 'excluded' | 'split'
  dropped: string[]
  refilled: string[]
}

/** Persisted on build_summary.comp_selection.review_refill. */
export type ReviewRefillRecord = {
  rung: string
  rounds: ReviewRefillRound[]
  bench_left: number
}

export type GatedPricingSet = {
  comps: CmaComp[]
  shortage: boolean
  droppedProduct: number
  trace: string
}

export type ReviewRefillArgs = {
  subject: Pick<
    CmaSubject,
    'propertySubType' | 'yearBuilt' | 'newConstructionYn' | 'publicRemarks' | 'subdivision' | 'seniorCommunityYn'
  >
  selection: {
    comps: CmaComp[]
    pricingSales?: SelectedPricingComp[]
    refill?: CompRefillBench
    ownPlatAgeRestrictedShare?: number | null
  }
  /** The comparability review over one set. Throws JudgeUnstableError on a split that decides the minimum. */
  judge: (comps: CmaComp[], round: number) => Promise<CompJudgment | null>
  /** Hydration for a refilled sale (photos, days on market) before it is judged. */
  prepare?: (comps: CmaComp[]) => Promise<CmaComp[]>
  minComps?: number
  exclusivePocket?: boolean
  maxRounds?: number
}

export type ReviewRefillOutcome = {
  /** Every candidate the review saw: the original set plus every refilled sale. */
  candidates: CmaComp[]
  /** The facts rows for `candidates`, when the selection carried them. */
  pricingSales?: SelectedPricingComp[]
  /**
   * The final review, with an exclude verdict folded in for every sale an
   * earlier round dropped, so the rejected-sales list and the audit see them.
   * Null when the review did not run or the final review was unstable.
   */
  judgment: CompJudgment | null
  gated: GatedPricingSet
  /** The unstable review that ended the build, after every refill the rung allowed. */
  unstable: JudgeUnstableError | null
  /** Null when nothing was refilled. */
  refill: ReviewRefillRecord | null
  /** Lines for selection.trace, in order. */
  trace: string[]
}

function keysOf(comps: readonly { listingKey: string }[]): string[] {
  return comps.map((c) => c.listingKey)
}

function addressesOf(comps: readonly CmaComp[]): string {
  return comps.map((c) => c.address).join(', ')
}

export async function reviewWithRefill(args: ReviewRefillArgs): Promise<ReviewRefillOutcome> {
  const minComps = args.minComps ?? PRICING_MIN_COMPS
  const maxRounds = args.maxRounds ?? REVIEW_REFILL_MAX_ROUNDS
  const refill = args.selection.refill
  const rung = refill?.widening === true && refill.rung ? refill.rung : null
  const bench = [...(refill?.comps ?? [])]
  const benchSales = new Map((refill?.pricingSales ?? []).map((s) => [s.listingKey, s]))
  const candidates = [...args.selection.comps]
  const pricingSales = args.selection.pricingSales ? [...args.selection.pricingSales] : undefined
  const subject = {
    propertySubType: args.subject.propertySubType,
    yearBuilt: args.subject.yearBuilt,
    newConstructionYn: args.subject.newConstructionYn,
    publicRemarks: args.subject.publicRemarks,
    subdivision: args.subject.subdivision,
    seniorCommunityYn: args.subject.seniorCommunityYn,
  }
  const gate = (judged: CmaComp[], vetted: CmaComp[], verdicts: CompVerdict[]): GatedPricingSet =>
    pricingCompsAfterJudgment({
      selected: judged,
      vetted,
      verdicts,
      subject,
      minComps,
      exclusivePocket: args.exclusivePocket,
      ...(args.selection.ownPlatAgeRestrictedShare !== undefined
        ? { ownPlatAgeRestrictedShare: args.selection.ownPlatAgeRestrictedShare }
        : {}),
    })

  const priorExcludes: CompVerdict[] = []
  const rounds: ReviewRefillRound[] = []
  const trace: string[] = []
  let judged = [...candidates]
  let judgment: CompJudgment | null = null
  let gated: GatedPricingSet = { comps: judged, shortage: judged.length < minComps, droppedProduct: 0, trace: '' }
  let unstable: JudgeUnstableError | null = null

  for (let round = 0; ; round++) {
    unstable = null
    let keep: CmaComp[]
    let reason: ReviewRefillRound['reason']
    let droppedVerdicts: CompVerdict[]
    try {
      judgment = await args.judge(judged, round)
    } catch (err) {
      if (!(err instanceof JudgeUnstableError)) throw err
      unstable = err
      judgment = null
    }
    if (unstable) {
      // A split is not a second cut (Matt 2026-10-09). The sales the picker
      // kept still price. The product wall is the only thing that can shorten
      // the set, and it reads the homes, not the split.
      trace.push(
        'The comparability review split across its passes. The sales the picker kept still price this home.',
      )
      gated = gate(judged, judged, [])
      judgment = null
      unstable = null
      break
    } else {
      const keptKeys = new Set(judgment?.keptKeys ?? [])
      const vetted = judgment ? judged.filter((c) => keptKeys.has(c.listingKey)) : judged
      gated = gate(judged, vetted, judgment?.verdicts ?? [])
      // No review ran: nothing to refill from, the product-matched pool
      // prices and the contract forces broker review, as before.
      if (!judgment) break
      keep = gated.comps
      reason = 'excluded'
      const keepKeys = new Set(keysOf(keep))
      droppedVerdicts = judged
        .filter((c) => !keepKeys.has(c.listingKey))
        .map((c) => {
          const v = judgment!.verdicts.find((x) => x.listingKey === c.listingKey)
          return v && v.tier === 'exclude'
            ? v
            : {
                listingKey: c.listingKey,
                tier: 'exclude' as const,
                reason: v?.reason ?? 'Left out as a different product type.',
                basis: 'structure-type' as const,
              }
        })
    }
    if (!gated.shortage) break
    if (rung == null || bench.length === 0 || round >= maxRounds) break

    // THE REFILL: the shortfall, from the same rung, in its order. A bench sale
    // that is an earlier or later close of a home already seated is skipped
    // (one home, one sale, lib/pricing/same-address.ts).
    const need = minComps - keep.length
    const take: CmaComp[] = []
    while (take.length < need && bench.length > 0) {
      const next = bench.shift()!
      const together = [...keep, ...take, next]
      const same = dropPriorSalesOfSameHome(together)
      if (same.kept.length !== together.length) {
        trace.push(
          `${next.address} is a sale of a home already in the set, so the refill skipped it (one home, one sale).`,
        )
        continue
      }
      take.push(next)
    }
    if (take.length === 0) break
    const prepared = args.prepare ? await args.prepare(take) : take
    const droppedKeys = droppedVerdicts.map((v) => v.listingKey)
    const droppedComps = judged.filter((c) => droppedKeys.includes(c.listingKey))
    priorExcludes.push(...droppedVerdicts)
    rounds.push({ round: round + 1, reason, dropped: droppedKeys, refilled: keysOf(prepared) })
    trace.push(
      `Refill from the same rung: the product wall left out ${droppedComps.length} sale${droppedComps.length === 1 ? '' : 's'} (${addressesOf(droppedComps)}) from the set ${rung} reached, so the search took ${addressesOf(prepared)}, the next on ${rung} by that rung's own order. The area never widened past ${rung}.`,
    )
    candidates.push(...prepared)
    if (pricingSales) {
      for (const c of prepared) {
        const s = benchSales.get(c.listingKey)
        if (s) pricingSales.push(s)
      }
    }
    judged = [...keep, ...prepared]
  }

  if (rounds.length > 0 && (unstable || gated.shortage)) {
    trace.push(
      unstable
        ? `The refilled set was still a split vote and ${rung} has ${bench.length} qualifying sale${bench.length === 1 ? '' : 's'} left, so the build stops here.`
        : `The refilled set still held ${gated.comps.length} after the review and ${rung} has ${bench.length} qualifying sale${bench.length === 1 ? '' : 's'} left, so the build stops here as a comp shortage.`,
    )
  }

  const merged: CompJudgment | null = judgment
    ? {
        ...judgment,
        verdicts: [
          ...judgment.verdicts,
          ...priorExcludes.filter((p) => !judgment!.verdicts.some((v) => v.listingKey === p.listingKey)),
        ],
      }
    : null

  return {
    candidates,
    ...(pricingSales ? { pricingSales } : {}),
    judgment: merged,
    gated,
    unstable,
    refill: rounds.length > 0 && rung ? { rung, rounds, bench_left: bench.length } : null,
    trace,
  }
}
