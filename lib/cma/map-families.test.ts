import { describe, expect, it } from 'vitest'
import { unsoldKey } from './map-families'

describe('unsold pin keys', () => {
  it('uses roman numerals a reader can say, including forty and beyond', () => {
    expect(unsoldKey(0)).toBe('i')
    expect(unsoldKey(3)).toBe('iv')
    expect(unsoldKey(8)).toBe('ix')
    expect(unsoldKey(35)).toBe('xxxvi')
    expect(unsoldKey(38)).toBe('xxxix')
    expect(unsoldKey(39)).toBe('xl')
    expect(unsoldKey(40)).toBe('xli')
    expect(unsoldKey(49)).toBe('l')
    expect(unsoldKey(89)).toBe('xc')
    expect(unsoldKey(99)).toBe('c')
    expect(unsoldKey(139)).toBe('cxl')
  })
})
