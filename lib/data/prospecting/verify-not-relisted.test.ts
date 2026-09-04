/**
 * Fail-closed send probe: a Closed sale after expire at the same street+city
 * (and parcel when present) must return relisted:true. Relist Active still
 * returns relisted:true. A pre-expire Closed sale does not.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

type Row = Record<string, unknown>

let parcelRow: Row | null = { parcel_number: '171219DB02100' }
let parcelError: { message: string } | null = null
let streetRows: Row[] = []
let streetError: { message: string } | null = null
let parcelProbeRows: Row[] = []
let parcelProbeError: { message: string } | null = null

function thenable<T>(value: T) {
  return {
    select() {
      return this
    },
    eq(col: string, _v: unknown) {
      void col
      return this
    },
    in() {
      return this
    },
    or() {
      return this
    },
    maybeSingle: async () => ({ data: parcelRow, error: parcelError }),
    then(resolve: (v: { data: Row[]; error: { message: string } | null }) => void) {
      // First awaited listings probe in verifyNotRelisted is the street-number
      // read; the second (when a parcel resolved) is the parcel probe.
      if (this._kind === 'street') resolve({ data: streetRows, error: streetError })
      else resolve({ data: parcelProbeRows, error: parcelProbeError })
    },
    _kind: 'street' as 'street' | 'parcel',
  }
}

let listingsCalls = 0
const mockFrom = vi.fn((table: string) => {
  expect(table).toBe('listings')
  listingsCalls += 1
  const q = thenable<Row[]>([])
  // call 1 = parcel lookup (maybeSingle); call 2 = street probe; call 3 = parcel probe
  if (listingsCalls === 2) q._kind = 'street'
  if (listingsCalls >= 3) q._kind = 'parcel'
  return q
})

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({ from: mockFrom }),
}))

import { verifyNotRelisted } from './batch'

const EXPIRE = '2026-06-01T00:00:00Z'

beforeEach(() => {
  listingsCalls = 0
  parcelRow = { parcel_number: '171219DB02100' }
  parcelError = null
  streetRows = []
  streetError = null
  parcelProbeRows = []
  parcelProbeError = null
  mockFrom.mockClear()
})

describe('verifyNotRelisted — sold after expire', () => {
  it('blocks a Closed sale after expire on the same street + city', async () => {
    parcelRow = { parcel_number: null }
    streetRows = [
      {
        StreetNumber: '123',
        StreetName: 'SMITH',
        City: 'Bend',
        StandardStatus: 'Closed',
        CloseDate: '2026-07-15',
        status_change_timestamp: '2026-07-15T00:00:00Z',
        parcel_number: null,
      },
    ]
    const out = await verifyNotRelisted('expired', {
      street_address: '123 Smith St',
      city: 'Bend',
      expiryComparator: EXPIRE,
      listing_key: 'EXPIRED-KEY',
    })
    expect(out.verifyFailed).toBe(false)
    expect(out.relisted).toBe(true)
  })

  it('blocks a Closed sale after expire on the same parcel_number (new MLS number, different street spelling)', async () => {
    streetRows = []
    parcelProbeRows = [
      {
        StreetNumber: '123',
        StreetName: 'SMITH ROAD',
        City: 'Redmond',
        StandardStatus: 'Closed',
        CloseDate: '2026-08-01',
        status_change_timestamp: '2026-08-01T00:00:00Z',
        parcel_number: '171219DB02100',
      },
    ]
    const out = await verifyNotRelisted('expired', {
      street_address: '123 Smith St',
      city: 'Bend',
      expiryComparator: EXPIRE,
      listing_key: 'EXPIRED-KEY',
    })
    expect(out.verifyFailed).toBe(false)
    expect(out.relisted).toBe(true)
  })

  it('does not block a Closed sale before expire', async () => {
    parcelRow = { parcel_number: null }
    streetRows = [
      {
        StreetNumber: '123',
        StreetName: 'SMITH',
        City: 'Bend',
        StandardStatus: 'Closed',
        CloseDate: '2025-01-01',
        status_change_timestamp: '2025-01-01T00:00:00Z',
        parcel_number: null,
      },
    ]
    const out = await verifyNotRelisted('expired', {
      street_address: '123 Smith St',
      city: 'Bend',
      expiryComparator: EXPIRE,
      listing_key: 'EXPIRED-KEY',
    })
    expect(out.verifyFailed).toBe(false)
    expect(out.relisted).toBe(false)
  })

  it('still blocks an Active relist after expire (existing behavior)', async () => {
    parcelRow = { parcel_number: null }
    streetRows = [
      {
        StreetNumber: '123',
        StreetName: 'SMITH',
        City: 'Bend',
        StandardStatus: 'Active',
        CloseDate: null,
        status_change_timestamp: '2026-07-01T00:00:00Z',
        parcel_number: null,
      },
    ]
    const out = await verifyNotRelisted('expired', {
      street_address: '123 Smith St',
      city: 'Bend',
      expiryComparator: EXPIRE,
      listing_key: 'EXPIRED-KEY',
    })
    expect(out.verifyFailed).toBe(false)
    expect(out.relisted).toBe(true)
  })

  it('fails closed when the listings probe errors', async () => {
    parcelRow = { parcel_number: null }
    streetError = { message: 'timeout' }
    const out = await verifyNotRelisted('expired', {
      street_address: '123 Smith St',
      city: 'Bend',
      expiryComparator: EXPIRE,
      listing_key: 'EXPIRED-KEY',
    })
    expect(out.verifyFailed).toBe(true)
    expect(out.relisted).toBe(false)
  })
})

describe('verifyNotRelisted — FSBO Closed after detect + MLS relist', () => {
  it('blocks a Closed sale after FSBO detect on the same street + city', async () => {
    listingsCalls = 0
    streetRows = [
      {
        StreetNumber: '123',
        StreetName: 'SMITH',
        City: 'Bend',
        StandardStatus: 'Closed',
        CloseDate: '2026-07-15',
        status_change_timestamp: '2026-07-15T00:00:00Z',
        parcel_number: null,
      },
    ]
    const out = await verifyNotRelisted('fsbo', {
      street_address: '123 Smith St',
      city: 'Bend',
      expiryComparator: EXPIRE,
    })
    expect(out.verifyFailed).toBe(false)
    expect(out.relisted).toBe(true)
  })

  it('blocks an Active MLS relist for FSBO (no detect comparator needed)', async () => {
    listingsCalls = 0
    streetRows = [
      {
        StreetNumber: '123',
        StreetName: 'SMITH',
        City: 'Bend',
        StandardStatus: 'Active',
        CloseDate: null,
        status_change_timestamp: '2026-07-01T00:00:00Z',
        parcel_number: null,
      },
    ]
    const out = await verifyNotRelisted('fsbo', {
      street_address: '123 Smith St',
      city: 'Bend',
      expiryComparator: EXPIRE,
    })
    expect(out.verifyFailed).toBe(false)
    expect(out.relisted).toBe(true)
  })

  it('does not block a Closed sale before FSBO detect', async () => {
    listingsCalls = 0
    streetRows = [
      {
        StreetNumber: '123',
        StreetName: 'SMITH',
        City: 'Bend',
        StandardStatus: 'Closed',
        CloseDate: '2025-01-01',
        status_change_timestamp: '2025-01-01T00:00:00Z',
        parcel_number: null,
      },
    ]
    const out = await verifyNotRelisted('fsbo', {
      street_address: '123 Smith St',
      city: 'Bend',
      expiryComparator: EXPIRE,
    })
    expect(out.verifyFailed).toBe(false)
    expect(out.relisted).toBe(false)
  })
})
