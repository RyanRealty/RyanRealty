import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const buildAtlasDots = vi.fn()
const resolveAtlasScopeRef = vi.fn()

vi.mock('@/lib/atlas/build-place-atlas', () => ({
  buildAtlasDots: (...args: unknown[]) => buildAtlasDots(...args),
  hashAtlasBoundary: (g: unknown) => (g ? 'h:1' : 'none'),
}))
vi.mock('@/lib/atlas/atlas-boundary-ref', () => ({
  resolveAtlasScopeRef: (...args: unknown[]) => resolveAtlasScopeRef(...args),
}))

import { GET } from './route'

const POLY = { type: 'Polygon', coordinates: [[[-121.4, 44], [-121.2, 44], [-121.2, 44.1], [-121.4, 44]]] }

function req(qs: string) {
  return new NextRequest(`https://ryan-realty.com/api/atlas/dots${qs}`)
}

describe('GET /api/atlas/dots (UXLIVE-3)', () => {
  beforeEach(() => {
    buildAtlasDots.mockReset()
    resolveAtlasScopeRef.mockReset()
  })

  it('serves the scope the page named, CDN-cacheable when the read is complete', async () => {
    resolveAtlasScopeRef.mockResolvedValue({ boundary: POLY })
    buildAtlasDots.mockResolvedValue({ dots: [{ k: 'a' }], stamp: 'Sep 23, 2026, 9:00 AM', complete: true })
    const res = await GET(req('?c=Bend&b=geo:neighborhood:bend-awbrey-butte&h=12:ab&d=2026-09-23'))
    expect(res.status).toBe(200)
    expect(resolveAtlasScopeRef).toHaveBeenCalledWith({ kind: 'geo', geoType: 'neighborhood', geoSlug: 'bend-awbrey-butte' })
    expect(buildAtlasDots).toHaveBeenCalledWith({ cities: ['Bend'], boundary: POLY })
    expect(res.headers.get('cache-control')).toMatch(/public/)
    expect(res.headers.get('cache-control')).toMatch(/s-maxage=\d+/)
    expect(await res.json()).toEqual({ dots: [{ k: 'a' }], stamp: 'Sep 23, 2026, 9:00 AM', complete: true, boundary: 'h:1' })
  })

  it('rebuilds a community from its outline AND the homes the page listed', async () => {
    const onMarket = [{ listingKey: 'k1', status: 'Active', lat: 44.05, lng: -121.3 }]
    resolveAtlasScopeRef.mockResolvedValue({ boundary: POLY, onMarket })
    buildAtlasDots.mockResolvedValue({ dots: [{ k: 'k1' }], stamp: 's', complete: true })
    const res = await GET(req('?c=Bend&b=community:broken-top&h=12:ab&d=2026-09-25'))
    expect(res.status).toBe(200)
    expect(resolveAtlasScopeRef).toHaveBeenCalledWith({ kind: 'community', slug: 'broken-top' })
    expect(buildAtlasDots).toHaveBeenCalledWith({ cities: ['Bend'], boundary: POLY, onMarket })
  })

  it('reads the whole service area with no boundary and no cities', async () => {
    buildAtlasDots.mockResolvedValue({ dots: [], stamp: 's', complete: true })
    const res = await GET(req(''))
    expect(res.status).toBe(200)
    expect(resolveAtlasScopeRef).not.toHaveBeenCalled()
    expect(buildAtlasDots).toHaveBeenCalledWith({ cities: [], boundary: null })
  })

  it('never caches a short read', async () => {
    resolveAtlasScopeRef.mockResolvedValue({ boundary: POLY })
    buildAtlasDots.mockResolvedValue({ dots: [], stamp: 's', complete: false })
    const res = await GET(req('?c=Bend&b=geo:city:bend'))
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect((await res.json()).complete).toBe(false)
  })

  it('refuses a malformed scope without reading anything', async () => {
    for (const qs of ['?c=Bend', '?b=geo:zip:97702', '?b=geo:city:bend&c=%3Cx%3E', '?b=geo:city:bend&c=Bend&d=soon']) {
      const res = await GET(req(qs))
      expect(res.status).toBe(400)
      expect(res.headers.get('cache-control')).toBe('no-store')
    }
    expect(buildAtlasDots).not.toHaveBeenCalled()
  })

  it('a reference to a boundary that does not exist is a 404, not an empty map', async () => {
    resolveAtlasScopeRef.mockResolvedValue({ boundary: null })
    const res = await GET(req('?c=Bend&b=geo:neighborhood:bend-nowhere'))
    expect(res.status).toBe(404)
    expect(buildAtlasDots).not.toHaveBeenCalled()
  })

  it('a failed read is a 503 the browser retries, never cached', async () => {
    resolveAtlasScopeRef.mockRejectedValue(new Error('rpc down'))
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await GET(req('?c=Bend&b=geo:city:bend'))
    expect(res.status).toBe(503)
    expect(res.headers.get('cache-control')).toBe('no-store')
    spy.mockRestore()
  })
})
