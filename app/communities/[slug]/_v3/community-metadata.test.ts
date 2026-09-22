import { describe, expect, it } from 'vitest'
import { shareDescription } from '@/lib/share-metadata'
import {
  communityMetadataInput,
  communitySerpDescription,
  communitySerpTitle,
} from './community-metadata'

const SFR_FILL_IN =
  'Active single-family homes in Brasada Ranch, Powell Butte, Oregon. Live inventory and market data from the regional MLS.'

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
    ).toBe('Mountain High: 8 homes for sale | Bend, OR')
    expect(
      communitySerpTitle({
        slug: 'mountain-high',
        name: 'Mountain High',
        city: 'Bend',
        listedCount: null,
      }),
    ).toBe('Mountain High Homes for Sale | Bend, OR')
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

  it('other communities keep the Homes for Sale title and never the SFR fill-in', () => {
    const input = communityMetadataInput({
      slug: 'tetherow',
      name: 'Tetherow',
      city: 'Bend',
      stock: { listedCount: 24, types: ['homes', 'attached', 'lots'] },
    })
    expect(input.title).toBe('Tetherow Homes for Sale | Bend, OR')
    expect(input.description).not.toMatch(/Active single-family homes/)
    expect(input.description).toMatch(/lots/i)
  })
})
