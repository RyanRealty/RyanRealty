/**
 * The came-off read also reads every later record of the same houses, so a
 * house that came off, relisted and sold is not counted as one that came off
 * unsold (cma-1648-pheasant, reader review 2026-10-08), and a read that
 * throws is marked failed rather than read as "nothing came off" (§0).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

type Call = { col: string; val: unknown }
const unsoldRows: Array<Record<string, unknown>> = []
const laterRows: Array<Record<string, unknown>> = []
const laterCalls: Call[][] = []
let failLater = false

function chain(): unknown {
  const calls: Call[] = []
  const proxy: unknown = new Proxy(
    {},
    {
      get(_t, prop) {
        if (prop === 'then') return undefined
        if (prop === 'range') {
          return async () => {
            const status = calls.find((c) => c.col === 'StandardStatus')?.val as string[] | undefined
            const isLater = Array.isArray(status) && status.includes('Closed')
            if (!isLater) return { data: unsoldRows, error: null }
            laterCalls.push(calls)
            if (failLater) return { data: null, error: { message: 'boom' } }
            return { data: laterRows, error: null }
          }
        }
        return (col?: unknown, val?: unknown) => {
          if (typeof col === 'string') calls.push({ col, val })
          return proxy
        }
      },
    },
  )
  return proxy
}

vi.mock('@/lib/supabase/service', () => ({ createServiceClient: () => ({ from: () => chain() }) }))
vi.mock('@/lib/data/geo/subdivision-ring', () => ({ assignSubdivisionSlugs: async () => [] }))

import { getCmaAreaUnsoldCycles } from '@/lib/data/cma/areaUnsoldReads'
import type { CompArea } from '@/lib/pricing/comp-area'

const AREA: CompArea = {
  kind: 'subdivisions',
  names: ['Pheasant Hill', 'Neal', 'Meadowview Estate', 'North Pilot Butte'],
  radiusMiles: null,
  centre: { lat: 44.071089, lng: -121.281442 },
  source: 'test',
  sentence: 'test',
}

describe('getCmaAreaUnsoldCycles reads the later cycles of the same houses', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test'
    unsoldRows.length = 0
    laterRows.length = 0
    laterCalls.length = 0
    failLater = false
    unsoldRows.push(
      { ListingKey: '20260304180508627129000000', StreetNumber: '2639', StreetName: 'Harvey', City: 'Bend', SubdivisionName: 'North Pilot Butte', StandardStatus: 'Canceled', ListPrice: 599000, OnMarketDate: '2026-06-07 23:30:27+00', status_change_timestamp: '2026-06-08 23:04:07+00', parcel_number: '100566' },
      { ListingKey: '20260402204906041951000000', StreetNumber: '1382', StreetName: 'Drost', City: 'Bend', SubdivisionName: 'North Pilot Butte', StandardStatus: 'Canceled', ListPrice: 659900, OnMarketDate: '2026-04-08 18:04:53+00', status_change_timestamp: '2026-06-09 22:40:16+00', parcel_number: '100471' },
    )
    laterRows.push(
      { ListingKey: '20260612214218799263000000', StreetNumber: '2639', StreetName: 'Harvey', City: 'Bend', parcel_number: '100566', StandardStatus: 'Closed', OnMarketDate: '2026-06-12 22:49:57+00', CloseDate: '2026-07-31 00:00:00+00' },
      { ListingKey: '20260605215653342393000000', StreetNumber: '1382', StreetName: 'Drost', City: 'Bend', parcel_number: '100471', StandardStatus: 'Closed', OnMarketDate: '2026-06-10 14:13:46+00', CloseDate: '2026-07-16 00:00:00+00' },
    )
  })

  it('returns the later records, reads them by street number and city from the earliest cycle on, and cites each drop', async () => {
    const read = await getCmaAreaUnsoldCycles({ area: AREA, city: 'Bend', propertySubType: 'Single Family Residence', priceLo: 308000, priceHi: 1036000 })
    expect(read.failed).toBeUndefined()
    expect(read.rows).toHaveLength(2)
    expect(read.laterCycles.map((r) => r.ListingKey)).toEqual(['20260612214218799263000000', '20260605215653342393000000'])
    const calls = laterCalls[0]!
    expect(calls.find((c) => c.col === 'StreetNumber')?.val).toEqual(['1382', '2639'])
    expect(calls.find((c) => c.col === 'City')?.val).toEqual(['Bend'])
    expect(calls.find((c) => c.col === 'status_change_timestamp')?.val).toBe('2026-04-08')
    expect(read.citation.relist?.dropped).toEqual([
      expect.objectContaining({ address: '2639 Harvey', laterListingKey: '20260612214218799263000000', laterStatus: 'Closed' }),
      expect.objectContaining({ address: '1382 Drost', laterListingKey: '20260605215653342393000000', laterStatus: 'Closed' }),
    ])
  })

  it('marks the read failed when the later-cycle read throws, so no came-off sentence is printed from it', async () => {
    failLater = true
    const read = await getCmaAreaUnsoldCycles({ area: AREA, city: 'Bend', propertySubType: 'Single Family Residence', priceLo: 308000, priceHi: 1036000 })
    expect(read.failed).toBe(true)
    expect(read.rows).toEqual([])
  })
})
