import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const getTaxlotsInBoundary = vi.fn()

vi.mock('@/lib/data/geo/getTaxlots', () => ({
  getTaxlotsInBoundary: (...args: unknown[]) => getTaxlotsInBoundary(...args),
}))

import { GET } from './route'

function req(qs: string) {
  return new NextRequest(`https://ryan-realty.com/api/atlas/taxlots${qs}`)
}

describe('GET /api/atlas/taxlots (Matt 2026-09-23: lots inside a selected district)', () => {
  beforeEach(() => {
    getTaxlotsInBoundary.mockReset()
  })

  it('reads the named boundary and caps the read for payload', async () => {
    getTaxlotsInBoundary.mockResolvedValue([{ taxlot: '171219DB02100' }])
    const res = await GET(req('?t=neighborhood&s=bend-awbrey-butte'))
    expect(res.status).toBe(200)
    expect(getTaxlotsInBoundary).toHaveBeenCalledWith({
      geoType: 'neighborhood',
      geoSlug: 'bend-awbrey-butte',
      maxLots: 300,
    })
    expect(res.headers.get('cache-control')).toMatch(/public/)
    expect(await res.json()).toEqual({ lots: [{ taxlot: '171219DB02100' }] })
  })

  it('omits geoType when the caller does not know which boundary row carries the slug', async () => {
    getTaxlotsInBoundary.mockResolvedValue([])
    const res = await GET(req('?s=diamond-bar-ranch'))
    expect(res.status).toBe(200)
    expect(getTaxlotsInBoundary).toHaveBeenCalledWith({ geoType: null, geoSlug: 'diamond-bar-ranch', maxLots: 300 })
  })

  it('refuses a missing slug or an unknown geo type without reading anything', async () => {
    for (const qs of ['', '?t=neighborhood', '?s=&t=city', '?s=bend-awbrey-butte&t=zip']) {
      const res = await GET(req(qs))
      expect(res.status).toBe(400)
      expect(res.headers.get('cache-control')).toBe('no-store')
    }
    expect(getTaxlotsInBoundary).not.toHaveBeenCalled()
  })

  it('a failed read is a 503 the browser can retry, never cached', async () => {
    getTaxlotsInBoundary.mockRejectedValue(new Error('rpc down'))
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await GET(req('?t=neighborhood&s=bend-awbrey-butte'))
    expect(res.status).toBe(503)
    expect(res.headers.get('cache-control')).toBe('no-store')
    spy.mockRestore()
  })
})
