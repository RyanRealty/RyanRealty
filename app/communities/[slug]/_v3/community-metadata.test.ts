import { describe, expect, it } from 'vitest'
import { shareDescription } from '@/lib/share-metadata'
import resortRegistry from '@/data/resort-communities.json'
import { publicCommunitySlug } from '@/lib/communities/community-public-pair'
import {
  buildCommunitySchemas,
  communityMetadataInput,
  communitySerpDescription,
  communitySerpTitle,
} from './community-metadata'

const SFR_FILL_IN =
  'Active single-family homes in Brasada Ranch, Powell Butte, Oregon. Live inventory and market data from the regional MLS.'


const home = {
  href: '/homes-for-sale/bend/tetherow/1-tetherow-rd-2201',
  addressLine: '1 Tetherow Rd',
  price: 750000,
  propertyType: 'Residential',
  photoUrl: 'https://example.com/a.jpg',
}

function itemListSchemas(homes = [home]) {
  return buildCommunitySchemas({
    slug: 'tetherow',
    name: 'Tetherow',
    cityName: 'Bend',
    citySlug: 'bend',
    hasMap: true,
    datasetVariables: [],
    asOfIso: null,
    asOfLabel: null,
    faqs: [],
    homes,
  })
}

describe('buildCommunitySchemas live-home ItemList (SITE-176)', () => {
  it('emits ItemList of photographed homes', () => {
    const list = itemListSchemas().find((schema) => schema.type === 'itemList')
    expect(list).toMatchObject({
      type: 'itemList',
      name: 'Homes for sale in Tetherow',
      items: [
        {
          name: '$750,000 · 1 Tetherow Rd',
          url: '/homes-for-sale/bend/tetherow/1-tetherow-rd-2201',
        },
      ],
    })
  })

  it('withholds the list when inventory is empty', () => {
    expect(itemListSchemas([]).some((schema) => schema.type === 'itemList')).toBe(false)
  })

  it('withholds unphotographed homes', () => {
    expect(itemListSchemas([{ ...home, photoUrl: '' }]).some((schema) => schema.type === 'itemList')).toBe(false)
  })
})

describe('SITE-177 community SERP copy', () => {
  it('Brasada description is not the SFR fill-in and names lots only when listed', () => {
    const withLots = communitySerpDescription({
      slug: 'brasada-ranch',
      name: 'Brasada Ranch',
      city: 'Powell Butte',
      types: ['homes', 'lots'],
    })
    expect(withLots).not.toBe(SFR_FILL_IN)
    expect(withLots).toMatch(/lots/i)
    expect(withLots).not.toMatch(/cabin/i)
    expect(withLots.length).toBeLessThanOrEqual(155)
    expect(shareDescription(withLots)).toBe(withLots)

    const homesOnly = communitySerpDescription({
      slug: 'brasada-ranch',
      name: 'Brasada Ranch',
      city: 'Powell Butte',
      types: ['homes'],
    })
    expect(homesOnly).not.toMatch(/\blots\b/i)
    expect(homesOnly).not.toMatch(/cabin/i)

    const withCabins = communitySerpDescription({
      slug: 'brasada-ranch',
      name: 'Brasada Ranch',
      city: 'Powell Butte',
      types: ['homes', 'cabins', 'lots'],
    })
    expect(withCabins).toMatch(/cabin/i)
    expect(withCabins).toMatch(/lots/i)
  })

  it('Tetherow, Broken Top, and Black Butte Ranch are not byte-identical except the place name', () => {
    const tetherow = communitySerpDescription({
      slug: 'tetherow',
      name: 'Tetherow',
      city: 'Bend',
      types: ['homes', 'attached', 'lots'],
    })
    const broken = communitySerpDescription({
      slug: 'broken-top',
      name: 'Broken Top',
      city: 'Bend',
      types: ['homes', 'attached', 'lots'],
    })
    const bbr = communitySerpDescription({
      slug: 'black-butte-ranch',
      name: 'Black Butte Ranch',
      city: 'Sisters',
      types: ['homes', 'attached', 'lots'],
    })
    const strip = (text: string, name: string) => text.replaceAll(name, 'PLACE')
    expect(strip(tetherow, 'Tetherow')).not.toBe(strip(broken, 'Broken Top'))
    expect(strip(tetherow, 'Tetherow')).not.toBe(strip(bbr, 'Black Butte Ranch'))
    expect(strip(broken, 'Broken Top')).not.toBe(strip(bbr, 'Black Butte Ranch'))
    expect(tetherow).not.toMatch(/Active single-family homes/)
    expect(broken).not.toMatch(/Active single-family homes/)
    expect(bbr).not.toMatch(/Active single-family homes/)
    expect(shareDescription(tetherow)).toBe(tetherow)
    expect(shareDescription(broken)).toBe(broken)
    expect(shareDescription(bbr)).toBe(bbr)
  })

  it('Mountain High title includes the on-page count or omits a count', () => {
    expect(
      communitySerpTitle({
        slug: 'mountain-high',
        name: 'Mountain High',
        city: 'Bend',
        listedCount: 8,
      }),
    ).toBe('Mountain High real estate | 8 Homes for Sale | Bend, OR')
    expect(
      communitySerpTitle({
        slug: 'mountain-high',
        name: 'Mountain High',
        city: 'Bend',
        listedCount: null,
      }),
    ).toBe('Mountain High real estate | Homes for Sale | Bend, OR')
    // One listing reads as one home, in the title and the description.
    expect(
      communitySerpTitle({ slug: 'mountain-high', name: 'Mountain High', city: 'Bend', listedCount: 1 }),
    ).toBe('Mountain High real estate | 1 Home for Sale | Bend, OR')
    expect(
      communitySerpDescription({
        slug: 'mountain-high',
        name: 'Mountain High',
        city: 'Bend',
        listedCount: 1,
        types: ['homes'],
      }),
    ).toMatch(/^1 home for sale in Mountain High, Bend\./)
    expect(
      communitySerpDescription({
        slug: 'mountain-high',
        name: 'Mountain High',
        city: 'Bend',
        listedCount: 8,
        types: ['homes'],
      }),
    ).toMatch(/^8 homes for sale in Mountain High, Bend\./)
    expect(
      communitySerpDescription({
        slug: 'mountain-high',
        name: 'Mountain High',
        city: 'Bend',
        listedCount: 8,
        types: ['homes'],
      }),
    ).not.toMatch(/1,?0\d{2}/)
  })

  it('SITE-187: a self-city community opens on its inventory query, not "Sunriver in Sunriver"', () => {
    const input = communityMetadataInput({
      slug: 'sunriver',
      name: 'Sunriver',
      city: 'Sunriver',
      stock: { listedCount: 47, types: ['homes', 'attached', 'lots'] },
    })
    expect(input.title).toBe('Sunriver Homes for Sale | Sunriver, OR')
    expect(input.description).toMatch(/^Sunriver, Oregon homes for sale\./)
    expect(input.description).not.toMatch(/Sunriver in Sunriver/)
    expect(input.path).toBe('/communities/sunriver')
  })

  it('SITE-184: Black Butte Ranch opens on its inventory query, though its registry city is Sisters', () => {
    const input = communityMetadataInput({
      slug: 'black-butte-ranch',
      name: 'Black Butte Ranch',
      city: 'Sisters',
      stock: { listedCount: 31, types: ['homes', 'attached', 'lots'] },
    })
    expect(input.title).toBe('Black Butte Ranch Homes for Sale | Sisters, OR')
    expect(input.description).toMatch(/^Black Butte Ranch, Oregon homes for sale\./)
    expect(input.description).not.toMatch(/Black Butte Ranch in Sisters/)
    expect(input.description).toMatch(/Golf resort with two courses under the Cascades\./)
    // Whole description, no truncation: the opener grew by four characters
    // and the setting clause gave them back (shareDescription caps at 155).
    expect(input.description).toMatch(/Live MLS inventory\.$/)
    expect(input.path).toBe('/communities/black-butte-ranch')
    // A sibling under the same city still reads "{name} in {city}".
    expect(
      communitySerpDescription({ slug: 'caldera-springs', name: 'Caldera Springs', city: 'Sunriver' }),
    ).toMatch(/^Caldera Springs in Sunriver, Oregon\./)
  })

  it('Tetherow title and description say Tetherow real estate', () => {
    const input = communityMetadataInput({
      slug: 'tetherow',
      name: 'Tetherow',
      city: 'Bend',
      stock: { listedCount: 24, types: ['homes', 'attached', 'lots'] },
    })
    expect(input.title).toBe('Tetherow real estate | Homes for Sale | Bend, OR')
    expect(input.description).toMatch(/^Tetherow real estate in Bend, Oregon\./)
    expect(input.description).not.toMatch(/Active single-family homes/)
    expect(input.description).toMatch(/lots/i)
    expect(input.description.length).toBeLessThanOrEqual(155)
    expect(shareDescription(input.description)).toBe(input.description)
  })

  it('every other registered community leads with "real estate" (Matt 2026-09-24)', () => {
    const input = communityMetadataInput({
      slug: 'broken-top',
      name: 'Broken Top',
      city: 'Bend',
      stock: { listedCount: 12, types: ['homes'] },
    })
    expect(input.title).toBe('Broken Top real estate | Homes for Sale | Bend, OR')
    // Sweep the registry: "real estate" everywhere but the two self-city
    // communities, whose /cities/<slug> pages already carry that title.
    const registry = (resortRegistry as { communities: Array<{ slug: string; label: string; city: string }> })
      .communities
    expect(registry.length).toBeGreaterThan(10)
    // The route's slug is the public one (pronghorn is served as juniper-preserve).
    const plain = registry
      .map((e) => ({ ...e, slug: publicCommunitySlug(e) }))
      .filter((e) => !/ real estate \| /.test(communitySerpTitle({ slug: e.slug, name: e.label, city: e.city })))
      .map((e) => e.slug)
      .sort()
    expect(plain).toEqual(['black-butte-ranch', 'sunriver'])
  })

  it('a compound slug keeps the Homes for Sale title (noindex, not a registered community)', () => {
    expect(
      communitySerpTitle({ slug: 'bend-parks-at-broken-top', name: 'Parks at Broken Top', city: 'Bend' }),
    ).toBe('Parks at Broken Top Homes for Sale | Bend, OR')
  })
})
