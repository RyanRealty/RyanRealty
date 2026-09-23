import { describe, expect, it } from 'vitest'
import { CORE_CITY_SLUGS } from '@/app/housing-market/[...slug]/_v3/geo-constants'
import { CANONICAL_ZIPS, ZIP_AREA } from '@/app/zip/[zip]/_v3/zip-constants'
import { PRIMARY_CITIES } from '@/lib/cities'
import { PLACE_TYPE_PAGE_SLUGS } from '@/lib/place/publish-place-type-cards'
import {
  cityTypeLlmsLines,
  dedupeLlmsLines,
  llmsLineUrl,
  LLMS_SUBDIVISIONS_PATH,
  LLMS_ZIPS,
  marketCityLlmsLines,
  zipLlmsLines,
} from './llms-geo'

describe('LLMS_ZIPS', () => {
  it('matches the ten canonical ZIP pages the route prerenders', () => {
    expect(new Set(LLMS_ZIPS.map((z) => z.zip))).toEqual(CANONICAL_ZIPS)
    for (const row of LLMS_ZIPS) {
      expect(row.area).toBe(ZIP_AREA[row.zip])
    }
  })

  it('emits /zip/{code} lines for every canonical ZIP', () => {
    const lines = zipLlmsLines('https://ryan-realty.com')
    expect(lines).toHaveLength(10)
    expect(lines.find((l) => l.includes('/zip/97703'))).toBe(
      '- 97703 (Bend West): https://ryan-realty.com/zip/97703',
    )
    for (const zip of CANONICAL_ZIPS) {
      expect(lines.some((l) => l.endsWith(`/zip/${zip}`))).toBe(true)
    }
  })
})

describe('marketCityLlmsLines', () => {
  it('covers every CORE_CITY_SLUGS housing-market page', () => {
    const label = (slug: string) =>
      slug.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
    const lines = marketCityLlmsLines('https://ryan-realty.com', CORE_CITY_SLUGS, label)
    expect(lines).toHaveLength(CORE_CITY_SLUGS.length)
    expect(lines[0]).toBe('- Bend housing market: https://ryan-realty.com/housing-market/bend')
    for (const slug of CORE_CITY_SLUGS) {
      expect(lines.some((l) => l.endsWith(`/housing-market/${slug}`))).toBe(true)
    }
  })
})

describe('cityTypeLlmsLines (AEO-4)', () => {
  it('lists every prerendered city type page once, each with a one-line description', () => {
    const lines = cityTypeLlmsLines('https://ryan-realty.com', PRIMARY_CITIES)
    expect(lines).toHaveLength(PRIMARY_CITIES.length * PLACE_TYPE_PAGE_SLUGS.length)
    expect(lines).toContain(
      '- [Single-family homes in Bend](https://ryan-realty.com/cities/bend/types/single-family): Single-family homes for sale in Bend, Oregon, from the regional MLS, with list prices, photos, and a map.',
    )
    expect(lines.some((l) => l.includes('/cities/la-pine/types/condos'))).toBe(true)
    expect(new Set(lines.map(llmsLineUrl)).size).toBe(lines.length)
    for (const line of lines) expect(line).not.toMatch(/\d+ (homes|condos|lots) for sale/)
  })
})

describe('dedupeLlmsLines (AEO-4)', () => {
  it('keeps the first line for a URL across sections and drops the repeats', () => {
    const seen = new Set<string>()
    const guides = dedupeLlmsLines(
      ['- All guides: https://ryan-realty.com/blog', '- Closing Costs: https://ryan-realty.com/blog/closing-costs-buyers-bend-oregon'],
      seen,
    )
    const blog = dedupeLlmsLines(
      [
        '- All posts: https://ryan-realty.com/blog',
        '- [Closing Costs](https://ryan-realty.com/blog/closing-costs-buyers-bend-oregon): sourced',
        '- A new post: https://ryan-realty.com/blog/new-post',
        'plain text line',
      ],
      seen,
    )
    expect(guides).toHaveLength(2)
    expect(blog).toEqual(['- A new post: https://ryan-realty.com/blog/new-post', 'plain text line'])
  })

  it('reads the URL out of a markdown link', () => {
    expect(llmsLineUrl('- [About](https://ryan-realty.com/about): who we are')).toBe('https://ryan-realty.com/about')
    expect(LLMS_SUBDIVISIONS_PATH).toBe('/llms-subdivisions.txt')
  })
})
