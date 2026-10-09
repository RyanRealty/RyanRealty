/**
 * ONE NAME FOR A SALE'S SUBDIVISION (reader review 2026-10-09, 20676 Wild Rose).
 *
 * The letter named 61197 Cottonwood's subdivision "CLAB", the MLS code on its
 * listing, in the search story, the map caption and three competition
 * sentences, while the map outlined and labeled the recorded plat the house
 * sits in, "Tara View Estates". A sale in a recorded plat polygon is now named
 * by that plat's recorded name, the map's label; a sale no polygon holds keeps
 * its MLS name; the MLS name stays the identity every read and membership test
 * is keyed on.
 *
 * Fixtures: render_args.subject, render_args.comps and render_args.compSearch
 * of cma-20676-wild-rose, and boundaries.geo_label for each sale's plat, read
 * 2026-10-09.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const labels = vi.hoisted(() => ({ read: vi.fn() }))
vi.mock('@/lib/data/geo/subdivision-ring', () => ({ readBoundaryLabels: labels.read }))

import { printedRecordedPlat, withRecordedPlatNames } from '@/lib/cma/printed-subdivision'
import { buildCompArea, compAreaContains, compAreaIn, compAreaLabel, compAreaPhrase } from '@/lib/pricing/comp-area'
import { buildCompSearch } from '@/lib/pricing/comp-search'
import { readCompArea } from '@/lib/cma/matrix-sets'
import { outsideSubdivisionSentence } from '@/lib/cma/sales-method-note'
import type { CmaAdjustedComp } from '@/lib/cma/types'

/** boundaries.geo_label, geo_type 'subdivision'. */
const GEO_LABELS = new Map([
  ['chloe-estates', 'Chloe Estates'],
  ['south-point', 'South Point'],
  ['foxborough-phase-3', 'Foxborough Phase 3'],
  ['tara-view-estates', 'Tara View Estates'],
  ['larkspur-village-phases-iii-and-iv', 'Larkspur Village Phases III And IV'],
])

const subject = {
  latitude: 44.021047,
  longitude: -121.290318,
  subdivision: 'Larkspur',
  subdivisionSlug: 'larkspur-village-phases-iii-and-iv',
  streetAddress: '20676 Wild Rose',
  city: 'Bend',
}

/** render_args.comps on cma-20676-wild-rose. */
const COMPS = [
  { address: '20825 Chloe', subdivision: 'Chloe Estates', subdivisionSlug: 'chloe-estates', selectionTier: 'nearby-1.25mi-3mo', latitude: 44.023187, longitude: -121.282816 },
  { address: '20582 Goldenrod', subdivision: 'South Point', subdivisionSlug: 'south-point', selectionTier: 'closer-sub-9mo', latitude: 44.02062, longitude: -121.294318 },
  { address: '20606 Songbird', subdivision: 'Foxborough', subdivisionSlug: 'foxborough-phase-3', selectionTier: 'pocket-6mo', latitude: 44.023789, longitude: -121.292997 },
  { address: '61197 Cottonwood', subdivision: 'CLAB', subdivisionSlug: 'tara-view-estates', selectionTier: 'nearby-1.25mi-9mo', latitude: 44.022315, longitude: -121.271014 },
  { address: '61131 Brown Trout', subdivision: 'South Point', subdivisionSlug: 'south-point', selectionTier: 'closer-sub-18mo', latitude: 44.019928, longitude: -121.295156 },
].map((c) => ({ ...c, ownPlat: false }))

const RUNGS = [
  { key: 'subdivision-24mo', kept: 0, added: 0 },
  { key: 'closer-sub-9mo', kept: 1, added: 1 },
  { key: 'closer-sub-18mo', kept: 1, added: 1 },
  { key: 'pocket-6mo', kept: 1, added: 1 },
  { key: 'nearby-1.25mi-3mo', kept: 1, added: 1 },
  { key: 'nearby-1.25mi-9mo', kept: 1, added: 1 },
]

/** The boundaries read, answered from GEO_LABELS. */
function readFromBoundaries() {
  labels.read.mockImplementation(async (_t: string, slugs: readonly string[]) =>
    new Map(slugs.flatMap((s) => (GEO_LABELS.has(s) ? [[s, GEO_LABELS.get(s)!] as const] : []))),
  )
}
readFromBoundaries()

beforeEach(() => {
  labels.read.mockClear()
  readFromBoundaries()
})

describe('the printed name of a recorded plat', () => {
  it('is the map label: file numbers off, phases kept, never a slug', () => {
    expect(printedRecordedPlat('Tara View Estates')).toBe('Tara View Estates')
    expect(printedRecordedPlat('Shevlin West Phase 4 Pz-20-0010')).toBe('Shevlin West Phase 4')
    expect(printedRecordedPlat('tara-view-estates')).toBeNull()
    expect(printedRecordedPlat(null)).toBeNull()
  })

  it('stamps every sale in a polygon with its plat name, in one read, and leaves the MLS name alone', async () => {
    const stamped = await withRecordedPlatNames(COMPS)
    expect(labels.read).toHaveBeenCalledTimes(1)
    expect(stamped.map((c) => [c.subdivision, c.platName])).toEqual([
      ['Chloe Estates', 'Chloe Estates'],
      ['South Point', 'South Point'],
      ['Foxborough', 'Foxborough Phase 3'],
      ['CLAB', 'Tara View Estates'],
      ['South Point', 'South Point'],
    ])
  })

  it('a sale no polygon holds, or a failed read, keeps its MLS name', async () => {
    const [unplatted] = await withRecordedPlatNames([{ subdivision: 'CLAB', subdivisionSlug: null }])
    expect(unplatted!.platName).toBeUndefined()
    labels.read.mockResolvedValueOnce(null)
    const [failed] = await withRecordedPlatNames([COMPS[3]!])
    expect(failed!.platName).toBeUndefined()
  })
})

describe('20676 Wild Rose: 61197 Cottonwood is in Tara View Estates everywhere', async () => {
  const stamped = await withRecordedPlatNames(COMPS)
  const area = buildCompArea({ subject, rungs: RUNGS, keptComps: stamped })!
  const before = buildCompArea({ subject, rungs: RUNGS, keptComps: COMPS })!

  it('the map caption names the plats the map labels', () => {
    expect(before.sentence).toBe(
      'Larkspur, your own subdivision, with South Point one subdivision further out, Foxborough within 0.35 miles of your home and Chloe Estates and CLAB within 1.25 miles of your home.',
    )
    expect(area.sentence).toBe(
      'Larkspur, your own subdivision, with South Point one subdivision further out, Foxborough Phase 3 within 0.35 miles of your home and Chloe Estates and Tara View Estates within 1.25 miles of your home.',
    )
    expect(area.labels).toEqual({ Foxborough: 'Foxborough Phase 3', CLAB: 'Tara View Estates' })
  })

  it('the competition sentences print the same names', () => {
    expect(compAreaPhrase(area)).toBe('Larkspur, Chloe Estates, South Point, Foxborough Phase 3 and Tara View Estates')
    expect(compAreaIn(area, { negative: true })).toBe('in Larkspur, Chloe Estates, South Point, Foxborough Phase 3 or Tara View Estates')
    expect(compAreaPhrase(area)).not.toContain('CLAB')
  })

  it('the reads and the membership test keep the MLS identity', () => {
    expect(area.names).toEqual(before.names)
    expect(area.names).toContain('CLAB')
    expect(area.platSlugs).toEqual(before.platSlugs)
    // A home no polygon holds is still read by its MLS name.
    expect(compAreaContains(area, { subdivision: 'CLAB', platSlug: null, latitude: 44.0223, longitude: -121.271 })).toBe(true)
    expect(compAreaLabel(area, 'CLAB')).toBe('Tara View Estates')
    expect(compAreaLabel(area, 'Larkspur')).toBe('Larkspur')
  })

  it('the headline names the sale by its plat', () => {
    const search = buildCompSearch({
      subdivision: 'Larkspur',
      ladder: RUNGS.map((r) => ({ tier: r.key, ran: true, monthsBack: Number(/(\d+)mo/.exec(r.key)?.[1] ?? 0), compsAdded: r.added })),
      keptComps: stamped,
      ownGroundSold: 2,
    })!
    expect(search.sentence).toBe(
      'No sale inside Larkspur in the last 24 months matched your home, so the search opened to 20825 Chloe in Chloe Estates, 20582 Goldenrod in South Point, 20606 Songbird in Foxborough Phase 3, 61197 Cottonwood in Tara View Estates and 61131 Brown Trout in South Point.',
    )
  })

  it('the method note names it the same way', () => {
    const grid = stamped.map((c) => ({ ...c, city: 'Bend' }) as unknown as CmaAdjustedComp)
    expect(outsideSubdivisionSentence({ subdivision: 'Larkspur' }, [...grid, { address: '20660 Wild Rose', subdivision: 'Larkspur' } as CmaAdjustedComp])).toBe(
      'Five of the six sales are outside Larkspur: 20825 Chloe in Chloe Estates, 20582 Goldenrod in South Point, 20606 Songbird in Foxborough Phase 3, 61197 Cottonwood in Tara View Estates and 61131 Brown Trout in South Point.',
    )
  })

  it('the stored area carries the names to the map and the renderer', () => {
    const stored = readCompArea({ compArea: JSON.parse(JSON.stringify(area)) })
    expect(stored?.labels).toEqual({ Foxborough: 'Foxborough Phase 3', CLAB: 'Tara View Estates' })
  })
})

describe('one MLS name that spans two plats keeps its MLS spelling', () => {
  it('two Foxborough sales in two phases print as Foxborough, not one phase for both', async () => {
    const comps = [
      { ...COMPS[2]! },
      { ...COMPS[2]!, address: '20590 Songbird', subdivisionSlug: 'foxborough-phase-2' },
    ]
    labels.read.mockResolvedValueOnce(new Map([['foxborough-phase-3', 'Foxborough Phase 3'], ['foxborough-phase-2', 'Foxborough Phase 2']]))
    const stamped = await withRecordedPlatNames(comps)
    const area = buildCompArea({ subject, rungs: [{ key: 'pocket-6mo', kept: 2, added: 2 }], keptComps: stamped })!
    expect(area.labels?.Foxborough).toBeUndefined()
    expect(compAreaPhrase(area)).toContain('Foxborough')
    expect(compAreaPhrase(area)).not.toContain('Phase')
  })
})
