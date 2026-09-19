import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PUBLIC_ON_MARKET_STATUSES } from '@/lib/listing-status-public'
import { toPrefixTsQuery } from './searchSuggestTiles'

const SRC = readFileSync(join(__dirname, 'searchSuggestTiles.ts'), 'utf8')

describe('toPrefixTsQuery', () => {
  it('compiles a street prefix the Delaware typeahead uses', () => {
    expect(toPrefixTsQuery('Delaware')).toBe('delaware:*')
    expect(toPrefixTsQuery('Delaware Avenue')).toBe('delaware:* & avenue:*')
  })

  it('returns null for punctuation-only input', () => {
    expect(toPrefixTsQuery('   ')).toBeNull()
    expect(toPrefixTsQuery('***')).toBeNull()
  })
})

describe('searchListingSuggestTiles on-market gate (Delaware 2018 class)', () => {
  it('both query paths pin PUBLIC_ON_MARKET_STATUSES — not Coming Soon-only', () => {
    expect(SRC).toContain("from '@/lib/listing-status-public'")
    expect(SRC).toContain('PUBLIC_ON_MARKET_STATUSES')
    expect(SRC.match(/\.in\('standard_status', PUBLIC_ON_MARKET_STATUSES\)/g)?.length).toBe(2)
    expect(SRC).not.toContain('COMING_SOON_STATUS')
    expect(SRC).not.toContain('MV_NOT_COMING_SOON_OR_PREDICATE')
  })

  it('the public on-market set is Active + AUC + Pending (no Closed / Expired)', () => {
    expect(PUBLIC_ON_MARKET_STATUSES).toEqual(['Active', 'Active Under Contract', 'Pending'])
    expect(PUBLIC_ON_MARKET_STATUSES).not.toContain('Closed')
    expect(PUBLIC_ON_MARKET_STATUSES).not.toContain('Expired')
    expect(PUBLIC_ON_MARKET_STATUSES).not.toContain('Withdrawn')
    expect(PUBLIC_ON_MARKET_STATUSES).not.toContain('Canceled')
    expect(PUBLIC_ON_MARKET_STATUSES).not.toContain('Coming Soon')
  })

  it('documents the GIN index + suggestions API feed', () => {
    expect(SRC).toContain('listing_tile_mv_search')
    expect(SRC).toContain('listing_tile_mv_src')
    expect(SRC).toContain('/api/search/suggestions')
    expect(SRC).toContain('getSearchSuggestions')
  })
})
