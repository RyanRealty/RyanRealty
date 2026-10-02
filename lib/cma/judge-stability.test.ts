/**
 * Comp-review stability: grounded exclusions, a majority of three passes,
 * JUDGE_UNSTABLE when a split decides the minimum, and a checksum cache.
 * The model is a function passed in. Nothing here calls api.x.ai.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { groundVerdict, UNGROUNDED_KEEP_REASON } from '@/lib/cma/judge-ground'
import {
  JUDGE_RUNS,
  JUDGE_SEED,
  JUDGE_TEMPERATURE,
  JUDGE_UNSTABLE,
  JudgeUnstableError,
  judgeInputChecksum,
  canonicalJudgeInput,
} from '@/lib/cma/judge-vote'
import {
  buildJudgeUserPrompt,
  judgeComps,
  judgePromptChecksum,
  readJudgeCache,
  type JudgeModelCall,
} from '@/lib/cma/judge'
import type { CmaComp, CmaMarketContext, CmaSubject } from '@/lib/cma/types'
import type { CompVerdict } from '@/lib/cma/judge-consistency'

function subject(overrides: Partial<CmaSubject> = {}): CmaSubject {
  return {
    listingKey: 'SUBJ',
    mlsNumber: '100',
    streetAddress: '10 Sample St',
    city: 'Bend',
    state: 'OR',
    postalCode: '97701',
    subdivision: 'Sample Park',
    latitude: null,
    longitude: null,
    beds: 3,
    baths: 2,
    sqft: 1840,
    lotAcres: 0.14,
    propertySubType: 'Single Family Residence',
    yearBuilt: 2001,
    garageSpaces: 2,
    photoUrl: null,
    publicRemarks: 'Single level home with a neighborhood view.',
    viewDescription: 'Neighborhood',
    taxAnnual: null,
    standardStatus: 'Expired',
    lastListPrice: 500000,
    lastListDate: null,
    listingHistoryLine: null,
    ...overrides,
  }
}

function comp(overrides: Partial<CmaComp> = {}): CmaComp {
  return {
    listingKey: 'C1',
    mlsNumber: null,
    address: '20 Sample St',
    city: 'Bend',
    subdivision: 'Sample Park',
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
    selectionTier: 'subdivision-12mo',
    ...overrides,
  }
}

function verdict(partial: Partial<CompVerdict> & Pick<CompVerdict, 'listingKey' | 'tier'>): CompVerdict {
  return { reason: '', ...partial }
}

function judgment(verdicts: CompVerdict[], extra: Record<string, unknown> = {}) {
  return {
    ppsfFloor: 300,
    ppsfCeiling: 500,
    exclusionRule: 'Priced on the sales that match this home.',
    confidence: 'Moderate',
    narrative: 'Three sales set the range. The others were a different tier.',
    verdicts: verdicts.map((v) => ({
      listingKey: v.listingKey,
      tier: v.tier,
      reason: v.reason,
      basis: v.tier === 'exclude' ? (v.basis ?? 'other') : 'not-excluded',
    })),
    ...extra,
  }
}

const market: CmaMarketContext = {
  geoSlug: 'bend',
  geoLabel: 'Bend',
  periodStart: '2025-01-01',
  periodEnd: '2026-01-01',
  soldCount365: 100,
  medianSalePrice: 600000,
  medianDom: 20,
  medianPpsf: 380,
  saleToListRatio: 0.98,
  yoyMedianPriceDeltaPct: 2,
  activeCount: 40,
  pendingCount: 10,
  monthsOfSupply: 4,
  mosFormula: 'test',
  marketVerdict: 'balanced',
  methodologyVersion: 'test',
  computedAt: '2026-01-01',
  pulseUpdatedAt: null,
}

describe('exclusion grounding', () => {
  const sub = subject()

  it('ignores a 1600 sqft size floor when the living-area gap is small', () => {
    const sale = comp({ listingKey: 'small', sqft: 1447, closePrice: 548000 })
    const result = groundVerdict(
      sub,
      sale,
      verdict({
        listingKey: 'small',
        tier: 'exclude',
        basis: 'size',
        reason: "1447 sqft versus the subject's 1840 sqft, below the 1600 sqft size floor.",
      }),
      [sale],
    )
    expect(result.grounded).toBe(false)
    expect(result.rule).toBe('size-floor')
    expect(result.verdict.tier).toBe('weak')
    expect(result.verdict.reason).toBe(UNGROUNDED_KEEP_REASON)
  })

  it('ignores a $/sqft floor the sale is not outside', () => {
    const sale = comp({ listingKey: 'inside', sqft: 1800, closePrice: 1800 * 430 })
    const peer = comp({ listingKey: 'peer', sqft: 1800, closePrice: 1800 * 300 })
    const result = groundVerdict(
      sub,
      sale,
      verdict({
        listingKey: 'inside',
        tier: 'exclude',
        basis: 'price-tier',
        reason: 'Sold at $430/sqft, below the $419/sqft floor.',
      }),
      [sale, peer],
    )
    expect(result.rule).toBe('price-not-outside')
    expect(result.verdict.tier).toBe('weak')
  })

  it('ignores a $/sqft floor drawn through the candidate cluster', () => {
    const sale = comp({ listingKey: 'mid', sqft: 1817, closePrice: 1817 * 371 })
    const peers = [
      sale,
      comp({ listingKey: 'a', sqft: 1423, closePrice: 1423 * 429 }),
      comp({ listingKey: 'b', sqft: 1663, closePrice: 1663 * 419 }),
      comp({ listingKey: 'c', sqft: 1700, closePrice: 1700 * 339 }),
    ]
    const result = groundVerdict(
      subject({ sqft: 1607, yearBuilt: 1994 }),
      sale,
      verdict({
        listingKey: 'mid',
        tier: 'exclude',
        basis: 'price-tier',
        reason: '$371/sqft below the $419 floor. Sold at $371/sqft, outside the $419 to $429/sqft range.',
      }),
      peers,
    )
    expect(result.rule).toBe('price-cluster')
    expect(result.verdict.tier).toBe('weak')
  })

  it('keeps a real price-tier outlier', () => {
    const sale = comp({ listingKey: 'cheap', sqft: 1800, closePrice: 1800 * 250 })
    const peers = [
      sale,
      comp({ listingKey: 'a', sqft: 1800, closePrice: 1800 * 400 }),
      comp({ listingKey: 'b', sqft: 1800, closePrice: 1800 * 420 }),
    ]
    const result = groundVerdict(
      sub,
      sale,
      verdict({
        listingKey: 'cheap',
        tier: 'exclude',
        basis: 'price-tier',
        reason: 'Sold at $250/sqft, below the $350/sqft floor.',
      }),
      peers,
    )
    expect(result.grounded).toBe(true)
    expect(result.verdict.tier).toBe('exclude')
    expect(result.rule).toBe('price-outlier')
  })

  it('does not drop a sale inside the picker living-area band', () => {
    // 30% living-area gap: inside the picker's about-35% band, past the old 20% wall.
    const sale = comp({ listingKey: 'band', sqft: Math.round(1840 * 1.3), closePrice: 500000 })
    const result = groundVerdict(
      sub,
      sale,
      verdict({
        listingKey: 'band',
        tier: 'exclude',
        basis: 'size',
        reason: `${sale.sqft} sqft versus the subject's 1840 sqft.`,
      }),
      [sale],
    )
    expect(result.verdict.tier).not.toBe('exclude')
    expect(result.grounded).toBe(false)
  })

  it('does not drop a picker-kept sale on a 15-year vintage wall', () => {
    const sale = comp({ listingKey: 'old', yearBuilt: 1980 })
    const result = groundVerdict(
      subject({ yearBuilt: 2001 }),
      sale,
      verdict({
        listingKey: 'old',
        tier: 'exclude',
        basis: 'vintage',
        reason: 'Built in 1980, twenty-one years older than the subject built in 2001.',
      }),
      [sale],
    )
    expect(result.verdict.tier).not.toBe('exclude')
    expect(result.rule).toBe('vintage')
  })

  it('keeps a real large size gap, including one stated with a round floor', () => {
    const sale = comp({ listingKey: 'half', sqft: 1200, closePrice: 400000 })
    const result = groundVerdict(
      subject({ sqft: 2400 }),
      sale,
      verdict({
        listingKey: 'half',
        tier: 'exclude',
        basis: 'size',
        reason: "1200 sqft versus the subject's 2400 sqft, below a 1600 sqft size floor.",
      }),
      [sale],
    )
    expect(result.grounded).toBe(true)
    expect(result.verdict.tier).toBe('exclude')
  })

  it('keeps a duplex the remarks actually name', () => {
    const sale = comp({
      listingKey: 'dup',
      publicRemarks: 'This duplex has a shared wall and two kitchens.',
    })
    const result = groundVerdict(
      sub,
      sale,
      verdict({
        listingKey: 'dup',
        tier: 'exclude',
        basis: 'structure-type',
        reason: 'Remarks describe a duplex with a shared wall.',
      }),
      [sale],
    )
    expect(result.grounded).toBe(true)
    expect(result.verdict.tier).toBe('exclude')
  })

  it('keeps a real lot gap and a room gap the one-room rule refuses', () => {
    const lot = comp({ listingKey: 'lot', lotAcres: 0.34, publicRemarks: '4 car garage with RV space.' })
    const lotResult = groundVerdict(
      sub,
      lot,
      verdict({
        listingKey: 'lot',
        tier: 'exclude',
        basis: 'lot',
        reason: '0.34 acre lot and 4-car garage versus 0.14 acre and 2-car.',
      }),
      [lot],
    )
    expect(lotResult.grounded).toBe(true)

    const beds = comp({
      listingKey: 'beds',
      beds: 1,
      subdivision: 'Other Park',
      ownPlat: false,
      address: '99 Other St',
    })
    const bedResult = groundVerdict(
      sub,
      beds,
      verdict({
        listingKey: 'beds',
        tier: 'exclude',
        basis: 'other',
        reason: '1 bed versus the subject 3 bed.',
      }),
      [beds],
    )
    expect(bedResult.grounded).toBe(true)
    expect(bedResult.rule).toBe('rooms')
    expect(bedResult.verdict.tier).toBe('exclude')
  })

  it('does not ground a one-bed own-plat gap the one-room rule allows', () => {
    const beds = comp({ listingKey: 'beds', beds: 2, ownPlat: true })
    const bedResult = groundVerdict(
      sub,
      beds,
      verdict({
        listingKey: 'beds',
        tier: 'exclude',
        basis: 'other',
        reason: '2 bed versus the subject 3 bed.',
      }),
      [beds],
    )
    expect(bedResult.verdict.tier).not.toBe('exclude')
    expect(bedResult.grounded).toBe(false)
  })

  it('drops a structure-type claim the remarks do not support', () => {
    const sale = comp({ listingKey: 'sfr', publicRemarks: 'Single level home with a yard.' })
    const result = groundVerdict(
      sub,
      sale,
      verdict({
        listingKey: 'sfr',
        tier: 'exclude',
        basis: 'structure-type',
        reason: 'This is a duplex.',
      }),
      [sale],
    )
    expect(result.grounded).toBe(false)
    expect(result.verdict.tier).toBe('weak')
  })
})

describe('judgeComps stability', () => {
  const sub = subject()
  const comps = [
    comp({ listingKey: 'A', sqft: 1800, closePrice: 700000 }),
    comp({ listingKey: 'B', sqft: 1760, closePrice: 690000 }),
    comp({ listingKey: 'C', sqft: 1820, closePrice: 710000 }),
    comp({ listingKey: 'border', sqft: 1700, closePrice: 660000, lotAcres: 0.16 }),
  ]

  function varying(): { call: JudgeModelCall; count: () => number } {
    let n = 0
    const call: JudgeModelCall = async () => {
      n += 1
      const borderExclude = n % 3 !== 0
      return {
        payload: judgment(
          comps.map((c) =>
            verdict({
              listingKey: c.listingKey,
              tier: c.listingKey === 'border' && borderExclude ? 'exclude' : 'strong',
              basis: c.listingKey === 'border' && borderExclude ? 'lot' : undefined,
              reason:
                c.listingKey === 'border' && borderExclude
                  ? '0.16 acre lot versus the subject 0.14 acre lot.'
                  : 'Same size and vintage.',
            }),
          ),
        ),
        raw: '{}',
        costUsd: 0.01,
      }
    }
    return { call, count: () => n }
  }

  it('returns the same kept set on a repeated build, and the second build hits the cache', async () => {
    const mock = varying()
    const first = await judgeComps(sub, comps, market, { callModel: mock.call, minComps: 3 })
    expect(first).not.toBeNull()
    expect(mock.count()).toBe(JUDGE_RUNS)
    // 0.16 vs 0.14 is not a real lot gap, so the exclude votes are ignored and the comp stays.
    expect(first!.keptKeys.sort()).toEqual(['A', 'B', 'C', 'border'])
    expect(first!.cacheHit).toBe(false)
    expect(first!.decision?.votes).toHaveLength(JUDGE_RUNS)
    expect(first!.inputChecksum).toBe(judgePromptChecksum(buildJudgeUserPrompt(sub, comps, market)))

    const second = await judgeComps(sub, comps, market, {
      callModel: mock.call,
      minComps: 3,
      priorCache: first!.decision,
    })
    expect(second!.keptKeys).toEqual(first!.keptKeys)
    expect(second!.cacheHit).toBe(true)
    expect(mock.count()).toBe(JUDGE_RUNS)

    const third = await judgeComps(sub, comps, market, {
      callModel: async () => {
        throw new Error('cache miss would call the model')
      },
      minComps: 3,
      priorCache: first!.decision,
    })
    expect(third!.keptKeys).toEqual(first!.keptKeys)
    expect(third!.inputChecksum).toBe(first!.inputChecksum)
  })

  it('misses the cache when the model input changes', async () => {
    const mock = varying()
    const first = await judgeComps(sub, comps, market, { callModel: mock.call, minComps: 3 })
    const changed = comps.map((c) => (c.listingKey === 'A' ? { ...c, sqft: 1500 } : c))
    const again = await judgeComps(sub, changed, market, {
      callModel: mock.call,
      minComps: 3,
      priorCache: first!.decision,
    })
    expect(again!.cacheHit).toBe(false)
    expect(again!.inputChecksum).not.toBe(first!.inputChecksum)
    expect(mock.count()).toBe(JUDGE_RUNS * 2)
  })

  it('ignores an invented 1600 sqft floor across every pass', async () => {
    const small = [1447, 1328, 1304, 1356].map((sqft, i) =>
      comp({ listingKey: `S${i}`, sqft, closePrice: sqft * 390 }),
    )
    const call: JudgeModelCall = async () => ({
      payload: judgment(
        small.map((c) =>
          verdict({
            listingKey: c.listingKey,
            tier: 'exclude',
            basis: 'size',
            reason: `${c.sqft} sqft versus the subject's 1840 sqft, below the 1600 sqft size floor.`,
          }),
        ),
      ),
      raw: '{}',
      costUsd: 0,
    })
    const result = await judgeComps(sub, small, market, { callModel: call, minComps: 3 })
    expect(result!.keptKeys.sort()).toEqual(['S0', 'S1', 'S2', 'S3'])
    expect(result!.verdicts.every((v) => v.tier !== 'exclude')).toBe(true)
  })

  it('raises JUDGE_UNSTABLE when the split decides the minimum, and the cache repeats it', async () => {
    const pool = [
      comp({ listingKey: 'K1' }),
      comp({ listingKey: 'K2', address: '22 Sample St' }),
      comp({
        listingKey: 'swing',
        address: '30 Sample St',
        lotAcres: 0.34,
        publicRemarks: '4 car garage.',
      }),
    ]
    let n = 0
    const call: JudgeModelCall = async () => {
      n += 1
      const excludeSwing = n % 3 !== 1
      return {
        payload: judgment(
          pool.map((c) =>
            verdict({
              listingKey: c.listingKey,
              tier: c.listingKey === 'swing' && excludeSwing ? 'exclude' : c.listingKey === 'swing' ? 'weak' : 'strong',
              basis: c.listingKey === 'swing' && excludeSwing ? 'lot' : undefined,
              reason:
                c.listingKey === 'swing' && excludeSwing
                  ? '0.34 acre lot and 4-car garage versus 0.14 acre and 2-car.'
                  : 'Comparable sale.',
            }),
          ),
        ),
        raw: '{}',
        costUsd: 0,
      }
    }
    await expect(judgeComps(sub, pool, market, { callModel: call, minComps: 3 })).rejects.toBeInstanceOf(JudgeUnstableError)
    expect(n).toBe(JUDGE_RUNS)
    try {
      await judgeComps(sub, pool, market, { callModel: call, minComps: 3 })
      expect.unreachable()
    } catch (err) {
      expect(err).toBeInstanceOf(JudgeUnstableError)
      const unstable = err as JudgeUnstableError
      expect(unstable.message.startsWith(JUDGE_UNSTABLE)).toBe(true)
      expect(unstable.record.votes).toHaveLength(JUDGE_RUNS)
      expect(unstable.record.unstable).toBe(true)
      expect(unstable.record.keepLow).toBe(2)
      expect(unstable.record.keepHigh).toBe(3)
      expect(unstable.cacheHit).toBe(false)
      const stored = { judge_cache: unstable.record }
      expect(readJudgeCache(stored)?.inputChecksum).toBe(unstable.record.inputChecksum)
      await expect(
        judgeComps(sub, pool, market, {
          callModel: async () => {
            throw new Error('should not call')
          },
          minComps: 3,
          priorCache: unstable.record,
        }),
      ).rejects.toMatchObject({ cacheHit: true, code: JUDGE_UNSTABLE })
    }
  })

  it('a cache hit throws on the replayed aggregate, not only on the stored flag (review of da8dce6)', async () => {
    // A record an older aggregator wrote as stable, whose votes the current one
    // reads as a split that decides the minimum. The replay must fail the build
    // the way a fresh run of the same votes would.
    const pool = [
      comp({ listingKey: 'K1' }),
      comp({ listingKey: 'K2', address: '22 Sample St' }),
      comp({ listingKey: 'swing', address: '30 Sample St', lotAcres: 0.34, publicRemarks: '4 car garage.' }),
    ]
    let n = 0
    const call: JudgeModelCall = async () => {
      n += 1
      const excludeSwing = n % 3 !== 1
      return {
        payload: judgment(
          pool.map((c) =>
            verdict({
              listingKey: c.listingKey,
              tier: c.listingKey === 'swing' && excludeSwing ? 'exclude' : c.listingKey === 'swing' ? 'weak' : 'strong',
              basis: c.listingKey === 'swing' && excludeSwing ? 'lot' : undefined,
              reason:
                c.listingKey === 'swing' && excludeSwing
                  ? '0.34 acre lot and 4-car garage versus 0.14 acre and 2-car.'
                  : 'Comparable sale.',
            }),
          ),
        ),
        raw: '{}',
        costUsd: 0,
      }
    }
    let record: JudgeUnstableError['record'] | null = null
    try {
      await judgeComps(sub, pool, market, { callModel: call, minComps: 3 })
    } catch (err) {
      record = (err as JudgeUnstableError).record
    }
    expect(record?.unstable).toBe(true)
    const writtenAsStable = { ...record!, unstable: false, message: null }
    await expect(
      judgeComps(sub, pool, market, {
        callModel: async () => {
          throw new Error('should not call')
        },
        minComps: 3,
        priorCache: writtenAsStable,
      }),
    ).rejects.toMatchObject({ cacheHit: true, code: JUDGE_UNSTABLE })
  })

  it('fails open when the model call errors', async () => {
    const result = await judgeComps(sub, comps, market, {
      callModel: async () => {
        throw new Error('transport down')
      },
    })
    expect(result).toBeNull()
  })

  it('checksum covers version, model, seed, and the brief', () => {
    const a = judgeInputChecksum(
      canonicalJudgeInput({
        judgeVersion: 'judge-stability-1',
        model: 'grok-4.6',
        seed: JUDGE_SEED,
        temperature: JUDGE_TEMPERATURE,
        reasoningEffort: 'low',
        schemaName: 'record_comp_judgment',
        schemaJson: '{}',
        system: 'sys',
        user: 'user',
      }),
    )
    const b = judgeInputChecksum(
      canonicalJudgeInput({
        judgeVersion: 'judge-stability-1',
        model: 'grok-4.6',
        seed: JUDGE_SEED,
        temperature: JUDGE_TEMPERATURE,
        reasoningEffort: 'low',
        schemaName: 'record_comp_judgment',
        schemaJson: '{}',
        system: 'sys',
        user: 'user changed',
      }),
    )
    expect(a).not.toBe(b)
    expect(a).toMatch(/^[a-f0-9]{64}$/)
  })
})

describe('the build failure path names JUDGE_UNSTABLE', () => {
  const src = readFileSync(join(process.cwd(), 'lib/cma/build.ts'), 'utf8')

  it('records the unstable decision on the existing build_summary and fails the build', () => {
    expect(src).toMatch(/JudgeUnstableError/)
    expect(src).toMatch(/JUDGE_UNSTABLE|err\.message/)
    expect(src).toMatch(/judge_cache: record/)
    expect(src).toMatch(/recordBuildFailure\(slug, message/)
    expect(src).not.toMatch(/html_content: null/)
  })
})
