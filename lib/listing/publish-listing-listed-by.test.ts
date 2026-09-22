import { describe, expect, it } from 'vitest'
import { publishListingListedBy } from './publish-listing-listed-by'

describe('publishListingListedBy', () => {
  it('names the other brokerage and leaves their phone off', () => {
    expect(
      publishListingListedBy({
        listAgentName: 'Matt Johnson',
        listOfficeName: 'RE/MAX Key Properties',
        listAgentPhone: '541-480-2153',
        listOfficePhone: '541-555-0100',
      }),
    ).toBe('Listed by RE/MAX Key Properties')
  })

  it('withholds when another brokerage has no office name', () => {
    expect(
      publishListingListedBy({
        listAgentName: 'Matt Johnson',
        listOfficeName: null,
        listAgentPhone: '541-480-2153',
      }),
    ).toBeNull()
  })

  it('keeps our agent and our phone on a Ryan Realty listing', () => {
    expect(
      publishListingListedBy({
        listAgentName: 'Matthew Ryan',
        listOfficeName: 'Ryan Realty',
        listAgentPhone: '541-213-6706',
        ours: true,
      }),
    ).toBe('Listed by Matthew Ryan, Ryan Realty · 541-213-6706')
  })
})
