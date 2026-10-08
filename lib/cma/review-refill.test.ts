/**
 * REFILL FROM THE SAME RUNG (Matt 2026-10-08).
 *
 * The build-level mechanics with the judge mocked: a drop from an exactly-five
 * set a widening rung reached refills from that rung's bench and prices on
 * five; an empty bench fails as a shortage; own ground never refills; a split
 * vote refills once and re-judges; the refill is bounded. The two builds are
 * held to the one helper by reading their source.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { CompJudgment } from '@/lib/cma/judge'
import type { CompVerdict } from '@/lib/cma/judge-consistency'
import { JudgeUnstableError, type JudgeDecisionRecord } from '@/lib/cma/judge-vote'
import { reviewWithRefill, REVIEW_REFILL_MAX_ROUNDS } from '@/lib/cma/review-refill'
import type { CmaComp, CmaSubject } from '@/lib/cma/types'
import type { SelectedPricingComp } from '@/lib/pricing/match'
import { PRICING_MIN_COMPS } from '@/lib/pricing/ladder'

const RUNG = 'adjacent-sub-3mo'

const subject: Pick<
  CmaSubject,
  'propertySubType' | 'yearBuilt' | 'newConstructionYn' | 'publicRemarks' | 'subdivision' | 'seniorCommunityYn'
> = {
  propertySubType: 'Single Family Residence',
  yearBuilt: 2001,
  newConstructionYn: null,
  publicRemarks: 'Single level home with a neighborhood view.',
  subdivision: 'Sample Park',
  seniorCommunityYn: null,
}

function comp(listingKey: string, over: Partial<CmaComp> = {}): CmaComp {
  return {
    listingKey,
    mlsNumber: null,
    address: `${listingKey} Sample St`,
    city: 'Bend',
    subdivision: 'Like Neighbors',
    latitude: null,
    longitude: null,
    beds: 3,
    baths: 2,
    sqft: 1800,
    lotAcres: 0.15,
    propertySubType: 'Single Family Residence',
    yearBuilt: 2003,
    photoUrl: null,
    publicRemarks: 'Single level home.',
    viewDescription: 'Neighborhood',
    taxAnnual: null,
    listPrice: 700000,
    closePrice: 700000,
    closeDate: '2026-01-15',
    daysToOffer: 12,
    domTotal: 20,
    selectionTier: RUNG,
    ...over,
  }
}

const FIVE = ['C1', 'C2', 'C3', 'C4', 'C5'].map((k) => comp(k))
const keys = (comps: readonly { listingKey: string }[]) => comps.map((c) => c.listingKey)

function judgmentOf(comps: readonly CmaComp[], exclude: string[]): CompJudgment {
  const verdicts: CompVerdict[] = comps.map((c) =>
    exclude.includes(c.listingKey)
      ? { listingKey: c.listingKey, tier: 'exclude', reason: 'A different tier.', basis: 'price-tier' }
      : { listingKey: c.listingKey, tier: 'strong', reason: 'Matches.' },
  )
  return {
    verdicts,
    keptKeys: verdicts.filter((v) => v.tier !== 'exclude').map((v) => v.listingKey),
    confidence: 'Moderate',
    narrative: 'The kept sales set the range.',
    costUsd: 0,
    model: 'test',
    usedLlm: true,
  }
}

function unstableOn(comps: readonly CmaComp[], split: string[]): JudgeUnstableError {
  const verdicts: CompVerdict[] = comps.map((c) => ({ listingKey: c.listingKey, tier: 'strong', reason: 'Matches.' }))
  const record: JudgeDecisionRecord = {
    judgeVersion: 'test',
    model: 'test',
    inputChecksum: 'x',
    runs: 3,
    minComps: PRICING_MIN_COMPS,
    votes: [],
    verdicts,
    keptKeys: keys(comps),
    unstable: true,
    unstableKeys: split,
    keepLow: comps.length - split.length,
    keepHigh: comps.length,
    narrative: '',
    confidence: 'Moderate',
    ppsfFloor: 300,
    ppsfCeiling: 500,
    exclusionRule: '',
    message: 'JUDGE_UNSTABLE. The build was not priced.',
  }
  return new JudgeUnstableError(record.message!, record, false)
}

/** A judge whose answer per round is scripted; records every set it saw. */
function scriptedJudge(script: Array<(comps: CmaComp[]) => CompJudgment | JudgeUnstableError | null>) {
  const seen: string[][] = []
  const judge = async (comps: CmaComp[], round: number) => {
    seen.push(keys(comps))
    const step = script[round]
    if (!step) throw new Error(`no script for round ${round}`)
    const out = step(comps)
    if (out instanceof JudgeUnstableError) throw out
    return out
  }
  return { judge, seen }
}

describe('refill from the same rung (Matt 2026-10-08)', () => {
  it('one drop from an exactly-five widening-rung set refills from the bench and prices on five', async () => {
    const bench = [comp('B1'), comp('B2')]
    const benchSales = bench.map((c) => ({ listingKey: c.listingKey }) as SelectedPricingComp)
    const sales = FIVE.map((c) => ({ listingKey: c.listingKey }) as SelectedPricingComp)
    const { judge, seen } = scriptedJudge([(c) => judgmentOf(c, ['C3']), (c) => judgmentOf(c, [])])
    const prepared: string[] = []
    const out = await reviewWithRefill({
      subject,
      selection: {
        comps: [...FIVE],
        pricingSales: sales,
        refill: { rung: RUNG, widening: true, comps: bench, pricingSales: benchSales },
      },
      judge,
      prepare: async (comps) => {
        prepared.push(...keys(comps))
        return comps
      },
      minComps: PRICING_MIN_COMPS,
    })
    expect(out.unstable).toBeNull()
    expect(out.gated.shortage).toBe(false)
    expect(keys(out.gated.comps)).toEqual(['C1', 'C2', 'C4', 'C5', 'B1'])
    // The review ran on the original set, then on the kept sales plus the
    // refilled one. B2 was never needed and never judged.
    expect(seen).toEqual([
      ['C1', 'C2', 'C3', 'C4', 'C5'],
      ['C1', 'C2', 'C4', 'C5', 'B1'],
    ])
    expect(prepared).toEqual(['B1'])
    // Every candidate the review saw, so the letter's "N of M kept" counts B1.
    expect(keys(out.candidates)).toEqual(['C1', 'C2', 'C3', 'C4', 'C5', 'B1'])
    expect(keys(out.pricingSales ?? [])).toEqual(['C1', 'C2', 'C3', 'C4', 'C5', 'B1'])
    // The dropped sale keeps its exclude verdict for the rejected list and the audit.
    expect(out.judgment?.verdicts.find((v) => v.listingKey === 'C3')?.tier).toBe('exclude')
    expect(out.judgment?.keptKeys).toEqual(['C1', 'C2', 'C4', 'C5', 'B1'])
    expect(out.refill).toEqual({
      rung: RUNG,
      rounds: [{ round: 1, reason: 'excluded', dropped: ['C3'], refilled: ['B1'] }],
      bench_left: 1,
    })
    expect(out.trace.join(' ')).toMatch(/Refill from the same rung/)
    expect(out.trace.join(' ')).toMatch(new RegExp(`never widened past ${RUNG}`))
  })

  it('an empty bench fails as a comp shortage, as before', async () => {
    const { judge, seen } = scriptedJudge([(c) => judgmentOf(c, ['C3'])])
    const out = await reviewWithRefill({
      subject,
      selection: { comps: [...FIVE], refill: { rung: RUNG, widening: true, comps: [] } },
      judge,
      minComps: PRICING_MIN_COMPS,
    })
    expect(seen).toHaveLength(1)
    expect(out.gated.shortage).toBe(true)
    expect(keys(out.gated.comps)).toEqual(['C1', 'C2', 'C4', 'C5'])
    expect(out.refill).toBeNull()
    expect(keys(out.candidates)).toEqual(keys(FIVE))
  })

  it('own ground never refills: it already seats up to seven', async () => {
    const { judge, seen } = scriptedJudge([(c) => judgmentOf(c, ['C3'])])
    const out = await reviewWithRefill({
      subject,
      selection: {
        comps: FIVE.map((c) => ({ ...c, selectionTier: 'subdivision-12mo' })),
        // Not a widening rung, so even a sale past the seats is not a bench.
        refill: { rung: 'subdivision-12mo', widening: false, comps: [comp('B1', { selectionTier: 'subdivision-12mo' })] },
      },
      judge,
      minComps: PRICING_MIN_COMPS,
    })
    expect(seen).toHaveLength(1)
    expect(out.gated.shortage).toBe(true)
    expect(out.refill).toBeNull()
    expect(keys(out.candidates)).toEqual(keys(FIVE))
  })

  it('a split vote on an exactly-five set refills once from the same rung and re-judges', async () => {
    const { judge, seen } = scriptedJudge([(c) => unstableOn(c, ['C5']), (c) => judgmentOf(c, [])])
    const out = await reviewWithRefill({
      subject,
      selection: { comps: [...FIVE], refill: { rung: RUNG, widening: true, comps: [comp('B1')] } },
      judge,
      minComps: PRICING_MIN_COMPS,
    })
    expect(out.unstable).toBeNull()
    expect(out.gated.shortage).toBe(false)
    expect(keys(out.gated.comps)).toEqual(['C1', 'C2', 'C3', 'C4', 'B1'])
    expect(seen).toEqual([
      ['C1', 'C2', 'C3', 'C4', 'C5'],
      ['C1', 'C2', 'C3', 'C4', 'B1'],
    ])
    expect(out.refill?.rounds).toEqual([{ round: 1, reason: 'split', dropped: ['C5'], refilled: ['B1'] }])
    const split = out.judgment?.verdicts.find((v) => v.listingKey === 'C5')
    expect(split?.tier).toBe('exclude')
    expect(split?.reason).toMatch(/split/)
  })

  it('a split that is still split after the refill ends the build unstable', async () => {
    const { judge, seen } = scriptedJudge([(c) => unstableOn(c, ['C5']), (c) => unstableOn(c, ['B1'])])
    const out = await reviewWithRefill({
      subject,
      selection: { comps: [...FIVE], refill: { rung: RUNG, widening: true, comps: [comp('B1')] } },
      judge,
      minComps: PRICING_MIN_COMPS,
    })
    expect(seen).toHaveLength(2)
    expect(out.unstable).toBeInstanceOf(JudgeUnstableError)
    expect(out.judgment).toBeNull()
    expect(out.refill?.bench_left).toBe(0)
  })

  it('the refilled sale dropped too with the rung exhausted is a comp shortage', async () => {
    const { judge, seen } = scriptedJudge([(c) => judgmentOf(c, ['C3']), (c) => judgmentOf(c, ['B1'])])
    const out = await reviewWithRefill({
      subject,
      selection: { comps: [...FIVE], refill: { rung: RUNG, widening: true, comps: [comp('B1')] } },
      judge,
      minComps: PRICING_MIN_COMPS,
    })
    expect(seen).toHaveLength(2)
    expect(out.gated.shortage).toBe(true)
    expect(keys(out.gated.comps)).toEqual(['C1', 'C2', 'C4', 'C5'])
    expect(out.refill?.bench_left).toBe(0)
    // Both drops carry an exclude verdict on the final judgment.
    expect(out.judgment?.verdicts.filter((v) => v.tier === 'exclude').map((v) => v.listingKey).sort()).toEqual(['B1', 'C3'])
  })

  it('is bounded to REVIEW_REFILL_MAX_ROUNDS rounds even while the bench still holds sales', async () => {
    const bench = ['B1', 'B2', 'B3', 'B4'].map((k) => comp(k))
    const { judge, seen } = scriptedJudge([
      (c) => judgmentOf(c, ['C3']),
      (c) => judgmentOf(c, ['B1']),
      (c) => judgmentOf(c, ['B2']),
      (c) => judgmentOf(c, []),
    ])
    const out = await reviewWithRefill({
      subject,
      selection: { comps: [...FIVE], refill: { rung: RUNG, widening: true, comps: bench } },
      judge,
      minComps: PRICING_MIN_COMPS,
    })
    expect(REVIEW_REFILL_MAX_ROUNDS).toBe(2)
    expect(seen).toHaveLength(1 + REVIEW_REFILL_MAX_ROUNDS)
    expect(out.gated.shortage).toBe(true)
    expect(out.refill?.rounds.map((r) => r.refilled)).toEqual([['B1'], ['B2']])
    expect(out.refill?.bench_left).toBe(2)
  })

  it('no review at all means no refill: the product-matched pool prices as before', async () => {
    const { judge } = scriptedJudge([() => null])
    const out = await reviewWithRefill({
      subject,
      selection: { comps: [...FIVE], refill: { rung: RUNG, widening: true, comps: [comp('B1')] } },
      judge,
      minComps: PRICING_MIN_COMPS,
    })
    expect(out.judgment).toBeNull()
    expect(out.gated.shortage).toBe(false)
    expect(keys(out.gated.comps)).toEqual(keys(FIVE))
    expect(out.refill).toBeNull()
  })

  it('both builds review through the one helper', () => {
    const cma = readFileSync(join(process.cwd(), 'lib/cma/build.ts'), 'utf8')
    const bpo = readFileSync(join(process.cwd(), 'lib/bpo/build.ts'), 'utf8')
    expect(cma).toMatch(/reviewWithRefill\(\{/)
    expect(bpo).toMatch(/reviewWithRefill\(\{/)
    expect(cma).not.toMatch(/pricingCompsAfterJudgment\(/)
    expect(bpo).not.toMatch(/pricingCompsAfterJudgment\(/)
    // The refilled candidates become the selection the letter describes.
    expect(cma).toMatch(/selection\.comps = review\.candidates/)
    expect(bpo).toMatch(/selection\.comps = review\.candidates/)
    // The dry run mirrors the bench for the fleet scorer.
    const dry = readFileSync(join(process.cwd(), 'scripts/cma-build-dryrun.ts'), 'utf8')
    expect(dry).toMatch(/refillBench: selection\.refill/)
  })
})
