import { describe, expect, it } from 'vitest'
import { classifySitemapUrl, SITEMAP_CLASSES } from './classify'

const PRESETS = new Set(['newest', 'with-acreage', 'single-story', 'under-500k'])
const B = 'https://ryan-realty.com'

describe('classifySitemapUrl', () => {
  it('buckets hubs and funnels as core', () => {
    expect(classifySitemapUrl(`${B}/`, PRESETS)).toBe('core')
    expect(classifySitemapUrl(`${B}/cities/bend`, PRESETS)).toBe('core')
    expect(classifySitemapUrl(`${B}/communities/tetherow`, PRESETS)).toBe('core')
    expect(classifySitemapUrl(`${B}/homes-for-sale`, PRESETS)).toBe('core')
    expect(classifySitemapUrl(`${B}/homes-for-sale/bend`, PRESETS)).toBe('core')
    expect(classifySitemapUrl(`${B}/sell`, PRESETS)).toBe('core')
    expect(classifySitemapUrl(`${B}/luxury-homes-bend`, PRESETS)).toBe('core')
  })

  it('buckets evergreen geography as geo', () => {
    expect(classifySitemapUrl(`${B}/subdivisions/awbrey-butte`, PRESETS)).toBe('geo')
    expect(classifySitemapUrl(`${B}/neighborhoods/summit-west`, PRESETS)).toBe('geo')
    expect(classifySitemapUrl(`${B}/zip/97703`, PRESETS)).toBe('geo')
    expect(classifySitemapUrl(`${B}/schools/bend-high`, PRESETS)).toBe('geo')
    // {city}/{subdivision} browse page — not a preset, not a listing.
    expect(classifySitemapUrl(`${B}/homes-for-sale/bend/awbrey-butte`, PRESETS)).toBe('geo')
  })

  it('buckets listing details as listings (MLS-number tail)', () => {
    expect(classifySitemapUrl(`${B}/homes-for-sale/bend/orchard-district/1st-addition-bend-pk/438-9th-220208193`, PRESETS)).toBe('listings')
    expect(classifySitemapUrl(`${B}/homes-for-sale/bend/larkspur/unknown/0-tumalo-reservoir-220207055`, PRESETS)).toBe('listings')
    // Depth-3 listing URL (no neighborhood/subdivision segments).
    expect(classifySitemapUrl(`${B}/homes-for-sale/bend/123-main-220201234`, PRESETS)).toBe('listings')
  })

  it('buckets preset permutations and matrix combos as matrix', () => {
    expect(classifySitemapUrl(`${B}/homes-for-sale/bend/newest`, PRESETS)).toBe('matrix')
    expect(classifySitemapUrl(`${B}/homes-for-sale/bend/summit-west/with-acreage`, PRESETS)).toBe('matrix')
  })

  it('buckets blog as content', () => {
    expect(classifySitemapUrl(`${B}/blog/tetherow-resort-living-real-estate`, PRESETS)).toBe('content')
  })

  it('a subdivision slug that collides with nothing stays geo, not matrix', () => {
    expect(classifySitemapUrl(`${B}/homes-for-sale/bend/tetherow`, PRESETS)).toBe('geo')
  })

  it('exports the class list the route handler iterates', () => {
    expect(SITEMAP_CLASSES).toEqual(['core', 'geo', 'listings', 'matrix', 'content'])
  })
})
