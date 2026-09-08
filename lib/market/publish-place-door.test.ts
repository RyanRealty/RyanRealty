import { describe, expect, it } from 'vitest'
import { publishPlaceFace, type PlaceFace } from '@/lib/market/publish-place-face'
import type { LeftoverHudKpis } from '@/lib/market/publish-leftover-hud'
import {
  placeDoorCountLabel,
  placeDoorTrace,
  publishPlaceDoor,
} from '@/lib/market/publish-place-door'

/** A full leftover pile — every cell present, so nothing is omitted by accident. */
function hud(over: Partial<LeftoverHudKpis> = {}): LeftoverHudKpis {
  return {
    active: 664,
    pending: 121,
    closed30: 180,
    new30: 148,
    medianList: 950_000,
    saleToList: 98.4,
    daysToPending: 23,
    monthsSupply: 3.9,
    sold12mo: 2100,
    ...over,
  }
}

const CITY_TRACE = placeDoorTrace({ grain: 'city', placeName: 'Bend' })
const COMMUNITY_TRACE = placeDoorTrace({ grain: 'community', placeName: 'Tetherow' })

describe('placeDoorCountLabel', () => {
  it('names the type scope the figure actually measures (R-024)', () => {
    expect(placeDoorCountLabel('homes for sale')).toBe('detached homes for sale')
    expect(placeDoorCountLabel('home for sale')).toBe('detached home for sale')
  })

  it('does not double the qualifier on a label that already carries it', () => {
    expect(placeDoorCountLabel('detached homes for sale')).toBe('detached homes for sale')
  })

  it('never publishes a bare count label, even for an empty input', () => {
    expect(placeDoorCountLabel('   ')).toBe('detached homes for sale')
  })
})

describe('publishPlaceDoor', () => {
  it('publishes the count as the door under a type-scoped label', () => {
    const face = publishPlaceFace({ grain: 'city', hud: hud() })
    const door = publishPlaceDoor({
      face,
      grain: 'city',
      placeName: 'Bend',
      href: '/homes-for-sale/bend',
      readDate: 'Sep 7, 2026',
    })
    expect(door).toEqual({
      href: '/homes-for-sale/bend',
      count: '664',
      countLabel: 'detached homes for sale',
      verdict: null,
      readDate: 'Sep 7, 2026',
      trace: CITY_TRACE,
    })
  })

  it('never labels the count "homes for sale" unqualified — the figure is detached only', () => {
    // market_metric segment='detached': Bend read 664 detached against 839
    // all-residential on the same computed_at. R-024, publish-search-count.ts.
    const face = publishPlaceFace({ grain: 'city', hud: hud() })
    for (const grain of ['city', 'neighborhood', 'community', 'subdivision'] as const) {
      const door = publishPlaceDoor({
        face,
        grain,
        placeName: 'Bend',
        href: '/homes-for-sale/bend',
        readDate: null,
      })
      expect(door?.countLabel).toMatch(/^detached /)
      expect(door?.countLabel).not.toBe('homes for sale')
    }
  })

  it('carries ONE figure — never the five-figure leftover HUD, and never a verdict', () => {
    // The node as written asked for "673 / $950,000 / seller's market / 3.9 /
    // 23". Everything but the count must be absent from what the primitive can
    // render, whatever the pile holds.
    const face = publishPlaceFace({ grain: 'city', hud: hud() })
    expect(face.stats.map((s) => s.id)).toEqual([
      'active',
      'medianList',
      'verdict',
      'monthsOfSupply',
      'daysToPending',
    ])
    const door = publishPlaceDoor({
      face,
      grain: 'city',
      placeName: 'Bend',
      href: '/homes-for-sale/bend',
      readDate: 'Sep 7, 2026',
    })
    const printed = JSON.stringify(door)
    expect(printed).not.toContain('$950,000')
    expect(printed).not.toContain('3.9')
    expect(printed).not.toContain('23 days')
    expect(printed).not.toContain('months of supply')
    expect(printed).not.toContain("seller's market")
    expect(Object.keys(door ?? {}).sort()).toEqual([
      'count',
      'countLabel',
      'href',
      'readDate',
      'trace',
      'verdict',
    ])
  })

  it('publishes no verdict at ANY grain, including city, whatever the pile holds', () => {
    // DATA_GRAPHICS.md gives the verdict one home and that home is
    // .place-opening__caption. The door printing it too was the same sentence
    // twice in one fold.
    for (const grain of ['city', 'neighborhood', 'community', 'subdivision'] as const) {
      const face = publishPlaceFace({ grain, hud: hud() })
      const door = publishPlaceDoor({
        face,
        grain,
        placeName: 'Bend',
        href: '/homes-for-sale/bend',
        readDate: 'Sep 7, 2026',
      })
      expect(door?.verdict).toBeNull()
      expect(door?.count).toBe('664')
    }
  })

  it('yields no verdict when a CITY face is handed in under a sub-city grain', () => {
    // The belt to publishPlaceFace's braces: a city face carries a 'verdict'
    // stat, and passing it here under grain 'neighborhood' must still publish
    // nothing — and must describe the neighborhood read, not the city one.
    const cityFace = publishPlaceFace({ grain: 'city', hud: hud() })
    expect(cityFace.stats.some((s) => s.id === 'verdict')).toBe(true)
    const door = publishPlaceDoor({
      face: cityFace,
      grain: 'neighborhood',
      placeName: 'Awbrey Butte',
      href: '/homes-for-sale/bend/awbrey-butte',
      readDate: null,
    })
    expect(door?.verdict).toBeNull()
    expect(door?.trace).toBe(placeDoorTrace({ grain: 'neighborhood', placeName: 'Awbrey Butte' }))
  })

  it('derives the trace from the same grain the face was asked for', () => {
    const face = publishPlaceFace({ grain: 'community', hud: hud() })
    const door = publishPlaceDoor({
      face,
      grain: 'community',
      placeName: 'Tetherow',
      href: '/homes-for-sale/bend/awbrey-butte',
      readDate: null,
    })
    expect(door?.trace).toBe(COMMUNITY_TRACE)
  })

  it('renders nothing when the count is unknown — no placeholder, no zero', () => {
    const face = publishPlaceFace({ grain: 'city', hud: hud({ active: null }) })
    expect(face.stats.some((s) => s.id === 'active')).toBe(false)
    expect(
      publishPlaceDoor({
        face,
        grain: 'city',
        placeName: 'Bend',
        href: '/homes-for-sale/bend',
        readDate: 'Sep 7, 2026',
      }),
    ).toBeNull()
  })

  it('renders no door on a measured zero: a door opens onto inventory, and there is none', () => {
    const face = publishPlaceFace({ grain: 'city', hud: hud({ active: 0, monthsSupply: null }) })
    const door = publishPlaceDoor({
      face,
      grain: 'city',
      placeName: 'Bend',
      href: '/homes-for-sale/bend',
      readDate: 'Sep 7, 2026',
    })
    expect(door).toBeNull()
  })

  it('renders nothing when the href would land off-place or bounce', () => {
    const face = publishPlaceFace({ grain: 'city', hud: hud() })
    const args = { face, grain: 'city' as const, placeName: 'Bend', readDate: 'Sep 7, 2026' }
    // the unfiltered regional index
    expect(publishPlaceDoor({ ...args, href: '/homes-for-sale' })).toBeNull()
    expect(publishPlaceDoor({ ...args, href: '/homes-for-sale?view=list' })).toBeNull()
    expect(publishPlaceDoor({ ...args, href: null })).toBeNull()
    // the legacy-redirect key that 301s a Tetherow door back to its own page
    expect(publishPlaceDoor({ ...args, href: '/homes-for-sale/bend/tetherow' })).toBeNull()
  })

  it('drops a blank or dateless stamp rather than printing "updated" with no date', () => {
    const face = publishPlaceFace({ grain: 'city', hud: hud() })
    const args = { face, grain: 'city' as const, placeName: 'Bend', href: '/homes-for-sale/bend' }
    expect(publishPlaceDoor({ ...args, readDate: null })?.readDate).toBeNull()
    expect(publishPlaceDoor({ ...args, readDate: '   ' })?.readDate).toBeNull()
    // formatDate returns a lone em dash for anything it cannot parse.
    expect(publishPlaceDoor({ ...args, readDate: '—' })?.readDate).toBeNull()
  })

  it('keeps the singular the face publishes for a lone listing, under the type scope', () => {
    const face: PlaceFace = publishPlaceFace({ grain: 'community', hud: hud({ active: 1 }) })
    const door = publishPlaceDoor({
      face,
      grain: 'community',
      placeName: 'Tetherow',
      href: '/homes-for-sale/bend/awbrey-butte',
      readDate: 'Sep 7, 2026',
    })
    expect(door?.count).toBe('1')
    expect(door?.countLabel).toBe('detached home for sale')
  })
})

describe('placeDoorTrace', () => {
  it('names the filter that actually ran at city: MLS city text, never a polygon', () => {
    // supabase/migrations/20260823001500_refresh_place_membership.sql:2 —
    // "Cities: MLS city text (D5), hyphen slug. Never city polygons."
    const trace = placeDoorTrace({ grain: 'city', placeName: 'Bend' })
    expect(trace).toMatch(/MLS City is Bend/)
    expect(trace).not.toMatch(/city boundary/)
    // The trace names the feed and the filter in a buyer's words. "Market
    // Truth" and "the metric layer" are our names for our own plumbing.
    expect(trace).toMatch(/^regional MLS through Oregon Data Share: /)
    expect(trace).not.toMatch(/Market Truth|metric layer|the layer/i)
  })

  it('recites no months-of-supply methodology, because the door prints no supply figure', () => {
    for (const grain of ['city', 'neighborhood', 'community', 'subdivision'] as const) {
      const trace = placeDoorTrace({ grain, placeName: 'Bend' })
      expect(trace).not.toMatch(/Months of supply = /)
      expect(trace).not.toMatch(/4 months of supply or less/)
    }
  })

  it('names the polygon read at neighborhood, with that read\'s own status set', () => {
    const trace = placeDoorTrace({ grain: 'neighborhood', placeName: 'Awbrey Butte' })
    expect(trace).toMatch(/Awbrey Butte boundary polygon/)
    expect(trace).toMatch(/Coming Soon/)
    expect(trace).toMatch(/Active and Active Under Contract/)
  })

  it('names boundary membership at community and subdivision', () => {
    for (const grain of ['community', 'subdivision'] as const) {
      const trace = placeDoorTrace({ grain, placeName: 'Tetherow' })
      expect(trace).toMatch(/assigned to Tetherow by boundary membership/)
    }
  })

  it('states the Market Truth status set in plain English: Active only, under-contract homes counted separately', () => {
    // market_metric active_count is StandardStatus 'Active' ONLY; Active Under
    // Contract lands in pending_count
    // (supabase/migrations/20260823010000_compute_market_metrics_shadow.sql:136
    // and :164). The label over the door says "homes for sale"; the trace under
    // it has to describe the same population.
    for (const grain of ['city', 'community', 'subdivision'] as const) {
      const trace = placeDoorTrace({ grain, placeName: 'Bend' })
      expect(trace).toMatch(/Active listings only/)
      expect(trace).toMatch(/homes already under contract are counted separately/)
    }
  })

  it('speaks no internal jargon: never "grain", never a clause about figures that are not on screen', () => {
    // The first cut appended "...are not published at this grain." to the
    // sub-city bodies. "Grain" is our word, not a buyer's, and the door shows
    // no supply figure and no verdict for a withheld-clause to be about.
    for (const grain of ['city', 'neighborhood', 'community', 'subdivision'] as const) {
      const trace = placeDoorTrace({ grain, placeName: 'Bend' })
      expect(trace).not.toMatch(/\bgrain\b/i)
      expect(trace).not.toMatch(/not published/)
      expect(trace).not.toMatch(/verdict/i)
      expect(trace).not.toMatch(/months of supply/i)
    }
  })

  it('says detached at every grain, matching the label it sits under', () => {
    for (const grain of ['city', 'neighborhood', 'community', 'subdivision'] as const) {
      expect(placeDoorTrace({ grain, placeName: 'Bend' })).toMatch(/detached single-family/)
    }
  })
})
