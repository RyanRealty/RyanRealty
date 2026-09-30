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

// The live MLS check (lib/prospecting/sparkRelist.ts) answers alongside our table.
const sparkRelistCheck = vi.hoisted(() => vi.fn())
vi.mock('@/lib/prospecting/sparkRelist', () => ({
  sparkRelistCheck: (...a: unknown[]) => sparkRelistCheck(...a),
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
  sparkRelistCheck.mockReset()
  sparkRelistCheck.mockResolvedValue({ relisted: false, verifyFailed: false, reason: null })
})

describe('verifyNotRelisted — the live MLS answers too', () => {
  it('blocks the proven case: our table shows nothing on the market at 15 Franklin, Spark has the listing Active again', async () => {
    parcelRow = { parcel_number: null }
    streetRows = []
    sparkRelistCheck.mockResolvedValue({
      relisted: true,
      verifyFailed: false,
      reason: 'Spark: listing 20260120200524195349000000 is Active',
    })
    const out = await verifyNotRelisted('expired', {
      street_address: '15 Franklin',
      city: 'Bend',
      expiryComparator: '2026-08-06T05:00:00+00:00',
      listing_key: '20260120200524195349000000',
    })
    expect(out).toMatchObject({ relisted: true, verifyFailed: false })
    expect(sparkRelistCheck).toHaveBeenCalledWith(
      expect.objectContaining({
        listingKey: '20260120200524195349000000',
        streetAddress: '15 Franklin',
        city: 'Bend',
      }),
    )
  })

  it('fails closed when Spark cannot answer, even with our table clear', async () => {
    parcelRow = { parcel_number: null }
    sparkRelistCheck.mockResolvedValue({ relisted: false, verifyFailed: true, reason: 'Spark by-key read timed out after 8000 ms' })
    const out = await verifyNotRelisted('expired', {
      street_address: '123 Smith St',
      city: 'Bend',
      expiryComparator: EXPIRE,
      listing_key: 'EXPIRED-KEY',
    })
    expect(out).toMatchObject({ relisted: false, verifyFailed: true })
  })

  it('fails closed when the Spark check throws', async () => {
    parcelRow = { parcel_number: null }
    sparkRelistCheck.mockRejectedValue(new Error('boom'))
    const out = await verifyNotRelisted('fsbo', { street_address: '123 Smith St', city: 'Bend', expiryComparator: EXPIRE })
    expect(out).toMatchObject({ relisted: false, verifyFailed: true })
  })

  it('a relist our table shows still blocks when Spark cannot answer', async () => {
    parcelRow = { parcel_number: null }
    streetRows = [
      { StreetNumber: '123', StreetName: 'SMITH', City: 'Bend', StandardStatus: 'Active', CloseDate: null, status_change_timestamp: '2026-07-01T00:00:00Z', parcel_number: null },
    ]
    sparkRelistCheck.mockResolvedValue({ relisted: false, verifyFailed: true, reason: 'Spark address read failed: 429' })
    const out = await verifyNotRelisted('expired', {
      street_address: '123 Smith St',
      city: 'Bend',
      expiryComparator: EXPIRE,
      listing_key: 'EXPIRED-KEY',
    })
    expect(out).toMatchObject({ relisted: true, verifyFailed: false })
  })

  it('still asks Spark by key when the address has no street number', async () => {
    sparkRelistCheck.mockResolvedValue({ relisted: true, verifyFailed: false, reason: 'Spark: listing K is Pending' })
    const out = await verifyNotRelisted('expired', { street_address: 'Ordway', city: 'Bend', expiryComparator: EXPIRE, listing_key: 'K' })
    expect(out).toMatchObject({ relisted: true, verifyFailed: false })
  })
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
