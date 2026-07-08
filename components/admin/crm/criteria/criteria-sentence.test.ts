import { describe, it, expect } from 'vitest'
import {
  alertCriteriaSentence,
  alertFrequencyPhrase,
  extraFilterCount,
  formatPriceShort,
  joinWithAnd,
  listNeighborhoodOptions,
  placePhrase,
  pricePhrase,
  propertyTypePhrase,
  reportCriteriaSentence,
  resolveAreaLabels,
  summarizeAreaLabels,
} from './criteria-sentence'

// The criteria editors render these sentences live while a broker edits, so
// the wording contract (plain English, correct joins, honest "plus N more
// filters" tail) is what a broker and a contact actually read.

describe('formatPriceShort', () => {
  it('formats thousands and millions compactly', () => {
    expect(formatPriceShort(800_000)).toBe('$800K')
    expect(formatPriceShort(1_200_000)).toBe('$1.2M')
    expect(formatPriceShort(2_000_000)).toBe('$2M')
    expect(formatPriceShort(950)).toBe('$950')
  })
})

describe('joinWithAnd', () => {
  it('joins with commas and a final and', () => {
    expect(joinWithAnd(['Bend'])).toBe('Bend')
    expect(joinWithAnd(['Bend', 'Redmond'])).toBe('Bend and Redmond')
    expect(joinWithAnd(['Bend', 'Redmond', 'Sisters'])).toBe('Bend, Redmond and Sisters')
  })
})

describe('pricePhrase', () => {
  it('covers both, min only, max only, and neither', () => {
    expect(pricePhrase(500_000, 800_000)).toBe('between $500K and $800K')
    expect(pricePhrase(undefined, 800_000)).toBe('under $800K')
    expect(pricePhrase(500_000, undefined)).toBe('over $500K')
    expect(pricePhrase(undefined, undefined)).toBeNull()
  })
})

describe('placePhrase', () => {
  it('prefers neighborhood, then community, then cities', () => {
    expect(placePhrase({ neighborhoodSlug: 'bend-river-west', city: 'Bend' })).toBe('in River West')
    expect(placePhrase({ subdivision: 'Tetherow', city: 'Bend' })).toBe('in Tetherow, Bend')
    expect(placePhrase({ city: 'Bend', cities: ['Redmond'] })).toBe('in Bend and Redmond')
    expect(placePhrase({})).toBe('in Central Oregon')
  })
})

describe('propertyTypePhrase', () => {
  it('reads as a plain noun phrase', () => {
    expect(propertyTypePhrase(undefined)).toBe('new listings')
    expect(propertyTypePhrase('Residential')).toBe('residential listings')
    expect(propertyTypePhrase('A')).toBe('residential listings')
    expect(propertyTypePhrase('Land')).toBe('land listings')
  })
})

describe('alertFrequencyPhrase', () => {
  it('maps the three cron-honored cadences', () => {
    expect(alertFrequencyPhrase('instant')).toBe('as new homes hit the market')
    expect(alertFrequencyPhrase('daily')).toBe('once a day')
    expect(alertFrequencyPhrase('weekly')).toBe('once a week')
  })
})

describe('extraFilterCount', () => {
  it('counts only keys the sentence does not spell out', () => {
    expect(extraFilterCount({ city: 'Bend', maxPrice: 800_000, beds: 3 })).toBe(0)
    expect(extraFilterCount({ city: 'Bend', hasPool: true, minSqFt: 2000 })).toBe(2)
    expect(extraFilterCount({ sort: 'newest', statusFilter: 'active' })).toBe(0)
  })
})

describe('alertCriteriaSentence', () => {
  it('reads as one plain sentence', () => {
    expect(
      alertCriteriaSentence({ city: 'Bend', maxPrice: 800_000, beds: 3, propertyType: 'Residential' }, 'daily'),
    ).toBe('Email me once a day with residential listings in Bend under $800K with 3+ beds.')
  })
  it('acknowledges filters it does not spell out', () => {
    expect(
      alertCriteriaSentence({ city: 'Bend', hasPool: true, minSqFt: 2000 }, 'weekly'),
    ).toBe('Email me once a week with new listings in Bend, plus 2 more filters.')
  })
  it('handles the empty filter set', () => {
    expect(alertCriteriaSentence({}, 'instant')).toBe(
      'Email me as new homes hit the market with new listings in Central Oregon.',
    )
  })
})

describe('report sentence helpers', () => {
  const options = [
    { slug: 'bend', label: 'Bend' },
    { slug: 'tetherow', label: 'Tetherow' },
    { slug: 'redmond', label: 'Redmond' },
  ]
  it('resolves labels and falls back for unknown slugs', () => {
    expect(resolveAreaLabels(['bend', 'tetherow'], options)).toEqual(['Bend', 'Tetherow'])
    expect(resolveAreaLabels(['bend-river-west'], options)).toEqual(['River West'])
  })
  it('builds the full sentence', () => {
    expect(reportCriteriaSentence(['bend', 'tetherow'], 'monthly', options)).toBe(
      'Send a monthly market report for Bend and Tetherow.',
    )
    expect(reportCriteriaSentence([], 'weekly', options)).toBe(
      'Send a weekly market report. No areas chosen yet.',
    )
  })
  it('summarizes long area lists for the trigger button', () => {
    expect(summarizeAreaLabels([])).toBe('Choose areas')
    expect(summarizeAreaLabels(['Bend', 'Tetherow'])).toBe('Bend and Tetherow')
    expect(summarizeAreaLabels(['Bend', 'Tetherow', 'Redmond', 'Sisters'])).toBe('Bend, Tetherow and 2 more')
  })
})

describe('listNeighborhoodOptions', () => {
  it('includes Bend districts and registry communities, sorted by label', () => {
    const options = listNeighborhoodOptions()
    const slugs = options.map((o) => o.slug)
    expect(slugs).toContain('bend-river-west')
    expect(slugs).toContain('tetherow')
    const labels = options.map((o) => o.label)
    expect([...labels].sort((a, b) => a.localeCompare(b))).toEqual(labels)
    expect(new Set(slugs).size).toBe(slugs.length)
  })
})
