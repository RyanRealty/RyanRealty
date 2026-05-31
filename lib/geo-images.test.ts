import { describe, it, expect } from 'vitest'
import { cityHero, hasCuratedCityHero } from '@/lib/geo-images'

// Gate for IMG-01: a non-Bend city must NEVER render the Bend Old Mill hero.
// Data-accuracy rule #1 — a wrong-city photo is a violation, not cosmetics.

const OLD_MILL = 'hero-old-mill-master-4k'
const CITY_SLUGS = [
  'bend', 'redmond', 'sisters', 'sunriver',
  'la-pine', 'madras', 'prineville', 'terrebonne', 'tumalo',
]

describe('cityHero — no wrong-city heroes (IMG-01)', () => {
  it('only Bend may use the Old Mill photo', () => {
    for (const slug of CITY_SLUGS) {
      const src = cityHero(slug).src
      if (slug === 'bend') expect(src).toContain(OLD_MILL)
      else expect(src, `${slug} must not use the Bend Old Mill photo`).not.toContain(OLD_MILL)
    }
  })

  it('an unknown slug never returns the Bend photo (honest regional fallback)', () => {
    expect(cityHero('nonexistent-place').src).not.toContain(OLD_MILL)
  })

  it('every city hero carries accurate, non-empty alt text', () => {
    for (const slug of CITY_SLUGS) {
      expect(cityHero(slug).alt.length, `${slug} alt`).toBeGreaterThan(8)
    }
  })

  it('curated coverage flag is honest', () => {
    expect(hasCuratedCityHero('bend')).toBe(true)
    expect(hasCuratedCityHero('sisters')).toBe(true)
    expect(hasCuratedCityHero('madras')).toBe(false) // not yet sourced
  })
})
