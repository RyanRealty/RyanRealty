/**
 * Place-registry alias contract.
 *
 * subdivision_aliases must come from a recorded county plat or an HOA / MLS
 * string, never a Spark nearby + radius inside-test. The 2026-05-15 spatial
 * grab assigned neighbor plats to Tetherow and Shevlin* plats to Awbrey Glen.
 */
import { describe, expect, it } from 'vitest'
import registry from '@/data/resort-communities.json'
import { resortActiveSfrCounts } from '@/lib/kb/resort-active-counts'

type Community = {
  slug: string
  label: string
  city: string
  city_slug: string
  subdivision_aliases?: string[]
  sub_neighborhoods?: Array<{
    slug: string
    name: string
    kind?: string
    recorded_plat?: string
    source?: string
  }>
  nest?: { kind?: string; note?: string; in_city_plats?: string[] }
}

const communities = (registry as { communities: Community[] }).communities
const bySlug = Object.fromEntries(communities.map((c) => [c.slug, c]))

const TETHEROW_RADIUS_FALSE_POSITIVES = [
  'Sunrise Village',
  'Westbrook Meadows',
  'Braeburn',
  '1st On The Hillsites',
  'Lodges at Bachelor V',
  'Campbell Road',
  'Roald West',
]

describe('resort community aliases — official nest, not radius', () => {
  it('keeps the 19 featured parents and does not invent a second Pronghorn', () => {
    expect(communities).toHaveLength(19)
    expect(communities.filter((c) => /pronghorn|juniper/i.test(c.slug))).toEqual([
      expect.objectContaining({ slug: 'pronghorn' }),
    ])
  })

  it('documents that aliases come from county plat / HOA, not radius', () => {
    const source = String((registry as { source?: string }).source ?? '')
    const note = String((registry as { alias_rule?: string }).alias_rule ?? '')
    expect(`${source}\n${note}`).toMatch(/county plat|HOA/i)
    expect(`${source}\n${note}`).not.toMatch(/Spark MLS API spatial discovery/)
  })

  it('drops the Tetherow radius false positives', () => {
    const aliases = bySlug.tetherow.subdivision_aliases ?? []
    for (const name of TETHEROW_RADIUS_FALSE_POSITIVES) {
      expect(aliases).not.toContain(name)
    }
    expect(aliases.some((a) => /^tetherow crossing/i.test(a))).toBe(false)
  })

  it('keeps recorded Tetherow plats plus MLS Tetherow / Triple Knot strings', () => {
    const aliases = bySlug.tetherow.subdivision_aliases ?? []
    expect(aliases).toEqual(expect.arrayContaining([
      'Tetherow',
      'Triple',
      'Triple Knot',
      'Tetherow Cascades Vista Phase 1',
      'Tetherow Cascades Vista Phase 2',
      'North Forty At Tetherow',
      'Tetherow Phase 1',
      'Tetherow Phase 2',
      'Tetherow Phase 6',
      'Tetherow Rim',
      'Trailhead At Tetherow Phase 1',
      'Highlands Ridge',
      'Outrider Overlook',
    ]))
  })

  it('labels Tetherow marketing names and maps The Glen to Cascades Vista', () => {
    const subs = bySlug.tetherow.sub_neighborhoods ?? []
    const glen = subs.find((s) => s.slug === 'glen' || /glen/i.test(s.name))
    expect(glen?.kind).toBe('toa_marketing')
    expect(glen?.recorded_plat).toMatch(/Cascades Vista/i)
    expect(subs.every((s) => s.kind === 'toa_marketing' || s.kind === 'recorded_plat')).toBe(true)
  })

  it('does not nest Tetherow under a Bend district', () => {
    expect(bySlug.tetherow.nest?.kind).toBe('census_cdp')
    expect(bySlug.tetherow.nest?.note).toMatch(/Summit West|Century West/)
    expect(bySlug.tetherow.nest?.in_city_plats).toEqual(expect.arrayContaining([
      'Tetherow Phase 1',
      'Tetherow Phase 2',
      'Tetherow Phase 6',
      'North Forty At Tetherow',
    ]))
  })

  it('removes Shevlin* from Awbrey Glen', () => {
    const aliases = bySlug['awbrey-glen'].subdivision_aliases ?? []
    expect(aliases.every((a) => !/shevlin/i.test(a))).toBe(true)
    expect(aliases).toContain('Awbrey Glen')
  })

  it('adds Juniper Preserve on the Pronghorn parent only', () => {
    const aliases = bySlug.pronghorn.subdivision_aliases ?? []
    expect(aliases).toEqual(expect.arrayContaining(['Pronghorn', 'Juniper Preserve']))
    expect(communities.some((c) => c.slug === 'juniper-preserve')).toBe(false)
  })

  it('does not count Redmond Tetherow Crossing toward Bend Tetherow', () => {
    const counts = resortActiveSfrCounts('bend', [
      { subdivisionName: 'Tetherow', propertyType: 'A' },
      { subdivisionName: 'Tetherow Phase 2', propertyType: 'A' },
      { subdivisionName: 'Tetherow Crossing', propertyType: 'A' },
      { subdivisionName: 'Tetherow Crossing Phase II', propertyType: 'A' },
    ])
    expect(counts.get('tetherow')).toBe(2)
  })
})
