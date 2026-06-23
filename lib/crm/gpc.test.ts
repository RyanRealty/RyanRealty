import { describe, it, expect } from 'vitest'
import { isGpcOptOut, shouldExcludeFromSharing } from './gpc'

describe('isGpcOptOut', () => {
  it('opts out on the Sec-GPC header value "1"', () => {
    expect(isGpcOptOut({ secGpcHeader: '1' })).toBe(true)
    expect(isGpcOptOut({ secGpcHeader: ' 1 ' })).toBe(true) // trimmed
  })

  it('opts out on the JS flag === true', () => {
    expect(isGpcOptOut({ jsFlag: true })).toBe(true)
  })

  it('opts out when either source signals (OR semantics)', () => {
    expect(isGpcOptOut({ secGpcHeader: '1', jsFlag: false })).toBe(true)
    expect(isGpcOptOut({ secGpcHeader: '0', jsFlag: true })).toBe(true)
  })

  it('does NOT opt out on absent / non-"1" / non-true values', () => {
    expect(isGpcOptOut({})).toBe(false)
    expect(isGpcOptOut({ secGpcHeader: null, jsFlag: null })).toBe(false)
    expect(isGpcOptOut({ secGpcHeader: '0' })).toBe(false)
    expect(isGpcOptOut({ secGpcHeader: 'true' })).toBe(false) // header is the ASCII "1", not "true"
    expect(isGpcOptOut({ secGpcHeader: '' })).toBe(false)
    expect(isGpcOptOut({ jsFlag: false })).toBe(false)
    // A truthy non-true value (defensive: only literal true counts)
    expect(isGpcOptOut({ jsFlag: 1 as unknown as boolean })).toBe(false)
  })
})

describe('shouldExcludeFromSharing', () => {
  it('excludes when ANY suppression row is present', () => {
    expect(shouldExcludeFromSharing([{ channel: 'all', reason: 'gpc-opt-out' }])).toBe(true)
    expect(shouldExcludeFromSharing([1, 2, 3])).toBe(true)
  })

  it('does NOT exclude on an empty or missing list', () => {
    expect(shouldExcludeFromSharing([])).toBe(false)
    expect(shouldExcludeFromSharing(null)).toBe(false)
    expect(shouldExcludeFromSharing(undefined)).toBe(false)
  })
})
