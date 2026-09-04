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
  isCustomOrNewSubject,
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
  storyAdjustment,
  waterCompatible,
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
    expect(storyAdjustment('one', 'two', 700_000)).toBe(94_500)
    expect(storyAdjustment('two', 'one', 700_000)).toBe(-94_500)
    expect(storyAdjustment('one', 'one', 700_000)).toBe(0)
    expect(storyAdjustment('one', 'unknown', 700_000)).toBe(0)
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
})
