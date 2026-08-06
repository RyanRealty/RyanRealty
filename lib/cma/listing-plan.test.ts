/**
 * Listing Plan — pure computation rules. Every rule must refuse to fire on
 * thin data (§0: cut, don't guess), and every emitted string must clear the
 * brand-voice gate.
 */
import { describe, expect, it } from 'vitest'
import {
  buildCrowdedBandItem,
  buildEarlyExposureItem,
  buildFailedAskItem,
  buildFinancingItem,
  buildListingPlan,
  buildPhotoItem,
  buildPositioningItem,
  buildSubdivisionItem,
  buildTimingItem,
} from './listing-plan'
import type {
  CmaBandPosition,
  CmaExtras,
  CmaFinancingProfile,
  CmaPhotoBench,
  CmaSeasonality,
  CmaSubdivisionPulse,
} from './extras'
import type { CmaPricing, CmaSubject } from './types'
import type { ExpiredAuditData } from './expired-audit'
import { checkBrandVoice } from '@/lib/voice/check'

const EMPTY_EXTRAS: CmaExtras = {
  seasonality: null,
  band: null,
  subdivisionPulse: null,
  financing: null,
  photoBench: null,
}

const subjectFixture = (overrides: Partial<CmaSubject> = {}) => ({ ...overrides }) as unknown as CmaSubject
const pricingFixture = (overrides: Partial<CmaPricing> = {}) => ({ ...overrides }) as unknown as CmaPricing
const expiredAuditFixture = () => ({}) as unknown as ExpiredAuditData

describe('buildFailedAskItem', () => {
  it('fires when the audit is present and the failed ask is known', () => {
    const item = buildFailedAskItem(
      subjectFixture({ lastListPrice: 950000 }),
      pricingFixture({ recommended: 899000 }),
      expiredAuditFixture(),
    )
    expect(item).not.toBeNull()
    expect(item!.trigger).toContain('$950,000')
    expect(item!.action).toContain('$899,000')
    expect(item!.basis).toContain('$950,000')
    expect(item!.basis).toContain('$899,000')
  })

  it('does not fire on a plain CMA (no expired audit)', () => {
    expect(buildFailedAskItem(subjectFixture({ lastListPrice: 950000 }), pricingFixture({ recommended: 899000 }), null)).toBeNull()
  })

  it('does not fire when the failed ask is unknown', () => {
    expect(
      buildFailedAskItem(subjectFixture({ lastListPrice: null }), pricingFixture({ recommended: 899000 }), expiredAuditFixture()),
    ).toBeNull()
  })
})

describe('buildSubdivisionItem', () => {
  const pulse: CmaSubdivisionPulse = {
    name: 'Broken Top',
    closedCount: 5,
    medianClose: 975000,
    low: 900000,
    high: 1050000,
    months: 12,
    source: "Supabase listings, SubdivisionName='Broken Top', PropertyType='A', Closed: 5 sales",
  }

  it('fires whenever the block exists', () => {
    const item = buildSubdivisionItem({ ...EMPTY_EXTRAS, subdivisionPulse: pulse })
    expect(item).not.toBeNull()
    expect(item!.trigger).toContain('Broken Top')
    expect(item!.trigger).toContain('$975,000')
    expect(item!.basis).toContain('5 sales')
  })

  it('does not fire when the block is null', () => {
    expect(buildSubdivisionItem(EMPTY_EXTRAS)).toBeNull()
  })
})

describe('buildCrowdedBandItem', () => {
  const band = (activeCount: number, pendingCount: number): CmaBandPosition => ({
    lo: 850000,
    hi: 1050000,
    activeCount,
    pendingCount,
    activeMedianAsk: 950000,
    activeMedianDom: 10,
    source: "Supabase listings, City='Bend', PropertyType='A', Active + Pending, ListPrice 850000..1050000, pulled at build time",
  })

  it('fires when actives run at least 2x pendings, above the sample floor', () => {
    const item = buildCrowdedBandItem({ ...EMPTY_EXTRAS, band: band(10, 2) })
    expect(item).not.toBeNull()
    expect(item!.trigger).toContain('10 homes are active')
    expect(item!.trigger).toContain('2 pending')
    expect(item!.action).toContain('10 homes already listed')
  })

  it('fires at the exact 2x boundary', () => {
    expect(buildCrowdedBandItem({ ...EMPTY_EXTRAS, band: band(8, 4) })).not.toBeNull()
  })

  it('does not fire under the sample floor even at a wide ratio', () => {
    expect(buildCrowdedBandItem({ ...EMPTY_EXTRAS, band: band(3, 0) })).toBeNull()
  })

  it('does not fire when actives are not crowded relative to pendings', () => {
    expect(buildCrowdedBandItem({ ...EMPTY_EXTRAS, band: band(6, 5) })).toBeNull()
  })

  it('does not fire when the band block is null', () => {
    expect(buildCrowdedBandItem(EMPTY_EXTRAS)).toBeNull()
  })
})

describe('buildEarlyExposureItem', () => {
  const band = (activeMedianDom: number | null): CmaBandPosition => ({
    lo: 850000,
    hi: 1050000,
    activeCount: 5,
    pendingCount: 5,
    activeMedianAsk: 950000,
    activeMedianDom,
    source: "Supabase listings, City='Bend', PropertyType='A', Active + Pending, ListPrice 850000..1050000, pulled at build time",
  })

  it('fires once the median DOM clears the threshold', () => {
    const item = buildEarlyExposureItem({ ...EMPTY_EXTRAS, band: band(45) })
    expect(item).not.toBeNull()
    expect(item!.trigger).toContain('45 days')
  })

  it('fires at the exact threshold', () => {
    expect(buildEarlyExposureItem({ ...EMPTY_EXTRAS, band: band(30) })).not.toBeNull()
  })

  it('does not fire under the threshold', () => {
    expect(buildEarlyExposureItem({ ...EMPTY_EXTRAS, band: band(20) })).toBeNull()
  })

  it('does not fire when the DOM figure is unknown', () => {
    expect(buildEarlyExposureItem({ ...EMPTY_EXTRAS, band: band(null) })).toBeNull()
  })
})

describe('buildFinancingItem', () => {
  const financing = (cashPct: number): CmaFinancingProfile => ({
    sampleCount: 60,
    cashPct,
    conventionalPct: 100 - cashPct - 10,
    fhaVaPct: 10,
    otherPct: 0,
    source: "Supabase listings, City='Bend', PropertyType='A', Closed, buyer_financing non-null: 60 sales",
  })

  it('fires once the cash share clears the threshold', () => {
    const item = buildFinancingItem({ ...EMPTY_EXTRAS, financing: financing(35) })
    expect(item).not.toBeNull()
    expect(item!.trigger).toContain('35%')
  })

  it('fires at the exact threshold', () => {
    expect(buildFinancingItem({ ...EMPTY_EXTRAS, financing: financing(30) })).not.toBeNull()
  })

  it('does not fire under the threshold', () => {
    expect(buildFinancingItem({ ...EMPTY_EXTRAS, financing: financing(15) })).toBeNull()
  })

  it('does not fire when the block is null', () => {
    expect(buildFinancingItem(EMPTY_EXTRAS)).toBeNull()
  })
})

describe('buildTimingItem', () => {
  const seasonality = (fastMed: number, slowMed: number): CmaSeasonality => ({
    byMonth: [
      { month: 5, monthName: 'May', closedCount: 20, medianDaysToPending: fastMed },
      { month: 11, monthName: 'November', closedCount: 20, medianDaysToPending: slowMed },
    ],
    fastestMonths: ['May', 'June'],
    slowestMonths: ['October', 'November'],
    yearsCovered: 3,
    totalClosed: 400,
    source: "Supabase listings, City='Bend', PropertyType='A', Closed, CloseDate ≥ 2023-08-06: 400 sales grouped by close month",
  })

  it('fires when the gap exceeds 10 days', () => {
    const item = buildTimingItem({ ...EMPTY_EXTRAS, seasonality: seasonality(10, 40) })
    expect(item).not.toBeNull()
    expect(item!.trigger).toContain('May')
    expect(item!.trigger).toContain('November')
    expect(item!.trigger).toContain('10 days')
    expect(item!.trigger).toContain('40')
    expect(item!.action).toContain('May')
  })

  it('does not fire at the exact 10-day boundary', () => {
    expect(buildTimingItem({ ...EMPTY_EXTRAS, seasonality: seasonality(20, 30) })).toBeNull()
  })

  it('does not fire on a small gap', () => {
    expect(buildTimingItem({ ...EMPTY_EXTRAS, seasonality: seasonality(20, 25) })).toBeNull()
  })

  it('does not fire when the block is null', () => {
    expect(buildTimingItem(EMPTY_EXTRAS)).toBeNull()
  })
})

describe('buildPhotoItem', () => {
  const photoBench = (subjectPhotos: number, compMedianPhotos: number): CmaPhotoBench => ({
    subjectPhotos,
    compPhotos: [
      { address: '1', photos: compMedianPhotos - 5 },
      { address: '2', photos: compMedianPhotos },
      { address: '3', photos: compMedianPhotos + 5 },
    ],
    compMedianPhotos,
    source: "Supabase listings photos_count: the subject's last listing vs the 3 sold comps in this report",
  })

  it('fires when the subject trails the comp median', () => {
    const item = buildPhotoItem({ ...EMPTY_EXTRAS, photoBench: photoBench(8, 35) })
    expect(item).not.toBeNull()
    expect(item!.trigger).toContain('8 photos')
    expect(item!.trigger).toContain('35')
  })

  it('does not fire when the subject meets or beats the comp median', () => {
    expect(buildPhotoItem({ ...EMPTY_EXTRAS, photoBench: photoBench(40, 35) })).toBeNull()
    expect(buildPhotoItem({ ...EMPTY_EXTRAS, photoBench: photoBench(35, 35) })).toBeNull()
  })

  it('does not fire when the block is null', () => {
    expect(buildPhotoItem(EMPTY_EXTRAS)).toBeNull()
  })
})

describe('buildPositioningItem', () => {
  it('never fires — CmaExtras carries no sqft/beds percentile to cite', () => {
    expect(buildPositioningItem(subjectFixture({ sqft: 2400, beds: 4 }), EMPTY_EXTRAS)).toBeNull()
  })
})

describe('buildListingPlan', () => {
  it('returns null when fewer than 3 items qualify', () => {
    const extras: CmaExtras = {
      ...EMPTY_EXTRAS,
      financing: {
        sampleCount: 60,
        cashPct: 40,
        conventionalPct: 50,
        fhaVaPct: 10,
        otherPct: 0,
        source: "Supabase listings, City='Bend', PropertyType='A', Closed, buyer_financing non-null: 60 sales",
      },
      photoBench: {
        subjectPhotos: 5,
        compPhotos: [
          { address: '1', photos: 30 },
          { address: '2', photos: 35 },
          { address: '3', photos: 40 },
        ],
        compMedianPhotos: 35,
        source: "Supabase listings photos_count: the subject's last listing vs the 3 sold comps in this report",
      },
    }
    const plan = buildListingPlan({
      subject: subjectFixture({ lastListPrice: null }),
      pricing: pricingFixture({ recommended: 899000 }),
      extras,
      expiredAudit: null,
      market: null,
    })
    expect(plan).toBeNull()
  })

  describe('full-data fixture', () => {
    const subject = subjectFixture({ lastListPrice: 999000, subdivision: 'Broken Top', sqft: 2400, beds: 4 })
    const pricing = pricingFixture({ recommended: 950000 })
    const expiredAudit = expiredAuditFixture()
    const extras: CmaExtras = {
      seasonality: {
        byMonth: [
          { month: 5, monthName: 'May', closedCount: 20, medianDaysToPending: 10 },
          { month: 11, monthName: 'November', closedCount: 20, medianDaysToPending: 40 },
        ],
        fastestMonths: ['May', 'June'],
        slowestMonths: ['October', 'November'],
        yearsCovered: 3,
        totalClosed: 400,
        source: "Supabase listings, City='Bend', PropertyType='A', Closed, CloseDate ≥ 2023-08-06: 400 sales grouped by close month",
      },
      band: {
        lo: 850000,
        hi: 1050000,
        activeCount: 10,
        pendingCount: 2,
        activeMedianAsk: 950000,
        activeMedianDom: 45,
        source: "Supabase listings, City='Bend', PropertyType='A', Active + Pending, ListPrice 850000..1050000, pulled at build time",
      },
      subdivisionPulse: {
        name: 'Broken Top',
        closedCount: 5,
        medianClose: 975000,
        low: 900000,
        high: 1050000,
        months: 12,
        source: "Supabase listings, SubdivisionName='Broken Top', PropertyType='A', Closed: 5 sales",
      },
      financing: {
        sampleCount: 60,
        cashPct: 35,
        conventionalPct: 50,
        fhaVaPct: 10,
        otherPct: 5,
        source: "Supabase listings, City='Bend', PropertyType='A', Closed, buyer_financing non-null: 60 sales",
      },
      photoBench: {
        subjectPhotos: 8,
        compPhotos: [
          { address: '123 Main', photos: 30 },
          { address: '456 Elm', photos: 35 },
          { address: '789 Oak', photos: 40 },
        ],
        compMedianPhotos: 35,
        source: "Supabase listings photos_count: the subject's last listing vs the 3 sold comps in this report",
      },
    }

    const plan = buildListingPlan({ subject, pricing, extras, expiredAudit, market: null })

    it('produces a sensible ordered set: failed ask, then price standing, then terms, timing, and presentation', () => {
      expect(plan).not.toBeNull()
      expect(plan!.items).toHaveLength(7)
      expect(plan!.items[0]!.trigger).toContain('did not sell')
      expect(plan!.items[1]!.trigger).toContain('Broken Top')
      expect(plan!.items[2]!.trigger).toContain('homes are active')
      expect(plan!.items[3]!.trigger).toContain('days on market')
      expect(plan!.items[4]!.trigger).toContain('cash financing')
      expect(plan!.items[5]!.trigger).toContain('reach pending')
      expect(plan!.items[6]!.trigger).toContain('photos')
      expect(plan!.source.length).toBeGreaterThan(0)
    })

    it('every trigger, action, and basis clears the brand-voice gate', () => {
      expect(plan).not.toBeNull()
      for (const item of plan!.items) {
        for (const [field, text] of Object.entries(item)) {
          const r = checkBrandVoice(text as string)
          expect(r.ok, `${field} failed voice check: "${text}" -> ${JSON.stringify(r.violations)}`).toBe(true)
        }
      }
      const r = checkBrandVoice(plan!.source)
      expect(r.ok, `source failed voice check: "${plan!.source}" -> ${JSON.stringify(r.violations)}`).toBe(true)
    })

    // Regression for the cma-20513-byron adversarial audit finding: `basis`
    // strings were built with the raw code path ("subject.lastListPrice",
    // "extras.photoBench", ...) spliced directly into client-facing text.
    // A dotted code identifier reads word.word with a letter on both sides
    // of the dot — this deliberately does NOT match numeric ranges like
    // "850000..1050000" or query fragments like "CloseDate 2024-01-01",
    // which are legitimate parts of a source trace (§0 requires the trace
    // to survive; only the code-identifier prefix must go).
    const DOTTED_CODE_IDENTIFIER = /\b[a-zA-Z_][a-zA-Z0-9_]*\.[a-zA-Z_][a-zA-Z0-9_]*\b/

    it('no basis string contains a raw dotted code identifier', () => {
      expect(plan).not.toBeNull()
      for (const item of plan!.items) {
        expect(
          DOTTED_CODE_IDENTIFIER.test(item.basis),
          `basis leaked a code path: "${item.basis}"`,
        ).toBe(false)
      }
    })
  })
})
