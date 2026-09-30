/**
 * The narrative-versus-priced-set checks. Every narrative here is a real shape
 * from the stored expired CMAs (2026-09-05 to 2026-09-30). The near misses are
 * tested as hard as the hits, and four of them are regressions of false
 * positives this module produced while it was being measured on that corpus:
 * Petrosa and Providence (a street inside a plat of the same name), "The
 * Pines" (the MLS carries "Pines At Sisters"), and River Pine Estates (a plat
 * named only to place two sales already named).
 */
import { describe, expect, it } from 'vitest'
import {
  claimCompOf,
  narrativeClaimFindings,
  parseAddress,
  splitNarrativeSentences,
  stripRefutedSentences,
  type ClaimComp,
} from '@/lib/cma/narrative-claims'
import { reviewWeightFactor } from '@/lib/cma/review-weight'

const c = (
  listingKey: string,
  address: string,
  subdivision: string | null,
  lotAcres: number | null = 0.15,
  tier: 'strong' | 'weak' | null = 'strong',
): ClaimComp => ({ listingKey, address, subdivision, lotAcres, tier })

const subject = { streetAddress: '4541 36th', lotAcres: 0.08 }

const kinds = (out: ReturnType<typeof narrativeClaimFindings>) => out.map((f) => f.kind)

describe('count claims', () => {
  const five = [
    c('A', '3128 Cromwell', 'Providence'),
    c('B', '61398 Matthew', 'Arena Acres Phase 1'),
    c('C', '3023 Lansing', 'Providence'),
    c('D', '955 Locksley', 'Providence'),
    c('E', '1131 Locksley', 'Providence', 0.18, 'weak'),
  ]

  it('flags a kept count under the priced set (cma-3153-cromwell)', () => {
    const out = narrativeClaimFindings({
      narrative: 'Four closed sales were kept in the $309 to $318 per square foot band.',
      priced: five,
      subject,
    })
    expect(kinds(out)).toEqual(['count'])
    expect(out[0]!.claim).toContain('prices 5')
  })

  it('flags a kept count over the priced set', () => {
    expect(kinds(narrativeClaimFindings({ narrative: 'Six sales were kept.', priced: five, subject }))).toEqual(['count'])
  })

  it('reads digits, "N of M", and zero', () => {
    expect(kinds(narrativeClaimFindings({ narrative: '1 sale was kept, 365 Timber Creek.', priced: five, subject }))).toEqual(['count'])
    expect(kinds(narrativeClaimFindings({ narrative: 'Zero of five closed sales were kept.', priced: five, subject }))).toEqual(['count'])
    expect(narrativeClaimFindings({ narrative: 'Five of eight closed sales were kept.', priced: five, subject })).toEqual([])
  })

  it('passes a count that matches, and "retained" and "are kept" forms', () => {
    expect(narrativeClaimFindings({ narrative: 'Five closed sales were kept.', priced: five, subject })).toEqual([])
    expect(narrativeClaimFindings({ narrative: 'Five closed sales are kept.', priced: five, subject })).toEqual([])
    expect(narrativeClaimFindings({ narrative: 'Five sales were retained.', priced: five, subject })).toEqual([])
    // A weight on the count makes it a count of that weight: one sale here is
    // at half weight, not five.
    expect(kinds(narrativeClaimFindings({ narrative: 'Five closed sales are kept at half weight.', priced: five, subject }))).toEqual([
      'count',
    ])
  })

  it('checks a proper-noun count against the sales that noun covers (cma-4541-36th)', () => {
    const set = [
      c('1', '3886 Coyote', 'Triple Ridge'),
      c('2', '3899 Coyote', 'Triple Ridge'),
      c('3', '4100 Coyote', 'Prairie Crossing', 0.07, 'weak'),
      c('4', '3789 Coyote', 'Triple Ridge'),
      c('5', '3876 Coyote', 'Triple Ridge'),
    ]
    expect(
      narrativeClaimFindings({ narrative: 'Four Triple Ridge sales were kept between $236 and $256 per square foot.', priced: set, subject }),
    ).toEqual([])
    expect(
      kinds(narrativeClaimFindings({ narrative: 'Three Triple Ridge sales were kept.', priced: set, subject })),
    ).toEqual(['count'])
  })

  it('passes a plat name that covers several MLS subdivisions (Eagle Crest and Ridge At Eagle Crest)', () => {
    const set = [
      c('1', '628 Highland Meadow', 'Eagle Crest'),
      c('2', '1203 Highland View', 'Eagle Crest'),
      c('3', '10466 Sundance', 'Ridge At Eagle Crest'),
      c('4', '577 Highland Meadow', 'Ridge At Eagle Crest'),
      c('5', '597 Highland Meadow', 'Ridge At Eagle Crest'),
    ]
    expect(
      narrativeClaimFindings({
        narrative: 'Five closed Eagle Crest custom sales from $396 to $431 per square foot were kept.',
        priced: set,
        subject,
      }),
    ).toEqual([])
  })

  it('reads a name that is both a street and the plat either way (cma-3726-petrosa regression)', () => {
    const set = [
      c('1', '3875 Petrosa', 'Petrosa'),
      c('2', '21435 Hayloft', 'Meridian Phase 1', 0.08, 'weak'),
      c('3', '21338 Brooklyn', 'Mirada', 0.1, 'weak'),
      c('4', '3982 Oakside', 'Petrosa', 0.11, 'weak'),
      c('5', '3760 Cole', 'Petrosa'),
    ]
    expect(
      narrativeClaimFindings({ narrative: 'Three Petrosa sales were kept between $299 and $352 per square foot.', priced: set, subject }),
    ).toEqual([])
  })

  it('reads "The Pines" as the Pines At Sisters plat too (cma-1109-yapoah-crater regression)', () => {
    const set = [
      c('1', '129 Wheeler', 'Pines At Sisters'),
      c('2', '498 Wheeler', 'Pines At Sisters'),
      c('3', '188 Wheeler', 'The Pines'),
      c('4', '269 Wheeler', 'Pines At Sisters'),
      c('5', '1085 Collier Glacier', 'The Pines'),
    ]
    expect(
      narrativeClaimFindings({ narrative: 'Five closed sales in The Pines were kept at $269 to $300 per square foot.', priced: set, subject }),
    ).toEqual([])
  })

  it('leaves a count unchecked when its noun names no candidate (a builder or a plan)', () => {
    expect(
      narrativeClaimFindings({
        narrative: 'Four closed Petrosa sales of the 1927 sqft Pahlisch Sydney plan were kept.',
        priced: five,
        subject,
      }),
    ).toEqual([])
  })

  it('does not read a room count as a sale count', () => {
    expect(narrativeClaimFindings({ narrative: 'The 3 bed 2 bath homes were kept at full weight.', priced: five, subject })).toEqual([])
  })
})

describe('qualified counts: a weight is exact, any other qualifier is a ceiling (review of da8dce6, 2026-09-30)', () => {
  const mixed = [
    c('A', '3886 Coyote', 'Triple Ridge', 0.1, 'strong'),
    c('B', '3899 Coyote', 'Triple Ridge', 0.11, 'strong'),
    c('C', '3789 Coyote', 'Triple Ridge', 0.07, 'strong'),
    c('D', '4100 Coyote', 'Prairie Crossing', 0.07, 'weak'),
    c('E', '3876 Coyote', 'Triple Ridge', 0.07, 'weak'),
  ]

  it.each([
    'Three strong sales were kept.',
    'Two weak sales were kept.',
    'Three closed sales were retained at full weight.',
    'Two recent sales were retained at half weight to bracket the range.',
    'Two older sales were kept.',
    'Two additional sales were retained.',
    'Five closed sales were kept.',
  ])('passes the true sentence %j', (narrative) => {
    expect(narrativeClaimFindings({ narrative, priced: mixed, candidates: mixed, subject })).toEqual([])
  })

  it.each([
    'Four strong sales were kept.',
    'Two sales were kept at full weight.',
    'Six older sales were kept.',
    'One sale was retained at half weight.',
  ])('flags the refuted count %j', (narrative) => {
    expect(kinds(narrativeClaimFindings({ narrative, priced: mixed, candidates: mixed, subject }))).toEqual(['count'])
  })

  it('refutes a qualified exclusion when the final set excludes fewer sales than it claims', () => {
    const narrative = 'One lower-priced sale was set aside as a different price tier.'
    // Nothing is set aside: the restored own-plat sale prices.
    expect(kinds(narrativeClaimFindings({ narrative, priced: mixed, candidates: mixed, subject }))).toEqual(['excluded-count'])
    // One candidate really is out: the claim stands.
    const out = c('X', '4200 Coyote', 'Prairie Crossing')
    expect(narrativeClaimFindings({ narrative, priced: mixed, candidates: [...mixed, out], subject })).toEqual([])
    expect(
      kinds(narrativeClaimFindings({ narrative: 'Two older candidates were dropped.', priced: mixed, candidates: [...mixed, out], subject })),
    ).toEqual(['excluded-count'])
  })
})

describe('lot wording read as bounds, fractions and approximations (review of da8dce6, 2026-09-30)', () => {
  const lots = (...acres: number[]) => acres.map((a, i) => c(`L${i}`, `${100 + i} Pine Needle`, 'Woods', a))
  const s = { streetAddress: '9 Main', lotAcres: 3 }
  it.each([
    [[0.8, 0.9, 0.95], 'All three sit on less than an acre.'],
    [[0.45, 0.5, 0.55], 'The kept sales sit on about half an acre.'],
    [[0.3, 0.4], 'The kept sales sit on under 0.5 acres.'],
    [[0.5, 0.5], 'Both sit on 1/2 acre lots.'],
    [[0.25, 0.26], 'Both sit on quarter-acre lots.'],
    [[1.5, 2], 'The kept sales sit on an acre or more.'],
    [[0.46, 0.6], 'The kept sales sit on at least 0.45 acres.'],
  ] as Array<[number[], string]>)('passes %j with %j', (acres, narrative) => {
    expect(narrativeClaimFindings({ narrative, priced: lots(...acres), subject: s })).toEqual([])
  })

  it.each([
    [[0.3, 0.4], 'The kept sales sit on at least 0.45 acres.'],
    [[1.2, 0.9], 'They sit on less than an acre.'],
    [[0.2, 0.25], 'Both sit on 1/2 acre lots.'],
  ] as Array<[number[], string]>)('flags %j under %j', (acres, narrative) => {
    expect(kinds(narrativeClaimFindings({ narrative, priced: lots(...acres), subject: s }))).toEqual(['lot'])
  })
})

describe('price band claims: a stated $/sqft range must be the priced set\'s own (review of da8dce6, 2026-09-30)', () => {
  const p = (listingKey: string, address: string, subdivision: string, closePrice: number, sqft: number): ClaimComp => ({
    listingKey,
    address,
    subdivision,
    lotAcres: 0.1,
    tier: 'strong',
    closePrice,
    sqft,
  })
  // $277.78, $388.89 and $391.67 per square foot.
  const set = [p('P', '3940 Coyote', 'Triple Ridge', 500000, 1800), p('A', '3886 Coyote', 'Triple Ridge', 700000, 1800), p('B', '3899 Coyote', 'Triple Ridge', 705000, 1800)]

  it('flags the band the judge declared before a restoration moved the set (judge-restore fixture)', () => {
    const out = narrativeClaimFindings({ narrative: 'Priced on closed sales from $350 to $420 per square foot.', priced: set, subject })
    expect(kinds(out)).toEqual(['band'])
    expect(out[0]!.claim).toContain('run $278 to $392')
    expect(out[0]!.evidence).toContain('3940 Coyote at $278')
  })

  it.each([
    'Three closed sales were kept between $278 and $392 per square foot.',
    'Three closed sales were kept from $277 to $391/sqft.',
    'Priced on closed sales from $278 to $392 per square foot.',
  ])('passes %j (whole-dollar rounding either way)', (narrative) => {
    expect(narrativeClaimFindings({ narrative, priced: set, subject })).toEqual([])
  })

  it('flags a range end off by more than rounding', () => {
    expect(kinds(narrativeClaimFindings({ narrative: 'Three closed sales were kept from $276 to $392 per square foot.', priced: set, subject }))).toEqual([
      'band',
    ])
  })

  it('reads window wording as a window: every sale inside it, not its ends (cma-51599-ash)', () => {
    // $236, $257 and $268: the judge quoting its declared $230 to $270 band.
    const ash = [p('L', '52315 Lechner', 'Wickiup', 354000, 1500), p('N', '14561 Nuthatch', 'Wickiup', 402000, 1500), p('M', '52711 Meadow', 'Wickiup', 385500, 1500)]
    for (const narrative of [
      'Three closed sales were kept between $230 and $270 per square foot.',
      'Three closed sales were kept inside $230 to $270 per square foot.',
      'Three closed sales were kept in the $230 to $270 per square foot band.',
    ]) {
      expect(narrativeClaimFindings({ narrative, priced: ash, subject })).toEqual([])
    }
    // A priced sale outside the window still refutes it, as the restored $278 sale does.
    expect(kinds(narrativeClaimFindings({ narrative: 'Three closed sales were kept between $240 and $270 per square foot.', priced: ash, subject }))).toEqual([
      'band',
    ])
    expect(kinds(narrativeClaimFindings({ narrative: 'Three closed sales were kept between $350 and $420 per square foot.', priced: set, subject }))).toEqual([
      'band',
    ])
  })

  it('reads a list of named sales as long as its count as the set the band describes (cma-1195-remarkable)', () => {
    const four = [
      { ...p('C', '2521 Coe', 'Awbrey', 412000, 1000), tier: 'strong' as const },
      { ...p('Y', '925 Yosemite', 'Awbrey', 468000, 1000), tier: 'strong' as const },
      { ...p('K', '1255 Constellation', 'Awbrey', 284000, 1000), tier: 'weak' as const },
      { ...p('L', '2359 Lakeside', 'Awbrey', 510000, 1000), tier: 'weak' as const },
    ]
    expect(
      narrativeClaimFindings({
        narrative: 'Two closed sales were kept at full weight, Coe and Yosemite, from $412 to $468 per square foot.',
        priced: four,
        subject,
      }),
    ).toEqual([])
    // A name that is a street and a plat at once (cma-429-irving: Quiet Canyon is both).
    const irving = [
      p('QC', '3022 Quiet Canyon', 'Quiet Canyon', 331000, 1000),
      p('T', '1407 Talon', 'Falcon Ridge', 355000, 1000),
      p('F', '775 Franklin', 'Center Addition to Bend', 507000, 1000),
      p('QR', '1512 Quiet Ridge', 'Quiet Canyon', 413000, 1000),
    ]
    expect(
      kinds(
        narrativeClaimFindings({
          narrative: 'Three sales were kept between $331 and $413 per square foot: Quiet Canyon, Talon, and Quiet Ridge.',
          priced: irving,
          subject,
        }),
      ),
    ).toEqual(['count'])
    // Named, but the band is not theirs.
    expect(
      kinds(
        narrativeClaimFindings({
          narrative: 'Two closed sales were kept at full weight, Coe and Yosemite, from $400 to $468 per square foot.',
          priced: four,
          subject,
        }),
      ),
    ).toEqual(['band'])
  })

  it('checks a proper-noun band against the sales that noun covers (cma-4541-36th)', () => {
    const tr = [p('A', '3886 Coyote', 'Triple Ridge', 475000, 2010), p('B', '3899 Coyote', 'Triple Ridge', 492700, 1921), p('PC', '4100 Coyote', 'Prairie Crossing', 520000, 1600)]
    expect(narrativeClaimFindings({ narrative: 'Two Triple Ridge sales were kept from $236 to $256 per square foot.', priced: tr, subject })).toEqual([])
    expect(kinds(narrativeClaimFindings({ narrative: 'Two Triple Ridge sales were kept from $236 to $300 per square foot.', priced: tr, subject }))).toEqual([
      'band',
    ])
  })

  it('leaves a band on a subset it cannot resolve, and a drop threshold, alone', () => {
    expect(narrativeClaimFindings({ narrative: 'The strongest comps sold between $290 and $312/sqft.', priced: set, subject })).toEqual([])
    expect(narrativeClaimFindings({ narrative: 'Sales above $400 per square foot were excluded.', priced: set, subject })).toEqual([])
  })
})

describe('a count whose own words name a range is exact against the sales in it (claims-precision rerun, 2026-09-30)', () => {
  const r = (listingKey: string, address: string, closePrice: number, sqft: number, yearBuilt: number, tier: 'strong' | 'weak' = 'strong'): ClaimComp => ({
    listingKey,
    address,
    subdivision: null,
    lotAcres: 0.5,
    tier,
    closePrice,
    sqft,
    yearBuilt,
  })
  // cma-15461-federal-la-pine: all five priced sales sit in $242 to $271.
  const federal = [
    r('A', '51974 Wickiup', 378700, 1493, 2022),
    r('B', '52025 Noble Fir', 450000, 1680, 2020, 'weak'),
    r('C', '15360 Bear', 380000, 1568, 2021),
    r('D', '52267 Caribou', 405000, 1493, 2025),
    r('E', '15387 Bear', 350000, 1351, 2025, 'weak'),
  ]
  // cma-15935-woodchip-la-pine: three of five sit in $303 to $382.
  const woodchip = [
    r('A', '15884 Yellowood', 445000, 1558, 1981, 'weak'),
    r('B', '15905 Pine', 484000, 1598, 2004, 'weak'),
    r('C', '15969 Green Forest', 380000, 1344, 1977),
    r('D', '15670 Sunrise', 580000, 1695, 2001, 'weak'),
    r('E', '15876 Sunrise', 595000, 1557, 2003, 'weak'),
  ]
  // cma-120-sisemore: all five built 1917 to 1930, one at $442.
  const sisemore = [
    r('A', '213 Riverside', 1041000, 1440, 1918, 'weak'),
    r('B', '621 Delaware', 1015000, 1794, 1930, 'weak'),
    r('C', '440 Riverfront', 1000000, 1753, 1920),
    r('D', '232 Congress', 1094000, 1527, 1917, 'weak'),
    r('E', '54 Gilchrist', 793500, 1796, 1918, 'weak'),
  ]

  it('flags a band-qualified count the band does not bear out (cma-15461-federal-la-pine)', () => {
    const out = narrativeClaimFindings({ narrative: 'Four closed sales from $242 to $271 per square foot were kept.', priced: federal, subject })
    expect(kinds(out)).toEqual(['count'])
    expect(out[0]!.claim).toContain('5 priced sales match $242 to $271 per square foot')
  })

  it('passes a band-qualified count that names a true subset (cma-15935-woodchip, cma-16932-upland)', () => {
    expect(narrativeClaimFindings({ narrative: 'Three closed sales from $303 to $382 per square foot were kept.', priced: woodchip, subject })).toEqual([])
  })

  it('flags a build-year count the years do not bear out, and the window beside it (cma-120-sisemore)', () => {
    const out = narrativeClaimFindings({
      narrative: 'Four closed sales from 1917 to 1930 were kept between $566 and $723 per square foot.',
      priced: sisemore,
      subject,
    })
    expect(kinds(out).sort()).toEqual(['band', 'count'])
    expect(out.find((f) => f.kind === 'count')!.claim).toContain('5 priced sales match built 1917 to 1930')
  })

  it('reads a recent year as a build year only when the words say built', () => {
    const recent = [r('A', '1 Oak', 500000, 2000, 2021), r('B', '2 Oak', 510000, 2000, 2022), r('C', '3 Oak', 520000, 2000, 2015)]
    // Could be close years: a ceiling, not a refutation.
    expect(narrativeClaimFindings({ narrative: 'Two 2025 sales were kept.', priced: recent, subject })).toEqual([])
    expect(narrativeClaimFindings({ narrative: 'Two closed sales built 2021 to 2022 were kept.', priced: recent, subject })).toEqual([])
    expect(kinds(narrativeClaimFindings({ narrative: 'Three closed sales built 2021 to 2022 were kept.', priced: recent, subject }))).toEqual(['count'])
  })

  it('never reads a square footage as a year', () => {
    const three = [r('A', '1 Oak', 500000, 2000, 1990), r('B', '2 Oak', 510000, 2000, 1991), r('C', '3 Oak', 520000, 2400, 1992)]
    expect(narrativeClaimFindings({ narrative: 'Two 2000 sqft homes were kept.', priced: three, subject })).toEqual([])
  })

  it('leaves a range it cannot resolve as a ceiling', () => {
    // No living area on one sale: the band cannot be resolved.
    const partial = [...woodchip.slice(0, 4), { ...woodchip[4]!, sqft: null }]
    expect(narrativeClaimFindings({ narrative: 'Three closed sales from $303 to $382 per square foot were kept.', priced: partial, subject })).toEqual([])
    expect(kinds(narrativeClaimFindings({ narrative: 'Six closed sales from $303 to $382 per square foot were kept.', priced: partial, subject }))).toEqual([
      'count',
    ])
  })

  it('reads the sale noun as the noun, not a qualifier (cma-24166-dodds)', () => {
    const dodds = [r('A', '10934 Fleming', 1558750, 3348, 1998), r('B', '60485 Billadeau', 1495000, 4449, 1996), r('C', '10401 Powell Butte', 1725000, 4349, 2003)]
    expect(kinds(narrativeClaimFindings({ narrative: 'Zero of three candidate sales were kept.', priced: dodds, subject }))).toEqual(['count'])
  })
})

describe('one mapper, and the weight it reads is the weight applied (second review of da8dce6, 2026-09-30)', () => {
  const sale = (listingKey: string, address: string) => ({
    listingKey,
    address,
    subdivision: 'Triple Ridge',
    lotAcres: 0.1,
    closePrice: 500000,
    sqft: 2000,
    yearBuilt: 2005,
  })

  it('reads every verdict as the weight reviewWeightFactor applies, and no verdict as no tier', () => {
    for (const tier of ['strong', 'weak', 'exclude']) {
      expect(claimCompOf(sale('A', '1 Oak'), tier).tier).toBe(reviewWeightFactor(tier) < 1 ? 'weak' : 'strong')
    }
    expect(claimCompOf(sale('A', '1 Oak'), undefined).tier).toBeNull()
    expect(claimCompOf(sale('A', '1 Oak'), null).tier).toBeNull()
  })

  it('carries every field a check reads, so no path is blind to one', () => {
    expect(claimCompOf(sale('A', '1 Oak'), 'strong')).toEqual({
      listingKey: 'A',
      address: '1 Oak',
      subdivision: 'Triple Ridge',
      lotAcres: 0.1,
      tier: 'strong',
      closePrice: 500000,
      sqft: 2000,
      yearBuilt: 2005,
    })
  })

  it('on a curated set, an excluded sale priced at full weight is described as full weight', () => {
    // A broker-picked set prices its exclude verdict at full weight
    // (reviewWeightFactor), so "full weight" is true of it and "half" is not.
    const priced = [
      claimCompOf(sale('A', '3886 Coyote'), 'strong'),
      claimCompOf(sale('X', '3899 Coyote'), 'exclude'),
      claimCompOf(sale('W', '3789 Coyote'), 'weak'),
    ]
    expect(narrativeClaimFindings({ narrative: 'Two closed sales were retained at full weight.', priced, subject })).toEqual([])
    expect(narrativeClaimFindings({ narrative: '3899 Coyote carries full weight.', priced, subject })).toEqual([])
    expect(kinds(narrativeClaimFindings({ narrative: '3899 Coyote was kept at half weight.', priced, subject }))).toEqual(['weight'])
    expect(kinds(narrativeClaimFindings({ narrative: 'One closed sale was retained at full weight.', priced, subject }))).toEqual(['count'])
  })
})

describe('excluded-count claims', () => {
  const priced = [c('A', '63266 Gallop', 'Wishing Well', 0.24, 'weak'), c('B', '20706 Nicolette', 'Boyd Acres View Est'), c('C', '20735 Nicolette', 'Boyd Acres View Est', 0.22, 'weak')]
  const unpriced = [c('X', '63617 High Standard', null), c('Y', '20700 Elm', null)]

  it('flags "None were excluded" when candidates were left out (cma-20726-russell)', () => {
    const out = narrativeClaimFindings({ narrative: 'None were excluded.', priced, candidates: [...priced, ...unpriced], subject })
    expect(kinds(out)).toEqual(['excluded-count'])
    expect(out[0]!.claim).toContain('2 candidate sales')
  })

  it('passes "None were excluded" when every candidate priced', () => {
    expect(narrativeClaimFindings({ narrative: 'None were excluded.', priced, candidates: priced, subject })).toEqual([])
  })

  it('checks the honest line total in both directions', () => {
    const one = 'One candidate sale was excluded as a different market segment.'
    expect(kinds(narrativeClaimFindings({ narrative: one, priced, candidates: [...priced, ...unpriced], subject }))).toEqual([
      'excluded-count',
    ])
    expect(narrativeClaimFindings({ narrative: one, priced, candidates: [...priced, unpriced[0]!], subject })).toEqual([])
  })

  it('flags "all seven were excluded" over a priced set (cma-52531-lost-ponderosa)', () => {
    expect(
      kinds(narrativeClaimFindings({ narrative: 'Seven closed sales were reviewed and all seven were excluded.', priced, candidates: priced, subject })),
    ).toEqual(['excluded-count'])
  })

  it('flags a partial drop count only when it exceeds the unpriced candidates', () => {
    const two = 'Two candidates were dropped because their remarks identify manufactured homes.'
    expect(narrativeClaimFindings({ narrative: two, priced, candidates: [...priced, ...unpriced], subject })).toEqual([])
    expect(kinds(narrativeClaimFindings({ narrative: two, priced, candidates: [...priced, unpriced[0]!], subject }))).toEqual([
      'excluded-count',
    ])
  })

  it('stays quiet without the candidate list', () => {
    expect(narrativeClaimFindings({ narrative: 'None were excluded.', priced, subject })).toEqual([])
  })
})

describe('named sales: dropped but priced, kept but not priced', () => {
  const priced = [
    c('1', '3886 Coyote', 'Triple Ridge'),
    c('2', '3899 Coyote', 'Triple Ridge'),
    c('3', '4100 Coyote', 'Prairie Crossing', 0.07, 'weak'),
  ]

  it('flags a plat named as dropped when its only sale is priced (cma-4541-36th)', () => {
    const out = narrativeClaimFindings({
      narrative: 'Prairie Crossing was dropped for community amenities named in its remarks.',
      priced,
      candidates: priced,
      subject,
    })
    expect(kinds(out)).toEqual(['dropped-but-priced'])
    expect(out[0]!.evidence).toContain('4100 Coyote')
  })

  it('resolves a full address on a shared street (cma-1733-hemlock, 2173 Kingwood)', () => {
    const set = [c('K1', '1572 Kingwood', 'Canyon Rim Village'), c('K2', '1550 Kingwood', 'Canyon Rim Village'), c('K3', '2173 Kingwood', 'Amber Springs')]
    const said = '2173 Kingwood was dropped as a 2008 build.'
    expect(kinds(narrativeClaimFindings({ narrative: said, priced: set, candidates: set, subject }))).toEqual(['dropped-but-priced'])
    expect(narrativeClaimFindings({ narrative: said, priced: set.slice(0, 2), candidates: set, subject })).toEqual([])
  })

  it('does not flag a street shared by a dropped sale that is not priced', () => {
    const set = [c('D1', '11090 Desert Sky', 'Eagle Crest'), c('D2', '11043 Desert Sky', 'Eagle Crest')]
    expect(
      narrativeClaimFindings({
        narrative: 'The Desert Sky sale at $294 per square foot was dropped as a cheaper tier.',
        priced: [set[0]!],
        candidates: set,
        subject,
      }),
    ).toEqual([])
  })

  it('never reads the other side of a rule as the dropped sale', () => {
    const set = [c('S1', '3626 29th', 'Summer Creek'), c('S2', '3601 30th', 'Summer Creek')]
    expect(
      narrativeClaimFindings({ narrative: 'Sales outside Summer Creek were dropped as a different 55+ community product.', priced: set, candidates: set, subject }),
    ).toEqual([])
  })

  it('does not blame a plat named only to place the dropped sale', () => {
    const set = [c('W', '8604 Widgeon', 'Ridge At Eagle Crest'), c('R', '10466 Sundance', 'Ridge At Eagle Crest')]
    expect(
      narrativeClaimFindings({ narrative: 'Widgeon is Ridge At Eagle Crest and was dropped.', priced: [set[1]!], candidates: set, subject }),
    ).toEqual([])
    const garrison = [c('G', '2104 Garrison', 'River Rim'), c('H', '2050 Garrison Two', 'River Rim')]
    expect(
      narrativeClaimFindings({ narrative: 'Garrison in River Rim was excluded as a different neighborhood.', priced: [garrison[1]!], candidates: garrison, subject }),
    ).toEqual([])
  })

  it('flags a sale named as kept that is not priced', () => {
    const set = [c('N', '1251 Newport', 'Grandview'), c('F', '515 Federal', 'Highland')]
    expect(
      kinds(
        narrativeClaimFindings({ narrative: 'Two closed sales were kept, 1251 Newport and 515 Federal.', priced: [set[0]!, c('Z', '1393 Newport', 'Northwest Townsite')], candidates: set, subject }),
      ),
    ).toEqual(['kept-not-priced'])
  })

  it('skips a clause that says both kept and dropped, and stays quiet without candidates', () => {
    expect(
      narrativeClaimFindings({ narrative: 'After excluding Prairie Crossing, four comps remain.', priced, candidates: priced, subject }),
    ).toEqual([])
    expect(narrativeClaimFindings({ narrative: 'Prairie Crossing was dropped.', priced, subject })).toEqual([])
  })

  it('splits a sentence at ", and" so a later drop clause is read on its own', () => {
    const set = [c('A', '2843 Lotno', 'Choctaw Village'), c('B', '2807 Lotno', 'Choctaw Village'), c('C', '660 Innes', 'Neal')]
    expect(
      kinds(
        narrativeClaimFindings({
          narrative: 'Three closed sales were kept, and 2843 Lotno was dropped as a 4-bedroom.',
          priced: set,
          candidates: set,
          subject,
        }),
      ),
    ).toEqual(['dropped-but-priced'])
  })
})

describe('weight claims', () => {
  it('flags full weight on a half-weight sale and half weight on a full-weight one (cma-3759-45th)', () => {
    const set = [
      c('1', '4733 Badger', 'North Trailside', 0.19, 'weak'),
      c('2', '4119 Badger', 'Prairie Crossing', 0.14, 'strong'),
      c('3', '4701 Coyote', 'North Trailside', 0.15, 'weak'),
      c('4', '4255 Badger', 'Kampstra', 0.35, 'strong'),
    ]
    const out = narrativeClaimFindings({
      narrative: '4733 Badger, 4119 Badger, and 4701 Coyote are half weight. 4255 Badger is full weight.',
      priced: set,
      subject,
    })
    expect(kinds(out)).toEqual(['weight'])
    expect(out[0]!.claim).toContain('4119 Badger')
  })

  it('passes weights that match (cma-20726-russell)', () => {
    const set = [c('G', '63266 Gallop', 'Wishing Well', 0.24, 'weak'), c('N1', '20706 Nicolette', 'Boyd'), c('N2', '20735 Nicolette', 'Boyd', 0.22, 'weak')]
    expect(
      narrativeClaimFindings({ narrative: '20706 Nicolette is full weight. 63266 Gallop and 20735 Nicolette are half weight.', priced: set, subject }),
    ).toEqual([])
  })

  it('skips a street whose priced sales carry mixed weights', () => {
    const set = [c('T1', '3847 Tellus', 'Petrosa', 0.09, 'strong'), c('T2', '3759 Tellus', 'Petrosa', 0.08, 'weak')]
    expect(narrativeClaimFindings({ narrative: 'The Tellus sales are half weight.', priced: set, subject })).toEqual([])
  })

  it('does not attribute the weight to a plat named only as a place (cma-1764-lariat regression)', () => {
    const set = [c('L', '1358 Linda', 'River Pine Estates', 1.04, 'strong'), c('A', '149218 Auderine', 'River Pine Estates', 1.03, 'strong')]
    const out = narrativeClaimFindings({
      narrative: '1358 Linda and 149218 Auderine are in River Pine Estates and carry half weight.',
      priced: set,
      subject,
    })
    expect(out.map((f) => f.claim).join(' ')).not.toContain('River Pine Estates at')
    expect(kinds(out)).toEqual(['weight', 'weight'])
  })

  it('reads nothing when the set carries no tiers', () => {
    const set = [c('A', '100 Oak', null, 0.2, null)]
    expect(narrativeClaimFindings({ narrative: 'The Oak sale is half weight.', priced: set, subject })).toEqual([])
  })
})

describe('lot claims', () => {
  it('flags a kept-set lot range a priced sale falls outside (cma-10942-village)', () => {
    const set = [
      c('1', '1061 Golden Pheasant', 'Eagle Crest', 0.04),
      c('2', '8505 Golden Pheasant', 'Eagle Crest', 0.05),
      c('3', '1325 Highland View', 'Eagle Crest', 0.07),
    ]
    const out = narrativeClaimFindings({
      narrative: 'Kept sales share 3 bedrooms, 1997-2002 construction, and lots of 0.04 to 0.05 acres.',
      priced: set,
      subject: { streetAddress: '10942 Village', lotAcres: 0.06 },
    })
    expect(kinds(out)).toEqual(['lot'])
    expect(out[0]!.evidence).toContain('1325 Highland View on 0.07 acres')
  })

  it('passes a range the priced sales support (cma-60335-zuni)', () => {
    const set = [c('1', '19413 Piute', 'Deschutes RiverWoods', 0.86), c('2', '60451 Umatilla', 'Deschutes RiverWoods', 0.55), c('3', '60326 Hiawatha', 'Deschutes RiverWoods', 0.84)]
    expect(
      narrativeClaimFindings({
        narrative: 'The kept sales are 1188 to 1344 square feet on 0.55 to 0.86 acres, built 1993 to 1997.',
        priced: set,
        subject: { streetAddress: '60335 Zuni', lotAcres: 0.7 },
      }),
    ).toEqual([])
  })

  it('calls a lot claim unsupported when a sale it covers has no lot size on record', () => {
    const set = [c('1', '100 Park', 'Woods', 1.0), c('2', '200 Cougar', 'Woods', null)]
    const out = narrativeClaimFindings({
      narrative: 'All three kept sales share roughly one-acre wooded lots. They sit on about an acre each.',
      priced: set,
      subject: { streetAddress: '9 Main', lotAcres: 2 },
    })
    // Both sentences cover 200 Cougar, which carries no lot size.
    expect(kinds(out)).toEqual(['lot', 'lot'])
    for (const f of out) expect(f.evidence).toContain('No lot size on record: 200 Cougar')
  })

  it('reads a figure after "against" or "versus" as the subject\'s', () => {
    const set = [c('1', '17766 Balsam', 'Fairway Crest Village', 0.26), c('2', '57692 Vine Maple', 'Fairway Crest Village', 0.28), c('3', '57625 Red Cedar', 'Fairway Crest Village', 0.24)]
    const s = { streetAddress: '57776 Umpqua', lotAcres: 0.58 }
    expect(narrativeClaimFindings({ narrative: "Lot size on the kept sales is 0.24ac to 0.28ac against the subject's 0.58ac.", priced: set, subject: s })).toEqual([])
    expect(narrativeClaimFindings({ narrative: 'Lot sizes on the kept set run 0.24 to 0.28 acre versus 0.58 acre at Umpqua.', priced: set, subject: s })).toEqual([])
  })

  it('does not read a drop threshold or a figure equal to the subject\'s lot as a kept-set claim', () => {
    const set = [c('1', '19765 Clarion', 'Forest Meadows', 0.13)]
    const s = { streetAddress: '20016 Mount Hope', lotAcres: 0.1 }
    expect(narrativeClaimFindings({ narrative: 'Lots under 0.35 acres were dropped.', priced: set, subject: s })).toEqual([])
    expect(narrativeClaimFindings({ narrative: 'Clarion matches the 3-bed 0.1 ac 2005-era profile with no HOA.', priced: set, subject: s })).toEqual([])
  })

  it('reads a hyphenated figure ("roughly one-acre")', () => {
    const set = [c('1', '100 Park', 'Woods', 5.0)]
    expect(
      kinds(
        narrativeClaimFindings({
          narrative: 'All three kept sales share roughly one-acre wooded lots.',
          priced: set,
          subject: { streetAddress: '9 Main', lotAcres: 2 },
        }),
      ),
    ).toEqual(['lot'])
  })

  it('widens the tolerance for "about"', () => {
    const set = [c('1', '16171 South', 'Anderson Acres', 1.01), c('2', '16050 Dick', 'Lynne Acres', 0.97), c('3', '15989 Bull Bat', 'Tall Pines', 1.04)]
    expect(
      narrativeClaimFindings({
        narrative: '16171 South, 16050 Dick, and 15989 Bull Bat are 3-bedroom homes on about an acre built 2014 to 2022.',
        priced: set,
        subject: { streetAddress: '16083 Dyke', lotAcres: 0.86 },
      }),
    ).toEqual([])
  })

  it('skips a name that is both a street and a plat covering different sales (cma-683-providence regression)', () => {
    const set = [
      c('P0', '653 Providence', 'Crosswinds', 0.1),
      c('P1', '3128 Cromwell', 'Providence', 0.19),
      c('P2', '3023 Lansing', 'Providence', 0.2),
      c('P3', '955 Locksley', 'Providence', 0.22),
      c('P4', '1131 Locksley', 'Providence', 0.19),
    ]
    expect(
      narrativeClaimFindings({
        narrative: 'The other four are 1993-1995 Providence homes on 0.19 to 0.22 acre lots.',
        priced: set,
        subject: { streetAddress: '683 Providence', lotAcres: 0.2 },
      }),
    ).toEqual([])
  })
})

describe('sentences, addresses, and stripping', () => {
  it('splits sentences without breaking decimals or dollar figures', () => {
    expect(splitNarrativeSentences('Sold at $1.025M on 0.55 to 0.86 acres. Built 1993 to 1997. Mt. Bachelor views!')).toEqual([
      'Sold at $1.025M on 0.55 to 0.86 acres.',
      'Built 1993 to 1997.',
      'Mt. Bachelor views!',
    ])
  })

  it('parses an address into its number and street', () => {
    expect(parseAddress('2173 Kingwood')).toEqual({ number: '2173', street: 'Kingwood' })
    expect(parseAddress('1223 NW Fresno Ave, Bend')).toEqual({ number: '1223', street: 'Fresno' })
    expect(parseAddress('20696 Barton Crossing')).toEqual({ number: '20696', street: 'Barton Crossing' })
    expect(parseAddress('15622 6th')).toEqual({ number: '15622', street: '6th' })
  })

  it('removes only the refuted sentences', () => {
    const set = [c('1', '3886 Coyote', 'Triple Ridge'), c('3', '4100 Coyote', 'Prairie Crossing', 0.07, 'weak')]
    const { narrative, removed } = stripRefutedSentences({
      narrative:
        'Two Triple Ridge sales were kept. Prairie Crossing was dropped for community amenities. Subject condition is unknown beyond the listing remarks.',
      priced: set,
      candidates: set,
      subject,
    })
    expect(narrative).toBe('Subject condition is unknown beyond the listing remarks.')
    expect(removed.map((f) => f.kind).sort()).toEqual(['count', 'dropped-but-priced'])
  })

  it('returns nothing for an empty narrative or an empty priced set', () => {
    expect(narrativeClaimFindings({ narrative: '', priced: [c('1', '1 Oak', null)], subject })).toEqual([])
    expect(narrativeClaimFindings({ narrative: 'Three sales were kept.', priced: [], subject })).toEqual([])
  })
})
