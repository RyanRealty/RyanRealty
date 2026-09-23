import { describe, expect, it } from 'vitest'
import platPrerender from '@/data/plat-prerender.json'
import { PLAT_PRERENDER_CAP, platPrerenderParams, platPrerenderSlugs } from '@/lib/site/plat-prerender'

describe('platPrerenderSlugs', () => {
  it('ships the committed list, capped, deduped, in impression order', () => {
    const slugs = platPrerenderSlugs()
    expect(slugs.length).toBeGreaterThan(0)
    expect(slugs.length).toBeLessThanOrEqual(PLAT_PRERENDER_CAP)
    expect(new Set(slugs).size).toBe(slugs.length)
    expect(slugs[0]).toBe('tree-farm')
  })

  it('the committed file agrees with its own totals', () => {
    const listed = platPrerender.plats.reduce((s, p) => s + p.impressions, 0)
    const clicks = platPrerender.plats.reduce((s, p) => s + p.clicks, 0)
    expect(listed).toBe(platPrerender.classTotals.listedImpressions)
    expect(clicks).toBe(platPrerender.classTotals.listedClicks)
    expect(platPrerender.plats.length).toBeLessThanOrEqual(PLAT_PRERENDER_CAP)
  })

  it('drops redirect slugs, malformed slugs and anything past the cap', () => {
    const file = {
      plats: [
        { slug: 'eagle-crest' },
        { slug: 'Tree-Farm' },
        { slug: 'tree-farm' },
        { slug: '../etc' },
        ...Array.from({ length: 40 }, (_, i) => ({ slug: `plat-${i}` })),
      ],
    }
    const slugs = platPrerenderSlugs(file, (s) => s === 'eagle-crest')
    expect(slugs[0]).toBe('tree-farm')
    expect(slugs).not.toContain('eagle-crest')
    expect(slugs).not.toContain('../etc')
    expect(slugs).toHaveLength(PLAT_PRERENDER_CAP)
  })
})

describe('platPrerenderParams', () => {
  it('is the generateStaticParams shape', () => {
    expect(platPrerenderParams()[0]).toEqual({ slug: 'tree-farm' })
  })
})
