import { describe, expect, it } from 'vitest'
import { emptyCompetitionSet } from '@/lib/cma/band-rivals'
import { assembleOpinionPages, competitionPage, didNotSellPage } from '@/lib/cma/opinion-pages'
import type { OpinionPageArgs } from '@/lib/cma/opinion-pages'
import { buildExpiredPeerSet } from '@/lib/cma/market-status'
import type { CmaPricing, CmaSubject } from '@/lib/cma/types'
import type { CompArea } from '@/lib/pricing/comp-area'

/**
 * Foxborough (20653) and Purcell (3711) had no competition section at all.
 * An empty active, pending, or expired search has to say so.
 */
const fiveMiles: CompArea = {
  kind: 'radius',
  names: [],
  radiusMiles: 5,
  centre: { lat: 44.06, lng: -121.31 },
  source: 'test',
  sentence: 'Within five miles of your home.',
}

const bendCity: CompArea = {
  kind: 'city',
  names: ['Bend'],
  radiusMiles: null,
  centre: { lat: 44.06, lng: -121.31 },
  source: 'fell through to the city',
  sentence: 'Bend.',
}

function subject(over: Partial<CmaSubject>): CmaSubject {
  return {
    streetAddress: '20653 Foxborough',
    city: 'Bend',
    state: 'OR',
    postalCode: '97702',
    subdivision: 'Foxborough',
    latitude: 44.06,
    longitude: -121.31,
    beds: 3,
    baths: 2,
    sqft: 1800,
    yearBuilt: 2004,
    standardStatus: 'Expired',
    lastListPrice: 640_000,
    listingKey: 'F1',
    mlsNumber: '1',
    ...over,
  } as CmaSubject
}

const pricing = {
  recommended: 620_000,
  valueLow: 590_000,
  valueHigh: 650_000,
  notes: [],
} as unknown as CmaPricing

describe('empty competition still prints, Foxborough and Purcell', () => {
  it('Foxborough: an empty active and pending search is a sentence, not a missing chapter', () => {
    const set = emptyCompetitionSet({
      rings: [fiveMiles],
      compArea: bendCity,
      lo: 590_000,
      hi: 650_000,
    })
    expect(set.rivals).toEqual([])
    expect(set.activeCount).toBe(0)
    expect(set.pendingCount).toBe(0)
    expect(set.area.kind).not.toBe('city')
    expect(set.sentence).toBe(
      'No home within five miles of your home is for sale between $590,000 and $650,000, and none is under contract. The search did not cover the whole city.',
    )
    expect(set.sentence).not.toMatch(/[—–]/)

    const args = {
      subject: subject({ streetAddress: '20653 Foxborough', subdivision: 'Foxborough' }),
      comps: [],
      pricing,
      bandRivals: set,
      generatedAtIso: '2026-09-25T00:00:00.000Z',
    } as unknown as OpinionPageArgs

    const page = competitionPage(args)
    expect(page).not.toBeNull()
    expect(page?.body).toContain('Who you would compete with at this price')
    expect(page?.body).toContain(set.sentence)
    expect(page?.body).not.toContain('15150 Yellow Pine')

    const pages = assembleOpinionPages(args)
    expect(pages.some((p) => p.body.includes(set.sentence))).toBe(true)

    const missing = competitionPage({ ...args, bandRivals: null, extras: null } as OpinionPageArgs)
    expect(missing).toBeNull()
  })

  it('Purcell: an empty expired search says none came off, including when the subject itself failed', () => {
    const area: CompArea = {
      kind: 'subdivision',
      names: ['Purcell'],
      radiusMiles: null,
      centre: { lat: 44.05, lng: -121.3 },
      source: 'test',
      sentence: 'Purcell, your own subdivision.',
    }
    const peers = buildExpiredPeerSet({
      rows: [],
      subject: {
        beds: 4,
        sqft: 2200,
        latitude: 44.05,
        longitude: -121.3,
        listingKey: 'P1',
        mlsNumber: '2',
        streetAddress: '3711 Purcell',
      },
      area,
      maxWindowMonths: 12,
    })
    expect(peers.count).toBe(0)
    expect(peers.peers).toEqual([])
    expect(peers.sentence).toBe(
      'No home in Purcell came off the market without selling in the last 12 months.',
    )
    expect(peers.sentence).not.toMatch(/[—–]/)

    const page = didNotSellPage({
      subject: subject({
        streetAddress: '3711 Purcell',
        subdivision: 'Purcell',
        standardStatus: 'Expired',
        lastListPrice: 710_000,
      }),
      comps: [],
      pricing,
      expiredPeers: peers,
      generatedAtIso: '2026-09-25T00:00:00.000Z',
    } as unknown as OpinionPageArgs)
    expect(page).not.toBeNull()
    expect(page?.body).toContain(peers.sentence)
    expect(page?.body).toContain('Your own listing')
  })
})
