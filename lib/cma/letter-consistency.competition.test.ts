import { describe, expect, it } from 'vitest'
import { evaluateLetterConsistencyContract } from '@/lib/cma/letter-consistency'
import { competitionBodyMatrixHtml } from '@/lib/cma/opinion-pages'
import type { OpinionPageArgs } from '@/lib/cma/opinion-pages'
import type { CmaPricing, CmaSubject } from '@/lib/cma/types'

const pricing = { recommended: 1_414_000, valueLow: 1_132_767, valueHigh: 1_529_585 }

function check(html: string) {
  return evaluateLetterConsistencyContract({
    html,
    names: null,
    identity: null,
    pricing,
  }).checks.find((c) => c.id === 'competition-homes-are-drawn')
}

describe('competition count is the homes on the page', () => {
  it('refuses a chapter that counts a home for sale and draws none', () => {
    const drawn = check(`
      <h2>Who you would compete with at this price</h2>
      <p>1 home is for sale in Awbrey Village between $1,273,000 and $1,555,000. None are under contract right now.</p>
      <p class="small">Homes for sale and under contract in Awbrey Village.</p>
      <h2>What price and time look like in Bend.</h2>
    `)
    expect(drawn?.pass).toBe(false)
    expect(drawn?.detail).toContain('does not show')
  })

  it('passes when the counted home is in the active matrix', () => {
    const drawn = check(`
      <h2>Who you would compete with at this price</h2>
      <p>1 home is for sale in Awbrey Village between $1,273,000 and $1,555,000. None are under contract right now.</p>
      <h3 class="subhead">Active: asking in this range now</h3>
      <h2>What price and time look like in Bend.</h2>
    `)
    expect(drawn?.pass).toBe(true)
  })

  it('passes a letter that has no competition chapter', () => {
    expect(check('<h2>What this home is worth</h2><p>The sales set the price.</p>')?.pass).toBe(true)
  })

  it('refuses a pending count with no pending matrix', () => {
    const drawn = check(`
      <h2>Who you would compete with at this price</h2>
      <p>0 homes are for sale between $400,000 and $480,000. 1 is under contract.</p>
      <h2>Next</h2>
    `)
    expect(drawn?.pass).toBe(false)
    expect(drawn?.detail).toContain('under contract')
  })
})

describe('the competition chapter draws the home it counts', () => {
  const subject = {
    listingKey: 'S',
    mlsNumber: '1',
    streetAddress: '1195 Remarkable',
    city: 'Bend',
    state: 'OR',
    postalCode: '97703',
    subdivision: 'Awbrey Village',
    latitude: 44.08554,
    longitude: -121.325841,
    beds: 3,
    baths: 5,
    sqft: 3603,
    lotAcres: 0.54,
    propertySubType: 'Single Family Residence',
    yearBuilt: 2004,
    photoUrl: null,
    standardStatus: 'Expired',
    lastListPrice: 1_599_000,
  } as CmaSubject

  const pricing = {
    recommended: 1_414_000,
    valueLow: 1_132_767,
    valueHigh: 1_529_585,
    notes: [],
  } as unknown as CmaPricing

  it('prints a two-bedroom-apart listing when it is the only home in the band', () => {
    const html = competitionBodyMatrixHtml({
      subject,
      comps: [],
      pricing,
      generatedAtIso: '2026-10-05T16:22:27.000Z',
      compArea: {
        kind: 'subdivision',
        names: ['Awbrey Village'],
        radiusMiles: null,
        centre: { lat: 44.08554, lng: -121.325841 },
        source: 'test',
        sentence: 'Awbrey Village.',
      },
      bandRivals: {
        area: {
          kind: 'subdivision',
          names: ['Awbrey Village'],
          radiusMiles: null,
          centre: { lat: 44.08554, lng: -121.325841 },
          source: 'test',
          sentence: 'Awbrey Village.',
        },
        lo: 1_273_000,
        hi: 1_555_000,
        activeCount: 1,
        pendingCount: 0,
        rivals: [
          {
            listingKey: 'FAR',
            address: '9 Far Beds',
            listPrice: 1_495_000,
            status: 'Active',
            daysOnMarket: 20,
            photoUrl: null,
            latitude: 44.081876,
            longitude: -121.322461,
            beds: 5,
            baths: 6,
            sqft: 4170,
            propertySubType: 'Single Family Residence',
            subdivision: 'Awbrey Village',
          },
        ],
        sentence:
          '1 home is for sale in Awbrey Village between $1,273,000 and $1,555,000. None are under contract right now.',
        source: 'Homes for sale and under contract in Awbrey Village.',
      },
    } as unknown as OpinionPageArgs)
    expect(html).toContain('9 Far Beds')
    expect(html).toContain('1 home is for sale in Awbrey Village')
    expect(html).toContain('Active: asking in this range now')
    expect(evaluateLetterConsistencyContract({ html, names: null, identity: null, pricing }).checks.find(
      (c) => c.id === 'competition-homes-are-drawn',
    )?.pass).toBe(true)
  })
})
