/**
 * The comparability review holds the comp search's own rules (Matt 2026-10-08):
 *
 *  A. ONE 20% LINE. A price-tier cut stands only when the sale's own closed
 *     $/sqft is outside the home's independent anchor plus or minus 20%, the
 *     line the search admitted on (lib/pricing/price-tier.ts). Not a band drawn
 *     from the kept sales, not the other candidates' median.
 *  B. LOT UNDER AN ACRE. With both lots under an acre, a lot difference is
 *     disclosed and never drops a sale. At an acre and above, as before.
 *
 * The model is a function passed in. Nothing here calls api.x.ai.
 */
import { describe, expect, it } from 'vitest'
import { groundVerdict } from '@/lib/cma/judge-ground'
import { JUDGE_UNSTABLE } from '@/lib/cma/judge-vote'
import { buildJudgeUserPrompt, judgeComps, type JudgeModelCall } from '@/lib/cma/judge'
import type { CompVerdict } from '@/lib/cma/judge-consistency'
import type { CmaComp, CmaMarketContext, CmaSubject } from '@/lib/cma/types'
import { priceTierLine } from '@/lib/pricing/price-tier'

function subject(overrides: Partial<CmaSubject> = {}): CmaSubject {
  return {
    listingKey: 'SUBJ',
    mlsNumber: '100',
    streetAddress: '20676 Wild Rose Ln',
    city: 'Bend',
    state: 'OR',
    postalCode: '97702',
    subdivision: 'Sample Park',
    latitude: null,
    longitude: null,
    beds: 3,
    baths: 3,
    sqft: 2219,
    lotAcres: 0.13,
    propertySubType: 'Single Family Residence',
    yearBuilt: 2001,
    garageSpaces: 2,
    photoUrl: null,
    publicRemarks: 'Two story home.',
    viewDescription: null,
    taxAnnual: null,
    standardStatus: 'Withdrawn',
    lastListPrice: 599900,
    lastListDate: null,
    listingHistoryLine: null,
    ...overrides,
  }
}

let seq = 0
/** A sale at a given closed $/sqft on 2,000 sqft, off the subject's street and plat. */
function comp(listingKey: string, ppsf: number, overrides: Partial<CmaComp> = {}): CmaComp {
  seq += 1
  const sqft = overrides.sqft ?? 2000
  return {
    listingKey,
    mlsNumber: null,
    address: `${100 + seq} Elm Ave`,
    city: 'Bend',
    subdivision: 'Other Park',
    latitude: null,
    longitude: null,
    beds: 3,
    baths: 3,
    sqft,
    lotAcres: 0.14,
    propertySubType: 'Single Family Residence',
    yearBuilt: 2003,
    photoUrl: null,
    publicRemarks: 'Two story home.',
    viewDescription: null,
    taxAnnual: null,
    listPrice: Math.round(sqft * ppsf),
    closePrice: Math.round(sqft * ppsf),
    closeDate: '2026-05-15',
    daysToOffer: 12,
    domTotal: 20,
    selectionTier: 'nearby-1.25mi-6mo',
    ownPlat: false,
    ...overrides,
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

const exclude = (listingKey: string, basis: CompVerdict['basis'], reason: string): CompVerdict => ({
  listingKey,
  tier: 'exclude',
  basis,
  reason,
})

// 20676 Wild Rose: a $335 anchor over 407 sales, so the line is $268 to $402.
const WILD_ROSE = priceTierLine(335)!

describe('A. a price-tier cut stands only outside the one 20% line', () => {
  it('overrides a cut of a sale inside the line, even 20% off the other candidates', () => {
    // 20606 Songbird at $281, cut in one pass against Goldenrod's $343 as the
    // floor. The other candidates' median was $359, so the old backstop
    // (20% off that median) let the cut stand. It is 16% under the anchor.
    const songbird = comp('songbird', 281)
    const peers = [songbird, comp('chloe', 375), comp('goldenrod', 343), comp('ferguson', 422), comp('trout', 282)]
    const verdict = exclude('songbird', 'price-tier', 'Sold at $281/sqft, below the $343/sqft floor.')
    // Without an anchor: the old rule, the cut stands.
    expect(groundVerdict(subject(), songbird, verdict, peers).verdict.tier).toBe('exclude')
    // With the line: inside it, so the cut is overridden like any unsupported one.
    const result = groundVerdict(subject(), songbird, verdict, peers, null, WILD_ROSE)
    expect(result.rule).toBe('price-inside-line')
    expect(result.grounded).toBe(false)
    expect(result.verdict.tier).toBe('weak')
    expect(result.verdict.reason).toContain('$268 to $402 a square foot (within 20% of $335)')
    expect(result.verdict.reason).not.toMatch(/—/)
  })

  it('overrides a cut drawn from the kept sales own low and high (2400 Jones)', () => {
    // The "$495 to $515" band was only the kept sales' min and max. With no
    // number in the reason the model's declared band was used; the line decides now.
    const line = priceTierLine(498)!
    const inside = comp('lotno', 436)
    const peers = [inside, comp('innes', 512), comp('norton', 549), comp('fifth', 515), comp('meadow', 495)]
    const result = groundVerdict(
      subject(),
      inside,
      exclude('lotno', 'price-tier', 'A lower price tier than the retained sales.'),
      peers,
      { floor: 495, ceiling: 515 },
      line,
    )
    expect(result.verdict.tier).toBe('weak')
    expect(result.rule).toBe('price-inside-line')
  })

  it('supports a cut of a sale outside the line, even inside 20% of the other candidates', () => {
    // 2400 Jones at $381 against the $498 anchor: 23.6% under, outside $398 to $598.
    const line = priceTierLine(498)!
    const jones = comp('jones', 381)
    // A cheap cluster: the other candidates' median ($400) is within 5% of it,
    // so the old backstop would have thrown the cut out.
    const peers = [jones, comp('a', 390), comp('b', 400), comp('c', 410), comp('d', 420)]
    const verdict = exclude('jones', 'price-tier', 'Sold at $381/sqft, below the $398/sqft floor.')
    expect(groundVerdict(subject(), jones, verdict, peers).verdict.tier).toBe('weak')
    const result = groundVerdict(subject(), jones, verdict, peers, null, line)
    expect(result.grounded).toBe(true)
    expect(result.rule).toBe('price-outlier')
    expect(result.verdict.tier).toBe('exclude')
  })

  it('reads a price-tier reason under basis other the same way', () => {
    const songbird = comp('songbird', 281)
    const result = groundVerdict(
      subject(),
      songbird,
      exclude('songbird', 'other', 'A cheaper price tier at $281/sqft.'),
      [songbird, comp('chloe', 375)],
      null,
      WILD_ROSE,
    )
    expect(result.verdict.tier).toBe('weak')
    expect(result.rule).toBe('price-inside-line')
  })
})

describe('B. lot size under an acre is disclosed, never a cut', () => {
  it('overrides a lot cut when both lots are under an acre (Wild Rose 0.13 against 0.46)', () => {
    const chloe = comp('chloe', 375, { lotAcres: 0.46 })
    const result = groundVerdict(
      subject(),
      chloe,
      exclude('chloe', 'lot', '0.46 acre lot versus the subject 0.13 acre lot.'),
      [chloe],
    )
    expect(result.rule).toBe('lot-under-acre')
    expect(result.grounded).toBe(false)
    expect(result.verdict.tier).toBe('weak')
    expect(result.verdict.reason).toContain('0.46 acres')
    expect(result.verdict.reason).toContain('0.13 acres')
    expect(result.verdict.reason).not.toMatch(/—/)
  })

  it('overrides a lot cut filed under basis other', () => {
    const lot = comp('ferguson', 380, { lotAcres: 0.53 })
    const result = groundVerdict(
      subject(),
      lot,
      exclude('ferguson', 'other', 'Much larger 0.53 acre lot.'),
      [lot],
    )
    expect(result.verdict.tier).not.toBe('exclude')
    expect(result.rule).toBe('lot-under-acre')
  })

  it('keeps the old lot test at an acre and above', () => {
    // One side an acre or more: a doubled lot still supports the cut.
    const acre = comp('acre', 375, { lotAcres: 1.2 })
    const atAcre = groundVerdict(
      subject(),
      acre,
      exclude('acre', 'lot', '1.2 acre lot versus the subject 0.13 acre lot.'),
      [acre],
    )
    expect(atAcre.grounded).toBe(true)
    expect(atAcre.rule).toBe('lot')
    expect(atAcre.verdict.tier).toBe('exclude')
    // Both on acreage and not materially different: still not supported, as before.
    const near = comp('near', 375, { lotAcres: 1.3 })
    const close = groundVerdict(
      subject({ lotAcres: 1.2 }),
      near,
      exclude('near', 'lot', '1.3 acre lot versus the subject 1.2 acre lot.'),
      [near],
    )
    expect(close.verdict.tier).toBe('weak')
    expect(close.rule).toBe('lot')
  })
})

/** Three passes; `cut(n)` is the verdicts pass n excludes, everything else kept strong. */
function passes(
  pool: CmaComp[],
  cut: (n: number) => Map<string, { basis: CompVerdict['basis']; reason: string }>,
  band: { floor: number; ceiling: number } = { floor: 300, ceiling: 500 },
) {
  let n = 0
  const systems: string[] = []
  const users: string[] = []
  const call: JudgeModelCall = async ({ system, messages }) => {
    n += 1
    systems.push(system)
    users.push(String(messages[0]?.content ?? ''))
    const out = cut(n)
    return {
      payload: {
        ppsfFloor: band.floor,
        ppsfCeiling: band.ceiling,
        exclusionRule: '',
        confidence: 'Moderate',
        narrative: 'The kept sales sit inside the price tier line.',
        verdicts: pool.map((c) => {
          const x = out.get(c.listingKey)
          return {
            listingKey: c.listingKey,
            tier: x ? 'exclude' : 'strong',
            reason: x ? x.reason : 'Comparable sale.',
            basis: x ? x.basis : 'not-excluded',
          }
        }),
      },
      raw: '{}',
      costUsd: 0,
    }
  }
  return { call, systems, users }
}

describe('the vote no longer splits on what the line and the lot rule decide', () => {
  // The Wild Rose set the old search seated: Ferguson at $422 included.
  const pool = () => [
    comp('chloe', 375, { lotAcres: 0.46 }),
    comp('goldenrod', 343),
    comp('ferguson', 422, { lotAcres: 0.53 }),
    comp('songbird', 281),
    comp('trout', 282, { lotAcres: 0.12 }),
  ]
  const priceCut = (n: number) =>
    n === 1
      ? new Map([
          ['songbird', { basis: 'price-tier' as const, reason: 'Sold at $281/sqft, below the $343/sqft floor.' }],
          ['trout', { basis: 'price-tier' as const, reason: 'Sold at $282/sqft, below the $343/sqft floor.' }],
        ])
      : new Map()

  it('a one-pass price cut inside the line is JUDGE_UNSTABLE without the anchor and prices with it', async () => {
    await expect(
      judgeComps(subject(), pool(), market, { callModel: passes(pool(), priceCut).call }),
    ).rejects.toMatchObject({ code: JUDGE_UNSTABLE })
    const out = await judgeComps(subject(), pool(), market, {
      callModel: passes(pool(), priceCut).call,
      priceAnchor: { ppsf: 335, n: 407 },
    })
    expect(out?.keptKeys.sort()).toEqual(['chloe', 'ferguson', 'goldenrod', 'songbird', 'trout'])
  })

  it('a one-pass lot cut of half-acre sales on a 0.13 acre home is JUDGE_UNSTABLE no more', async () => {
    const lotCut = (n: number) =>
      n === 2
        ? new Map([
            ['chloe', { basis: 'lot' as const, reason: '0.46 acre lot versus the subject 0.13 acre lot.' }],
            ['ferguson', { basis: 'lot' as const, reason: '0.53 acre lot versus the subject 0.13 acre lot.' }],
          ])
        : new Map()
    const out = await judgeComps(subject(), pool(), market, { callModel: passes(pool(), lotCut).call })
    expect(out?.keptKeys).toHaveLength(5)
  })
})

describe('the review is told the line and declares it', () => {
  it('states the anchor band in the brief, and only when there is an anchor', () => {
    const comps = [comp('a', 340)]
    const withLine = buildJudgeUserPrompt(subject(), comps, market, { ppsf: 498, n: 62 })
    expect(withLine).toContain('PRICE TIER LINE')
    expect(withLine).toContain('$498 a square foot (median of 62 closed sales)')
    expect(withLine).toContain('$398 to $598 a square foot')
    expect(withLine).toContain('Declare ppsfFloor 398 and ppsfCeiling 598')
    const lineText = withLine.split('\n').find((l) => l.startsWith('PRICE TIER LINE')) ?? ''
    expect(lineText).toContain('$398 to $598')
    expect(lineText).not.toMatch(/—/)
    const without = buildJudgeUserPrompt(subject(), comps, market)
    expect(without).not.toContain('PRICE TIER LINE')
    expect(buildJudgeUserPrompt(subject(), comps, market, null)).toBe(without)
  })

  it('tells the model the line is the band and lot size under an acre is not a cut', async () => {
    const pool = [comp('a', 340), comp('b', 345), comp('c', 350), comp('d', 355), comp('e', 360)]
    const mock = passes(pool, () => new Map())
    await judgeComps(subject(), pool, market, { callModel: mock.call, priceAnchor: { ppsf: 335, n: 407 } })
    expect(mock.systems[0]).toContain('THE PRICE TIER LINE')
    expect(mock.systems[0]).toContain('Do not draw a band from the sales you keep')
    expect(mock.systems[0]).toContain('LOT SIZE UNDER AN ACRE IS NOT A CUT')
    expect(mock.users[0]).toContain('$268 to $402 a square foot')
  })

  it('declares the line as the band, and the band cut never drops a sale inside it', async () => {
    // Seven sales, every pass keeps all of them and declares $340 to $370. Two
    // sit outside that declared band and inside the $268 to $402 line.
    const pool = [300, 345, 350, 355, 360, 365, 395].map((p, i) => comp(`S${i}`, p))
    const declared = { floor: 340, ceiling: 370 }
    // Without an anchor, the declared band cuts both (seven minus two is still five).
    const old = await judgeComps(subject(), pool, market, {
      callModel: passes(pool, () => new Map(), declared).call,
    })
    expect(old?.keptKeys).toHaveLength(5)
    // With the anchor the band is the line, and no sale inside it is cut.
    const out = await judgeComps(subject(), pool, market, {
      callModel: passes(pool, () => new Map(), declared).call,
      priceAnchor: { ppsf: 335, n: 407 },
    })
    expect(out?.keptKeys).toHaveLength(7)
    expect(out?.ppsfFloor).toBe(268)
    expect(out?.ppsfCeiling).toBe(402)
  })

  it('a custom subject keeps the floor and loses the ceiling here too, as the search does', async () => {
    // The search seats a custom peer above the line (floor only). Declaring the
    // line as the band must not let the band cut drop it afterwards.
    const custom = subject({ yearBuilt: 2026, newConstructionYn: true, publicRemarks: 'Custom built home.' })
    const pool = [345, 350, 355, 360, 365, 370, 520].map((p, i) => comp(`S${i}`, p, { yearBuilt: 2025 }))
    const out = await judgeComps(custom, pool, market, {
      callModel: passes(pool, () => new Map(), { floor: 340, ceiling: 380 }).call,
      priceAnchor: { ppsf: 335, n: 407 },
    })
    expect(out?.keptKeys).toContain('S6')
  })
})
