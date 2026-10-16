import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildSearchFilters } from '@/app/search/[...slug]/page-filters'
import type { ListingTile } from '@/lib/data/types/listing'
import { ALL_SEARCH_URL_PARAMS } from '@/lib/search/field-registry'
import { listingTileHref } from '@/lib/slug'
import {
  applyHomeSearchTurn,
  cardFromTile,
  FAIR_HOUSING_BAN_RE,
  homeSearchCaptureTags,
  homeSearchDalFilter,
  homeSearchSeeAllHref,
  looksLikeHomeSearch,
  parseHomeSearch,
  runHomeSearch,
  type HomeSearchState,
} from './home-search'

const PAGE_OWNED = new Set(['city', 'subdivision', 'status', 'propertyType', 'propertySubType', 'postalCode'])

function tile(partial: Partial<ListingTile> & Pick<ListingTile, 'listingKey'>): ListingTile {
  return {
    listNumber: null,
    status: 'Active',
    listPrice: null,
    closePrice: null,
    closeDate: null,
    beds: null,
    baths: null,
    sqft: null,
    streetNumber: null,
    streetName: null,
    city: null,
    citySlug: null,
    postalCode: null,
    subdivisionName: null,
    subdivisionSlug: null,
    lat: null,
    lng: null,
    photoUrl: null,
    propertyType: 'A',
    propertySubType: 'Single Family Residence',
    onMarketDate: null,
    modifiedAt: null,
    pricePerSqft: null,
    lotSizeAcres: null,
    yearBuilt: null,
    garageSpaces: null,
    poolYn: null,
    hasVirtualTour: null,
    tourUrl: null,
    dom: null,
    priceDropCount: null,
    addressSlug: null,
    boundaryCity: null,
    boundaryNeighborhood: null,
    boundarySubdivision: null,
    ...partial,
  }
}

const SISTERS_PHRASE = "I'm looking for three bedrooms in Sisters"

const SISTERS_HOMES: ListingTile[] = [
  tile({
    listingKey: 'sis-1',
    listNumber: '220111111',
    listPrice: 625000,
    beds: 3,
    baths: 2,
    sqft: 1840,
    streetNumber: '150',
    streetName: 'W Hood',
    streetSuffix: 'Ave',
    city: 'Sisters',
    photoUrl: 'https://photos.example/sis-1.jpg',
  }),
  tile({
    listingKey: 'sis-2',
    listNumber: '220111112',
    listPrice: 749000,
    beds: 3,
    baths: 2.5,
    sqft: 2102,
    streetNumber: '714',
    streetName: 'Wrangler',
    streetSuffix: 'Ct',
    city: 'Sisters',
    photoUrl: 'https://photos.example/sis-2.jpg',
  }),
  tile({
    listingKey: 'sis-3',
    listNumber: '220111113',
    listPrice: 589000,
    beds: 3,
    baths: 2,
    sqft: 1650,
    streetNumber: '201',
    streetName: 'E Cascade',
    streetSuffix: 'Ave',
    city: 'Sisters',
    photoUrl: 'https://photos.example/sis-3.jpg',
  }),
]

describe('Sarah home search', () => {
  it('parses three bedrooms in Sisters into filters, cards, and a prefilled URL', async () => {
    const parsed = parseHomeSearch(SISTERS_PHRASE)
    expect(parsed.beds).toBe('3')
    expect(parsed.city).toBe('Sisters')
    expect(looksLikeHomeSearch(SISTERS_PHRASE)).toBe(true)

    const filter = homeSearchDalFilter(parsed)
    expect(filter.status).toBe('active')
    expect(filter.city).toBe('Sisters')
    expect(filter.bedsMin).toBe(3)

    const href = homeSearchSeeAllHref(parsed)
    expect(href).toBe('/homes-for-sale/sisters?beds=3')

    const turn = await runHomeSearch(SISTERS_PHRASE, {
      search: async () => ({ rows: SISTERS_HOMES, totalCount: 12 }),
    })
    expect(turn.cards).toHaveLength(3)
    expect(turn.seeAll?.href).toBe('/homes-for-sale/sisters?beds=3')
    expect(turn.seeAll?.label).toBe('See all 12 homes')
    expect(turn.reply).toMatch(/12 active homes/)
    expect(turn.reply).toMatch(/3\+ beds/i)
    expect(turn.reply).toMatch(/Sisters/)
    expect(turn.reply).toMatch(/budget/i)
    expect(turn.voiceSummary).toMatch(/12 active homes/)
    expect(turn.voiceSummary.length).toBeLessThan(turn.reply.length)
    expect(turn.reply).not.toMatch(FAIR_HOUSING_BAN_RE)
    expect(turn.next.criteria.beds).toBe('3')
    expect(turn.next.criteria.city).toBe('Sisters')

    const first = turn.cards[0]
    expect(first?.photoUrl).toBe('https://photos.example/sis-1.jpg')
    expect(first?.price).toBe('$625,000')
    expect(first?.beds).toBe(3)
    expect(first?.baths).toBe(2)
    expect(first?.sqft).toBe(1840)
    expect(first?.address).toMatch(/Hood/)
    expect(first?.address).toMatch(/Sisters/)
    expect(first?.href).toBe(
      listingTileHref({
        listingKey: 'sis-1',
        listNumber: '220111111',
        streetNumber: '150',
        streetName: 'W Hood',
        city: 'Sisters',
      }),
    )
    expect(cardFromTile(SISTERS_HOMES[0])?.href).toBe(first?.href)
  })

  it('says so on zero matches and offers a widened area URL', async () => {
    const turn = await runHomeSearch(SISTERS_PHRASE, {
      search: async () => ({ rows: [], totalCount: 0 }),
    })
    expect(turn.cards).toEqual([])
    expect(turn.reply).toMatch(/didn't find any active homes/i)
    expect(turn.reply).toMatch(/widen/i)
    expect(turn.seeAll?.href).toBe('/homes-for-sale/sisters')
    expect(turn.seeAll?.label).toMatch(/See homes in Sisters/)
    expect(turn.voiceSummary).toMatch(/No active homes/)
    expect(turn.reply).not.toMatch(FAIR_HOUSING_BAN_RE)
  })

  it('opens the search page with the same beds and city filters', () => {
    const href = homeSearchSeeAllHref(parseHomeSearch(SISTERS_PHRASE))
    const url = new URL(href, 'https://ryan-realty.com')
    expect(url.pathname).toBe('/homes-for-sale/sisters')
    expect(url.searchParams.get('beds')).toBe('3')
    for (const key of url.searchParams.keys()) {
      expect(ALL_SEARCH_URL_PARAMS.includes(key) || PAGE_OWNED.has(key)).toBe(true)
    }
    const { filterOpts } = buildSearchFilters({
      sp: { beds: url.searchParams.get('beds') ?? undefined },
      city: 'Sisters',
      decodedSubdivision: undefined,
      neighborhood: undefined,
      preset: null,
    })
    expect(filterOpts.minBeds).toBe(3)
    expect(filterOpts.city).toBe('Sisters')
  })

  it('does not treat listing-fact or chip-only lines as a home search', () => {
    expect(looksLikeHomeSearch('when was the shop built')).toBe(false)
    expect(looksLikeHomeSearch("I'm looking for a home")).toBe(false)
    expect(looksLikeHomeSearch('how many bedrooms')).toBe(false)
    expect(looksLikeHomeSearch(SISTERS_PHRASE)).toBe(true)
  })

  it('asks one follow-up, then offers alerts and a broker, then captures', () => {
    const state: HomeSearchState = {
      step: 'followup',
      followUp: 'budget',
      criteria: {
        parsed: { beds: '3', city: 'Sisters' },
        city: 'Sisters',
        beds: '3',
        areaLabel: 'Sisters',
      },
      answers: {},
      totalCount: 12,
      seeAllHref: '/homes-for-sale/sisters?beds=3',
    }
    const follow = applyHomeSearchTurn(state, 'around 600k', 'Matt')
    expect(follow.next.step).toBe('offers')
    expect(follow.next.answers.budget).toBe('around 600k')
    expect(follow.reply).toMatch(/listing alerts/)
    expect(follow.reply).toMatch(/Matt/)
    expect(follow.chips?.map((c) => c.label)).toEqual([
      'Listing alerts',
      'Connect me',
      'Alerts and a broker',
      'No thanks',
    ])
    const name = applyHomeSearchTurn(follow.next, 'Alerts and a broker', 'Matt')
    expect(name.next.step).toBe('name')
    const contact = applyHomeSearchTurn(name.next, 'Alex Rivera', 'Matt')
    const saved = applyHomeSearchTurn(contact.next, 'alex@example.com', 'Matt')
    expect(saved.capture).toBe(true)
    expect(saved.next.answers).toMatchObject({
      name: 'Alex Rivera',
      email: 'alex@example.com',
      budget: 'around 600k',
    })
    expect(homeSearchCaptureTags(saved.next)).toEqual(
      expect.arrayContaining([
        'captured:by-sarah',
        'audience:buyer',
        'area:sisters',
        'beds:3',
        'budget:around-600k',
      ]),
    )
  })
})

describe('Sarah home search wiring', () => {
  it('hooks the chat action and the web panel', () => {
    const action = readFileSync(resolve('app/actions/sarah-chat.ts'), 'utf8')
    const panel = readFileSync(resolve('components/site/v3/V3SarahAssistant.client.tsx'), 'utf8')
    expect(action).toContain('runHomeSearch')
    expect(action).toContain('looksLikeHomeSearch')
    expect(panel).toContain('looksLikeHomeSearch')
    expect(panel).toContain('SarahHomeSearchCards')
    expect(panel).toContain('applyHomeSearchTurn')
  })
})
