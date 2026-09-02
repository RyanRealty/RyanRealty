import { beforeEach, describe, expect, it, vi } from 'vitest'

const rpc = vi.fn()

vi.mock('@/lib/data/client', () => ({ supabaseAnon: () => ({ rpc }) }))
vi.mock('next/cache', () => ({ unstable_cache: (fn: () => unknown) => fn }))

const SQUARE = JSON.stringify({
  type: 'Polygon',
  coordinates: [[[-121.31, 44.06], [-121.309, 44.06], [-121.309, 44.061], [-121.31, 44.061], [-121.31, 44.06]]],
})

function row(over: Record<string, unknown> = {}) {
  return {
    taxlot: '171219DB02100',
    map_number: '171219DB000',
    dial_url: 'http://dial.deschutes.org/results/taxlot?value=171219DB02100',
    acres: '0.842',
    is_subject: true,
    geojson: SQUARE,
    ...over,
  }
}

describe('getTaxlotsNear', () => {
  beforeEach(() => {
    vi.resetModules()
    rpc.mockReset()
  })

  it('returns the subject lot with its county identifiers and acreage', async () => {
    const { getTaxlotsNear } = await import('./getTaxlots')
    rpc.mockResolvedValue({ data: [row(), row({ taxlot: '171219DB01300', is_subject: false, acres: '0.811' })], error: null })

    const lots = await getTaxlotsNear({ lat: 44.0605, lng: -121.3095 })
    expect(lots).toHaveLength(2)
    expect(lots[0]).toMatchObject({
      taxlot: '171219DB02100',
      mapNumber: '171219DB000',
      acres: 0.842,
      isSubject: true,
    })
    expect(lots[0]!.geometry.type).toBe('Polygon')
    expect(lots[1]!.isSubject).toBe(false)
  })

  it('asks the RPC for the frame the caller named', async () => {
    const { getTaxlotsNear } = await import('./getTaxlots')
    rpc.mockResolvedValue({ data: [], error: null })
    await getTaxlotsNear({ lat: 44.06, lng: -121.31, radiusMeters: 90, maxLots: 6, toleranceDegrees: 0.00003 })
    expect(rpc).toHaveBeenCalledWith('taxlots_near_point', {
      p_lon: -121.31,
      p_lat: 44.06,
      p_radius_m: 90,
      p_limit: 6,
      p_tolerance: 0.00003,
    })
  })

  it('a coordinate that is not a coordinate reads nothing', async () => {
    const { getTaxlotsNear } = await import('./getTaxlots')
    expect(await getTaxlotsNear({ lat: Number.NaN, lng: -121.31 })).toEqual([])
    expect(rpc).not.toHaveBeenCalled()
  })

  it('a failed read THROWS, so the failure is never cached', async () => {
    const { getTaxlotsNear } = await import('./getTaxlots')
    rpc.mockResolvedValue({ data: null, error: { message: 'statement timeout' } })
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(getTaxlotsNear({ lat: 44.06, lng: -121.31 })).rejects.toThrow(/taxlots_near_point failed/)
    spy.mockRestore()
  })

  it('a row without geometry, or with geometry that is not a polygon, is dropped', async () => {
    const { getTaxlotsNear } = await import('./getTaxlots')
    rpc.mockResolvedValue({
      data: [
        row({ geojson: null }),
        row({ taxlot: '  ' }),
        row({ taxlot: 'X1', geojson: JSON.stringify({ type: 'LineString', coordinates: [] }) }),
        row({ taxlot: 'X2', geojson: '{not json' }),
        row({ taxlot: 'KEEP' }),
      ],
      error: null,
    })
    const lots = await getTaxlotsNear({ lat: 44.06, lng: -121.31 })
    expect(lots.map((l) => l.taxlot)).toEqual(['KEEP'])
  })

  it('acreage of zero or nothing is null, never a printed zero', async () => {
    const { getTaxlotsNear } = await import('./getTaxlots')
    rpc.mockResolvedValue({ data: [row({ acres: '0' }), row({ taxlot: 'B', acres: null })], error: null })
    const lots = await getTaxlotsNear({ lat: 44.06, lng: -121.31 })
    expect(lots.map((l) => l.acres)).toEqual([null, null])
  })
})

describe('getTaxlotsInBoundary', () => {
  beforeEach(() => {
    vi.resetModules()
    rpc.mockReset()
  })

  it('reads a plat by slug and marks nothing as the subject', async () => {
    const { getTaxlotsInBoundary } = await import('./getTaxlots')
    rpc.mockResolvedValue({ data: [row({ is_subject: undefined })], error: null })
    const lots = await getTaxlotsInBoundary({ geoType: 'subdivision', geoSlug: 'awbrey-glen' })
    expect(rpc).toHaveBeenCalledWith('taxlots_in_boundary', {
      p_geo_type: 'subdivision',
      p_geo_slug: 'awbrey-glen',
      p_limit: 400,
      p_tolerance: 0.00002,
    })
    expect(lots[0]!.isSubject).toBe(false)
  })

  it('a null type finds the boundary whatever it is filed under', async () => {
    const { getTaxlotsInBoundary } = await import('./getTaxlots')
    rpc.mockResolvedValue({ data: [], error: null })
    await getTaxlotsInBoundary({ geoType: null, geoSlug: 'tetherow' })
    expect(rpc).toHaveBeenCalledWith('taxlots_in_boundary', {
      p_geo_type: null,
      p_geo_slug: 'tetherow',
      p_limit: 400,
      p_tolerance: 0.00002,
    })
  })

  it('an empty slug reads nothing', async () => {
    const { getTaxlotsInBoundary } = await import('./getTaxlots')
    expect(await getTaxlotsInBoundary({ geoType: 'subdivision', geoSlug: '  ' })).toEqual([])
    expect(rpc).not.toHaveBeenCalled()
  })
})

describe('the disclaimer', () => {
  it('says it is not a survey and tells a reader what to do instead', async () => {
    const { TAXLOT_DISCLAIMER } = await import('./getTaxlots')
    expect(TAXLOT_DISCLAIMER).toMatch(/not a survey/i)
    expect(TAXLOT_DISCLAIMER).toMatch(/assessor/i)
    expect(TAXLOT_DISCLAIMER).toMatch(/survey before you rely/i)
  })
})
