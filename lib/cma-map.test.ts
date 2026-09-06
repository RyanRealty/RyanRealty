import { describe, it, expect } from 'vitest'
import { buildGoogleStaticMapUrl, spreadStackedMapPoints } from './cma-map'

// buildGoogleStaticMapUrl renders the comp map embedded in every CMA deliverable.
// Lock the param contract so a Google Static Maps API change is caught. Audit p3.2.
const points = [
  { label: 'S', color: '0x102742', lat: 44.16, lng: -121.27 },
  { label: '1', color: '0xc8a864', lat: 44.17, lng: -121.29 },
]

describe('buildGoogleStaticMapUrl', () => {
  it('sets the base params, one marker per point, and the API key', () => {
    const url = buildGoogleStaticMapUrl(points, 'KEY123')
    expect(url.startsWith('https://maps.googleapis.com/maps/api/staticmap?')).toBe(true)
    const qs = new URLSearchParams(url.split('?')[1])
    expect(qs.get('size')).toBe('640x360')
    expect(qs.get('scale')).toBe('2')
    expect(qs.get('maptype')).toBe('roadmap')
    expect(qs.get('key')).toBe('KEY123')
    const markers = qs.getAll('markers')
    expect(markers).toHaveLength(2)
    expect(markers[0]).toBe('color:0x102742|label:S|size:mid|44.16,-121.27')
  })

  it('appends the brand style params', () => {
    const qs = new URLSearchParams(buildGoogleStaticMapUrl(points, 'K').split('?')[1])
    expect(qs.getAll('style').length).toBeGreaterThanOrEqual(9)
  })

  it('emits no markers for an empty point list (still a valid URL with the key)', () => {
    const qs = new URLSearchParams(buildGoogleStaticMapUrl([], 'K').split('?')[1])
    expect(qs.getAll('markers')).toHaveLength(0)
    expect(qs.get('key')).toBe('K')
  })
})

describe('spreadStackedMapPoints', () => {
  it('nudges a comp that sits on the subject pin, and leaves the subject still', () => {
    const subject = { label: 'S', color: 'red', lat: 44.298938, lng: -121.162046 }
    const stacked = { label: '4', color: '0x102742', lat: 44.299258, lng: -121.162046 }
    const far = { label: '1', color: '0x102742', lat: 44.298387, lng: -121.161005 }
    const out = spreadStackedMapPoints([subject, stacked, far])
    expect(out[0]).toEqual(subject)
    expect(out[2]).toEqual(far)
    expect(out[1]!.lat).not.toBe(stacked.lat)
    const dlat = out[1]!.lat - subject.lat
    const dlng = out[1]!.lng - subject.lng
    expect(Math.hypot(dlat, dlng)).toBeGreaterThan(0.0002)
  })
})
