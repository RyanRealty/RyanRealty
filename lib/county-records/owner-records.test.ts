import { describe, expect, it } from 'vitest'
import { buildOwnerWhere, parseOwnerResponse, whereToken } from './owner-records'

// Every name below is invented for the test.

describe('whereToken', () => {
  it('keeps only A-Z and 0-9, so nothing typed reaches the county SQL', () => {
    expect(whereToken("O'Darragh")).toBe('ODARRAGH')
    expect(whereToken("x' OR 1=1 --")).toBe('XOR11')
    expect(whereToken('Renée')).toBe('RENEE')
    expect(whereToken('J')).toBeNull()
  })
})

describe('buildOwnerWhere', () => {
  const q = {
    names: [{ first: 'Jane', last: 'Pellworth' }],
    addresses: [{ number: '2347', streetWord: 'Larkspur' }],
    accounts: ['101105', "1'; DROP TABLE x;--"],
  }

  it('Deschutes: owner words, house number + street word, and accounts by id', () => {
    expect(buildOwnerWhere('deschutes', q)).toBe(
      "(UPPER(dbo_GIS_MAILING.OWNER) LIKE '%PELLWORTH%' AND UPPER(dbo_GIS_MAILING.OWNER) LIKE '%JANE%')" +
        " OR (Taxlot_Assessor_Account.House_Number = '2347' AND UPPER(Taxlot_Assessor_Account.Address) LIKE '%LARKSPUR%')" +
        " OR dbo_GIS_MAILING.ACCOUNT_ID IN ('101105')",
    )
  })

  it('Crook: owner words and site address, never accounts', () => {
    expect(buildOwnerWhere('crook', q)).toBe(
      "(UPPER(OWNER_NAME) LIKE '%PELLWORTH%' AND UPPER(OWNER_NAME) LIKE '%JANE%') OR (SITUS_ADDRESS LIKE '2347 %LARKSPUR%')",
    )
  })

  it('nothing searchable is null', () => {
    expect(buildOwnerWhere('deschutes', { names: [{ first: 'J', last: 'P' }], addresses: [{ number: 'PO', streetWord: 'Box' }], accounts: [] })).toBeNull()
  })
})

describe('parseOwnerResponse', () => {
  it('reads Deschutes features, one record per account, with the DIAL link', () => {
    const out = parseOwnerResponse('deschutes', {
      features: [
        {
          attributes: {
            'dbo_GIS_MAILING.ACCOUNT_ID': '101105',
            'dbo_GIS_MAILING.OWNER': 'PELLWORTH, JANE B',
            'Taxlot_Assessor_Account.TAXLOT': '171228AB00100',
            'Taxlot_Assessor_Account.Address': '2347 NW LARKSPUR PL',
            'Taxlot_Assessor_Account.Unit_Number': '',
            'Taxlot_Assessor_Account.City': 'BEND',
            'Taxlot_Assessor_Account.Zip': '97703',
            'dbo_GIS_MAILING.M_ADDRESS': '2347 NW LARKSPUR PL',
            'dbo_GIS_MAILING.M_CITY': 'BEND',
            'dbo_GIS_MAILING.M_STATE': 'OR',
            'dbo_GIS_MAILING.M_ZIP': '97703',
          },
        },
        { attributes: { 'dbo_GIS_MAILING.ACCOUNT_ID': '101105', 'dbo_GIS_MAILING.OWNER': 'PELLWORTH, JANE B' } },
        { attributes: { 'dbo_GIS_MAILING.ACCOUNT_ID': '101106', 'dbo_GIS_MAILING.OWNER': '' } },
      ],
      exceededTransferLimit: true,
    })
    expect(out.truncated).toBe(true)
    expect(out.records).toHaveLength(1)
    expect(out.records[0]).toMatchObject({
      account: '101105',
      ownerRaw: 'PELLWORTH, JANE B',
      situsUnit: null,
      situsCity: 'BEND',
      recordUrl: 'https://dial.deschutes.org/Real/Index/101105',
    })
  })

  it('reads Crook features and keeps only the county tax-card link', () => {
    const out = parseOwnerResponse('crook', {
      features: [
        { attributes: { ACCOUNT: 16540, OWNER_NAME: 'PELLWORTH JANE B', SITUS_ADDRESS: '644 NE LARKSPUR LN  ', PC_DESC: 'Res Improved', TAX_CARD_LINK: 'https://gis.crookcountyor.gov/taxcards/141632BA02135.pdf' } },
        { attributes: { ACCOUNT: 16541, OWNER_NAME: 'ODERMATT MARTA', TAX_CARD_LINK: 'https://elsewhere.example/x.pdf' } },
      ],
    })
    expect(out.records.map((r) => [r.account, r.situsStreet, r.propertyClass, r.recordUrl])).toEqual([
      ['16540', '644 NE LARKSPUR LN', 'Res Improved', 'https://gis.crookcountyor.gov/taxcards/141632BA02135.pdf'],
      ['16541', null, null, null],
    ])
  })

  it('a county error is thrown, never read as "no records"', () => {
    expect(() => parseOwnerResponse('crook', { error: { code: 400, message: 'Invalid query' } })).toThrow(/Invalid query/)
  })
})
