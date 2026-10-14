import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Every name and address below is invented for the test.

const tables: Record<string, { data: unknown; error: null | { message: string } }> = {}
const orFilters: string[] = []

function builder(table: string) {
  const result = () => tables[table] ?? { data: [], error: null }
  const b: Record<string, unknown> = {}
  for (const m of ['select', 'eq', 'not', 'order', 'limit', 'in']) b[m] = vi.fn(() => b)
  b.or = vi.fn((f: string) => {
    orFilters.push(f)
    return b
  })
  b.maybeSingle = vi.fn(async () => result())
  b.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => Promise.resolve(result()).then(res, rej)
  return b
}

vi.mock('@/lib/data/client', () => ({ createServiceClient: () => ({ from: (t: string) => builder(t) }) }))
vi.mock('@/lib/data/crm/getContactRelationships', () => ({
  getContactRelationships: vi.fn(async () => [{ id: 1, relatedPersonId: 77, name: 'John Pellworth', type: 'spouse', label: 'Spouse' }]),
}))

import {
  buildContactQuery,
  contactAddressesFrom,
  getCountyOwnershipForPerson,
  westsideOrFilter,
  type WestsideOwnerRow,
} from './getCountyOwnership'
import { parseContactName } from '@/lib/crm/county-owner-match'

const person = {
  id: 42,
  first_name: 'Jane',
  last_name: "O'Pellworth",
  name: "Jane O'Pellworth",
  addresses: [
    { street: '2347 NW Larkspur Pl', city: 'Bend', state: 'OR', code: '97703', type: 'Mailing' },
    { street: '2347 NW Larkspur Place', city: 'Bend', state: 'OR', code: '97703', type: 'Property' },
    { street: 'PO Box 9', city: 'Bend', state: 'OR', code: '97709', type: 'Mailing' },
    { street: '', city: '', state: 'OR' },
  ],
  deleted: false,
}

const westRow = (over: Partial<WestsideOwnerRow> = {}): WestsideOwnerRow => ({
  apn: '101105',
  site_street: '2347 Nw Larkspur Pl',
  site_city: 'Bend',
  site_zip: '97703',
  mail_street: '2347 Nw Larkspur Pl',
  mail_city: 'Bend',
  mail_zip: '97703',
  owner1_first: 'Jane',
  owner1_last: "O'Pellworth",
  owner2_first: 'John',
  owner2_last: "O'Pellworth",
  all_owners: "Jane O'Pellworth and John O'Pellworth",
  purchase_date: '2016-06-30',
  purchase_price: 455000,
  assessed_value: 412350,
  market_value: 689000,
  loaded_at: '2026-07-04T23:11:36.010768+00:00',
  person_id: 42,
  ...over,
})

const deschutesFeature = (account: string, owner: string, address: string, mail = address) => ({
  attributes: {
    'dbo_GIS_MAILING.ACCOUNT_ID': account,
    'dbo_GIS_MAILING.OWNER': owner,
    'Taxlot_Assessor_Account.TAXLOT': '171228AB00100',
    'Taxlot_Assessor_Account.Address': address,
    'Taxlot_Assessor_Account.Unit_Number': '',
    'Taxlot_Assessor_Account.City': 'BEND',
    'Taxlot_Assessor_Account.Zip': '97703',
    'dbo_GIS_MAILING.M_ADDRESS': mail,
    'dbo_GIS_MAILING.M_CITY': 'BEND',
    'dbo_GIS_MAILING.M_STATE': 'OR',
    'dbo_GIS_MAILING.M_ZIP': '97703',
  },
})

let deschutesBody: unknown
let deschutesOk = true
const fetchMock = vi.fn(async (url: string) => {
  if (url.includes('deschutes')) {
    if (!deschutesOk) return new Response('down', { status: 503 })
    return new Response(JSON.stringify(deschutesBody), { status: 200 })
  }
  return new Response(JSON.stringify({ features: [] }), { status: 200 })
})

beforeEach(() => {
  orFilters.length = 0
  fetchMock.mockClear()
  deschutesOk = true
  tables.crm_people = { data: person, error: null }
  tables.crm_deals = { data: [{ property_address: '61000 Brookswood Blvd, Bend, OR 97702' }], error: null }
  tables.westside_parcels = { data: [westRow(), westRow({ apn: '999999', site_street: '2347 Nw Other St', owner1_first: 'Marta', owner1_last: 'Odermatt', owner2_first: null, owner2_last: null, person_id: null })], error: null }
  vi.stubGlobal('fetch', fetchMock)
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('contactAddressesFrom', () => {
  it('keeps street addresses with their labels, dedupes, drops PO boxes and empty rows, adds deals', () => {
    const out = contactAddressesFrom(person.addresses, ['61000 Brookswood Blvd, Bend, OR 97702'])
    expect(out.map((a) => [a.display, a.label])).toEqual([
      ['2347 NW Larkspur Pl, Bend', 'mailing address on their record'],
      ['61000 Brookswood Blvd, Bend', 'property on their deal'],
    ])
    expect(out[1]!.address.zip).toBe('97702')
  })
})

describe('buildContactQuery + westsideOrFilter', () => {
  it('searches the longest letter run of the raw last name and the distinctive street word', () => {
    const identity = parseContactName(person)
    const addresses = contactAddressesFrom(person.addresses)
    const q = buildContactQuery(person, identity, addresses, ['101105'])
    expect(q).toEqual({ names: [{ first: 'JANE', last: 'PELLWORTH' }], addresses: [{ number: '2347', streetWord: 'LARKSPUR' }], accounts: ['101105'] })
    expect(westsideOrFilter(42, q)).toBe(
      'person_id.eq.42,and(owner1_last.ilike."*PELLWORTH*",owner1_first.ilike."JANE*"),and(owner2_last.ilike."*PELLWORTH*",owner2_first.ilike."JANE*"),and(owner1_first.ilike."*JANE*",owner1_first.ilike."*PELLWORTH*"),site_street.ilike."2347 *"',
    )
  })
})

describe('getCountyOwnershipForPerson', () => {
  it('live Deschutes owner + export figures: high, with the county link and the export date', async () => {
    deschutesBody = {
      features: [
        deschutesFeature('101105', "O'PELLWORTH, JANE B & JOHN A", '2347 NW LARKSPUR PL'),
        // A renter's parcel elsewhere that only shares the street number: not theirs, not their address.
        deschutesFeature('555555', 'ODERMATT, MARTA', '2347 NW OTHER ST'),
        // Named, no address of theirs: name match only.
        deschutesFeature('777777', "O'PELLWORTH, JANE", '19000 RIVER WOODS DR', '19000 RIVER WOODS DR'),
      ],
    }
    const out = await getCountyOwnershipForPerson(42, { cache: false })
    expect(out.searchedNames).toEqual(["Jane O'Pellworth"])
    expect(out.counties.map((c) => [c.county, c.status])).toEqual([
      ['deschutes', 'ok'],
      ['crook', 'ok'],
    ])
    expect(out.rows.map((r) => [r.account, r.strength])).toEqual([
      ['101105', 'high'],
      ['777777', 'medium'],
    ])
    const top = out.rows[0]!
    expect(top.recordUrl).toBe('https://dial.deschutes.org/Real/Index/101105')
    expect(top.sourceIsLive).toBe(true)
    expect(top.figures).toEqual({
      assessedValue: 412350,
      marketValue: 689000,
      lastSaleDate: '2016-06-30',
      lastSalePrice: 455000,
      asOf: '2026-07-04T23:11:36.010768+00:00',
      ownerChangedSince: false,
    })
    // The export row on another street never reached the county query.
    const deschutesUrl = String(fetchMock.mock.calls.find((c) => String(c[0]).includes('deschutes'))![0])
    const where = new URL(deschutesUrl).searchParams.get('where') ?? ''
    expect(where).toContain("dbo_GIS_MAILING.ACCOUNT_ID IN ('101105')")
    expect(where).not.toContain('999999')
  })

  it('a parcel sold since the export keeps assessed values but drops the old sale', async () => {
    deschutesBody = { features: [deschutesFeature('101105', 'ODERMATT, MARTA', '2347 NW LARKSPUR PL', '1 ELSEWHERE RD')] }
    const out = await getCountyOwnershipForPerson(42, { cache: false })
    expect(out.rows).toHaveLength(1)
    expect(out.rows[0]).toMatchObject({ strength: 'resident', strengthLabel: 'Not owner of record' })
    expect(out.rows[0]!.figures).toMatchObject({ assessedValue: 412350, lastSaleDate: null, lastSalePrice: null, ownerChangedSince: true })
  })

  it('the owner of record names their spouse: a resident row that says so', async () => {
    deschutesBody = { features: [deschutesFeature('101105', 'PELLWORTH, JOHN A', '2347 NW LARKSPUR PL')] }
    tables.crm_people = { data: { ...person, last_name: 'Pellworth', name: 'Jane Pellworth' }, error: null }
    const out = await getCountyOwnershipForPerson(42, { cache: false })
    expect(out.rows[0]!.explanation).toContain('It names their spouse, John Pellworth.')
  })

  it('Deschutes down: the export stands in, labelled as the export', async () => {
    deschutesOk = false
    const out = await getCountyOwnershipForPerson(42, { cache: false })
    expect(out.counties[0]).toMatchObject({ county: 'deschutes', status: 'unavailable' })
    expect(out.rows.map((r) => [r.account, r.strength, r.sourceIsLive])).toEqual([['101105', 'high', false]])
    expect(out.rows[0]!.source).toBe('Assessor export for west Bend (westside_parcels)')
  })

  it('a deleted or missing contact searches nothing', async () => {
    tables.crm_people = { data: { ...person, deleted: true }, error: null }
    const out = await getCountyOwnershipForPerson(42, { cache: false })
    expect(out.rows).toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('a contact with no full name and no street address searches nothing', async () => {
    tables.crm_people = { data: { ...person, first_name: 'Jane', last_name: null, name: 'Jane', addresses: [] }, error: null }
    tables.crm_deals = { data: [], error: null }
    const out = await getCountyOwnershipForPerson(42, { cache: false })
    expect(out.searchedNames).toEqual([])
    expect(out.counties).toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
