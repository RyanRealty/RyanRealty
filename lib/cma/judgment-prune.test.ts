import { describe, expect, it } from 'vitest'
import { MIN_COMPS } from '@/lib/cma/comps'
import { PRICING_MIN_COMPS } from '@/lib/pricing/ladder'
import { isHardProductExclusion, pricingCompsAfterJudgment } from '@/lib/cma/judgment-prune'
import { reviewWeightFactor } from '@/lib/cma/review-weight'
import { isPriceTierExclusion } from '@/lib/cma/judge-consistency'

const sale = (listingKey: string, yearBuilt: number, propertySubType = 'Townhouse') => ({
  listingKey,
  yearBuilt,
  propertySubType,
})

const sfr = (listingKey: string, extra: Record<string, unknown> = {}) => ({
  listingKey,
  yearBuilt: 2004,
  propertySubType: 'Single Family Residence',
  publicRemarks: 'Single level home with a fenced yard.',
  subdivision: 'Canyon Rim Village',
  ownPlat: false as boolean | null,
  ...extra,
})

const kept = (listingKey: string, tier: 'strong' | 'weak' = 'strong') => ({
  listingKey,
  tier,
  basis: 'not-excluded',
  reason: 'Kept.',
})
const excluded = (listingKey: string, basis = 'vintage') => ({
  listingKey,
  tier: 'exclude',
  basis,
  reason: 'Built 2020, a different construction generation.',
})

const SFR_SUBJECT = {
  propertySubType: 'Single Family Residence',
  yearBuilt: 2004,
  newConstructionYn: false,
  publicRemarks: 'Welcome to Canyon Rim Village, a corner lot with a fenced backyard.',
  subdivision: 'Canyon Rim Village',
}

describe('one comp floor, and the review keep is what prices (Falcon re-admission retired 2026-09-30)', () => {
  it('holds one floor of three across both ladders (SKILL.md 0.1)', () => {
    expect(MIN_COMPS).toBe(3)
    expect(PRICING_MIN_COMPS).toBe(3)
  })

  it('prices the four the review kept, never the sale it excluded (cma-3153-cromwell)', () => {
    const selected = ['cromwell', 'matthew', 'lansing', 'locksley-955', 'locksley-1131'].map((k) => sfr(k))
    const verdicts = [
      kept('cromwell'),
      excluded('matthew'),
      kept('lansing'),
      kept('locksley-955'),
      kept('locksley-1131', 'weak'),
    ]
    const gated = pricingCompsAfterJudgment({
      selected,
      vetted: selected.filter((c) => c.listingKey !== 'matthew'),
      verdicts,
      subject: SFR_SUBJECT,
      minComps: MIN_COMPS,
      asOfYear: 2026,
    })
    expect(gated.shortage).toBe(false)
    expect(gated.comps.map((c) => c.listingKey)).toEqual(['cromwell', 'lansing', 'locksley-955', 'locksley-1131'])
    expect(gated.comps.some((c) => c.listingKey === 'matthew')).toBe(false)
    expect(gated.trace).toContain('1 excluded by the comparability review')
  })

  it('no longer prices a filled ladder when the review keeps three of eight', () => {
    const selected = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((id, i) => sale(id, 2008 + i, 'Single Family Residence'))
    const vetted = selected.slice(0, 3)
    const verdicts = selected.map((c) => ({
      listingKey: c.listingKey,
      tier: vetted.some((v) => v.listingKey === c.listingKey) ? 'strong' : 'exclude',
      basis: vetted.some((v) => v.listingKey === c.listingKey) ? 'not-excluded' : 'price-tier',
      reason: 'Sold outside the dollar band.',
    }))
    const gated = pricingCompsAfterJudgment({
      selected,
      vetted,
      verdicts,
      subject: { propertySubType: 'Single Family Residence', yearBuilt: 2010, newConstructionYn: false },
      minComps: MIN_COMPS,
      asOfYear: 2026,
    })
    expect(gated.shortage).toBe(false)
    expect(gated.droppedProduct).toBe(0)
    expect(gated.comps.map((c) => c.listingKey)).toEqual(['a', 'b', 'c'])
  })

  it('is a comp shortage, not a price off the excluded sales, when the review keeps two', () => {
    const selected = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((id) => sfr(id))
    const gated = pricingCompsAfterJudgment({
      selected,
      vetted: selected.slice(0, 2),
      verdicts: selected.map((c, i) => (i < 2 ? kept(c.listingKey) : excluded(c.listingKey))),
      subject: SFR_SUBJECT,
      minComps: MIN_COMPS,
      asOfYear: 2026,
    })
    expect(gated.shortage).toBe(true)
    expect(gated.comps.map((c) => c.listingKey)).toEqual(['a', 'b'])
    expect(gated.trace).toContain('The excluded sales are not priced')
  })

  it('prices the product-matched pool when the review did not run', () => {
    const selected = [sfr('a'), sfr('b'), sale('town', 2010, 'Townhouse'), sfr('c')]
    const gated = pricingCompsAfterJudgment({
      selected,
      vetted: selected,
      verdicts: [],
      subject: SFR_SUBJECT,
      minComps: MIN_COMPS,
      asOfYear: 2026,
    })
    expect(gated.shortage).toBe(false)
    expect(gated.droppedProduct).toBe(1)
    expect(gated.comps.map((c) => c.listingKey)).toEqual(['a', 'b', 'c'])
  })
})

describe('pricing comps stay on the product the audit can defend', () => {
  const subject = { propertySubType: 'Townhouse', yearBuilt: 2015, newConstructionYn: false }
  const asOfYear = 2026

  it('does not price a new townhome the judge excluded', () => {
    const selected = [1, 2, 3, 4, 5].map((n) => sale(`new-${n}`, 2026))
    const verdicts = selected.map((c) => ({
      listingKey: c.listingKey,
      tier: 'exclude',
      basis: 'structure-type',
      reason: 'New townhome, not this rowhouse.',
    }))
    const gated = pricingCompsAfterJudgment({
      selected,
      vetted: [],
      verdicts,
      subject,
      minComps: MIN_COMPS,
      asOfYear,
    })
    expect(gated.comps).toEqual([])
    expect(gated.shortage).toBe(true)
    expect(gated.droppedProduct).toBe(5)
  })

  it('shortages when the only product-matched sale is one and the weighted one is a different product', () => {
    const matched = sale('mews', 2018, 'Condominium')
    const other = sale('pines', 2001, 'Condominium')
    const gated = pricingCompsAfterJudgment({
      selected: [other, matched],
      vetted: [matched],
      verdicts: [
        { listingKey: 'pines', tier: 'exclude', basis: 'structure-type', reason: 'Different condo product.' },
        { listingKey: 'mews', tier: 'weak', basis: 'not-excluded', reason: 'Same project.' },
      ],
      subject: { propertySubType: 'Condominium', yearBuilt: 2018, newConstructionYn: false },
      minComps: MIN_COMPS,
      asOfYear,
    })
    expect(gated.comps.map((c) => c.listingKey)).toEqual(['mews'])
    expect(gated.shortage).toBe(true)
  })

  it('drops a new build against a resale even when the judge kept it', () => {
    const selected = [sale('new', 2026), sale('resale', 2014), sale('resale-2', 2012), sale('resale-3', 2010)]
    const gated = pricingCompsAfterJudgment({
      selected,
      vetted: selected,
      verdicts: selected.map((c) => ({
        listingKey: c.listingKey,
        tier: 'strong',
        basis: 'not-excluded',
        reason: 'Kept.',
      })),
      subject,
      minComps: MIN_COMPS,
      asOfYear,
    })
    expect(gated.comps.map((c) => c.listingKey)).toEqual(['resale', 'resale-2', 'resale-3'])
    expect(gated.shortage).toBe(false)
    expect(gated.droppedProduct).toBe(1)
  })

  it('shortages a widened set the judge kept none of, instead of pricing those sales', () => {
    // Four sales, same subtype as a 1924 subject, years 1972 through 2021.
    // None is a new build. The judge excluded every one.
    const selected = [
      sale('a', 1972, 'Single Family Residence'),
      sale('b', 2011, 'Single Family Residence'),
      sale('c', 2021, 'Single Family Residence'),
      sale('d', 1976, 'Single Family Residence'),
    ]
    const gated = pricingCompsAfterJudgment({
      selected,
      vetted: [],
      verdicts: selected.map((c) => ({
        listingKey: c.listingKey,
        tier: 'exclude',
        basis: 'vintage',
        reason: 'A different construction generation from the 1924 subject.',
      })),
      subject: { propertySubType: 'Single Family Residence', yearBuilt: 1924, newConstructionYn: false },
      minComps: MIN_COMPS,
      asOfYear: 2026,
    })
    expect(gated.droppedProduct).toBe(0)
    expect(gated.comps).toEqual([])
    expect(gated.shortage).toBe(true)
  })

  it('does not treat a same-street price cut as a product exclusion', () => {
    const price = {
      listingKey: 'twin',
      tier: 'exclude' as const,
      basis: 'price-tier' as const,
      reason: 'Sold at $246 a foot, outside the band.',
    }
    const product = {
      listingKey: 'pines',
      tier: 'exclude' as const,
      basis: 'structure-type' as const,
      reason: 'Different product on a street that shares the first word.',
    }
    expect(isPriceTierExclusion(price)).toBe(true)
    expect(isHardProductExclusion(price)).toBe(false)
    expect(isPriceTierExclusion(product)).toBe(false)
    expect(isHardProductExclusion(product)).toBe(true)
  })
})

describe('age-restricted housing is a different product at the backstop', () => {
  const waverly = sfr('hemlock-2933', {
    publicRemarks: 'Single level home in a 55+ community in NW Redmond.',
    subdivision: 'Waverly',
  })
  const ordinary = ['kingwood-1572', 'nineteenth-914', 'kingwood-1550'].map((k) => sfr(k, { ownPlat: true }))

  it('drops a 55+ sale the review kept from an ordinary subject (cma-1733-hemlock)', () => {
    const selected = [waverly, ...ordinary]
    const gated = pricingCompsAfterJudgment({
      selected,
      vetted: selected,
      verdicts: selected.map((c) => kept(c.listingKey, c === waverly ? 'weak' : 'strong')),
      subject: SFR_SUBJECT,
      minComps: MIN_COMPS,
      asOfYear: 2026,
    })
    expect(gated.droppedProduct).toBe(1)
    expect(gated.comps.map((c) => c.listingKey)).toEqual(['kingwood-1572', 'nineteenth-914', 'kingwood-1550'])
    expect(gated.shortage).toBe(false)
  })

  it('keeps it for a subject whose remarks say it is 55+ too', () => {
    const selected = [waverly, ...ordinary]
    const gated = pricingCompsAfterJudgment({
      selected,
      vetted: selected,
      verdicts: selected.map((c) => kept(c.listingKey)),
      subject: { ...SFR_SUBJECT, publicRemarks: 'Easy living in a 55 & over community.', subdivision: 'Waverly' },
      minComps: MIN_COMPS,
      asOfYear: 2026,
    })
    expect(gated.droppedProduct).toBe(0)
    expect(gated.comps).toHaveLength(4)
  })

  it('keeps own-plat 55+ sales for a subject whose plat is mostly 55+ (The Pines at Sisters)', () => {
    const pines = [1, 2, 3].map((n) =>
      sfr(`pines-${n}`, { publicRemarks: 'The Pines 55+ gated community.', subdivision: 'Pines At Sisters', ownPlat: true }),
    )
    const gated = pricingCompsAfterJudgment({
      selected: pines,
      vetted: pines,
      verdicts: pines.map((c) => kept(c.listingKey)),
      subject: { ...SFR_SUBJECT, publicRemarks: 'Live in Sisters\' gated neighborhood!', subdivision: 'Pines At Sisters' },
      minComps: MIN_COMPS,
      asOfYear: 2026,
    })
    expect(gated.droppedProduct).toBe(0)
    expect(gated.comps).toHaveLength(3)
  })

  it('walls a sale whose MLS SeniorCommunityYN is true, with no remarks at all, from an ordinary subject', () => {
    const flagged = sfr('flagged', { publicRemarks: null, subdivision: 'Brookside', seniorCommunityYn: true })
    const selected = [flagged, ...ordinary]
    const gated = pricingCompsAfterJudgment({
      selected,
      vetted: selected,
      verdicts: selected.map((c) => kept(c.listingKey)),
      subject: SFR_SUBJECT,
      minComps: MIN_COMPS,
      asOfYear: 2026,
    })
    expect(gated.droppedProduct).toBe(1)
    expect(gated.comps.map((c) => c.listingKey)).not.toContain('flagged')
  })

  it('treats a subject whose MLS SeniorCommunityYN is true as 55+, so a 55+ sale prices it', () => {
    const selected = [waverly, ...ordinary]
    const gated = pricingCompsAfterJudgment({
      selected,
      vetted: selected,
      verdicts: selected.map((c) => kept(c.listingKey)),
      subject: { ...SFR_SUBJECT, seniorCommunityYn: true },
      minComps: MIN_COMPS,
      asOfYear: 2026,
    })
    expect(gated.droppedProduct).toBe(0)
    expect(gated.comps).toHaveLength(4)
  })

  it('counts flagged own-plat sales toward the plat-majority share', () => {
    // Two of three own-plat sales carry the flag and no 55+ remarks: the plat
    // is a 55+ community, so its flagged sales price the subject.
    const plat = [
      sfr('w-1', { publicRemarks: 'Single level.', subdivision: 'Waverly', ownPlat: true, seniorCommunityYn: true }),
      sfr('w-2', { publicRemarks: 'Single level.', subdivision: 'Waverly', ownPlat: true, seniorCommunityYn: true }),
      sfr('w-3', { publicRemarks: 'Single level.', subdivision: 'Waverly', ownPlat: true, seniorCommunityYn: false }),
    ]
    const gated = pricingCompsAfterJudgment({
      selected: plat,
      vetted: plat,
      verdicts: plat.map((c) => kept(c.listingKey)),
      subject: { ...SFR_SUBJECT, publicRemarks: 'Single level home.', subdivision: 'Waverly' },
      minComps: MIN_COMPS,
      asOfYear: 2026,
    })
    expect(gated.droppedProduct).toBe(0)
    expect(gated.comps).toHaveLength(3)
  })

  it('reads the facts ladder\'s plat share over the candidates when it has one', () => {
    const falls = sfr('falls', {
      publicRemarks: 'Home in The Falls, a 55+ Active Adult Community at Eagle Crest.',
      subdivision: 'Eagle Crest',
      ownPlat: true,
    })
    const crest = ['crest-1', 'crest-2', 'crest-3'].map((k) => sfr(k, { subdivision: 'Eagle Crest', ownPlat: true }))
    const eagleCrestSubject = { ...SFR_SUBJECT, publicRemarks: 'On the fourth tee of the Challenge Course.', subdivision: 'Eagle Crest' }
    const selected = [falls, ...crest]
    const run = (ownPlatAgeRestrictedShare?: number | null) =>
      pricingCompsAfterJudgment({
        selected,
        vetted: selected,
        verdicts: selected.map((c) => kept(c.listingKey)),
        subject: eagleCrestSubject,
        minComps: MIN_COMPS,
        asOfYear: 2026,
        ...(ownPlatAgeRestrictedShare !== undefined ? { ownPlatAgeRestrictedShare } : {}),
      })
    // Measured over the candidates: one Falls sale of four own-plat sales.
    expect(run().comps.map((c) => c.listingKey)).toEqual(['crest-1', 'crest-2', 'crest-3'])
    // The pool said the plat is mostly 55+: then the subject is too.
    expect(run(0.8).comps).toHaveLength(4)
  })
})

describe('cheap pocket sale after bath and size review', () => {
  it('drops Juniper once the review removes the last own-plat sale, and does not add 2834 or 1216', () => {
    const indian = sfr('INDIAN-2834', {
      ownPlat: true,
      closePrice: 740_000,
      selectionTier: 'subdivision-12mo',
      baths: 2,
    })
    const juniper = sfr('JUNIPER-3331', {
      ownPlat: false,
      closePrice: 475_000,
      selectionTier: 'pocket-12mo',
    })
    const glen = ['GLEN-A', 'GLEN-B', 'GLEN-C'].map((key, i) =>
      sfr(key, {
        ownPlat: false,
        closePrice: 740_000 + i * 40_000,
        selectionTier: 'nearby-1mi-12mo',
      }),
    )
    const selected = [indian, juniper, ...glen]
    const gated = pricingCompsAfterJudgment({
      selected,
      vetted: selected.filter((c) => c.listingKey !== 'INDIAN-2834'),
      verdicts: [
        { listingKey: 'INDIAN-2834', tier: 'exclude', basis: 'baths', reason: '2 baths against the subject 3.' },
        kept('JUNIPER-3331'),
        ...glen.map((c) => kept(c.listingKey)),
      ],
      subject: SFR_SUBJECT,
      minComps: MIN_COMPS,
      asOfYear: 2026,
    })
    const keys = gated.comps.map((c) => c.listingKey)
    expect(keys).toEqual(['GLEN-A', 'GLEN-B', 'GLEN-C'])
    expect(keys).not.toContain('JUNIPER-3331')
    expect(keys).not.toContain('INDIAN-2834')
    expect(keys).not.toContain('HAYDEN-1216')
    expect(gated.shortage).toBe(false)
    expect(gated.trace).toContain('1 pocket sale(s) under every remaining kept comp')
  })

  it('leaves the pocket sale when an own-plat sale is still in the reviewed set', () => {
    const indian = sfr('INDIAN-2834', {
      ownPlat: true,
      closePrice: 740_000,
      selectionTier: 'subdivision-12mo',
    })
    const juniper = sfr('JUNIPER-3331', {
      ownPlat: false,
      closePrice: 475_000,
      selectionTier: 'pocket-12mo',
    })
    const glen = ['GLEN-A', 'GLEN-B'].map((key, i) =>
      sfr(key, { ownPlat: false, closePrice: 760_000 + i * 20_000, selectionTier: 'nearby-1mi-12mo' }),
    )
    const selected = [indian, juniper, ...glen]
    const gated = pricingCompsAfterJudgment({
      selected,
      vetted: selected,
      verdicts: selected.map((c) => kept(c.listingKey)),
      subject: SFR_SUBJECT,
      minComps: MIN_COMPS,
      asOfYear: 2026,
    })
    const keys = gated.comps.map((c) => c.listingKey)
    expect(keys).toContain('INDIAN-2834')
    expect(keys).toContain('JUNIPER-3331')
    expect(keys).not.toContain('HAYDEN-1216')
  })
})

describe('reviewWeightFactor', () => {
  it('halves weak only: strong, an exclude on a broker-picked set, and no verdict all carry full weight', () => {
    // A broker-picked set prices as chosen (SKILL.md 0.1). Halving an exclude
    // there changed the price on curated CMAs the 2026-09-29 defect never
    // touched, and no ruling asked for it (review of da8dce6, 2026-09-30). An
    // automatic set never prices an exclude, so the factor never meets one.
    expect(reviewWeightFactor('strong')).toBe(1)
    expect(reviewWeightFactor('weak')).toBe(0.5)
    expect(reviewWeightFactor('exclude')).toBe(1)
    expect(reviewWeightFactor(undefined)).toBe(1)
    expect(reviewWeightFactor(null)).toBe(1)
  })
})
