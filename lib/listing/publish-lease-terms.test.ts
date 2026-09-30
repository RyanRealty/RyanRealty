import { describe, expect, it } from 'vitest'
import { publishLeaseTerms } from './publish-lease-terms'

describe('publishLeaseTerms', () => {
  it('prints the lease type, who pays, the zone and the parking as the listing files them', () => {
    expect(
      publishLeaseTerms({
        nnn: true,
        tenantPays: { Sewer: true, Taxes: true, Water: true, Repairs: true, Insurance: true, 'Common Area Maintenance': true },
        zoning: 'COMMERCIAL',
        parking: '100',
      }),
    ).toEqual(['NNN lease', 'Tenant pays taxes, insurance, CAM and 3 more', 'Zoning COMMERCIAL', '100 parking spaces'])
  })

  it('names every expense when there are three or fewer', () => {
    expect(publishLeaseTerms({ gross: true, tenantPays: { Electricity: true, Gas: true } })).toEqual([
      'Gross lease',
      'Tenant pays electricity and gas',
    ])
  })

  it('prints no lease type when two contradict each other, and nothing for blanks', () => {
    expect(publishLeaseTerms({ nnn: true, gross: true, tenantPays: {}, zoning: '  ', parking: 0 })).toEqual([])
    expect(publishLeaseTerms({ nnn: null, parking: '1' })).toEqual(['1 parking space'])
    expect(publishLeaseTerms({ parking: '2.5' })).toEqual([])
  })
})
