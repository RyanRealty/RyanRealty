import { describe, expect, it } from 'vitest'
import {
  crossesUs97,
  differentUs97Bank,
  us97Bank,
  us97IntersectsDisk,
} from '@/lib/pricing/highway-cross'

/** 2465 7th, Diamond Bar Ranch, east of US-97. */
const SUBJECT = { lat: 44.298938, lng: -121.162046 }
/** 1345 3rd, Hayden Ranch Estates — on the US-97 frontage, looks west on Google. */
const HAYDEN = { lat: 44.289136, lng: -121.166287 }
/** 1263 4th, Hayden Ranch Estates — 0.10 miles from the centerline. */
const HAYDEN_4TH = { lat: 44.288653, lng: -121.165254 }
/** 757 Maple, The Meadows — west of 97. */
const MEADOWS = { lat: 44.292272, lng: -121.175827 }
/** 730 Quince, same subdivision. */
const QUINCE = { lat: 44.298387, lng: -121.161005 }

describe('crossesUs97', () => {
  it('blocks The Meadows from Diamond Bar Ranch (west across US-97)', () => {
    expect(crossesUs97(SUBJECT, MEADOWS)).toBe(true)
  })

  it('the crow-flies line to Hayden Ranch does not cross the TIGER centerline', () => {
    expect(crossesUs97(SUBJECT, HAYDEN)).toBe(false)
  })

  it('keeps a same-subdivision sale', () => {
    expect(crossesUs97(SUBJECT, QUINCE)).toBe(false)
  })

  it('fails open when a pin has no coordinates', () => {
    expect(crossesUs97(SUBJECT, null)).toBe(false)
    expect(crossesUs97(null, MEADOWS)).toBe(false)
    expect(crossesUs97({ lat: NaN, lng: -121.16 }, MEADOWS)).toBe(false)
  })
})

describe('us97Bank', () => {
  it('puts Diamond Bar Ranch east of US-97', () => {
    expect(us97Bank(SUBJECT)).toBe('east')
  })

  it('puts Hayden Ranch on the US-97 frontage', () => {
    expect(us97Bank(HAYDEN)).toBe('on')
    expect(us97Bank(HAYDEN_4TH)).toBe('on')
  })

  it('puts The Meadows on the west side of US-97, not east with Diamond Bar', () => {
    expect(us97Bank(MEADOWS)).not.toBe('east')
  })
})

describe('differentUs97Bank', () => {
  it('blocks Hayden Ranch from an interior Diamond Bar subject', () => {
    expect(differentUs97Bank(SUBJECT, HAYDEN)).toBe(true)
    expect(differentUs97Bank(SUBJECT, HAYDEN_4TH)).toBe(true)
  })

  it('blocks The Meadows from Diamond Bar Ranch', () => {
    expect(differentUs97Bank(SUBJECT, MEADOWS)).toBe(true)
  })

  it('keeps a same-subdivision interior sale', () => {
    expect(differentUs97Bank(SUBJECT, QUINCE)).toBe(false)
  })

  it('fails open when a pin has no coordinates', () => {
    expect(differentUs97Bank(SUBJECT, null)).toBe(false)
    expect(differentUs97Bank(null, HAYDEN)).toBe(false)
  })
})

describe('us97IntersectsDisk', () => {
  it('a 1-mile search from Diamond Bar Ranch reaches US-97', () => {
    expect(us97IntersectsDisk(SUBJECT, 1)).toBe(true)
  })

  it('a 0.2-mile search from Diamond Bar Ranch does not', () => {
    expect(us97IntersectsDisk(SUBJECT, 0.2)).toBe(false)
  })
})
