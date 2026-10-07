import { describe, expect, it } from 'vitest'
import { CHART_BOX, CHART_DRAW_SECONDS, chartGeometry, dotAt, drawProgress, monthTimes, type MotionSeries } from './chart'
import { MAP_BOX, cameraAt, mapGeometry, simplifyRing, type LngLatRing } from './map'
import {
  CHART_DRAW_START,
  cueTexts,
  figureLeaks,
  frameState,
  planMotion,
  stillTimes,
  type MotionCue,
  type MotionPlan,
  type MotionSubject,
} from './cues'
import { buildMotionPage } from './page'
import type { MotionAssets } from './assets'

const series: MotionSeries = {
  title: 'Median sale price',
  scope: 'Detached single-family homes sold in Bend, by month',
  points: Array.from({ length: 24 }, (_, i) => ({
    tick: `T${i}`,
    // Month 9 withheld: a gap, never a zero.
    value: i === 9 ? null : 650000 + i * 3000 + (i % 6) * 9000,
  })),
  firstKey: 'median sale price, Oct 2024',
  lastKey: 'median sale price, Sep 2026',
}

const trendSubject = (withMeter = true): MotionSubject => {
  const figures: Record<string, string> = {
    'median sale price, Oct 2024': '$650,000',
    'median sale price, Sep 2026': '$734,000',
  }
  if (withMeter) figures['months of supply'] = '3.6'
  return {
    label: 'Bend, Oregon',
    figures,
    citations: Object.values(figures).map((figure) => ({ figure, computed_at: '2026-10-01T00:00:00.000Z' })),
    series: { ...series, points: series.points.map((p, i) => ({ ...p, tick: i === 0 ? 'Oct 2024' : i === 23 ? 'Sep 2026' : p.tick })) },
  }
}

/** A square half a kilometre on a side near Bend, in [lng, lat]. */
function square(lng: number, lat: number, size: number): LngLatRing {
  const dLng = size / Math.cos((lat * Math.PI) / 180)
  return [
    [lng, lat],
    [lng + dLng, lat],
    [lng + dLng, lat + size],
    [lng, lat + size],
    [lng, lat],
  ]
}

const city = square(-121.37, 44.0, 0.12)
const place = square(-121.33, 44.05, 0.006)

const mapSubject = (context: LngLatRing[] | null = [city]): MotionSubject => ({
  label: 'Old Bend',
  heading: { eyebrow: 'Bend, Oregon', line: 'Old Bend' },
  figures: { 'active listings': '23', 'median list price': '$1,150,000' },
  citations: [
    { figure: '23', refreshed_at: '2026-10-07T12:00:00.000Z' },
    { figure: '$1,150,000', refreshed_at: '2026-10-07T12:00:00.000Z' },
  ],
  outline: { subject: [place], context },
})

const byKind = <K extends MotionCue['kind']>(plan: MotionPlan, kind: K) =>
  plan.cues.filter((c): c is Extract<MotionCue, { kind: K }> => c.kind === kind)

describe('chart geometry', () => {
  const g = chartGeometry(series)!

  it('maps the series into the chart box, calendar kept, lifting across a gap', () => {
    expect(g.points).toHaveLength(24)
    expect(g.points[9].plot).toBe(false)
    expect(g.d.match(/M/g)).toHaveLength(2)
    expect(g.x0).toBeGreaterThanOrEqual(CHART_BOX.left)
    expect(g.x1).toBeLessThanOrEqual(CHART_BOX.left + CHART_BOX.width)
    for (let i = 1; i < g.points.length; i++) expect(g.points[i].x).toBeGreaterThan(g.points[i - 1].x)
  })

  it('a higher price sits higher on the screen', () => {
    const [a, b] = [g.points[0], g.points[5]]
    expect((series.points[5].value as number) > (series.points[0].value as number)).toBe(true)
    expect(b.y).toBeLessThan(a.y)
  })

  it('the dot rides the line and steps over the gap', () => {
    expect(dotAt(g.points, g.points[3].x)).toEqual({ x: g.points[3].x, y: g.points[3].y })
    const inGap = (g.points[8].x + g.points[9].x) / 2
    expect(dotAt(g.points, inGap)).toBeNull()
  })

  it('a month note lands on the frame the dot passes that month', () => {
    const times = monthTimes(g, 1)
    expect(times).toHaveLength(23)
    expect(times[0].t).toBeCloseTo(1, 3)
    expect(times[times.length - 1].t).toBeCloseTo(1 + CHART_DRAW_SECONDS, 3)
    for (const { index, t } of times) {
      const x = g.x0 + (g.x1 - g.x0) * drawProgress(t, 1)
      expect(Math.abs(x - g.points[index].x)).toBeLessThan(0.5)
    }
  })
})

describe('map geometry', () => {
  it('Douglas-Peucker keeps the corners and drops points on a straight edge', () => {
    const ring: Array<[number, number]> = [
      [0, 0],
      [5, 0],
      [10, 0],
      [10, 10],
      [0, 10],
      [0, 0],
    ]
    expect(simplifyRing(ring, 0.1)).toEqual([
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
      [0, 0],
    ])
  })

  it('opens on the city and arrives on the place, at its true shape', () => {
    const g = mapGeometry({ subject: [place], context: [city] })!
    expect(g.open).toEqual({ s: 1, tx: 0, ty: 0 })
    expect(g.arrive.s).toBeGreaterThan(5)
    expect(g.contextPath).toMatch(/^M.*Z$/)
    // A ground square is a screen square: projection keeps the shape.
    const xs = g.subjectPath.match(/-?\d+\.\d+,-?\d+\.\d+/g)!.map((pair) => pair.split(',').map(Number))
    const w = Math.max(...xs.map(([x]) => x)) - Math.min(...xs.map(([x]) => x))
    const h = Math.max(...xs.map(([, y]) => y)) - Math.min(...xs.map(([, y]) => y))
    expect(w / h).toBeCloseTo(1, 1)
  })

  it('with no city, or a city that does not hold the place, there is no move', () => {
    expect(mapGeometry({ subject: [place], context: null })!.open).toEqual(mapGeometry({ subject: [place], context: null })!.arrive)
    const elsewhere = square(-120.0, 45.0, 0.12)
    const g = mapGeometry({ subject: [place], context: [elsewhere] })!
    expect(g.contextPath).toBeNull()
    expect(g.open).toEqual(g.arrive)
  })

  it('a place in several pieces draws them in turn, longest first, closing at the end of the draw', () => {
    const island = square(-121.31, 44.06, 0.002)
    const g = mapGeometry({ subject: [island, place], context: [city] })!
    expect(g.rings).toHaveLength(2)
    expect(g.rings[0].a).toBe(0)
    expect(g.rings[0].b).toBe(g.rings[1].a)
    expect(g.rings[1].b).toBe(1)
    // The bigger ring owns the bigger share of the draw.
    expect(g.rings[0].b - g.rings[0].a).toBeGreaterThan(g.rings[1].b - g.rings[1].a)
  })

  it('the camera zooms in log space about one fixed point', () => {
    const g = mapGeometry({ subject: [place], context: [city] })!
    expect(cameraAt(g, 0, 1, 2)).toEqual(g.open)
    expect(cameraAt(g, 3, 1, 2)).toEqual(g.arrive)
    // The curve is symmetric, so halfway in time is the geometric mean of scale.
    expect(cameraAt(g, 2, 1, 2).s).toBeCloseTo(Math.sqrt(g.open.s * g.arrive.s), 2)
    // The fixed point sits at the same screen position all the way in.
    const fx = (g.open.tx - g.arrive.tx) / (g.arrive.s - g.open.s)
    const at = (t: number) => {
      const c = cameraAt(g, t, 1, 2)
      return fx * c.s + c.tx
    }
    expect(at(1.4)).toBeCloseTo(at(1), 0)
    expect(at(2.6)).toBeCloseTo(at(1), 0)
  })

  it('every outline point fits the map box once the camera has arrived', () => {
    const g = mapGeometry({ subject: [place], context: [city] })!
    const pts = g.subjectPath.match(/-?\d+\.\d+,-?\d+\.\d+/g)!.map((pair) => pair.split(',').map(Number))
    for (const [x, y] of pts) {
      const sx = x * g.arrive.s + g.arrive.tx
      const sy = y * g.arrive.s + g.arrive.ty
      expect(sx).toBeGreaterThanOrEqual(-0.5)
      expect(sx).toBeLessThanOrEqual(MAP_BOX.width + 0.5)
      expect(sy).toBeGreaterThanOrEqual(-0.5)
      expect(sy).toBeLessThanOrEqual(MAP_BOX.height + 0.5)
    }
  })
})

describe('planMotion: paper films', () => {
  it('a trend film: the line, the meter, the closer, on paper, at its own length', () => {
    const plan = planMotion({ spec: { lead: 'trend', closer: 'brand' }, subject: trendSubject(), duration: 6 })
    expect(plan.surface).toBe('paper')
    expect(plan.cues.map((c) => c.kind)).toEqual(['chart', 'meter', 'closer'])
    const [chart] = byKind(plan, 'chart')
    expect(chart.start).toBe(0)
    expect(chart.drawStart).toBe(CHART_DRAW_START)
    expect(chart.first.text).toBe('$650,000')
    expect(chart.last.text).toBe('$734,000')
    expect(plan.duration).toBe(byKind(plan, 'closer')[0].end)
    expect(plan.duration).toBeGreaterThan(12)
    expect(figureLeaks(plan, trendSubject())).toEqual([])
    expect(cueTexts(chart)).toEqual(expect.arrayContaining(['Oct 2024', 'Sep 2026', 'Median sale price']))
  })

  it('a market whose months of supply was withheld has no meter card', () => {
    const plan = planMotion({ spec: { lead: 'trend', closer: 'brand' }, subject: trendSubject(false), duration: 6 })
    expect(plan.cues.map((c) => c.kind)).toEqual(['chart', 'closer'])
    expect(plan.notes.join(' ')).toContain('withheld months of supply')
  })

  it('the as-of date is read from the figure\'s own trace, not a lookalike value', () => {
    const subject = trendSubject()
    // A pulse figure printing the same string as the latest month, refreshed on another day.
    subject.figures['median list price'] = '$734,000'
    subject.citations = [
      { figure: '$734,000', refreshed_at: '2026-10-07T12:00:00.000Z' },
      { figure: '$650,000', figure_key: 'median sale price, Oct 2024', computed_at: '2026-10-01T00:00:00.000Z' },
      { figure: '$734,000', figure_key: 'median sale price, Sep 2026', computed_at: '2026-10-01T00:00:00.000Z' },
      { figure: '3.6', computed_at: '2026-10-01T00:00:00.000Z' },
    ]
    const plan = planMotion({ spec: { lead: 'trend', closer: 'brand' }, subject, duration: 6 })
    // The monthly cell's computed_at (Sep 30 in Pacific time), never the pulse row's Oct 7.
    expect(byKind(plan, 'chart')[0].asOf).toBe('As of Sep 30, 2026')
  })

  it('a labelled month with no trace means no film', () => {
    const subject = trendSubject()
    delete subject.figures['median sale price, Sep 2026']
    const plan = planMotion({ spec: { lead: 'trend', closer: 'brand' }, subject, duration: 6 })
    expect(plan.cues).toEqual([])
  })

  it('the scale is round values inside the drawn range, labelled as a ruler and allowed through', () => {
    const plan = planMotion({ spec: { lead: 'trend', closer: 'brand' }, subject: trendSubject(), duration: 6 })
    const [chart] = byKind(plan, 'chart')
    expect(chart.gridlines.length).toBeGreaterThanOrEqual(1)
    expect(chart.gridlines.length).toBeLessThanOrEqual(3)
    for (const g of chart.gridlines) expect(g.label).toMatch(/^\$\d+K$|^\$\d+(\.\d+)?M$/)
    expect(figureLeaks(plan, trendSubject(), chart.gridlines.map((g) => g.label))).toEqual([])
  })

  it('a figure that measures single-family homes says so', () => {
    const subject = trendSubject()
    subject.citations = subject.citations.map((c) =>
      c.figure === '3.6' ? { ...c, filter: "stat_id='months_of_supply', geo_type='city', geo_slug='bend', segment='detached'" } : c,
    )
    const plan = planMotion({ spec: { lead: 'trend', closer: 'brand' }, subject, duration: 6 })
    expect(byKind(plan, 'meter')[0].eyebrow).toBe('Bend, Oregon · single-family homes')
  })

  it('a number drawn on a trend film that is not a figure is a leak', () => {
    const plan = planMotion({ spec: { lead: 'trend', closer: 'brand' }, subject: trendSubject(), duration: 6 })
    expect(figureLeaks(plan, trendSubject(), ['$650,000', '$712,000'])).toEqual(['$712,000'])
  })

  it('a map film: the map, the place figures under it, the closer', () => {
    const plan = planMotion({ spec: { lead: 'map', closer: 'brand' }, subject: mapSubject(), duration: 6 })
    expect(plan.cues.map((c) => c.kind)).toEqual(['map', 'figure', 'closer'])
    const [figure] = byKind(plan, 'figure')
    expect(figure.value).toBe('23')
    expect(figure.detail).toBe('Median list price $1,150,000')
    expect(figure.figureKeys).toEqual(['active listings', 'median list price'])
    const [map] = byKind(plan, 'map')
    expect(map.zoomSeconds).toBeGreaterThan(0)
    expect(map.end).toBe(figure.end)
    expect(figureLeaks(plan, mapSubject())).toEqual([])
  })

  it('a map with no city to open on draws at once, with no camera move', () => {
    const plan = planMotion({ spec: { lead: 'map', closer: 'brand' }, subject: mapSubject(null), duration: 6 })
    const [map] = byKind(plan, 'map')
    expect(map.zoomSeconds).toBe(0)
    expect(map.drawStart).toBe(map.zoomStart)
  })
})

describe('frameState: paper films', () => {
  it('frame 0 is the whole opening picture: heading, scale, the first month and its ring', () => {
    const plan = planMotion({ spec: { lead: 'trend', closer: 'brand' }, subject: trendSubject(), duration: 6 })
    const at0 = frameState(plan, 0)
    expect(at0.find((s) => s.id === 'lead1-axis')?.opacity).toBe(1)
    expect(at0.find((s) => s.id === 'lead1-head')?.opacity).toBe(1)
    expect(at0.find((s) => s.id === 'lead1-axis')?.labels).toEqual([1, 0])
    // Nothing of the line yet.
    expect(at0.find((s) => s.id === 'lead1-axis')?.reveal).toBe(0)
    const [chart] = byKind(plan, 'chart')
    const landed = frameState(plan, chart.drawStart + CHART_DRAW_SECONDS + 0.5).find((s) => s.id === 'lead1-axis')!
    expect(landed.labels).toEqual([1, 1])
    expect(landed.reveal).toBeCloseTo(chart.x1, 1)
    expect(landed.dot).toEqual([chart.last.x, chart.last.y, 1])
    // Mid-draw, the latest label is not up yet.
    expect(frameState(plan, chart.drawStart + 1).find((s) => s.id === 'lead1-axis')!.labels).toEqual([1, 0])
  })

  it('the map opens on the city and finishes drawn and filled on the place', () => {
    const plan = planMotion({ spec: { lead: 'map', closer: 'brand' }, subject: mapSubject(), duration: 6 })
    const [map] = byKind(plan, 'map')
    const open = frameState(plan, 0).find((s) => s.id === 'lead1-card')!
    expect(open.opacity).toBe(1)
    expect(open.camera).toEqual([map.geometry.open.s, map.geometry.open.tx, map.geometry.open.ty])
    expect(open.draw).toBe(0)
    const done = frameState(plan, map.drawStart + map.drawSeconds + 0.5).find((s) => s.id === 'lead1-card')!
    expect(done.camera).toEqual([map.geometry.arrive.s, map.geometry.arrive.tx, map.geometry.arrive.ty])
    expect(done.draw).toBe(1)
    expect(done.fill).toBe(1)
    expect(done.locator).toBe(0)
  })

  it('stills are pulled once each picture has finished', () => {
    const plan = planMotion({ spec: { lead: 'trend', closer: 'brand' }, subject: trendSubject(), duration: 6 })
    const [chart] = byKind(plan, 'chart')
    const still = stillTimes(plan).find((s) => s.cueId === 'lead1')!
    expect(still.t).toBeGreaterThan(chart.drawStart + CHART_DRAW_SECONDS)
    expect(still.t).toBeLessThan(chart.end)
  })
})

describe('buildMotionPage: paper', () => {
  const assets: MotionAssets = {
    fonts: { amboqia: 'data:a', amboqiaI: 'data:a', azo: 'data:a', geist400: 'data:a', geist500: 'data:a', geist600: 'data:a' },
    wordmark: 'data:image/png;base64,AAAA',
    headshots: {},
  }

  it('draws the trend on cream with only the brand colours and no network', () => {
    const plan = planMotion({ spec: { lead: 'trend', closer: 'brand' }, subject: trendSubject(), duration: 6 })
    const html = buildMotionPage({ plan, width: 1080, height: 1920, assets })
    expect(html).toContain('<body class="paper">')
    expect(html).toContain('id="lead1-reveal"')
    expect(html).toContain('id="lead1-dot"')
    expect(html).toContain('>Oct 2024<')
    // The first month hangs over its own start on a leader; the latest sits beside its own dot.
    expect(html.match(/class="leader"/g)).toHaveLength(1)
    // No floor rule under a near-data line; round-value gridlines carry the scale instead.
    expect(html).not.toContain('class="baseline"')
    expect(html.match(/class="grid"/g)!.length).toBeGreaterThanOrEqual(1)
    expect(html).not.toMatch(/https?:\/\//)
    const hexes = new Set((html.match(/#[0-9a-fA-F]{6}\b/g) ?? []).map((h) => h.toLowerCase()))
    expect([...hexes].sort()).toEqual(['#102742', '#faf8f4'])
    for (const value of html.match(/rgba\((\d+),(\d+),(\d+),[\d.]+\)/g) ?? []) {
      expect(value).toMatch(/^rgba\((16,39,66|250,248,244),/)
    }
    // Amboqia never sits on a number: the chart's labels are Geist.
    expect(html).toMatch(/\.clabel\{font:600 50px 'RR Geist'/)
  })

  it('draws the map outline through a normalised dash', () => {
    const plan = planMotion({ spec: { lead: 'map', closer: 'brand' }, subject: mapSubject(), duration: 6 })
    const html = buildMotionPage({ plan, width: 1080, height: 1920, assets })
    expect(html).toContain('pathLength="1"')
    expect(html).toContain('class="context"')
    expect(html).toContain('id="lead1-camera"')
  })
})
