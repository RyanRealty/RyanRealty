import { describe, expect, it } from 'vitest'
import {
  METRICS,
  SECTION_SEED_MIN_ITEMS,
  SECTION_SEED_MIN_WORDS,
  SECTION_TOLERANCE,
  TOLERANCE,
  floorProblems,
  floorShapeProblems,
  seedFloor,
  seedSectionFloors,
  sectionFloorProblems,
  spliceContentFloor,
} from '../lib/content-floor.mjs'

const ABOUT_TODAY = {
  h1: 1,
  words: 640,
  headings: 7,
  sections: 9,
  internalLinks: 84,
  images: 6,
  heroImageWidth: 1440,
  heroImageNatural: 2400,
  video: 0,
  jsonLd: 4,
}

describe('content-floor — seeding', () => {
  it('writes a floor for every measured metric with the tolerance applied', () => {
    const f = seedFloor(ABOUT_TODAY, { seededAt: '2026-09-12', seededFrom: 'https://ryan-realty.com' })
    expect(f.seededAt).toBe('2026-09-12')
    expect(f.seededFrom).toBe('https://ryan-realty.com')
    expect(f.viewport).toBe(1440)
    expect(f.floors.h1).toBe(1)
    expect(f.floors.words).toBe(Math.floor(640 * TOLERANCE.words))
    expect(f.floors.heroImageWidth).toBe(Math.floor(1440 * 0.9))
    expect(f.floors.video).toBe(0)
    expect(f.floors.jsonLd).toBe(4)
    expect(Object.keys(f.floors).sort()).toEqual([...METRICS].sort())
    expect(f.observed).toEqual(ABOUT_TODAY)
  })
  it('skips a metric that was not measured', () => {
    const f = seedFloor({ h1: 1, words: 100 })
    expect(Object.keys(f.floors).sort()).toEqual(['h1', 'words'])
  })
})

describe('content-floor — shape', () => {
  it('accepts a seeded floor', () => {
    expect(floorShapeProblems(seedFloor(ABOUT_TODAY, { seededAt: '2026-09-12', seededFrom: 'x' }))).toEqual([])
  })
  it('refuses an unknown metric and a missing origin', () => {
    const p = floorShapeProblems({ seededAt: '2026-09-12', floors: { sparkle: 3 } })
    expect(p.join('\n')).toMatch(/sparkle is not a known metric/)
    expect(p.join('\n')).toMatch(/seededFrom/)
  })
})

describe('content-floor — the hold', () => {
  const floor = seedFloor(ABOUT_TODAY, { seededAt: '2026-09-12', seededFrom: 'https://ryan-realty.com' })

  it('holds when the page is the same', () => {
    expect(floorProblems(ABOUT_TODAY, floor)).toEqual([])
  })
  it('holds when the page gained content', () => {
    expect(floorProblems({ ...ABOUT_TODAY, words: 900, images: 9, video: 1 }, floor)).toEqual([])
  })
  it('allows the tolerance but not more', () => {
    expect(floorProblems({ ...ABOUT_TODAY, words: 460 }, floor)).toEqual([])
    const p = floorProblems({ ...ABOUT_TODAY, words: 300 }, floor)
    expect(p).toHaveLength(1)
    expect(p[0]).toMatch(/words: 300 < floor 448 \(was 640 on 2026-09-12\)/)
  })
  it('names the About fold regression: hero shrank to a thumbnail', () => {
    const p = floorProblems({ ...ABOUT_TODAY, heroImageWidth: 420, heroImageNatural: 640 }, floor)
    expect(p.join('\n')).toMatch(/heroImageWidth: 420 < floor 1296/)
    expect(p.join('\n')).toMatch(/heroImageNatural: 640 < floor 2160/)
  })
  it('names a dropped video and dropped JSON-LD exactly', () => {
    const withVideo = seedFloor({ ...ABOUT_TODAY, video: 1 }, { seededAt: '2026-09-12', seededFrom: 'x' })
    const p = floorProblems({ ...ABOUT_TODAY, video: 0, jsonLd: 3 }, withVideo)
    expect(p.join('\n')).toMatch(/video: 0 < floor 1/)
    expect(p.join('\n')).toMatch(/jsonLd: 3 < floor 4/)
  })
  it('h1 is exact in both directions', () => {
    expect(floorProblems({ ...ABOUT_TODAY, h1: 2 }, floor).join('\n')).toMatch(/h1: 2, the floor is exactly 1/)
    expect(floorProblems({ ...ABOUT_TODAY, h1: 0 }, floor).join('\n')).toMatch(/h1: 0/)
  })
  it('a page that did not render is a failure, not a pass', () => {
    expect(floorProblems(null, floor)).toEqual(['no measurement — the page did not render.'])
  })
  it('a metric the page cannot report is a failure', () => {
    const { video, ...rest } = ABOUT_TODAY
    expect(floorProblems(rest, floor).join('\n')).toMatch(/video: not measured/)
  })
})

describe('content-floor — section depth (Matt 2026-09-16)', () => {
  const SECTIONS_TODAY = {
    atlas: { items: 4, words: 120 },
    subdivisions: { items: 10, words: 300 },
    homes: { items: 24, words: 900 },
    // A trivial block — a one-line disclosure, an empty-state note — must
    // not get a floor: it would nuisance-fail the moment the wording changed.
    disclosure: { items: 0, words: 12 },
  }

  describe('seedSectionFloors', () => {
    it('floors only a section clearing the items-or-words seed bar, at the 0.9 ratio', () => {
      const { observed, floors } = seedSectionFloors(SECTIONS_TODAY)
      expect(observed).toEqual(SECTIONS_TODAY)
      expect(Object.keys(floors).sort()).toEqual(['atlas', 'homes', 'subdivisions'])
      expect(floors.atlas).toEqual({ items: Math.floor(4 * SECTION_TOLERANCE), words: Math.floor(120 * SECTION_TOLERANCE) })
      expect(floors.homes).toEqual({ items: Math.floor(24 * SECTION_TOLERANCE), words: Math.floor(900 * SECTION_TOLERANCE) })
      expect(floors.disclosure).toBeUndefined()
    })
    it('seeds on words alone when items never clears the bar', () => {
      const { floors } = seedSectionFloors({ belonging: { items: 0, words: 200 } })
      expect(floors.belonging).toEqual({ items: 0, words: Math.floor(200 * SECTION_TOLERANCE) })
    })
    it('the seed bar is exactly items >= 3 or words >= 40', () => {
      expect(seedSectionFloors({ a: { items: SECTION_SEED_MIN_ITEMS, words: 0 } }).floors.a).toBeDefined()
      expect(seedSectionFloors({ a: { items: SECTION_SEED_MIN_ITEMS - 1, words: 0 } }).floors.a).toBeUndefined()
      expect(seedSectionFloors({ a: { items: 0, words: SECTION_SEED_MIN_WORDS } }).floors.a).toBeDefined()
      expect(seedSectionFloors({ a: { items: 0, words: SECTION_SEED_MIN_WORDS - 1 } }).floors.a).toBeUndefined()
    })
    it('is a no-op on a missing or malformed map', () => {
      expect(seedSectionFloors(undefined)).toEqual({ observed: {}, floors: {} })
      expect(seedSectionFloors({ x: 'not an object' })).toEqual({ observed: {}, floors: {} })
    })
  })

  describe('seedFloor integration', () => {
    it('attaches sectionDepth to both observed and floors when the measurement carries one', () => {
      const f = seedFloor({ h1: 1, words: 500, sectionDepth: SECTIONS_TODAY }, { seededAt: '2026-09-16', seededFrom: 'x' })
      expect(f.observed.sectionDepth).toEqual(SECTIONS_TODAY)
      expect(Object.keys(f.floors.sectionDepth).sort()).toEqual(['atlas', 'homes', 'subdivisions'])
      // The page-level `sections` count metric (a NUMBER, e.g. <section> count)
      // is untouched — sectionDepth is a different key, never a replacement.
      expect(f.floors.sections).toBeUndefined() // not measured in this fixture
    })
    it('does not touch the ten page-level floors when a numeric `sections` count is ALSO present', () => {
      const f = seedFloor({ h1: 1, words: 500, sections: 14, sectionDepth: SECTIONS_TODAY }, { seededAt: '2026-09-16', seededFrom: 'x' })
      expect(f.floors.sections).toBe(Math.floor(14 * TOLERANCE.sections)) // the pre-existing scalar floor, untouched
      expect(typeof f.floors.sections).toBe('number')
      expect(typeof f.floors.sectionDepth).toBe('object')
    })
    it('omits sectionDepth entirely (byte-identical to the old shape) when the measurement has none', () => {
      const f = seedFloor(ABOUT_TODAY, { seededAt: '2026-09-12', seededFrom: 'x' })
      expect(f.floors.sectionDepth).toBeUndefined()
      expect(f.observed.sectionDepth).toBeUndefined()
    })
  })

  describe('shape', () => {
    it('accepts a seeded sectionDepth floor', () => {
      const f = seedFloor({ h1: 1, sectionDepth: SECTIONS_TODAY }, { seededAt: '2026-09-16', seededFrom: 'x' })
      expect(floorShapeProblems(f)).toEqual([])
    })
    it('refuses a malformed sectionDepth entry', () => {
      const bad = { seededAt: '2026-09-16', seededFrom: 'x', floors: { sectionDepth: { atlas: 'nope' } } }
      const p = floorShapeProblems(bad)
      expect(p.join('\n')).toMatch(/contentFloor\.floors\.sectionDepth\.atlas must be an object/)
    })
    it('refuses an unknown key inside a section entry and a non-integer value', () => {
      const bad = {
        seededAt: '2026-09-16',
        seededFrom: 'x',
        floors: { sectionDepth: { atlas: { items: 3, sparkle: 1 }, homes: { items: -1 } } },
      }
      const p = floorShapeProblems(bad).join('\n')
      expect(p).toMatch(/sectionDepth\.atlas\.sparkle is not a known section metric/)
      expect(p).toMatch(/sectionDepth\.homes\.items must be a non-negative integer/)
    })
    it('validates sectionDepthSeededAt as YYYY-MM-DD only when present', () => {
      const base = { seededAt: '2026-09-16', seededFrom: 'x', floors: { sectionDepth: { atlas: { items: 3 } } } }
      expect(floorShapeProblems(base)).toEqual([])
      expect(floorShapeProblems({ ...base, sectionDepthSeededAt: 'not-a-date' }).join('\n')).toMatch(/sectionDepthSeededAt must be YYYY-MM-DD/)
      expect(floorShapeProblems({ ...base, sectionDepthSeededAt: '2026-09-16' })).toEqual([])
    })
  })

  describe('the hold', () => {
    const floor = seedFloor({ h1: 1, sectionDepth: SECTIONS_TODAY }, { seededAt: '2026-09-16', seededFrom: 'x' })

    it('holds when the sections are unchanged, or gained items/words', () => {
      expect(sectionFloorProblems(SECTIONS_TODAY, floor)).toEqual([])
      expect(sectionFloorProblems({ ...SECTIONS_TODAY, atlas: { items: 40, words: 900 } }, floor)).toEqual([])
    })
    it('names a section under its items floor, with the original reading and date', () => {
      const p = sectionFloorProblems({ ...SECTIONS_TODAY, subdivisions: { items: 4, words: 300 } }, floor)
      expect(p.join('\n')).toMatch(/sections\.subdivisions\.items: 4 < floor 9 \(was 10 on 2026-09-16\)/)
    })
    it('names a section under its words floor', () => {
      const p = sectionFloorProblems({ ...SECTIONS_TODAY, homes: { items: 24, words: 100 } }, floor)
      expect(p.join('\n')).toMatch(/sections\.homes\.words: 100 < floor \d+ \(was 900 on 2026-09-16\)/)
    })
    it('a section id the floor holds but the page no longer renders is "gone", not silently skipped', () => {
      const { atlas, ...rest } = SECTIONS_TODAY
      const p = sectionFloorProblems(rest, floor)
      expect(p.join('\n')).toMatch(/section #atlas gone \(had 4 items on 2026-09-16\)/)
    })
    it('a trivial block that never got a floor cannot regress — no problem even at zero', () => {
      const p = sectionFloorProblems({ ...SECTIONS_TODAY, disclosure: { items: 0, words: 0 } }, floor)
      expect(p.join('\n')).not.toMatch(/disclosure/)
    })
    it('floorProblems folds section problems in alongside the page-level ones', () => {
      const full = floorProblems({ h1: 1, sectionDepth: { ...SECTIONS_TODAY, homes: { items: 1, words: 10 } } }, floor)
      expect(full.join('\n')).toMatch(/sections\.homes\.items: 1 < floor/)
    })
  })

  it('backward compatible: a floor with no sectionDepth key raises no section problems at all', () => {
    const floor = seedFloor(ABOUT_TODAY, { seededAt: '2026-09-12', seededFrom: 'x' })
    expect(floor.floors.sectionDepth).toBeUndefined()
    expect(sectionFloorProblems(SECTIONS_TODAY, floor)).toEqual([])
    expect(floorProblems(ABOUT_TODAY, floor)).toEqual([])
  })
})

describe('content-floor — splicing into a hand-edited parity.json', () => {
  const FLOOR = { seededAt: '2026-09-12', seededFrom: 'https://ryan-realty.com', viewport: 1440, observed: { h1: 1 }, floors: { h1: 1 }, note: 'has a } brace' }
  const HAND = `{
  "route": "about",
  "beats": [
    { "id": "1", "text": "inline { braces } stay" }
  ],
  "requiredComponents": ["AboutFirm"]
}
`

  it('appends contentFloor as the last member without touching the rest of the text', () => {
    const out = spliceContentFloor(HAND, FLOOR)
    expect(out.startsWith(HAND.slice(0, HAND.lastIndexOf('}')).trimEnd())).toBe(true)
    expect(out).toContain('{ "id": "1", "text": "inline { braces } stay" }')
    expect(JSON.parse(out).contentFloor).toEqual(FLOOR)
    expect(out.endsWith('}\n')).toBe(true)
  })

  it('replaces an existing contentFloor in place and is idempotent on formatting', () => {
    const once = spliceContentFloor(HAND, FLOOR)
    const twice = spliceContentFloor(once, { ...FLOOR, floors: { h1: 1, words: 400 } })
    expect(JSON.parse(twice).contentFloor.floors.words).toBe(400)
    expect(twice).toContain('{ "id": "1", "text": "inline { braces } stay" }')
    expect(twice.split('"contentFloor"').length).toBe(2)
    expect(spliceContentFloor(twice, { ...FLOOR, floors: { h1: 1, words: 400 } })).toBe(twice)
  })

  it('replaces a contentFloor that sits in the middle of the object', () => {
    const mid = `{
  "route": "about",
  "contentFloor": { "seededAt": "2026-01-01", "seededFrom": "x", "floors": { "h1": 2 } },
  "requiredComponents": ["AboutFirm"]
}
`
    const out = spliceContentFloor(mid, FLOOR)
    const parsed = JSON.parse(out)
    expect(parsed.contentFloor).toEqual(FLOOR)
    expect(parsed.requiredComponents).toEqual(['AboutFirm'])
    expect(out).toContain('"route": "about",')
  })

  it('handles an empty object and refuses invalid input', () => {
    expect(JSON.parse(spliceContentFloor('{}\n', FLOOR)).contentFloor).toEqual(FLOOR)
    expect(() => spliceContentFloor('[1]', FLOOR)).toThrow()
    expect(() => spliceContentFloor('{ not json', FLOOR)).toThrow()
  })
})
