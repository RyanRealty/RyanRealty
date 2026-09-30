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
import { narrativeClaimFindings, parseAddress, splitNarrativeSentences, stripRefutedSentences, type ClaimComp } from '@/lib/cma/narrative-claims'

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
    expect(narrativeClaimFindings({ narrative: 'Five closed sales are kept at half weight.', priced: five, subject })).toEqual([])
    expect(narrativeClaimFindings({ narrative: 'Five sales were retained.', priced: five, subject })).toEqual([])
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
