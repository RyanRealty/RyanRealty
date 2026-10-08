import { describe, expect, it } from 'vitest'
import {
  classifyAgeBand,
  classifyHoa,
  classifyLot,
  classifyProduct,
  classifySewer,
  classifyStory,
  classifyWater,
  extractRemarkFlags,
  irrigationClassFromOwrd,
  irrigationClassFromRemarks,
  irrigationCompatible,
  customBathCompatible,
  customLotCompatible,
  dropsResaleVersusNewBuild,
  isCustomOrNewSubject,
  isNeverOwnedNewConstruction,
  RESALE_COMPETES_WITH_NEVER_OWNED_YEARS,
  subtypeMarksCustomOrNew,
  isNewBuild,
  newConstructionCompatible,
  resolveIrrigationClass,
  yearQualityCompatible,
  plausibleListedClose,
  hoaCompatible,
  lotCompatible,
  normSubdivision,
  productCompatible,
  sewerCompatible,
  similarPerformingSubdivision,
  untieredSalePriceTierOk,
  ONE_STORY_PREMIUM,
  storyAdjustment,
  waterCompatible,
  multiUnitFromRemarks,
  productClassFromFactsRow,
  aduFromRemarks,
  aduSaleRefused,
} from '@/lib/pricing/classes'

describe('classifyWater', () => {
  it('reads Spark WaterSource objects', () => {
    expect(classifyWater({ Well: true })).toBe('well')
    expect(classifyWater({ Public: true })).toBe('public')
    expect(classifyWater({ Private: true, 'Shared Well': true })).toBe('well')
    expect(classifyWater({ Public: true, 'Water Meter': true })).toBe('public')
    // Private alone is community water at Caldera and a well on a ranch. Do not guess.
    expect(classifyWater({ Private: true })).toBe('unknown')
  })
  it('treats empty as unknown', () => {
    expect(classifyWater(null)).toBe('unknown')
    expect(classifyWater('')).toBe('unknown')
  })
})

describe('classifySewer', () => {
  it('reads CSV and Spark objects', () => {
    expect(classifySewer('Septic Tank, Standard Leach Field')).toBe('septic')
    expect(classifySewer({ 'Public Sewer': true })).toBe('public')
    expect(classifySewer({ 'Private Sewer': true })).toBe('private')
    expect(classifySewer({ 'Septic Tank': true, 'Public Sewer': true })).toBe('septic')
  })
  it('treats MLS Septic Needed as unknown — not an installed septic system', () => {
    expect(classifySewer('Septic Needed')).toBe('unknown')
    expect(classifySewer({ 'Septic Needed': true })).toBe('unknown')
    expect(sewerCompatible(classifySewer('Septic Needed'), 'public')).toBe(true)
  })
})

describe('classifyHoa / lot / story / product', () => {
  it('hoa follows the MLS yes/fee, not a guess', () => {
    expect(classifyHoa(true, 150)).toBe('hoa')
    expect(classifyHoa(false, 0)).toBe('no_hoa')
    expect(classifyHoa(null, null)).toBe('unknown')
    expect(classifyHoa(null, 200)).toBe('hoa')
  })
  it('splits lot at 0.4 / 1 / 5 acres', () => {
    expect(classifyLot(0.15)).toBe('in_town')
    expect(classifyLot(0.55)).toBe('large_lot')
    expect(classifyLot(1)).toBe('acreage')
    expect(classifyLot(12)).toBe('ranch')
    expect(classifyLot(null)).toBe('unknown')
  })
  it('reads levels JSON and text; stories_total is unused in this MLS', () => {
    expect(classifyStory({ One: true }, null)).toBe('one')
    expect(classifyStory({ Two: true }, null)).toBe('two')
    expect(classifyStory('One', null)).toBe('one')
    expect(classifyStory({ 'Three Or More': true }, null)).toBe('three_plus')
    expect(classifyStory(null, null)).toBe('unknown')
  })
  it('keeps townhouse, condo, and detached as distinct products', () => {
    expect(classifyProduct('Single Family Residence')).toBe('detached')
    expect(classifyProduct('Townhouse')).toBe('townhouse')
    expect(classifyProduct('Condominium')).toBe('condo')
    expect(classifyProduct('Manufactured On Land')).toBe('manufactured')
    expect(productCompatible('detached', 'townhouse')).toBe(false)
    expect(productCompatible('townhouse', 'condo')).toBe(false)
    expect(productCompatible('detached', 'unknown')).toBe(false)
  })
})

describe('age band — match key, not a depreciation schedule', () => {
  it('bands from the as-of year', () => {
    expect(classifyAgeBand(2024, 2026)).toBe('new')
    expect(classifyAgeBand(2014, 2026)).toBe('mid')
    expect(classifyAgeBand(2000, 2026)).toBe('established')
    expect(classifyAgeBand(1980, 2026)).toBe('vintage')
    expect(classifyAgeBand(1960, 2026)).toBe('historic')
    expect(classifyAgeBand(2146, 2026)).toBe('unknown')
  })
})

describe('hard comparability', () => {
  it('does not mix well and city water when both are known', () => {
    expect(waterCompatible('well', 'public')).toBe(false)
    expect(waterCompatible('well', 'unknown')).toBe(true)
  })
  it('does not mix septic and public sewer', () => {
    expect(sewerCompatible('septic', 'public')).toBe(false)
    expect(sewerCompatible('septic', 'private')).toBe(true)
  })
  it('does not mix HOA and no-HOA when both are known', () => {
    expect(hoaCompatible('hoa', 'no_hoa')).toBe(false)
    expect(hoaCompatible('hoa', 'unknown')).toBe(true)
  })
  it('never mixes acreage with an in-town lot', () => {
    expect(lotCompatible(0.2, 2)).toBe(false)
    expect(lotCompatible(0.2, 0.3)).toBe(true)
    expect(lotCompatible(2, 3)).toBe(true)
    expect(lotCompatible(2, 40)).toBe(false)
    expect(lotCompatible(null, 2)).toBe(true)
  })

  /**
   * Falcon 15991: subject 0.96 ac ("not acreage") was cliff-split from same-plat
   * Tall Pines peers at 1.01–1.08. Nearly one acre is the same product. A half
   * acre and two acres are not.
   */
  it('treats near-acre lots as one class (0.96 vs 1.08 same; 0.5 vs 2.0 different)', () => {
    expect(lotCompatible(0.96, 1.08)).toBe(true)
    expect(lotCompatible(1.08, 0.96)).toBe(true)
    expect(lotCompatible(0.96, 1.01)).toBe(true)
    expect(lotCompatible(0.75, 1.25)).toBe(true)
    expect(lotCompatible(0.5, 2.0)).toBe(false)
    expect(lotCompatible(2.0, 0.5)).toBe(false)
    expect(lotCompatible(0.96, 2.0)).toBe(false)
    expect(lotCompatible(0.74, 1.26)).toBe(false)
  })
})

describe('similar-performing subdivision (the gated / different-tier cut)', () => {
  it('keeps Tetherow next to Discovery West and drops Stone Creek', () => {
    expect(similarPerformingSubdivision(749, 48, 708, 36)).toBe(true)
    expect(similarPerformingSubdivision(749, 48, 301, 48)).toBe(false)
    expect(similarPerformingSubdivision(301, 48, 749, 48)).toBe(false)
  })
  it('fails open on a thin subdivision', () => {
    expect(similarPerformingSubdivision(749, 48, 200, 3)).toBe(true)
    expect(similarPerformingSubdivision(null, 0, 301, 48)).toBe(true)
  })

  /**
   * D12 (2026-08-27): 291 Bluff sold at $695/sqft and entered the Plaza's comp
   * set solely because its SubdivisionName is 'N/A'. No subdivision name means
   * no cell, and no cell means similarPerformingSubdivision fails open, so the
   * guard that had already excluded 11 named candidates could not see it. It
   * lifted the set mean about $72K. The sale's own $/sqft is the evidence the
   * cell would have carried.
   */
  it('D12 — cuts an unnamed-subdivision sale that sits a tier off the subject on its own $/sqft', () => {
    // The Plaza at roughly $450/sqft over 22 recorded sales; 291 Bluff at $695.
    expect(untieredSalePriceTierOk(450, 22, 695)).toBe(false)
    expect(untieredSalePriceTierOk(450, 22, 470)).toBe(true)
    // Symmetric: a bargain-tier sale is as wrong as a luxury one.
    expect(untieredSalePriceTierOk(450, 22, 300)).toBe(false)
  })

  it('D12 — fails open when the subject cell is thin or the sale has no $/sqft', () => {
    expect(untieredSalePriceTierOk(450, 3, 695)).toBe(true)
    expect(untieredSalePriceTierOk(null, 22, 695)).toBe(true)
    expect(untieredSalePriceTierOk(450, 22, null)).toBe(true)
    expect(untieredSalePriceTierOk(450, 22, 0)).toBe(true)
  })

  it('drops Awbrey Woods tract against Awbrey Butte custom inside the same neighborhood', () => {
    expect(similarPerformingSubdivision(457.29, 86, 381.85, 7, 1.15)).toBe(false)
    expect(similarPerformingSubdivision(457.29, 86, 381.85, 7)).toBe(true)
  })
})

describe('remark flags keep the matched phrase', () => {
  it('extracts roof / remodel / distressed with the source words', () => {
    const f = extractRemarkFlags('New roof in 2022. Kitchen remodel. Sold as-is.')
    expect(f.newRoof).toBe(true)
    expect(f.newRoofPhrase?.toLowerCase()).toContain('roof')
    expect(f.updatedKitchen).toBe(true)
    expect(f.distressed).toBe(true)
    expect(f.distressedPhrase?.toLowerCase()).toMatch(/as[\s-]is/)
  })

  it('extracts irrigated, dry, horse, barn, and custom quality', () => {
    const irrigated = extractRemarkFlags('Irrigated pasture with water rights and a horse barn.')
    expect(irrigated.irrigated).toBe(true)
    expect(irrigated.horseProperty).toBe(true)
    expect(irrigated.barn).toBe(true)
    const dry = extractRemarkFlags('Dry lot. No irrigation. No water rights.')
    expect(dry.dry).toBe(true)
    expect(dry.irrigated).toBe(false)
    const custom = extractRemarkFlags('Custom built modern home, architect designed.')
    expect(custom.customQuality).toBe(true)
  })
})

describe('irrigation hard split', () => {
  it('treats irrigated and dry as two different properties', () => {
    expect(irrigationCompatible('irrigated', 'dry')).toBe(false)
    expect(irrigationCompatible('dry', 'irrigated')).toBe(false)
    expect(irrigationCompatible('irrigated', 'irrigated')).toBe(true)
    expect(irrigationCompatible('irrigated', 'unknown')).toBe(true)
  })

  it('reads remarks and never infers dry from a missing OWRD map', () => {
    expect(irrigationClassFromRemarks('Fully irrigated with ditch water.')).toBe('irrigated')
    expect(irrigationClassFromRemarks('Non-irrigated dry acreage.')).toBe('dry')
    expect(irrigationClassFromOwrd({ mappedIrrigationAcres: 12, hasPrivateAppurtenant: false })).toBe(
      'irrigated',
    )
    expect(irrigationClassFromOwrd({ mappedIrrigationAcres: 0, hasPrivateAppurtenant: false })).toBe(
      'unknown',
    )
    expect(resolveIrrigationClass('Dry lot, no irrigation.', { mappedIrrigationAcres: 8 })).toBe(
      'irrigated',
    )
  })
})

describe('year and quality for custom / new subjects', () => {
  it('refuses 1977–2000 stock for a 2024 custom Rim View subject', () => {
    const subject = {
      yearBuilt: 2024,
      newConstructionYn: true,
      remarks: 'Custom built modern home.',
    }
    expect(isCustomOrNewSubject(subject, 2026)).toBe(true)
    expect(yearQualityCompatible(subject, { yearBuilt: 1990 }, 2026)).toBe(false)
    expect(yearQualityCompatible(subject, { yearBuilt: 1999 }, 2026)).toBe(false)
    expect(yearQualityCompatible(subject, { yearBuilt: 1977 }, 2026)).toBe(false)
    expect(yearQualityCompatible(subject, { yearBuilt: 1980 }, 2026)).toBe(false)
    expect(yearQualityCompatible(subject, { yearBuilt: 2022, remarks: 'Custom home' }, 2026)).toBe(true)
  })

  it('does not change the rule for an ordinary 1998 ranch', () => {
    expect(yearQualityCompatible({ yearBuilt: 1998 }, { yearBuilt: 1977 }, 2026)).toBe(true)
  })
})

describe('story dollar adjustment', () => {
  it('adds the measured 13.5% when the subject is one-story and the comp is two', () => {
    // Matt 2026-09-17: story-adj killed entirely — always 0.
    expect(storyAdjustment('one', 'two', 700_000)).toBe(0)
    expect(storyAdjustment('two', 'one', 700_000)).toBe(0)
    expect(storyAdjustment('one', 'one', 700_000)).toBe(0)
    expect(storyAdjustment('one', 'unknown', 700_000)).toBe(0)
    // Historical premium constant stays named so Tip Ready can prove what we refused.
    expect(ONE_STORY_PREMIUM).toBe(0.135)
  })
})

describe('plausibleListedClose', () => {
  it('drops a close that is under 10% of last ask', () => {
    expect(plausibleListedClose(1_625, 1_680_000)).toBe(false)
    expect(plausibleListedClose(168_000, 1_680_000)).toBe(true)
    expect(plausibleListedClose(500_000, null)).toBe(true)
  })

  it('drops a close that is over 10× last ask', () => {
    expect(plausibleListedClose(20_000_000, 1_680_000)).toBe(false)
    expect(plausibleListedClose(1_800_000, 1_680_000)).toBe(true)
  })
})

describe('new-construction match', () => {
  it('treats a 0–2 year home as new and will not pair it with a resale', () => {
    expect(isNewBuild(2025, 2026)).toBe(true)
    expect(isNewBuild(2013, 2026)).toBe(false)
    expect(isNewBuild(null, 2026)).toBeNull()
    expect(newConstructionCompatible(true, false)).toBe(false)
    expect(newConstructionCompatible(true, true)).toBe(true)
    expect(newConstructionCompatible(true, null)).toBe(true)
  })

  it('does not let NewConstructionYN=false override a 0–2 year build', () => {
    expect(isNewBuild(2025, 2026, false)).toBe(true)
    expect(isNewBuild(2013, 2026, false)).toBe(false)
    expect(isNewBuild(2013, 2026, true)).toBe(true)
    expect(isNewBuild(null, 2026, false)).toBe(false)
    expect(isNewBuild(null, 2026, null)).toBeNull()
  })
})

describe('subdivision sentinel', () => {
  it('drops MLS placeholders', () => {
    expect(normSubdivision('N/A')).toBeNull()
    expect(normSubdivision('Kenwood')).toBe('kenwood')
  })
})

describe('customBathCompatible', () => {
  
  it('live Rim View field shape classifies custom/new without saying custom built', () => {
    const liveRemarks =
      'Introducing a stunning mid-century modern home perched over a turn in Tumalo Creek. This to-be-built masterpiece offers 4 beds.'
    // Actual canceled listing: year 2024 + NewConstructionYN true + SFR subtype.
    expect(
      isCustomOrNewSubject(
        {
          yearBuilt: 2024,
          newConstructionYn: true,
          remarks: liveRemarks,
          propertySubType: 'Single Family Residence',
          standardStatus: 'Canceled',
        },
        2026,
      ),
    ).toBe(true)
    // Remarks-only path when year/YN are somehow absent.
    expect(
      isCustomOrNewSubject(
        { yearBuilt: null, newConstructionYn: null, remarks: liveRemarks },
        2026,
      ),
    ).toBe(true)
    // Custom / to-be-built remarks still classify when the year is missing.
    expect(
      isCustomOrNewSubject(
        { yearBuilt: null, newConstructionYn: false, remarks: 'To be built on a view lot.' },
        2026,
      ),
    ).toBe(true)
    expect(subtypeMarksCustomOrNew('New Construction')).toBe(true)
    expect(subtypeMarksCustomOrNew('Single Family Residence')).toBe(false)
  })

  it('does not mark a remodeled 1976 house custom/new from Nugget remarks', () => {
    const nuggetRemarks =
      'almost everything in this home is brand new including interior and exterior paint, new furnace, and a new roof'
    expect(
      isCustomOrNewSubject(
        {
          yearBuilt: 1976,
          newConstructionYn: false,
          remarks: nuggetRemarks,
          propertySubType: 'Single Family Residence',
        },
        2026,
      ),
    ).toBe(false)
    expect(
      isCustomOrNewSubject({ yearBuilt: 1976, newConstructionYn: null, remarks: nuggetRemarks }, 2026),
    ).toBe(false)
    expect(
      isCustomOrNewSubject({ yearBuilt: null, newConstructionYn: null, remarks: nuggetRemarks }, 2026),
    ).toBe(false)
  })

  it('still classifies real new-construction and custom subjects', () => {
    expect(
      isCustomOrNewSubject({ yearBuilt: 1990, newConstructionYn: true, remarks: null }, 2026),
    ).toBe(true)
    expect(
      isCustomOrNewSubject({ yearBuilt: 2025, newConstructionYn: false, remarks: null }, 2026),
    ).toBe(true)
    expect(
      isCustomOrNewSubject(
        { yearBuilt: null, newConstructionYn: null, remarks: 'Spec home on a view lot.' },
        2026,
      ),
    ).toBe(true)
    expect(
      isCustomOrNewSubject(
        { yearBuilt: null, newConstructionYn: null, remarks: 'Brand new home, never lived in.' },
        2026,
      ),
    ).toBe(true)
    expect(
      isCustomOrNewSubject(
        { yearBuilt: null, newConstructionYn: null, remarks: 'Brand new construction just completed.' },
        2026,
      ),
    ).toBe(true)
    expect(
      isCustomOrNewSubject(
        { yearBuilt: 2018, newConstructionYn: false, remarks: 'Custom built modern home.' },
        2026,
      ),
    ).toBe(true)
  })

  it('allows a one-whole-bath gap (Perspective 3 vs Rim View 4)', () => {
    expect(customBathCompatible(4, 3)).toBe(true)
    expect(customBathCompatible(4, 4)).toBe(true)
    expect(customBathCompatible(4, 2)).toBe(false)
  })
})

describe('customLotCompatible', () => {
  it('keeps acreage vs in-town hard but drops the ratio band for custom peers', () => {
    expect(customLotCompatible(2, 1.19)).toBe(true)
    expect(customLotCompatible(5, 1.19)).toBe(true)
    expect(customLotCompatible(2, 0.25)).toBe(false)
    expect(customLotCompatible(null, 1.19)).toBe(true)
  })

  it('does not cliff-split near-acre custom peers at exactly 1.0', () => {
    expect(customLotCompatible(0.96, 1.08)).toBe(true)
    expect(customLotCompatible(0.5, 2.0)).toBe(false)
  })
})

describe('resale versus never-owned new construction', () => {
  it('uses the existing 5-year custom/new window, not the 0-2 year mark or the 15-year generation', () => {
    expect(RESALE_COMPETES_WITH_NEVER_OWNED_YEARS).toBe(5)
  })

  it('keeps a 2021 resale in the class that can be priced with brand-new homes', () => {
    expect(
      isCustomOrNewSubject({ yearBuilt: 2021, newConstructionYn: false, remarks: null }, 2026),
    ).toBe(true)
    expect(
      dropsResaleVersusNewBuild(
        { yearBuilt: 2021, newConstructionYn: false },
        { yearBuilt: 2026, newConstructionYn: true },
        2026,
      ),
    ).toBe(false)
    expect(
      dropsResaleVersusNewBuild(
        { yearBuilt: 2021, newConstructionYn: false },
        { yearBuilt: 2025, newConstructionYn: true },
        2026,
      ),
    ).toBe(false)
  })

  it('does not treat a resale past the window as the same product as never-owned new construction', () => {
    expect(
      isCustomOrNewSubject({ yearBuilt: 2017, newConstructionYn: false, remarks: null }, 2026),
    ).toBe(false)
    expect(
      dropsResaleVersusNewBuild(
        { yearBuilt: 2017, newConstructionYn: false },
        { yearBuilt: 2026, newConstructionYn: true },
        2026,
      ),
    ).toBe(true)
    expect(
      dropsResaleVersusNewBuild(
        { yearBuilt: 2017, newConstructionYn: false },
        { yearBuilt: 2023, newConstructionYn: true },
        2026,
      ),
    ).toBe(true)
    expect(
      dropsResaleVersusNewBuild(
        { yearBuilt: 2017, newConstructionYn: false },
        { yearBuilt: 2022, newConstructionYn: false },
        2026,
      ),
    ).toBe(false)
  })

  it('calls a flagged new home never-owned and does not call a false flag that', () => {
    expect(isNeverOwnedNewConstruction({ yearBuilt: 2026, newConstructionYn: true }, 2026)).toBe(true)
    expect(isNeverOwnedNewConstruction({ yearBuilt: 2024, newConstructionYn: false }, 2026)).toBe(false)
    expect(isNeverOwnedNewConstruction({ yearBuilt: 2026, newConstructionYn: null }, 2026)).toBe(false)
    expect(isNeverOwnedNewConstruction({ yearBuilt: 1990, newConstructionYn: true }, 2026)).toBe(false)
  })
})

describe('multiUnitFromRemarks: the remarks say this home is a duplex (Matt 2026-10-07, same property types only)', () => {
  // Real MLS remarks from sales within 1.5 miles of 915 Saginaw, read 2026-10-07.
  it('a duplex sold as Single Family Residence is a multi-unit', () => {
    expect(multiUnitFromRemarks("Exceptional opportunity on Bend's highly desirable Westside! This beautifully updated duplex features a 3 bed/2 bath upper unit and a 1 bed/1 bath lower unit, offering outstanding flexibility for investors, owner-occupants, or multigenerational living.")).toBe(true)
    expect(multiUnitFromRemarks("TWO short term rental permits! Where effortless elegance and smart business converge, this beautifully designed MU-zoned duplex is tucked near downtown Bend (downstairs unit is sold fully furnished).")).toBe(true)
    expect(productClassFromFactsRow('detached', 'Single Family Residence', "Exceptional opportunity on Bend's highly desirable Westside! This beautifully updated duplex features a 3 bed/2 bath upper unit and a 1 bed/1 bath lower unit, offering outstanding flexibility for investors, owner-occupants, or multigenerational living.")).toBe('multi-unit')
  })
  it('a house with an ADU is still detached, even when the remarks say both units', () => {
    expect(multiUnitFromRemarks("Dual-zone HVAC, tankless water heaters in both units, fresh paint inside + out. 5ba main home (1857 sq ft) + private 1bd/1ba ADU (491 sq ft) offers luxurious flexibility that's hard to find.")).toBe(false)
    expect(multiUnitFromRemarks("Mid town house and ADU with ''Grandfathered''  Transferrable Short Term Rental license. Both units professionally managed currently.")).toBe(false)
  })
  it('potential for a duplex, or a possible fourplex redevelopment, is not a duplex', () => {
    expect(multiUnitFromRemarks("Potential for ADU, shop, additional garage, duplex, multi generational living, lot separation.")).toBe(false)
    expect(multiUnitFromRemarks("Well suited for a thoughtful renovation into a charming NW Bend home or possible redevelopment into townhomes or fourplex.")).toBe(false)
  })
  it('two units that are a main house and a casita are not a multi-unit, and a duplex with an ADU still is (rule 23)', () => {
    expect(multiUnitFromRemarks('Two units: main house and casita, each with its own entrance.')).toBe(false)
    expect(multiUnitFromRemarks('Rare duplex with ADU on the back of the lot, three rentable doors.')).toBe(true)
    expect(productClassFromFactsRow('single-family', 'Single Family Residence', 'Rare duplex with ADU on the back of the lot.')).toBe('multi-unit')
  })
  it('blank remarks and a plain house are not multi-unit', () => {
    expect(multiUnitFromRemarks(null)).toBe(false)
    expect(multiUnitFromRemarks('Charming single level home on a quiet street with a fenced yard.')).toBe(false)
    expect(productClassFromFactsRow('detached', 'Single Family Residence', null)).toBe('detached')
  })
})

describe('aduFromRemarks: the remarks state a second living unit on the lot (Matt 2026-10-08, "ADU sale skips")', () => {
  // The case. 644 Norton seated on both ladders for 1648 Pheasant; the review
  // dropped it 3 of 3 passes. Both texts are the stored MLS remarks.
  const NORTON =
    'Excellent Midtown Bend multi-unit property featuring a permitted ADU, offering flexibility for a variety of living or investment possibilities. Major improvements include a new roof this year along with fresh interior and exterior paint, providing added value and peace of mind. Both units feature attractive finishes and functional living spaces.'
  const PHEASANT =
    "Single level house in Midtown Bend on a huge lot with room to dream. This updated 3 bed, 1 bath home features a mini-split for efficient AC and heat in the main living room. Outside, you've got space to build an ADU, a 2 car garage, RV parking, plus room for 3+ more large vehicles. Whether you're buying your first home, downsizing, or eyeing ADU rental income, this is a lot of house and land for under $600K in Bend, Oregon."

  it('reads 644 Norton as an ADU home and 1648 Pheasant as a home without one', () => {
    expect(aduFromRemarks(NORTON)).toBe(true)
    expect(aduFromRemarks(PHEASANT)).toBe(false)
    expect(aduSaleRefused(PHEASANT, NORTON)).toBe(true)
    // Rule 23 is a different question: an ADU home is still not a duplex.
    expect(multiUnitFromRemarks(NORTON)).toBe(false)
  })

  it('counts a unit the remarks state the home has (real Bend remarks, 2025-2026 closes)', () => {
    for (const text of [
      'Incredibly rare single-level home w/ permitted ADU on a quiet dead-end street in NE Bend.',
      'Main house went through complete remodel 6 years ago and ADU built at the same time.',
      'Above the 3-car garage, a 908sf, 2-bed, 1-bath guest house offers built-in income potential as an active Airbnb.',
      'A detached ADU adds flexibility and future potential. A set of plans may be included in the purchase price.',
      'plus a 495 sq. ft. ADU with Bosch appliances and its own bathroom.',
      'The permitted 394 sq ft attached ADU is separately metered and includes its own private outdoor space.',
      'Fabulous 750 SF one bedroom ADU for guest or possible income opportunity.',
      'complemented by a 2718 sqft. 3-bedroom guesthouse, creating exceptional flexibility for guests.',
      'A furnished 2-bdrm guest casita w/ kitchenette, full bath, & new flooring provides exceptional flexibility.',
      'A detached garage with guest quarters adds exceptional versatility.',
      'Rare opportunity to acquire a 1954-built investment property featuring a detached ADU and multiple income-generating possibilities.',
      'Classic Bend Bungalow + ADU on one of the premier streets.',
      'set on .46 acres with an ADU/Casita perfect for MULTI-GENERATIONAL living.',
      'Perfect for multigenerational living, this home features a detached ADU.',
      'Strong rental income potential from the ADU.',
      'An accessory dwelling unit sits behind the main home.',
      'No HOA and a detached ADU out back.',
    ]) {
      expect(aduFromRemarks(text), text).toBe(true)
    }
  })

  it('never counts hedged or prospective wording', () => {
    for (const text of [
      'Excellent ADU potential which presents a rare opportunity for both homeowners & investors.',
      'Remodeled single level + flex space + big shop + RV parking + ADU potential + no HOA rarely comes available in SE Bend.',
      'alley access at the rear of the lot, making it the perfect property on which to build an ADU behind the house.',
      'with future possibilities including potential ADU opportunities subject to buyer due diligence.',
      'There is ample room for additional parking, RVs/toys, along with potential for an ADU.',
      'plenty of level space for a future shop or ADU (buyer to verify).',
      "There's also potential to add an ADU, all subject to city approval.",
      'or explore ADU possibilities in the future.',
      'The large lot offers room for a future shop or ADU, to create your personalized retreat.',
      'Large lot size would allow for an ADU or other development potential.',
      'Room for shop, arena, or ADU.',
      'fully finished 1,500 sq ft shop with upstairs office (potential ADU), plus an attached garage.',
      'ADU?  Second story? What are you dreaming of?',
      'ADU-ready lot with utilities stubbed.',
      'Zoned for an ADU.',
      'You could add a casita in the back.',
      'Possible ADU site.',
      'Approved plans for a detached ADU convey.',
      'ADU plans approved by the city.',
      'No ADU or short term rentals allowed per CC&Rs.',
      // A use pitch for a flex space or a studio, not a unit by name.
      'The versatile 1,350 sq ft flex space is ideal for additional garage bays, guest quarters, a home office, or workshop.',
      'includes a two-car garage with the studio above--perfect for rental income, a home office, or guest quarters.',
      // Quarters the clause places inside the house.
      'An office with a closet offers flexibility, and upstairs guest quarters include two bedrooms and a full bath.',
      'Charming single level home on a quiet street with a fenced yard.',
      null,
      '',
    ]) {
      expect(aduFromRemarks(text), String(text)).toBe(false)
    }
  })

  it('mother-in-law: a unit, apartment or cottage counts, a suite, quarters or wing inside the house does not', () => {
    expect(aduFromRemarks('The lowest level houses a fully permitted mother-in-law unit with private entrance, wet bar, and W/D.')).toBe(true)
    expect(aduFromRemarks('Mother in law apartment over the garage.')).toBe(true)
    expect(aduFromRemarks('Detached in-law cottage with its own kitchen.')).toBe(true)
    expect(aduFromRemarks('A detached in-law suite with a kitchenette sits behind the shop.')).toBe(true)
    // Ambiguous, so not counted: usually a bedroom suite already in the living area.
    expect(aduFromRemarks('a private mother-in-law suite/multi-generational living space offers flexibility for guests.')).toBe(false)
    expect(aduFromRemarks('while a separate in-law suite includes a fireplace, deck access, and en suite bath.')).toBe(false)
    expect(aduFromRemarks('Features include 4 bedrooms, 3.5 baths, an in-law wing with separate entrance.')).toBe(false)
    expect(aduFromRemarks('ideal for a home office, guest retreat, or mother-in-law suite with full bath.')).toBe(false)
  })

  it('the wall is one way: an ADU subject keeps both kinds, a blank sale states nothing', () => {
    const plain = 'Single level home with a fenced yard.'
    const adu = 'Craftsman with a permitted detached ADU over the garage.'
    expect(aduSaleRefused(plain, adu)).toBe(true)
    expect(aduSaleRefused(null, adu)).toBe(true)
    expect(aduSaleRefused(adu, adu)).toBe(false)
    expect(aduSaleRefused(adu, plain)).toBe(false)
    expect(aduSaleRefused(plain, null)).toBe(false)
    expect(aduSaleRefused(plain, plain)).toBe(false)
  })
})
