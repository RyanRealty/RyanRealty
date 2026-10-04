import { describe, expect, it } from 'vitest'
import { violations } from '../check-listing-href-number.mjs'

describe('ci:listing-href-number', () => {
  it('flags the 2026-10-04 /about shape: address fields, no MLS number', () => {
    const src = `const href = listingTileHref({\n  listingKey: tile.ListingKey,\n  streetNumber: tile.StreetNumber,\n  city: tile.City,\n})`
    expect(violations(src).map((v) => v.line)).toEqual([1])
  })

  it('passes a literal that names listNumber, a spread row, or a whole tile', () => {
    expect(violations('listingTileHref({ listingKey: k, listNumber: n })')).toEqual([])
    expect(violations('listingTileHref({ ...row, city })')).toEqual([])
    expect(violations('listingTileHref(tile)')).toEqual([])
  })

  it('honours a reasoned pragma on the line above', () => {
    const src = `// listing-href-number-ok: only a key is known here\nreturn listingTileHref({ listingKey: key })`
    expect(violations(src)).toEqual([])
  })

  it('does not accept a pragma with no reason', () => {
    expect(violations(`// listing-href-number-ok:\nlistingTileHref({ listingKey: key })`)).toHaveLength(1)
  })
})
