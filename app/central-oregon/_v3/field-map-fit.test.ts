import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { fieldMapFit } from './field-map-fit'

const redmond = [
  { lat: 44.24, lng: -121.2 },
  { lat: 44.24, lng: -121.14 },
  { lat: 44.3, lng: -121.14 },
  { lat: 44.3, lng: -121.2 },
]

describe('fieldMapFit', () => {
  it('hugs the place polygon even when pins are a smaller cluster', () => {
    const fit = fieldMapFit({
      polygons: [redmond],
      pins: [{ lat: 44.27, lng: -121.17 }],
    })
    expect(fit.kind).toBe('polygon')
    if (fit.kind === 'polygon') expect(fit.points).toHaveLength(4)
  })

  it('falls back to pins when the place has no polygon', () => {
    const fit = fieldMapFit({
      polygons: [],
      pins: [
        { lat: 44.05, lng: -121.3 },
        { lat: 44.08, lng: -121.32 },
      ],
    })
    expect(fit.kind).toBe('pins')
  })

  it('treats a one-point set as a single zoom, not a region', () => {
    expect(
      fieldMapFit({
        polygons: [],
        pins: [{ lat: 44.05, lng: -121.3 }],
      }),
    ).toEqual({ kind: 'single', point: { lat: 44.05, lng: -121.3 } })
  })
})

describe('PlaceFieldMapImpl pin language', () => {
  it('does not import teal house pins', () => {
    const src = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), 'PlaceFieldMapImpl.tsx'),
      'utf8',
    )
    expect(src).not.toMatch(/getListingMarkerIcon/)
    expect(src).toMatch(/fieldTypeMarkerIcon/)
    expect(src).toMatch(/fieldMapFit/)
  })
})
