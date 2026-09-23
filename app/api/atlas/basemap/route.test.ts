import { describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from './route'
import { atlasBasemapHref } from '@/lib/atlas/atlas-basemap-href'
import { basemapForFrame } from '@/lib/geo/basemap-source'

describe('GET /api/atlas/basemap (UXLIVE-3)', () => {
  it('returns the clipped subset basemapForFrame gives the page, cached hard', async () => {
    const frame = { bbox: { minLon: -121.38, minLat: 44.0, maxLon: -121.24, maxLat: 44.12 } }
    const res = GET(new NextRequest(`https://ryan-realty.com${atlasBasemapHref(frame)}`))
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toMatch(/max-age=86400/)
    expect(res.headers.get('cache-control')).toMatch(/s-maxage=/)
    expect(await res.json()).toEqual(JSON.parse(JSON.stringify(basemapForFrame(frame))))
  })

  it('refuses a frame outside Oregon', () => {
    const res = GET(new NextRequest('https://ryan-realty.com/api/atlas/basemap?b=2,48,3,49'))
    expect(res.status).toBe(400)
  })
})
