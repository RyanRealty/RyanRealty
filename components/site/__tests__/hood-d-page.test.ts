import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { BEND_NEIGHBORHOOD_DISTRICTS } from '@/lib/data/geo/neighborhood-public-inventory'
import { hoodChildren, hoodPlaces, hoodSchools } from '@/app/cities/[slug]/[neighborhoodSlug]/_v3/hood-d-model'

const root = process.cwd()
const read = (rel: string) => readFileSync(join(root, rel), 'utf8')

const OFFICIAL = [
  'awbrey-butte',
  'boyd-acres',
  'century-west',
  'larkspur',
  'mountain-view',
  'old-bend',
  'old-farm-district',
  'orchard-district',
  'river-west',
  'southeast-bend',
  'southern-crossing',
  'southwest-bend',
  'summit-west',
]

describe('hood-d Bend district restyle', () => {
  it('keeps the live /cities/bend/{slug} route and official 13', () => {
    const page = read('app/cities/[slug]/[neighborhoodSlug]/page.tsx')
    expect(page).toMatch(/BEND_NEIGHBORHOOD_DISTRICTS/)
    expect(page).toMatch(/path: `\/cities\/\$\{citySlug\}\/\$\{neighborhoodSlug\}`/)
    expect(page).not.toMatch(/\/neighborhoods\/\$\{/)
    expect(BEND_NEIGHBORHOOD_DISTRICTS).toHaveLength(13)
    expect(BEND_NEIGHBORHOOD_DISTRICTS.map((d) => d.slug)).toEqual(OFFICIAL)
  })

  it('SEO H1 is {District} homes for sale', () => {
    const hero = read('components/site/hood-d/HoodDHero.tsx')
    expect(hero).toMatch(/\$\{name\} homes for sale/)
    expect(hero).not.toMatch(/Homes for Sale/)
  })

  it('keeps Spark inventory, place-graph children, and Chart Room', () => {
    const page = read('app/cities/[slug]/[neighborhoodSlug]/page.tsx')
    expect(page).toMatch(/getListingTiles/)
    expect(page).toMatch(/getNeighborhoodPublicInventory/)
    expect(page).toMatch(/getCommunitiesInNeighborhood/)
    expect(page).toMatch(/<NeighborhoodMarketCharts/)
    expect(read('components/site/hood-d/HoodDMarket.tsx')).toMatch(/Chart Room\. Time, Relate, and Rank/)
  })

  it('does not invent a River West dog park, streets list, or restaurant directory', () => {
    const page = read('app/cities/[slug]/[neighborhoodSlug]/page.tsx')
    const trails = read('components/site/hood-d/HoodDTrails.tsx')
    const model = read('app/cities/[slug]/[neighborhoodSlug]/_v3/hood-d-model.ts')
    expect(page).not.toMatch(/River West dog park/)
    expect(page).not.toMatch(/off-leash dog park inside River West/)
    expect(model).toMatch(/There is no official dog park inside River West/)
    expect(model).toMatch(/Drake Park is on-leash/)
    expect(page).not.toMatch(/streets list/i)
    expect(page).not.toMatch(/restaurant directory/i)
    expect(trails).not.toMatch(/dog park/)
  })

  it('has no mid-page Ask me, and Ask lives at the bottom', () => {
    const page = read('app/cities/[slug]/[neighborhoodSlug]/page.tsx')
    expect(page).not.toMatch(/<KbSell/)
    expect(page).toMatch(/<HoodDAsk/)
    const askIdx = page.indexOf('<HoodDAsk')
    const homesIdx = page.indexOf('<HoodDHomes')
    const mapIdx = page.indexOf('<HoodDMap')
    expect(askIdx).toBeGreaterThan(homesIdx)
    expect(askIdx).toBeGreaterThan(mapIdx)
  })

  it('never says plat, nest, parent, CDP, or Feeders in visitor copy', () => {
    const files = [
      'components/site/hood-d/HoodDHero.tsx',
      'components/site/hood-d/HoodDHomes.tsx',
      'components/site/hood-d/HoodDMap.client.tsx',
      'components/site/hood-d/HoodDTrails.tsx',
      'components/site/hood-d/HoodDWeek.tsx',
      'components/site/hood-d/HoodDJournal.tsx',
      'components/site/hood-d/HoodDNarrative.tsx',
      'components/site/hood-d/HoodDCompare.tsx',
      'components/site/hood-d/HoodDMarket.tsx',
      'components/site/hood-d/HoodDPeers.tsx',
      'components/site/hood-d/HoodDSchools.tsx',
      'components/site/hood-d/HoodDAsk.tsx',
      'components/site/hood-d/HoodDAlerts.client.tsx',
    ]
    for (const file of files) {
      const src = read(file)
      expect(src).not.toMatch(/\bplat\b/i)
      expect(src).not.toMatch(/\bnest\b/i)
      expect(src).not.toMatch(/\bparent\b/i)
      expect(src).not.toMatch(/\bCDP\b/)
      expect(src).not.toMatch(/\bFeeders\b/)
    }
  })

  it('hides official children when the place graph is empty', () => {
    expect(hoodChildren([])).toEqual([])
    expect(hoodChildren([{ subdivision: 'Kenwood', slug: 'kenwood' }])).toEqual([
      { name: 'Kenwood', href: '/subdivisions/kenwood' },
    ])
  })

  it('does not list Drake Park twice when the amenity and registry names differ', () => {
    const { list } = hoodPlaces(44.05846, -121.31955, {
      amenities: [
        {
          category: 'Parks',
          name: 'Drake Park and Mirror Pond',
          description: 'A 13-acre park on Mirror Pond.',
          access: 'Open daily 5 AM to 10 PM',
        },
      ],
    } as never, 'river-west')
    const drakes = list.filter((p) => /drake park/i.test(p.name))
    expect(drakes).toHaveLength(1)
  })

  it('schools come from curated amenities, not invented rows', () => {
    expect(hoodSchools(null)).toEqual([])
    expect(
      hoodSchools({
        amenities: [
          {
            category: 'Schools',
            name: 'Highland School at Kenwood Elementary',
            description: 'A K-5 campus, feeding to Cascade Middle and Summit High.',
            access: 'Walkable from most River West addresses',
          },
        ],
      } as never),
    ).toEqual([
      {
        name: 'Highland School at Kenwood Elementary',
        detail: 'Walkable from most River West addresses',
      },
      { name: 'Cascade Middle', detail: null },
      { name: 'Summit High', detail: null },
    ])
  })
})
