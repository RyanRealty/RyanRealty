import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/**
 * The search grid's "Price drop" badge (SITE-212 review). It never rendered:
 * the grid looked the drop set up by its card key, the MLS number, while the
 * set held ListingKeys. And the set it read (listing_history.price_change)
 * also held raises and sale closings. It now reads the price_drop events
 * /price-drops and the homepage read, by ListingKey, and shows a drop only
 * while it is current (currentPriceDrop, unit-tested in lib/data).
 */
const grid = readFileSync('app/search/[...slug]/sections/ListingsResults.tsx', 'utf8')
const page = readFileSync('app/search/[...slug]/page.tsx', 'utf8')

describe('the search grid price-drop badge', () => {
  it('looks a drop up by ListingKey and shows it only while current', () => {
    expect(grid).toMatch(/currentPriceDrop\(priceDrops\.get\(listing\.ListingKey\.trim\(\)\), listing\.ListPrice\)/)
    expect(grid).not.toMatch(/priceDrops\.get\(key\)/)
    expect(grid).not.toMatch(/priceChangeKeys/)
  })

  it('reads the shared price_drop entries, not listing_history', () => {
    expect(page).toMatch(/getRecentPriceDropEntries\(30\)/)
    expect(page).not.toMatch(/PriceChange/)
  })
})
