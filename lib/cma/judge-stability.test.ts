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
import { MIN_COMPS } from '@/lib/cma/comps'
import { pricingCompsAfterJudgment } from '@/lib/cma/judgment-prune'
import { PRICING_MIN_COMPS, PRICING_WALK_CAP } from '@/lib/pricing/ladder'

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

  it('does not drop a sale inside the picker living-area band, and the band is 25% on the line (Matt 2026-10-08)', () => {
    const sizeExclusion = (sale: CmaComp) =>
      groundVerdict(
        sub,
        sale,
        verdict({
          listingKey: sale.listingKey,
          tier: 'exclude',
          basis: 'size',
          reason: `${sale.sqft} sqft versus the subject's 1840 sqft.`,
        }),
        [sale],
      )
    // 20% living-area gap: inside the picker's 25% band, past the old 20% wall.
    const inside = sizeExclusion(comp({ listingKey: 'band', sqft: Math.round(1840 * 1.2), closePrice: 500000 }))
    expect(inside.verdict.tier).not.toBe('exclude')
    expect(inside.grounded).toBe(false)
    // Exactly 25% (1,840 x 1.25 = 2,300) set the price, so the review may not drop it.
    const onLine = sizeExclusion(comp({ listingKey: 'line', sqft: 2300, closePrice: 500000 }))
    expect(onLine.verdict.tier).not.toBe('exclude')
    expect(onLine.grounded).toBe(false)
    // 30%: past the one size cutoff, the picker's, so a size exclusion is real.
    const past = sizeExclusion(comp({ listingKey: 'past', sqft: Math.round(1840 * 1.3), closePrice: 500000 }))
    expect(past.grounded).toBe(true)
    expect(past.rule).toBe('size-gap')
    expect(past.verdict.tier).toBe('exclude')
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

  it('keeps a real lot gap at an acre and a room gap the one-room rule refuses', () => {
    // An acre or more on one side is the comp search's own lot wall, so the
    // old lot test still holds there (Matt 2026-10-08). Under an acre on both
    // sides it no longer does: see "lot size under an acre" below.
    const lot = comp({ listingKey: 'lot', lotAcres: 1.2, publicRemarks: '4 car garage with RV space.' })
    const lotResult = groundVerdict(
      sub,
      lot,
      verdict({
        listingKey: 'lot',
        tier: 'exclude',
        basis: 'lot',
        reason: '1.2 acre lot and 4-car garage versus 0.14 acre and 2-car.',
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

describe('structure grounding reads the search readers (Matt 2026-10-08, "ADU sale skips")', () => {
  // 644 Norton against 1648 Pheasant: both ladders seated Norton while the
  // review's own word list backed a structure-type drop 3 of 3 passes. The
  // grounding now asks the same readers the search asks, so the two agree.
  const NORTON =
    'Excellent Midtown Bend multi-unit property featuring a permitted ADU, offering flexibility for a variety of living or investment possibilities. Both units feature attractive finishes and functional living spaces.'
  const PHEASANT =
    "Single level house in Midtown Bend on a huge lot with room to dream. Outside, you've got space to build an ADU, a 2 car garage, RV parking. Whether you're buying your first home, downsizing, or eyeing ADU rental income, this is a lot of house and land."
  const norton = comp({ listingKey: 'norton', publicRemarks: NORTON })
  const structure = verdict({
    listingKey: 'norton',
    tier: 'exclude',
    basis: 'structure-type',
    reason: 'Multi-unit property with a permitted ADU, not a single-family home like the subject.',
  })

  it('backs a structure exclusion of an ADU sale for a subject whose remarks state none', () => {
    const result = groundVerdict(subject({ publicRemarks: PHEASANT }), norton, structure, [norton])
    expect(result.grounded).toBe(true)
    expect(result.rule).toBe('structure')
    expect(result.verdict.tier).toBe('exclude')
  })

  it('overrides the same exclusion for a subject with its own ADU: the readers call the sale a plain detached home', () => {
    const result = groundVerdict(
      subject({ publicRemarks: 'Craftsman with a permitted detached ADU over the garage.' }),
      norton,
      structure,
      [norton],
    )
    expect(result.grounded).toBe(false)
    expect(result.rule).toBe('structure')
    expect(result.verdict.tier).toBe('weak')
    expect(result.verdict.reason).toBe(UNGROUNDED_KEEP_REASON)
  })

  it('backs an ADU exclusion given on basis other, as the search would skip the sale', () => {
    const result = groundVerdict(
      subject({ publicRemarks: PHEASANT }),
      norton,
      verdict({ listingKey: 'norton', tier: 'exclude', basis: 'other', reason: 'Carries a permitted ADU the subject lacks.' }),
      [norton],
    )
    expect(result.grounded).toBe(true)
    expect(result.verdict.tier).toBe('exclude')
  })

  it('a product claim on basis other that the readers do not back is not kept as a qualitative exclusion', () => {
    const plain = comp({ listingKey: 'plain', publicRemarks: 'Single level home with a fenced yard.' })
    const result = groundVerdict(
      subject({ publicRemarks: PHEASANT }),
      plain,
      verdict({ listingKey: 'plain', tier: 'exclude', basis: 'other', reason: 'This is a duplex, a different product.' }),
      [plain],
    )
    expect(result.grounded).toBe(false)
    expect(result.rule).toBe('structure')
    expect(result.verdict.tier).toBe('weak')
  })

  it('still backs a duplex by its remarks, and leaves a casita home detached for a subject with a casita', () => {
    const duplex = comp({ listingKey: 'dup', publicRemarks: 'Updated duplex with an upper unit and a lower unit.' })
    expect(
      groundVerdict(
        subject(),
        duplex,
        verdict({ listingKey: 'dup', tier: 'exclude', basis: 'structure-type', reason: 'A duplex.' }),
        [duplex],
      ).verdict.tier,
    ).toBe('exclude')
    const casita = comp({ listingKey: 'casita', publicRemarks: 'Main home with a detached casita; both units freshly painted.' })
    expect(
      groundVerdict(
        subject({ publicRemarks: 'Adobe home with a guest casita.' }),
        casita,
        verdict({ listingKey: 'casita', tier: 'exclude', basis: 'structure-type', reason: 'Both units: a multi-unit.' }),
        [casita],
      ).verdict.tier,
    ).toBe('weak')
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
    // Every gap inside the 25% band (1,840 x 0.75 = 1,380), so the 1600 floor is invented.
    const small = [1447, 1428, 1404, 1456].map((sqft, i) =>
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
        lotAcres: 1.2,
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
                  ? '1.2 acre lot and 4-car garage versus 0.14 acre and 2-car.'
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
      comp({ listingKey: 'swing', address: '30 Sample St', lotAcres: 1.2, publicRemarks: '4 car garage.' }),
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
                  ? '1.2 acre lot and 4-car garage versus 0.14 acre and 2-car.'
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

describe('the comparability review at the production floor (five price-setting sales, Matt 2026-10-07)', () => {
  // The tests above pass minComps 3. Production passes MIN_COMPS, which is
  // PRICING_MIN_COMPS, and the resolver's band cut stops at the same floor
  // (RESOLVE_KEEP_FLOOR in lib/cma/judge.ts). These run the real constant on a
  // five-candidate pool, the smallest pool that can price.
  const sub = subject()
  const five = Array.from({ length: PRICING_MIN_COMPS }, (_, i) =>
    // Off the subject's street, so no sale is a same-street peer the resolver protects.
    comp({ listingKey: `P${i}`, address: `${40 + i} Elm Ave`, sqft: 1800, closePrice: 1800 * 400 }),
  )
  const swingLot = { lotAcres: 1.2, publicRemarks: '4 car garage.' }
  const LOT_REASON = '1.2 acre lot and 4-car garage versus 0.14 acre and 2-car.'

  /** Three passes; `excludeSwing(n)` says whether pass n excludes the last sale on the lot. */
  function passes(pool: CmaComp[], excludeSwing: (n: number) => boolean, payloadExtra: Record<string, unknown> = {}) {
    let n = 0
    const swing = pool[pool.length - 1]!.listingKey
    const call: JudgeModelCall = async () => {
      n += 1
      const out = excludeSwing(n)
      return {
        payload: judgment(
          pool.map((c) =>
            verdict({
              listingKey: c.listingKey,
              tier: c.listingKey === swing && out ? 'exclude' : 'strong',
              basis: c.listingKey === swing && out ? 'lot' : undefined,
              reason: c.listingKey === swing && out ? LOT_REASON : 'Comparable sale.',
            }),
          ),
          payloadExtra,
        ),
        raw: '{}',
        costUsd: 0,
      }
    }
    return { call, count: () => n }
  }

  it('the production floor is the five the pricer and the build read', () => {
    expect(PRICING_MIN_COMPS).toBe(MIN_COMPS)
    expect(five).toHaveLength(MIN_COMPS)
  })

  it('a split vote on one exclusion is JUDGE_UNSTABLE: four sure keeps, five if the split is kept', async () => {
    const pool = [...five.slice(0, -1), { ...five[PRICING_MIN_COMPS - 1]!, ...swingLot }]
    // Two of three passes exclude the lot outlier: the majority excludes it,
    // so the kept set is four, but a keep on the split reaches five.
    const majorityOut = passes(pool, (n) => n % 3 !== 1)
    await expect(judgeComps(sub, pool, market, { callModel: majorityOut.call })).rejects.toBeInstanceOf(JudgeUnstableError)
    try {
      await judgeComps(sub, pool, market, { callModel: passes(pool, (n) => n % 3 !== 1).call, minComps: MIN_COMPS })
      expect.unreachable()
    } catch (err) {
      const unstable = err as JudgeUnstableError
      expect(unstable.code).toBe(JUDGE_UNSTABLE)
      expect(unstable.record.minComps).toBe(PRICING_MIN_COMPS)
      expect(unstable.record.keepLow).toBe(PRICING_MIN_COMPS - 1)
      expect(unstable.record.keepHigh).toBe(PRICING_MIN_COMPS)
      expect(unstable.message).toContain(`this home needs ${PRICING_MIN_COMPS}`)
    }
    // One pass of three excludes it: the majority keeps it, and the split
    // still decides the floor, so it is unstable the other way round too.
    const majorityIn = passes(pool, (n) => n % 3 === 1)
    await expect(judgeComps(sub, pool, market, { callModel: majorityIn.call, minComps: MIN_COMPS })).rejects.toMatchObject({
      code: JUDGE_UNSTABLE,
    })
    // At the old floor of three the same votes priced: the floor is what moved.
    const atThree = await judgeComps(sub, pool, market, { callModel: passes(pool, (n) => n % 3 !== 1).call, minComps: 3 })
    expect(atThree?.keptKeys).toHaveLength(PRICING_MIN_COMPS - 1)
  })

  it('a unanimous keep of five prices all five, and the resolver does not prune under the floor', async () => {
    // Every pass keeps every sale, one of them at $520/sqft against a declared
    // $300 to $500 band. The resolver may not cut a kept set under five.
    const pool = [...five.slice(0, -1), { ...five[PRICING_MIN_COMPS - 1]!, closePrice: 1800 * 520 }]
    const keepAll = passes(pool, () => false)
    const result = await judgeComps(sub, pool, market, { callModel: keepAll.call, minComps: MIN_COMPS })
    expect(result).not.toBeNull()
    expect(result!.keptKeys.sort()).toEqual(pool.map((c) => c.listingKey).sort())
    expect(result!.decision?.unstable).toBe(false)
    const gated = pricingCompsAfterJudgment({
      selected: pool,
      vetted: pool.filter((c) => result!.keptKeys.includes(c.listingKey)),
      verdicts: result!.verdicts,
      subject: { propertySubType: sub.propertySubType, yearBuilt: sub.yearBuilt, publicRemarks: sub.publicRemarks },
      minComps: MIN_COMPS,
    })
    expect(gated.shortage).toBe(false)
    expect(gated.comps).toHaveLength(PRICING_MIN_COMPS)
  })

  it('an exclusion every pass agrees on is a comp shortage at five, not an unstable vote and not a price', async () => {
    const pool = [...five.slice(0, -1), { ...five[PRICING_MIN_COMPS - 1]!, ...swingLot }]
    const allOut = passes(pool, () => true)
    const result = await judgeComps(sub, pool, market, { callModel: allOut.call, minComps: MIN_COMPS })
    expect(result).not.toBeNull()
    expect(result!.decision?.unstable).toBe(false)
    expect(result!.keptKeys).toHaveLength(PRICING_MIN_COMPS - 1)
    const gated = pricingCompsAfterJudgment({
      selected: pool,
      vetted: pool.filter((c) => result!.keptKeys.includes(c.listingKey)),
      verdicts: result!.verdicts,
      subject: { propertySubType: sub.propertySubType, yearBuilt: sub.yearBuilt, publicRemarks: sub.publicRemarks },
      minComps: MIN_COMPS,
    })
    expect(gated.shortage).toBe(true)
    expect(gated.comps).toHaveLength(PRICING_MIN_COMPS - 1)
    expect(gated.trace).toContain(`under the ${PRICING_MIN_COMPS}-sale minimum`)
  })

  it('a majority exclude that stays under five even if the split is kept is a comp shortage, not unstable', async () => {
    // Two lot outliers: every pass excludes the first, two of three exclude the
    // second. Sure keeps three, four if the split is kept: under five both
    // ways, so the split does not decide the floor.
    const pool = [
      ...five.slice(0, -2),
      { ...five[PRICING_MIN_COMPS - 2]!, ...swingLot },
      { ...five[PRICING_MIN_COMPS - 1]!, ...swingLot },
    ]
    const sure = pool[PRICING_MIN_COMPS - 2]!.listingKey
    const split = pool[PRICING_MIN_COMPS - 1]!.listingKey
    let n = 0
    const call: JudgeModelCall = async () => {
      n += 1
      return {
        payload: judgment(
          pool.map((c) => {
            const out = c.listingKey === sure || (c.listingKey === split && n % 3 !== 1)
            return verdict({
              listingKey: c.listingKey,
              tier: out ? 'exclude' : 'strong',
              basis: out ? 'lot' : undefined,
              reason: out ? LOT_REASON : 'Comparable sale.',
            })
          }),
        ),
        raw: '{}',
        costUsd: 0,
      }
    }
    const result = await judgeComps(sub, pool, market, { callModel: call, minComps: MIN_COMPS })
    expect(result).not.toBeNull()
    expect(result!.decision?.unstable).toBe(false)
    expect(result!.decision?.keepLow).toBe(PRICING_MIN_COMPS - 2)
    expect(result!.decision?.keepHigh).toBe(PRICING_MIN_COMPS - 1)
    expect(result!.keptKeys).toHaveLength(PRICING_MIN_COMPS - 2)
    const gated = pricingCompsAfterJudgment({
      selected: pool,
      vetted: pool.filter((c) => result!.keptKeys.includes(c.listingKey)),
      verdicts: result!.verdicts,
      subject: { propertySubType: sub.propertySubType, yearBuilt: sub.yearBuilt, publicRemarks: sub.publicRemarks },
      minComps: MIN_COMPS,
    })
    expect(gated.shortage).toBe(true)
  })
})

describe('the review on a walk-to-7 set (walk to 7, price on 5+, Matt 2026-10-07)', () => {
  // The walk now hands the review up to PRICING_WALK_CAP candidates, so it
  // can drop one or two and still price on the five-sale floor. Same real
  // floor (MIN_COMPS), same lot outlier shape as the floor tests above.
  const sub = subject()
  const seven = Array.from({ length: PRICING_WALK_CAP }, (_, i) =>
    comp({ listingKey: `W${i}`, address: `${60 + i} Elm Ave`, sqft: 1800, closePrice: 1800 * 400 }),
  )
  const outlierLot = { lotAcres: 1.2, publicRemarks: '4 car garage.' }
  const LOT_REASON = '1.2 acre lot and 4-car garage versus 0.14 acre and 2-car.'

  /** Three passes. `out(key, n)` says whether pass n excludes that sale on the lot. */
  function passesOn(pool: CmaComp[], out: (key: string, n: number) => boolean): JudgeModelCall {
    let n = 0
    return async () => {
      n += 1
      const pass = n
      return {
        payload: judgment(
          pool.map((c) => {
            const excluded = out(c.listingKey, pass)
            return verdict({
              listingKey: c.listingKey,
              tier: excluded ? 'exclude' : 'strong',
              basis: excluded ? 'lot' : undefined,
              reason: excluded ? LOT_REASON : 'Comparable sale.',
            })
          }),
        ),
        raw: '{}',
        costUsd: 0,
      }
    }
  }
  const gate = (pool: CmaComp[], keptKeys: string[], verdicts: CompVerdict[]) =>
    pricingCompsAfterJudgment({
      selected: pool,
      vetted: pool.filter((c) => keptKeys.includes(c.listingKey)),
      verdicts,
      subject: { propertySubType: sub.propertySubType, yearBuilt: sub.yearBuilt, publicRemarks: sub.publicRemarks },
      minComps: MIN_COMPS,
    })

  it('seven candidates leave room for two exclusions above the floor', () => {
    expect(PRICING_WALK_CAP).toBe(7)
    expect(PRICING_WALK_CAP - 2).toBe(MIN_COMPS)
  })

  it('two unanimous exclusions out of seven price on the five the review kept', async () => {
    const pool = [...seven.slice(0, 5), { ...seven[5]!, ...outlierLot }, { ...seven[6]!, ...outlierLot }]
    const result = await judgeComps(sub, pool, market, {
      callModel: passesOn(pool, (key) => key === 'W5' || key === 'W6'),
      minComps: MIN_COMPS,
    })
    expect(result).not.toBeNull()
    expect(result!.decision?.unstable).toBe(false)
    expect(result!.decision?.keepLow).toBe(5)
    expect(result!.decision?.keepHigh).toBe(5)
    expect(result!.keptKeys.sort()).toEqual(['W0', 'W1', 'W2', 'W3', 'W4'])
    const gated = gate(pool, result!.keptKeys, result!.verdicts)
    expect(gated.shortage).toBe(false)
    expect(gated.comps.map((c) => c.listingKey).sort()).toEqual(['W0', 'W1', 'W2', 'W3', 'W4'])
    expect(gated.trace).toContain('Priced on the 5 sale(s) the comparability review kept')
  })

  it('one split vote out of seven still prices, it is not JUDGE_UNSTABLE', async () => {
    const pool = [...seven.slice(0, 6), { ...seven[6]!, ...outlierLot }]
    // Two of three passes exclude W6: the majority drops it. Six stayed in
    // every pass, so the split cannot decide the floor either way.
    const result = await judgeComps(sub, pool, market, {
      callModel: passesOn(pool, (key, n) => key === 'W6' && n % 3 !== 1),
      minComps: MIN_COMPS,
    })
    expect(result).not.toBeNull()
    expect(result!.decision?.unstable).toBe(false)
    expect(result!.decision?.keepLow).toBe(6)
    expect(result!.decision?.keepHigh).toBe(7)
    expect(result!.keptKeys).toHaveLength(6)
    expect(result!.keptKeys).not.toContain('W6')
    const gated = gate(pool, result!.keptKeys, result!.verdicts)
    expect(gated.shortage).toBe(false)
    expect(gated.comps).toHaveLength(6)
  })

  it('two sure exclusions and one split out of seven is the five-sale failure again: JUDGE_UNSTABLE', async () => {
    // The shape that failed today at five candidates (four sure keeps, five if
    // the split is kept), reached on a seven-sale walk. Seven seats make it
    // rarer; they do not make it impossible, and the vote rule is unchanged.
    const pool = [
      ...seven.slice(0, 4),
      { ...seven[4]!, ...outlierLot },
      { ...seven[5]!, ...outlierLot },
      { ...seven[6]!, ...outlierLot },
    ]
    const call = passesOn(pool, (key, n) => key === 'W5' || key === 'W6' || (key === 'W4' && n % 3 !== 1))
    await expect(judgeComps(sub, pool, market, { callModel: call, minComps: MIN_COMPS })).rejects.toMatchObject({
      code: JUDGE_UNSTABLE,
    })
  })
})
