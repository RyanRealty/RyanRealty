import { describe, expect, it } from 'vitest'
import {
  cityKeyAndLabel,
  countryName,
  geoBucketOf,
  normalizeCountry,
  usStateCode,
  usStateName,
} from './websiteGeo'

describe('geoBucketOf — local, rest of Oregon, other states, other countries', () => {
  it('a Central Oregon town inside Oregon is local', () => {
    for (const city of ['Bend', 'Redmond', 'Sisters', 'Sunriver', 'La Pine', 'Prineville', 'Terrebonne', 'Madras', 'Crooked River Ranch', 'Tumalo']) {
      expect(geoBucketOf({ country: 'US', region: 'OR', city })).toBe('central_oregon')
    }
  })

  it('reads the state from the code Vercel sends or the name Cloudflare sends', () => {
    expect(geoBucketOf({ country: 'US', region: 'Oregon', city: 'Bend' })).toBe('central_oregon')
    expect(geoBucketOf({ country: 'us', region: 'or', city: 'bend' })).toBe('central_oregon')
    expect(geoBucketOf({ country: 'US', region: 'US-OR', city: 'Bend' })).toBe('central_oregon')
  })

  it('a town of the same name in another state is not local', () => {
    // Redmond, Washington and Bend, nowhere else, must not count as Central Oregon.
    expect(geoBucketOf({ country: 'US', region: 'WA', city: 'Redmond' })).toBe('other_states')
  })

  it('the rest of Oregon is its own group', () => {
    expect(geoBucketOf({ country: 'US', region: 'OR', city: 'Portland' })).toBe('rest_of_oregon')
    expect(geoBucketOf({ country: 'US', region: 'OR', city: null })).toBe('rest_of_oregon')
  })

  it('other states and other countries', () => {
    expect(geoBucketOf({ country: 'US', region: 'CA', city: 'Santa Clara' })).toBe('other_states')
    expect(geoBucketOf({ country: 'CA', region: 'BC', city: 'Vancouver' })).toBe('other_countries')
    expect(geoBucketOf({ country: 'MX', region: null, city: 'Mexico City' })).toBe('other_countries')
  })

  it('no location stays unknown, never guessed', () => {
    expect(geoBucketOf({ country: null, region: null, city: null })).toBe('unknown')
    expect(geoBucketOf({ country: '', region: 'OR', city: 'Bend' })).toBe('unknown')
    // The edge's own "unknown" and Tor markers are not countries.
    expect(geoBucketOf({ country: 'XX', region: null, city: null })).toBe('unknown')
    expect(geoBucketOf({ country: 'T1', region: null, city: null })).toBe('unknown')
    // A US visit with no state cannot be placed inside or outside Oregon.
    expect(geoBucketOf({ country: 'US', region: null, city: 'Bend' })).toBe('unknown')
  })
})

describe('labels', () => {
  it('normalizes countries and states', () => {
    expect(normalizeCountry(' us ')).toBe('US')
    expect(normalizeCountry('USA')).toBeNull()
    expect(usStateCode('US', 'Washington')).toBe('WA')
    expect(usStateCode('CA', 'OR')).toBeNull()
    expect(usStateName('OR')).toBe('Oregon')
    expect(usStateName('ZZ')).toBe('ZZ')
  })

  it('names a country from its code', () => {
    expect(countryName('CA')).toBe('Canada')
    expect(countryName('MX')).toBe('Mexico')
  })

  it('labels a US city with its state and a foreign city with its country', () => {
    expect(cityKeyAndLabel({ country: 'US', region: 'OR', city: 'Bend' })).toEqual({ key: 'US|OR|bend', label: 'Bend, OR' })
    expect(cityKeyAndLabel({ country: 'US', region: 'Oregon', city: 'Bend' })?.key).toBe('US|OR|bend')
    expect(cityKeyAndLabel({ country: 'CA', region: 'ON', city: 'Toronto' })).toEqual({ key: 'CA|toronto', label: 'Toronto, Canada' })
    expect(cityKeyAndLabel({ country: 'US', region: 'OR', city: '' })).toBeNull()
    expect(cityKeyAndLabel({ country: null, region: null, city: 'Bend' })).toBeNull()
  })
})
