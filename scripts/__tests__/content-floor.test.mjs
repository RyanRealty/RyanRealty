import { describe, expect, it } from 'vitest'
import { METRICS, TOLERANCE, floorProblems, floorShapeProblems, seedFloor, spliceContentFloor } from '../lib/content-floor.mjs'

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
