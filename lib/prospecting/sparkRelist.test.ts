/**
 * The live MLS relist check on the outreach send path, against a fake Spark.
 * Fixtures are the real 2026-09-30 cases: 15 NW Franklin (the expired listing
 * relisted under its own key) and 2745 NW Ordway, a condo building where Spark
 * held six units on the market while our table said four.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

type Fields = Record<string, unknown>
const spark = {
  byKey: new Map<string, Fields>(),
  byKeyError: null as Error | null,
  byKeyHang: false,
  address: [] as Fields[],
  addressTotal: null as number | null,
  addressError: null as Error | null,
  calls: [] as { kind: 'key' | 'address'; arg: string; select?: string; retryOn429?: boolean }[],
}

vi.mock('@/lib/spark', () => ({
  fetchSparkListingByKey: vi.fn(async (_t: string, key: string, _expand: string, opts: { select?: string }) => {
    spark.calls.push({ kind: 'key', arg: key, select: opts?.select })
    if (spark.byKeyHang) return new Promise(() => {})
    if (spark.byKeyError) throw spark.byKeyError
    const f = spark.byKey.get(key)
    return f ? { D: { Success: true, Results: [{ StandardFields: f }] } } : null
  }),
  fetchSparkListingsPage: vi.fn(async (_t: string, opts: { filter?: string; select?: string; retryOn429?: boolean }) => {
    spark.calls.push({ kind: 'address', arg: opts.filter ?? '', select: opts.select, retryOn429: opts.retryOn429 })
    if (spark.addressError) throw spark.addressError
    return {
      D: {
        Success: true,
        Results: spark.address.map((f) => ({ StandardFields: f })),
        Pagination: { TotalRows: spark.addressTotal ?? spark.address.length },
      },
    }
  }),
}))

import { COMING_SOON_STATUS } from '@/lib/listing-status-public'
import { parseStreetAddress, sparkRelistCheck } from './sparkRelist'

function listing(key: string, over: Fields = {}): Fields {
  return { ListingKey: key, StandardStatus: 'Active', StreetNumber: '2745', StreetName: 'Ordway', UnitNumber: null, City: 'Bend', CloseDate: null, ...over }
}

const ordway = (key: string, unit: string, status = 'Active') => listing(key, { UnitNumber: unit, StandardStatus: status })

beforeEach(() => {
  process.env.SPARK_API_KEY = 'test-key'
  spark.byKey = new Map()
  spark.byKeyError = null
  spark.byKeyHang = false
  spark.address = []
  spark.addressTotal = null
  spark.addressError = null
  spark.calls = []
})

describe('parseStreetAddress', () => {
  it('reads number, the first word of the street name past a direction, and a unit', () => {
    expect(parseStreetAddress('2745 NW Ordway Ave #311')).toEqual({ number: '2745', nameKey: 'ORDWAY', unit: '311' })
    expect(parseStreetAddress('15 Franklin')).toEqual({ number: '15', nameKey: 'FRANKLIN', unit: null })
    expect(parseStreetAddress('61271 Kwinnum Dr, Bend, OR 97702')).toEqual({ number: '61271', nameKey: 'KWINNUM', unit: null })
    expect(parseStreetAddress('20016 Mt Hope Ln Unit 4')).toEqual({ number: '20016', nameKey: 'MOUNT', unit: '4' })
    expect(parseStreetAddress(null)).toEqual({ number: null, nameKey: null, unit: null })
  })

  it('does not read a street word as a unit', () => {
    expect(parseStreetAddress('123 Lot Road')).toEqual({ number: '123', nameKey: 'LOT', unit: null })
    expect(parseStreetAddress('9 Oak Ct Unit B')).toEqual({ number: '9', nameKey: 'OAK', unit: 'B' })
  })

  it('spells a unit and a highway the way the MLS does', () => {
    expect(parseStreetAddress('2745 NW Ordway Ave #0311').unit).toBe('311')
    expect(parseStreetAddress('6268 Hwy 126')).toMatchObject({ number: '6268', nameKey: 'HIGHWAY' })
  })
})

describe('sparkRelistCheck', () => {
  it('blocks the proven case: the expired listing key is Active again in Spark', async () => {
    spark.byKey.set('20260120200524195349000000', listing('20260120200524195349000000', { StreetNumber: '15', StreetName: 'Franklin' }))
    const r = await sparkRelistCheck({
      listingKey: '20260120200524195349000000',
      streetAddress: '15 Franklin',
      city: 'Bend',
    })
    expect(r).toMatchObject({
      relisted: true,
      verifyFailed: false,
      blockedStatus: 'Active',
      blockedKey: '20260120200524195349000000',
    })
    expect(r.reason).toMatch(/20260120200524195349000000 is Active/)
  })

  it('blocks when the expired listing key has since closed', async () => {
    spark.byKey.set('K', listing('K', { StandardStatus: 'Closed', CloseDate: '2026-09-12' }))
    const r = await sparkRelistCheck({ listingKey: 'K', streetAddress: '2745 Ordway', city: 'Bend' })
    expect(r).toMatchObject({ relisted: true, blockedStatus: 'Closed', blockedKey: 'K' })
  })

  it('blocks a different listing on the market for the same unit (relisted under a new key)', async () => {
    spark.byKey.set('OLD311', ordway('OLD311', '311', 'Expired'))
    spark.address = [ordway('NEW311', '311', 'Pending'), ordway('K209', '209')]
    const r = await sparkRelistCheck({ listingKey: 'OLD311', streetAddress: '2745 Ordway', city: 'Bend' })
    expect(r).toMatchObject({ relisted: true, verifyFailed: false, blockedStatus: 'Pending', blockedKey: 'NEW311' })
    expect(r.reason).toMatch(/NEW311/)
  })

  it('does not block another unit in the same building, or another street at the same number', async () => {
    spark.byKey.set('OLD311', ordway('OLD311', '311', 'Expired'))
    spark.address = [
      ordway('K209', '209'),
      ordway('K207', '207', 'Pending'),
      listing('NORDIC', { StreetName: 'Nordic', UnitNumber: 'Lot 18' }),
    ]
    const r = await sparkRelistCheck({ listingKey: 'OLD311', streetAddress: '2745 Ordway', city: 'Bend' })
    expect(r).toEqual({ relisted: false, verifyFailed: false, reason: null, blockedStatus: null, blockedKey: null })
  })

  it('blocks any on-market unit when the subject unit is unknown (a building-wide match is the safe side)', async () => {
    spark.address = [ordway('K209', '209')]
    const r = await sparkRelistCheck({ listingKey: null, streetAddress: '2745 NW Ordway Ave', city: 'Bend' })
    expect(r.relisted).toBe(true)
  })

  it('reads the unit from the address when there is no listing key (FSBO)', async () => {
    spark.address = [ordway('K209', '209')]
    const r = await sparkRelistCheck({ listingKey: null, streetAddress: '2745 NW Ordway Ave #311', city: 'Bend' })
    expect(r.relisted).toBe(false)
  })

  it('asks for the subject by key and the on-market listings at the address, fields limited, no 429 wait', async () => {
    await sparkRelistCheck({ listingKey: 'K', streetAddress: '2745 Ordway', city: 'Bend' })
    expect(spark.calls.map((c) => c.kind).sort()).toEqual(['address', 'key'])
    for (const c of spark.calls) expect(c.select).toBe('ListingKey,StandardStatus,StreetNumber,StreetName,UnitNumber,City,CloseDate')
    const address = spark.calls.find((c) => c.kind === 'address')!
    // Every on-market status this MLS uses, the pre-marketing one included (a
    // home listed with a broker is off limits before it is public).
    expect(address.arg).toBe(
      `StreetNumber Eq '2745' And City Eq 'Bend' And (StandardStatus Eq 'Active' Or StandardStatus Eq 'Active Under Contract' Or StandardStatus Eq '${COMING_SOON_STATUS}' Or StandardStatus Eq 'Pending')`,
    )
    expect(address.retryOn429).toBe(false)
  })

  it('a subject Spark does not know (404) leaves the address check to decide', async () => {
    const r = await sparkRelistCheck({ listingKey: 'GONE', streetAddress: '2745 Ordway', city: 'Bend' })
    expect(r).toEqual({ relisted: false, verifyFailed: false, reason: null, blockedStatus: null, blockedKey: null })
  })

  it('fails closed when the by-key read errors (a 403 on a listing we may not see)', async () => {
    spark.byKeyError = new Error('Spark API error 403: You do not have permission')
    const r = await sparkRelistCheck({ listingKey: 'K', streetAddress: '2745 Ordway', city: 'Bend' })
    expect(r).toMatchObject({ relisted: false, verifyFailed: true })
    expect(r.reason).toMatch(/403/)
  })

  it('fails closed when the address read errors (429 included)', async () => {
    spark.addressError = new Error('Spark API error 429: rate limited')
    const r = await sparkRelistCheck({ listingKey: 'K', streetAddress: '2745 Ordway', city: 'Bend' })
    expect(r).toMatchObject({ relisted: false, verifyFailed: true })
  })

  it('fails closed when Spark does not answer in time', async () => {
    spark.byKeyHang = true
    const t0 = Date.now()
    const r = await sparkRelistCheck(
      { listingKey: 'K', streetAddress: '2745 Ordway', city: 'Bend' },
      { timeoutMs: 30 },
    )
    expect(r).toMatchObject({ relisted: false, verifyFailed: true })
    expect(r.reason).toMatch(/timed out/)
    expect(Date.now() - t0).toBeLessThan(2000)
  })

  it('fails closed when more listings are on the market at the number than one page shows', async () => {
    spark.address = [ordway('K209', '209')]
    spark.addressTotal = 101
    const r = await sparkRelistCheck({ listingKey: null, streetAddress: '2745 Ordway #311', city: 'Bend' })
    expect(r.verifyFailed).toBe(true)
  })

  it('fails closed without a Spark key', async () => {
    process.env.SPARK_API_KEY = ''
    const r = await sparkRelistCheck({ listingKey: 'K', streetAddress: '2745 Ordway', city: 'Bend' })
    expect(r.verifyFailed).toBe(true)
    expect(spark.calls).toEqual([])
  })

  it('has nothing to ask without a listing key or a street number', async () => {
    const r = await sparkRelistCheck({ listingKey: null, streetAddress: 'Ordway', city: 'Bend' })
    expect(r).toEqual({ relisted: false, verifyFailed: false, reason: null, blockedStatus: null, blockedKey: null })
    expect(spark.calls).toEqual([])
  })
})
