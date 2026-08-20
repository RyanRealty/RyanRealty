/**
 * Place-registry alias + nest contract.
 *
 * subdivision_aliases must come from a recorded county plat or an HOA / MLS
 * string, never a Spark nearby + radius inside-test. The 2026-05-15 spatial
 * grab assigned neighbor plats to Tetherow and Shevlin* plats to Awbrey Glen.
 *
 * Every featured parent carries city + nest + kind. Missing majors are either
 * in the seed or listed in `rejected` with a source reason.
 */
import { describe, expect, it } from 'vitest'
import registry from '@/data/resort-communities.json'
import { resortActiveSfrCounts } from '@/lib/kb/resort-active-counts'

const COMMUNITY_KINDS = [
  'planned_community',
  'golf_community',
  'planned_and_golf',
  'public_golf',
  'cdp',
  'resort_village',
] as const

const NEST_KINDS = ['census_cdp', 'bend_district', 'unincorporated'] as const

type Community = {
  slug: string
  label: string
  city: string
  city_slug: string
  kind?: string
  display_name?: string
  subdivision_aliases?: string[]
  sub_neighborhoods?: Array<{
    slug: string
    name: string
    kind?: string
    recorded_plat?: string
    source?: string
  }>
  nest?: {
    kind?: string
    neighborhood?: string
    cdp?: string
    parent_slug?: string
    note?: string
    in_city_plats?: string[]
    levels?: string[]
  }
}

type Rejected = { name: string; reason: string }

const communities = (registry as { communities: Community[] }).communities
const rejected = ((registry as { rejected?: Rejected[] }).rejected ?? [])
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

const PUBLIC_COURSE_PARENTS = [
  'lost-tracks',
  'juniper-golf',
  'quail-run',
  'aspen-lakes',
  'bend-golf-club',
  'meadow-lakes',
]

const REQUIRED_MAJORS = [
  'discovery-west',
  'tree-farm',
  'westgate',
  'seventh-mountain',
]

describe('resort community aliases — official nest, not radius', () => {
  it('keeps one Pronghorn parent and does not invent a second', () => {
    expect(communities.filter((c) => /pronghorn|juniper/i.test(c.slug))).toEqual([
      expect.objectContaining({ slug: 'pronghorn' }),
    ])
  })

  it('does not dump the Bend plat catalog into the featured seed', () => {
    expect(communities.length).toBeLessThan(40)
    expect(communities.length).toBeGreaterThanOrEqual(23)
  })

  it('documents that aliases come from county plat / HOA, not radius', () => {
    const source = String((registry as { source?: string }).source ?? '')
    const note = String((registry as { alias_rule?: string }).alias_rule ?? '')
    expect(`${source}\n${note}`).toMatch(/county plat|HOA/i)
    expect(`${source}\n${note}`).not.toMatch(/Spark MLS API spatial discovery/)
  })

  it('gives every parent city, city_slug, nest, and a labeled kind', () => {
    for (const c of communities) {
      expect(c.city, c.slug).toMatch(/\S/)
      expect(c.city_slug, c.slug).toMatch(/\S/)
      expect(COMMUNITY_KINDS, c.slug).toContain(c.kind)
      expect(c.nest, c.slug).toBeTruthy()
      expect(NEST_KINDS, c.slug).toContain(c.nest?.kind)
      expect(c.subdivision_aliases?.length, c.slug).toBeGreaterThan(0)
    }
  })

  it('nests Bend in-city parents under an official district and skips empty levels', () => {
    expect(bySlug['northwest-crossing'].nest).toMatchObject({
      kind: 'bend_district',
      neighborhood: 'Summit West',
    })
    expect(bySlug['discovery-west'].nest).toMatchObject({
      kind: 'bend_district',
      neighborhood: 'Summit West',
    })
    expect(bySlug['awbrey-glen'].nest?.neighborhood).toBe('Awbrey Butte')
    expect(bySlug.tetherow.nest?.kind).toBe('census_cdp')
    expect(bySlug.tetherow.nest?.neighborhood).toBeUndefined()
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
    expect(bySlug.pronghorn.display_name).toMatch(/Juniper Preserve/)
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

  it('adds the missing major parents with live MLS or CDP aliases', () => {
    for (const slug of REQUIRED_MAJORS) {
      expect(bySlug[slug], slug).toBeTruthy()
    }
    expect(bySlug['discovery-west'].kind).toBe('planned_community')
    expect(bySlug['discovery-west'].subdivision_aliases).toEqual(expect.arrayContaining([
      'Discovery West Phase 1',
      'Discovery West Phase 2',
      'Discovery West Phase 5',
      'Discovery West Phase 8 & 9',
    ]))
    expect(bySlug['northwest-crossing'].subdivision_aliases?.some((a) => /discovery west/i.test(a))).toBe(false)
    expect(bySlug['tree-farm'].subdivision_aliases).toContain('Tree Farm')
    expect(bySlug.westgate.subdivision_aliases).toContain('Westgate')
    expect(bySlug.westgate.subdivision_aliases?.some((a) => /grants pass/i.test(a))).toBe(false)
    expect(bySlug['seventh-mountain'].kind).toBe('cdp')
    expect(bySlug['seventh-mountain'].nest?.kind).toBe('census_cdp')
  })

  it('nests Inn of the 7th and Widgi under Seventh Mountain CDP without a second Inn geography', () => {
    expect(bySlug['inn-of-the-7th-mountain'].nest?.parent_slug).toBe('seventh-mountain')
    expect(bySlug['inn-of-the-7th-mountain'].kind).toBe('resort_village')
    expect(bySlug['widgi-creek'].nest?.parent_slug).toBe('seventh-mountain')
    expect(bySlug['widgi-creek'].kind).toBe('public_golf')
    expect(bySlug['rivers-edge'].kind).toBe('public_golf')
    const seventhAliases = bySlug['seventh-mountain'].subdivision_aliases ?? []
    expect(seventhAliases).toContain('Seventh Mountain')
    expect(seventhAliases).not.toContain('Inn Of The 7th')
    expect(seventhAliases).not.toContain('Widgi Creek')
    expect(seventhAliases).not.toContain('PointsWest')
  })

  it('does not add public-only golf courses as community parents', () => {
    for (const slug of PUBLIC_COURSE_PARENTS) {
      expect(bySlug[slug], slug).toBeUndefined()
    }
    const rejectedNames = rejected.map((r) => r.name.toLowerCase())
    for (const name of ['Lost Tracks', 'Juniper Golf', 'Quail Run', 'Aspen Lakes', 'Bend Golf Club', 'Meadow Lakes']) {
      expect(rejectedNames.some((n) => n.includes(name.toLowerCase())), name).toBe(true)
    }
    expect(rejected.every((r) => r.reason.trim().length > 20)).toBe(true)
  })
})
