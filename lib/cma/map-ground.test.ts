import { describe, expect, it } from 'vitest'
import { fitStaticMapView, latLngToWorld } from './static-map-projection'
import { renderMapGroundSvg, viewBbox } from './map-ground'
import { basemapForFrame } from '@/lib/geo/basemap-source'

// Tumalo-ish subject with sales around Bend: the frame the Concorde map drew.
const PINS = [
  { lat: 44.1566, lng: -121.3262 },
  { lat: 44.0614, lng: -121.3116 },
  { lat: 44.2643, lng: -121.174 },
  { lat: 44.05, lng: -121.36 },
]
const LABELS = [
  { text: 'Bend', lat: 44.06148, lng: -121.31156, kind: 'town' as const, rank: 135 },
  { text: 'Redmond', lat: 44.26434, lng: -121.17405, kind: 'town' as const, rank: 119 },
  { text: 'Tumalo', lat: 44.15663, lng: -121.32616, kind: 'town' as const, rank: 102 },
  { text: 'Tetherow', lat: 44.0306, lng: -121.3599, kind: 'place' as const, rank: 50 },
]

describe('the map ground — the Atlas skeleton under the pins', () => {
  it('a fractional fit frames the pins tighter than the integer tile zoom', () => {
    const tight = fitStaticMapView(PINS, { width: 640, height: 360, padding: 46, fractional: true })!
    const tile = fitStaticMapView(PINS, { width: 640, height: 360, padding: 46 })!
    expect(tight.zoom).toBeGreaterThanOrEqual(tile.zoom)
    expect(Number.isInteger(tile.zoom)).toBe(true)
  })

  it('draws roads and water from the TIGER tiers, names the towns in frame, and credits the source', () => {
    const view = fitStaticMapView(PINS, { width: 640, height: 360, padding: 46, fractional: true })!
    const bbox = viewBbox(view)
    expect(bbox.minLat).toBeLessThan(44.05)
    expect(bbox.maxLat).toBeGreaterThan(44.26)
    const ground = renderMapGroundSvg({
      view,
      basemap: basemapForFrame({ bbox, pad: 0.1 }),
      boundaryRings: [],
      radius: { centre: PINS[0]!, miles: 5 },
      labels: LABELS,
      pins: PINS,
    })
    expect(ground.featureCount).toBeGreaterThan(10)
    expect(ground.svg.startsWith('<svg')).toBe(true)
    expect(ground.svg).toContain('US Census TIGER')
    expect(ground.svg).toContain('stroke-dasharray="4 3"') // the search ring
    expect(ground.labelsDrawn).toContain('Bend')
    expect(ground.labelsDrawn).toContain('Redmond')
    expect(ground.svg).not.toMatch(/google/i)
  })

  it('a town label on a pin is nudged off it, never dropped', () => {
    const view = fitStaticMapView(PINS, { width: 640, height: 360, padding: 46, fractional: true })!
    const ground = renderMapGroundSvg({
      view,
      basemap: null,
      boundaryRings: [],
      radius: null,
      labels: [{ text: 'OnThePin', lat: PINS[0]!.lat, lng: PINS[0]!.lng, kind: 'town', rank: 200 }],
      pins: PINS,
    })
    expect(ground.labelsDrawn).toContain('OnThePin')
    const m = ground.svg.match(/<text x="([\d.]+)" y="([\d.]+)"[^>]*>OnThePin</)!
    expect(m).not.toBeNull()
    // The pin, projected the same way the ground projects it.
    const scale = Math.pow(2, view.zoom)
    const c = latLngToWorld({ lat: view.centerLat, lng: view.centerLng })
    const w = latLngToWorld(PINS[0]!)
    const pin = { x: (w.x - c.x) * scale + view.width / 2, y: (w.y - c.y) * scale + view.height / 2 }
    const dist = Math.hypot(Number(m[1]) - pin.x, Number(m[2]) - pin.y)
    expect(dist).toBeGreaterThan(20)
    expect(ground.featureCount).toBe(0)
  })
})

describe('a city inside a pin cluster is still named', () => {
  it('Bend with nine pins on top of it', () => {
    const bend = { lat: 44.06148, lng: -121.31156 }
    const cluster = Array.from({ length: 9 }, (_, i) => ({ lat: bend.lat + (i % 3) * 0.004 - 0.004, lng: bend.lng + Math.floor(i / 3) * 0.006 - 0.006 }))
    const pins = [...cluster, { lat: 44.1566, lng: -121.3262 }, { lat: 44.2643, lng: -121.174 }]
    const view = fitStaticMapView(pins, { width: 640, height: 360, padding: 46, fractional: true })!
    const ground = renderMapGroundSvg({
      view,
      basemap: null,
      boundaryRings: [],
      radius: null,
      labels: [
        { text: 'Bend', ...bend, kind: 'town', rank: 135 },
        { text: 'Tumalo', lat: 44.15663, lng: -121.32616, kind: 'town', rank: 102 },
        { text: 'Redmond', lat: 44.26434, lng: -121.17405, kind: 'town', rank: 119 },
        { text: 'Tetherow', lat: 44.0306, lng: -121.3599, kind: 'place', rank: 50 },
      ],
      pins,
    })
    expect(ground.labelsDrawn).toEqual(expect.arrayContaining(['Bend', 'Tumalo', 'Redmond']))
  })
})

describe('subdivision and parent names stay on the map', () => {
  it('draws two plat labels and the parent without dropping the towns', () => {
    const pins = [
      { lat: 44.07, lng: -121.32 },
      { lat: 44.1, lng: -121.25 },
      { lat: 44.1566, lng: -121.3262 },
      { lat: 44.2643, lng: -121.174 },
    ]
    const view = fitStaticMapView(pins, { width: 640, height: 360, padding: 46, fractional: true })!
    const ground = renderMapGroundSvg({
      view,
      basemap: null,
      boundaryRings: [],
      radius: null,
      labels: [
        { text: 'Bend', lat: 44.06148, lng: -121.31156, kind: 'town', rank: 135 },
        { text: 'Redmond', lat: 44.26434, lng: -121.17405, kind: 'town', rank: 119 },
        { text: 'Tumalo', lat: 44.15663, lng: -121.32616, kind: 'town', rank: 102 },
        { text: 'Countryside', lat: 44.07, lng: -121.32, kind: 'subdivision', rank: 80 },
        { text: 'Northwest Crossing', lat: 44.1, lng: -121.25, kind: 'subdivision', rank: 80 },
        { text: 'River West', lat: 44.12, lng: -121.28, kind: 'parent', rank: 90 },
      ],
      pins,
    })
    expect(ground.labelsDrawn).toEqual(
      expect.arrayContaining(['Countryside', 'Northwest Crossing', 'River West', 'Bend', 'Redmond', 'Tumalo']),
    )
  })

  it('wraps a long plat name so each painted line stays inside the map', () => {
    const name = 'Deschutes River Recreation Homesites Unit 9 Part 2 Blocks 41-61'
    const pins = [
      { lat: 44.07, lng: -121.32 },
      { lat: 44.1, lng: -121.25 },
    ]
    const view = fitStaticMapView(pins, { width: 640, height: 360, padding: 46, fractional: true })!
    const ground = renderMapGroundSvg({
      view,
      basemap: null,
      boundaryRings: [],
      radius: null,
      labels: [{ text: name, lat: pins[0]!.lat, lng: pins[0]!.lng, kind: 'subdivision', rank: 80 }],
      pins,
    })
    const block = [...ground.svg.matchAll(/<text ([^>]*)>([\s\S]*?)<\/text>/g)].find((m) => m[2]!.includes('Deschutes'))
    expect(block).toBeTruthy()
    const spans = [...block![2]!.matchAll(/<tspan[^>]*>([^<]*)<\/tspan>/g)].map((m) => m[1]!)
    expect(spans.length).toBeGreaterThan(1)
    expect(spans.join(' ')).toBe(name)
    const fs = Number(/font-size="([^"]*)"/.exec(block![1]!)?.[1])
    const x = Number(/ x="([^"]*)"/.exec(` ${block![1]}`)?.[1] ?? /x="([^"]*)"/.exec(block![1]!)?.[1])
    for (const line of spans) {
      const w = line.length * fs * 0.58
      expect(x - w / 2).toBeGreaterThanOrEqual(0)
      expect(x + w / 2).toBeLessThanOrEqual(view.width)
    }
  })
})
