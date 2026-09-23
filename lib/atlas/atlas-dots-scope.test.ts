import { describe, expect, it } from 'vitest'
import {
  ATLAS_DOTS_ROUTE,
  atlasDotsHref,
  parseAtlasBoundaryRef,
  parseAtlasDotsScope,
  type AtlasDotsScope,
} from './atlas-dots-scope'

function roundTrip(scope: AtlasDotsScope, opts?: Parameters<typeof atlasDotsHref>[1]) {
  const href = atlasDotsHref(scope, opts)
  expect(href).not.toBeNull()
  expect(href!.startsWith(ATLAS_DOTS_ROUTE)).toBe(true)
  return parseAtlasDotsScope(new URL(href!, 'https://ryan-realty.com').searchParams)
}

describe('atlasDotsHref / parseAtlasDotsScope (UXLIVE-3)', () => {
  it('round-trips every scope a place page reads', () => {
    expect(roundTrip({ cities: [], boundary: null })).toEqual({ cities: [], boundary: null })
    expect(
      roundTrip(
        { cities: ['Bend'], boundary: { kind: 'geo', geoType: 'city', geoSlug: 'bend' } },
        { boundaryHash: '12345:abc', day: '2026-09-23' },
      ),
    ).toEqual({ cities: ['Bend'], boundary: { kind: 'geo', geoType: 'city', geoSlug: 'bend' } })
    expect(
      roundTrip({
        cities: ['Bend'],
        boundary: { kind: 'geo', geoType: 'neighborhood', geoSlug: 'bend-awbrey-butte' },
      }),
    ).toEqual({ cities: ['Bend'], boundary: { kind: 'geo', geoType: 'neighborhood', geoSlug: 'bend-awbrey-butte' } })
    expect(roundTrip({ cities: ['Sisters', 'Bend', 'Bend'], boundary: { kind: 'resort', slug: 'black-butte-ranch' } })).toEqual({
      cities: ['Bend', 'Sisters'],
      boundary: { kind: 'resort', slug: 'black-butte-ranch' },
    })
    expect(roundTrip({ cities: ['La Pine'], boundary: { kind: 'city-row', cityName: 'La Pine' } })).toEqual({
      cities: ['La Pine'],
      boundary: { kind: 'city-row', cityName: 'La Pine' },
    })
  })

  it('names two pages reading one population with one URL', () => {
    const a = atlasDotsHref({ cities: ['Sunriver', 'Bend'], boundary: { kind: 'resort', slug: 'sunriver' } })
    const b = atlasDotsHref({ cities: ['Bend', 'Sunriver'], boundary: { kind: 'resort', slug: 'sunriver' } })
    expect(a).toBe(b)
  })

  it('refuses to address a scope it cannot rebuild exactly', () => {
    // A city narrowed without a boundary is not a population any page defers.
    expect(atlasDotsHref({ cities: ['Bend'], boundary: null })).toBeNull()
    // A city name outside the accepted form.
    expect(atlasDotsHref({ cities: ['Bend<script>'], boundary: { kind: 'resort', slug: 'x' } })).toBeNull()
    // A malformed slug.
    expect(atlasDotsHref({ cities: ['Bend'], boundary: { kind: 'geo', geoType: 'city', geoSlug: 'Bend City' } })).toBeNull()
  })

  it('rejects malformed requests instead of reading something else', () => {
    const parse = (qs: string) => parseAtlasDotsScope(new URLSearchParams(qs))
    expect(parse('c=Bend')).toBeNull()
    expect(parse('b=geo:zip:97702&c=Bend')).toBeNull()
    expect(parse('b=geo:city:../../etc&c=Bend')).toBeNull()
    expect(parse('b=nope:bend&c=Bend')).toBeNull()
    expect(parse('b=geo:city:bend&c=%3Cscript%3E')).toBeNull()
    expect(parse('b=geo:city:bend&c=Bend&d=yesterday')).toBeNull()
    expect(parse(`b=geo:city:bend&${Array.from({ length: 9 }, (_, i) => `c=City${String.fromCharCode(65 + i)}`).join('&')}`)).toBeNull()
    expect(parse('')).toEqual({ cities: [], boundary: null })
  })

  it('parses each boundary reference form', () => {
    expect(parseAtlasBoundaryRef('geo:city:redmond')).toEqual({ kind: 'geo', geoType: 'city', geoSlug: 'redmond' })
    expect(parseAtlasBoundaryRef('resort:tetherow')).toEqual({ kind: 'resort', slug: 'tetherow' })
    expect(parseAtlasBoundaryRef("city-row:Crooked River Ranch")).toEqual({ kind: 'city-row', cityName: 'Crooked River Ranch' })
    expect(parseAtlasBoundaryRef('geo:city')).toBeNull()
    expect(parseAtlasBoundaryRef(null)).toBeNull()
  })
})
