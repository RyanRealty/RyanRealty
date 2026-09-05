import { describe, expect, it } from 'vitest'
import { crossesUs97, us97IntersectsDisk } from '@/lib/pricing/highway-cross'

/** 2465 7th, Diamond Bar Ranch, east of US-97. */
const SUBJECT = { lat: 44.298938, lng: -121.162046 }
/** 1345 3rd, Hayden Ranch Estates — south, still east of 97. */
const HAYDEN = { lat: 44.289136, lng: -121.166287 }
/** 757 Maple, The Meadows — west of 97. */
const MEADOWS = { lat: 44.292272, lng: -121.175827 }
/** 730 Quince, same subdivision. */
const QUINCE = { lat: 44.298387, lng: -121.161005 }

describe('crossesUs97', () => {
  it('blocks The Meadows from Diamond Bar Ranch (west across US-97)', () => {
    expect(crossesUs97(SUBJECT, MEADOWS)).toBe(true)
  })

  it('keeps Hayden Ranch on the same side of 97', () => {
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

describe('us97IntersectsDisk', () => {
  it('a 1-mile search from Diamond Bar Ranch reaches US-97', () => {
    expect(us97IntersectsDisk(SUBJECT, 1)).toBe(true)
  })

  it('a 0.2-mile search from Diamond Bar Ranch does not', () => {
    expect(us97IntersectsDisk(SUBJECT, 0.2)).toBe(false)
  })
})
