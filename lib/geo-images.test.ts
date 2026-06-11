import { describe, it, expect } from 'vitest'
import { cityHero, hasCuratedCityHero } from '@/lib/geo-images'

// Gate for IMG-01: a city must NEVER render another city's hero photo.
// Data-accuracy rule #1 — a wrong-city photo is a violation, not cosmetics.
//
// Family 4 pass (2026-06-10): all 12 seeded cities now carry a VERIFIED,
// visually-reviewed hero from the asset library. Unknown slugs get the
// labeled regional fallback (verified: false) — never a specific city photo.

const OLD_MILL_ASSET = 'aa132eaa' // the verified Bend Old Mill aerial asset id
const CITY_SLUGS = [
  'bend', 'redmond', 'sisters', 'sunriver',
  'la-pine', 'madras', 'prineville', 'terrebonne', 'tumalo',
  'powell-butte', 'culver', 'crooked-river-ranch',
]

describe('cityHero — no wrong-city heroes (IMG-01)', () => {
  it('only Bend may use the Bend Old Mill photo', () => {
    for (const slug of CITY_SLUGS) {
      const src = cityHero(slug).src
      if (slug === 'bend') expect(src).toContain(OLD_MILL_ASSET)
      else expect(src, `${slug} must not use the Bend Old Mill photo`).not.toContain(OLD_MILL_ASSET)
    }
  })

  it('every seeded city resolves a DISTINCT verified hero', () => {
    const srcs = CITY_SLUGS.map((slug) => cityHero(slug).src)
    expect(new Set(srcs).size).toBe(CITY_SLUGS.length)
    for (const slug of CITY_SLUGS) {
      expect(cityHero(slug).verified, `${slug} should be verified`).toBe(true)
    }
  })

  it('an unknown slug returns the labeled regional fallback, never a city photo', () => {
    const hero = cityHero('nonexistent-place')
    expect(hero.src).not.toContain(OLD_MILL_ASSET)
    expect(hero.verified).toBe(false)
    expect(hero.alt).toContain('Central Oregon')
  })

  it('every city hero carries accurate, non-empty alt text', () => {
    for (const slug of CITY_SLUGS) {
      expect(cityHero(slug).alt.length, `${slug} alt`).toBeGreaterThan(8)
    }
  })

  it('curated coverage flag is honest', () => {
    expect(hasCuratedCityHero('bend')).toBe(true)
    expect(hasCuratedCityHero('sisters')).toBe(true)
    expect(hasCuratedCityHero('madras')).toBe(true) // sourced 2026-06-10 (Family 4)
    expect(hasCuratedCityHero('camp-sherman')).toBe(false) // not yet sourced
  })
})
