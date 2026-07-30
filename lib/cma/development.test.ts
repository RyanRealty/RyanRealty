import { describe, expect, it } from 'vitest'
import {
  DEV_DISCLAIMER,
  REGS_REVERIFIED_DATE,
  buildResourceDirectory,
  resolveDevelopmentOpportunities,
  type DevItem,
  type DevelopmentOpportunities,
} from '@/lib/cma/development'
import { resolveZoningExplainer, normalizeRedmond } from '@/lib/cma/zoning-explainer'
import type { CmaSiteData } from '@/lib/cma/county'
import type { CmaSubject } from '@/lib/cma/types'

// ── Fixtures ────────────────────────────────────────────────────────────────

function site(overrides: Partial<CmaSiteData> = {}): CmaSiteData {
  return {
    taxAccount: '100000',
    taxlot: '1712000000100',
    trs: '17-12-00',
    acreage: 0.2,
    zone: 'RS',
    zoneOverlays: [],
    overlays: [],
    wildfireHazard: false,
    flood: { zone: 'X', inSFHA: false },
    water: {
      source: 'municipal',
      providerName: 'City of Bend',
      wellLog: null,
      irrigationDistrict: null,
      rights: [],
      mappedIrrigationAcres: null,
      primaryIrrigationPriorityDate: null,
      hasPrivateAppurtenant: false,
      rightsQueryOk: true,
      rightsUsedPolygon: true,
    },
    septic: { status: 'municipal-sewer', permit: null },
    permits: [],
    entitlement: null,
    hunting: null,
    isMunicipal: true,
    insideUGB: true,
    publicLand: false,
    constraints: [],
    fieldConfirm: [],
    resolved: true,
    notes: [],
    citations: [],
    ...overrides,
  }
}

function subject(overrides: Partial<CmaSubject> = {}): CmaSubject {
  return {
    listingKey: 'LK1',
    mlsNumber: '220000001',
    streetAddress: '1 NW Test St',
    city: 'Bend',
    state: 'OR',
    postalCode: '97703',
    subdivision: null,
    latitude: 44.06,
    longitude: -121.31,
    beds: 3,
    baths: 2,
    sqft: 1800,
    lotAcres: 0.2,
    propertySubType: null,
    yearBuilt: 2001,
    garageSpaces: 2,
    photoUrl: null,
    publicRemarks: null,
    viewDescription: null,
    taxAnnual: 4200,
    standardStatus: 'Active',
    lastListPrice: 750000,
    lastListDate: '2026-05-01',
    listingHistoryLine: null,
    ...overrides,
  }
}

const topic = (d: DevelopmentOpportunities, t: DevItem['topic']) => d.items.find((i) => i.topic === t)
/**
 * Every string a CLIENT reads as prose. Citation strings are deliberately
 * excluded: a legal citation uses semicolons to separate authorities, which is
 * standard reference form, not body copy governed by CLAUDE.md §2.
 */
const allText = (d: DevelopmentOpportunities) =>
  [
    d.disclaimer,
    ...d.items.flatMap((i) => [i.headline, i.detail]),
    ...d.buyerOptions.flatMap((b) => [b.headline, b.detail]),
    ...d.marketingHighlights.map((m) => m.headline),
    d.hoa?.ccrGuidance ?? '',
    d.zoningExplainer?.purpose ?? '',
    ...(d.zoningExplainer?.permittedOutright ?? []),
    ...(d.zoningExplainer?.conditional ?? []),
    ...(d.zoningExplainer?.dimensional ?? []).map((x) => `${x.label} ${x.value}`),
  ].join('\n')

// ── Guard: unresolved zone must not produce zone claims ──────────────────────

describe('resolveDevelopmentOpportunities — degradation', () => {
  it('returns null when the zone never resolved', () => {
    expect(resolveDevelopmentOpportunities(site({ zone: null }), subject())).toBeNull()
    expect(resolveDevelopmentOpportunities(null, subject())).toBeNull()
    expect(resolveDevelopmentOpportunities(undefined, subject())).toBeNull()
  })

  it('an unknown zone yields no zoning explainer and no invented items', () => {
    const d = resolveDevelopmentOpportunities(site({ zone: 'ZZZ-NOT-A-ZONE' }), subject())
    // Bend branch with an unregistered zone produces neither items nor an explainer.
    expect(d).toBeNull()
  })

  it('a commercial Redmond parcel makes no residential claims', () => {
    const d = resolveDevelopmentOpportunities(
      site({ zone: 'C-2', acreage: 0.5 }),
      subject({ city: 'Redmond' }),
    )
    expect(d).toBeNull()
  })

  it('a county ADU parcel with unknown acreage degrades to confirm, never to yes', () => {
    const d = resolveDevelopmentOpportunities(
      site({ zone: 'RR-10', acreage: null, isMunicipal: false }),
      subject({ city: 'Bend', lotAcres: null }),
    )!
    const adu = topic(d, 'ADU')!
    expect(adu.verdict).toBe('confirm')
    expect(adu.headline).toMatch(/Confirm/i)
  })
})

// ── Jurisdiction routing ─────────────────────────────────────────────────────

describe('jurisdiction routing', () => {
  it('routes an annexed Bend parcel to Bend', () => {
    const d = resolveDevelopmentOpportunities(site({ zone: 'RS' }), subject())!
    expect(d.jurisdiction).toBe('City of Bend')
  })

  it('routes an annexed Redmond parcel to Redmond', () => {
    const d = resolveDevelopmentOpportunities(site({ zone: 'R-4', acreage: 0.3 }), subject({ city: 'Redmond' }))!
    expect(d.jurisdiction).toBe('City of Redmond')
  })

  it('a parcel inside the UGB but unincorporated stays under county code', () => {
    const d = resolveDevelopmentOpportunities(
      site({ zone: 'SR2-1/2', isMunicipal: false, insideUGB: true, acreage: 3 }),
      subject({ city: 'Bend', lotAcres: 3 }),
    )!
    expect(d.jurisdiction).toBe('Deschutes County (unincorporated)')
    expect(d.zoningExplainer?.zoneName).toMatch(/Suburban Low Density/)
  })
})

// ── Can it be divided? ───────────────────────────────────────────────────────

describe('subdivide or partition', () => {
  it('a Bend RS lot that CAN carry two lots says so and counts them', () => {
    // 0.5 acre = 21,780 sqft. RS minimum is 4,000 sqft; max density 7.3/acre.
    const d = resolveDevelopmentOpportunities(site({ zone: 'RS', acreage: 0.5 }), subject({ lotAcres: 0.5 }))!
    const div = topic(d, 'Subdivide or partition')!
    expect(div.verdict).toBe('conditional')
    // Density ceiling binds before the lot minimum: floor(0.5 * 7.3) = 3.
    expect(div.headline).toMatch(/up to 3 conforming lots/)
    expect(div.detail).toContain('21,780 sqft')
  })

  it('a Bend RS lot that CANNOT be divided says so without alarm', () => {
    const d = resolveDevelopmentOpportunities(site({ zone: 'RS', acreage: 0.12 }), subject({ lotAcres: 0.12 }))!
    const div = topic(d, 'Subdivide or partition')!
    expect(div.verdict).toBe('no')
    expect(div.headline).toMatch(/single conforming lot/)
    // The constraint is framed as clarity, and the second-unit route is offered.
    expect(div.detail).toMatch(/ADU or a middle-housing configuration/)
  })

  it('a Redmond R-1 lot uses the verified 9,000 sqft minimum', () => {
    const d = resolveDevelopmentOpportunities(
      site({ zone: 'R-1', acreage: 0.62 }),
      subject({ city: 'Redmond', lotAcres: 0.62 }),
    )!
    const div = topic(d, 'Subdivide or partition')!
    expect(div.detail).toContain('9,000 sqft')
    expect(div.verdict).toBe('conditional')
    expect(div.headline).toMatch(/up to 3 conforming lots/)
  })

  it('a county RR-10 parcel under 20 acres cannot be divided', () => {
    const d = resolveDevelopmentOpportunities(
      site({ zone: 'RR-10', acreage: 11.4, isMunicipal: false }),
      subject({ lotAcres: 11.4 }),
    )!
    const div = topic(d, 'Subdivide or partition')!
    expect(div.verdict).toBe('no')
    expect(div.detail).toContain('10 acres per new parcel')
  })

  it('a county RR-10 parcel over 20 acres CAN be divided', () => {
    const d = resolveDevelopmentOpportunities(
      site({ zone: 'RR-10', acreage: 41, isMunicipal: false }),
      subject({ lotAcres: 41 }),
    )!
    const div = topic(d, 'Subdivide or partition')!
    expect(div.verdict).toBe('conditional')
    expect(div.headline).toMatch(/carries 4 parcels/)
  })

  it('a 200-acre EFU tract can divide, and the statute is cited correctly', () => {
    const d = resolveDevelopmentOpportunities(
      site({ zone: 'EFU-TRB', acreage: 200, isMunicipal: false }),
      subject({ lotAcres: 200 }),
    )!
    const div = topic(d, 'Subdivide or partition')!
    expect(div.verdict).toBe('conditional')
    expect(div.citation).toContain('ORS 215.780(1)')
    // Rangeland minimum is 160 acres, verified 2026-07-30.
    expect(div.detail).toContain('160 acres on designated rangeland')
  })

  // CORRECTION regression: the Wildlife Area overlay is not a flat 40-acre floor.
  it('a Wildlife Area parcel never prints a computed lot count', () => {
    const d = resolveDevelopmentOpportunities(
      site({ zone: 'RR-10', acreage: 160, isMunicipal: false, zoneOverlays: ['WA'] }),
      subject({ lotAcres: 160 }),
    )!
    const div = topic(d, 'Subdivide or partition')!
    expect(div.verdict).toBe('confirm')
    expect(div.detail).toContain('160 acres in significant elk habitat')
    expect(div.detail).toContain('320 acres in antelope range')
    expect(div.headline).not.toMatch(/\d+ parcels/)
    // And no buyer option promises a division off an unresolved overlay.
    expect(d.buyerOptions.some((o) => /Divide the land/.test(o.headline))).toBe(false)
  })

  // CORRECTION regression: single-unit detached is NOT permitted in Bend RH.
  it('Bend RH does not claim a missing lot minimum means free division', () => {
    const d = resolveDevelopmentOpportunities(site({ zone: 'RH', acreage: 0.4 }), subject({ lotAcres: 0.4 }))!
    const div = topic(d, 'Subdivide or partition')!
    expect(div.verdict).toBe('confirm')
    expect(div.detail).toContain('does not list a single-unit detached dwelling as a permitted use')
    expect(div.detail).not.toMatch(/no minimum lot area for a single-unit/i)
  })
})

// ── ADUs and second dwellings ────────────────────────────────────────────────

describe('ADU', () => {
  it('Bend allows two ADUs with the verified size caps', () => {
    const adu = topic(resolveDevelopmentOpportunities(site({ zone: 'RL', acreage: 0.4 }), subject())!, 'ADU')!
    expect(adu.verdict).toBe('yes')
    expect(adu.detail).toContain('800 sqft')
    expect(adu.detail).toContain('500 sqft')
    expect(adu.citation).toContain('ORS 197A.425')
  })

  it('Redmond states the 300 to 900 sqft range', () => {
    const adu = topic(
      resolveDevelopmentOpportunities(site({ zone: 'R-3', acreage: 0.2 }), subject({ city: 'Redmond' }))!,
      'ADU',
    )!
    expect(adu.verdict).toBe('yes')
    expect(adu.detail).toContain('300 and 900 sqft')
  })

  // CORRECTION regression: 18.116.355 covers RR-10 and MUA-10 ONLY.
  it('cites DCC 18.116.355 for RR-10 and DCC 19.92.160 for SR-2 1/2', () => {
    const rr = topic(
      resolveDevelopmentOpportunities(
        site({ zone: 'RR-10', acreage: 5, isMunicipal: false }),
        subject({ lotAcres: 5 }),
      )!,
      'ADU',
    )!
    expect(rr.citation).toContain('18.116.355')
    expect(rr.citation).not.toContain('19.92.160')

    const sr = topic(
      resolveDevelopmentOpportunities(
        site({ zone: 'SR2-1/2', acreage: 3, isMunicipal: false }),
        subject({ lotAcres: 3 }),
      )!,
      'ADU',
    )!
    expect(sr.citation).toContain('19.92.160')
    expect(sr.citation).not.toContain('18.116.355')
  })

  // CORRECTION regression: the 5-acre threshold is geographic, not wildfire.
  it('states the Sunriver to Klamath exception and not a wildfire-mapped one', () => {
    const adu = topic(
      resolveDevelopmentOpportunities(
        site({ zone: 'MUA-10', acreage: 9.5, isMunicipal: false }),
        subject({ lotAcres: 9.5 }),
      )!,
      'ADU',
    )!
    expect(adu.verdict).toBe('conditional')
    expect(adu.detail).toContain('Sunriver and the Klamath County border')
    expect(adu.detail).not.toMatch(/wildfire-mapped/i)
    expect(adu.detail).not.toMatch(/defensible[- ]space/i)
    expect(adu.detail).toContain('900 sqft')
  })

  it('a sub-2-acre county parcel is unlikely, not eligible', () => {
    const d = resolveDevelopmentOpportunities(
      site({ zone: 'RR-10', acreage: 1.1, isMunicipal: false }),
      subject({ lotAcres: 1.1 }),
    )!
    expect(topic(d, 'ADU')!.verdict).toBe('unlikely')
    // The historic-home pathway shares the same 2-acre floor, so the second
    // dwelling cannot read as merely conditional on a 1.1-acre parcel.
    const second = topic(d, 'Second dwelling')!
    expect(second.verdict).toBe('unlikely')
    expect(second.detail).toContain('under the 2-acre floor both pathways share')
  })

  it('EFU and forest zones get a clean no', () => {
    for (const zone of ['EFU-TE', 'F-1', 'F-2']) {
      const adu = topic(
        resolveDevelopmentOpportunities(
          site({ zone, acreage: 90, isMunicipal: false }),
          subject({ lotAcres: 90 }),
        )!,
        'ADU',
      )!
      expect(adu.verdict).toBe('no')
    }
  })
})

// ── Zoning explainer ────────────────────────────────────────────────────────

describe('zoning explainer', () => {
  it('explains a Bend RS parcel with the verified dimensional standards', () => {
    const d = resolveDevelopmentOpportunities(site({ zone: 'RS', acreage: 0.25 }), subject())!
    const z = d.zoningExplainer!
    expect(z.zoneName).toBe('Standard Density Residential')
    expect(z.purpose).toContain('4.0 to 7.3')
    expect(z.permittedOutright.length).toBeGreaterThan(5)
    expect(z.conditional.length).toBeGreaterThan(3)
    const min = z.dimensional.find((x) => /Minimum lot area, single-unit/.test(x.label))!
    expect(min.value).toBe('4,000 sq ft')
    expect(z.dimensional.find((x) => x.label === 'Maximum building height')!.value).toBe('35 ft')
    expect(z.url).toMatch(/^https:\/\//)
  })

  it('explains a county RR-10 parcel with the verified purpose text', () => {
    const d = resolveDevelopmentOpportunities(
      site({ zone: 'RR-10', acreage: 10, isMunicipal: false }),
      subject({ lotAcres: 10 }),
    )!
    const z = d.zoningExplainer!
    expect(z.zoneName).toBe('Rural Residential RR-10')
    expect(z.purpose).toContain('rural residential living environments')
    expect(z.dimensional.find((x) => x.label === 'Maximum lot coverage')!.value).toContain('30 percent')
  })

  it('normalizes Redmond zone strings from the GIS layer', () => {
    expect(normalizeRedmond('R3A')).toBe('R-3A')
    expect(normalizeRedmond('R4')).toBe('R-4')
    expect(normalizeRedmond('R-1')).toBe('R-1')
  })

  it('returns null for an unregistered zone rather than guessing', () => {
    expect(resolveZoningExplainer('City of Bend', 'QQQ', 'QQQ', 'QQQ')).toBeNull()
  })

  it('every registered profile carries a citation and an https url', () => {
    const cases: Array<[Parameters<typeof resolveZoningExplainer>[0], string]> = [
      ['City of Bend', 'UAR'],
      ['City of Bend', 'RL'],
      ['City of Bend', 'RS'],
      ['City of Bend', 'RM-10'],
      ['City of Bend', 'RM'],
      ['City of Bend', 'RH'],
      ['City of Redmond', 'R-1'],
      ['City of Redmond', 'R-2'],
      ['City of Redmond', 'R-3'],
      ['City of Redmond', 'R-3A'],
      ['City of Redmond', 'R-4'],
      ['City of Redmond', 'R-5'],
    ]
    for (const [j, z] of cases) {
      const p = resolveZoningExplainer(j, z, z, z.replace(/-/g, ''))
      expect(p, z).not.toBeNull()
      expect(p!.citation.length, z).toBeGreaterThan(10)
      expect(p!.url, z).toMatch(/^https:\/\//)
      expect(p!.dimensional.length, z).toBeGreaterThan(3)
    }
    for (const key of ['RR10', 'MUA10', 'UAR10', 'SR2.5', 'EFU', 'F1', 'F2']) {
      const p = resolveZoningExplainer('Deschutes County (unincorporated)', key, key, key)
      expect(p, key).not.toBeNull()
      expect(p!.url, key).toMatch(/^https:\/\//)
    }
  })
})

// ── HOA and CC&Rs ───────────────────────────────────────────────────────────

describe('HOA and CC&Rs', () => {
  const CCR_MARKERS = ['Deschutes County Clerk', 'CC&Rs']

  it('an HOA property reports the association and the fee, formatted', () => {
    const d = resolveDevelopmentOpportunities(
      site({ zone: 'RS', acreage: 0.18 }),
      subject({ associationYn: true, associationFee: 145, associationFeeFrequency: 'Monthly' }),
    )!
    expect(d.hoa!.hasAssociation).toBe(true)
    expect(d.hoa!.feeLabel).toBe('$145 per month')
    for (const m of CCR_MARKERS) expect(d.hoa!.ccrGuidance).toContain(m)
  })

  it('a non-HOA property says so and still points at the recorded documents', () => {
    const d = resolveDevelopmentOpportunities(
      site({ zone: 'RS', acreage: 0.18 }),
      subject({ associationYn: false }),
    )!
    expect(d.hoa!.hasAssociation).toBe(false)
    expect(d.hoa!.feeLabel).toBeNull()
    expect(d.hoa!.ccrGuidance).toContain('no homeowners association')
    for (const m of CCR_MARKERS) expect(d.hoa!.ccrGuidance).toContain(m)
    expect(d.marketingHighlights.some((h) => /No homeowners association dues/.test(h.headline))).toBe(true)
  })

  it('silence in the MLS stays null and is never rendered as false', () => {
    const d = resolveDevelopmentOpportunities(site({ zone: 'RS', acreage: 0.18 }), subject())!
    expect(d.hoa!.hasAssociation).toBeNull()
    expect(d.hoa!.ccrGuidance).toContain('did not report')
    expect(d.marketingHighlights.some((h) => /No homeowners association/.test(h.headline))).toBe(false)
  })

  it('never characterises an unread CC&R restriction', () => {
    for (const s of [
      subject({ associationYn: true, hoaMonthly: 95 }),
      subject({ associationYn: false }),
      subject(),
    ]) {
      const g = resolveDevelopmentOpportunities(site({ zone: 'RS', acreage: 0.18 }), s)!.hoa!.ccrGuidance
      // No claim about what the CC&Rs permit, prohibit, or allow.
      expect(g).not.toMatch(/the CC&Rs (allow|prohibit|permit|restrict|require)/i)
      expect(g).not.toMatch(/CC&Rs (are|do not) /i)
    }
  })

  it('falls back to hoa_monthly and hoa_annual_cost', () => {
    const m = resolveDevelopmentOpportunities(site({ zone: 'RS' }), subject({ hoaMonthly: 87.5 }))!
    expect(m.hoa!.feeLabel).toBe('$88 per month')
    const y = resolveDevelopmentOpportunities(site({ zone: 'RS' }), subject({ hoaAnnualCost: 1200 }))!
    expect(y.hoa!.feeLabel).toBe('$1,200 per year')
  })

  it('flags an unknown fee frequency instead of assuming monthly', () => {
    const d = resolveDevelopmentOpportunities(
      site({ zone: 'RS' }),
      subject({ associationFee: 500, associationFeeFrequency: 'Whenever' }),
    )!
    expect(d.hoa!.feeLabel).toContain('did not report how often')
  })

  it('surfaces the resort association layer for a resort subdivision', () => {
    const d = resolveDevelopmentOpportunities(
      site({ zone: 'RR-10', acreage: 2.5, isMunicipal: false }),
      subject({ subdivision: 'Black Butte Ranch', lotAcres: 2.5 }),
    )!
    expect(d.hoa!.resortAssociation).toBe('Black Butte Ranch')
    expect(d.hoa!.ccrGuidance).toContain('master association')
  })
})

// ── Buyer options + marketing highlights ────────────────────────────────────

describe('buyer options and marketing highlights', () => {
  it('leads with the division when the parcel supports one', () => {
    const d = resolveDevelopmentOpportunities(site({ zone: 'RS', acreage: 0.5 }), subject({ lotAcres: 0.5 }))!
    expect(d.buyerOptions[0]!.headline).toMatch(/^Divide the land/)
    expect(d.buyerOptions[0]!.basedOn.length).toBeGreaterThan(0)
  })

  it('states the honest answer plainly when nothing beyond the home is available', () => {
    const d = resolveDevelopmentOpportunities(
      site({ zone: 'F-1', acreage: 40, isMunicipal: false }),
      subject({ lotAcres: 40 }),
    )!
    expect(d.buyerOptions).toHaveLength(1)
    expect(d.buyerOptions[0]!.headline).toMatch(/Hold and enjoy it as it stands/)
  })

  it('every buyer option and highlight carries a non-empty basis', () => {
    const cases = [
      resolveDevelopmentOpportunities(site({ zone: 'RS', acreage: 0.5 }), subject({ lotAcres: 0.5 }))!,
      resolveDevelopmentOpportunities(
        site({ zone: 'RR-10', acreage: 22, isMunicipal: false }),
        subject({ lotAcres: 22, associationYn: false }),
      )!,
      resolveDevelopmentOpportunities(
        site({ zone: 'R-5', acreage: 0.3 }),
        subject({ city: 'Redmond', lotAcres: 0.3 }),
      )!,
    ]
    for (const d of cases) {
      for (const o of d.buyerOptions) {
        expect(o.basedOn.length).toBeGreaterThan(0)
        for (const b of o.basedOn) expect(b.trim().length).toBeGreaterThan(0)
      }
      for (const h of d.marketingHighlights) {
        expect(h.basis.trim().length).toBeGreaterThan(0)
        expect(h.headline.trim().length).toBeGreaterThan(0)
      }
    }
  })

  it('turns a constraint into a positive, cited highlight', () => {
    const d = resolveDevelopmentOpportunities(
      site({ zone: 'RR-10', acreage: 10.2, isMunicipal: false }),
      subject({ lotAcres: 10.2 }),
    )!
    const h = d.marketingHighlights.find((x) => /holds every parcel/.test(x.headline))!
    expect(h).toBeTruthy()
    expect(h.basis).toContain('18.60.060')
  })
})

// ── Contract, citations, and brand voice ────────────────────────────────────

describe('contract and voice', () => {
  const SAMPLES = () => [
    resolveDevelopmentOpportunities(site({ zone: 'RS', acreage: 0.5 }), subject({ lotAcres: 0.5 }))!,
    resolveDevelopmentOpportunities(site({ zone: 'RH', acreage: 0.4 }), subject({ lotAcres: 0.4 }))!,
    resolveDevelopmentOpportunities(site({ zone: 'UAR', acreage: 25 }), subject({ lotAcres: 25 }))!,
    resolveDevelopmentOpportunities(
      site({ zone: 'R-4', acreage: 0.4 }),
      subject({ city: 'Redmond', lotAcres: 0.4, associationYn: true, hoaMonthly: 60 }),
    )!,
    resolveDevelopmentOpportunities(
      site({ zone: 'RR-10', acreage: 22, isMunicipal: false }),
      subject({ lotAcres: 22, associationYn: false }),
    )!,
    resolveDevelopmentOpportunities(
      site({ zone: 'EFU-TE', acreage: 320, isMunicipal: false }),
      subject({ lotAcres: 320 }),
    )!,
  ]

  it('every item carries a citation and an https source url', () => {
    for (const d of SAMPLES()) {
      for (const i of d.items) {
        expect(i.citation.trim().length, i.topic).toBeGreaterThan(8)
        expect(i.url, i.topic).toMatch(/^https:\/\//)
        expect(i.verifiedOn, i.topic).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      }
      expect(d.resources.length).toBeGreaterThan(5)
      expect(d.disclaimer).toBe(DEV_DISCLAIMER)
      expect(d.verifiedAsOf).toBe(REGS_REVERIFIED_DATE)
    }
  })

  it('holds the brand-voice mechanical floor', () => {
    const banned =
      /\b(stunning|breathtaking|gorgeous|charming|pristine|nestled|boasts|must-see|dream home|hidden gem|turnkey|luxurious|immaculate|delve|tapestry|robust|seamless|elevate|unlock|holistic|bespoke|premier|boutique|concierge|act fast|don't miss out|won't last)\b/i
    for (const d of SAMPLES()) {
      const text = allText(d)
      expect(text).not.toMatch(/[—–]/)
      expect(text).not.toContain(';')
      expect(text, d.zone).not.toMatch(banned)
    }
  })

  it('exposes the full documented contract shape', () => {
    const d = resolveDevelopmentOpportunities(site({ zone: 'RS', acreage: 0.5 }), subject({ lotAcres: 0.5 }))!
    expect(Object.keys(d).sort()).toEqual(
      [
        'buyerOptions',
        'disclaimer',
        'hoa',
        'items',
        'jurisdiction',
        'marketingHighlights',
        'resources',
        'verifiedAsOf',
        'zone',
        'zoningExplainer',
      ].sort(),
    )
  })

  it('buildResourceDirectory splices the irrigation district when present', () => {
    const base = buildResourceDirectory(site())
    const withDistrict = buildResourceDirectory(
      site({ water: { ...site().water, irrigationDistrict: 'Central Oregon Irrigation District' } }),
    )
    expect(withDistrict.length).toBe(base.length + 1)
    expect(withDistrict.some((r) => r.name === 'Central Oregon Irrigation District')).toBe(true)
    expect(base.some((r) => /Deschutes County Clerk/.test(r.name))).toBe(true)
  })
})
