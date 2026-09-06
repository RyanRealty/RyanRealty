import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const CITY = readFileSync(resolve('app/cities/[slug]/types/[type]/page.tsx'), 'utf8')
const COMM = readFileSync(resolve('app/communities/[slug]/types/[type]/page.tsx'), 'utf8')

describe('place-type pages', () => {
  it('404s unknown types and unknown places', () => {
    expect(CITY).toMatch(/resolvePlaceTypePage\(type\)/)
    expect(CITY).toMatch(/if \(!spec\) notFound\(\)/)
    expect(CITY).toMatch(/getGeoSnapshot\(\{ geoType: 'city', geoKey: slug \}\)/)
    expect(COMM).toMatch(/if \(!spec\) notFound\(\)/)
    expect(COMM).toMatch(/getCommunityBySlug\(slug\)/)
  })

  it('uses generateMetadata with a unique canonical path', () => {
    expect(CITY).toMatch(/export async function generateMetadata/)
    expect(CITY).toMatch(/path: `\/cities\/\$\{slug\}\/types\/\$\{spec\.slug\}`/)
    expect(COMM).toMatch(/path: `\/communities\/\$\{slug\}\/types\/\$\{spec\.slug\}`/)
  })

  it('opens on Type in Place, leftover face, atlas, photographed rows', () => {
    for (const src of [CITY, COMM]) {
      expect(src).toMatch(/placeTypeHeadline/)
      expect(src).not.toMatch(/<PlaceFaceStrip/)
      expect(src).toMatch(/<V3Atlas/)
      expect(src).toMatch(/id="homes"/)
      expect(src).toMatch(/<V3ListingRow/)
      expect(src).toMatch(/<V3Breadcrumb trail=\{\[\{ label: cityName/)
      expect(src).not.toMatch(/label: 'Home'/)
    }
  })

  it('does not treat photographed list length as leftover', () => {
    expect(CITY).toMatch(/listOk \? placeTypeListingRows/)
    expect(CITY).not.toMatch(/count = rows\.length/)
    expect(COMM).not.toMatch(/count = rows\.length/)
  })
})
