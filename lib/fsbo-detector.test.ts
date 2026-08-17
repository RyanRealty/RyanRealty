import { describe, it, expect } from 'vitest'
import { parseZillowItem, FSBO_SERVICE_AREA_CITIES, FSBO_MIN_LIST_PRICE } from './fsbo-detector'

type Item = Parameters<typeof parseZillowItem>[0]
const mk = (o: Record<string, unknown>): Item => o as unknown as Item

const validBend = {
  detailUrl: '/homedetails/123-main-st-bend-or-97701/12345_zpid/?utm=blob',
  address: '123 Main St, Bend, OR 97701',
  homeType: 'SINGLE_FAMILY',
  unformattedPrice: 600000,
  zpid: 12345,
  beds: 3,
  baths: 2,
}

describe('parseZillowItem (FSBO lead parser)', () => {
  it('Bend is in the service area + any list price is in', () => {
    expect(FSBO_SERVICE_AREA_CITIES).toContain('Bend')
    expect(FSBO_MIN_LIST_PRICE).toBe(0)
  })

  it('parses an in-service-area SFR above the price floor (and strips tracking query)', () => {
    const r = parseZillowItem(mk(validBend))
    expect(r).not.toBeNull()
    expect(r?.city).toBe('Bend')
    expect(r?.fsboSource).toBe('zillow')
    expect(r?.streetAddress).toBe('123 Main St')
    expect(r?.fsboUrl).toContain('zillow.com')
    expect(r?.fsboUrl).not.toContain('?')
  })

  it('keeps a $250k Bend listing (old $500k floor is retired)', () => {
    expect(parseZillowItem(mk({ ...validBend, unformattedPrice: 250_000 }))).not.toBeNull()
    expect(parseZillowItem(mk({ ...validBend, unformattedPrice: 500_000 }))).not.toBeNull()
  })

  it('rejects out-of-service-area cities', () => {
    expect(parseZillowItem(mk({ ...validBend, address: '123 Main St, Portland, OR 97201' }))).toBeNull()
  })

  it('rejects items with no URL or no address', () => {
    expect(parseZillowItem(mk({}))).toBeNull()
    expect(parseZillowItem(mk({ detailUrl: '/x' }))).toBeNull()
  })
})
