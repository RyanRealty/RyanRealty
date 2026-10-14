import { describe, expect, it } from 'vitest'
import {
  HARD_CEILING_BYTES,
  HARD_CEILING_GRID_CARDS,
  PAGES,
  baselineKeyFor,
  countSerializedListingKeys,
  evaluatePayloadBudget,
} from '../check-page-payload-budget.mjs'

describe('page-payload budget (200 KB hard ceiling)', () => {
  it('tracks the four public routes the HTML cut named', () => {
    const paths = PAGES.map((p) => p.path)
    expect(paths).toContain('/')
    expect(paths).toContain('/communities/tetherow')
    expect(paths).toContain('/homes-for-sale/bend')
    expect(paths).toContain('/homes-for-sale')
  })

  it('stores every listing detail under /listing/*', () => {
    expect(baselineKeyFor('/listing/22054302')).toBe('/listing/*')
    expect(baselineKeyFor('/listing/*')).toBe('/listing/*')
    expect(baselineKeyFor('/homes-for-sale/bend')).toBe('/homes-for-sale/bend')
  })

  it('counts unique listing keys in the served HTML', () => {
    expect(HARD_CEILING_GRID_CARDS).toBe(24)
    expect(
      countSerializedListingKeys(
        '"listingKey":"a","ListingKey":"a","listingKey":"b","photoUrl":"/x.jpg"',
      ),
    ).toBe(2)
    expect(
      countSerializedListingKeys(
        'initialListings\\":[{\\"ListingKey\\":\\"aaa\\"},{\\"ListingKey\\":\\"bbb\\"}]',
      ),
    ).toBe(2)
  })

  it('fails a 400 KB city browse that still dumped 48 cards', () => {
    const failures = evaluatePayloadBudget(
      { '/homes-for-sale/bend': 400_000 },
      { pages: { '/homes-for-sale/bend': 415_747 } },
      { cardCounts: { '/homes-for-sale/bend': 48 } },
    )
    expect(failures.some((m) => m.includes('hard ceiling'))).toBe(true)
  })

  it('does not hard-fail a 700 KB community whose map seeded 22 homes', () => {
    const failures = evaluatePayloadBudget(
      { '/communities/tetherow': 700_000 },
      { pages: { '/communities/tetherow': 710_608 } },
      { cardCounts: { '/communities/tetherow': 22 } },
    )
    expect(failures.filter((m) => m.includes('hard ceiling'))).toEqual([])
    expect(failures.filter((m) => m.includes('grew'))).toEqual([])
  })

  it('fails a page that grew, even under the ceiling', () => {
    const failures = evaluatePayloadBudget(
      { '/homes-for-sale/bend': 100_000 },
      { pages: { '/homes-for-sale/bend': 90_000 } },
    )
    expect(failures.some((m) => m.includes('grew'))).toBe(true)
  })

  it('passes a page that shrank and sits under 200 KB', () => {
    const failures = evaluatePayloadBudget(
      { '/': 120_000, '/homes-for-sale/bend': 80_000 },
      { pages: { '/': 180_000, '/homes-for-sale/bend': 90_000 } },
    )
    expect(failures).toEqual([])
  })

  it('uses 200 KB as the hard ceiling constant', () => {
    expect(HARD_CEILING_BYTES).toBe(200 * 1024)
  })
})
