import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const buildAtlasDots = vi.fn()
const resolveAtlasBoundaryRef = vi.fn()

vi.mock('@/lib/atlas/build-place-atlas', () => ({
  buildAtlasDots: (...args: unknown[]) => buildAtlasDots(...args),
  hashAtlasBoundary: (g: unknown) => (g ? 'h:1' : 'none'),
}))
vi.mock('@/lib/atlas/atlas-boundary-ref', () => ({
  resolveAtlasBoundaryRef: (...args: unknown[]) => resolveAtlasBoundaryRef(...args),
}))

import { GET } from './route'

const POLY = { type: 'Polygon', coordinates: [[[-121.4, 44], [-121.2, 44], [-121.2, 44.1], [-121.4, 44]]] }

function req(qs: string) {
  return new NextRequest(`https://ryan-realty.com/api/atlas/dots${qs}`)
}

describe('GET /api/atlas/dots (UXLIVE-3)', () => {
  beforeEach(() => {
    buildAtlasDots.mockReset()
    resolveAtlasBoundaryRef.mockReset()
  })

  it('serves the scope the page named, CDN-cacheable when the read is complete', async () => {
    resolveAtlasBoundaryRef.mockResolvedValue(POLY)
    buildAtlasDots.mockResolvedValue({ dots: [{ k: 'a' }], stamp: 'Sep 23, 2026, 9:00 AM', complete: true })
    const res = await GET(req('?c=Bend&b=geo:neighborhood:bend-awbrey-butte&h=12:ab&d=2026-09-23'))
    expect(res.status).toBe(200)
    expect(resolveAtlasBoundaryRef).toHaveBeenCalledWith({ kind: 'geo', geoType: 'neighborhood', geoSlug: 'bend-awbrey-butte' })
    expect(buildAtlasDots).toHaveBeenCalledWith({ cities: ['Bend'], boundary: POLY })
    expect(res.headers.get('cache-control')).toMatch(/public/)
    expect(res.headers.get('cache-control')).toMatch(/s-maxage=\d+/)
    expect(await res.json()).toEqual({ dots: [{ k: 'a' }], stamp: 'Sep 23, 2026, 9:00 AM', complete: true, boundary: 'h:1' })
  })

  it('reads the whole service area with no boundary and no cities', async () => {
    buildAtlasDots.mockResolvedValue({ dots: [], stamp: 's', complete: true })
    const res = await GET(req(''))
    expect(res.status).toBe(200)
    expect(resolveAtlasBoundaryRef).not.toHaveBeenCalled()
    expect(buildAtlasDots).toHaveBeenCalledWith({ cities: [], boundary: null })
  })

  it('never caches a short read', async () => {
    resolveAtlasBoundaryRef.mockResolvedValue(POLY)
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
    resolveAtlasBoundaryRef.mockResolvedValue(null)
    const res = await GET(req('?c=Bend&b=geo:neighborhood:bend-nowhere'))
    expect(res.status).toBe(404)
    expect(buildAtlasDots).not.toHaveBeenCalled()
  })

  it('a failed read is a 503 the browser retries, never cached', async () => {
    resolveAtlasBoundaryRef.mockRejectedValue(new Error('rpc down'))
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await GET(req('?c=Bend&b=geo:city:bend'))
    expect(res.status).toBe(503)
    expect(res.headers.get('cache-control')).toBe('no-store')
    spy.mockRestore()
  })
})
