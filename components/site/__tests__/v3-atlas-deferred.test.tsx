/**
 * UXLIVE-3 (visibility audit 2026-09-22): an Atlas whose dots load after
 * paint must print, in its SERVER HTML, the same counts, chips, claim, frame
 * and source line as the same Atlas handed the dots inline. The server
 * summary (summarizeAtlasDots) and the component run the same functions; this
 * renders both and compares what a reader and a crawler see.
 */
import { describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {} }) }))

import { V3Atlas, type AtlasDot, type AtlasRegion, type V3AtlasProps } from '@/components/site/v3/V3Atlas.client'
import { v3Text } from '@/components/site/v3/atoms'
import { summarizeAtlasDots } from '@/lib/atlas/atlas-derive'

function square(minLon: number, minLat: number, maxLon: number, maxLat: number): GeoJSON.Polygon {
  return {
    type: 'Polygon',
    coordinates: [
      [
        [minLon, minLat],
        [maxLon, minLat],
        [maxLon, maxLat],
        [minLon, maxLat],
        [minLon, minLat],
      ],
    ],
  }
}

const TOWN: AtlasRegion = {
  id: 'town:testville',
  kind: 'town',
  kindLabel: 'City',
  name: 'Testville',
  href: '/cities/testville',
  geometry: square(-121.4, 44.0, -121.2, 44.1),
}
const WEST: AtlasRegion = {
  id: 'neighborhood:west-side',
  kind: 'neighborhood',
  name: 'West Side',
  href: '/cities/testville/west-side',
  geometry: square(-121.4, 44.0, -121.3, 44.1),
}
const EAST: AtlasRegion = {
  id: 'neighborhood:east-side',
  kind: 'neighborhood',
  name: 'East Side',
  href: '/cities/testville/east-side',
  geometry: square(-121.3, 44.0, -121.2, 44.1),
}

function dot(k: string, lng: number, lat: number, extra: Partial<AtlasDot>): AtlasDot {
  return { k, lat, lng, p: 500_000, t: 'house', s: 'active', age: 30, href: `/homes-for-sale/testville/${k}`, ...extra }
}

const DOTS: AtlasDot[] = [
  dot('a1', -121.38, 44.02, { p: 450_000 }),
  dot('a2', -121.37, 44.03, { p: 690_000 }),
  dot('a3', -121.36, 44.05, { p: 725_000 }),
  dot('a4', -121.28, 44.04, { p: 1_250_000 }),
  dot('a5', -121.25, 44.06, { p: 810_000 }),
  dot('a6', -121.22, 44.08, { p: 999_000, age: 3 }),
  dot('l1', -121.33, 44.07, { p: 50_000, t: 'land' }),
  dot('l2', -121.24, 44.02, { p: 120_000, t: 'land' }),
  dot('p1', -121.35, 44.04, { p: 610_000, s: 'pending', age: 9 }),
  dot('p2', -121.26, 44.05, { p: 880_000, s: 'pending', age: 40 }),
  dot('s1', -121.34, 44.03, { p: 700_000, s: 'sold', soldAgo: 5, age: null }),
  dot('s2', -121.27, 44.07, { p: 900_000, s: 'sold', soldAgo: 20, age: null }),
  dot('s3', -121.31, 44.06, { p: 650_000, s: 'sold', soldAgo: 60, age: null }),
]
const TYPES = [
  { key: 'house', label: 'House' },
  { key: 'land', label: 'Land' },
]

const BASE: Omit<V3AtlasProps, 'dots'> = {
  id: 'atlas',
  headline: v3Text('Testville'),
  headingLevel: 2,
  claimTone: 'inventory',
  sourceName: 'Oregon Data Share',
  regions: [TOWN],
  childRegions: [WEST, EAST],
  types: TYPES,
  fit: 'dots',
  source: 'Every active and pending listing inside the recorded boundary of Testville.',
  stamp: 'Sep 23, 2026, 9:00 AM',
}

function render(props: V3AtlasProps): string {
  return renderToStaticMarkup(createElement(V3Atlas, props))
}

function pick(html: string, re: RegExp): string[] {
  return [...html.matchAll(re)].map((m) => m[1]!.replace(/<[^>]+>/g, '').trim())
}

const inline = render({ ...BASE, dots: DOTS })
const deferred = render({
  ...BASE,
  dots: [],
  dotsSrc: '/api/atlas/dots?c=Testville&b=geo:city:testville',
  dotsSummary: summarizeAtlasDots({
    dots: DOTS,
    regions: BASE.regions,
    childRegions: BASE.childRegions,
    types: TYPES,
    fit: 'dots',
  }),
})

describe('UXLIVE-3: a deferred Atlas prints the inline Atlas’s numbers in its server HTML', () => {
  it('the same frame (viewBox) — a fit-to-dots map is framed by the server from the full population', () => {
    const box = /class="v3-atlas__svg" viewBox="([^"]+)"/
    expect(deferred.match(box)?.[1]).toBe(inline.match(box)?.[1])
  })

  it('the same key: for sale and pending', () => {
    const key = /<li class="v3-atlas__key-item">([\s\S]*?)<\/li>/g
    expect(pick(deferred, key)).toEqual(pick(inline, key))
    expect(pick(inline, key)).toEqual(['8 for sale', '2 pending'])
  })

  it('the same claim sentence', () => {
    const claim = /<p class="v3-atlas__claim"[^>]*>([\s\S]*?)<\/p>/g
    expect(pick(deferred, claim)).toEqual(pick(inline, claim))
    expect(pick(inline, claim)[0]).toContain('8 listings for sale on this map right now')
  })

  it('the same place chips and counts', () => {
    const chips = /<button[^>]*class="v3-atlas__chip[^"]*"[^>]*>([\s\S]*?)<\/button>/g
    expect(pick(deferred, chips)).toEqual(pick(inline, chips))
    expect(pick(inline, chips).join(' | ')).toMatch(/West Side\s*5/)
    expect(pick(inline, chips).join(' | ')).toMatch(/East Side\s*5/)
  })

  it('the same source line, stamp and outline count', () => {
    const src = /<p class="v3-atlas__source-body">([\s\S]*?)<\/p>/
    expect(deferred.match(src)?.[1]).toBe(inline.match(src)?.[1])
    const sum = /<summary class="v3-atlas__source-summary">([\s\S]*?)<\/summary>/
    expect(deferred.match(sum)?.[1]).toBe(inline.match(sum)?.[1])
  })

  it('the same outlines: every place path is in the server HTML', () => {
    const outlines = (html: string) =>
      (html.match(/<path\b[^>]*>/g) ?? [])
        .filter((tag) => /class="v3-atlas__(?:town|place)\b/.test(tag))
        .map((tag) => tag.match(/\bd="([^"]+)"/)?.[1])
    const a = outlines(inline)
    const b = outlines(deferred)
    expect(b.length).toBe(3)
    expect(b).toEqual(a)
  })

  it('the heavy layers are what moved: no dots, no heat cells, no dot records in the deferred render', () => {
    expect(inline).toMatch(/v3-atlas__sales-cell/)
    expect(deferred).not.toMatch(/v3-atlas__sales-cell/)
    expect(deferred).not.toMatch(/class="v3-atlas__dot /)
    expect(deferred).toMatch(/data-atlas-dots="loading"/)
    expect(inline).not.toMatch(/data-atlas-dots=/)
  })

  it('the type toggles hold until the dots land (a filtered count needs them)', () => {
    const toggles = /<button[^>]*class="v3-atlas__type"[^>]*>/g
    const deferredToggles = deferred.match(toggles) ?? []
    expect(deferredToggles.length).toBe(TYPES.length)
    for (const t of deferredToggles) expect(t).toMatch(/disabled=""/)
    for (const t of inline.match(toggles) ?? []) expect(t).not.toMatch(/disabled/)
  })
})

describe('UXLIVE-3: a deferred Atlas with no summary prints no count at all', () => {
  it('says the counts are unavailable instead of printing zeros', () => {
    const html = render({ ...BASE, dots: [], dotsSrc: '/api/atlas/dots?b=geo:city:testville&c=Testville' })
    expect(html).toMatch(/Live counts are unavailable right now/)
    expect(html).not.toMatch(/0 listings for sale/)
  })
})
