/**
 * The review reads the picker's set and does not remove a sale from it
 * (Matt 2026-10-09). A price-tier exclude, an empty bench, own ground, and a
 * split vote all leave the five seated sales in the priced set. Nothing refills
 * off a review cut. The two builds are held to the one helper by reading their source.
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

describe('the review does not remove a sale the picker kept (Matt 2026-10-09)', () => {
  it('a price-tier exclude on an exactly-five set leaves all five and does not refill', async () => {
    const bench = [comp('B1'), comp('B2')]
    const benchSales = bench.map((c) => ({ listingKey: c.listingKey }) as SelectedPricingComp)
    const sales = FIVE.map((c) => ({ listingKey: c.listingKey }) as SelectedPricingComp)
    const { judge, seen } = scriptedJudge([(c) => judgmentOf(c, ['C3'])])
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
    expect(keys(out.gated.comps)).toEqual(keys(FIVE))
    expect(seen).toEqual([keys(FIVE)])
    expect(prepared).toEqual([])
    expect(keys(out.candidates)).toEqual(keys(FIVE))
    expect(keys(out.pricingSales ?? [])).toEqual(keys(FIVE))
    expect(out.judgment?.verdicts.find((v) => v.listingKey === 'C3')?.tier).toBe('exclude')
    expect(out.refill).toBeNull()
    expect(out.trace.join(' ')).not.toMatch(/Refill from the same rung/)
  })

  it('an empty bench does not turn a review exclude into a shortage', async () => {
    const { judge, seen } = scriptedJudge([(c) => judgmentOf(c, ['C3'])])
    const out = await reviewWithRefill({
      subject,
      selection: { comps: [...FIVE], refill: { rung: RUNG, widening: true, comps: [] } },
      judge,
      minComps: PRICING_MIN_COMPS,
    })
    expect(seen).toHaveLength(1)
    expect(out.gated.shortage).toBe(false)
    expect(keys(out.gated.comps)).toEqual(keys(FIVE))
    expect(out.refill).toBeNull()
  })

  it('own ground keeps the sale a review would have cut', async () => {
    const { judge, seen } = scriptedJudge([(c) => judgmentOf(c, ['C3'])])
    const out = await reviewWithRefill({
      subject,
      selection: {
        comps: FIVE.map((c) => ({ ...c, selectionTier: 'subdivision-12mo' })),
        refill: { rung: 'subdivision-12mo', widening: false, comps: [comp('B1', { selectionTier: 'subdivision-12mo' })] },
      },
      judge,
      minComps: PRICING_MIN_COMPS,
    })
    expect(seen).toHaveLength(1)
    expect(out.gated.shortage).toBe(false)
    expect(keys(out.gated.comps)).toEqual(keys(FIVE))
    expect(out.refill).toBeNull()
  })

  it('a split vote prices the five the picker kept and does not refill or fail the build', async () => {
    const { judge, seen } = scriptedJudge([(c) => unstableOn(c, ['C5'])])
    const out = await reviewWithRefill({
      subject,
      selection: { comps: [...FIVE], refill: { rung: RUNG, widening: true, comps: [comp('B1')] } },
      judge,
      minComps: PRICING_MIN_COMPS,
    })
    expect(out.unstable).toBeNull()
    expect(out.judgment).toBeNull()
    expect(out.gated.shortage).toBe(false)
    expect(keys(out.gated.comps)).toEqual(keys(FIVE))
    expect(seen).toEqual([keys(FIVE)])
    expect(out.refill).toBeNull()
    expect(out.trace.join(' ')).toMatch(/still price this home/)
  })

  it('a second split is never asked for, because the first split does not change the set', async () => {
    const { judge, seen } = scriptedJudge([(c) => unstableOn(c, ['C5']), (c) => unstableOn(c, ['B1'])])
    const out = await reviewWithRefill({
      subject,
      selection: { comps: [...FIVE], refill: { rung: RUNG, widening: true, comps: [comp('B1')] } },
      judge,
      minComps: PRICING_MIN_COMPS,
    })
    expect(seen).toHaveLength(1)
    expect(out.unstable).toBeNull()
    expect(keys(out.gated.comps)).toEqual(keys(FIVE))
    expect(out.refill).toBeNull()
  })

  it('does not take the next bench sale when the review would drop one and then the refill', async () => {
    const { judge, seen } = scriptedJudge([(c) => judgmentOf(c, ['C3']), (c) => judgmentOf(c, ['B1'])])
    const out = await reviewWithRefill({
      subject,
      selection: { comps: [...FIVE], refill: { rung: RUNG, widening: true, comps: [comp('B1')] } },
      judge,
      minComps: PRICING_MIN_COMPS,
    })
    expect(seen).toHaveLength(1)
    expect(out.gated.shortage).toBe(false)
    expect(keys(out.gated.comps)).toEqual(keys(FIVE))
    expect(out.refill).toBeNull()
  })

  it('does not keep reviewing while a bench still holds sales', async () => {
    const bench = ['B1', 'B2', 'B3', 'B4'].map((k) => comp(k))
    const { judge, seen } = scriptedJudge([(c) => judgmentOf(c, ['C3'])])
    const out = await reviewWithRefill({
      subject,
      selection: { comps: [...FIVE], refill: { rung: RUNG, widening: true, comps: bench } },
      judge,
      minComps: PRICING_MIN_COMPS,
    })
    expect(REVIEW_REFILL_MAX_ROUNDS).toBe(2)
    expect(seen).toHaveLength(1)
    expect(out.gated.shortage).toBe(false)
    expect(out.refill).toBeNull()
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
    expect(cma).toContain('The audit reads the sales the picker kept. It does not remove one.')
    expect(bpo).toContain('The audit reads the sales the picker kept. It does not remove one.')
    expect(cma).not.toContain('were removed and the analysis re-priced')
    expect(bpo).not.toContain('were removed, the opinion re-derived')
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
