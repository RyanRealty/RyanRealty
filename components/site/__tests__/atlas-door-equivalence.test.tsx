/**
 * @vitest-environment jsdom
 *
 * Every Atlas polygon that is a control has a full-size partner on the page
 * with the same name, reachable at rest or behind one closed disclosure whose
 * trigger is on the page (WCAG 2.5.8 Equivalent). This is ci:tap-targets'
 * pairing rule (scripts/check-tap-targets.mjs, `equivalentPartner` and
 * `disclosedBox`), read off the server HTML of the real components, so it
 * holds whatever size the polygons draw at.
 *
 * CI 2026-10-07: a short listing read on /cities/bend left the Atlas with no
 * dots, the frame fell back to the whole region, every district drew under
 * 44px, and the three rail rows past the fold (Southern Crossing, Southwest
 * Bend, Summit West) each carried their own `hidden`, which the gate could not
 * open, so their polygons failed. The first case below is that render.
 */
import { describe, expect, it, vi } from 'vitest'
import React, { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {} }) }))
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) =>
    React.createElement('a', { href, ...props }, children),
}))

import bendNeighborhoodPolygons from '@/data/bend/bend-neighborhood-polygons.json'
import { V3Atlas, type AtlasRegion, type V3AtlasProps } from '@/components/site/v3/V3Atlas.client'
import {
  PlaceSubdivisionAtlas,
  PlaceSubdivisionMap,
  PlaceSubdivisionRail,
} from '@/components/site/v3/PlaceSubdivisionMap.client'
import { v3Text } from '@/components/site/v3/atoms'
import { subdivisionRailEntries } from '@/lib/place/place-child-stock'
import { RAIL_FOLD_AT } from '@/lib/place/rail-fold'
import { publishPlatDisplayName } from '@/lib/market/publish-plat-display-name'

/** ci:tap-targets' own name key. */
const gateKey = (s: string | null | undefined) =>
  String(s ?? '')
    .toLowerCase()
    .replace(/[\d]+/g, ' ')
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

/** The accessible name, the gate's way: aria-label, else text. */
const accName = (el: Element) => (el.getAttribute('aria-label')?.trim() || el.textContent?.trim() || '')

/** Elements a stylesheet hides until a disclosure opens them. */
const HIDDEN = '[hidden], .is-folded'

/**
 * Reachable the gate's way: nothing on the path up is hidden, or every hidden
 * element on it is the target of a closed disclosure trigger ("Show all",
 * "+ N more") that is itself presented.
 */
function reachable(el: Element, doc: Document): boolean {
  const owners = new Set<Element>()
  for (const trigger of doc.querySelectorAll('[aria-expanded="false"][aria-controls]')) {
    if (trigger.closest(HIDDEN)) continue
    for (const id of (trigger.getAttribute('aria-controls') ?? '').split(/\s+/)) {
      const owner = id ? doc.getElementById(id) : null
      if (owner) owners.add(owner)
    }
  }
  for (let node: Element | null = el; node; node = node.parentElement) {
    if (node.matches(HIDDEN) && !owners.has(node)) return false
  }
  return true
}

/** Every polygon that is a control, with its full-size partner or null. */
function pairs(html: string) {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const polygons = [...doc.querySelectorAll('path.v3-atlas__place')].filter(
    (p) => p.getAttribute('role') === 'button' || p.hasAttribute('tabindex'),
  )
  const fullSize = [...doc.querySelectorAll('button.place-subdiv-rail__button, button.v3-atlas__chip')]
  return {
    doc,
    drawn: doc.querySelectorAll('path.v3-atlas__place').length,
    polygons: polygons.map((polygon) => {
      const name = polygon.getAttribute('aria-label') ?? ''
      const partner =
        fullSize.find((b) => gateKey(name).length >= 3 && gateKey(accName(b)) === gateKey(name) && reachable(b, doc)) ??
        null
      return { name, partner }
    }),
  }
}

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

type BendPolygon = { slug: string; name?: string; geometry: GeoJSON.Geometry }
const BEND_DISTRICTS: AtlasRegion[] = (bendNeighborhoodPolygons.communities as BendPolygon[])
  .filter((c) => c.slug.startsWith('bend-'))
  .map((c) => {
    const slug = c.slug.replace(/^bend-/, '')
    return { id: `neighborhood:${slug}`, kind: 'neighborhood', name: c.name ?? slug, href: `/cities/bend/${slug}`, geometry: c.geometry }
  })
/** A stand-in city outline around the districts (the test needs a town, not Bend's recorded line). */
const BEND_TOWN: AtlasRegion = {
  id: 'city:bend',
  kind: 'town',
  kindLabel: 'City',
  name: 'Bend',
  href: '/cities/bend',
  geometry: square(-121.40, 43.98, -121.22, 44.14),
}

const ATLAS_BASE: Omit<V3AtlasProps, 'regions' | 'childRegions' | 'dots'> = {
  id: 'atlas',
  headingLevel: 2,
  headline: v3Text('Bend'),
  headlineTone: 'eyebrow',
  sourceName: 'Oregon Data Share',
  types: [{ key: 'house', label: 'House' }],
  fit: 'dots',
  source: 'The listing read did not complete on this refresh.',
  stamp: '',
}

/** The city page's map block: the rail beside the paired Atlas. */
function pairedPlaceMap(children: AtlasRegion[], opts: { incomplete: boolean }) {
  const rail = subdivisionRailEntries({
    regions: children.map((r) => ({ name: r.name, href: r.href })),
    extras: [],
    rows: [],
  })
  return {
    rail,
    html: renderToStaticMarkup(
      <PlaceSubdivisionMap placeName="Bend" rail={rail} homes={[]} leases={[]} keysBySlug={{}} source="regional MLS">
        <PlaceSubdivisionRail id="child-places" nameOnly label="Bend neighborhoods" />
        <PlaceSubdivisionAtlas
          {...ATLAS_BASE}
          regions={[BEND_TOWN]}
          childRegions={children}
          dots={[]}
          incomplete={opts.incomplete}
        />
      </PlaceSubdivisionMap>,
    ),
  }
}

describe('paired map: every polygon control has its rail row as partner', () => {
  it('/cities/bend on a short read (the CI render): all thirteen districts, the folded three included', () => {
    const { rail, html } = pairedPlaceMap(BEND_DISTRICTS, { incomplete: true })
    expect(rail.length).toBeGreaterThan(RAIL_FOLD_AT)
    const { doc, drawn, polygons } = pairs(html)
    expect(drawn).toBe(13)
    expect(polygons).toHaveLength(13)
    for (const { name, partner } of polygons) expect(partner, `${name} has no reachable full-size partner`).not.toBeNull()
    // The three past the fold pair through the one disclosure "Show all" controls.
    const more = doc.querySelector('button.place-subdiv-rail__more')!
    const foldList = doc.getElementById(more.getAttribute('aria-controls') ?? '')!
    const folded = polygons.filter((p) => foldList.contains(p.partner)).map((p) => p.name).sort()
    expect(folded).toEqual(['Southern Crossing', 'Southwest Bend', 'Summit West'])
  })

  it('/cities/bend on a full read: the same thirteen pairs', () => {
    const { polygons } = pairs(pairedPlaceMap(BEND_DISTRICTS, { incomplete: false }).html)
    expect(polygons).toHaveLength(13)
    for (const { name, partner } of polygons) expect(partner, name).not.toBeNull()
  })

  it('a phase-named plat (Redmond, Sisters) pairs by the rail row’s full name', () => {
    const plats: AtlasRegion[] = [
      { id: 'subdivision:hearthstone-phase-1', kind: 'subdivision', name: 'Hearthstone Phase 1', href: '/subdivisions/hearthstone-phase-1', geometry: square(-121.20, 44.25, -121.19, 44.26) },
      { id: 'subdivision:coyote-springs-phase-three-a', kind: 'subdivision', name: 'Coyote Springs Phase Three-a', href: '/subdivisions/coyote-springs-phase-three-a', geometry: square(-121.18, 44.25, -121.17, 44.26) },
    ]
    const { polygons } = pairs(pairedPlaceMap(plats, { incomplete: true }).html)
    expect(polygons.map((p) => p.name).sort()).toEqual(['Coyote Springs Phase Three-a', 'Hearthstone Phase 1'])
    for (const { name, partner } of polygons) expect(partner, name).not.toBeNull()
  })
})

describe('unpaired map: a polygon is a control only beside its chip', () => {
  const places = BEND_DISTRICTS.slice(0, 5)
  const render = (props: Partial<V3AtlasProps>) =>
    renderToStaticMarkup(
      createElement(V3Atlas, {
        ...ATLAS_BASE,
        regions: [BEND_TOWN, ...places],
        dots: [],
        ...props,
      } as V3AtlasProps),
    )

  it('on a full read every polygon pairs with its chip', () => {
    const { drawn, polygons } = pairs(render({}))
    expect(drawn).toBe(places.length)
    expect(polygons).toHaveLength(places.length)
    for (const { name, partner } of polygons) expect(partner, name).not.toBeNull()
  })

  it('on a short read there are no chips, so the polygons are drawn but none is a control', () => {
    const { doc, drawn, polygons } = pairs(render({ incomplete: true }))
    expect(doc.querySelector('button.v3-atlas__chip')).toBeNull()
    expect(drawn).toBe(places.length)
    expect(polygons).toHaveLength(0)
  })

  it('a place whose name is withheld gets no chip, so its polygon is not a control', () => {
    const withheld = 'Sun Ranch Phase I'
    expect(publishPlatDisplayName(withheld)).toBeNull()
    const odd: AtlasRegion = { ...places[0]!, id: 'subdivision:sun-ranch-phase-i', name: withheld, href: '/subdivisions/sun-ranch-phase-i' }
    const { drawn, polygons } = pairs(render({ regions: [BEND_TOWN, odd, ...places.slice(1)] }))
    expect(drawn).toBe(places.length)
    expect(polygons).toHaveLength(places.length - 1)
    for (const { name, partner } of polygons) {
      expect(name).not.toBe('')
      expect(partner, name).not.toBeNull()
    }
  })
})
