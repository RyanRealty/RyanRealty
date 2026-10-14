import { describe, expect, it } from 'vitest'
import { INTENT_ORDER, INTENT_PLAIN_LABEL, INTENT_PLAIN_MEANING, classifyIntent } from './intentSplit'

describe('classifyIntent — one reading of intent_tags', () => {
  it('a selling page makes a seller, a buyer page a buyer, both makes both', () => {
    expect(classifyIntent(['seller_intent'])).toBe('seller')
    expect(classifyIntent(['buyer_intent', 'listing_viewer'])).toBe('buyer')
    expect(classifyIntent(['seller_intent', 'buyer_intent'])).toBe('both')
  })

  it('listings, areas or calculators without either is browsing', () => {
    expect(classifyIntent(['listing_viewer'])).toBe('browsing')
    expect(classifyIntent(['area_researcher', 'mortgage_curious'])).toBe('browsing')
  })

  it('no tag at all is too little to tell', () => {
    expect(classifyIntent([])).toBe('unknown')
    expect(classifyIntent(null)).toBe('unknown')
    expect(classifyIntent(undefined)).toBe('unknown')
  })
})

describe('plain labels', () => {
  it('uses the words Matt asked for', () => {
    expect(INTENT_PLAIN_LABEL.buyer).toBe('Looking to buy')
    expect(INTENT_PLAIN_LABEL.seller).toBe('Thinking of selling')
    expect(INTENT_PLAIN_LABEL.browsing).toBe('Just browsing')
  })

  it('every group has a label and a meaning, in display order', () => {
    expect([...INTENT_ORDER].sort()).toEqual(['both', 'browsing', 'buyer', 'seller', 'unknown'])
    for (const i of INTENT_ORDER) {
      expect(INTENT_PLAIN_LABEL[i]).toBeTruthy()
      expect(INTENT_PLAIN_MEANING[i]).toMatch(/\.$/)
    }
  })
})
