/**
 * The phone-fold rules must fail on the fold #386 removed and pass on the
 * fold it shipped. Each case drives the pure core of ci:listing-phone-fold
 * (scripts/check-listing-phone-fold.mjs) with measured boxes, no browser.
 *
 * The two fixtures are the same listing at 375x812 before and after #386:
 * before, a fixed 448px navy frame with a 3:2 still contained in it (99px of
 * empty navy above and below, Matt 2026-09-25 "I hate all the wasted space")
 * and a two-line display-1 address; after, a 3:2 frame the still covers and a
 * one-line display-2 address.
 */

import { describe, expect, it } from 'vitest'
import {
  FOLD_LIMITS,
  PHONE_VIEWPORTS,
  byLongestStreet,
  chooseCases,
  classifyListingHtml,
  discClearance,
  foldProblems,
  frameUncovered,
  largestVerticalGap,
  listingPathsFromSitemap,
  outsideFold,
  paintedImageRect,
  parseObjectPosition,
  spreadOrder,
  streetSlug,
  summarizeFold,
  tableHeader,
  tableRow,
} from './listing-phone-fold.mjs'

const VP = PHONE_VIEWPORTS[0] // 375x812
const r = (x, y, w, h) => ({ x, y, w, h })
const text = (y, h = 20, x = 20, w = 200) => ({ ...r(x, y, w, h), kind: 'text' })

/** Everything drawn below the hero, from y onward, every 30px to the fold. */
function pageBelow(y, until = 812) {
  const out = []
  for (let top = y; top < until; top += 30) out.push(text(top, 20))
  return out
}

/** 61390 Merriewood Court at 375x812 as #386 shipped it. */
function afterFix(overrides = {}) {
  const frame = r(0, 92, 375, 250)
  return {
    viewport: VP,
    listing: { kind: 'photo', label: '61390 Merriewood Court', path: '/homes-for-sale/bend/x/61390-merriewood-220000001' },
    address: { box: r(20, 394, 335, 24.5), text: [r(20, 394, 250, 24.5)] },
    price: { box: r(20, 418.5, 335, 21.8), text: [r(20, 419, 96, 20)] },
    facts: { box: r(20, 440.3, 335, 22.4), text: [r(20, 441, 180, 20)] },
    frame: {
      box: frame,
      leadKind: 'image',
      lead: { kind: 'image', box: frame, natural: { w: 1500, h: 1000 }, fit: 'cover', position: '50% 50%', complete: true },
    },
    jax: { box: r(291, 372, 68, 68) },
    images: [{ box: frame, natural: { w: 1500, h: 1000 }, fit: 'cover', position: '50% 50%', clip: r(0, 0, 375, 812) }],
    content: [
      { ...r(20, 16, 120, 32), kind: 'img' }, // chrome wordmark
      { ...r(215, 8, 44, 44), kind: 'control' }, // search
      text(70, 22), // the place trail
      { ...r(8, 342, 100, 44), kind: 'control' }, // Photos tab in the strip
      text(394, 24.5),
      text(419, 20),
      text(441, 20),
      text(466, 20), // city, zip, community
      { ...r(20, 492, 110, 44), kind: 'control' }, // Save / Share
      { ...r(140, 492, 60, 44), kind: 'control' }, // Tour
      text(544, 20), // listed by
      text(580, 20), // pills
      ...pageBelow(610),
    ],
    ...overrides,
  }
}

/** The same listing before #386: a 448px navy box around a contained 3:2 still. */
function beforeFix() {
  const frame = r(0, 92, 375, 448)
  return afterFix({
    address: { box: r(20, 548, 335, 77), text: [r(20, 548, 300, 38), r(20, 587, 220, 38)] },
    price: { box: r(20, 625, 335, 21.8), text: [r(20, 626, 96, 20)] },
    facts: { box: r(20, 800, 335, 22.4), text: [r(20, 801, 180, 20)] },
    frame: {
      box: frame,
      leadKind: 'image',
      lead: { kind: 'image', box: frame, natural: { w: 1500, h: 1000 }, fit: 'contain', position: '50% 50%', complete: true },
    },
    images: [{ box: frame, natural: { w: 1500, h: 1000 }, fit: 'contain', position: '50% 50%', clip: r(0, 0, 375, 812) }],
    content: [
      { ...r(20, 16, 120, 32), kind: 'img' },
      { ...r(215, 8, 44, 44), kind: 'control' },
      text(70, 22),
      { ...r(8, 294, 44, 44), kind: 'control' }, // carousel step, over the photo
      { ...r(8, 540, 100, 8), kind: 'control' },
      text(548, 38),
      text(587, 38),
      text(626, 20),
      text(650, 20),
      text(680, 20),
      text(710, 20),
      text(740, 20),
      text(770, 20),
      text(801, 11),
    ],
  })
}

describe('paintedImageRect', () => {
  it('draws a contained 3:2 still in a 375x448 box as 375x250 with 99px above and below', () => {
    const painted = paintedImageRect(r(0, 92, 375, 448), { w: 1500, h: 1000 }, 'contain', '50% 50%')
    expect(painted).toEqual(r(0, 191, 375, 250))
  })

  it('fills the box under cover fit, and clips the overflow to the box', () => {
    expect(paintedImageRect(r(0, 92, 375, 281.25), { w: 1500, h: 1000 }, 'cover', '50% 50%')).toEqual(r(0, 92, 375, 281.25))
  })

  it('anchors by object-position (a portrait still at its foot)', () => {
    const painted = paintedImageRect(r(0, 0, 400, 300), { w: 600, h: 900 }, 'contain', '50% 100%')
    expect(painted).toEqual(r(100, 0, 200, 300))
  })

  it('stretches under fill and paints nothing for an image that has not decoded', () => {
    expect(paintedImageRect(r(0, 0, 100, 50), { w: 10, h: 10 }, 'fill')).toEqual(r(0, 0, 100, 50))
    expect(paintedImageRect(r(0, 0, 100, 50), { w: 0, h: 0 }, 'cover')).toBeNull()
  })

  it('reads object-position keywords, lengths and a single token', () => {
    expect(parseObjectPosition('left bottom', 100, 40)).toEqual([0, 40])
    expect(parseObjectPosition('10px 25%', 100, 40)).toEqual([10, 10])
    expect(parseObjectPosition('top', 100, 40)).toEqual([50, 0])
  })
})

describe('largestVerticalGap', () => {
  const band = r(0, 0, 375, 812)

  it('counts the bands between rects and at both edges of the screen', () => {
    expect(largestVerticalGap([r(0, 100, 50, 20), r(0, 400, 50, 400)], band)).toEqual({ px: 280, from: 120, to: 400 })
    expect(largestVerticalGap([r(0, 0, 50, 700)], band)).toEqual({ px: 112, from: 700, to: 812 })
  })

  it('merges overlapping rects', () => {
    expect(largestVerticalGap([r(0, 0, 10, 500), r(0, 450, 10, 362)], band).px).toBe(0)
  })

  it('ignores a rect off the side of the screen and one too thin to see', () => {
    const offRight = r(400, 100, 375, 600) // the next carousel slide
    const hairline = r(0, 300, 375, 1)
    expect(largestVerticalGap([r(0, 0, 10, 100), offRight, hairline, r(0, 700, 10, 112)], band)).toEqual({
      px: 600,
      from: 100,
      to: 700,
    })
  })
})

describe('outsideFold and discClearance', () => {
  it('names the edge a box crosses and by how much', () => {
    expect(outsideFold(r(20, 790, 300, 71), VP)).toEqual({ px: 49, edge: 'bottom' })
    expect(outsideFold(r(20, 400, 300, 20), VP)).toEqual({ px: 0, edge: null })
    expect(outsideFold(null, VP).edge).toBe('absent')
  })

  it('measures a disc against text: positive clear, negative overlapping', () => {
    const jax = r(291, 372, 68, 68) // a disc: centre (325, 406), radius 34
    expect(discClearance(jax, [r(20, 396, 200, 20)])).toBe(71) // nearest point (220, 406): 105 - 34
    expect(discClearance(jax, [r(0, 396, 300, 20)])).toBe(-9) // nearest point (300, 406): 25 - 34
    expect(discClearance(jax, [r(280, 396, 60, 20)])).toBe(-34) // the centre sits on the text
    // A corner the bounding box would call a hit is clear of the disc itself.
    expect(discClearance(jax, [r(355, 440, 20, 20)])).toBeGreaterThan(0)
    expect(discClearance(jax, [])).toBeNull()
  })
})

describe('frameUncovered', () => {
  it('reports the letterbox of a contained still and nothing for a covered one', () => {
    expect(frameUncovered(beforeFix().frame)).toEqual({ vertical: 198, horizontal: 0 })
    expect(frameUncovered(afterFix().frame)).toEqual({ vertical: 0, horizontal: 0 })
  })

  it('does not judge a reel or a frame with no photograph', () => {
    expect(frameUncovered({ box: r(0, 92, 375, 211), leadKind: 'video', lead: null })).toBeNull()
    expect(frameUncovered(null)).toBeNull()
  })
})

describe('foldProblems', () => {
  it('passes the fold #386 shipped', () => {
    expect(foldProblems(afterFix())).toEqual([])
    const s = summarizeFold(afterFix())
    expect(s.keyGap.px).toBeLessThanOrEqual(FOLD_LIMITS.maxHeroBandPx)
    expect(s.gap.px).toBeLessThanOrEqual(FOLD_LIMITS.maxDeadBandPx)
  })

  it('fails the fold #386 removed, on every rule it broke', () => {
    const problems = foldProblems(beforeFix())
    const elements = problems.map((p) => p.element)
    expect(elements).toContain('hero frame .listing-frame__media')
    expect(elements).toContain('hero photo in .listing-frame__media')
    expect(elements).toContain('dead space in the hero block (top of screen to the facts line)')
    expect(elements).toContain('dead space in the fold')
    expect(elements).toContain('facts .listing-face__facts')
    const frame = problems.find((p) => p.element === 'hero frame .listing-frame__media')
    expect(frame.measured).toBe('height 448px')
    expect(frame.limit).toMatch(/^> 281\.3px/)
    const band = problems.find((p) => p.element === 'dead space in the fold')
    expect(band.measured).toBe('99px empty band at y 92..191')
    expect(band.limit).toBe(`> ${FOLD_LIMITS.maxDeadBandPx}px`)
  })

  it('names the listing, the viewport, the element, the value and the limit', () => {
    const m = afterFix({ facts: { box: r(20, 790, 335, 71), text: [] } })
    const [p] = foldProblems(m)
    expect(p.message).toBe(
      '61390 Merriewood Court (/homes-for-sale/bend/x/61390-merriewood-220000001) @375x812: ' +
        'facts .listing-face__facts bottom 861px > fold 812px. Beds / baths / sq ft must sit whole inside the first screen (#386).',
    )
  })

  it('fails a page missing the address, the price or the facts', () => {
    const problems = foldProblems(afterFix({ price: null }))
    expect(problems.map((p) => `${p.element} ${p.measured}`)).toContain('price .listing-ask__price is absent')
  })

  it('fails Jax over the price or the address', () => {
    const underJax = afterFix({ price: { box: r(20, 418.5, 335, 21.8), text: [r(200, 400, 120, 20)] } })
    const p = foldProblems(underJax).find((x) => x.element === 'Jax .v3-dog-floater over the price')
    expect(p.measured).toMatch(/^overlaps the price text by \d/)
    const addressUnderJax = afterFix({ address: { box: r(20, 394, 335, 24.5), text: [r(20, 394, 300, 24.5)] } })
    expect(foldProblems(addressUnderJax).map((x) => x.element)).toContain('Jax .v3-dog-floater over the address')
  })

  it('holds a reel frame to 16:9 and a photo frame to 4:3', () => {
    const reel = (h) =>
      afterFix({
        frame: { box: r(0, 92, 375, h), leadKind: 'video', lead: null },
        images: [],
        content: [...afterFix().content, { ...r(0, 92, 375, h), kind: 'iframe' }],
      })
    expect(foldProblems(reel(210.9)).map((p) => p.element)).not.toContain('hero frame .listing-frame__media')
    expect(foldProblems(reel(281.25)).map((p) => p.element)).toContain('hero frame .listing-frame__media')
    const tallPhoto = afterFix()
    tallPhoto.frame = { ...tallPhoto.frame, box: r(0, 92, 375, 300) }
    expect(foldProblems(tallPhoto).find((p) => p.element === 'hero frame .listing-frame__media').limit).toMatch(
      /^> 281\.3px \(4:3/,
    )
  })
})

describe('the table', () => {
  it('prints one aligned row per listing and viewport with every measured column', () => {
    const header = tableHeader()
    for (const col of ['case', 'listing', 'viewport', 'address y', 'price y', 'facts y', 'frame WxH', 'uncovered', 'hero band', 'fold band', 'Jax/price', 'Jax/address']) {
      expect(header).toContain(col)
    }
    const row = tableRow(afterFix())
    expect(row).toMatch(/^photo\s+61390 Merriewood Court\s+375x812\s+394\.\.418\.5\s+418\.5\.\.440\.3\s+440\.3\.\.462\.7\s+375x250 image\s+0px/)
  })
})

describe('discovery', () => {
  const html = (inner) => `<main>${inner}</main>`
  const face = (facts) =>
    `<h1 class="listing-ask">2745 NW Ordway Avenue</h1><p class="listing-ask__price">$489,000</p><div class="listing-face__facts">${facts}</div>`

  it('classifies a listing page from its server HTML', () => {
    const video = classifyListingHtml(
      html(`<div class="listing-frame__media" data-lead="video"></div>${face('2 bd · 2 ba · 926 sqft')}<div class="listing-face__drop"></div>`),
    )
    expect(video).toMatchObject({ resolves: true, address: '2745 NW Ordway Avenue', home: true, video: true, cut: true, photos: true })
    const lot = classifyListingHtml(html(`<div class="listing-frame__media"></div>${face('5 acres')}`))
    expect(lot).toMatchObject({ home: false, video: false, cut: false })
    const noPhotos = classifyListingHtml(
      html(`<div class="listing-frame__media"><div class="listing-mosaic__slide listing-mosaic__slide--empty"></div></div>${face('3 bd · 2 ba · 1,500 sqft')}`),
    )
    expect(noPhotos.photos).toBe(false)
    expect(classifyListingHtml('<h1>Listing not found</h1>').resolves).toBe(false)
  })

  it('reads canonical listing paths from the sitemap, once each, in order', () => {
    const xml = [
      '<loc>https://ryan-realty.com/homes-for-sale/bend/tetherow/61281-mcroberts-220218727</loc>',
      '<loc>https://ryan-realty.com/cities/bend</loc>',
      '<loc>https://ryan-realty.com/homes-for-sale/madras/00504-hwy-97-and-26-south-madras-220138701</loc>',
      '<loc>https://ryan-realty.com/homes-for-sale/bend/tetherow/61281-mcroberts-220218727</loc>',
    ].join('')
    const paths = listingPathsFromSitemap(xml)
    expect(paths).toEqual([
      '/homes-for-sale/bend/tetherow/61281-mcroberts-220218727',
      '/homes-for-sale/madras/00504-hwy-97-and-26-south-madras-220138701',
    ])
    expect(streetSlug(paths[1])).toBe('00504-hwy-97-and-26-south-madras')
    expect(byLongestStreet(paths)[0]).toBe(paths[1])
  })

  it('spreads probes across the sitemap instead of reading one plat', () => {
    const paths = Array.from({ length: 100 }, (_, i) => `/p${i}`)
    expect(spreadOrder(paths, 4)).toEqual(['/p0', '/p25', '/p50', '/p75'])
    expect(spreadOrder(paths.slice(0, 3), 10)).toEqual(['/p0', '/p1', '/p2'])
  })

  it('chooses four different homes and flags a case it cannot find', () => {
    const c = (path, info) => ({ path, info: { resolves: true, home: true, photos: true, address: path, ...info } })
    const long = [c('/long-lot', { home: false }), c('/long-home', { video: true })]
    const candidates = [c('/reel', { video: true }), c('/plain', {}), c('/cut', { cut: true }), c('/lot', { home: false })]
    const cases = chooseCases({ candidates, long })
    expect(cases.map((x) => [x.kind, x.path])).toEqual([
      ['video', '/reel'],
      ['photo', '/plain'],
      ['long-address', '/long-home'],
      ['price-cut', '/cut'],
    ])
    const none = chooseCases({ candidates: [c('/plain', {})], long: [] })
    expect(none.filter((x) => x.missing).map((x) => x.kind)).toEqual(['video', 'long-address', 'price-cut'])
  })
})
