/**
 * "NO HOME SOLD" ONLY WHEN NONE DID (reader review 2026-10-09, 915 Saginaw).
 *
 * The letter said "No sale inside Park Place in the last 24 months matched
 * your home." No home sold in Park Place in those 24 months: zero closed
 * listings by MLS name (SubdivisionName ILIKE 'Park Place%', City Bend,
 * CloseDate >= 2024-10-09) and zero inside the recorded park-place polygon,
 * read 2026-10-09. "Matched" suggested sales looked at and turned down.
 *
 * When the own-subdivision rungs find nothing, the selection reads the
 * subject's own ground once, any size and any residential type, over the
 * same window (lib/cma/own-ground-sold.ts), and the search story says "No home
 * sold in X" on a zero and "No sale inside X matched your home" only when
 * homes did sell there.
 */
import { describe, expect, it } from 'vitest'
import { monthsBefore, ownGroundSales } from '@/lib/cma/own-ground-sold'
import { salesSearchAndArea } from '@/lib/cma/assemble-competition'
import type { CompSelectionDiagnostics } from '@/lib/cma/comp-trace'
import type { CmaSubject } from '@/lib/cma/types'

/** render_args.subject on cma-915-saginaw (the fields the ground reads). */
const subject = {
  listingKey: 'SAGINAW-915',
  streetAddress: '915 Saginaw',
  city: 'Bend',
  subdivision: 'Park Place',
  subdivisionSlug: 'park-place',
  latitude: 44.06569,
  longitude: -121.32545,
} as unknown as CmaSubject

const row = (over: Record<string, unknown>) => ({
  ListingKey: 'K',
  StreetNumber: '1',
  StreetName: 'Main',
  SubdivisionName: 'Park Place',
  Latitude: 44.0656,
  Longitude: -121.3255,
  ClosePrice: 600_000,
  ...over,
})

describe('the read window and the ground', () => {
  it('reads back the same number of months the rungs read', () => {
    expect(monthsBefore('2026-10-09', 24)).toBe('2024-10-09')
  })

  it('counts a sale on the subject\'s own plat once, by polygon or by MLS name off any polygon, never the subject', () => {
    const rows = [
      row({ ListingKey: 'A', StreetNumber: '901', StreetName: 'Saginaw' }),
      // The same closed sale relisted under a second key.
      row({ ListingKey: 'A2', StreetNumber: '901', StreetName: 'Saginaw' }),
      // Another MLS spelling, inside the recorded polygon.
      row({ ListingKey: 'B', StreetNumber: '905', StreetName: 'Saginaw', SubdivisionName: 'Park Pl Addn' }),
      // The MLS name, but another subdivision's polygon.
      row({ ListingKey: 'C', StreetNumber: '640', StreetName: 'Delaware', SubdivisionName: 'Park Place' }),
      // The subject itself.
      row({ ListingKey: 'SAGINAW-915', StreetNumber: '915', StreetName: 'Saginaw' }),
      // The MLS name, no polygon holds it.
      row({ ListingKey: 'D', StreetNumber: '920', StreetName: 'Saginaw', Latitude: null, Longitude: null }),
    ]
    const plats = ['park-place', 'park-place', 'park-place', 'kenwood', 'park-place', null]
    expect(ownGroundSales(subject, rows, plats).map((r) => r.ListingKey)).toEqual(['A', 'B', 'D'])
  })

  it('nothing on the ground is zero', () => {
    const rows = [row({ ListingKey: 'C', SubdivisionName: 'Kenwood' })]
    expect(ownGroundSales(subject, rows, ['kenwood'])).toEqual([])
  })
})

describe('915 Saginaw: the search story off the stored rungs and the ground read', () => {
  // build_summary.comp_selection.ladder on cma-915-saginaw: every Park Place
  // rung ran out to 24 months and added nothing.
  const ladder = [
    { tier: 'own-street-24mo', ran: true, months_back: 24, comps_added: 1 },
    ...[3, 6, 9, 12, 18, 24].flatMap((m) => [
      { tier: `subdivision-${m}mo`, ran: true, months_back: m, comps_added: 0 },
      { tier: `subdivision-${m}mo-wide`, ran: true, months_back: m, comps_added: 0 },
    ]),
    { tier: 'closer-sub-9mo', ran: true, months_back: 9, comps_added: 1 },
    { tier: 'nearby-1.25mi-3mo', ran: true, months_back: 3, comps_added: 3 },
  ]
  const comps = [
    { address: '536 Saginaw', subdivision: 'Kenwood', subdivisionSlug: 'kenwood', selectionTier: 'own-street-24mo', latitude: 44.0657, longitude: -121.3262, ownPlat: false },
    { address: '628 Portland', subdivision: 'Kenwood', subdivisionSlug: 'kenwood', selectionTier: 'closer-sub-9mo', latitude: 44.0661, longitude: -121.3251, ownPlat: false },
    { address: '335 17th', subdivision: 'Miller Heights', subdivisionSlug: 'miller-heights', selectionTier: 'nearby-1.25mi-3mo', latitude: 44.06, longitude: -121.31, ownPlat: false },
  ]
  const diagnostics = (own: CompSelectionDiagnostics['own_ground_sold']) =>
    ({
      subject: { subdivision: 'Park Place' },
      ladder,
      rural_acreage: false,
      excluded_totals: {},
      ...(own !== undefined ? { own_ground_sold: own } : {}),
    }) as unknown as CompSelectionDiagnostics

  it('no home sold in Park Place: says so, and never "matched"', () => {
    const { compSearch } = salesSearchAndArea({
      subject,
      comps,
      diagnostics: diagnostics({ months: 24, since: '2024-10-09', n: 0, capped: false, source: 'test' }),
      subjectZone: null,
    })
    expect(compSearch!.sentence).toMatch(/^No home sold in Park Place in the last 24 months, so the search opened to /)
    expect(compSearch!.sentence).not.toContain('matched')
  })

  it('homes sold there and none matched: "matched" is true, and prints', () => {
    const { compSearch } = salesSearchAndArea({
      subject,
      comps,
      diagnostics: diagnostics({ months: 24, since: '2024-10-09', n: 2, capped: false, source: 'test' }),
      subjectZone: null,
    })
    expect(compSearch!.sentence).toMatch(/^No sale inside Park Place in the last 24 months matched your home, so the search opened to /)
  })

  it('not read: neither claim', () => {
    const { compSearch } = salesSearchAndArea({ subject, comps, diagnostics: diagnostics(undefined), subjectZone: null })
    expect(compSearch!.sentence).toMatch(/^The search found no sale inside Park Place in the last 24 months to use, so it opened to /)
  })
})
