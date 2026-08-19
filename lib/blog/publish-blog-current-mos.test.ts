import { describe, expect, it } from 'vitest'
import {
  BLOG_CURRENT_MOS_PLACES,
  blogClaimsCurrentMos,
  publishBlogCurrentMos,
  rewriteBlogCurrentMos,
} from './publish-blog-current-mos'

const FROZEN = `
<h2>Where Central Oregon stands</h2>
<p>Computed from our live MLS database, single-family homes, verified July 9, 2026. Each figure is current active listings divided by that market's average monthly sales over the last six months.</p>
<ul>
<li><strong>Redmond: 3.9 months</strong>, the only larger market still on the seller's side of the line</li>
<li><strong>Bend: 4.2 months</strong>, balanced</li>
<li><strong>Prineville: 5.4 months</strong>, balanced</li>
<li><strong>Sisters: 5.9 months</strong>, balanced, at the edge of buyer's territory</li>
<li><strong>La Pine: 7.0 months</strong> as of June 30, a buyer's market</li>
<li><strong>Madras: 7.9 months</strong>, a buyer's market</li>
<li><strong>Sunriver: 8.2 months</strong>, a buyer's market</li>
<li><strong>Central Oregon overall: 6.5 months</strong>, the region as a whole now reads on the buyer's side</li>
</ul>
<h2>How we got here: eight Junes of data</h2>
<p>Measured the same way at the end of every June, Central Oregon's months of supply ran 4.1 in 2019, 2.0 in 2020, 0.9 in 2021, 2.0 in 2022, 3.1 in 2023, 3.9 in 2024, 5.1 in 2025, and 6.0 in 2026.</p>
<p>In Redmond at 3.9 months, you can hold closer to your number. In Sunriver at 8.2, the buyer across the table has six other homes to walk to.</p>
<p>One region, readings from 3.9 to 8.2.</p>
`

describe('blogClaimsCurrentMos', () => {
  it('detects a current regional list', () => {
    expect(blogClaimsCurrentMos(FROZEN)).toBe(true)
  })

  it('ignores formula-only copy', () => {
    expect(blogClaimsCurrentMos('<p>Months of supply is active listings divided by monthly sales.</p>')).toBe(false)
  })
})

describe('publishBlogCurrentMos', () => {
  it('publishes pulse MOS through publishMonthsOfSupply and withholds a missing row', () => {
    const published = publishBlogCurrentMos(BLOG_CURRENT_MOS_PLACES, [
      { monthsOfSupply: 4.5, activeCount: 189, refreshedAt: '2026-08-17T01:18:02.858Z' },
      { monthsOfSupply: 3.52, activeCount: 484, refreshedAt: '2026-08-17T01:18:02.858Z' },
      { monthsOfSupply: 5.02, activeCount: 82, refreshedAt: '2026-08-17T01:18:02.858Z' },
      { monthsOfSupply: 4.7, activeCount: 36, refreshedAt: '2026-08-17T01:18:02.858Z' },
      { monthsOfSupply: 11.35, activeCount: 174, refreshedAt: '2026-08-17T01:18:02.858Z' },
      { monthsOfSupply: 5.28, activeCount: 51, refreshedAt: '2026-08-17T01:18:02.858Z' },
      { monthsOfSupply: 11.4, activeCount: 76, refreshedAt: '2026-08-17T01:18:02.858Z' },
      { monthsOfSupply: 5.74, activeCount: 1836, refreshedAt: '2026-08-17T01:18:02.858Z' },
    ])
    expect(published?.asOfLabel).toBe('Aug 16, 2026')
    expect(published?.rows.find((row) => row.label === 'Central Oregon overall')).toEqual({
      label: 'Central Oregon overall',
      mos: 5.74,
      display: '5.7',
      verdict: 'balanced market',
    })
    // Sunriver is a geo_type='neighborhood' row: actives from a polygon, closes
    // from a subdivision-name text join. It drops out of the table rather than
    // printing an absorption figure and a verdict off a mismatched denominator.
    expect(published?.rows.find((row) => row.label === 'Sunriver')).toBeUndefined()
    expect(published?.rows.map((row) => row.label)).not.toContain('Sunriver')
  })

  it('returns null when every row is withheld', () => {
    expect(
      publishBlogCurrentMos(
        [{ label: 'Bend', geoType: 'city', geoSlug: 'bend' }],
        [{ monthsOfSupply: null, activeCount: 10, refreshedAt: '2026-08-17T01:18:02.858Z' }],
      ),
    ).toBeNull()
  })
})

describe('rewriteBlogCurrentMos', () => {
  it('replaces the current list and leaves the June series at 6.0', () => {
    const published = publishBlogCurrentMos(BLOG_CURRENT_MOS_PLACES, [
      { monthsOfSupply: 4.5, activeCount: 189, refreshedAt: '2026-08-17T01:18:02.858Z' },
      { monthsOfSupply: 3.52, activeCount: 484, refreshedAt: '2026-08-17T01:18:02.858Z' },
      { monthsOfSupply: 5.02, activeCount: 82, refreshedAt: '2026-08-17T01:18:02.858Z' },
      { monthsOfSupply: 4.7, activeCount: 36, refreshedAt: '2026-08-17T01:18:02.858Z' },
      { monthsOfSupply: 11.35, activeCount: 174, refreshedAt: '2026-08-17T01:18:02.858Z' },
      { monthsOfSupply: 5.28, activeCount: 51, refreshedAt: '2026-08-17T01:18:02.858Z' },
      { monthsOfSupply: 11.4, activeCount: 76, refreshedAt: '2026-08-17T01:18:02.858Z' },
      { monthsOfSupply: 5.74, activeCount: 1836, refreshedAt: '2026-08-17T01:18:02.858Z' },
    ])
    const out = rewriteBlogCurrentMos(FROZEN, published)
    expect(out).toContain('Central Oregon overall: 5.7 months')
    expect(out).not.toContain('Central Oregon overall: 6.5 months')
    expect(out).toContain('as of Aug 16, 2026')
    expect(out).not.toContain('verified July 9, 2026')
    expect(out).toContain('and 6.0 in 2026')
    expect(out).toContain('3.9 in 2024')
    expect(out).toContain('In Redmond at 4.5 months')
    expect(out).not.toContain('Sunriver')
    expect(out).toContain('readings from 3.5 to 11.4')
  })
})

/**
 * A withheld place must not leave a stale number standing anywhere in the post.
 * The list is regenerated from `rows` so it drops out there on its own; the
 * prose sentence naming it is the surface that used to survive, and a frozen
 * "In Sunriver at 8.2, the buyer across the table has six other homes to walk
 * to" is a published market claim with no source behind it.
 */
describe('rewriteBlogCurrentMos retires a withheld place', () => {
  const pulses = [
    { monthsOfSupply: 4.5, activeCount: 189, refreshedAt: '2026-08-17T01:18:02.858Z' },
    { monthsOfSupply: 3.52, activeCount: 484, refreshedAt: '2026-08-17T01:18:02.858Z' },
    { monthsOfSupply: 5.02, activeCount: 82, refreshedAt: '2026-08-17T01:18:02.858Z' },
    { monthsOfSupply: 4.7, activeCount: 36, refreshedAt: '2026-08-17T01:18:02.858Z' },
    { monthsOfSupply: 11.35, activeCount: 174, refreshedAt: '2026-08-17T01:18:02.858Z' },
    { monthsOfSupply: 5.28, activeCount: 51, refreshedAt: '2026-08-17T01:18:02.858Z' },
    { monthsOfSupply: 11.4, activeCount: 76, refreshedAt: '2026-08-17T01:18:02.858Z' },
    { monthsOfSupply: 5.74, activeCount: 1836, refreshedAt: '2026-08-17T01:18:02.858Z' },
  ]

  it('names the neighborhood place as withheld', () => {
    const published = publishBlogCurrentMos(BLOG_CURRENT_MOS_PLACES, pulses)
    expect(published?.withheldLabels).toContain('Sunriver')
  })

  it('deletes the stale prose claim and the stale list row, leaving no orphan figure', () => {
    const out = rewriteBlogCurrentMos(FROZEN, publishBlogCurrentMos(BLOG_CURRENT_MOS_PLACES, pulses))
    expect(out).not.toContain('Sunriver')
    expect(out).not.toContain('8.2')
    // The surviving city sentence in the same paragraph is untouched.
    expect(out).toContain('In Redmond at 4.5 months')
  })

  it('leaves the historical June series alone', () => {
    const out = rewriteBlogCurrentMos(FROZEN, publishBlogCurrentMos(BLOG_CURRENT_MOS_PLACES, pulses))
    expect(out).toContain('and 6.0 in 2026')
    expect(out).toContain('3.9 in 2024')
  })
})
