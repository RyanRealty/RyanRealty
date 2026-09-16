import { describe, expect, it } from 'vitest'
import { findPlaceholderZeros, placeholderZeroReason } from '../lib/served-number-placeholder.mjs'

// The exact shape /cities served on 2026-09-16 before SITE-117, with the
// settled figure the primitive now writes beside the face.
const BROKEN =
  '<h2 class="v3-alerts__claim"><span class="v3-alerts__num">' +
  '<span class="tabular-nums v3 v3-number v3-alerts__num-pop" data-settled="256">0</span></span>' +
  '<span class="v3-alerts__claim-text"> houses came on the market in Central Oregon in the last 30 days.</span></h2>'

const FIXED = BROKEN.replace('data-settled="256">0<', 'data-settled="256">256<')

describe('served-number-placeholder', () => {
  it('flags a face of "0" under a non-zero settled figure', () => {
    const hits = findPlaceholderZeros(BROKEN)
    expect(hits).toHaveLength(1)
    expect(hits[0].settled).toBe(256)
    expect(hits[0].face).toBe('0')
    expect(placeholderZeroReason(BROKEN)).toMatch(/1 count-up numeral served as "0".*\(256\).*SITE-117/)
  })

  it('passes the settled face', () => {
    expect(findPlaceholderZeros(FIXED)).toEqual([])
    expect(placeholderZeroReason(FIXED)).toBeNull()
  })

  it('passes an honest zero (settled 0, face 0)', () => {
    const honest = BROKEN.replace('data-settled="256"', 'data-settled="0"')
    expect(findPlaceholderZeros(honest)).toEqual([])
  })

  it('ignores spans that are not count-up numerals', () => {
    const other = '<span class="v3-mos__tick">0</span><span data-index="3">0</span>'
    expect(findPlaceholderZeros(other)).toEqual([])
  })

  it('does not depend on attribute order or on the face being unformatted', () => {
    const reordered = '<span data-settled="3281" class="tabular-nums v3 v3-number">0</span>'
    expect(findPlaceholderZeros(reordered)).toHaveLength(1)
    const formatted = '<span data-settled="3281" class="tabular-nums v3 v3-number">3,281</span>'
    expect(findPlaceholderZeros(formatted)).toEqual([])
  })

  it('counts every placeholder on a page, not just the first', () => {
    const two = BROKEN + '<span class="tabular-nums v3 v3-number" data-settled="12">0</span>'
    expect(findPlaceholderZeros(two).map((h) => h.settled)).toEqual([256, 12])
    expect(placeholderZeroReason(two)).toMatch(/^2 count-up numerals .*\(256, 12\)/)
  })

  it('is quiet on an empty or non-string body', () => {
    expect(findPlaceholderZeros('')).toEqual([])
    expect(findPlaceholderZeros(undefined)).toEqual([])
  })
})
