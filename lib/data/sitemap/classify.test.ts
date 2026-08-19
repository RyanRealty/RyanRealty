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
    // Incomplete location — listingDetailPath fallback (no hyphenated MLS tail).
    expect(classifySitemapUrl(`${B}/homes-for-sale/listing/220208193`, PRESETS)).toBe('listings')
    expect(classifySitemapUrl(`${B}/homes-for-sale/bend/220208193`, PRESETS)).toBe('listings')
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

  // TOTALITY. /sitemap.xml is a <sitemapindex> over the five per-class children
  // (app/sitemaps/index.xml/route.ts), and each child is buildAllUrls() filtered
  // by this function. So "no URL is lost relative to the old monolith" reduces
  // to one property: classifySitemapUrl is TOTAL — every URL the sitemap can
  // emit lands in exactly one class in SITEMAP_CLASSES, never undefined and
  // never a value the index does not list. Verified on 2026-07-30 against the
  // live set: monolith 10,689 URLs, children summed 10,689.
  it('is total — every emitted URL family lands in a listed class', () => {
    const families = [
      `${B}/`,
      `${B}/cities`,
      `${B}/cities/bend`,
      `${B}/cities/bend/awbrey-butte`,
      `${B}/communities`,
      `${B}/communities/tetherow`,
      `${B}/subdivisions/awbrey-butte`,
      `${B}/homes-for-sale`,
      `${B}/homes-for-sale/bend`,
      `${B}/homes-for-sale/bend/newest`,
      `${B}/homes-for-sale/bend/awbrey-butte`,
      `${B}/homes-for-sale/bend/awbrey-butte/newest`,
      `${B}/homes-for-sale/bend/awbrey-butte/tetherow/438-9th-220208193`,
      `${B}/homes-for-sale/listing/220208193`,
      `${B}/open-houses`,
      `${B}/open-houses/bend`,
      `${B}/zip/97703`,
      `${B}/schools/bend-high`,
      `${B}/parks/drake-park`,
      `${B}/central-oregon/events/bend-brewfest`,
      `${B}/central-oregon/golf/tetherow`,
      `${B}/oregon/medford`,
      `${B}/housing-market/bend`,
      `${B}/housing-market/reports/bend-q1`,
      `${B}/price-drops/bend`,
      `${B}/motivated-sellers/bend`,
      `${B}/team/matt-ryan`,
      `${B}/blog/tetherow-resort-living-real-estate`,
      `${B}/lp/tetherow/`,
      `${B}/tools/mortgage-calculator`,
      `${B}/sell/expired-listings`,
      `${B}/buy/relocation`,
      `${B}/site-index`,
      `${B}/some-family-that-does-not-exist-yet/deep/path`,
    ]
    for (const url of families) {
      expect(SITEMAP_CLASSES).toContain(classifySitemapUrl(url, PRESETS))
    }
  })
})
