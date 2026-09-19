import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('getSearchSuggestions prefix contract', () => {
  const src = readFileSync(join(__dirname, 'listings.ts'), 'utf8')

  it('requires subdivision names to include the typed query', () => {
    expect(src).toContain('if (!sub.toLowerCase().includes(qLower)) continue')
  })

  it('ranks address candidates by street-line match score before capping', () => {
    expect(src).toContain('addressCandidates')
    expect(src).toContain('b.score - a.score')
    expect(src).toContain('if (score === 0) continue')
  })

  it('requires zip codes to include the typed query (or the city)', () => {
    expect(src).toContain(
      "if (!postalCode.includes(qLower) && !(city ?? '').toLowerCase().includes(qLower)) continue",
    )
  })

  it('address tiles come from the on-market GIN reader (Delaware 2018 class)', () => {
    expect(src).toContain('searchListingSuggestTiles')
    expect(src).toContain('PUBLIC_ON_MARKET_STATUSES')
    expect(src).toContain('listing_tile_mv_src.search_vector')
  })
})
