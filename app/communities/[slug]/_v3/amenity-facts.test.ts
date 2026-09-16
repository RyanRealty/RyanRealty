import { describe, expect, it } from 'vitest'
import { amenityAccessFacts } from './amenity-facts'

describe('amenityAccessFacts (SITE-116 round 3)', () => {
  it('labels the first part as who can use it and a clock time as hours, verbatim', () => {
    expect(amenityAccessFacts('Open to public · 7am to 2pm seasonally')).toEqual([
      { label: 'Who can use it', value: 'Open to public' },
      { label: 'Hours', value: '7am to 2pm seasonally' },
    ])
  })

  it('files a booking or season clause as a detail', () => {
    expect(amenityAccessFacts('Open to public · reservations via Tetherow Resort')).toEqual([
      { label: 'Who can use it', value: 'Open to public' },
      { label: 'Details', value: 'reservations via Tetherow Resort' },
    ])
    expect(amenityAccessFacts('Members + Lodge guests · seasonal')).toEqual([
      { label: 'Who can use it', value: 'Members + Lodge guests' },
      { label: 'Details', value: 'seasonal' },
    ])
  })

  it('keeps a single-clause line as one fact and prints nothing for no text (§0)', () => {
    expect(amenityAccessFacts('Open to public')).toEqual([{ label: 'Who can use it', value: 'Open to public' }])
    expect(amenityAccessFacts('')).toEqual([])
    expect(amenityAccessFacts(null)).toEqual([])
  })
})
