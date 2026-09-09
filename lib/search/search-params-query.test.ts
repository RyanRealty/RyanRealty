import { describe, expect, it } from 'vitest'
import { queryStringFromSearchParams } from './search-params-query'

describe('queryStringFromSearchParams', () => {
  it('serializes strings, repeats arrays, drops undefined, and reads back through URLSearchParams', () => {
    const q = queryStringFromSearchParams({ beds: '3', propertySubTypes: ['Condominium', 'Townhouse'], view: undefined })
    const back = new URLSearchParams(q)
    expect(back.get('beds')).toBe('3')
    expect(back.getAll('propertySubTypes')).toEqual(['Condominium', 'Townhouse'])
    expect(back.has('view')).toBe(false)
  })
  it('is empty for nothing', () => {
    expect(queryStringFromSearchParams({})).toBe('')
    expect(queryStringFromSearchParams(null)).toBe('')
    expect(queryStringFromSearchParams(undefined)).toBe('')
  })
})
