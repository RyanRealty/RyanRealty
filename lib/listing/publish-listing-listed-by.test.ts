import { describe, expect, it } from 'vitest'
import { publishListingListedBy } from './publish-listing-listed-by'

describe('publishListingListedBy', () => {
  it('909 Delaware: agent, office, and phone', () => {
    expect(
      publishListingListedBy({
        listAgentName: 'Matt Johnson',
        listOfficeName: 'RE/MAX Key Properties',
        listAgentPhone: '541-480-2153',
      }),
    ).toBe('Listed by Matt Johnson, RE/MAX Key Properties · 541-480-2153')
  })

  it('withholds when no agent or office is published', () => {
    expect(publishListingListedBy({ listAgentName: null, listOfficeName: null })).toBeNull()
  })

  it('keeps the agent when the office is missing', () => {
    expect(publishListingListedBy({ listAgentName: 'Matt Johnson' })).toBe('Listed by Matt Johnson')
  })
})
