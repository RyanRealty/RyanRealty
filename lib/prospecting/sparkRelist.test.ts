/**
 * The live MLS relist check on the outreach send paths, against a fake Spark.
 * Fixtures are the real cases: 15 NW Franklin (the expired listing relisted
 * under its own key), 2745 NW Ordway (a condo building where Spark held six
 * units on the market while our table said four), 20873 Greenmont (expired
 * 2026-07-05, Active under a NEW key with the same office on 2026-07-06; the
 * CRM drip texted the owner on 2026-09-21) and 2804 NW 19th, Redmond (an FSBO
 * whose CMA subject key is a 2004 sale).
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
  calls: [] as {
    kind: 'key' | 'address'
    arg: string
    select?: string
    limit?: number
    retryOn429?: boolean
    notFoundAsError?: boolean
  }[],
}

vi.mock('@/lib/spark', () => ({
  fetchSparkListingByKey: vi.fn(async (_t: string, key: string, _expand: string, opts: { select?: string }) => {
    spark.calls.push({ kind: 'key', arg: key, select: opts?.select })
    if (spark.byKeyHang) return new Promise(() => {})
    if (spark.byKeyError) throw spark.byKeyError
    const f = spark.byKey.get(key)
    return f ? { D: { Success: true, Results: [{ StandardFields: f }] } } : null
  }),
  fetchSparkListingsPage: vi.fn(
    async (
      _t: string,
      opts: { filter?: string; select?: string; limit?: number; retryOn429?: boolean; notFoundAsError?: boolean },
    ) => {
      spark.calls.push({
        kind: 'address',
        arg: opts.filter ?? '',
        select: opts.select,
        limit: opts.limit,
        retryOn429: opts.retryOn429,
        notFoundAsError: opts.notFoundAsError,
      })
      if (spark.addressError) throw spark.addressError
      return {
        D: {
          Success: true,
          Results: spark.address.map((f) => ({ StandardFields: f })),
          Pagination: { TotalRows: spark.addressTotal ?? spark.address.length },
        },
      }
    },
  ),
}))

import { COMING_SOON_STATUS } from '@/lib/listing-status-public'
import { cityKey, parseStreetAddress, sparkRelistCheck } from './sparkRelist'

const SELECT =
  'ListingKey,StandardStatus,StreetNumber,StreetName,UnitNumber,City,PostalCode,CloseDate,StatusChangeTimestamp,OnMarketDate'
const CLEAR = {
  relisted: false,
  verifyFailed: false,
  failureScope: null,
  reason: null,
  blockedStatus: null,
  blockedKey: null,
  blockedDate: null,
  closeDate: null,
}
const NOW = new Date('2026-09-30T12:00:00Z')

function listing(key: string, over: Fields = {}): Fields {
  return {
    ListingKey: key,
    StandardStatus: 'Active',
    StreetNumber: '2745',
    StreetName: 'Ordway',
    UnitNumber: null,
    City: 'Bend',
    PostalCode: '97703',
    CloseDate: null,
    ...over,
  }
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

describe('cityKey', () => {
  it('ignores case and spacing', () => {
    expect(cityKey('La Pine')).toBe(cityKey('LaPine'))
    expect(cityKey('la pine')).toBe('LAPINE')
    expect(cityKey('Sun River')).toBe(cityKey('Sunriver'))
    expect(cityKey('  ')).toBeNull()
    expect(cityKey(null)).toBeNull()
  })
})

describe('sparkRelistCheck: on the market', () => {
  it('blocks the proven case: the expired listing key is Active again in Spark', async () => {
    spark.byKey.set(
      '20260120200524195349000000',
      listing('20260120200524195349000000', { StreetNumber: '15', StreetName: 'Franklin', StatusChangeTimestamp: '2026-08-06T21:18:49Z' }),
    )
    const r = await sparkRelistCheck({
      listingKey: '20260120200524195349000000',
      keyIsProspectListing: true,
      streetAddress: '15 Franklin',
      city: 'Bend',
    })
    expect(r).toMatchObject({
      relisted: true,
      verifyFailed: false,
      blockedStatus: 'Active',
      blockedKey: '20260120200524195349000000',
      blockedDate: '2026-08-06',
    })
    expect(r.reason).toMatch(/20260120200524195349000000 is Active since 2026-08-06/)
  })

  it('blocks the Greenmont shape: expired key still Expired, the same address Active under a new key', async () => {
    spark.byKey.set(
      '20250502014809455304000000',
      listing('20250502014809455304000000', {
        StandardStatus: 'Expired',
        StreetNumber: '20873',
        StreetName: 'Greenmont',
        PostalCode: '97702',
        StatusChangeTimestamp: '2026-07-05T05:00:00Z',
      }),
    )
    spark.address = [
      listing('20260706204435299456000000', {
        StreetNumber: '20873',
        StreetName: 'Greenmont',
        PostalCode: '97702',
        StatusChangeTimestamp: '2026-07-06T21:24:39Z',
        OnMarketDate: '2026-07-06T21:24:39Z',
      }),
    ]
    const r = await sparkRelistCheck({
      listingKey: '20250502014809455304000000',
      keyIsProspectListing: true,
      streetAddress: '20873 Greenmont',
      city: 'Bend',
      soldAfter: '2026-07-05T05:00:00Z',
    })
    expect(r).toMatchObject({
      relisted: true,
      blockedStatus: 'Active',
      blockedKey: '20260706204435299456000000',
      blockedDate: '2026-07-06',
    })
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
    expect(r).toEqual(CLEAR)
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
})

describe('sparkRelistCheck: the city is matched loosely, not by Spark', () => {
  const lapine = (city: string) => listing('LP1', { StreetNumber: '16111', StreetName: 'Lava', City: city, PostalCode: '97739' })

  it('asks Spark by street number alone, so a city spelling cannot empty the answer', async () => {
    await sparkRelistCheck({ listingKey: 'K', streetAddress: '16111 Lava Dr', city: 'LaPine' })
    const address = spark.calls.find((c) => c.kind === 'address')!
    expect(address.arg).toBe(
      `StreetNumber Eq '16111' And (StandardStatus Eq 'Active' Or StandardStatus Eq 'Active Under Contract' Or StandardStatus Eq '${COMING_SOON_STATUS}' Or StandardStatus Eq 'Pending')`,
    )
    expect(address.arg).not.toMatch(/City/)
    expect(address.limit).toBe(1000)
  })

  it('"LaPine" on our record finds the La Pine listing', async () => {
    spark.address = [lapine('La Pine')]
    const r = await sparkRelistCheck({ listingKey: null, streetAddress: '16111 Lava Dr', city: 'LaPine' })
    expect(r).toMatchObject({ relisted: true, blockedKey: 'LP1' })
  })

  it('"Sun River" on our record finds the Sunriver listing', async () => {
    spark.address = [listing('SR1', { StreetNumber: '57655', StreetName: 'Aspen', City: 'Sunriver', PostalCode: '97707' })]
    const r = await sparkRelistCheck({ listingKey: null, streetAddress: '57655 Aspen Ln', city: 'Sun River' })
    expect(r.relisted).toBe(true)
  })

  it('the ZIP matches when the city names differ', async () => {
    spark.address = [lapine('La Pine')]
    const r = await sparkRelistCheck({ listingKey: null, streetAddress: '16111 Lava Dr', city: 'Deschutes River Woods', postalCode: '97739-1234' })
    expect(r.relisted).toBe(true)
  })

  it('the same street and number in another city does not block', async () => {
    spark.address = [listing('RDM', { StreetNumber: '16111', StreetName: 'Lava', City: 'Redmond', PostalCode: '97756' })]
    const r = await sparkRelistCheck({ listingKey: null, streetAddress: '16111 Lava Dr', city: 'La Pine', postalCode: '97739' })
    expect(r).toEqual(CLEAR)
  })

  it('a record with no city and no ZIP blocks on the street match (the safe side)', async () => {
    spark.address = [listing('RDM', { StreetNumber: '16111', StreetName: 'Lava', City: 'Redmond', PostalCode: '97756' })]
    const r = await sparkRelistCheck({ listingKey: null, streetAddress: '16111 Lava Dr', city: null })
    expect(r.relisted).toBe(true)
  })
})

describe('sparkRelistCheck: a sale blocks only when it is news', () => {
  const nineteenth = listing('20200227022945350309000000', {
    StandardStatus: 'Closed',
    StreetNumber: '2804',
    StreetName: '19th',
    City: 'Redmond',
    PostalCode: '97756',
    CloseDate: '2004-10-20',
    StatusChangeTimestamp: '2004-10-21T21:09:03Z',
  })

  it('an FSBO CMA subject that sold in 2004 does not block (the review case, cma-2804-nw-19th-redmond-97756)', async () => {
    spark.byKey.set('20200227022945350309000000', nineteenth)
    const r = await sparkRelistCheck({
      listingKey: '20200227022945350309000000',
      streetAddress: '2804 NW 19th St',
      city: 'Redmond',
      now: NOW,
    })
    expect(r).toEqual({ ...CLEAR, closeDate: '2004-10-20' })
  })

  it('with the FSBO detect date, a 2004 sale does not block either', async () => {
    spark.byKey.set('20200227022945350309000000', nineteenth)
    const r = await sparkRelistCheck({
      listingKey: '20200227022945350309000000',
      streetAddress: '2804 NW 19th St',
      city: 'Redmond',
      soldAfter: '2026-08-01T00:00:00Z',
      now: NOW,
    })
    expect(r.relisted).toBe(false)
    expect(r.closeDate).toBe('2004-10-20')
  })

  it('a close on or after the off-market day blocks, with the close date', async () => {
    spark.byKey.set('K', listing('K', { StandardStatus: 'Closed', CloseDate: '2026-09-12' }))
    const r = await sparkRelistCheck({ listingKey: 'K', streetAddress: '2745 Ordway', city: 'Bend', soldAfter: '2026-08-06', now: NOW })
    expect(r).toMatchObject({ relisted: true, blockedStatus: 'Closed', blockedKey: 'K', blockedDate: '2026-09-12', closeDate: '2026-09-12' })
  })

  it('a close before the off-market day is an older chapter', async () => {
    spark.byKey.set('K', listing('K', { StandardStatus: 'Closed', CloseDate: '2025-02-01' }))
    const r = await sparkRelistCheck({ listingKey: 'K', streetAddress: '2745 Ordway', city: 'Bend', soldAfter: '2026-08-06', now: NOW })
    expect(r.relisted).toBe(false)
  })

  it(`with no off-market day, a sale inside 12 months blocks and an older one does not`, async () => {
    spark.byKey.set('K', listing('K', { StandardStatus: 'Closed', CloseDate: '2025-11-01' }))
    expect((await sparkRelistCheck({ listingKey: 'K', streetAddress: '2745 Ordway', city: 'Bend', now: NOW })).relisted).toBe(true)
    spark.byKey.set('K', listing('K', { StandardStatus: 'Closed', CloseDate: '2025-09-01' }))
    expect((await sparkRelistCheck({ listingKey: 'K', streetAddress: '2745 Ordway', city: 'Bend', now: NOW })).relisted).toBe(false)
  })

  it("the prospect's own expired listing closing blocks whatever its close date (a late-reported sale)", async () => {
    spark.byKey.set('K', listing('K', { StandardStatus: 'Closed', CloseDate: '2026-07-30' }))
    const r = await sparkRelistCheck({
      listingKey: 'K',
      keyIsProspectListing: true,
      streetAddress: '2745 Ordway',
      city: 'Bend',
      soldAfter: '2026-08-06',
      now: NOW,
    })
    expect(r).toMatchObject({ relisted: true, blockedStatus: 'Closed', closeDate: '2026-07-30' })
  })

  it('a Closed subject with no date at all cannot be judged: row failure', async () => {
    spark.byKey.set('K', listing('K', { StandardStatus: 'Closed', CloseDate: null, StatusChangeTimestamp: null }))
    const r = await sparkRelistCheck({ listingKey: 'K', streetAddress: '2745 Ordway', city: 'Bend', now: NOW })
    expect(r).toMatchObject({ relisted: false, verifyFailed: true, failureScope: 'row' })
  })
})

describe('sparkRelistCheck: failing closed, and whose failure it is', () => {
  it('asks for the subject by key and the on-market listings at the address, fields limited, no 429 wait, 404 is an error', async () => {
    await sparkRelistCheck({ listingKey: 'K', streetAddress: '2745 Ordway', city: 'Bend' })
    expect(spark.calls.map((c) => c.kind).sort()).toEqual(['address', 'key'])
    for (const c of spark.calls) expect(c.select).toBe(SELECT)
    const address = spark.calls.find((c) => c.kind === 'address')!
    expect(address.retryOn429).toBe(false)
    expect(address.notFoundAsError).toBe(true)
  })

  it('a subject Spark does not know (404) leaves the address check to decide', async () => {
    const r = await sparkRelistCheck({ listingKey: 'GONE', streetAddress: '2745 Ordway', city: 'Bend' })
    expect(r).toEqual(CLEAR)
  })

  it('a 404 on the search is a failure of Spark, not an empty answer', async () => {
    spark.addressError = new Error('Spark API error 404: Not Found')
    const r = await sparkRelistCheck({ listingKey: null, streetAddress: '2745 Ordway', city: 'Bend' })
    expect(r).toMatchObject({ relisted: false, verifyFailed: true, failureScope: 'global' })
  })

  it('a 403 on a listing we may not read is this row\'s failure', async () => {
    spark.byKeyError = new Error('Spark API error 403: You do not have permission')
    const r = await sparkRelistCheck({ listingKey: 'K', streetAddress: '2745 Ordway', city: 'Bend' })
    expect(r).toMatchObject({ relisted: false, verifyFailed: true, failureScope: 'row' })
    expect(r.reason).toMatch(/403/)
  })

  it('a 429 is global (every row would fail the same way)', async () => {
    spark.addressError = new Error('Spark API error 429: rate limited')
    const r = await sparkRelistCheck({ listingKey: 'K', streetAddress: '2745 Ordway', city: 'Bend' })
    expect(r).toMatchObject({ relisted: false, verifyFailed: true, failureScope: 'global' })
  })

  it('no answer in time is global', async () => {
    spark.byKeyHang = true
    const t0 = Date.now()
    const r = await sparkRelistCheck({ listingKey: 'K', streetAddress: '2745 Ordway', city: 'Bend' }, { timeoutMs: 30 })
    expect(r).toMatchObject({ relisted: false, verifyFailed: true, failureScope: 'global' })
    expect(r.reason).toMatch(/timed out/)
    expect(Date.now() - t0).toBeLessThan(2000)
  })

  it('more listings at the number than one page shows is this row\'s failure', async () => {
    spark.address = [ordway('K209', '209')]
    spark.addressTotal = 1001
    const r = await sparkRelistCheck({ listingKey: null, streetAddress: '2745 Ordway #311', city: 'Bend' })
    expect(r).toMatchObject({ verifyFailed: true, failureScope: 'row' })
  })

  it('no Spark key is global and asks nothing', async () => {
    process.env.SPARK_API_KEY = ''
    const r = await sparkRelistCheck({ listingKey: 'K', streetAddress: '2745 Ordway', city: 'Bend' })
    expect(r).toMatchObject({ verifyFailed: true, failureScope: 'global' })
    expect(spark.calls).toEqual([])
  })

  it('no listing key and no street number fails closed for the row (it used to read as clear)', async () => {
    const r = await sparkRelistCheck({ listingKey: null, streetAddress: 'Ordway', city: 'Bend' })
    expect(r).toMatchObject({ relisted: false, verifyFailed: true, failureScope: 'row' })
    expect(spark.calls).toEqual([])
  })
})
