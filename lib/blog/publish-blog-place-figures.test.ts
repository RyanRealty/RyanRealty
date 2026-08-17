import { describe, expect, it } from 'vitest'
import {
  blogClaimsPlaceFigures,
  publishBlogMedianGap,
  rewriteBlogPlaceFigures,
} from './publish-blog-place-figures'

const SAMPLE = `
<p>The median home price in Redmond runs about $100,000 to $150,000 below Bend's median. For a family buying their first home, that gap can mean a lower monthly payment.</p>
<p>This area gives you the closest commute to Bend, about 15 minutes to Bend's east side, while keeping Redmond prices.</p>
<p>Non-peak drive time: 18 to 22 minutes.</p>
<p>OSU-Cascades in Bend is a 20-minute drive.</p>
<p>The 20-minute drive between Redmond and Bend makes this reasonable.</p>
<p>who value living five minutes from the airport</p>
<p>Roberts Field (RDM) sits in Redmond, a five- to ten-minute drive to the terminal.</p>
<p>Let's compare what your money buys in Redmond versus Bend, using mid-2025 data:</p>
<p>Mid-range family home: Redmond $475,000 to $550,000. Bend $625,000 to $750,000.</p>
<p>15 minutes north, with rock climbing.</p>
`

describe('blogClaimsPlaceFigures', () => {
  it('detects the disagreeing Redmond guide and ignores a checklist', () => {
    expect(blogClaimsPlaceFigures(SAMPLE)).toBe(true)
    expect(blogClaimsPlaceFigures('<p>Wash the windows. Hire a photographer.</p>')).toBe(false)
  })
})

describe('publishBlogMedianGap', () => {
  it('publishes the live pulse pair and withholds a missing or inverted gap', () => {
    const gap = publishBlogMedianGap({ medianListPrice: 475_000 }, { medianListPrice: 625_000 })
    expect(gap).toEqual({
      redmond: 475_000,
      bend: 625_000,
      gap: 150_000,
      sentence:
        "The median list price in Redmond is $475,000, $150,000 below Bend's $625,000.",
    })
    expect(publishBlogMedianGap({ medianListPrice: null }, { medianListPrice: 625_000 })).toBeNull()
    expect(publishBlogMedianGap({ medianListPrice: 800_000 }, { medianListPrice: 625_000 })).toBeNull()
  })
})

describe('rewriteBlogPlaceFigures', () => {
  it('makes drive and airport ranges agree and rewrites the live gap', () => {
    const gap = publishBlogMedianGap({ medianListPrice: 475_000 }, { medianListPrice: 625_000 })
    const next = rewriteBlogPlaceFigures(SAMPLE, gap)
    expect(next).toContain("18 to 22 minutes to Bend's east side")
    expect(next).toContain('is an 18- to 22-minute drive')
    expect(next).toContain('The 18- to 22-minute drive between Redmond and Bend')
    expect(next).toContain('living 5 to 10 minutes from the airport')
    expect(next).toContain("The median list price in Redmond is $475,000, $150,000 below Bend's $625,000.")
    expect(next).not.toContain('$100,000 to $150,000 below')
    expect(next).not.toContain('about 15 minutes to Bend')
    expect(next).not.toContain('living five minutes from the airport')
    expect(next).toContain('18 to 22 minutes.')
    expect(next).toContain('five- to ten-minute drive to the terminal')
    expect(next).toContain('mid-2025 data')
    expect(next).toContain('Redmond $475,000 to $550,000')
    expect(next).toContain('15 minutes north, with rock climbing')
  })
})
