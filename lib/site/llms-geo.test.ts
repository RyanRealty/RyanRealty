import { describe, expect, it } from 'vitest'
import { CORE_CITY_SLUGS } from '@/app/housing-market/[...slug]/_v3/geo-constants'
import { CANONICAL_ZIPS, ZIP_AREA } from '@/app/zip/[zip]/_v3/zip-constants'
import { LLMS_ZIPS, marketCityLlmsLines, zipLlmsLines } from './llms-geo'

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
