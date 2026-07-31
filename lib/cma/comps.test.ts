import { describe, it, expect } from 'vitest'
import { realSubdivision, compTierLadder, isRuralAcreage } from '@/lib/cma/comp-tiers'
import {
  addExclusions,
  countByTier,
  diagnoseStarvation,
  emptyExclusions,
  totalExclusions,
  type CompSelectionDiagnostics,
  type CompTierTrace,
} from '@/lib/cma/comp-trace'
import type { CmaSubject } from '@/lib/cma/types'

const subject = (over: Partial<CmaSubject> = {}): CmaSubject =>
  ({
    listingKey: 'k',
    mlsNumber: null,
    streetAddress: '1 Main',
    city: 'Bend',
    postalCode: null,
    subdivision: null,
    latitude: 44,
    longitude: -121,
    beds: 3,
    baths: 2,
    sqft: 2000,
    lotAcres: 0.2,
    propertySubType: 'Single Family Residence',
    yearBuilt: 2000,
    ...over,
  }) as unknown as CmaSubject

describe('realSubdivision — the MLS placeholder trap', () => {
  // 62,974 listings rows carry the literal 'N/A' (2,629 closed SFR in the last
  // 12 months) and 21 live CMA subjects carry it. Querying it as a subdivision
  // matched citywide strangers and stamped them 'subdivision-6mo'.
  it.each(['N/A', 'n/a', 'NA', 'N.A.', 'None', 'none', 'NO', 'null', 'Other', 'Unknown', 'TBD', '-', '.', '  N/A  '])(
    'treats %s as no subdivision',
    (v) => {
      expect(realSubdivision(v)).toBeNull()
    },
  )
  it.each(['Not in Subdivision', 'not in a subdivision', 'NOT IN SUBDIVISION'])('treats %s as no subdivision', (v) => {
    expect(realSubdivision(v)).toBeNull()
  })
  it('keeps a real subdivision name, trimmed', () => {
    expect(realSubdivision('  Kenwood ')).toBe('Kenwood')
    expect(realSubdivision('Awbrey Butte')).toBe('Awbrey Butte')
    expect(realSubdivision('River Pine Estates')).toBe('River Pine Estates')
  })
  it('does not eat a real name that merely contains a sentinel word', () => {
    expect(realSubdivision('Other Ranch')).toBe('Other Ranch')
    expect(realSubdivision('Nolan Heights')).toBe('Nolan Heights')
  })
  it('handles null and empty', () => {
    expect(realSubdivision(null)).toBeNull()
    expect(realSubdivision(undefined)).toBeNull()
    expect(realSubdivision('   ')).toBeNull()
  })
})

describe('compTierLadder', () => {
  it('walks tightest-first and trades TIME before it trades LOCATION', () => {
    const names = compTierLadder('Kenwood').map((t) => t.name)
    expect(names).toEqual([
      'subdivision-6mo',
      'subdivision-12mo',
      'neighborhood-6mo',
      'neighborhood-12mo',
      'competing-area-12mo',
      'citywide-12mo',
      'rural-county-12mo',
      'rural-county-24mo',
    ])
    expect(names.indexOf('subdivision-12mo')).toBeLessThan(names.indexOf('neighborhood-6mo'))
  })

  it('keeps the city bound on every rung except the rural ones', () => {
    for (const t of compTierLadder(null)) {
      expect(!!t.ignoreCity).toBe(t.name.startsWith('rural-'))
    }
  })

  it('marks only the rural rungs ruralOnly, and only they carry a disclosure', () => {
    for (const t of compTierLadder(null)) {
      expect(!!t.ruralOnly).toBe(t.name.startsWith('rural-'))
      expect(!!t.disclosure).toBe(t.name.startsWith('rural-'))
    }
  })

  it('bounds every city-dropping rung by a radius, so it never means "anywhere"', () => {
    for (const t of compTierLadder(null)) {
      if (t.ignoreCity) expect(t.maxMiles).toBeGreaterThan(0)
    }
  })

  it('passes the sanitized subdivision through to both subdivision rungs', () => {
    const l = compTierLadder('Kenwood')
    expect(l[0]!.subdivisionIlike).toBe('Kenwood')
    expect(l[1]!.subdivisionIlike).toBe('Kenwood')
    expect(compTierLadder(null)[0]!.subdivisionIlike).toBeNull()
  })
})

describe('isRuralAcreage — who may reach the rural rungs', () => {
  it('is true only outside every polygon AND on an acre or more', () => {
    expect(isRuralAcreage(subject({ lotAcres: 5.34 }), null)).toBe(true)
    expect(isRuralAcreage(subject({ lotAcres: 1 }), null)).toBe(true)
  })
  it('is false for an in-town lot with no polygon (Redmond, Sisters — no GIS mesh)', () => {
    expect(isRuralAcreage(subject({ lotAcres: 0.18 }), null)).toBe(false)
    expect(isRuralAcreage(subject({ lotAcres: 0.99 }), null)).toBe(false)
  })
  it('is false inside a mapped Bend neighborhood however large the lot', () => {
    expect(isRuralAcreage(subject({ lotAcres: 40 }), 'river-west')).toBe(false)
  })
  it('is false when the lot size is unknown', () => {
    expect(isRuralAcreage(subject({ lotAcres: null }), null)).toBe(false)
  })
})

describe('exclusion counters', () => {
  it('sums per-tier tallies into the totals', () => {
    const total = emptyExclusions()
    const a = { ...emptyExclusions(), product_type: 4, distance: 1 }
    const b = { ...emptyExclusions(), product_type: 9, lot_character: 8, distance: 3 }
    addExclusions(total, a)
    addExclusions(total, b)
    expect(total.product_type).toBe(13)
    expect(total.lot_character).toBe(8)
    expect(total.distance).toBe(4)
    expect(totalExclusions(total)).toBe(25)
  })
})

describe('countByTier — provenance of the PRICED set', () => {
  it('counts by selectionTier and buckets a missing tier as unknown', () => {
    expect(
      countByTier([
        { selectionTier: 'subdivision-12mo' },
        { selectionTier: 'subdivision-12mo' },
        { selectionTier: 'rural-county-24mo' },
        { selectionTier: null },
      ]),
    ).toEqual({ 'subdivision-12mo': 2, 'rural-county-24mo': 1, unknown: 1 })
  })
})

function diag(over: Partial<CompSelectionDiagnostics> = {}): CompSelectionDiagnostics {
  return {
    market_area: null,
    market_area_resolved: false,
    rural_acreage: true,
    subject: { sqft: 2318, lot_acres: 5.34, subdivision: null, subdivision_raw: 'N/A', product_sub_type: 'Single Family Residence' },
    ladder: [],
    tiers_used: [],
    reached_target: false,
    starved: true,
    starved_at: 'rural-county-24mo',
    starved_reason: null,
    target_comps: 5,
    min_comps: 3,
    candidates: 2,
    excluded_totals: emptyExclusions(),
    outliers_excluded: 0,
    final_count: 2,
    final_tier_counts: {},
    disclosures: [],
    ...over,
  }
}

function rung(over: Partial<CompTierTrace> = {}): CompTierTrace {
  return {
    tier: 'citywide-12mo',
    ran: true,
    skipped_reason: null,
    months_back: 12,
    sqft_min: 1507,
    sqft_max: 3129,
    lot_min: 2.14,
    lot_max: 13.35,
    geography: "City ILIKE 'La Pine', within 5 miles of the subject",
    rows_returned: 4,
    comps_added: 0,
    running_total: 2,
    excluded: emptyExclusions(),
    ...over,
  }
}

describe('diagnoseStarvation — name the constraint, not the count', () => {
  it('returns null when the target was reached', () => {
    expect(diagnoseStarvation(diag({ starved: false, reached_target: true }))).toBeNull()
  })

  it('says "no comparable sales on record" when no tier returned a single row', () => {
    const msg = diagnoseStarvation(diag({ ladder: [rung({ rows_returned: 0 })] }))!
    expect(msg).toMatch(/No closed sale anywhere in the database matched/)
    expect(msg).toMatch(/no comparable sales on record/)
    // The bands are named so the reader can see WHAT was too tight.
    expect(msg).toContain('1,507-3,129 sqft')
    expect(msg).toContain('2.14-13.35 acres')
  })

  it('names the dominant exclusion when rows came back but were filtered out', () => {
    const msg = diagnoseStarvation(
      diag({
        ladder: [rung({ rows_returned: 20, excluded: { ...emptyExclusions(), product_type: 9, lot_character: 8, distance: 4 } })],
        excluded_totals: { ...emptyExclusions(), product_type: 9, lot_character: 8, distance: 4 },
      }),
    )!
    expect(msg).toContain('20 candidate row(s)')
    expect(msg).toMatch(/single largest constraint was product type/)
    expect(msg).toMatch(/9 on product type/)
    expect(msg).toMatch(/8 on lot character/)
  })

  it('does not blame duplicate or self skips — they are bookkeeping, not constraints', () => {
    const msg = diagnoseStarvation(
      diag({
        ladder: [rung({ rows_returned: 6 })],
        excluded_totals: { ...emptyExclusions(), duplicate: 4, self: 2 },
      }),
    )!
    expect(msg).not.toMatch(/duplicate/)
    expect(msg).toMatch(/too few sales/)
  })

  it('explains a ladder where no rung could even run', () => {
    const msg = diagnoseStarvation(
      diag({ ladder: [rung({ ran: false, skipped_reason: 'the subject sits outside every mapped neighborhood polygon' })] }),
    )!
    expect(msg).toMatch(/No comp search could run/)
    expect(msg).toMatch(/outside every mapped neighborhood polygon/)
  })
})
