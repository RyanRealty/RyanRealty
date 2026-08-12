import { describe, it, expect } from 'vitest'
import { mapPersonWhoLabels, PERSON_WHO_LABELS, type PersonWhoLabel } from './person-who-labels'

describe('mapPersonWhoLabels', () => {
  it('maps audience:buyer to Buyer', () => {
    expect(mapPersonWhoLabels({ tags: ['audience:buyer'] })).toEqual(['Buyer'])
  })

  it('maps audience:seller to Seller', () => {
    expect(mapPersonWhoLabels({ tags: ['audience:seller'] })).toEqual(['Seller'])
  })

  it('maps expired tags onto Expired listing', () => {
    expect(mapPersonWhoLabels({ tags: ['intent:expired-listing'] })).toEqual(['Expired listing'])
    expect(mapPersonWhoLabels({ tags: ['seller:expired'] })).toEqual(['Expired listing'])
    expect(mapPersonWhoLabels({ tags: ['seller:expired-untouched'] })).toEqual(['Expired listing'])
    expect(mapPersonWhoLabels({ tags: ['segment:expired'] })).toEqual(['Expired listing'])
  })

  it('maps FSBO tags onto FSBO', () => {
    expect(mapPersonWhoLabels({ tags: ['intent:fsbo'] })).toEqual(['FSBO'])
    expect(mapPersonWhoLabels({ tags: ['seller:fsbo'] })).toEqual(['FSBO'])
    expect(mapPersonWhoLabels({ tags: ['source:fsbo-lp'] })).toEqual(['FSBO'])
  })

  it('dual-intent: expired owner looking at homes is Expired listing + Buyer', () => {
    expect(
      mapPersonWhoLabels({
        tags: ['intent:expired-listing'],
        hasRecentListingView: true,
      }),
    ).toEqual(['Expired listing', 'Buyer'])
  })

  it('dual-intent: buyer + seller tags is two labels, not a sixth type', () => {
    const labels = mapPersonWhoLabels({ tags: ['audience:buyer', 'audience:seller'] })
    expect(labels).toEqual(['Buyer', 'Seller'])
    expect(labels.every((l) => (PERSON_WHO_LABELS as readonly string[]).includes(l))).toBe(true)
  })

  it('ignores unknown tags', () => {
    expect(
      mapPersonWhoLabels({
        tags: ['broker:matt', 'source:cma-request', 'farm:westside', 'channel:facebook', 'nurture'],
      }),
    ).toEqual([])
  })

  it('never returns a label outside the closed set', () => {
    const labels = mapPersonWhoLabels({
      tags: [
        'audience:buyer',
        'audience:seller',
        'intent:expired-listing',
        'intent:fsbo',
        'Hot Lead',
        'sphere',
        'realtor',
        'industry:realtor',
      ],
      stage: 'Active Client',
      prospectKinds: ['expired', 'fsbo'],
      hasRecentListingView: true,
    })
    expect(labels.every((l) => (PERSON_WHO_LABELS as readonly PersonWhoLabel[]).includes(l))).toBe(true)
    expect(labels).toEqual(['Expired listing', 'FSBO', 'Buyer', 'Seller', 'Client'])
  })

  it('maps prospect story expired / fsbo without requiring tags', () => {
    expect(mapPersonWhoLabels({ prospectKinds: ['expired'] })).toEqual(['Expired listing'])
    expect(mapPersonWhoLabels({ prospectKinds: ['fsbo'] })).toEqual(['FSBO'])
    expect(mapPersonWhoLabels({ prospectKinds: ['expired', 'fsbo'] })).toEqual(['Expired listing', 'FSBO'])
  })

  it('maps client stages onto Client', () => {
    expect(mapPersonWhoLabels({ stage: 'Active Client' })).toEqual(['Client'])
    expect(mapPersonWhoLabels({ stage: 'Past Client' })).toEqual(['Client'])
    expect(mapPersonWhoLabels({ stage: 'Pending' })).toEqual(['Client'])
  })

  it('maps Seller Prospect and renter-future-buyer stages', () => {
    expect(mapPersonWhoLabels({ stage: 'Seller Prospect' })).toEqual(['Seller'])
    expect(mapPersonWhoLabels({ stage: 'Renter - future buyer' })).toEqual(['Buyer'])
  })

  it('does not invent a sixth type for dual-intent', () => {
    const labels = mapPersonWhoLabels({
      tags: ['intent:expired-listing'],
      hasRecentListingView: true,
    })
    expect(labels).toEqual(['Expired listing', 'Buyer'])
    expect(labels).not.toContain('Expired buyer')
    expect(labels).not.toContain('Looking at homes')
  })

  it('returns labels in closed-set order', () => {
    expect(
      mapPersonWhoLabels({
        tags: ['audience:seller', 'intent:fsbo', 'audience:buyer', 'intent:expired-listing'],
        stage: 'Active Client',
      }),
    ).toEqual(['Expired listing', 'FSBO', 'Buyer', 'Seller', 'Client'])
  })

  it('empty input returns no labels', () => {
    expect(mapPersonWhoLabels({})).toEqual([])
    expect(mapPersonWhoLabels({ tags: [], stage: 'Lead' })).toEqual([])
  })
})
