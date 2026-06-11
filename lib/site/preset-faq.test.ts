import { describe, expect, it } from 'vitest'
import { getPresetBySlug, resolvePresetYearBuiltMin, SEARCH_PRESETS } from '@/lib/search-presets'
import {
  buildPresetFaq,
  getAdjacentPriceBandLinks,
  getSamePresetCityLinks,
  isSortOnlyPreset,
} from '@/lib/site/preset-faq'

const PULSE = {
  activeCount: 512,
  medianListPrice: 818_950,
  monthsOfSupply: 3.4,
  medianDaysToPending: 38,
  refreshedAt: '2026-06-10T17:00:00Z',
}

function preset(slug: string) {
  const p = getPresetBySlug(slug)
  if (!p) throw new Error(`missing preset ${slug}`)
  return p
}

describe('isSortOnlyPreset', () => {
  it('flags the two sort presets and nothing else', () => {
    const sortOnly = SEARCH_PRESETS.filter(isSortOnlyPreset).map((p) => p.slug)
    expect(sortOnly.sort()).toEqual(['price-high-to-low', 'price-low-to-high'])
  })
})

describe('buildPresetFaq', () => {
  it('returns null for sort-only presets (no depth, no duplicate-content FAQ)', () => {
    expect(buildPresetFaq('Bend', preset('price-low-to-high'), 100, PULSE)).toBeNull()
    expect(buildPresetFaq('Bend', preset('price-high-to-low'), 100, PULSE)).toBeNull()
  })

  it('covers every non-sort preset with hand-written copy', () => {
    for (const p of SEARCH_PRESETS) {
      if (isSortOnlyPreset(p)) continue
      const result = buildPresetFaq('Bend', p, 12, PULSE)
      expect(result, `preset ${p.slug} should produce depth`).not.toBeNull()
      expect(result!.faqs.length).toBeGreaterThanOrEqual(2)
      expect(result!.faqs.length).toBeLessThanOrEqual(4)
    }
  })

  it('builds the full intro + 4 FAQs for a price band with pulse data', () => {
    const result = buildPresetFaq('Bend', preset('under-750k'), 214, PULSE)!
    expect(result.intro).toContain('214 homes under $750,000 are on the market in Bend right now.')
    // City character from getCityContent.
    expect(result.intro).toContain('Bend is the largest city in Central Oregon')
    // Labeled city-wide context, never the segment's own median.
    expect(result.intro).toContain('Across Bend as a whole, the median list price is $819,000')
    expect(result.intro).toContain('as of June 2026')
    expect(result.faqs).toHaveLength(4)
    expect(result.faqs[0]!.question).toBe('How many homes under $750,000 are for sale in Bend?')
    expect(result.faqs[0]!.answer).toContain('214')
    expect(result.faqs[1]!.question).toBe('What does this search include?')
    expect(result.faqs[1]!.answer).toContain('priced under $750,000')
    // The city median answer must label itself as city-wide.
    const median = result.faqs.find((f) => f.question.includes('cost in Bend overall'))!
    expect(median.answer).toContain('Across all of Bend')
    expect(median.answer).toContain('covers the whole city, not just the listings in this search')
    expect(result.faqTitle).toBe('Questions about homes under $750,000 in Bend')
  })

  it('uses singular grammar for a single result', () => {
    const result = buildPresetFaq('Culver', preset('lake-view'), 1, null)!
    expect(result.intro).toContain('1 home with a lake view is on the market in Culver right now.')
    expect(result.faqs[0]!.answer).toContain('There is 1 home with a lake view')
  })

  it('renders honest empty-state copy for a zero-count band (no fake stats)', () => {
    const result = buildPresetFaq('Madras', preset('over-2m'), 0, null)!
    expect(result.intro).toContain('No homes priced $2,000,000 and up are on the market in Madras right now')
    expect(result.faqs[0]!.answer).toContain('None right now.')
    // No invented dollar figures beyond the config-derived band threshold.
    expect(result.intro).not.toMatch(/median/i)
  })

  it('null-guards a missing pulse: only count + criteria questions, no city stats', () => {
    const result = buildPresetFaq('Bend', preset('acreage'), 155, null)!
    expect(result.faqs).toHaveLength(2)
    expect(result.faqs.map((f) => f.question).join(' ')).not.toMatch(/cost|selling/)
    expect(result.intro).not.toContain('Across Bend as a whole')
  })

  it('null-guards partial pulse fields independently', () => {
    const result = buildPresetFaq('Bend', preset('condos'), 67, {
      medianListPrice: null,
      medianDaysToPending: 41,
      refreshedAt: PULSE.refreshedAt,
    })!
    expect(result.faqs).toHaveLength(3)
    expect(result.faqs.some((f) => f.question.includes('cost in Bend overall'))).toBe(false)
    const pace = result.faqs.find((f) => f.question === 'How fast are homes selling in Bend?')!
    expect(pace.answer).toContain('median of 41 days to go pending')
  })

  it('phrases pending sales as under contract, not for sale', () => {
    const result = buildPresetFaq('Bend', preset('pending'), 96, null)!
    expect(result.intro).toContain('96 pending sales are under contract in Bend right now.')
    expect(result.faqs[0]!.question).toBe('How many homes are under contract in Bend?')
    expect(result.faqs[0]!.answer).not.toContain('for sale')
  })

  it('derives the new-construction year floor from the live preset config', () => {
    const p = preset('new-construction')
    const year = resolvePresetYearBuiltMin(p)!
    const result = buildPresetFaq('Redmond', p, 70, null)!
    expect(result.faqs[1]!.answer).toContain(`built in ${year} or later`)
  })

  it('produces brand-voice-clean strings (no em-dash, semicolon, or exclamation)', () => {
    for (const p of SEARCH_PRESETS) {
      if (isSortOnlyPreset(p)) continue
      for (const count of [0, 1, 37]) {
        const result = buildPresetFaq('La Pine', p, count, PULSE)!
        const text = [result.intro, result.faqTitle, ...result.faqs.flatMap((f) => [f.question, f.answer])].join(' ')
        expect(text, `voice fail in ${p.slug}`).not.toMatch(/[—–;!]/)
      }
    }
  })
})

describe('getAdjacentPriceBandLinks', () => {
  it('links both neighbors for a mid-ladder band', () => {
    const links = getAdjacentPriceBandLinks('Bend', 'under-750k')
    expect(links.map((l) => l.href)).toEqual([
      '/homes-for-sale/bend/under-600k',
      '/homes-for-sale/bend/under-1m',
    ])
    expect(links[0]!.label).toBe('Under $600K in Bend')
  })

  it('links one neighbor at the ladder ends', () => {
    expect(getAdjacentPriceBandLinks('Bend', 'under-300k').map((l) => l.href)).toEqual([
      '/homes-for-sale/bend/under-400k',
    ])
    expect(getAdjacentPriceBandLinks('Bend', 'over-2m').map((l) => l.href)).toEqual([
      '/homes-for-sale/bend/over-1-5m',
    ])
  })

  it('returns nothing for non-price presets', () => {
    expect(getAdjacentPriceBandLinks('Bend', 'acreage')).toEqual([])
    expect(getAdjacentPriceBandLinks('Bend', 'new-construction')).toEqual([])
  })
})

describe('getSamePresetCityLinks', () => {
  it('excludes the current city and only links cities that carry the preset', () => {
    const links = getSamePresetCityLinks(preset('under-750k'), 'bend')
    expect(links.length).toBeGreaterThan(0)
    expect(links.every((l) => !l.href.startsWith('/homes-for-sale/bend'))).toBe(true)
    expect(links.every((l) => l.href.endsWith('/under-750k'))).toBe(true)
    // Redmond, Sisters, Sunriver, Terrebonne all carry under-750k in
    // lib/popular-searches.ts (the data-grounded registry).
    expect(links.map((l) => l.href)).toContain('/homes-for-sale/redmond/under-750k')
  })

  it('caps at the limit', () => {
    const links = getSamePresetCityLinks(preset('new-listings'), 'bend', 3)
    expect(links.length).toBeLessThanOrEqual(3)
  })

  it('returns nothing when no other city carries the preset', () => {
    expect(getSamePresetCityLinks(preset('with-pool'), 'bend')).toEqual([])
  })
})
