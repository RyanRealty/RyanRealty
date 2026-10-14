import { describe, expect, it } from 'vitest'
import { searchedLine } from './CountyRecordsSection'
import type { CountyOwnershipResult } from '@/lib/data/crm/getCountyOwnership'

const base: CountyOwnershipResult = {
  personId: 1,
  searchedNames: ['Jane Pellworth'],
  searchedAddresses: ['2347 NW Larkspur Pl, Bend', '61000 Brookswood Blvd, Bend'],
  counties: [
    { county: 'deschutes', label: 'Deschutes County', status: 'ok', readAt: '2026-10-14T20:00:00Z', truncated: false },
    { county: 'crook', label: 'Crook County', status: 'ok', readAt: '2026-10-14T20:00:00Z', truncated: false },
  ],
  snapshotLoadedAt: '2026-07-04T23:11:36Z',
  rows: [],
}

describe('searchedLine', () => {
  it('says what was searched, where, and that Jefferson is not', () => {
    expect(searchedLine(base)).toEqual([
      'Searched Deschutes and Crook County owner records for Jane Pellworth and 2 addresses. Jefferson County publishes no owner records, so a home there will not show.',
    ])
  })

  it('names a county that did not answer, and the export standing in for Deschutes', () => {
    const r = { ...base, counties: [{ ...base.counties[0]!, status: 'unavailable' as const }, base.counties[1]!] }
    expect(searchedLine(r)).toEqual([
      'Searched Crook County owner records for Jane Pellworth and 2 addresses. Jefferson County publishes no owner records, so a home there will not show.',
      'Deschutes County did not answer just now. West Bend rows below come from the assessor export loaded Jul 4, 2026.',
    ])
  })

  it('warns when a common name filled a read', () => {
    const r = { ...base, counties: [{ ...base.counties[0]!, truncated: true }, base.counties[1]!] }
    expect(searchedLine(r)[1]).toBe('Deschutes County matched more records than one read returns, so a parcel under a common name may be missing.')
  })

  it('says there is nothing to search', () => {
    expect(searchedLine({ ...base, searchedNames: [], searchedAddresses: [], counties: [] })).toEqual([
      'Nothing to search: this contact has no first and last name and no street address.',
    ])
  })
})
