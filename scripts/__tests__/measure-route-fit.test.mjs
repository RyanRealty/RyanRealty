/**
 * Pure predicate tests for measure-route-fit.mjs. No browser launch — every
 * case here hand-builds the plain data the browser-reading section would
 * hand back, and exercises only the Node-side decision logic.
 *
 * WHY VITEST, NOT node:test. The brief for this tool asked for `node:test` so
 * `node --test` would run it standalone. But `vitest.config.ts`'s GATE_INCLUDE
 * unconditionally sweeps every `scripts/__tests__/**\/*.test.mjs` into the
 * mandatory "gates" vitest project, which every commit's pre-commit hook runs
 * via `npm run test:unit` (CLAUDE.md §8: repo canon outranks this brief).
 * A `node:test`-authored file DOES execute correctly there — vitest's own
 * process runs it and node:test's runner prints a full, real, passing TAP
 * report — but vitest's own suite-collector never sees a vitest-native test
 * register, so it marks the whole file `FAIL — No test suite found` on top of
 * that real, passing TAP output. Verified 2026-09-20. So: vitest idioms here,
 * matching every sibling in this directory (e.g. check-gates-wired.test.mjs).
 * `node --test` on this exact file no longer finds a suite either, for the
 * mirror-image reason — the two runners' registration mechanisms are mutually
 * exclusive, not just differently spelled.
 */
import { describe, expect, it } from 'vitest'
import {
  buildResult,
  evaluateCrumbClip,
  findEscapingChildren,
  heightForWidth,
  isContained,
  isOverflowCulprit,
  PRESETS,
  rankOverflowCulprits,
} from '../measure-route-fit.mjs'

// ---------------------------------------------------------------------------
// 1. The overflow culprit filter. This is the difference between a useful
//    report and 25 lines of carousel: an element inside a genuine horizontal
//    scroll rail (overflow-x: auto|scroll) is intentional and must be
//    excluded; the same element with no such ancestor is a real defect.
// ---------------------------------------------------------------------------
describe('isOverflowCulprit', () => {
  const viewportWidth = 375

  it('reports an element whose right edge clears the viewport and is not inside a scroll rail', () => {
    const candidate = { tag: 'div', className: 'wide-thing', right: 420, insideScrollRail: false }
    expect(isOverflowCulprit(candidate, viewportWidth)).toBe(true)
  })

  it('excludes an element inside an overflow-x: auto ancestor (an intentional scroll rail)', () => {
    const candidate = { tag: 'div', className: 'carousel-slide', right: 900, insideScrollRail: true }
    expect(isOverflowCulprit(candidate, viewportWidth)).toBe(false)
  })

  it('does not report an element within tolerance of the viewport edge', () => {
    const candidate = { tag: 'div', className: 'edge', right: 375.5, insideScrollRail: false }
    expect(isOverflowCulprit(candidate, viewportWidth, { tolerance: 1 })).toBe(false)
  })

  it('does not report an element that does not overflow at all', () => {
    const candidate = { tag: 'div', className: 'fine', right: 300, insideScrollRail: false }
    expect(isOverflowCulprit(candidate, viewportWidth)).toBe(false)
  })
})

describe('rankOverflowCulprits', () => {
  const viewportWidth = 375

  it('filters out scroll-rail candidates and ranks the rest by overflow size, biggest first', () => {
    const candidates = [
      { tag: 'div', className: 'carousel-slide-1', right: 900, insideScrollRail: true },
      { tag: 'div', className: 'carousel-slide-2', right: 950, insideScrollRail: true },
      { tag: 'span', className: 'badge', right: 400, insideScrollRail: false },
      { tag: 'div', className: 'map-chip', right: 440, insideScrollRail: false },
    ]
    const ranked = rankOverflowCulprits(candidates, viewportWidth)
    expect(ranked.length).toBe(2)
    expect(ranked[0].className).toBe('map-chip')
    expect(ranked[1].className).toBe('badge')
    expect(ranked[0].overflowPx).toBe(65)
  })

  it('de-dupes a chain of wrapper elements that report the same edge', () => {
    const candidates = [
      { tag: 'div', className: 'wrap-a', right: 420, insideScrollRail: false },
      { tag: 'div', className: 'wrap-a', right: 420, insideScrollRail: false },
    ]
    const ranked = rankOverflowCulprits(candidates, viewportWidth)
    expect(ranked.length).toBe(1)
  })

  it('respects the limit', () => {
    const candidates = Array.from({ length: 20 }, (_, i) => ({
      tag: 'div',
      className: `item-${i}`,
      right: 400 + i,
      insideScrollRail: false,
    }))
    const ranked = rankOverflowCulprits(candidates, viewportWidth, { limit: 3 })
    expect(ranked.length).toBe(3)
  })
})

// ---------------------------------------------------------------------------
// 2. The breadcrumb clip predicate.
//    cut + no ellipsis = defect (the unreadable mid-word clip SITE-137 found)
//    cut + ellipsis    = clean (a deliberate, readable truncation)
//    not cut           = clean, regardless of text-overflow
// ---------------------------------------------------------------------------
describe('evaluateCrumbClip', () => {
  it('cut with no ellipsis is a defect', () => {
    const result = evaluateCrumbClip({ rungRight: 420, clipBoundary: 375, textOverflow: 'unset' })
    expect(result.cut).toBe(true)
    expect(result.hasEllipsis).toBe(false)
    expect(result.defect).toBe(true)
  })

  it('cut with ellipsis is clean', () => {
    const result = evaluateCrumbClip({ rungRight: 420, clipBoundary: 375, textOverflow: 'ellipsis' })
    expect(result.cut).toBe(true)
    expect(result.hasEllipsis).toBe(true)
    expect(result.defect).toBe(false)
  })

  it('not cut is clean even with no ellipsis', () => {
    const result = evaluateCrumbClip({ rungRight: 340, clipBoundary: 375, textOverflow: 'unset' })
    expect(result.cut).toBe(false)
    expect(result.defect).toBe(false)
  })

  it('not cut is clean with ellipsis too', () => {
    const result = evaluateCrumbClip({ rungRight: 340, clipBoundary: 375, textOverflow: 'ellipsis' })
    expect(result.cut).toBe(false)
    expect(result.defect).toBe(false)
  })

  it('honours tolerance at the boundary', () => {
    const result = evaluateCrumbClip({ rungRight: 375.5, clipBoundary: 375, textOverflow: 'unset', tolerance: 1 })
    expect(result.cut).toBe(false)
    expect(result.defect).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// 3. The containment predicate — a child whose rect escapes its container.
// ---------------------------------------------------------------------------
describe('isContained', () => {
  const container = { left: 0, top: 0, right: 300, bottom: 200 }

  it('a child fully inside the container is contained', () => {
    const child = { left: 10, top: 10, right: 100, bottom: 50 }
    expect(isContained(child, container)).toBe(true)
  })

  it('a child whose right edge escapes the container is not contained', () => {
    const child = { left: 250, top: 10, right: 340, bottom: 50 }
    expect(isContained(child, container)).toBe(false)
  })

  it('a child whose bottom edge escapes the container is not contained', () => {
    const child = { left: 10, top: 10, right: 100, bottom: 220 }
    expect(isContained(child, container)).toBe(false)
  })

  it('a fraction of a pixel over is within tolerance', () => {
    const child = { left: 0, top: 0, right: 300.2, bottom: 200 }
    expect(isContained(child, container, 0.5)).toBe(true)
  })
})

describe('findEscapingChildren', () => {
  const container = { left: 0, top: 0, right: 300, bottom: 200 }

  it('returns only the children that escape the container', () => {
    const children = [
      { tag: 'div', className: 'price-chip-1', left: 10, top: 10, right: 100, bottom: 50 },
      { tag: 'div', className: 'price-chip-2', left: 250, top: 10, right: 340, bottom: 50 },
      { tag: 'div', className: 'price-chip-3', left: 10, top: 190, right: 100, bottom: 260 },
    ]
    const escaping = findEscapingChildren(children, container)
    expect(escaping.length).toBe(2)
    expect(escaping.map((c) => c.className)).toEqual(['price-chip-2', 'price-chip-3'])
  })

  it('returns an empty array when every child is contained', () => {
    const children = [{ tag: 'div', className: 'ok', left: 10, top: 10, right: 100, bottom: 50 }]
    expect(findEscapingChildren(children, container)).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// Supporting pure helpers
// ---------------------------------------------------------------------------
describe('heightForWidth', () => {
  it('gives phone widths a phone-shaped height', () => {
    expect(heightForWidth(375)).toBe(812)
    expect(heightForWidth(500)).toBe(812)
  })

  it('gives desktop widths a desktop-shaped height', () => {
    expect(heightForWidth(1440)).toBe(900)
    expect(heightForWidth(501)).toBe(900)
  })
})

describe('PRESETS', () => {
  it('ships the listing-crumb and place-overflow presets with real routes', () => {
    expect(Array.isArray(PRESETS['listing-crumb'].routes)).toBe(true)
    expect(PRESETS['listing-crumb'].routes.length).toBeGreaterThanOrEqual(4)
    expect(Array.isArray(PRESETS['place-overflow'].routes)).toBe(true)
    expect(PRESETS['place-overflow'].routes.length).toBeGreaterThanOrEqual(5)
    for (const preset of Object.values(PRESETS)) {
      for (const route of preset.routes) {
        expect(route.startsWith('/')).toBe(true)
      }
    }
  })
})

// ---------------------------------------------------------------------------
// buildResult — the pure combination of the three raw browser reads. Exercised
// with hand-built "raw" objects shaped like what the browser collectors
// return, so this too never launches a browser.
// ---------------------------------------------------------------------------
describe('buildResult', () => {
  const baseOpts = { tolerance: 1, overflowLimit: 8 }

  it('marks a navigation failure as unmeasured, never a defect', () => {
    const result = buildResult({
      route: '/x',
      url: 'https://example.test/x',
      width: 375,
      height: 812,
      httpStatus: 0,
      navError: 'net::ERR_CONNECTION_REFUSED',
      overflowRaw: null,
      crumbRaw: null,
      containmentRaw: null,
      opts: baseOpts,
    })
    expect(result.measured).toBe(false)
    expect(result.defect).toBe(false)
    expect(result.error).toBe('net::ERR_CONNECTION_REFUSED')
  })

  it('flags overflow as a defect when scrollWidth clears innerWidth beyond tolerance', () => {
    const result = buildResult({
      route: '/cities/bend/old-bend',
      url: 'https://example.test/cities/bend/old-bend',
      width: 360,
      height: 812,
      httpStatus: 200,
      navError: null,
      overflowRaw: {
        viewportWidth: 360,
        pageScrollWidth: 389,
        candidates: [{ tag: 'div', className: 'map-shell', right: 389, insideScrollRail: false }],
      },
      crumbRaw: null,
      containmentRaw: null,
      opts: baseOpts,
    })
    expect(result.overflow.pageOverflowPx).toBe(29)
    expect(result.overflow.defect).toBe(true)
    expect(result.overflow.culprits[0].className).toBe('map-shell')
    expect(result.defect).toBe(true)
  })

  it('does not flag overflow when scrollWidth matches innerWidth', () => {
    const result = buildResult({
      route: '/cities/bend',
      url: 'https://example.test/cities/bend',
      width: 375,
      height: 812,
      httpStatus: 200,
      navError: null,
      overflowRaw: { viewportWidth: 375, pageScrollWidth: 375, candidates: [] },
      crumbRaw: null,
      containmentRaw: null,
      opts: baseOpts,
    })
    expect(result.overflow.pageOverflowPx).toBe(0)
    expect(result.overflow.defect).toBe(false)
    expect(result.defect).toBe(false)
  })

  it('reports no culprits when the page is clean, even if individual elements report huge off-canvas rects (SVG UA-clipping noise)', () => {
    // A decorative inline <svg> map draws road <path>s whose raw geometry
    // sits far outside the visible canvas; getBoundingClientRect still
    // reports their transformed position, but the <svg> root's default
    // `overflow: hidden` means they never touch document.scrollWidth. Real
    // production shape seen on /cities/bend: pageOverflowPx 0, but dozens of
    // path candidates with right edges >2000px past the 375px viewport.
    const result = buildResult({
      route: '/cities/bend',
      url: 'https://example.test/cities/bend',
      width: 375,
      height: 812,
      httpStatus: 200,
      navError: null,
      overflowRaw: {
        viewportWidth: 375,
        pageScrollWidth: 375,
        candidates: [
          { tag: 'path', className: 'v3-atlas__road', right: 2664.42, insideScrollRail: false },
          { tag: 'g', className: 'v3-atlas__basemap', right: 2664.42, insideScrollRail: false },
        ],
      },
      crumbRaw: null,
      containmentRaw: null,
      opts: baseOpts,
    })
    expect(result.overflow.pageOverflowPx).toBe(0)
    expect(result.overflow.defect).toBe(false)
    expect(result.overflow.culprits).toEqual([])
    expect(result.defect).toBe(false)
  })

  it('carries the crumb clip defect through to the top-level defect flag', () => {
    const result = buildResult({
      route: '/listing/long-address',
      url: 'https://example.test/listing/long-address',
      width: 375,
      height: 812,
      httpStatus: 200,
      navError: null,
      overflowRaw: { viewportWidth: 375, pageScrollWidth: 375, candidates: [] },
      crumbRaw: {
        found: true,
        text: '123 Some Very Long Lane',
        rungLeft: 40,
        rungRight: 430,
        clipBoundary: 375,
        clippedByViewport: true,
        boundaryEl: null,
        textOverflow: 'unset',
        viewportWidth: 375,
      },
      containmentRaw: null,
      opts: baseOpts,
    })
    expect(result.crumb.defect).toBe(true)
    expect(result.defect).toBe(true)
  })

  it('reports containment escapes and rolls them into the defect flag', () => {
    const result = buildResult({
      route: '/cities/bend',
      url: 'https://example.test/cities/bend',
      width: 375,
      height: 812,
      httpStatus: 200,
      navError: null,
      overflowRaw: null,
      crumbRaw: null,
      containmentRaw: {
        found: true,
        childCount: 2,
        container: { left: 0, top: 0, right: 300, bottom: 200 },
        children: [
          { tag: 'div', className: 'chip', text: '$500K', left: 10, top: 10, right: 100, bottom: 30 },
          { tag: 'div', className: 'chip', text: '$1.2M', left: 280, top: 10, right: 340, bottom: 30 },
        ],
      },
      opts: baseOpts,
    })
    expect(result.containment.escaping.length).toBe(1)
    expect(result.containment.defect).toBe(true)
    expect(result.defect).toBe(true)
  })

  it('treats a missing selector as "not found", not a defect', () => {
    const result = buildResult({
      route: '/listing/x',
      url: 'https://example.test/listing/x',
      width: 375,
      height: 812,
      httpStatus: 200,
      navError: null,
      overflowRaw: null,
      crumbRaw: null,
      containmentRaw: { found: false },
      opts: baseOpts,
    })
    expect(result.containment.found).toBe(false)
    expect(result.defect).toBe(false)
  })
})
